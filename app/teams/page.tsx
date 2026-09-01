import Link from "next/link";
import { ChevronRightIcon, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shape returned by PostgREST, so these stay snake_case.
type Team = {
  id: number;
  name: string;
  tier_id: number;
  tiers: { name: string } | null;
};

export default async function TeamsPage() {
  const supabase = await createClient();

  // The page is public, so a signed-out visitor just skips the membership read.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: teams }, { data: memberships }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, tier_id, tiers(name)")
      .order("tier_id")
      .order("name"),
    user
      ? supabase
          .from("team_users")
          .select("team_id, is_approved")
          .eq("user_id", user.id)
      : Promise.resolve({ data: null }),
  ]);

  // team_id -> is_approved. Absent means the team isn't yours. RLS lets you read
  // your own row while it's still pending, which is how "Request pending" shows.
  const myTeams = new Map(
    (memberships ?? []).map((membership) => [
      membership.team_id,
      membership.is_approved,
    ]),
  );

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
              {section.teams.map((team) => {
                const membership = myTeams.get(team.id);
                return (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Card
                      className={cn(
                        "group/team transition-colors hover:bg-muted/50",
                        membership === true &&
                          "border-sky-500/60 bg-sky-500/10 hover:bg-sky-500/15 dark:border-sky-400/60 dark:bg-sky-400/10 dark:hover:bg-sky-400/15",
                      )}
                    >
                      <CardHeader className="flex flex-row items-center gap-3">
                        {/* Placeholder until teams can upload a logo. */}
                        <div
                          aria-hidden
                          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                        >
                          <ImageIcon className="size-5" />
                        </div>
                        <CardTitle>{team.name}</CardTitle>
                        {membership === true && (
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">
                            Your team
                          </span>
                        )}
                        {membership === false && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Request pending
                          </span>
                        )}
                        <ChevronRightIcon
                          aria-hidden
                          className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover/team:translate-x-0.5"
                        />
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
