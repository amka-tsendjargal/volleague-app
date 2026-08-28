// Pure standings maths. Separate from the page so it can be unit-tested
// without Next.js or Supabase, and separate from round-robin.ts because
// that one is about who plays whom, this one about who won.

export type PlayedSet = { teamAScore: number; teamBScore: number };

export type PlayedMatch = {
  teamAId: number;
  teamBId: number;
  sets: PlayedSet[];
};

export type MatchResult = { teamASets: number; teamBSets: number };

export type Standing = {
  teamId: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
};

/**
 * Sets won by each side, or null if the match has not been played.
 *
 * A `sets` row exists only once someone records a score, but it defaults
 * to 0-0, and a 0-0 set is not a result — volleyball has no ties. So a
 * level set counts for neither side, and a match whose sets are all level
 * has not been played at all.
 */
export function matchResult(sets: PlayedSet[]): MatchResult | null {
  const result = sets.reduce(
    (tally, set) => ({
      teamASets: tally.teamASets + (set.teamAScore > set.teamBScore ? 1 : 0),
      teamBSets: tally.teamBSets + (set.teamBScore > set.teamAScore ? 1 : 0),
    }),
    { teamASets: 0, teamBSets: 0 }
  );

  return result.teamASets === 0 && result.teamBSets === 0 ? null : result;
}

/**
 * A row per team, best first. Teams with no results yet are included on
 * zeroes rather than dropped, so the table is the division rather than
 * just whoever has played.
 *
 * Ranked on matches won, then set difference, then team id — the last one
 * only so the order is stable rather than because it means anything.
 */
export function computeStandings(
  matches: PlayedMatch[],
  teamIds: number[]
): Standing[] {
  const standings = new Map<number, Standing>(
    teamIds.map((teamId) => [
      teamId,
      { teamId, wins: 0, losses: 0, setsWon: 0, setsLost: 0 },
    ])
  );

  for (const match of matches) {
    const result = matchResult(match.sets);
    if (!result) {
      continue;
    }

    const teamA = standings.get(match.teamAId);
    const teamB = standings.get(match.teamBId);
    // A fixture can name a team that is not in teamIds — a different tier,
    // since every tier shares the season's weeks.
    if (!teamA || !teamB) {
      continue;
    }

    teamA.setsWon += result.teamASets;
    teamA.setsLost += result.teamBSets;
    teamB.setsWon += result.teamBSets;
    teamB.setsLost += result.teamASets;

    if (result.teamASets > result.teamBSets) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (result.teamBSets > result.teamASets) {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  return [...standings.values()].sort(
    (teamA, teamB) =>
      teamB.wins - teamA.wins ||
      teamB.setsWon - teamB.setsLost - (teamA.setsWon - teamA.setsLost) ||
      teamA.teamId - teamB.teamId
  );
}
