-- ============================================================
-- Profile pictures
--
-- Avatars live in a public storage bucket rather than in the
-- database: the league's rosters and player names are already open
-- to anonymous visitors (see public_read_access.sql), so the
-- pictures that sit next to those names are public information too.
-- A public bucket means reads are a plain CDN-cacheable URL with no
-- signing round trip per image.
--
-- Consequence worth naming: an uploaded avatar's URL is permanent
-- and unauthenticated. Replacing a picture writes a NEW object and
-- deletes the old one (see app/profile/actions.ts), so the old URL
-- stops resolving — but anyone who already fetched the bytes keeps
-- them. That is the same bargain as any public avatar on the web.
-- ============================================================

-- ------------------------------------------------------------
-- users.avatar_path
--
-- Stores the object's path within the bucket (e.g.
-- "<user-id>/1755183000000.png"), not a full URL. The URL is
-- derived at render time via getPublicUrl(), so the project's
-- storage hostname is never baked into rows and moving projects
-- doesn't require a data migration.
--
-- Nullable: a user has no picture until they upload one.
-- ------------------------------------------------------------

alter table public.users add column avatar_path text;

-- `anon` gave up table-wide SELECT on users in public_read_access.sql
-- and holds column-level grants instead, so a new column is invisible
-- to logged-out visitors until it is added to that grant explicitly.
-- Avatars are public by the same reasoning as first_name/last_name.
grant select (avatar_path) on public.users to anon;

-- ------------------------------------------------------------
-- The bucket
--
-- Limits are enforced by Storage itself, so they hold no matter what
-- calls the API — the checks in the server action are there to give a
-- friendly message, not as the security boundary.
--
--   512 KiB        the browser downscales to 512px WebP before
--                  uploading (app/profile/resize.ts), which lands far
--                  below this. The limit is deliberately snug so an
--                  upload that skipped the resize fails loudly rather
--                  than quietly costing storage — it is NOT the cap on
--                  what a user may pick, which is why a multi-megabyte
--                  camera photo is still a perfectly fine choice.
--   jpeg/png/webp  raster formats only. SVG is deliberately excluded:
--                  it can carry scripts, and it would be served from
--                  our own origin on a public URL. The resize emits
--                  WebP; the other two stay allowed so a non-browser
--                  client isn't locked out.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  524288,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Storage policies
--
-- Objects are keyed "<user-id>/<filename>", so the first path
-- segment identifies the owner. Every write policy compares that
-- segment to auth.uid(), which is what stops one signed-in user from
-- writing into another's folder.
-- ------------------------------------------------------------

create policy "public read avatars" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "insert own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Both USING and WITH CHECK: USING decides which existing objects may
-- be updated, WITH CHECK decides what they may be updated to. Without
-- the latter, an update could move an object into someone else's folder.
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Needed for replacement, not just for a user clearing their picture:
-- uploading a new avatar deletes the object it superseded.
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
