import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { checkJoinCode, joinTeam, type JoinTeamState } from '../actions'

// redirect() throws in production so the action stops there; make the mock
// throw the same way, otherwise a test could not tell a redirect apart from
// a silent fall-through.
class RedirectError extends Error {}

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new RedirectError(path)
  }),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockRedirect = jest.mocked(redirect)
const mockCreateClient = jest.mocked(createClient)

type Result = { data?: unknown; error?: unknown }

const SIGNED_IN_USER = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
const CODE = 'a1b2c3d4'
const TEAM_ROW = { id: 7, name: 'Spikers' }

// A minimal stand-in for a Supabase query builder: chain methods return the
// builder, and the terminal call resolves to whatever the test configured.
// `teams` ends on .maybeSingle(); an insert is awaited directly, so the
// builder is thenable.
type TableMock = {
  select: (...args: unknown[]) => TableMock
  eq: (...args: unknown[]) => TableMock
  maybeSingle: () => Promise<Result>
  insert: (...args: unknown[]) => TableMock
  then: (
    onfulfilled: (value: Result) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => Promise<unknown>
}

function createTableMock(result: Result): TableMock {
  const builder: TableMock = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    insert: jest.fn(() => builder),
    then: (
      onfulfilled: (value: Result) => unknown,
      onrejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  }

  return builder
}

function mockSupabase(
  config: {
    teams?: Result
    teamUsers?: Result
    rosterOpen?: Result
    user?: { id: string } | null
  } = {}
) {
  const teamsTable = createTableMock(
    config.teams ?? { data: TEAM_ROW, error: null }
  )
  const teamUsersTable = createTableMock(
    config.teamUsers ?? { data: null, error: null }
  )

  const fromMock = jest.fn((table: string) => {
    if (table === 'teams') return teamsTable
    if (table === 'team_users') return teamUsersTable
    throw new Error(`Unexpected table: ${table}`)
  })

  const rpcMock = jest.fn(() =>
    Promise.resolve(config.rosterOpen ?? { data: true, error: null })
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

  return { fromMock, rpcMock, getUserMock, teamsTable, teamUsersTable }
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

const validFields = { code: CODE, positionId: '3' }

// A no-op previous state; useActionState passes this in production.
const prevState: JoinTeamState = {}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('checkJoinCode', () => {
  it('rejects a wrong-length code without querying Supabase', async () => {
    const { fromMock } = mockSupabase()

    const result = await checkJoinCode('abc')

    expect(result).toEqual({ error: 'A join code is 8 characters.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('trims and lowercases before looking the code up', async () => {
    const { teamsTable } = mockSupabase()

    await checkJoinCode('  A1B2C3D4  ')

    expect(teamsTable.eq).toHaveBeenCalledWith('join_code', CODE)
  })

  it('returns the team a valid code belongs to', async () => {
    mockSupabase()

    const result = await checkJoinCode(CODE)

    expect(result).toEqual({ teamId: 7, teamName: 'Spikers' })
  })

  it('reports an unknown code', async () => {
    mockSupabase({ teams: { data: null, error: null } })

    const result = await checkJoinCode(CODE)

    expect(result).toEqual({ error: "That code doesn't match a team." })
  })

  // A query failure also returns no data, so a shared message here would
  // tell the player their code is wrong when Supabase is simply down.
  it('reports a failed lookup distinctly from an unknown code', async () => {
    mockSupabase({ teams: { data: null, error: { message: 'boom' } } })

    const result = await checkJoinCode(CODE)

    expect(result).toEqual({
      error: 'Could not check that code. Please try again.',
    })
  })
})

describe('joinTeam', () => {
  it('rejects a missing position without touching Supabase', async () => {
    const { getUserMock } = mockSupabase()

    const result = await joinTeam(
      prevState,
      buildFormData({ ...validFields, positionId: '' })
    )

    expect(result).toEqual({ error: 'Choose your position.' })
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('refuses to join when there is no session', async () => {
    const { fromMock } = mockSupabase({ user: null })

    const result = await joinTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({ error: 'You must be signed in to join a team.' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('reports an unknown code without inserting', async () => {
    const { teamUsersTable } = mockSupabase({ teams: { data: null, error: null } })

    const result = await joinTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({ error: "That code doesn't match a team." })
    expect(teamUsersTable.insert).not.toHaveBeenCalled()
  })

  it('refuses once the roster has locked', async () => {
    const { teamUsersTable, rpcMock } = mockSupabase({
      rosterOpen: { data: false, error: null },
    })

    const result = await joinTeam(prevState, buildFormData(validFields))

    expect(rpcMock).toHaveBeenCalledWith('roster_open', { target_team_id: 7 })
    expect(result).toEqual({ error: 'This team is no longer taking players.' })
    expect(teamUsersTable.insert).not.toHaveBeenCalled()
  })

  it('reports a duplicate request distinctly from a generic failure', async () => {
    mockSupabase({
      teamUsers: { data: null, error: { code: '23505', message: 'duplicate' } },
    })

    const result = await joinTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'You have already asked to join this team.',
    })
  })

  it('reports a generic insert failure', async () => {
    mockSupabase({
      teamUsers: { data: null, error: { code: '42501', message: 'denied' } },
    })

    const result = await joinTeam(prevState, buildFormData(validFields))

    expect(result).toEqual({
      error: 'Could not send your request. Please try again.',
    })
  })

  it('inserts an unapproved row for the signed-in user and redirects', async () => {
    const { teamUsersTable } = mockSupabase()

    await expect(
      joinTeam(prevState, buildFormData(validFields))
    ).rejects.toThrow(RedirectError)

    // is_approved: false is the whole point — without it the player would
    // walk straight past the captain's approval.
    expect(teamUsersTable.insert).toHaveBeenCalledWith({
      user_id: SIGNED_IN_USER.id,
      team_id: 7,
      position_id: 3,
      is_approved: false,
    })
    expect(mockRedirect).toHaveBeenCalledWith('/teams/7')
  })

  it('resolves the team from the code rather than trusting a posted team id', async () => {
    const { teamUsersTable } = mockSupabase()

    await expect(
      joinTeam(prevState, buildFormData({ ...validFields, teamId: '999' }))
    ).rejects.toThrow(RedirectError)

    expect(teamUsersTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 7 })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/teams/7')
  })
})
