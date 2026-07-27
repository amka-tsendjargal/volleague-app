import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { SEED_CAPTAIN_ID } from '@/lib/constants'

import {
  checkTeamNameAvailability,
  createTeam,
  type CreateTeamState,
} from '../actions'

// Mock the two external dependencies so this stays a unit test: no real
// Supabase call, no real cache revalidation.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

const mockRevalidatePath = jest.mocked(revalidatePath)
const mockCreateAdminClient = jest.mocked(createAdminClient)

type Result = { data?: unknown; error?: unknown }

// A minimal stand-in for a Supabase query builder. Every chain method
// returns the same object (like the real builder), and the object is
// itself thenable so `await builder` resolves without a terminal call —
// this mirrors how `.delete().eq(...)` is awaited directly in actions.ts.
// Which "result" it resolves to depends on whether insert/delete/select
// was the most recent operation invoked on the chain.
type TableMock = {
  select: (...args: unknown[]) => TableMock
  insert: (...args: unknown[]) => TableMock
  delete: (...args: unknown[]) => TableMock
  ilike: (...args: unknown[]) => TableMock
  eq: (...args: unknown[]) => TableMock
  maybeSingle: () => Promise<Result>
  single: () => Promise<Result>
  then: Promise<Result>['then']
}

function createTableMock(results: {
  insert?: Result
  select?: Result
  delete?: Result
}): TableMock {
  let op: 'insert' | 'select' | 'delete' = 'select'

  const resultFor = () =>
    Promise.resolve(results[op] ?? { data: null, error: null })

  const builder: TableMock = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => {
      op = 'insert'
      return builder
    }),
    delete: jest.fn(() => {
      op = 'delete'
      return builder
    }),
    ilike: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn(() => resultFor()),
    single: jest.fn(() => resultFor()),
    then: (resolve, reject) => resultFor().then(resolve, reject),
  }

  return builder
}

function mockSupabase(config: {
  teams?: { insert?: Result; select?: Result; delete?: Result }
  teamUsers?: { insert?: Result }
}) {
  const teamsTable = createTableMock(config.teams ?? {})
  const teamUsersTable = createTableMock(config.teamUsers ?? {})

  const fromMock = jest.fn((table: string) => {
    if (table === 'teams') return teamsTable
    if (table === 'team_users') return teamUsersTable
    throw new Error(`Unexpected table: ${table}`)
  })

  mockCreateAdminClient.mockReturnValue({
    from: fromMock,
  } as unknown as ReturnType<typeof createAdminClient>)

  return { fromMock, teamsTable, teamUsersTable }
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
    const { fromMock } = mockSupabase({})

    const result = await checkTeamNameAvailability('ab')

    expect(result).toEqual({
      error: 'Team name must be at least 3 characters.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('trims the name before checking length and querying', async () => {
    const { teamsTable } = mockSupabase({
      teams: { select: { data: null, error: null } },
    })

    await checkTeamNameAvailability('  Spikers  ')

    expect(teamsTable.ilike).toHaveBeenCalledWith('name', 'Spikers')
  })

  it('reports a name as available when no matching row exists', async () => {
    mockSupabase({ teams: { select: { data: null, error: null } } })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({ available: true })
  })

  it('reports a name as taken when a matching row exists', async () => {
    mockSupabase({
      teams: { select: { data: { id: 1 }, error: null } },
    })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({ available: false })
  })

  it('checks availability case-insensitively via ilike', async () => {
    const { teamsTable } = mockSupabase({
      teams: { select: { data: null, error: null } },
    })

    await checkTeamNameAvailability('spikers')

    expect(teamsTable.ilike).toHaveBeenCalledWith('name', 'spikers')
    expect(teamsTable.select).toHaveBeenCalledWith('id')
  })

  it('returns an error when the availability query fails', async () => {
    mockSupabase({
      teams: { select: { data: null, error: { message: 'boom' } } },
    })

    const result = await checkTeamNameAvailability('Spikers')

    expect(result).toEqual({
      error: 'Could not check availability. Please try again.',
    })
  })
})

describe('createTeam', () => {
  it('does not call Supabase when validation fails', async () => {
    const { fromMock } = mockSupabase({})

    const result = await createTeam(
      prevState,
      buildFormData({ ...validFields, name: 'ab' })
    )

    expect(result).toEqual({
      error: 'Team name must be at least 3 characters.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('trims the name before validating and inserting', async () => {
    const { teamsTable } = mockSupabase({
      teams: { insert: { data: { id: 1 }, error: null } },
      teamUsers: { insert: { data: {}, error: null } },
    })

    await createTeam(
      prevState,
      buildFormData({ ...validFields, name: '  Spikers  ' })
    )

    expect(teamsTable.insert).toHaveBeenCalledWith({
      name: 'Spikers',
      tier: 1,
      jersey_id: 1,
    })
  })

  it('returns an error and skips team_users when the team insert fails', async () => {
    const { teamsTable, teamUsersTable } = mockSupabase({
      teams: { insert: { data: null, error: { message: 'boom' } } },
    })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'Could not create the team. Please try again.',
    })
    expect(teamUsersTable.insert).not.toHaveBeenCalled()
    expect(teamsTable.delete).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns an error when the team insert succeeds but returns no row', async () => {
    const { teamUsersTable } = mockSupabase({
      teams: { insert: { data: null, error: null } },
    })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'Could not create the team. Please try again.',
    })
    expect(teamUsersTable.insert).not.toHaveBeenCalled()
  })

  it('cleans up the team when adding the captain fails', async () => {
    const { teamsTable, teamUsersTable } = mockSupabase({
      teams: { insert: { data: { id: 42 }, error: null } },
      teamUsers: { insert: { data: null, error: { message: 'boom' } } },
    })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'Could not add you to the team. Please try again.',
    })
    expect(teamUsersTable.insert).toHaveBeenCalledWith({
      user_id: SEED_CAPTAIN_ID,
      team_id: 42,
      position_id: 1,
      is_captain: true,
    })
    expect(teamsTable.delete).toHaveBeenCalled()
    expect(teamsTable.eq).toHaveBeenCalledWith('id', 42)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('creates the team and adds the captain on success', async () => {
    const { teamsTable, teamUsersTable } = mockSupabase({
      teams: { insert: { data: { id: 7 }, error: null } },
      teamUsers: { insert: { data: {}, error: null } },
    })

    const result = await createTeam(prevState, buildFormData(validFields))

    expect(teamsTable.insert).toHaveBeenCalledWith({
      name: 'Spikers',
      tier: 1,
      jersey_id: 1,
    })
    expect(teamUsersTable.insert).toHaveBeenCalledWith({
      user_id: SEED_CAPTAIN_ID,
      team_id: 7,
      position_id: 1,
      is_captain: true,
    })
    expect(teamsTable.delete).not.toHaveBeenCalled()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
    expect(result).toEqual({ success: true, teamName: 'Spikers' })
  })

  it('does not re-check uniqueness before inserting, so duplicate names both succeed', async () => {
    // Documents a known gap (see the TODO in actions.ts): createTeam never
    // calls checkTeamNameAvailability itself, so nothing stops two calls
    // with the same name from both succeeding.
    const { teamsTable } = mockSupabase({
      teams: { insert: { data: { id: 1 }, error: null } },
      teamUsers: { insert: { data: {}, error: null } },
    })

    const first = await createTeam(prevState, buildFormData(validFields))
    const second = await createTeam(prevState, buildFormData(validFields))

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(teamsTable.insert).toHaveBeenCalledTimes(2)
  })
})
