-- ============================================================
-- seasons.court_numbers
--
-- Which courts a season has to play on. Arbitrary numbers rather than a
-- count: a venue may run courts 3, 4 and 7 while the rest of the facility
-- is booked by someone else, so the list is stored as given and used
-- verbatim on the schedule.
--
-- Ordered, so an array rather than a `season_courts` table: no second set
-- of RLS policies, no updated_at trigger, and no third insert (with its
-- own compensating rollback) in the create-season action. The tradeoff is
-- that a CHECK constraint may not contain a subquery, so "no duplicates"
-- cannot be expressed here and lives in validateSeasonInput instead. If a
-- court ever grows attributes of its own — a name, a surface, an
-- availability window — this becomes a table.
--
-- Defaults to empty so existing seasons stay valid. Schedule generation
-- refuses on an empty list rather than guessing at court numbers, and
-- there is no edit-season UI yet, so a season created before this
-- migration needs its courts set in SQL.
-- ============================================================

alter table public.seasons
  add column court_numbers integer[] not null default '{}';
