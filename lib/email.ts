// Email rules shared by every form that collects an address (signup, login)
// and by the Server Actions behind them, so the inline feedback shown while
// someone types and the answer they get back from the server can't disagree.

// Basic shape check. Supabase validates too, and only actually sending mail
// proves an address exists; this is for fast, friendly feedback before the
// network round-trip. Deliberately stricter than the browser's `type="email"`,
// which accepts dotless hosts like `a@b`.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns an error message for an email address, or undefined if it looks fine.
 *
 * Expects an already-trimmed value: surrounding whitespace is a typo, not part
 * of the address, and callers strip it before it ever reaches Supabase.
 */
export function getEmailError(email: string): string | undefined {
  if (!email) return 'Email is required.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.'
  return undefined
}
