import { createClient } from "@/lib/supabase/server";
import { CreateSeasonForm } from "./create-season-form";

export default async function NewSeasonPage() {
  const supabase = await createClient();

  const { data: tiers } = await supabase
    .from("tiers")
    .select("id, name")
    .order("id");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <CreateSeasonForm tiers={tiers ?? []} />
    </div>
  );
}