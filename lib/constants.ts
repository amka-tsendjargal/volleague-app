// Shared between the client's debounced availability check and the
// server's validation so they agree on when a name is worth checking.
export const MIN_TEAM_NAME_LENGTH = 3;

// Letters, numbers, and spaces only — keeps team names simple and sidesteps
// ILIKE wildcard characters (%, _) entirely rather than escaping them.
export const TEAM_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;

// Storage bucket holding profile pictures (see supabase/migrations). It's
// public, so reads are a plain getPublicUrl() with no signing round trip.
export const AVATAR_BUCKET = "avatars";

// Avatars are downscaled in the browser before upload (see
// app/profile/resize.ts), so these limits describe the *result* of that
// resize, not what a user is allowed to pick. They mirror the constraints on
// the `avatars` bucket (see supabase/migrations) — Storage rejects anything
// outside them no matter what calls the API, and these copies exist so the
// form can say why before spending an upload, and so the file picker filters.
//
// SVG is intentionally absent: it can carry scripts, and avatars are served
// from a public URL on our own origin.
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Longest edge of the stored image. The avatar renders at 80 CSS pixels, so
// this still has room to spare on a 3x display; the aspect ratio is preserved
// and the circle is cropped by object-cover at render time.
export const AVATAR_MAX_EDGE = 512;

// WebP for the resize output: it keeps PNG's alpha channel (so a picture with
// transparency doesn't gain a black background the way JPEG would) at roughly
// JPEG's size.
export const AVATAR_OUTPUT_TYPE = "image/webp";

// Ceiling on the resized result. A 512px WebP avatar lands well under this, so
// hitting it means something abnormal happened rather than a user picking a
// large photo — which the resize is there to absorb.
export const AVATAR_MAX_BYTES = 512 * 1024;

// Ceiling on what the browser will even attempt to decode. This is the limit a
// user can actually run into, and it's set high enough that no ordinary camera
// photo reaches it — it exists to avoid trying to decode something absurd.
export const AVATAR_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// Extension per MIME type, used to name the uploaded object. Derived from the
// type rather than the original filename, which is attacker-controlled.
export const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Six on the court, so a team below this can't field a lineup. A team is
// "confirmed" — and therefore schedulable — once it reaches this many
// players; schedule generation ignores the rest.
export const MIN_PLAYERS_PER_TEAM = 6;

// A tier needs two teams to have a match at all. Mirrors
// season_tiers_max_teams_valid.
export const MIN_TEAMS_PER_TIER = 2;
