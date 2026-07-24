"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SEED_CAPTAIN_ID,
  TEAM_TIERS,
  MIN_TEAM_NAME_LENGTH,
  TEAM_NAME_PATTERN,
} from "@/lib/constants";

export type CreateTeamState = {
  error?: string;
  success?: boolean;
  teamName?: string;
};

const validTiers = new Set<number>(TEAM_TIERS.map((tier) => tier.value));

export type NameAvailability = { available: boolean } | { error: string };

function getNameLengthError(name: string): string | null {
  if (name.length < MIN_TEAM_NAME_LENGTH) {
    return `Team name must be at least ${MIN_TEAM_NAME_LENGTH} characters.`;
  }
  return null;
}

function validateTeamInput(
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

// TODO: Only check for uniqueness within the same season, update function and add uniqueness constraint in db
//
// Only checks length, not TEAM_NAME_PATTERN — character validity is shown
// live on the client as the user types, so it's not worth a round trip here.
// createTeam still enforces the pattern server-side before insert.
export async function checkTeamNameAvailability(
  rawName: string
): Promise<NameAvailability> {
  const name = rawName.trim();

  const nameLengthError = getNameLengthError(name);
  if (nameLengthError) {
    return { error: nameLengthError };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (error) {
    return { error: "Could not check availability. Please try again." };
  }

  return { available: !data };
}

export async function createTeam(
  _prevState: CreateTeamState,
  formData: FormData
): Promise<CreateTeamState> {
  const name = String(formData.get("name") ?? "").trim();
  const tier = Number(formData.get("tier"));
  const jerseyId = Number(formData.get("jerseyId"));
  const positionId = Number(formData.get("positionId"));

  const validationError = validateTeamInput(name, tier, jerseyId, positionId);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = createAdminClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ name, tier, jersey_id: jerseyId })
    .select("id")
    .single();

  if (teamError || !team) {
    return { error: "Could not create the team. Please try again." };
  }

  const { error: teamUserError } = await supabase.from("team_users").insert({
    user_id: SEED_CAPTAIN_ID,
    team_id: team.id,
    position_id: positionId,
    is_captain: true,
  });

  if (teamUserError) {
    // No cross-table transaction over PostgREST, so clean up best-effort.
    await supabase.from("teams").delete().eq("id", team.id);
    return { error: "Could not add you to the team. Please try again." };
  }

  revalidatePath("/");

  return { success: true, teamName: name };
}
