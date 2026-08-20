"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Neither of these checks who is calling, on purpose. Server Actions are
// reachable by direct POST, so the guarantee has to live in the database
// anyway — and it does: "captain approves pending players" limits the
// update to a pending row on a team you captain, and "admin or captain
// remove players" limits the delete the same way. A stranger POSTing here
// changes no rows.

export async function approveMember(formData: FormData) {
  const teamUserId = Number(formData.get("teamUserId"));
  const teamId = Number(formData.get("teamId"));

  const supabase = await createClient();

  await supabase
    .from("team_users")
    .update({ is_approved: true })
    .eq("id", teamUserId);

  revalidatePath(`/teams/${teamId}`);
}

export async function declineMember(formData: FormData) {
  const teamUserId = Number(formData.get("teamUserId"));
  const teamId = Number(formData.get("teamId"));

  const supabase = await createClient();

  await supabase.from("team_users").delete().eq("id", teamUserId);

  revalidatePath(`/teams/${teamId}`);
}
