import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

import {
  checkTeamNameAvailability,
  createTeam,
  type CreateTeamState,
} from '../actions'

// Mock the two external dependencies so this stays a unit test: no real
// Supabase call, no real cache revalidation.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockRevalidatePath = jest.mocked(revalidatePath)
const mockCreateClient = jest.mocked(createClient)

type Result = { data?: unknown; error?: unknown }

const SIGNED_IN_USER = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }

// A minimal stand-in for a Supabase query builder. Every chain method
// returns the same object (like the real builder), and the terminal
// call resolves to whatever the test configured for `teams`.
type TableMock = {
  select: (...args: unknown[]) => TableMock
  ilike: (...args: unknown[]) => TableMock
  maybeSingle: () => Promise<Result>
}

function createTableMock(result: Result): TableMock {
  const builder: TableMock = {
    select: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  }

  return builder
}

function mockSupabase(config: {
  teams?: Result
  rpc?: Result
  user?: { id: string } | null
} = {}) {
  const teamsTable = createTableMock(config.teams ?? { data: null, error: null })

  const fromMock = jest.fn((table: string) => {
    if (table === 'teams') return teamsTable
    throw new Error(`Unexpected table: ${table}`)
  })

  const rpcMock = jest.fn(() =>
    Promise.resolve(config.rpc ?? { data: 1, error: null })
  )

  const getUserMock = jest.fn(() =>
    Promise.resolve({
      data: { user: config.user === undefined ? SIGNED_IN_USER : config.user },
      error: null,
    })
  )

  // Only the from/rpc/auth.getUser surfaces are exercised; cast the partial
  // stub to the full client type the action expects.
  mockCreateClient.mockResolvedValue({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: getUserMock },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { fromMock, rpcMock, getUserMock, teamsTable }
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const validFields = {
  name: 'Spikers',
  tier: '1',
  jerseyId: '1',
  positionId: '1',
}

// A no-op previous state; useActionState passes this in production.
const prevState: CreateTeamState = {}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('checkTeamNameAvailability', () => {
  it('returns a length error without querying Supabase', async () => {
    const { fromMock } = mockSupabase()

    const result = await checkTeamNameAvailability('ab')

    expect(result).toEqual({
      error: 'Team name must be at least 3 characters.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('trims the name before checking length and querying', async () => {
    const { teamsTable } = mockSupabase()

    await checkTeamNameAvailability('  Spikers  ')

    expect(teamsTable.ilike).toHaveBeenCalledWith('name', 'Spikers')
  })

  it('reports a name as available when no matching row exists', async () => {
    mockSupabase({ teams: { data: null, error: null } })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({ available: true })
  })

  it('reports a name as taken when a matching row exists', async () => {
    mockSupabase({ teams: { data: { id: 1 }, error: null } })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({ available: false })
  })

  it('checks availability case-insensitively via ilike', async () => {
    const { teamsTable } = mockSupabase()

    await checkTeamNameAvailability('spikers')

    expect(teamsTable.ilike).toHaveBeenCalledWith('name', 'spikers')
    expect(teamsTable.select).toHaveBeenCalledWith('id')
  })

  it('returns an error when the availability query fails', async () => {
    mockSupabase({ teams: { data: null, error: { message: 'boom' } } })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({
      error: 'Could not check availability. Please try again.',
    })
  })
})

describe('createTeam', () => {
  it('does not call Supabase when validation fails', async () => {
    const { rpcMock, getUserMock } = mockSupabase()

    const result = await createTeam(
      prevState,
      buildFormData({ ...validFields, name: 'ab' })
    )

    expect(result).toEqual({
      error: 'Team name must be at least 3 characters.',
    })
    expect(getUserMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('refuses to create a team when there is no session', async () => {
    const { rpcMock } = mockSupabase({ user: null })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'You must be signed in to create a team.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('trims the name before validating and creating', async () => {
    const { rpcMock } = mockSupabase()

    await createTeam(
      prevState,
      buildFormData({ ...validFields, name: '  Spikers  ' })
    )

    expect(rpcMock).toHaveBeenCalledWith('create_team_with_captain', {
      team_name: 'Spikers',
      team_tier: 1,
      team_jersey_id: 1,
      team_position_id: 1,
    })
  })

  it('returns an error when the rpc fails', async () => {
    mockSupabase({ rpc: { data: null, error: { message: 'boom' } } })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'Could not create the team. Please try again.',
    })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('creates the team and its captain in a single call on success', async () => {
    const { rpcMock } = mockSupabase({ rpc: { data: 7, error: null } })

    const result = await createTeam(prevState, buildFormData(validFields))

    // The captain comes from the session inside the function, so the
    // action never sends a user id — there is nothing here to spoof.
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('create_team_with_captain', {
      team_name: 'Spikers',
      team_tier: 1,
      team_jersey_id: 1,
      team_position_id: 1,
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
    expect(result).toEqual({ success: true, teamName: 'Spikers' })
  })

  it('does not re-check uniqueness before creating, so duplicate names both succeed', async () => {
    // Documents a known gap (see the TODO in actions.ts): createTeam never
    // calls checkTeamNameAvailability itself, so nothing stops two calls
    // with the same name from both succeeding.
    const { rpcMock } = mockSupabase()

    const first = await createTeam(prevState, buildFormData(validFields))
    const second = await createTeam(prevState, buildFormData(validFields))

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })
})
