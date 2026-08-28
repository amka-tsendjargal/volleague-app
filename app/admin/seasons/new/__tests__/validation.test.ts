import {
  firstPlayoffWeek,
  parseCourtNumbers,
  regularWeeksNeeded,
  validateSeasonInput,
  type TierCap,
} from '../validation'

type SeasonInput = {
  name: string
  weekTimes: string[]
  playoffWeeks: number
  tierCaps: TierCap[]
  courtNumbers: number[]
}

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validate(overrides: Partial<SeasonInput> = {}) {
  const input: SeasonInput = {
    name: 'Fall 2026',
    weekTimes: [
      '2026-09-11T02:15:00.000Z',
      '2026-09-18T02:15:00.000Z',
      '2026-09-25T02:15:00.000Z',
    ],
    playoffWeeks: 1,
    tierCaps: [{ tierId: 1, maxTeams: 10 }],
    courtNumbers: [1, 2, 3],
    ...overrides,
  }
  return validateSeasonInput(
    input.name,
    input.weekTimes,
    input.playoffWeeks,
    input.tierCaps,
    input.courtNumbers
  )
}

describe('validateSeasonInput', () => {
  it('returns null for fully valid input', () => {
    expect(validate()).toBeNull()
  })

  describe('name', () => {
    it('flags an empty name', () => {
      expect(validate({ name: '' })).toBe('Enter a season name.')
    })

    it('accepts a name exactly at the maximum length', () => {
      expect(validate({ name: 'a'.repeat(255) })).toBeNull()
    })

    it('flags a name longer than the maximum', () => {
      expect(validate({ name: 'a'.repeat(256) })).toBe(
        'Season name must be 255 characters or fewer.'
      )
    })
  })

  describe('weekTimes', () => {
    it('flags a season with no weeks', () => {
      expect(validate({ weekTimes: [], playoffWeeks: 0 })).toBe(
        'A season needs at least one week.'
      )
    })

    it('flags an unparseable week', () => {
      expect(validate({ weekTimes: ['2026-09-11T02:15:00.000Z', 'nope'] })).toBe(
        'Every week needs a valid date and time.'
      )
    })
  })

  describe('playoffWeeks', () => {
    it.each([-1, 1.5, Number.NaN])('flags %p', (playoffWeeks) => {
      expect(validate({ playoffWeeks })).toBe(
        'Enter how many playoff weeks to play.'
      )
    })

    it('allows a season with no playoffs at all', () => {
      expect(validate({ playoffWeeks: 0 })).toBeNull()
    })

    it('flags a season that is all playoffs and no regular weeks', () => {
      expect(validate({ playoffWeeks: 3 })).toBe(
        'A season needs at least one regular week before the playoffs.'
      )
    })
  })

  describe('tierCaps', () => {
    it('flags a season with no tiers', () => {
      expect(validate({ tierCaps: [] })).toBe('Choose at least one tier.')
    })

    it('flags the same tier added twice', () => {
      expect(
        validate({
          tierCaps: [
            { tierId: 1, maxTeams: 10 },
            { tierId: 1, maxTeams: 8 },
          ],
        })
      ).toBe('Each tier can only be added once.')
    })

    it.each([1, 0, -2, 4.5, Number.NaN])('flags a cap of %p', (maxTeams) => {
      expect(validate({ tierCaps: [{ tierId: 1, maxTeams }] })).toBe(
        'Each tier needs a cap of at least 2 teams.'
      )
    })

    it('accepts an odd cap, since evenness is checked at generation', () => {
      expect(validate({ tierCaps: [{ tierId: 1, maxTeams: 9 }] })).toBeNull()
    })
  })

  describe('courtNumbers', () => {
    it('flags a season with no courts', () => {
      expect(validate({ courtNumbers: [] })).toBe(
        'Enter at least one court number.'
      )
    })

    it.each([0, -2, 1.5, Number.NaN])('flags a court of %p', (courtNumber) => {
      expect(validate({ courtNumbers: [1, courtNumber] })).toBe(
        'Court numbers must be whole numbers above zero.'
      )
    })

    it('flags the same court listed twice', () => {
      expect(validate({ courtNumbers: [1, 2, 1] })).toBe(
        'Each court can only be listed once.'
      )
    })

    it('accepts courts that are neither consecutive nor starting at one', () => {
      expect(validate({ courtNumbers: [3, 4, 7] })).toBeNull()
    })
  })

  it('reports only the first error found, in check order', () => {
    // Empty name AND no tiers: the name error wins.
    expect(validate({ name: '', tierCaps: [] })).toBe('Enter a season name.')
  })
})

describe('parseCourtNumbers', () => {
  it('splits on commas and trims', () => {
    expect(parseCourtNumbers('1, 2,3 ')).toEqual([1, 2, 3])
  })

  it('ignores empty entries, so a trailing comma is harmless', () => {
    expect(parseCourtNumbers('1,2,')).toEqual([1, 2])
  })

  it.each(['', '   ', ','])('returns nothing for %p', (raw) => {
    expect(parseCourtNumbers(raw)).toEqual([])
  })

  it('keeps non-numeric entries as NaN for validation to report', () => {
    // Dropping them would quietly schedule onto courts nobody listed.
    expect(parseCourtNumbers('1,abc')).toEqual([1, Number.NaN])
  })
})
describe('regularWeeksNeeded', () => {
  it('takes the largest tier, since every tier shares the same weeks', () => {
    expect(
      regularWeeksNeeded([
        { tierId: 1, maxTeams: 10 },
        { tierId: 2, maxTeams: 8 },
      ])
    ).toBe(9)
  })

  it('is zero when no tiers are chosen yet', () => {
    expect(regularWeeksNeeded([])).toBe(0)
  })
})

describe('firstPlayoffWeek', () => {
  it('puts the playoffs at the end of the season', () => {
    expect(firstPlayoffWeek(15, 2)).toBe(14)
  })

  // The whole point of defining it from the end: skipping a night the
  // playoffs fell on slides them earlier instead of costing one.
  it('slides earlier when a night is skipped, keeping both playoff weeks', () => {
    expect(firstPlayoffWeek(14, 2)).toBe(13)
  })

  it('is past the last week when there are no playoffs', () => {
    expect(firstPlayoffWeek(13, 0)).toBe(14)
  })
})
