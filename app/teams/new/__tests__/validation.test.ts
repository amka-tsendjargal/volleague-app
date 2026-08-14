import { getNameLengthError, validateTeamInput } from '../validation'

type TeamInput = {
  name: string
  seasonId: number
  tierId: number
  jerseyId: number
  positionId: number
}

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validate(overrides: Partial<TeamInput> = {}) {
  const input: TeamInput = {
    name: 'Spikers',
    seasonId: 1,
    tierId: 1,
    jerseyId: 1,
    positionId: 1,
    ...overrides,
  }
  return validateTeamInput(
    input.name,
    input.seasonId,
    input.tierId,
    input.jerseyId,
    input.positionId
  )
}

describe('getNameLengthError', () => {
  it('flags a name shorter than the minimum', () => {
    expect(getNameLengthError('ab')).toBe(
      'Team name must be at least 3 characters.'
    )
  })

  it('accepts a name exactly at the minimum length', () => {
    expect(getNameLengthError('abc')).toBeNull()
  })
})

describe('validateTeamInput', () => {
  it('returns null for fully valid input', () => {
    expect(validate()).toBeNull()
  })

  describe('name', () => {
    it('flags a name shorter than the minimum', () => {
      expect(validate({ name: 'ab' })).toBe(
        'Team name must be at least 3 characters.'
      )
    })

    it('accepts a name exactly at the minimum length', () => {
      expect(validate({ name: 'abc' })).toBeNull()
    })

    it('accepts a name exactly at the maximum length', () => {
      expect(validate({ name: 'a'.repeat(255) })).toBeNull()
    })

    it('flags a name longer than the maximum', () => {
      expect(validate({ name: 'a'.repeat(256) })).toBe(
        'Team name must be 255 characters or fewer.'
      )
    })

    it.each(['Team!', 'Team_1', 'Team%', 'Team✨', 'Team\t1'])(
      'flags a name with invalid characters %p',
      (name) => {
        expect(validate({ name })).toBe(
          'Team name can only contain letters, numbers, and spaces.'
        )
      }
    )

    it('accepts letters, numbers, and spaces mixed together', () => {
      expect(validate({ name: 'Team 1 Alpha' })).toBeNull()
    })
  })

  // seasonId and tierId are foreign keys now, so the database rejects a
  // value that isn't a real season, or a tier that season doesn't run.
  // These only cover an empty or unparseable selection.
  describe('seasonId', () => {
    it.each([0, -1, 1.5, Number.NaN])(
      'flags an invalid seasonId %p',
      (seasonId) => {
        expect(validate({ seasonId })).toBe('Choose a season.')
      }
    )

    it('accepts a positive integer seasonId', () => {
      expect(validate({ seasonId: 2 })).toBeNull()
    })
  })

  describe('tierId', () => {
    it.each([0, -1, 1.5, Number.NaN])(
      'flags an invalid tierId %p',
      (tierId) => {
        expect(validate({ tierId })).toBe('Choose a tier.')
      }
    )

    it('accepts a positive integer tierId', () => {
      expect(validate({ tierId: 3 })).toBeNull()
    })
  })

  describe('jerseyId', () => {
    it.each([0, -1, 1.5, Number.NaN])(
      'flags an invalid jerseyId %p',
      (jerseyId) => {
        expect(validate({ jerseyId })).toBe('Choose a jersey.')
      }
    )

    it('accepts a positive integer jerseyId', () => {
      expect(validate({ jerseyId: 2 })).toBeNull()
    })
  })

  describe('positionId', () => {
    it.each([0, -1, 1.5, Number.NaN])(
      'flags an invalid positionId %p',
      (positionId) => {
        expect(validate({ positionId })).toBe('Choose your position.')
      }
    )

    it('accepts a positive integer positionId', () => {
      expect(validate({ positionId: 2 })).toBeNull()
    })
  })

  it('reports only the first error found, in check order', () => {
    // Name too short AND an unselected tier: the length error wins.
    expect(validate({ name: 'ab', tierId: 0 })).toBe(
      'Team name must be at least 3 characters.'
    )
  })
})
