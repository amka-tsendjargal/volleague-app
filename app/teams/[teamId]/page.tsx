import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { approveMember, declineMember } from "./actions";
import { CopyButton } from "./copy-button";

// Shapes returned by PostgREST, so these stay snake_case.
type TeamRow = {
  id: number;
  name: string;
  join_code: string;
  tiers: { name: string } | null;
};

type TeamUserRow = {
  id: number;
  user_id: string | null;
  is_captain: boolean;
  is_approved: boolean;
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

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, join_code, tiers(name)")
    .eq("id", id)
    .maybeSingle();

  // A failed query also returns no data, so check the error first — otherwise
  // Supabase being unreachable would render as "this team doesn't exist".
  if (teamError) {
    throw new Error(`Failed to load team ${id}`, { cause: teamError });
  }

  // No error and no row means the team really isn't there (or RLS hides it,
  // which should look the same to the caller).
  if (!team) {
    notFound();
  }

  // Who is looking decides whether the join code and the pending queue are
  // rendered at all, so it is fetched alongside the roster rather than after.
  const [
    { data: roster, error: rosterError },
    {
      data: { user },
    },
    { data: isAdmin },
  ] = await Promise.all([
    supabase
      .from("team_users")
      .select(
        "id, user_id, is_captain, is_approved, users(first_name, last_name), positions(name)"
      )
      .eq("team_id", team.id),
    supabase.auth.getUser(),
    supabase.rpc("is_admin"),
  ]);

  if (rosterError) {
    throw new Error(`Failed to load the roster for team ${id}`, {
      cause: rosterError,
    });
  }

  // PostgREST returns a single object for a many-to-one embed; supabase-js
  // infers an array without generated database types.
  const members = (roster as unknown as TeamUserRow[])
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.users
        ? `${row.users.first_name} ${row.users.last_name}`
        : "Unknown player",
      position: row.positions?.name ?? null,
      isCaptain: row.is_captain,
      isApproved: row.is_approved,
    }))
    .sort((playerA, playerB) => playerA.name.localeCompare(playerB.name));

  // Sharing the code and acting on a request are both captain/admin business.
  const canManage =
    Boolean(isAdmin) ||
    members.some((member) => member.userId === user?.id && member.isCaptain);

  const players = members.filter((member) => member.isApproved);
  // No filtering by viewer here: the read policy on team_users only returns
  // an unapproved row to the player who asked, the captain, and admins, so
  // anything that arrives is already meant for whoever is looking.
  const pendingPlayers = members.filter((member) => !member.isApproved);

  // PostgREST returns a single object for a many-to-one embed; supabase-js
  // infers an array without generated database types.
  const tierName = (team as unknown as TeamRow).tiers?.name;

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
          {tierName && (
            <p className="text-sm text-muted-foreground">{tierName}</p>
          )}
        </div>

        {canManage && (
          <div className="flex flex-col gap-2 rounded-lg bg-card px-4 py-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium text-card-foreground">
              Invite players
            </h2>
            <p className="text-sm text-muted-foreground">
              Share this code. Players enter it under &ldquo;Join a Team&rdquo;
              and land here for you to approve.
            </p>
            {/* Stored lowercase; uppercase is just easier to read out loud,
                and the lookup lowercases whatever gets pasted back in. */}
            <div className="flex items-center gap-1">
              <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg tracking-[0.2em] text-foreground">
                {team.join_code.toUpperCase()}
              </code>
              <CopyButton
                value={team.join_code.toUpperCase()}
                label="Join code"
              />
            </div>
          </div>
        )}

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

        {pendingPlayers.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              {canManage ? "Pending requests" : "Your request"}
            </h2>
            {!canManage && (
              <p className="text-sm text-muted-foreground">
                You are on this team once the captain approves you.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {pendingPlayers.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm ring-1 ring-foreground/10"
                >
                  <span className="text-card-foreground">
                    {player.name}
                    {player.position && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {player.position}
                      </span>
                    )}
                  </span>

                  {/* Plain forms rather than a client component — the row id
                      is all either action needs, and RLS is what decides
                      whether the write lands. A player looking at their own
                      request gets the status instead of the controls. */}
                  {canManage ? (
                    <div className="flex shrink-0 gap-2">
                      <form action={approveMember}>
                        <input
                          type="hidden"
                          name="teamUserId"
                          value={player.id}
                        />
                        <input type="hidden" name="teamId" value={team.id} />
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                      <form action={declineMember}>
                        <input
                          type="hidden"
                          name="teamUserId"
                          value={player.id}
                        />
                        <input type="hidden" name="teamId" value={team.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Decline
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <span className="shrink-0 text-muted-foreground">
                      Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
