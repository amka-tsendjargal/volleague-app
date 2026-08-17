-- ============================================================
-- A pending row is a request, not a roster spot
--
-- team_users has been world-readable since public_read_access.sql, which
-- was right while every row was a confirmed player. The join-by-code flow
-- (see 20260817120000) added rows that are not: an unapproved row says
-- "this person asked to join", which is the player's own business, the
-- captain's, and nobody else's.
--
-- This has to be a policy rather than a filter in the page, because the
-- roster is read straight from PostgREST — hiding the rows in the page
-- would leave /rest/v1/team_users?is_approved=eq.false listing everyone's
-- requests to anyone who asked for it.
--
-- Referencing is_admin()/is_team_captain() from a select policy on the
-- table is_team_captain itself reads does NOT recurse: both are security
-- definer, so they run as the table owner, and the owner bypasses RLS.
--
-- is_approved is checked first and is true for all but a handful of rows,
-- so the per-row is_team_captain() call is rare in practice. is_admin()
-- takes no arguments and is stable, so it is evaluated once per statement.
-- ============================================================

drop policy "public read" on public.team_users;

create policy "public read" on public.team_users for select to anon, authenticated
  using (
    is_approved
    or user_id = auth.uid()
    or public.is_admin()
    or public.is_team_captain(team_id)
  );
