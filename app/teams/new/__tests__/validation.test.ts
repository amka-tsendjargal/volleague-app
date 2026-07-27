import { getNameLengthError, validateTeamInput } from '../validation'

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validInput(overrides: Partial<{
  name: string
  tier: number
  jerseyId: number
  positionId: number
}> = {}) {
  const input = {
    name: 'Spikers',
    tier: 1,
    jerseyId: 1,
    positionId: 1,
    ...overrides,
  }
  return input
}

function validate(overrides: Partial<{
  name: string
  tier: number
  jerseyId: number
  positionId: number
}> = {}) {
  const input = validInput(overrides)
  return validateTeamInput(input.name, input.tier, input.jerseyId, input.positionId)
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

  describe('tier', () => {
    it.each([1, 2])('accepts a valid tier %p', (tier) => {
      expect(validate({ tier })).toBeNull()
    })

    it('flags a tier outside the known set', () => {
      expect(validate({ tier: 3 })).toBe('Choose a valid tier.')
    })

    it('flags a NaN tier (unparseable selection)', () => {
      expect(validate({ tier: Number('abc') })).toBe('Choose a valid tier.')
    })

    it('flags a missing tier (empty selection parses to 0)', () => {
      expect(validate({ tier: Number('') })).toBe('Choose a valid tier.')
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
    // Name too short AND an invalid tier: the length error wins.
    expect(validate({ name: 'ab', tier: 99 })).toBe(
      'Team name must be at least 3 characters.'
    )
  })
})
