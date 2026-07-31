// Pure, dependency-free validation for the signup form.
//
// This lives outside actions.ts on purpose: a `'use server'` module may only
// export async Server Actions, so a synchronous helper can't live there. Keeping
// it separate also means these rules can be unit-tested without touching Next.js
// or Supabase.

import { getEmailError } from '@/lib/email'

// Fields the signup form collects. First/last name and phone number end up in
// public.users; email and password are owned by Supabase Auth (auth.users).
export type SignupField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'password'

export type SignupInput = Record<SignupField, string>

export type SignupFieldErrors = Partial<Record<SignupField, string>>

// Matches `minimum_password_length` in supabase/config.toml so the client and
// server agree on what counts as valid.
export const minPasswordLength = 6

/**
 * Validates raw signup field values and returns a map of per-field error
 * messages. An empty object means the input is valid.
 *
 * Callers are expected to have trimmed the name/email/phone fields; the password
 * is checked as-is (leading/trailing spaces are legitimate password characters).
 */
export function validateSignupInput(input: SignupInput): SignupFieldErrors {
  const fieldErrors: SignupFieldErrors = {}

  if (!input.firstName) fieldErrors.firstName = 'First name is required.'
  if (!input.lastName) fieldErrors.lastName = 'Last name is required.'

  const emailError = getEmailError(input.email)
  if (emailError) fieldErrors.email = emailError

  if (!input.phoneNumber) fieldErrors.phoneNumber = 'Phone number is required.'

  if (!input.password) {
    fieldErrors.password = 'Password is required.'
  } else if (input.password.length < minPasswordLength) {
    fieldErrors.password = `Password must be at least ${minPasswordLength} characters.`
  }

  return fieldErrors
}
