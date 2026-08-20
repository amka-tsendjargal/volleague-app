"use server";

import { redirect } from "next/navigation";
import { JOIN_CODE_LENGTH } from "@/lib/constants";
import { readTrimmed } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";

export type JoinTeamState = { error?: string };

export type CodeLookup =
  | { teamId: number; teamName: string }
  | { error: string };

// Codes are stored lowercase, so entry is case-insensitive.
function normalizeCode(rawCode: string): string {
  return rawCode.trim().toLowerCase();
}

/**
 * Resolves a join code to the team it belongs to.
 *
 * Backs step 1 of the form, so the player sees which team they are about to
 * join before picking a position — and a typo fails there rather than after
 * filling in the whole thing.
 */
export async function checkJoinCode(rawCode: string): Promise<CodeLookup> {
  const code = normalizeCode(rawCode);

  if (code.length !== JOIN_CODE_LENGTH) {
    return { error: `A join code is ${JOIN_CODE_LENGTH} characters.` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("join_code", code)
    .maybeSingle();

  // A failed query also returns no data, so check the error first —
  // otherwise Supabase being unreachable would read as a bad code.
  if (error) {
    return { error: "Could not check that code. Please try again." };
  }

  if (!data) {
    return { error: "That code doesn't match a team." };
  }

  return { teamId: data.id, teamName: data.name };
}

export async function joinTeam(
  _prevState: JoinTeamState,
  formData: FormData
): Promise<JoinTeamState> {
  const code = readTrimmed(formData, "code");
  const positionId = Number(formData.get("positionId"));

  // position_id is a foreign key, so the database rejects anything that
  // isn't a real row. This only catches an empty or garbled selection
  // before the round trip.
  if (!Number.isInteger(positionId) || positionId <= 0) {
    return { error: "Choose your position." };
  }

  const supabase = await createClient();

  // The page already redirects signed-out visitors, so this only catches a
  // session that expired between loading the form and submitting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to join a team." };
  }

  // Step 2 carries the code rather than the team id, so which team gets
  // joined is always resolved here instead of taken from the client.
  const lookup = await checkJoinCode(code);
  if ("error" in lookup) {
    return { error: lookup.error };
  }

  // The insert policy enforces this too; asking first is what turns a bare
  // "row violates row-level security" into something worth reading.
  const { data: rosterOpen } = await supabase.rpc("roster_open", {
    target_team_id: lookup.teamId,
  });

  if (!rosterOpen) {
    return { error: "This team is no longer taking players." };
  }

  // is_approved: false is not a default the client could talk us out of —
  // the "player requests to join" policy rejects the row without it, so a
  // direct POST can't skip the captain's approval.
  const { error } = await supabase.from("team_users").insert({
    user_id: user.id,
    team_id: lookup.teamId,
    position_id: positionId,
    is_approved: false,
  });

  if (error) {
    // unique (team_id, user_id) — they are already on the roster, or their
    // last request is still waiting on the captain.
    if (error.code === "23505") {
      return { error: "You have already asked to join this team." };
    }
    return { error: "Could not send your request. Please try again." };
  }

  redirect(`/teams/${lookup.teamId}`);
}
