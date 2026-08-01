-- ============================================================
-- Creating a team as a real signed-in user
--
-- `teams` only ever had one write policy ("admin write"), so the
-- create-team flow could not run as the person using it — it ran through
-- the service-role client instead, with a hardcoded captain id standing
-- in for the login that now exists. This function replaces both.
--
-- Why a function and not just an insert policy: creating a team is two
-- inserts (teams, then team_users), and supabase-js reaches the database
-- through PostgREST, which commits each HTTP request in its own
-- transaction. Two inserts are two requests, so a failure on the second
-- leaves the first committed and the app has to compensate by deleting
-- the team it just made — which needs a delete policy permissive enough
-- to be a hole of its own. One `.rpc()` call is one request, so the whole
-- body runs in one transaction: a constraint violation anywhere rolls
-- both inserts back and no half-made team is ever visible.
--
-- security definer to bypass the admin-only policies on these tables.
-- Unlike the service-role client, the elevation is bounded by the body:
-- exactly these two inserts, always with the caller as captain.
-- `auth.uid()` still resolves to the caller inside a definer function
-- (it reads the request's JWT claims, not the database role), and it is
-- read here rather than accepted as a parameter — so there is no way to
-- steer this into writing a row for somebody else.
--
-- Input validation stays in the server action. The schema's own
-- constraints (teams_tier_valid, the jersey/position foreign keys, the
-- one-captain-per-team index) still apply and abort the transaction if
-- the action ever lets something through.
-- ============================================================

create function public.create_team_with_captain(
  team_name text,
  team_tier integer,
  team_jersey_id integer,
  team_position_id integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  captain_id uuid := auth.uid();
  new_team_id integer;
begin
  -- Unreachable through the app (the action checks first, and `anon` has
  -- no execute grant), but a definer function must never take that on
  -- trust and insert a null captain.
  if captain_id is null then
    raise exception 'must be signed in to create a team'
      using errcode = '42501';
  end if;

  insert into public.teams (name, tier, jersey_id)
  values (team_name, team_tier, team_jersey_id)
  returning id into new_team_id;

  insert into public.team_users (user_id, team_id, position_id, is_captain)
  values (captain_id, new_team_id, team_position_id, true);

  return new_team_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, which would
-- hand this to logged-out visitors too. Signed-in callers only.
revoke execute on function
  public.create_team_with_captain(text, integer, integer, integer)
  from public, anon;

grant execute on function
  public.create_team_with_captain(text, integer, integer, integer)
  to authenticated;
