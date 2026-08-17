// Pure, dependency-free validation for the avatar upload.
//
// This lives outside actions.ts on purpose: a `'use server'` module may only
// export async Server Actions, so a synchronous helper can't live there. Keeping
// it separate also means these rules can be unit-tested without touching
// Next.js or Supabase.
//
// There are two checks because there are two files: the one the user picked,
// and the downscaled WebP that resize.ts produces from it. Only the second is
// ever uploaded, so only the second is bound by the bucket's limits.

import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_SOURCE_BYTES,
} from "@/lib/constants";

const allowedTypes = new Set<string>(AVATAR_ALLOWED_TYPES);

function formatSize(bytes: number): string {
  const kilobytes = bytes / 1024;
  return kilobytes < 1024 ? `${kilobytes}KB` : `${kilobytes / 1024}MB`;
}

/**
 * Validates the file the user picked, before spending time decoding it.
 *
 * Deliberately permissive about size: the whole point of the resize is that a
 * multi-megabyte camera photo is a perfectly normal thing to choose, so this
 * only rejects something too large to be worth handing to the decoder.
 */
export function validateSourceImage(
  size: number,
  type: string
): string | null {
  if (size === 0) {
    return "Choose an image to upload.";
  }
  if (!allowedTypes.has(type)) {
    return "Profile picture must be a JPG, PNG, or WebP image.";
  }
  if (size > AVATAR_MAX_SOURCE_BYTES) {
    return `That image is too large to process. Choose one under ${formatSize(
      AVATAR_MAX_SOURCE_BYTES
    )}.`;
  }
  return null;
}

/**
 * Validates what is actually about to be uploaded, and returns the first error
 * found or null. Fail-fast rather than a per-field map, since the form only
 * ever surfaces one error message at a time.
 *
 * Runs on the server too, against whatever arrived — a client that skipped the
 * resize doesn't get to skip this. Note that `type` is still client-supplied
 * and can be spoofed; the bucket's own allowed_mime_types is the real
 * boundary, and this check exists to fail with a readable message.
 */
export function validateAvatar(size: number, type: string): string | null {
  if (size === 0) {
    return "Choose an image to upload.";
  }
  if (!allowedTypes.has(type)) {
    return "Profile picture must be a JPG, PNG, or WebP image.";
  }
  if (size > AVATAR_MAX_BYTES) {
    return `Profile picture must be ${formatSize(AVATAR_MAX_BYTES)} or smaller.`;
  }
  return null;
}
