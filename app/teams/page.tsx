import Link from "next/link";
import { ChevronRightIcon, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

// Shape returned by PostgREST, so these stay snake_case.
type Team = {
  id: number;
  name: string;
  tier_id: number;
  tiers: { name: string } | null;
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, tier_id, tiers(name)")
    .order("tier_id")
    .order("name");

  // Already ordered by tier, so a section break is just a change of tier_id.
  const tierSections: { key: number; label: string; teams: Team[] }[] = [];
  for (const team of (teams as Team[] | null) ?? []) {
    const section = tierSections.at(-1);
    if (section?.key === team.tier_id) {
      section.teams.push(team);
    } else {
      tierSections.push({
        key: team.tier_id,
        label: team.tiers?.name ?? "",
        teams: [team],
      });
    }
  }

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
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="group/team transition-colors hover:bg-muted/50">
                    <CardHeader className="flex flex-row items-center gap-3">
                      {/* Placeholder until teams can upload a logo. */}
                      <div
                        aria-hidden
                        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      >
                        <ImageIcon className="size-5" />
                      </div>
                      <CardTitle>{team.name}</CardTitle>
                      <ChevronRightIcon
                        aria-hidden
                        className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover/team:translate-x-0.5"
                      />
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
