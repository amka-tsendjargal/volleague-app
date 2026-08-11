import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateTeamForm } from "./create-team-form";

// Shape returned by PostgREST, so these stay snake_case.
type SeasonRow = {
  id: number;
  name: string;
  season_tiers: { tier_id: number; tiers: { name: string } | null }[];
};

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

  // Only seasons taking registrations, and only the tiers each one runs —
  // so the form can't offer a combination the database would reject.
  const [{ data: seasons }, { data: jerseys }, { data: positions }] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("id, name, season_tiers(tier_id, tiers(name))")
        .eq("status", "registration")
        .order("id"),
      supabase.from("jerseys").select("id, kit_name").order("kit_name"),
      supabase.from("positions").select("id, name").order("name"),
    ]);

  const openSeasons = ((seasons as SeasonRow[] | null) ?? []).map((season) => ({
    id: season.id,
    name: season.name,
    tiers: season.season_tiers
      .map((seasonTier) => ({
        id: seasonTier.tier_id,
        name: seasonTier.tiers?.name ?? "",
      }))
      .sort((tierA, tierB) => tierA.id - tierB.id),
  }));

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      {openSeasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No season is taking registrations right now.
        </p>
      ) : (
        <CreateTeamForm
          seasons={openSeasons}
          jerseys={jerseys ?? []}
          positions={positions ?? []}
        />
      )}
    </div>
  );
}