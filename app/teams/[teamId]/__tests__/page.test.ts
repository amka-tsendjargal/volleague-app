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
// The page renders <form action={serverAction}>, and importing a
// 'use server' module from a test would try to register real actions.
jest.mock('../actions', () => ({
  approveMember: jest.fn(),
  declineMember: jest.fn(),
}))

const mockNotFound = jest.mocked(notFound)
const mockCreateClient = jest.mocked(createClient)

type Result = { data: unknown; error: unknown }

const CAPTAIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
// The player whose request is still pending.
const PLAYER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
// An approved teammate, i.e. somebody the request is none of the business of.
const TEAMMATE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const ADMIN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

const TEAM_ROW = { id: 7, name: 'Spikers', join_code: 'a1b2c3d4', tier: 1 }

const CAPTAIN_ROW = {
  id: 1,
  user_id: CAPTAIN_ID,
  is_captain: true,
  is_approved: true,
  users: { first_name: 'Ada', last_name: 'Lovelace' },
  positions: { name: 'Setter' },
}

const TEAMMATE_ROW = {
  id: 2,
  user_id: TEAMMATE_ID,
  is_captain: false,
  is_approved: true,
  users: { first_name: 'Alan', last_name: 'Turing' },
  positions: { name: 'Opposite' },
}

const PENDING_ROW = {
  id: 3,
  user_id: PLAYER_ID,
  is_captain: false,
  is_approved: false,
  users: { first_name: 'Grace', last_name: 'Hopper' },
  positions: { name: 'Libero' },
}

// What the read policy on team_users hands back to someone with no claim on
// the pending row — the approved roster and nothing else.
const APPROVED_ONLY = [CAPTAIN_ROW, TEAMMATE_ROW]

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

function mockSupabase(
  config: {
    teams?: Result
    teamUsers?: Result
    isAdmin?: boolean
    viewerId?: string | null
  } = {}
) {
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

  const rpcMock = jest.fn(() =>
    Promise.resolve({ data: config.isAdmin ?? false, error: null })
  )

  const getUserMock = jest.fn(() =>
    Promise.resolve({
      data: {
        user: config.viewerId ? { id: config.viewerId } : null,
      },
      error: null,
    })
  )

  // Only from/rpc/auth.getUser are exercised; cast the partial stub to the
  // full client type.
  mockCreateClient.mockResolvedValue({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: getUserMock },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { fromMock, rpcMock, getUserMock, teamsTable, teamUsersTable }
}

function renderPage(teamId = '7') {
  return TeamDetailsPage({ params: Promise.resolve({ teamId }) })
}

// Walks the returned element tree and collects every string child, so a test
// can assert on what the page actually put on screen.
function renderedText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderedText).join(' ')

  const element = node as { props?: { children?: unknown } }
  return element.props ? renderedText(element.props.children) : ''
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
    mockSupabase({ teamUsers: { data: [CAPTAIN_ROW], error: null } })

    await expect(renderPage()).resolves.toBeTruthy()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('hides the join code and any pending request from a visitor', async () => {
    mockSupabase({
      teamUsers: { data: APPROVED_ONLY, error: null },
      viewerId: null,
    })

    const text = renderedText(await renderPage())

    expect(text).toContain('Ada Lovelace')
    expect(text).not.toContain('A1B2C3D4')
    expect(text).not.toContain('Your request')
    expect(text).not.toContain('Pending requests')
  })

  it('hides them from an approved teammate', async () => {
    mockSupabase({
      teamUsers: { data: APPROVED_ONLY, error: null },
      viewerId: TEAMMATE_ID,
    })

    const text = renderedText(await renderPage())

    expect(text).not.toContain('A1B2C3D4')
    expect(text).not.toContain('Your request')
    expect(text).not.toContain('Pending requests')
  })

  // Rendered once, under the requests heading — never a second time as
  // though the captain had already approved them.
  it('never lists a pending player among the players', async () => {
    mockSupabase({
      teamUsers: { data: [...APPROVED_ONLY, PENDING_ROW], error: null },
      viewerId: CAPTAIN_ID,
    })

    const text = renderedText(await renderPage())

    expect(text.match(/Grace Hopper/g)).toHaveLength(1)
  })

  it('shows a pending player their own request, without the controls', async () => {
    mockSupabase({
      teamUsers: { data: [...APPROVED_ONLY, PENDING_ROW], error: null },
      viewerId: PLAYER_ID,
    })

    const text = renderedText(await renderPage())

    expect(text).toContain('Your request')
    expect(text).toContain('Grace Hopper')
    expect(text).toContain('Pending')
    // Approving yourself is not on offer, and neither is the invite code.
    expect(text).not.toContain('Approve')
    expect(text).not.toContain('Decline')
    expect(text).not.toContain('A1B2C3D4')
  })

  it('shows the join code and the request queue to the captain', async () => {
    mockSupabase({
      teamUsers: { data: [...APPROVED_ONLY, PENDING_ROW], error: null },
      viewerId: CAPTAIN_ID,
    })

    const text = renderedText(await renderPage())

    expect(text).toContain('A1B2C3D4')
    expect(text).toContain('Pending requests')
    expect(text).toContain('Grace Hopper')
    expect(text).toContain('Approve')
    expect(text).toContain('Decline')
  })

  it('shows them to an admin who is not on the team', async () => {
    mockSupabase({
      teamUsers: { data: [...APPROVED_ONLY, PENDING_ROW], error: null },
      viewerId: ADMIN_ID,
      isAdmin: true,
    })

    const text = renderedText(await renderPage())

    expect(text).toContain('A1B2C3D4')
    expect(text).toContain('Pending requests')
    expect(text).toContain('Approve')
  })
})
