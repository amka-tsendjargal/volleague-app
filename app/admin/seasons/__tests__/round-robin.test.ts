import {
  generateFixtures,
  validateTiers,
  type Fixture,
  type TierEntry,
} from '../round-robin'

function tier(teamIds: number[], overrides: Partial<TierEntry> = {}): TierEntry {
  return { tierId: 1, tierName: 'Competitive', teamIds, ...overrides }
}

// Unordered, so "1 played 4" and "4 played 1" count as the same meeting.
function pairKey(fixture: Fixture): string {
  return [fixture.teamAId, fixture.teamBId].sort((a, b) => a - b).join('v')
}

function teamsInWeek(fixtures: Fixture[], seasonWeekId: number): number[] {
  return fixtures
    .filter((fixture) => fixture.seasonWeekId === seasonWeekId)
    .flatMap((fixture) => [fixture.teamAId, fixture.teamBId])
}

describe('generateFixtures', () => {
  it('plays a full round robin when weeks exactly match rounds', () => {
    const fixtures = generateFixtures(
      [tier([1, 2, 3, 4])],
      [10, 20, 30],
      [1, 2]
    )

    expect(fixtures).toHaveLength(6)
    // 4 teams meet in 6 distinct pairs, each exactly once.
    expect(new Set(fixtures.map(pairKey)).size).toBe(6)
  })

  it('puts every team on court exactly once a week', () => {
    const weekIds = [10, 20, 30, 40, 50]
    const fixtures = generateFixtures(
      [tier([1, 2, 3, 4, 5, 6])],
      weekIds,
      [1, 2, 3]
    )

    for (const weekId of weekIds) {
      expect(teamsInWeek(fixtures, weekId).sort()).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('wraps back to the first round once the round robin is done', () => {
    // 4 teams need 3 rounds, so weeks 4 and 5 replay rounds 1 and 2.
    const fixtures = generateFixtures(
      [tier([1, 2, 3, 4])],
      [10, 20, 30, 40, 50],
      [1, 2]
    )

    const week1 = fixtures.filter((fixture) => fixture.seasonWeekId === 10)
    const week4 = fixtures.filter((fixture) => fixture.seasonWeekId === 40)

    expect(week4.map(pairKey)).toEqual(week1.map(pairKey))
  })

  it('reverses home and away on a wrapped-around rematch', () => {
    const fixtures = generateFixtures(
      [tier([1, 2, 3, 4])],
      [10, 20, 30, 40],
      [1, 2]
    )

    const [firstMeeting] = fixtures.filter(
      (fixture) => fixture.seasonWeekId === 10
    )
    const [rematch] = fixtures.filter((fixture) => fixture.seasonWeekId === 40)

    expect(rematch.teamAId).toBe(firstMeeting.teamBId)
    expect(rematch.teamBId).toBe(firstMeeting.teamAId)
  })

  it('fills what fits when the season is shorter than a round robin', () => {
    // 10 teams need 9 rounds; 3 weeks means most pairs never meet.
    const fixtures = generateFixtures(
      [tier([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])],
      [10, 20, 30],
      [1, 2, 3, 4, 5]
    )

    expect(fixtures).toHaveLength(15)
    expect(new Set(fixtures.map(pairKey)).size).toBe(15)
  })

  it('shares the courts between tiers playing the same night', () => {
    const fixtures = generateFixtures(
      [
        tier([1, 2, 3, 4]),
        tier([5, 6, 7, 8], { tierId: 2, tierName: 'Intermediate' }),
      ],
      [10],
      [1, 2, 3, 4]
    )

    expect(fixtures).toHaveLength(4)
    expect(fixtures.map((fixture) => fixture.courtNumber)).toEqual([1, 2, 3, 4])
  })

  it('restarts court numbering each week', () => {
    const fixtures = generateFixtures([tier([1, 2, 3, 4])], [10, 20], [1, 2])

    expect(
      fixtures
        .filter((fixture) => fixture.seasonWeekId === 20)
        .map((fixture) => fixture.courtNumber)
    ).toEqual([1, 2])
  })

  it('uses the given court numbers rather than counting from one', () => {
    const fixtures = generateFixtures([tier([1, 2, 3, 4])], [10], [3, 7])

    expect(fixtures.map((fixture) => fixture.courtNumber)).toEqual([3, 7])
  })

  it('does not depend on the order teams arrive in', () => {
    const sorted = generateFixtures([tier([1, 2, 3, 4])], [10, 20, 30], [1, 2])
    const shuffled = generateFixtures(
      [tier([3, 1, 4, 2])],
      [10, 20, 30],
      [1, 2]
    )

    expect(shuffled).toEqual(sorted)
  })

  it('returns nothing when the season has no regular weeks', () => {
    expect(generateFixtures([tier([1, 2, 3, 4])], [], [1, 2])).toEqual([])
  })
})

describe('validateTiers', () => {
  it('returns null when every tier is even and the courts fit', () => {
    expect(validateTiers([tier([1, 2, 3, 4])], [1, 2])).toBeNull()
  })

  it('flags a season where no team is confirmed', () => {
    expect(validateTiers([], [1, 2])).toBe(
      'No team in this season has 6 players yet, so there is nothing to schedule.'
    )
  })

  it('flags a tier with a single confirmed team', () => {
    expect(validateTiers([tier([1])], [1, 2])).toBe(
      'Competitive has 1 team with 6 or more players — a tier needs at least 2 to play.'
    )
  })

  it('flags an odd tier, naming the tier and the count', () => {
    expect(
      validateTiers(
        [tier([1, 2, 3, 4, 5, 6, 7, 8, 9], { tierName: 'Competitive' })],
        [1, 2, 3, 4, 5]
      )
    ).toBe(
      'Competitive has 9 teams with 6 or more players. Generating a schedule needs an even number, so every team has an opponent each week.'
    )
  })

  it('reports the second tier when the first is fine', () => {
    expect(
      validateTiers(
        [
          tier([1, 2, 3, 4]),
          tier([5, 6, 7], { tierId: 2, tierName: 'Intermediate' }),
        ],
        [1, 2, 3, 4]
      )
    ).toBe(
      'Intermediate has 3 teams with 6 or more players. Generating a schedule needs an even number, so every team has an opponent each week.'
    )
  })

  it('flags a season with no courts', () => {
    expect(validateTiers([tier([1, 2, 3, 4])], [])).toBe(
      'This season has no courts set, so there is nowhere to schedule matches.'
    )
  })

  it('flags more matches a week than there are courts', () => {
    expect(validateTiers([tier([1, 2, 3, 4, 5, 6])], [1, 2])).toBe(
      'This season plays 3 matches a week but only has 2 courts.'
    )
  })

  it('counts every tier towards the courts needed', () => {
    // Two matches each, four courts needed, three available.
    expect(
      validateTiers(
        [
          tier([1, 2, 3, 4]),
          tier([5, 6, 7, 8], { tierId: 2, tierName: 'Intermediate' }),
        ],
        [1, 2, 3]
      )
    ).toBe('This season plays 4 matches a week but only has 3 courts.')
  })

  it('says court, not courts, when there is only one', () => {
    expect(validateTiers([tier([1, 2, 3, 4])], [1])).toBe(
      'This season plays 2 matches a week but only has 1 court.'
    )
  })
})
