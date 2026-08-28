// Pure validation for the create-season form. Separate from actions.ts
// because a 'use server' module may only export async Server Actions, and
// so these rules can be unit-tested without Next.js or Supabase.

import { MIN_TEAMS_PER_TIER } from "@/lib/constants";

export type TierCap = { tierId: number; maxTeams: number };

/**
 * The round robin needs a week for every opponent, so a tier of N teams
 * can't finish one in fewer than N-1 regular weeks. Below that some pairs
 * never meet and the standings stop meaning anything.
 */
export function regularWeeksNeeded(tierCaps: TierCap[]): number {
  return Math.max(0, ...tierCaps.map((tierCap) => tierCap.maxTeams - 1));
}

/**
 * Which week number the playoffs start on. Defined from the end, so
 * skipping a date the playoffs fell on slides them earlier instead of
 * costing one — the playoff count is preserved by construction.
 *
 * Shared by the form and the action so the badge and the stored is_playoff
 * flag can't disagree.
 */
export function firstPlayoffWeek(
  playingWeeks: number,
  playoffWeeks: number
): number {
  return playingWeeks - playoffWeeks + 1;
}

/**
 * Splits the courts field ("1, 2, 3") into numbers. Empty entries are
 * dropped so a trailing comma is harmless; anything else non-numeric is
 * kept as NaN for validateSeasonInput to report rather than silently
 * skipped, since dropping it would schedule matches onto courts the admin
 * never listed.
 */
export function parseCourtNumbers(raw: string): number[] {
  return raw
    .split(",")
    .map((court) => court.trim())
    .filter((court) => court.length > 0)
    .map(Number);
}

/**
 * Returns the first problem found, or null. Fail-fast rather than a
 * per-field map, since the form shows one error at a time.
 *
 * `weekTimes` is the playing nights only — skipped dates are already gone
 * — and the last `playoffWeeks` of them are the playoffs.
 */
export function validateSeasonInput(
  name: string,
  weekTimes: string[],
  playoffWeeks: number,
  tierCaps: TierCap[],
  courtNumbers: number[]
): string | null {
  if (name.length === 0) {
    return "Enter a season name.";
  }
  if (name.length > 255) {
    return "Season name must be 255 characters or fewer.";
  }

  if (weekTimes.length === 0) {
    return "A season needs at least one week.";
  }
  if (weekTimes.some((weekTime) => Number.isNaN(Date.parse(weekTime)))) {
    return "Every week needs a valid date and time.";
  }

  if (!Number.isInteger(playoffWeeks) || playoffWeeks < 0) {
    return "Enter how many playoff weeks to play.";
  }
  if (playoffWeeks >= weekTimes.length) {
    return "A season needs at least one regular week before the playoffs.";
  }

  if (tierCaps.length === 0) {
    return "Choose at least one tier.";
  }
  if (
    new Set(tierCaps.map((tierCap) => tierCap.tierId)).size !== tierCaps.length
  ) {
    return "Each tier can only be added once.";
  }
  if (
    tierCaps.some(
      (tierCap) =>
        !Number.isInteger(tierCap.maxTeams) ||
        tierCap.maxTeams < MIN_TEAMS_PER_TIER
    )
  ) {
    return `Each tier needs a cap of at least ${MIN_TEAMS_PER_TIER} teams.`;
  }

  if (courtNumbers.length === 0) {
    return "Enter at least one court number.";
  }
  if (
    courtNumbers.some(
      (courtNumber) => !Number.isInteger(courtNumber) || courtNumber < 1
    )
  ) {
    return "Court numbers must be whole numbers above zero.";
  }
  if (new Set(courtNumbers).size !== courtNumbers.length) {
    return "Each court can only be listed once.";
  }

  return null;
}
