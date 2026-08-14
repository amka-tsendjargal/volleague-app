'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authErrorMessage } from '@/lib/auth-errors'
import { readString, readTrimmed } from '@/lib/form-data'
import { createClient } from '@/lib/supabase/server'

import {
  validateLoginInput,
  type LoginFieldErrors,
  type LoginInput,
} from './validation'

export type LoginState = {
  // Top-level error, e.g. an auth failure returned by Supabase.
  error?: string
  // Per-field validation messages, keyed by form field name.
  fieldErrors?: LoginFieldErrors
}

/**
 * Signs an existing user in with email + password.
 *
 * On success Supabase writes the session cookies through the cookie handler in
 * lib/supabase/server.ts, so no session state is managed here.
 *
 * Shaped for `useActionState`: takes the previous state, returns the next one.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const input: LoginInput = {
    email: readTrimmed(formData, 'email'),
    // Password is intentionally not trimmed: leading/trailing spaces are valid.
    password: readString(formData, 'password'),
  }

  const fieldErrors = validateLoginInput(input)
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) {
    return {
      error: authErrorMessage(
        error,
        'Could not sign you in right now. Please try again.'
      ),
    }
  }

  // The root layout renders the signed-in name, so the client's cached copy of
  // it is now stale. Revalidate the layout before navigating, otherwise the
  // header would keep rendering the logged-out state until a full reload.
  revalidatePath('/', 'layout')

  redirect('/')
}
