-- ============================================================
-- Joining an existing team by code
--
-- Until now the only way onto a roster was create_team_with_captain, which
-- adds exactly one person: the captain. This adds the second path — a
-- player enters a team's join code, picks a position, and lands on the
-- roster as pending until the captain approves them.
--
-- The code is a lookup key, NOT a secret. The captain's approval is the
-- authorization boundary, so a leaked code buys nothing but a request that
-- gets declined. Keeping it secret would mean revoking table-level SELECT
-- on teams and re-granting every other column by name (the pattern in
-- public_read_access.sql), which breaks silently every time a column is
-- added — a lot of fragility for a second, redundant gate.
-- ============================================================

-- gen_random_uuid() is core in PG13+, so this needs no extension. It is
-- volatile, so `add column` rewrites the table and evaluates the default
-- per row: existing teams each get their own code with no backfill.
--
-- 8 hex characters is ~4.3 billion codes. A collision would abort the
-- inserting transaction rather than hand out a duplicate; widen the slice
-- if that ever actually happens.
--
-- teams already has table-level grants and a "public read" policy, so the
-- new column needs no grant work of its own.
alter table public.teams
  add column join_code text not null unique
  default substr(gen_random_uuid()::text, 1, 8);

-- Mirrors the is_captain boolean above it. Default true so existing rows,
-- captains, and players an admin adds directly are approved on arrival —
-- only a self-service join writes false.
alter table public.team_users
  add column is_approved boolean not null default true;

-- ============================================================
-- roster_open: the deadline roster changes hang off
--
-- A season has no start date of its own — it is the earliest match_time in
-- season_weeks — and roster changes close a week before it. Same rule the
-- admin seasons page already shows as "reg closes ...".
--
-- coalesce matters: a season with no weeks gives min() = null, and
-- `not null` is not true, so without it the lock would fall open on
-- exactly the seasons that are least ready. Fail closed instead.
-- ============================================================

create function public.roster_open(target_team_id integer)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    now() < min(public.season_weeks.match_time) - interval '1 week',
    false
  )
  from public.season_weeks
  join public.teams
    on public.teams.season_id = public.season_weeks.season_id
  where public.teams.id = target_team_id;
$$;

-- Read by the server actions too, so they can say "this team is no longer
-- taking players" instead of surfacing a bare RLS rejection.
grant execute on function public.roster_open(integer) to authenticated;

-- ============================================================
-- Row Level Security
--
-- Both policies are permissive, so they are OR'd with the existing
-- team_users policies rather than replacing them: admins and captains keep
-- everything they already had. create_team_with_captain is security
-- definer and bypasses RLS entirely, so it is unaffected.
-- ============================================================

-- A player may add themselves, and only themselves, and only as a pending
-- non-captain. Without `is_approved = false` this would let anyone walk
-- straight onto a roster; without `user_id = auth.uid()` it would let them
-- sign somebody else up.
create policy "player requests to join" on public.team_users for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_approved = false
    and is_captain = false
    and public.roster_open(team_id)
  );

-- Captains may flip a pending row to approved, and nothing else.
--
-- "admin update roster" is admin-only on purpose — captaincy is a fixed,
-- single-holder assignment and captains don't get to promote themselves.
-- RLS filters rows rather than columns, so that intent can't be preserved
-- by naming columns; it is preserved by the two halves of this policy
-- instead. USING decides which existing rows are reachable at all (pending
-- ones, on a team they captain, before the deadline); WITH CHECK decides
-- what the row is allowed to become, which is what keeps is_captain out of
-- reach. Approving is therefore the only edit this opens up, and it is
-- one-way: an approved row no longer satisfies USING.
--
-- Admins are exempt from the deadline here; they still hold the
-- unrestricted policy anyway, and they are the escape hatch when a roster
-- needs fixing late.
create policy "captain approves pending players" on public.team_users for update to authenticated
  using (
    is_approved = false
    and (
      public.is_admin()
      or (public.is_team_captain(team_id) and public.roster_open(team_id))
    )
  )
  with check (is_approved = true and is_captain = false);

-- Declining needs no policy of its own: "admin or captain remove players"
-- already covers deleting the row. It is deliberately left un-deadlined —
-- it also governs removing approved players, which is a separate concern
-- from this feature.
