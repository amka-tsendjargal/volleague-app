// `?next=` arrives from the URL, so anyone can set it. Redirecting to it
// unchecked is an open redirect: `?next=https://evil.com` walks a user off
// site through our own login flow, from a link that looked like ours.
//
// Only a path on this site is allowed. The `//` case is the subtle one —
// `//evil.com` is a protocol-relative URL, so browsers treat it as absolute
// even though it reads like a path.

const FALLBACK = '/'

export function safeRedirectPath(next: string): string {
  if (!next.startsWith('/')) return FALLBACK
  if (next.startsWith('//')) return FALLBACK
  // A backslash is normalised to `/` by some browsers, so `/\evil.com` can
  // escape the same way `//evil.com` does.
  if (next.startsWith('/\\')) return FALLBACK
  return next
}
