import Link from "next/link";
import { ArrowUpRightIcon, ChartColumnIcon, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

// Shape returned by PostgREST, so these stay snake_case.
type OpenSeason = {
  id: number;
  name: string;
  season_weeks: { count: number }[];
  season_tiers: {
    tier_id: number;
    max_teams: number;
    tiers: { name: string } | null;
  }[];
  // One row per team, not a count: spots left is per tier, so these get
  // grouped by tier_id below.
  teams: { tier_id: number }[];
};

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {data: isAdmin } = await supabase.rpc("is_admin");

  // Seasons taking registrations get a banner each, with a row per tier that
  // still has room.
  const { data: seasonRows } = await supabase
    .from("seasons")
    .select(
      "id, name, season_weeks(count), season_tiers(tier_id, max_teams, tiers(name)), teams(tier_id)"
    )
    .eq("status", "registration")
    .order("id");

  const openSeasons = ((seasonRows as unknown as OpenSeason[] | null) ?? [])
    .map((season) => ({
      id: season.id,
      name: season.name,
      weeks: season.season_weeks[0]?.count ?? 0,
      tiers: [...season.season_tiers]
        .sort((a, b) => a.tier_id - b.tier_id)
        .map((seasonTier) => ({
          id: seasonTier.tier_id,
          name: seasonTier.tiers?.name ?? "Unknown",
          spotsLeft:
            seasonTier.max_teams -
            season.teams.filter((team) => team.tier_id === seasonTier.tier_id)
              .length,
        }))
        // A full tier has nothing to offer, so it drops off the banner.
        .filter((tier) => tier.spotsLeft > 0),
    }))
    .filter((season) => season.tiers.length > 0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Volleague
      </h1>

      {openSeasons.map((season) => (
        <div
          key={season.id}
          className="flex w-full max-w-3xl flex-col items-start gap-4 rounded-2xl border bg-background p-8 text-left"
        >
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Registration open
          </span>

          <div className="flex flex-col gap-2">
            <p className="text-2xl font-semibold tracking-tight">
              {season.name} is open
            </p>
            <p className="text-muted-foreground">
              {season.weeks} weeks of officiated play. Every game filmed, every
              stat tracked, every player featured.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <VideoIcon className="size-4" />
              Filmed highlights
            </span>
            <span>Ref every game</span>
            <span className="flex items-center gap-1.5">
              <ChartColumnIcon className="size-4" />
              Live stats
            </span>
          </div>

          {/* Each tier registers separately, so each gets its own count and
              its own link — the form opens with that tier already chosen. */}
          <ul className="flex w-full flex-col gap-2">
            {season.tiers.map((tier) => (
              <li
                key={tier.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-muted px-5 py-4"
              >
                <p className="font-semibold">
                  {tier.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {tier.spotsLeft} spots left
                  </span>
                </p>

                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/teams/new?seasonId=${season.id}&tierId=${tier.id}`}
                    >
                      Register
                      <ArrowUpRightIcon />
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/teams/new">Create a Team</Link>}
        />
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/teams">View Teams</Link>}
        />
        {isAdmin && (
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={"/admin/seasons"}>Seasons</Link>}
          />
        )}
        {/* Signing in and signing out both live in the header once you have a
            session, so these are only worth offering to signed-out visitors. */}
        {!user && (
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/login">Log In</Link>}
            />
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/signup">Sign Up</Link>}
            />
          </>
        )}
      </div>
    </div>
  );
}
