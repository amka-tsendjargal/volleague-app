'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import {
  validateSignupInput,
  type SignupFieldErrors,
  type SignupInput,
} from './validation'

export type SignupState = {
  // Top-level error, e.g. an auth failure returned by Supabase.
  error?: string
  // Per-field validation messages, keyed by form field name.
  fieldErrors?: SignupFieldErrors
}

// FormData.get returns `FormDataEntryValue | null` (a string or an uploaded
// File). Reading into a local lets `typeof` narrow it to string with no cast;
// non-string entries (a File, or a missing field) collapse to an empty string.
function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function readTrimmed(formData: FormData, key: string): string {
  return readString(formData, key).trim()
}

/**
 * Creates a new account.
 *
 * Email + password are handed to Supabase Auth. First name, last name, and
 * phone number are passed as user metadata; the `handle_new_user` trigger
 * (see supabase/migrations) copies that metadata into public.users on insert,
 * so we never write to public.users directly from here.
 *
 * Shaped for `useActionState`: takes the previous state, returns the next one.
 */
export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const input: SignupInput = {
    firstName: readTrimmed(formData, 'firstName'),
    lastName: readTrimmed(formData, 'lastName'),
    email: readTrimmed(formData, 'email'),
    phoneNumber: readTrimmed(formData, 'phoneNumber'),
    // Password is intentionally not trimmed: leading/trailing spaces are valid.
    password: readString(formData, 'password'),
  }

  const fieldErrors = validateSignupInput(input)
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Metadata keys are snake_case to match the columns the
      // handle_new_user trigger reads from raw_user_meta_data.
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone_number: input.phoneNumber,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Email confirmations are disabled (supabase/config.toml), so signUp returns
  // an active session and the user is signed in. Send them into the app.
  redirect('/')
}
