-- Extension used to auto-maintain updated_at columns.
create extension if not exists moddatetime schema extensions;

-- ============================================================
-- Lookup tables
-- ============================================================

create table public.roles (
  id         integer generated always as identity primary key,
  role       varchar(50) unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.positions (
  id         integer generated always as identity primary key,
  name       varchar(50) unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (role) values ('admin'), ('league_admin');

insert into public.positions (name) values
  ('Setter'), ('Outside Hitter'), ('Middle Blocker'),
  ('Opposite'), ('Libero'), ('Defensive Specialist');

-- ============================================================
-- Users
-- id mirrors auth.users.id so RLS policies can key off auth.uid()
-- directly. Populated by the trigger at the bottom of this file
-- whenever a new Supabase Auth user signs up.
-- ============================================================

create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id         integer generated always as identity primary key,
  user_id    uuid references public.users(id) on delete cascade,
  role_id    integer references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id)
);

-- ============================================================
-- Jerseys / teams
-- ============================================================

create table public.jerseys (
  id         integer generated always as identity primary key,
  kit_name   varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id         integer generated always as identity primary key,
  name       varchar(255) not null,
  tier       integer,
  -- currently-assigned kit; ranked preferences live in jersey_preferences
  jersey_id  integer references public.jerseys(id) on delete set null,
  created_at timestamptz not null default now(),
  end_date   timestamptz,
  updated_at timestamptz not null default now()
);

-- is_captain scopes captain permissions to a single team, so the same
-- user can be captain of one team and a regular player on another.
create table public.team_users (
  id          integer generated always as identity primary key,
  user_id     uuid references public.users(id) on delete cascade,
  team_id     integer references public.teams(id) on delete cascade,
  position_id integer references public.positions(id),
  is_captain  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

-- at most one captain per team
create unique index team_users_one_captain_per_team
  on public.team_users (team_id) where is_captain = true;

-- ============================================================
-- Schedule / match results
-- ============================================================

create table public.schedules (
  id           integer generated always as identity primary key,
  match_time   timestamptz,
  court_number integer,
  -- RESTRICT: deleting a team with match history should be a deliberate,
  -- explicit action (delete its schedules first), not an accidental cascade.
  team_a_id    integer references public.teams(id) on delete restrict,
  team_b_id    integer references public.teams(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);

create table public.sets (
  id           integer generated always as identity primary key,
  schedule_id  integer references public.schedules(id) on delete cascade,
  set_number   integer not null,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (schedule_id, set_number)
);

create table public.set_stats (
  id            integer generated always as identity primary key,
  set_id        integer references public.sets(id) on delete cascade,
  -- SET NULL: a stat line is a historical record of what happened in a
  -- match; it should survive even if the player's account is later deleted.
  user_id       uuid references public.users(id) on delete set null,
  points        integer not null default 0,
  total_attacks integer not null default 0,
  blocks        integer not null default 0,
  kills         integer not null default 0,
  digs          integer not null default 0,
  passing       integer not null default 0,
  aces          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (set_id, user_id)
);

-- Season/career totals are derived from set_stats, grouped per team so
-- stats don't blend together if a player plays for multiple teams.
-- Recompute-on-read avoids the aggregate ever drifting out of sync.
create view public.player_stats as
select
  tu.user_id,
  tu.team_id,
  sum(ss.points)        as season_points,
  sum(ss.blocks)        as blocks,
  sum(ss.kills)         as kills,
  sum(ss.digs)          as digs,
  sum(ss.passing)       as passing,
  sum(ss.aces)          as aces,
  round(sum(ss.points)::numeric / nullif(count(distinct ss.set_id), 0), 2) as points_per_set
from public.set_stats ss
join public.team_users tu on tu.user_id = ss.user_id
group by tu.user_id, tu.team_id;

-- ============================================================
-- Jerseys: ranked preferences and per-player assignments
-- ============================================================

create table public.jersey_preferences (
  id         integer generated always as identity primary key,
  team_id    integer references public.teams(id) on delete cascade,
  jersey_id  integer references public.jerseys(id) on delete cascade,
  rank       integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, jersey_id),
  unique (team_id, rank)
);

create table public.player_jerseys (
  id         integer generated always as identity primary key,
  user_id    uuid references public.users(id) on delete cascade,
  jersey_id  integer references public.jerseys(id) on delete cascade,
  size       varchar(20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jersey_id)
);

-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger set_updated_at before update on public.roles for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.positions for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.users for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.user_roles for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.jerseys for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.teams for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.team_users for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.schedules for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.sets for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.set_stats for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.jersey_preferences for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.player_jerseys for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================
-- New auth user -> public.users row
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RLS helper functions
-- ============================================================

create function public.has_role(role_name text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.role = role_name
  );
$$;

create function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.has_role('admin');
$$;

create function public.is_team_captain(target_team_id integer)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.team_users
    where user_id = auth.uid() and team_id = target_team_id and is_captain = true
  );
$$;

-- ============================================================
-- Row Level Security
-- Baseline: any signed-in user can read everything (league data is
-- shared/public within the app). Writes are gated by role.
-- This is a first pass meant to be reviewed/tightened, not a final
-- security audit.
-- ============================================================

alter table public.roles enable row level security;
alter table public.positions enable row level security;
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.jerseys enable row level security;
alter table public.teams enable row level security;
alter table public.team_users enable row level security;
alter table public.schedules enable row level security;
alter table public.sets enable row level security;
alter table public.set_stats enable row level security;
alter table public.jersey_preferences enable row level security;
alter table public.player_jerseys enable row level security;

-- Read access: any authenticated user, on every table.
create policy "authenticated read" on public.roles for select to authenticated using (true);
create policy "authenticated read" on public.positions for select to authenticated using (true);
create policy "authenticated read" on public.users for select to authenticated using (true);
create policy "authenticated read" on public.user_roles for select to authenticated using (true);
create policy "authenticated read" on public.jerseys for select to authenticated using (true);
create policy "authenticated read" on public.teams for select to authenticated using (true);
create policy "authenticated read" on public.team_users for select to authenticated using (true);
create policy "authenticated read" on public.schedules for select to authenticated using (true);
create policy "authenticated read" on public.sets for select to authenticated using (true);
create policy "authenticated read" on public.set_stats for select to authenticated using (true);
create policy "authenticated read" on public.jersey_preferences for select to authenticated using (true);
create policy "authenticated read" on public.player_jerseys for select to authenticated using (true);

-- Admin: full write access everywhere.
create policy "admin write" on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.positions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.jerseys for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.jersey_preferences for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Users: admin manages any row, a user can update their own profile.
create policy "admin manage users" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "self update" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- team_users: admin or the team's own captain can add/remove players.
-- Editing existing rows (including is_captain) is admin-only — captains
-- don't get to promote/demote, since captaincy is a fixed, single-holder
-- assignment (see the one-captain-per-team index above).
create policy "admin or captain add players" on public.team_users for insert to authenticated
  with check (public.is_admin() or public.is_team_captain(team_id));
create policy "admin or captain remove players" on public.team_users for delete to authenticated
  using (public.is_admin() or public.is_team_captain(team_id));
create policy "admin update roster" on public.team_users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Scores/stats: admin today; has_role('league_admin') is already wired up
-- for when that role gets assigned to anyone.
create policy "admin or league_admin manage sets" on public.sets for all to authenticated
  using (public.is_admin() or public.has_role('league_admin'))
  with check (public.is_admin() or public.has_role('league_admin'));

create policy "admin or league_admin manage set_stats" on public.set_stats for all to authenticated
  using (public.is_admin() or public.has_role('league_admin'))
  with check (public.is_admin() or public.has_role('league_admin'));

-- player_jerseys: admin manages any row, a player manages their own size/kit record.
create policy "admin manage player_jerseys" on public.player_jerseys for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "self manage player_jerseys" on public.player_jerseys for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());