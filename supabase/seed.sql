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
-- Sample team
-- The team details page needs a team with a real roster to show. No
-- unique constraint on teams.name, so guard with not exists.
-- ============================================================

insert into public.teams (name, tier, jersey_id)
select
  'Suck My Dig',
  1,
  (select id from public.jerseys where kit_name = 'Alternate White')
where not exists (
  select 1 from public.teams where name = 'Suck My Dig'
);

-- ============================================================
-- Sample roster
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

-- Sam Player is included so a freshly reset team still has its captain;
-- the other six are regular players.
insert into public.team_users (user_id, team_id, position_id, is_captain)
select
  member.user_id,
  (select id from public.teams where name = 'Suck My Dig'),
  (select id from public.positions where name = member.position),
  member.is_captain
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Opposite',       true),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Setter',         false),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Outside Hitter', false),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Outside Hitter', false),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Middle Blocker', false),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'Middle Blocker', false),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'Libero',         false)
) as member(user_id, position, is_captain)
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
