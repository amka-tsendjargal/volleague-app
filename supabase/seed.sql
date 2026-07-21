-- Local seed data. Runs after migrations on `supabase db reset`.
-- `name` is unique, so guard against re-inserting on repeated resets.
insert into public.positions (name) values
  ('Coach')
on conflict (name) do nothing;
