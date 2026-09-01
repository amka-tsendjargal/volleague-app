-- ============================================================
-- 'closed': registration is over, the schedule is being drafted
--
-- The lifecycle was draft → registration → scheduled, which left nowhere to
-- stand between "captains are still entering teams" and "the schedule is
-- public". Generation had to happen in one of those two states: during
-- registration, where the next team to sign up silently invalidates the
-- fixtures that were just generated, or at 'scheduled', which is already
-- published. 'closed' is that missing step — create_team_with_captain
-- accepts only 'registration', so moving a season here is what stops new
-- teams arriving under a schedule being drafted.
--
-- The read policy on schedules (hide_draft_schedules.sql) is deliberately
-- untouched: it serves fixtures for 'scheduled' and 'complete', and 'closed'
-- is not in that list, so a schedule generated here stays admin-only until
-- someone publishes it. That is the whole draft state — no new column, since
-- "fixtures exist while the season is closed" already says it.
--
-- The public surfaces (app/page.tsx, app/teams/new) filter on
-- status = 'registration', so a closed season drops off them for free.
-- ============================================================

alter table public.seasons drop constraint seasons_status_valid;

alter table public.seasons add constraint seasons_status_valid
  check (status in ('draft', 'registration', 'closed', 'scheduled', 'complete'));
