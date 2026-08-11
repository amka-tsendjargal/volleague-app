"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The `status = draft` filter is the transition guard: it makes opening
// registration a single atomic statement, so a season can't be reopened
// once it's scheduled, and two admins clicking at once is harmless.
export async function openRegistration(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const supabase = await createClient();

  // The layout already redirects non-admins; this catches a direct POST.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return;
  }

  await supabase
    .from("seasons")
    .update({ status: "registration" })
    .eq("id", seasonId)
    .eq("status", "draft");

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