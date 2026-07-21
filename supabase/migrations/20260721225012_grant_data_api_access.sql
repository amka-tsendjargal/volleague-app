-- Data API roles (anon, authenticated, service_role) can't reach any
-- public table yet: this project's CLI config leaves `auto_expose_new_tables`
-- unset, which is the new default of NOT auto-granting table access to
-- those roles (see the comment above that field in supabase/config.toml).
-- RLS policies never even get evaluated without this — Postgres blocks
-- access at the coarser table-grant level first. This grants the CRUD
-- privileges the existing RLS policies (see initial_schema.sql) are
-- designed to further restrict at the row level, and sets default
-- privileges so tables added by future migrations aren't silently
-- unreachable the same way.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
