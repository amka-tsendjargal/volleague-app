-- ============================================================
-- generate_schedule: replace a season's fixtures in one transaction
--
-- The pairing itself is not here. Working out who plays whom is a pure
-- function of the team list and the week list, so it lives in
-- app/admin/seasons/round-robin.ts where Jest can test it directly; this
-- function only takes the finished fixtures and stores them.
--
-- Why a function and not a delete followed by an insert in the server
-- action: regenerating is check-then-delete-then-insert, and PostgREST
-- commits each HTTP request in its own transaction. `sets` cascades from
-- `schedules`, so a score recorded between the check and the delete would
-- be destroyed by a delete that already believed there were none. One
-- .rpc() call is one request, so the check and the delete cannot be
-- separated by another writer.
--
-- Deliberately does NOT touch seasons.status. A generated schedule is a
-- draft for an admin to look over; publishing it is a separate decision.
--
-- security definer to bypass the admin-only write policy on schedules,
-- bounded by the body: this deletes and inserts fixtures for one season
-- and does nothing else. is_admin() still resolves to the caller inside a
-- definer function, since it reads the request's JWT claims rather than
-- the database role.
-- ============================================================

create function public.generate_schedule(
  target_season_id integer,
  fixtures jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if not public.is_admin() then
    raise exception 'must be an admin to generate a schedule'
      using errcode = '42501';
  end if;

  -- Scores outlive drafts: once a match has been played, the fixture it
  -- was played under is a historical record, not something to replace.
  if exists (
    select 1
    from public.sets
    join public.schedules on schedules.id = sets.schedule_id
    join public.season_weeks on season_weeks.id = schedules.season_week_id
    where season_weeks.season_id = target_season_id
  ) then
    raise exception 'this season already has recorded scores'
      using errcode = '55000';
  end if;

  delete from public.schedules
  using public.season_weeks
  where season_weeks.id = schedules.season_week_id
    and season_weeks.season_id = target_season_id;

  insert into public.schedules (season_week_id, team_a_id, team_b_id, court_number)
  select
    fixture.season_week_id,
    fixture.team_a_id,
    fixture.team_b_id,
    fixture.court_number
  from jsonb_to_recordset(fixtures) as fixture(
    season_week_id integer,
    team_a_id integer,
    team_b_id integer,
    court_number integer
  )
  -- Fixtures arrive from the client's request, so a caller reaching the
  -- function directly could name weeks from another season. Joining
  -- rather than trusting the payload keeps this function unable to write
  -- outside the season it was asked about.
  join public.season_weeks on season_weeks.id = fixture.season_week_id
  where season_weeks.season_id = target_season_id;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.generate_schedule(integer, jsonb)
  from public, anon;

grant execute on function public.generate_schedule(integer, jsonb)
  to authenticated;
