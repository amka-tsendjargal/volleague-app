/**
 * First character of a name, uppercased, or "" if there isn't one.
 *
 * Array.from splits by code point rather than UTF-16 unit, so a name starting
 * with an emoji or an astral character yields that whole character instead of
 * half a surrogate pair — which charAt(0) would render as a replacement box.
 */
function firstCharacter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return (Array.from(trimmed)[0] ?? "").toUpperCase();
}

/**
 * Initials for the avatar placeholder shown when someone hasn't uploaded a
 * picture.
 *
 * Degrades a step at a time rather than all-or-nothing: both names give two
 * letters, one name gives one, and `fallback` (the email) covers a profile row
 * that's missing or unreadable — the same fallback the displayed name uses.
 * Returns "?" only when there is genuinely nothing to work with, so the bubble
 * is never blank.
 */
export function getInitials(
  firstName: string,
  lastName: string,
  fallback = ""
): string {
  const initials = firstCharacter(firstName) + firstCharacter(lastName);
  return initials || firstCharacter(fallback) || "?";
}
