-- ============================================================
-- A generated schedule is a draft until the season is published
--
-- schedules has been world-readable since public_read_access.sql, which
-- was right while a fixture could only appear once someone published it.
-- Generation changed that: the admin now writes fixtures to look over
-- first, and generate_schedule deliberately leaves seasons.status alone
-- so they can be reviewed and regenerated freely.
--
-- Without this, "draft" is only a word in the UI — the rows are already
-- served to anyone hitting /rest/v1/schedules, so a captain could read
-- next season's matchups before the admin had decided they were right.
-- Same reasoning as hide_pending_players.sql: it has to be a policy,
-- because filtering in the page leaves the REST endpoint wide open.
--
-- 'complete' is included alongside 'scheduled' so a finished season's
-- schedule stays readable as a record of what was played.
--
-- is_admin() is checked first and is stable, so it is evaluated once per
-- statement rather than per row; the exists() only runs for everyone
-- else, and schedules_season_week_id_idx covers the lookup.
-- ============================================================

drop policy "public read" on public.schedules;

create policy "public read" on public.schedules for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.season_weeks
      join public.seasons on seasons.id = season_weeks.season_id
      where season_weeks.id = schedules.season_week_id
        and seasons.status in ('scheduled', 'complete')
    )
  );