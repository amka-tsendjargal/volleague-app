-- ============================================================
-- Replace users.name with first_name / last_name
-- (users table has no data yet, so no backfill needed)
-- Add new email and phone_number columns
-- ============================================================

alter table public.users drop column name;
alter table public.users add column first_name   varchar(255) not null;
alter table public.users add column last_name    varchar(255) not null;
alter table public.users add column email        varchar(255) not null;
alter table public.users add column phone_number varchar(32);

-- ------------------------------------------------------------
-- Keep the signup trigger in sync with the new columns
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, first_name, last_name, email, phone_number)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.email,
    new.raw_user_meta_data->>'phone_number'
  );
  return new;
end;
$$;
