import Link from "next/link";
import { differenceInCalendarDays, format, subWeeks } from "date-fns";
import { SquarePenIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SeasonStatusMenu } from "./season-status-menu";
import { GenerateScheduleButton } from "./generate-schedule-button";

// Shape returned by PostgREST, so these stay snake_case.
type Season = {
  id: number;
  name: string;
  status: string;
  // Every week, not a count: the row total is the week count, and the earliest
  // match_time is the start date the registration deadline hangs off.
  season_weeks: { match_time: string }[];
  season_tiers: {
    tier_id: number;
    max_teams: number;
    tiers: { name: string } | null;
  }[];
  // One row per team; grouped by tier_id below for the per-tier counts.
  teams: { tier_id: number }[];
};

// The `seasons.status` values, as a captain-facing word plus the colour that
// word carries. Only registration gets an accent — the rest are states nobody
// needs to act on. `complete` is here to be displayed, never to be set: the
// card derives it from the last week having passed.
const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  registration: {
    label: "Open",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  scheduled: { label: "Scheduled", className: "bg-muted text-muted-foreground" },
  complete: { label: "Complete", className: "bg-muted text-muted-foreground" },
};

// Tiers are rows, not an enum, so a tier we have no colour for still has to
// render — it falls back to the neutral pill.
const TIER_PILLS: Record<string, string> = {
  Competitive: "bg-rose-100 text-rose-900",
  Intermediate: "bg-emerald-100 text-emerald-900",
};

export default async function AdminSeasonsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("seasons")
    .select(
      "id, name, status, season_weeks(match_time), season_tiers(tier_id, max_teams, tiers(name)), teams(tier_id)"
    )
    .order("id", { ascending: false })
    .order("match_time", { referencedTable: "season_weeks" });

  const seasons = (data as unknown as Season[] | null) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Seasons</h1>
        <Link
          href="/admin/seasons/new"
          // border-border is near-invisible on a light page background, so use
          // the mid-gray ring colour, which reads in both themes.
          className={cn(buttonVariants({ variant: "outline" }), "border-ring")}
        >
          Create a season
        </Link>
      </div>

      {seasons.length === 0 && (
        <p className="text-muted-foreground">No seasons yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {seasons.map((season) => {
          // One entry per tier the season offers, in tier order, with its
          // current sign-up count against the cap — shown even at zero.
          const tierCounts = [...season.season_tiers]
            .sort((a, b) => a.tier_id - b.tier_id)
            .map((seasonTier) => ({
              name: seasonTier.tiers?.name ?? "Unknown",
              max: seasonTier.max_teams,
              count: season.teams.filter(
                (team) => team.tier_id === seasonTier.tier_id
              ).length,
            }));

          // Registration closes a week before the first match. Derived, not
          // stored — weeks are ordered above, so [0] is the season start.
          // Calendar days, not elapsed 24h blocks: a deadline tomorrow morning
          // is "1 day left" however late in today the page is rendered.
          const firstMatch = season.season_weeks[0]?.match_time;
          const closesAt = firstMatch
            ? subWeeks(new Date(firstMatch), 1)
            : null;
          const daysLeft = closesAt
            ? differenceInCalendarDays(closesAt, new Date())
            : 0;

          // Nobody marks a season finished — it is finished once its last
          // week has been played.
          const lastMatch = season.season_weeks.at(-1)?.match_time;
          const isComplete = lastMatch
            ? new Date(lastMatch) < new Date()
            : false;

          const badge = STATUS_BADGES[isComplete ? "complete" : season.status] ?? {
            label: season.status,
            className: "bg-muted text-muted-foreground",
          };

          return (
            <li key={season.id} className="rounded-xl border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold">{season.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {season.season_weeks.length} weeks ·{" "}
                    {season.season_tiers.length} tiers
                  </p>

                  {closesAt && (
                    <span className="mt-1 w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      reg closes {format(closesAt, "MMM d")} ·{" "}
                      {daysLeft > 0 ? `${daysLeft} days left` : "closed"}
                    </span>
                  )}
                </div>

                {/* Edit is a placeholder for now — a season can only be
                    edited while it is still a draft. */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Edit season"
                    disabled={season.status !== "draft"}
                  >
                    <SquarePenIcon />
                  </Button>
                  {/* A draft season has no teams yet — registration has to
                      open before anyone can create one — so there is
                      nothing to pair up. */}
                  <GenerateScheduleButton
                    seasonId={season.id}
                    seasonName={season.name}
                    disabled={season.status === "draft"}
                  />
                  <SeasonStatusMenu
                    seasonId={season.id}
                    status={season.status}
                  />
                </div>
              </div>

              {tierCounts.length > 0 && (
                <ul className="mt-5 flex flex-col gap-3 border-t pt-5">
                  {tierCounts.map((tier) => (
                    <li key={tier.name} className="flex items-center gap-4">
                      <span
                        className={cn(
                          "w-28 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium",
                          TIER_PILLS[tier.name] ?? "bg-muted text-foreground"
                        )}
                      >
                        {tier.name}
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (tier.count / tier.max) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {tier.count} / {tier.max}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
