import { createClient } from "@/lib/supabase/server";
import { TEAM_TIERS } from "@/lib/constants";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Team = {
  id: number;
  name: string;
  tier: number;
  jerseys: { kit_name: string } | null;
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, tier, jerseys(kit_name)")
    .order("name");

  const allTeams = (teams as Team[] | null) ?? [];
  const tierSections = TEAM_TIERS.map((tier) => ({
    key: tier.value,
    label: tier.label,
    teams: allTeams.filter((team) => team.tier === tier.value),
  })).filter((section) => section.teams.length > 0);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Teams
        </h1>

        {tierSections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No teams have been created yet.
          </p>
        )}

        {tierSections.map((section) => (
          <div key={section.key} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              {section.label}
            </h2>
            <div className="flex flex-col gap-3">
              {section.teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <CardTitle>{team.name}</CardTitle>
                    {team.jerseys?.kit_name && (
                      <CardDescription>{team.jerseys.kit_name}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
