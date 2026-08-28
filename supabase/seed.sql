-- Local seed data. Runs after migrations on `supabase db reset`.
-- `name` is unique, so guard against re-inserting on repeated resets.
insert into public.positions (name) values
  ('Coach')
on conflict (name) do nothing;

-- ============================================================
-- Sample player
-- Inserting into auth.users (rather than public.users directly) so the
-- on_auth_user_created trigger fires and creates the matching public.users
-- row the normal way. Sign in as sample.player@volleague.test / password123
-- to pick up this account's roster and captaincy locally. id is fixed so
-- the sample roster below can reference it across resets.
--
-- The empty-string token columns are not decoration: Auth reads them into
-- non-nullable string fields, so a NULL there fails every sign-in for the
-- account with "Database error querying schema". Each seeded user also
-- needs an auth.identities row (added at the end of this file) — password
-- sign-in looks the account up through its email identity, not auth.users.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'sample.player@volleague.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Sam","last_name":"Player","phone_number":"555-0100"}',
  now(), now(),
  '', '', '', '', ''
)
on conflict (id) do nothing;

-- Makes the sample player an admin. Nothing under /admin renders without
-- it — is_admin() gates the layout — so without this there is no way to
-- create a season locally, and no way for any team to exist.
insert into public.user_roles (user_id, role_id)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  (select id from public.roles where role = 'admin')
on conflict (user_id, role_id) do nothing;

-- ============================================================
-- Sample jerseys
-- No unique constraint on kit_name, so guard with not exists instead of
-- on conflict.
-- ============================================================

insert into public.jerseys (kit_name)
select v.kit_name
from (values ('Home Red'), ('Away Black'), ('Alternate White')) as v(kit_name)
where not exists (
  select 1 from public.jerseys j where j.kit_name = v.kit_name
);

-- ============================================================
-- Sample players
-- No sample team or roster: teams.season_id is NOT NULL, and seeding a
-- season would take away the chance to exercise the create-season flow
-- against an empty database. Create a season, open registration, and
-- build a team from these accounts instead.
--
-- Inserted through auth.users so on_auth_user_created builds the
-- matching public.users rows, same as the sample player above. Fixed
-- ids keep the roster stable across repeated resets.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000',
  player.id,
  'authenticated',
  'authenticated',
  player.email,
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object(
    'first_name', player.first_name,
    'last_name', player.last_name
  ),
  now(), now(),
  '', '', '', '', ''
from (values
  ('22222222-2222-2222-2222-222222222222'::uuid, 'stephen.shi@volleague.test',    'Stephen', 'Shi'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'aiden.wong@volleague.test',     'Aiden',   'Wong'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'jeremy.player@volleague.test',  'Jeremy',  'Player'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'mo.player@volleague.test',      'Mo',      'Player'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'tyrrell.player@volleague.test', 'Tyrrell', 'Player'),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'danny.player@volleague.test',   'Danny',   'Player')
) as player(id, email, first_name, last_name)
on conflict (id) do nothing;

-- ============================================================
-- A full season, ready for a schedule to be generated
--
-- Fills 'Fall 2026 - Friday' Competitive to its cap: ten teams, an even
-- number so nobody sits out a week, each with MIN_PLAYERS_PER_TEAM
-- players so all ten count as confirmed.
--
-- Every insert here is guarded rather than unconditional, so it stands
-- the season up from nothing after `db reset` and equally tops up one
-- already built through the UI instead of duplicating it. The sample
-- accounts above stay off these rosters.
-- ============================================================

-- Five courts for the five matches ten teams play each week. Set on
-- conflict too, so a season created through the UI before courts existed
-- picks them up on the next seed rather than refusing to generate.
insert into public.seasons (name, status, court_numbers)
values ('Fall 2026 - Friday', 'registration', '{1,2,3,4,5}')
on conflict (name) do update set court_numbers = excluded.court_numbers;

insert into public.season_tiers (season_id, tier_id, max_teams)
select seasons.id, tiers.id, 10
from public.seasons, public.tiers
where seasons.name = 'Fall 2026 - Friday' and tiers.name = 'Competitive'
on conflict (season_id, tier_id) do nothing;

-- Fridays at 7pm; the last two weeks are playoffs.
insert into public.season_weeks (season_id, week_number, match_time, is_playoff)
select
  seasons.id,
  week_number,
  timestamptz '2026-09-11 19:00-04:00' + (week_number - 1) * interval '7 days',
  week_number > 12
from public.seasons, generate_series(1, 14) as week_number
where seasons.name = 'Fall 2026 - Friday'
on conflict (season_id, week_number) do nothing;

-- teams.name has no unique constraint, so guard with not exists; a team
-- that already exists in the season is skipped rather than doubled.
insert into public.teams (name, season_id, tier_id, jersey_id)
select
  'Test Team ' || team_number,
  season_tiers.season_id,
  season_tiers.tier_id,
  -- three seeded kits across ten teams, so they repeat
  (select jerseys.id from public.jerseys order by jerseys.id offset (team_number - 1) % 3 limit 1)
from generate_series(1, 10) as team_number
join public.seasons on seasons.name = 'Fall 2026 - Friday'
join public.season_tiers on season_tiers.season_id = seasons.id
join public.tiers on tiers.id = season_tiers.tier_id and tiers.name = 'Competitive'
where not exists (
  select 1 from public.teams
  where teams.season_id = season_tiers.season_id
    and teams.name = 'Test Team ' || team_number
);

-- 60 rostered players, one per team slot. Same auth.users route as the
-- accounts above; ids are derived from the slot so a reset rebuilds the
-- identical roster. Sign in as league.player1@volleague.test /
-- password123 (any number up to 60).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000',
  ('bbbbbbbb-0000-0000-0000-' || lpad(player_number::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'league.player' || player_number || '@volleague.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('first_name', 'League', 'last_name', 'Player ' || player_number),
  now(), now(),
  '', '', '', '', ''
from generate_series(1, 60) as player_number
on conflict (id) do nothing;

-- Six players per team, one of each position, slot 1 as captain — unless
-- the team already has a captain, since team_users_one_captain_per_team
-- allows only the one.
insert into public.team_users (user_id, team_id, position_id, is_captain)
select
  ('bbbbbbbb-0000-0000-0000-' || lpad(((team_number - 1) * 6 + slot)::text, 12, '0'))::uuid,
  teams.id,
  positions.id,
  slot = 1 and not exists (
    select 1 from public.team_users
    where team_users.team_id = teams.id and team_users.is_captain
  )
from generate_series(1, 10) as team_number
cross join generate_series(1, 6) as slot
join public.seasons on seasons.name = 'Fall 2026 - Friday'
join public.teams on teams.season_id = seasons.id
  and teams.name = 'Test Team ' || team_number
join public.positions on positions.name = (array[
  'Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero', 'Defensive Specialist'
])[slot]
on conflict (team_id, user_id) do nothing;

-- ============================================================
-- Email identities for the seeded accounts
-- Signing up through the API creates one of these automatically; hand-
-- written auth.users rows don't get one, and password sign-in resolves an
-- account through its identity, so without this every seeded login fails.
-- Covers both inserts above in one pass.
-- ============================================================

insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  auth.users.id::text,
  auth.users.id,
  jsonb_build_object(
    'sub', auth.users.id::text,
    'email', auth.users.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users
where auth.users.email like '%@volleague.test'
on conflict (provider, provider_id) do nothing;
