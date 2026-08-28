import { createClient } from '@/lib/supabase/server'

import {
  generateSchedule,
  publishSchedule,
  setSeasonStatus,
} from '../actions'

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const mockCreateClient = jest.mocked(createClient)

type Result = { data?: unknown; error?: unknown }

// A stand-in for the Supabase query builder. Chain methods return the
// builder, and the builder itself is thenable, so both shapes the actions
// use resolve to the configured result: `await from().select().eq()` and
// `await from().select().eq().order()`.
type TableMock = {
  select: (...args: unknown[]) => TableMock
  update: (...args: unknown[]) => TableMock
  eq: (...args: unknown[]) => TableMock
  order: (...args: unknown[]) => Promise<Result>
  maybeSingle: () => Promise<Result>
  then: (resolve: (value: Result) => unknown) => unknown
}

function createTableMock(result: Result): TableMock {
  const builder: TableMock = {
    select: jest.fn(() => builder),
    update: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: Result) => unknown) => resolve(result),
  }

  return builder
}

function mockSupabase(config: {
  seasons?: Result
  seasonWeeks?: Result
  teams?: Result
  isAdmin?: boolean
  rpc?: Result
} = {}) {
  const tables = {
    seasons: createTableMock(config.seasons ?? { data: null, error: null }),
    season_weeks: createTableMock(
      config.seasonWeeks ?? { data: [], error: null }
    ),
    teams: createTableMock(config.teams ?? { data: [], error: null }),
  }

  const fromMock = jest.fn((table: keyof typeof tables) => {
    const builder = tables[table]
    if (!builder) throw new Error(`Unexpected table: ${table}`)
    return builder
  })

  const rpcMock = jest.fn((name: string) =>
    Promise.resolve(
      name === 'is_admin'
        ? { data: config.isAdmin ?? true, error: null }
        : (config.rpc ?? { data: 2, error: null })
    )
  )

  mockCreateClient.mockResolvedValue({
    from: fromMock,
    rpc: rpcMock,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { fromMock, rpcMock, tables }
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

// Two teams in one tier, each with a full lineup, on one week and one court:
// the smallest input generateSchedule will actually pair up.
const schedulableSeason = {
  seasons: { data: { court_numbers: [1], status: 'closed' }, error: null },
  seasonWeeks: { data: [{ id: 10 }], error: null },
  teams: {
    data: [
      { id: 1, tier_id: 1, tiers: { name: 'Competitive' }, team_users: [{ count: 6 }] },
      { id: 2, tier_id: 1, tiers: { name: 'Competitive' }, team_users: [{ count: 6 }] },
    ],
    error: null,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('setSeasonStatus', () => {
  it('closes registration', async () => {
    const { tables } = mockSupabase()

    await setSeasonStatus(1, 'closed')

    expect(tables.seasons.update).toHaveBeenCalledWith({ status: 'closed' })
  })

  it('refuses to set scheduled, which only publishSchedule may write', async () => {
    // Otherwise the status menu would be a way around the "has fixtures"
    // check, i.e. a way to announce an empty season.
    const { tables } = mockSupabase()

    await setSeasonStatus(1, 'scheduled')

    expect(tables.seasons.update).not.toHaveBeenCalled()
  })
})

describe('generateSchedule', () => {
  it('refuses while registration is still open', async () => {
    const { rpcMock } = mockSupabase({
      ...schedulableSeason,
      seasons: {
        data: { court_numbers: [1], status: 'registration' },
        error: null,
      },
    })

    const result = await generateSchedule(
      {},
      buildFormData({ seasonId: '1' })
    )

    expect(result).toEqual({
      error: 'Close registration before generating the schedule.',
    })
    expect(rpcMock).not.toHaveBeenCalledWith(
      'generate_schedule',
      expect.anything()
    )
  })

  it('generates once registration is closed', async () => {
    const { rpcMock } = mockSupabase(schedulableSeason)

    const result = await generateSchedule(
      {},
      buildFormData({ seasonId: '1' })
    )

    expect(result).toEqual({ success: true, fixtureCount: 2 })
    expect(rpcMock).toHaveBeenCalledWith('generate_schedule', {
      target_season_id: 1,
      fixtures: [
        { season_week_id: 10, team_a_id: 1, team_b_id: 2, court_number: 1 },
      ],
    })
  })

  it('still generates for a published season, so it can be regenerated', async () => {
    const { rpcMock } = mockSupabase({
      ...schedulableSeason,
      seasons: {
        data: { court_numbers: [1], status: 'scheduled' },
        error: null,
      },
    })

    const result = await generateSchedule({}, buildFormData({ seasonId: '1' }))

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith(
      'generate_schedule',
      expect.anything()
    )
  })
})

describe('publishSchedule', () => {
  it('refuses to publish a season with no fixtures', async () => {
    const { tables } = mockSupabase({
      seasonWeeks: { data: [{ id: 10, schedules: [{ count: 0 }] }], error: null },
    })

    const result = await publishSchedule({}, buildFormData({ seasonId: '1' }))

    expect(result).toEqual({ error: 'Generate a schedule before publishing it.' })
    expect(tables.seasons.update).not.toHaveBeenCalled()
  })

  it('publishes a season that has fixtures', async () => {
    const { tables } = mockSupabase({
      seasonWeeks: { data: [{ id: 10, schedules: [{ count: 3 }] }], error: null },
      seasons: { data: null, error: null },
    })

    const result = await publishSchedule({}, buildFormData({ seasonId: '1' }))

    expect(result).toEqual({ success: true })
    expect(tables.seasons.update).toHaveBeenCalledWith({ status: 'scheduled' })
  })
})
