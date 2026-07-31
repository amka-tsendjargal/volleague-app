import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { login, type LoginState } from '../actions'

// Mock the external dependencies so this stays a unit test: no real Supabase
// call, no real navigation, no real cache invalidation (which would need a
// request scope).
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockRevalidatePath = jest.mocked(revalidatePath)
const mockRedirect = jest.mocked(redirect)
const mockCreateClient = jest.mocked(createClient)

// The real redirect() throws to halt execution; mirror that so we can assert the
// success path stops after redirecting (and never falls through to a return).
const REDIRECT_SIGNAL = 'NEXT_REDIRECT'

const signInWithPasswordMock = jest.fn()

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const validFields = {
  email: 'bing@example.com',
  password: 'supersecret',
}

// A no-op previous state; useActionState passes this in production.
const prevState: LoginState = {}

beforeEach(() => {
  jest.clearAllMocks()
  signInWithPasswordMock.mockResolvedValue({ data: {}, error: null })
  // Only the auth.signInWithPassword surface is exercised; cast the partial
  // stub to the full client type the action expects.
  mockCreateClient.mockResolvedValue({
    auth: { signInWithPassword: signInWithPasswordMock },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  mockRedirect.mockImplementation(() => {
    throw new Error(REDIRECT_SIGNAL)
  })
})

describe('login action', () => {
  it('does not call Supabase when validation fails', async () => {
    const result = await login(
      prevState,
      buildFormData({ ...validFields, email: 'bad' })
    )

    expect(result.fieldErrors?.email).toBe('Enter a valid email address.')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('passes email and password to Supabase', async () => {
    // Success path redirects, which throws our REDIRECT_SIGNAL.
    await expect(login(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )

    expect(signInWithPasswordMock).toHaveBeenCalledTimes(1)
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'bing@example.com',
      password: 'supersecret',
    })
  })

  it('trims the email but preserves the password verbatim', async () => {
    await expect(
      login(
        prevState,
        buildFormData({
          email: '  bing@example.com  ',
          password: '  spaced pw  ',
        })
      )
    ).rejects.toThrow(REDIRECT_SIGNAL)

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'bing@example.com',
      password: '  spaced pw  ',
    })
  })

  // Signup rejects these before the round-trip; login must let Supabase decide,
  // so a pre-existing short password can still sign in.
  it('sends a password shorter than the signup minimum to Supabase', async () => {
    await expect(
      login(prevState, buildFormData({ ...validFields, password: 'a' }))
    ).rejects.toThrow(REDIRECT_SIGNAL)

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'bing@example.com',
      password: 'a',
    })
  })

  it('redirects to "/" on success', async () => {
    await expect(login(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // The root layout renders the signed-in name, so a stale cached layout would
  // show the logged-out header on the page we redirect to.
  it('revalidates the root layout before redirecting on success', async () => {
    await expect(login(prevState, buildFormData(validFields))).rejects.toThrow(
      REDIRECT_SIGNAL
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does not revalidate when login fails', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })

    await login(prevState, buildFormData(validFields))

    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns the Supabase error message and does not redirect', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })

    const result = await login(prevState, buildFormData(validFields))

    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
