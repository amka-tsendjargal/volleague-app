'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Signs the current user out and sends them back to the landing page.
 *
 * `signOut` revokes the session with Supabase and clears the auth cookies
 * through the cookie handler in lib/supabase/server.ts.
 *
 * Takes no arguments and returns nothing: it's wired straight to a
 * `<form action={logout}>`, so it works without JavaScript and has no error
 * state to render. If revoking the session server-side fails we still fall
 * through to the redirect — the local cookies are the thing standing between
 * this browser and the account, and a stale refresh token expires on its own.
 */
export async function logout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  // The root layout renders the signed-in name, so the client's cached copy of
  // it is now stale. Revalidate the layout before navigating, otherwise the
  // header would keep rendering the signed-in state until a full reload.
  revalidatePath('/', 'layout')

  redirect('/')
}
