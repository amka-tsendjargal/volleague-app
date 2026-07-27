import { createAdminClient } from "@/lib/supabase/admin";
import { CreateTeamForm } from "./create-team-form";

export default async function NewTeamPage() {
  const supabase = createAdminClient();

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
