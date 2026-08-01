import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TEAM_TIERS } from "@/lib/constants";

// Shape returned by PostgREST, so these stay snake_case.
type TeamUserRow = {
  id: number;
  is_captain: boolean;
  users: { first_name: string; last_name: string } | null;
  positions: { name: string } | null;
};

export default async function TeamDetailsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const id = Number(teamId);

  // teams.id is an integer, so anything else can't match a row.
  if (!Number.isInteger(id)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, tier")
    .eq("id", id)
    .maybeSingle();

  if (!team) {
    notFound();
  }

  const { data: roster } = await supabase
    .from("team_users")
    .select("id, is_captain, users(first_name, last_name), positions(name)")
    .eq("team_id", team.id);

  const players = ((roster as TeamUserRow[] | null) ?? [])
    .map((row) => ({
      id: row.id,
      name: row.users
        ? `${row.users.first_name} ${row.users.last_name}`
        : "Unknown player",
      position: row.positions?.name ?? null,
      isCaptain: row.is_captain,
    }))
    .sort((playerA, playerB) => playerA.name.localeCompare(playerB.name));

  const tierLabel = TEAM_TIERS.find((tier) => tier.value === team.tier)?.label;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/teams"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← All teams
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {team.name}
          </h1>
          {tierLabel && (
            <p className="text-sm text-muted-foreground">{tierLabel}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Players
          </h2>

          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm ring-1 ring-foreground/10"
                >
                  <span className="text-card-foreground">
                    {player.name}
                    {player.isCaptain && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Captain
                      </span>
                    )}
                  </span>
                  {player.position && (
                    <span className="text-muted-foreground">
                      {player.position}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}