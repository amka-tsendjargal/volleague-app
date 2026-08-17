// Pure, dependency-free validation for the create-team form.
//
// This lives outside actions.ts on purpose: a `'use server'` module may only
// export async Server Actions, so a synchronous helper can't live there. Keeping
// it separate also means these rules can be unit-tested without touching
// Next.js or Supabase.

import { MIN_TEAM_NAME_LENGTH, TEAM_NAME_PATTERN } from "@/lib/constants";

export function getNameLengthError(name: string): string | null {
  if (name.length < MIN_TEAM_NAME_LENGTH) {
    return `Team name must be at least ${MIN_TEAM_NAME_LENGTH} characters.`;
  }
  return null;
}

/**
 * Validates a team's fields and returns the first error found, or null if
 * everything is valid. Fail-fast rather than a per-field map, since the form
 * only ever surfaces one error message at a time.
 */
export function validateTeamInput(
  name: string,
  seasonId: number,
  tierId: number,
  jerseyId: number,
  positionId: number
): string | null {
  const nameLengthError = getNameLengthError(name);
  if (nameLengthError) {
    return nameLengthError;
  }
  if (name.length > 255) {
    return "Team name must be 255 characters or fewer.";
  }
  if (!TEAM_NAME_PATTERN.test(name)) {
    return "Team name can only contain letters, numbers, and spaces.";
  }
  // tier_id, season_id, jersey_id and position_id are all foreign keys, so
  // the database rejects anything that isn't a real row — including a tier
  // the chosen season doesn't offer. These only catch an empty or garbled
  // selection before the round trip.
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    return "Choose a season.";
  }
  if (!Number.isInteger(tierId) || tierId <= 0) {
    return "Choose a tier.";
  }
  if (!Number.isInteger(jerseyId) || jerseyId <= 0) {
    return "Choose a jersey.";
  }
  if (!Number.isInteger(positionId) || positionId <= 0) {
    return "Choose your position.";
  }
  return null;
}
