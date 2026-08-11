// Turns a Supabase auth error into copy we wrote.
//
// Passing `error.message` straight to the UI means anything the transport
// produces lands in front of a user: gateway jargon like "An invalid
// response was received from the upstream server", or — when the failure
// carries no message at all — an empty string that renders as "{}".
//
// So nothing is passed through. A message is shown only if it matches a
// case below; everything else gets the caller's fallback. The raw error
// still goes to the server log, since hiding it from users shouldn't hide
// it from us.

const KNOWN_CAUSES: [RegExp, string][] = [
  // Supabase deliberately collapses "no such user" and "wrong password"
  // into one message; keep them collapsed so this can't be used to probe
  // which emails have accounts.
  [/invalid login credentials/i, "That email or password isn't right."],
  [/email not confirmed/i, "Check your inbox and confirm your email address first."],
  [/already registered/i, "An account with that email already exists."],
  [
    /rate limit|only request this after/i,
    "Too many attempts. Wait a minute and try again.",
  ],
  [
    /weak password|password should be/i,
    "That password is too weak. Try a longer one.",
  ],
];

export function authErrorMessage(
  error: { message?: string } | null | undefined,
  fallback: string
): string {
  const raw = error?.message ?? "";

  const known = KNOWN_CAUSES.find(([pattern]) => pattern.test(raw));
  if (known) {
    return known[1];
  }

  console.error("Unrecognised auth error:", error);
  return fallback;
}
