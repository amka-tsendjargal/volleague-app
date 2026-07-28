-- ============================================================
-- Open league data to anonymous (logged-out) visitors
--
-- Until now every read policy was scoped `to authenticated`, so a
-- logged-out visitor saw nothing and pages had to reach for the
-- service-role client to render at all. League data — rosters,
-- schedules, scores, stats — is public information, so this admits
-- `anon` to it directly.
--
-- Deliberately NOT public:
--   roles, user_roles    who holds admin is free reconnaissance
--   jersey_preferences   internal ranking / procurement decisions
--   player_jerseys       holds each player's jersey `size`
--   users.phone_number   see the column-grant section below
--
-- Table-level SELECT grants for `anon` already exist (see
-- grant_data_api_access.sql); only the row-level policies were missing.
-- ============================================================

-- ------------------------------------------------------------
-- Fully public tables
-- ------------------------------------------------------------

drop policy "authenticated read" on public.positions;
create policy "public read" on public.positions
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.jerseys;
create policy "public read" on public.jerseys
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.teams;
create policy "public read" on public.teams
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.team_users;
create policy "public read" on public.team_users
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.schedules;
create policy "public read" on public.schedules
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.sets;
create policy "public read" on public.sets
  for select to anon, authenticated using (true);

drop policy "authenticated read" on public.set_stats;
create policy "public read" on public.set_stats
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------
-- users: the public sees names, never phone_number
--
-- RLS filters rows, not columns, so a policy alone cannot hide
-- phone_number from anonymous readers. Column-level grants can:
-- `anon` gives up table-wide SELECT and gets back only the three
-- columns a public roster needs. A `select *` as anon now fails with a
-- permission error instead of quietly leaking the phone number.
--
-- `authenticated` keeps its existing full-table read policy untouched.
-- ------------------------------------------------------------

revoke select on public.users from anon;
grant select (id, first_name, last_name) on public.users to anon;

create policy "public read" on public.users
  for select to anon using (true);

-- ------------------------------------------------------------
-- player_stats: make it respect the tables it reads
--
-- Views execute with their owner's privileges, and the owner (postgres)
-- bypasses RLS — so this view has been returning every row to anyone
-- holding SELECT on it, `anon` included, ignoring the policies on
-- set_stats and team_users entirely. Those tables are public as of this
-- migration so the visible result is unchanged, but security_invoker
-- makes the view track their policies rather than sidestep them: if a
-- base table is ever tightened, the view tightens with it.
-- ------------------------------------------------------------

alter view public.player_stats set (security_invoker = true);