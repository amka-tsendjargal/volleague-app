-- ============================================================
-- tiers
--
-- Replaces the hardcoded TEAM_TIERS list and the teams_tier_valid check
-- that mirrored it. Adding a tier is now an insert, not a migration.
-- ============================================================

create table public.tiers (
  id         integer generated always as identity primary key,
  name       varchar(50) unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tiers (name) values ('Competitive'), ('Intermediate');

-- ============================================================
-- Seasons
--
-- The fixed input a schedule gets generated from: a set of teams, a set
-- of dates, and a cap per tier.
--
-- Start date, regular/playoff week counts and day of week are all
-- derivable from season_weeks, so none of them are stored here.
-- ============================================================

create table public.seasons (
  id         integer generated always as identity primary key,
  name       varchar(255) not null unique,
  -- draft        being set up, not visible to captains
  -- registration open; captains can create teams into it
  -- scheduled    schedule generated and published, season running
  -- complete     finished
  status     varchar(20) not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_status_valid
    check (status in ('draft', 'registration', 'scheduled', 'complete'))
);

-- Which tiers a season offers, and how many teams each will take. Two
-- concurrent seasons can offer different subsets of `tiers` at different
-- caps without affecting each other.
--
-- max_teams is not forced even: an even cap still can't guarantee an even
-- number of *confirmed* teams, so evenness is checked at generation time.
create table public.season_tiers (
  id         integer generated always as identity primary key,
  season_id  integer not null references public.seasons(id) on delete cascade,
  tier_id    integer not null references public.tiers(id) on delete restrict,
  max_teams  integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, tier_id),
  constraint season_tiers_max_teams_valid check (max_teams >= 2)
);

-- One row per playing night. Full timestamp per week so a holiday week can
-- move to another date, or another time, on its own.
--
-- Skipped weeks are re-dated, never renumbered: "week 7 is January 2nd".
create table public.season_weeks (
  id          integer generated always as identity primary key,
  season_id   integer not null references public.seasons(id) on delete cascade,
  week_number integer not null,
  match_time  timestamptz not null,
  is_playoff  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- also the lookup index for "weeks of this season"
  unique (season_id, week_number),
  constraint season_weeks_week_number_positive check (week_number > 0)
);

-- ============================================================
-- teams belong to a season, in a tier that season offers
--
-- The composite foreign key into season_tiers is what enforces the second
-- half of that: a team can't sit in a tier its own season doesn't run.
-- It also makes a separate teams -> seasons key redundant, and blocks
-- deleting a season out from under its teams.
--
-- season_id is NOT NULL, so this can't be added to a table that already
-- holds rows — the sample team is gone from seed.sql, run
-- `supabase db reset` rather than `migration up`.
-- ============================================================

alter table public.teams drop constraint teams_tier_valid;
alter table public.teams rename column tier to tier_id;
alter table public.teams add column season_id integer not null;

alter table public.teams
  add constraint teams_season_tier_offered
  foreign key (season_id, tier_id)
  references public.season_tiers(season_id, tier_id)
  on delete restrict;

-- Both implied by the composite key above, but PostgREST resolves embeds
-- (`teams(..., tiers(name))`, `seasons(..., teams(count))`) from direct
-- foreign keys only.
alter table public.teams
  add constraint teams_tier_id_fkey
  foreign key (tier_id) references public.tiers(id);
alter table public.teams
  add constraint teams_season_id_fkey
  foreign key (season_id) references public.seasons(id);

create index teams_season_id_tier_id_idx on public.teams (season_id, tier_id);

-- ============================================================
-- schedules hang off a week rather than carrying their own timestamp,
-- since every match in a week starts at the same time.
-- ============================================================

alter table public.schedules
  add column season_week_id integer not null references public.season_weeks(id) on delete cascade,
  drop column match_time;

create index schedules_season_week_id_idx on public.schedules (season_week_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger set_updated_at before update on public.tiers for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.seasons for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.season_tiers for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.season_weeks for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================
-- Row Level Security
-- Public read like the other league tables; admin-only writes, which is
-- what lets the create-season action insert directly instead of via RPC.
-- ============================================================

alter table public.tiers enable row level security;
alter table public.seasons enable row level security;
alter table public.season_tiers enable row level security;
alter table public.season_weeks enable row level security;

create policy "public read" on public.tiers for select to anon, authenticated using (true);
create policy "public read" on public.seasons for select to anon, authenticated using (true);
create policy "public read" on public.season_tiers for select to anon, authenticated using (true);
create policy "public read" on public.season_weeks for select to anon, authenticated using (true);

create policy "admin write" on public.tiers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.season_tiers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.season_weeks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- create_team_with_captain: now season-scoped and capped
--
-- Dropped and recreated because the signature changes — `create or
-- replace` would leave the old 4-arg version behind as a callable
-- overload that still makes seasonless, uncapped teams.
--
-- The `for update` on season_tiers is why the cap check can't move into
-- the server action: counting teams then inserting is a read-then-write,
-- so two captains racing for the last slot would both read 9 of 10 and
-- both insert. Locking the cap row first serializes them, and that only
-- holds if the lock and the insert share a transaction.
-- ============================================================

drop function public.create_team_with_captain(text, integer, integer, integer);

create function public.create_team_with_captain(
  team_name text,
  team_season_id integer,
  team_tier_id integer,
  team_jersey_id integer,
  team_position_id integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  captain_id    uuid := auth.uid();
  season_status text;
  tier_cap      integer;
  teams_in_tier integer;
  new_team_id   integer;
begin
  if captain_id is null then
    raise exception 'must be signed in to create a team'
      using errcode = '42501';
  end if;

  select status into season_status
  from public.seasons
  where id = team_season_id;

  if season_status is null then
    raise exception 'no such season' using errcode = '22023';
  end if;

  if season_status <> 'registration' then
    raise exception 'this season is not open for registration'
      using errcode = '55000';
  end if;

  select max_teams into tier_cap
  from public.season_tiers
  where season_id = team_season_id and tier_id = team_tier_id
  for update;

  if tier_cap is null then
    raise exception 'that tier is not offered this season'
      using errcode = '22023';
  end if;

  select count(*) into teams_in_tier
  from public.teams
  where season_id = team_season_id and tier_id = team_tier_id;

  if teams_in_tier >= tier_cap then
    raise exception 'that tier is full' using errcode = '23514';
  end if;

  insert into public.teams (name, season_id, tier_id, jersey_id)
  values (team_name, team_season_id, team_tier_id, team_jersey_id)
  returning id into new_team_id;

  insert into public.team_users (user_id, team_id, position_id, is_captain)
  values (captain_id, new_team_id, team_position_id, true);

  return new_team_id;
end;
$$;

revoke execute on function
  public.create_team_with_captain(text, integer, integer, integer, integer)
  from public, anon;

grant execute on function
  public.create_team_with_captain(text, integer, integer, integer, integer)
  to authenticated;