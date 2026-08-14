"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  firstPlayoffWeek,
  validateSeasonInput,
  type TierCap,
} from "./validation";

export type CreateSeasonState = {
  error?: string;
  success?: boolean;
  seasonName?: string;
};

function parseJsonArray<T>(raw: FormDataEntryValue | null): T[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? ""));
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export async function createSeason(
  _prevState: CreateSeasonState,
  formData: FormData
): Promise<CreateSeasonState> {
  const name = String(formData.get("name") ?? "").trim();
  const playoffWeeks = Number(formData.get("playoffWeeks"));

  // Both arrive as JSON from hidden inputs: week times so the client can
  // convert them to absolute timestamps in the admin's timezone, tier caps
  // because they're a variable-length list of pairs. Dates the admin
  // skipped are already gone from weekTimes.
  const weekTimes = parseJsonArray<string>(formData.get("weekTimes"));
  const tierCaps = parseJsonArray<TierCap>(formData.get("tierCaps"));

  if (!weekTimes || !tierCaps) {
    return { error: "Could not read the season details. Please try again." };
  }

  const validationError = validateSeasonInput(
    name,
    weekTimes,
    playoffWeeks,
    tierCaps
  );
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();

  // The layout already redirects non-admins; this catches a direct POST,
  // which Server Actions are reachable by.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  console.log(isAdmin);
  if (!isAdmin) {
    return { error: "Only an admin can create a season." };
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .insert({ name })
    .select("id")
    .single();

  if (seasonError) {
    return {
      error:
        seasonError.code === "23505"
          ? "A season with that name already exists."
          : "Could not create the season. Please try again.",
    };
  }

  // PostgREST commits each request separately, so a failure below leaves a
  // season with no weeks or no tiers. Deleting it cascades both away — safe
  // to do from the app because admins already hold delete on seasons.
  const discardSeason = async (): Promise<CreateSeasonState> => {
    await supabase.from("seasons").delete().eq("id", season.id);
    return { error: "Could not create the season. Please try again." };
  };

  const playoffsStart = firstPlayoffWeek(weekTimes.length, playoffWeeks);

  const { error: weeksError } = await supabase.from("season_weeks").insert(
    weekTimes.map((matchTime, index) => ({
      season_id: season.id,
      week_number: index + 1,
      match_time: matchTime,
      is_playoff: index + 1 >= playoffsStart,
    }))
  );
  if (weeksError) {
    return discardSeason();
  }

  const { error: tiersError } = await supabase.from("season_tiers").insert(
    tierCaps.map((tierCap) => ({
      season_id: season.id,
      tier_id: tierCap.tierId,
      max_teams: tierCap.maxTeams,
    }))
  );
  if (tiersError) {
    return discardSeason();
  }

  revalidatePath("/admin/seasons");

  return { success: true, seasonName: name };
}