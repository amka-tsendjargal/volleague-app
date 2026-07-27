-- Local seed data. Runs after migrations on `supabase db reset`.
-- `name` is unique, so guard against re-inserting on repeated resets.
insert into public.positions (name) values
  ('Coach')
on conflict (name) do nothing;

-- ============================================================
-- Sample player
-- Inserting into auth.users (rather than public.users directly) so the
-- on_auth_user_created trigger fires and creates the matching public.users
-- row the normal way. id is fixed so app code can reference this player as
-- a stand-in "current user" (see lib/constants.ts SEED_CAPTAIN_ID) until a
-- real login flow exists.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'sample.player@volleague.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Sam Player"}',
  now(), now()
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
