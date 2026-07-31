import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { logout } from '../actions'

// Mock the external dependencies so this stays a unit test: no real Supabase
// call, no real navigation, no real cache invalidation (which would need a
// request scope).
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockRevalidatePath = jest.mocked(revalidatePath)
const mockRedirect = jest.mocked(redirect)
const mockCreateClient = jest.mocked(createClient)

// The real redirect() throws to halt execution; mirror that so we can assert
// logout always ends by navigating away.
const REDIRECT_SIGNAL = 'NEXT_REDIRECT'

const signOutMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  signOutMock.mockResolvedValue({ error: null })
  // Only the auth.signOut surface is exercised; cast the partial stub to the
  // full client type the action expects.
  mockCreateClient.mockResolvedValue({
    auth: { signOut: signOutMock },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  mockRedirect.mockImplementation(() => {
    throw new Error(REDIRECT_SIGNAL)
  })
})

describe('logout action', () => {
  it('signs out through Supabase', async () => {
    await expect(logout()).rejects.toThrow(REDIRECT_SIGNAL)

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('redirects to "/" after signing out', async () => {
    await expect(logout()).rejects.toThrow(REDIRECT_SIGNAL)

    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // The root layout renders the signed-in name, so a stale cached layout would
  // keep showing the signed-in header on the page we redirect to.
  it('revalidates the root layout before redirecting', async () => {
    await expect(logout()).rejects.toThrow(REDIRECT_SIGNAL)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  // The auth cookies are what actually keep this browser signed in, and they're
  // cleared locally regardless. Stranding the user on a page that still claims
  // they're signed in would be worse than a best-effort revoke.
  it('still revalidates and redirects when Supabase reports an error', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'network error' } })

    await expect(logout()).rejects.toThrow(REDIRECT_SIGNAL)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
