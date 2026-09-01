import { computeStandings, matchResult } from '../standings'

function sets(...scores: [number, number][]) {
  return scores.map(([teamAScore, teamBScore]) => ({ teamAScore, teamBScore }))
}

describe('matchResult', () => {
  it('counts sets won by each side', () => {
    expect(matchResult(sets([25, 20], [18, 25], [25, 22]))).toEqual({
      teamASets: 2,
      teamBSets: 1,
    })
  })

  it('treats a match with no sets as unplayed', () => {
    expect(matchResult([])).toBeNull()
  })

  it('treats all-level sets as unplayed, since 0-0 is the default row', () => {
    expect(matchResult(sets([0, 0], [0, 0]))).toBeNull()
  })

  it('ignores a level set but still reports the decided ones', () => {
    expect(matchResult(sets([25, 20], [0, 0]))).toEqual({
      teamASets: 1,
      teamBSets: 0,
    })
  })
})

describe('computeStandings', () => {
  it('lists every team, including those yet to play', () => {
    const standings = computeStandings([], [3, 1, 2])

    expect(standings).toEqual([
      { teamId: 1, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
      { teamId: 2, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
      { teamId: 3, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
    ])
  })

  it('credits the winner and debits the loser', () => {
    const standings = computeStandings(
      [{ teamAId: 1, teamBId: 2, sets: sets([25, 20], [25, 18]) }],
      [1, 2]
    )

    expect(standings[0]).toEqual({
      teamId: 1,
      wins: 1,
      losses: 0,
      setsWon: 2,
      setsLost: 0,
    })
    expect(standings[1]).toEqual({
      teamId: 2,
      wins: 0,
      losses: 1,
      setsWon: 0,
      setsLost: 2,
    })
  })

  it('ranks on wins first', () => {
    const standings = computeStandings(
      [
        { teamAId: 1, teamBId: 2, sets: sets([25, 20]) },
        { teamAId: 1, teamBId: 3, sets: sets([25, 20]) },
        { teamAId: 2, teamBId: 3, sets: sets([25, 20]) },
      ],
      [1, 2, 3]
    )

    expect(standings.map((standing) => standing.teamId)).toEqual([1, 2, 3])
  })

  it('breaks a tie on set difference', () => {
    // Both win once, but team 2 wins by more sets.
    const standings = computeStandings(
      [
        { teamAId: 1, teamBId: 3, sets: sets([25, 20], [18, 25], [25, 22]) },
        { teamAId: 2, teamBId: 3, sets: sets([25, 20], [25, 18]) },
      ],
      [1, 2, 3]
    )

    expect(standings.map((standing) => standing.teamId)).toEqual([2, 1, 3])
  })

  it('skips fixtures belonging to another tier', () => {
    const standings = computeStandings(
      [{ teamAId: 8, teamBId: 9, sets: sets([25, 20]) }],
      [1, 2]
    )

    expect(standings.every((standing) => standing.wins === 0)).toBe(true)
  })

  it('leaves an unplayed fixture out of the record', () => {
    const standings = computeStandings(
      [{ teamAId: 1, teamBId: 2, sets: [] }],
      [1, 2]
    )

    expect(standings).toEqual([
      { teamId: 1, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
      { teamId: 2, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
    ])
  })
})
