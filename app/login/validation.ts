// Pure, dependency-free validation for the login form.
//
// Lives outside actions.ts for the same reason as the signup rules: a
// `'use server'` module may only export async Server Actions, so a synchronous
// helper can't live there. Keeping it separate also means these rules can be
// unit-tested without touching Next.js or Supabase.

import { getEmailError } from '@/lib/email'

// Login only needs the credentials themselves — everything else about the
// account already exists by the time someone signs in.
export type LoginField = 'email' | 'password'

export type LoginInput = Record<LoginField, string>

export type LoginFieldErrors = Partial<Record<LoginField, string>>

/**
 * Validates raw login field values and returns a map of per-field error
 * messages. An empty object means the input is worth sending to Supabase.
 *
 * Unlike signup, the password is only checked for presence — never for length.
 * Accounts created under an older policy must still be able to sign in, and
 * rejecting a short password here would be a hint about what the stored one
 * isn't. Whether the credentials are actually correct is Supabase's call.
 */
export function validateLoginInput(input: LoginInput): LoginFieldErrors {
  const fieldErrors: LoginFieldErrors = {}

  const emailError = getEmailError(input.email)
  if (emailError) fieldErrors.email = emailError

  if (!input.password) fieldErrors.password = 'Password is required.'

  return fieldErrors
}
