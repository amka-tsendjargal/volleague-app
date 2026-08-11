"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getNameLengthError, validateTeamInput } from "./validation";

export type CreateTeamState = {
  error?: string;
  success?: boolean;
  teamName?: string;
};

export type NameAvailability = { available: boolean } | { error: string };

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

  const supabase = await createClient();

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
  const seasonId = Number(formData.get("seasonId"));
  const tierId = Number(formData.get("tierId"));
  const jerseyId = Number(formData.get("jerseyId"));
  const positionId = Number(formData.get("positionId"));

  const validationError = validateTeamInput(
    name,
    seasonId,
    tierId,
    jerseyId,
    positionId
  );
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();

  // The page already redirects signed-out visitors, so this only catches a
  // session that expired between loading the form and submitting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a team." };
  }

  // Inserting the team and its captain row are one transaction inside
  // create_team_with_captain (see supabase/migrations) — PostgREST gives
  // each request its own transaction, so doing the two inserts from here
  // would leave an orphaned team behind whenever the second one failed.
  // The captain is taken from the session inside the function, not passed.
  const { error } = await supabase.rpc("create_team_with_captain", {
    team_name: name,
    team_season_id: seasonId,
    team_tier_id: tierId,
    team_jersey_id: jerseyId,
    team_position_id: positionId,
  });

  if (error) {
    // The form only offers open seasons and tiers they run, so these mean
    // the season filled or closed while the page was sitting open — worth
    // saying plainly rather than as a generic failure.
    if (error.code === "23514") {
      return { error: "That tier just filled up. Try another tier." };
    }
    if (error.code === "55000") {
      return { error: "That season is no longer open for registration." };
    }
    return { error: "Could not create the team. Please try again." };
  }

  revalidatePath("/");

  return { success: true, teamName: name };
}
