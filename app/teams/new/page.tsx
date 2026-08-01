import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateTeamForm } from "./create-team-form";

export default async function NewTeamPage() {
  const supabase = await createClient();

  // Creating a team makes you its captain, so there has to be a "you".
  // createTeam re-checks; this just keeps signed-out visitors from filling
  // in the whole form only to be turned away on submit.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: jerseys }, { data: positions }] = await Promise.all([
    supabase.from("jerseys").select("id, kit_name").order("kit_name"),
    supabase.from("positions").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <CreateTeamForm jerseys={jerseys ?? []} positions={positions ?? []} />
    </div>
  );
}
