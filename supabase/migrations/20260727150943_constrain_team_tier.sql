-- ============================================================
-- teams.tier: require a value, and restrict it to known tiers
--
-- tier was a bare nullable integer, so null, 7, and -3 were all valid as
-- far as the database was concerned — only the create-team form stood
-- between those and a stored row. This moves that guarantee into the
-- schema so any writer gets it, including the service-role client.
--
-- The allowed values mirror TEAM_TIERS in lib/constants.ts; adding or
-- renumbering a tier means updating both. If a lookup table (like
-- public.positions) ever replaces the hardcoded list, this constraint
-- gives way to a foreign key.
-- ============================================================

alter table public.teams
  alter column tier set not null,
  add constraint teams_tier_valid check (tier in (1, 2));