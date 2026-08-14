"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The statuses an admin may set. Narrower than the seasons_status_valid
// check constraint on purpose — `complete` is derived from the last week
// having passed, so nothing should be writing it here.
const VALID_STATUSES = ["draft", "registration", "scheduled"];

export async function setSeasonStatus(seasonId: number, status: string) {
  if (!VALID_STATUSES.includes(status)) return;

  const supabase = await createClient();

  // The layout already redirects non-admins; this catches a direct POST.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return;
  }

  await supabase.from("seasons").update({ status }).eq("id", seasonId);

  revalidatePath("/admin/seasons");
}

// The button only shows for seasons with no teams, and teams_season_tier_offered
// is RESTRICT, so this can't take real data even via a direct POST — a season
// with teams just errors and nothing is deleted.
export async function deleteSeason(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return;

  await supabase.from("seasons").delete().eq("id", seasonId);

  revalidatePath("/admin/seasons");
}