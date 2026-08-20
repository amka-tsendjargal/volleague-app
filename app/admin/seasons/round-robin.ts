// Pure fixture generation. Separate from actions.ts because a 'use server'
// module may only export async Server Actions, and so the pairing can be
// unit-tested without Next.js or Supabase.

import { MIN_PLAYERS_PER_TEAM, MIN_TEAMS_PER_TIER } from "@/lib/constants";

export type TierEntry = {
  tierId: number;
  tierName: string;
  // Confirmed teams only — the caller has already dropped anyone below
  // MIN_PLAYERS_PER_TEAM.
  teamIds: number[];
};

export type Fixture = {
  seasonWeekId: number;
  teamAId: number;
  teamBId: number;
  courtNumber: number;
};

/**
 * How many matches a tier plays each week. Every team is on court every
 * week, so it never varies between weeks.
 */
function matchesPerWeek(tiers: TierEntry[]): number {
  return tiers.reduce((total, tier) => total + tier.teamIds.length / 2, 0);
}

/**
 * Returns the first problem found, or null. Fail-fast rather than a
 * per-tier map, since the button shows one error at a time.
 *
 * Every message names the tier and the count, because the fix is always
 * "go change the rosters" and the admin needs to know which one.
 */
export function validateTiers(
  tiers: TierEntry[],
  courtNumbers: number[]
): string | null {
  if (tiers.length === 0) {
    return `No team in this season has ${MIN_PLAYERS_PER_TEAM} players yet, so there is nothing to schedule.`;
  }

  for (const tier of tiers) {
    if (tier.teamIds.length < MIN_TEAMS_PER_TIER) {
      return `${tier.tierName} has ${describeTeams(
        tier.teamIds.length
      )} with ${MIN_PLAYERS_PER_TEAM} or more players — a tier needs at least ${MIN_TEAMS_PER_TIER} to play.`;
    }
    // An odd tier would leave one team without an opponent every week.
    // Byes are the alternative, but sitting a team out of a short season
    // is a league decision, not something generation should pick.
    if (tier.teamIds.length % 2 !== 0) {
      return `${tier.tierName} has ${describeTeams(
        tier.teamIds.length
      )} with ${MIN_PLAYERS_PER_TEAM} or more players. Generating a schedule needs an even number, so every team has an opponent each week.`;
    }
  }

  if (courtNumbers.length === 0) {
    return "This season has no courts set, so there is nowhere to schedule matches.";
  }

  // season_weeks stores one match_time per week, so matches cannot be
  // staggered into later waves on the same night — more matches than
  // courts is unplayable rather than merely tight.
  const needed = matchesPerWeek(tiers);
  if (needed > courtNumbers.length) {
    return `This season plays ${needed} matches a week but only has ${courtNumbers.length} ${
      courtNumbers.length === 1 ? "court" : "courts"
    }.`;
  }

  return null;
}

function describeTeams(count: number): string {
  return count === 1 ? "1 team" : `${count} teams`;
}

/**
 * Circle method: hold the first team still and rotate the rest, so each
 * round pairs everyone off and no pair repeats. `teamIds` must be even and
 * non-empty — validateTiers is what enforces that.
 *
 * Returns teamIds.length - 1 rounds, which is a full round robin.
 */
function roundRobinRounds(teamIds: number[]): [number, number][][] {
  // Sorted so the same teams always produce the same fixtures, whatever
  // order the database handed them back in.
  const rotation = [...teamIds].sort((a, b) => a - b);
  const half = rotation.length / 2;

  return Array.from({ length: rotation.length - 1 }, (_, round) => {
    const pairs = Array.from({ length: half }, (_, index): [number, number] => {
      const home = rotation[index];
      const away = rotation[rotation.length - 1 - index];
      // Alternating who is listed first keeps one team from being listed
      // first in every one of its matches.
      return round % 2 === 0 ? [home, away] : [away, home];
    });

    // Rotate everything except the fixed first team, ready for the next
    // round.
    rotation.splice(1, 0, rotation.pop() as number);
    return pairs;
  });
}

/**
 * Lays every tier's round robin across the season's regular weeks.
 *
 * More weeks than rounds wraps back to round 1, so later weeks are
 * rematches rather than empty nights. Fewer weeks than rounds fills what
 * fits, leaving some pairs unplayed — the season is simply too short for a
 * full round robin, which the create-season form already warns about.
 *
 * Courts are handed out across all tiers within a week, not per tier: the
 * tiers play simultaneously, so their matches compete for the same floor.
 */
export function generateFixtures(
  tiers: TierEntry[],
  regularWeekIds: number[],
  courtNumbers: number[]
): Fixture[] {
  const roundsByTier = tiers.map((tier) => roundRobinRounds(tier.teamIds));

  return regularWeekIds.flatMap((seasonWeekId, weekIndex) => {
    let court = 0;

    return roundsByTier.flatMap((rounds) => {
      // Which time through the round robin this week is. A wrapped week
      // replays the same round, so swapping the pair on odd laps makes the
      // rematch a return leg instead of a carbon copy of the first meeting.
      const lap = Math.floor(weekIndex / rounds.length);

      return rounds[weekIndex % rounds.length].map(([home, away]) => ({
        seasonWeekId,
        teamAId: lap % 2 === 0 ? home : away,
        teamBId: lap % 2 === 0 ? away : home,
        courtNumber: courtNumbers[court++],
      }));
    });
  });
}
