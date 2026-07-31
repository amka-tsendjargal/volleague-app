import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { signup, type SignupState } from '../actions'

// Mock the external dependencies so this stays a unit test: no real Supabase
// call, no real navigation, no real cache invalidation (which would need a
// request scope). The DB trigger / RLS behavior is covered separately by an
// integration test against local Supabase, not here.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockRevalidatePath = jest.mocked(revalidatePath)
const mockRedirect = jest.mocked(redirect)
const mockCreateClient = jest.mocked(createClient)

// The real redirect() throws to halt execution; mirror that so we can assert the
// success path stops after redirecting (and never falls through to a return).
const REDIRECT_SIGNAL = 'NEXT_REDIRECT'

const signUpMock = jest.fn()

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const validFields = {
  firstName: 'Bing',
  lastName: 'Chilling',
  email: 'bing@example.com',
  phoneNumber: '+1-587-111-0100',
  password: 'supersecret',
}

// A no-op previous state; useActionState passes this in production.
const prevState: SignupState = {}

beforeEach(() => {
  jest.clearAllMocks()
  signUpMock.mockResolvedValue({ data: {}, error: null })
  // Only the auth.signUp surface is exercised; cast the partial stub to the
  // full client type the action expects.
  mockCreateClient.mockResolvedValue({
    auth: { signUp: signUpMock },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  mockRedirect.mockImplementation(() => {
    throw new Error(REDIRECT_SIGNAL)
  })
})

describe('signup action', () => {
  it('does not call Supabase when validation fails', async () => {
    const result = await signup(prevState, buildFormData({ ...validFields, email: 'bad' }))

    expect(result.fieldErrors?.email).toBe('Enter a valid email address.')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(signUpMock).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('passes email/password and snake_case metadata to Supabase', async () => {
    // Success path redirects, which throws our REDIRECT_SIGNAL.
    await expect(signup(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )

    expect(signUpMock).toHaveBeenCalledTimes(1)
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'bing@example.com',
      password: 'supersecret',
      options: {
        data: {
          first_name: 'Bing',
          last_name: 'Chilling',
          phone_number: '+1-587-111-0100',
        },
      },
    })
  })

  it('trims names/email/phone but preserves the password verbatim', async () => {
    await expect(
      signup(
        prevState,
        buildFormData({
          firstName: '  Bing  ',
          lastName: '  Chilling  ',
          email: '  bing@example.com  ',
          phoneNumber: '  +1-587-111-0100  ',
          password: '  spaced pw  ',
        })
      )
    ).rejects.toThrow(REDIRECT_SIGNAL)

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'bing@example.com',
      password: '  spaced pw  ',
      options: {
        data: {
          first_name: 'Bing',
          last_name: 'Chilling',
          phone_number: '+1-587-111-0100',
        },
      },
    })
  })

  it('redirects to "/" on success', async () => {
    await expect(signup(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // The root layout renders the signed-in name, so a stale cached layout would
  // show the logged-out header on the page we redirect to.
  it('revalidates the root layout before redirecting on success', async () => {
    await expect(signup(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does not revalidate when signup fails', async () => {
    signUpMock.mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    })

    await signup(prevState, buildFormData(validFields))

    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns the Supabase error message and does not redirect', async () => {
    signUpMock.mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    })

    const result = await signup(prevState, buildFormData(validFields))

    expect(result).toEqual({ error: 'User already registered' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
