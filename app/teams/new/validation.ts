// Pure, dependency-free validation for the create-team form.
//
// This lives outside actions.ts on purpose: a `'use server'` module may only
// export async Server Actions, so a synchronous helper can't live there. Keeping
// it separate also means these rules can be unit-tested without touching
// Next.js or Supabase.

import {
  MIN_TEAM_NAME_LENGTH,
  TEAM_NAME_PATTERN,
  TEAM_TIERS,
} from "@/lib/constants";

const validTiers = new Set<number>(TEAM_TIERS.map((tier) => tier.value));

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
  tier: number,
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
  if (!validTiers.has(tier)) {
    return "Choose a valid tier.";
  }
  if (!Number.isInteger(jerseyId) || jerseyId <= 0) {
    return "Choose a jersey.";
  }
  if (!Number.isInteger(positionId) || positionId <= 0) {
    return "Choose your position.";
  }
  return null;
}
