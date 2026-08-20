import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinTeamForm } from "./join-team-form";

export default async function JoinTeamPage() {
  const supabase = await createClient();

  // Joining puts you on a roster, so there has to be a "you". joinTeam
  // re-checks; this just keeps signed-out visitors from filling in the form
  // only to be turned away on submit.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/teams/join")}`);
  }

  const { data: positions } = await supabase
    .from("positions")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <JoinTeamForm positions={positions ?? []} />
    </div>
  );
}
