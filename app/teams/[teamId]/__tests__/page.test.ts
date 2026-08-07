import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import TeamDetailsPage from '../page'

// notFound() throws in production so rendering stops; make the mock throw the
// same way, otherwise the page would carry on with a null team.
class NotFoundError extends Error {}

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new NotFoundError('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockNotFound = jest.mocked(notFound)
const mockCreateClient = jest.mocked(createClient)

type Result = { data: unknown; error: unknown }

const TEAM_ROW = { id: 7, name: 'Spikers', tier: 1 }

// Stands in for a Supabase query builder: chain methods return the builder,
// and the call the page awaits resolves to whatever the test configured.
// `teams` ends on .maybeSingle(); `team_users` is awaited directly, so the
// builder is thenable.
type TableMock = {
  select: (...args: unknown[]) => TableMock
  eq: (...args: unknown[]) => TableMock
  maybeSingle: () => Promise<Result>
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
    then: (
      onfulfilled: (value: Result) => unknown,
      onrejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  }

  return builder
}

function mockSupabase(config: { teams?: Result; teamUsers?: Result } = {}) {
  const teamsTable = createTableMock(
    config.teams ?? { data: TEAM_ROW, error: null }
  )
  const teamUsersTable = createTableMock(
    config.teamUsers ?? { data: [], error: null }
  )

  const fromMock = jest.fn((table: string) => {
    if (table === 'teams') return teamsTable
    if (table === 'team_users') return teamUsersTable
    throw new Error(`Unexpected table: ${table}`)
  })

  // Only `from` is exercised; cast the partial stub to the full client type.
  mockCreateClient.mockResolvedValue({
    from: fromMock,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { fromMock, teamsTable, teamUsersTable }
}

function renderPage(teamId = '7') {
  return TeamDetailsPage({ params: Promise.resolve({ teamId }) })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('TeamDetailsPage', () => {
  it('404s on a non-integer team id without querying Supabase', async () => {
    const { fromMock } = mockSupabase()

    await expect(renderPage('abc')).rejects.toThrow(NotFoundError)
    expect(mockNotFound).toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('404s when the team query returns no row and no error', async () => {
    mockSupabase({ teams: { data: null, error: null } })

    await expect(renderPage()).rejects.toThrow(NotFoundError)
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('throws instead of 404ing when the team query fails', async () => {
    const error = { message: 'FetchError: fetch failed', code: '' }
    mockSupabase({ teams: { data: null, error } })

    // A 404 here would tell the user a real team does not exist.
    await expect(renderPage()).rejects.toThrow('Failed to load team 7')
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('attaches the Supabase error as the cause so it reaches the logs', async () => {
    const error = { message: 'permission denied for table teams', code: '42501' }
    mockSupabase({ teams: { data: null, error } })

    await expect(renderPage()).rejects.toMatchObject({ cause: error })
  })

  it('throws instead of rendering "No players" when the roster query fails', async () => {
    const error = { message: 'JWT expired', code: 'PGRST301' }
    mockSupabase({ teamUsers: { data: null, error } })

    await expect(renderPage()).rejects.toThrow(
      'Failed to load the roster for team 7'
    )
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('renders when both queries succeed', async () => {
    mockSupabase({
      teamUsers: {
        data: [
          {
            id: 1,
            is_captain: true,
            users: { first_name: 'Ada', last_name: 'Lovelace' },
            positions: { name: 'Setter' },
          },
        ],
        error: null,
      },
    })

    await expect(renderPage()).resolves.toBeTruthy()
    expect(mockNotFound).not.toHaveBeenCalled()
  })
})
