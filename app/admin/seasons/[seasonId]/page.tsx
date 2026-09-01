import Link from "next/link";
import { notFound } from "next/navigation";
import { format, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MIN_PLAYERS_PER_TEAM } from "@/lib/constants";
import { statusBadge, TIER_PILLS } from "../badges";
import { computeStandings, matchResult } from "../standings";
import { GenerateScheduleButton } from "../generate-schedule-button";
import { PublishButton } from "../publish-button";
import { deleteSeason, setSeasonStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { SeasonTabs } from "./season-tabs";

// Shapes returned by PostgREST, so these stay snake_case.
type SeasonRow = {
  id: number;
  name: string;
  status: string;
  court_numbers: number[];
};

type WeekRow = {
  id: number;
  week_number: number;
  match_time: string;
  is_playoff: boolean;
  schedules: {
    id: number;
    court_number: number | null;
    team_a_id: number | null;
    team_b_id: number | null;
    sets: { team_a_score: number; team_b_score: number }[];
  }[];
};

type TeamRow = {
  id: number;
  name: string;
  tier_id: number;
  created_at: string;
  tiers: { name: string } | null;
  team_users: {
    is_approved: boolean;
    is_captain: boolean;
    users: { first_name: string; last_name: string } | null;
  }[];
};

type SeasonTierRow = {
  tier_id: number;
  max_teams: number;
  tiers: { name: string } | null;
};

// The wireframe's small grey section headings.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

/**
 * A tab's card: heading and actions across the top, one scrolling body,
 * and optional notes pinned above and below it. The border wraps them all,
 * so the buttons read as part of the panel rather than floating above it.
 */
function Panel({
  title,
  actions,
  notice,
  footer,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  notice?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // Fills the tab panel on desktop via flex rather than height:100%,
    // which would resolve to auto whenever the parent's height isn't
    // definite. On narrow screens it takes its natural height instead.
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <SectionLabel>{title}</SectionLabel>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {/* Outside the scrolling body on purpose: a notice that scrolls away
          with the first few rows is a notice nobody reads. */}
      {notice && <div className="shrink-0 px-4 pb-3">{notice}</div>}
      <div className="flex flex-col overflow-auto lg:min-h-0 lg:flex-1">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

function SidebarCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

// Shared by both tables so the columns line up with the panel padding.
const TH = "px-4 py-2.5 text-left text-[11px] font-semibold tracking-wider uppercase";
const TD = "px-4 py-3";

// A captain's surname reads better than their full name in a narrow
// column, but the initial is what makes two Chens distinguishable.
function captainName(team: TeamRow): string {
  const captain = team.team_users.find(
    (member) => member.is_captain && member.is_approved
  );
  if (!captain?.users) {
    return "—";
  }
  return `${captain.users.first_name.charAt(0)}. ${captain.users.last_name}`;
}

export default async function SeasonDetailsPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const id = Number(seasonId);

  // seasons.id is an integer, so anything else can't match a row.
  if (!Number.isInteger(id)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name, status, court_numbers")
    .eq("id", id)
    .maybeSingle();

  // A failed query also returns no data, so check the error first — otherwise
  // Supabase being unreachable would render as "this season doesn't exist".
  if (seasonError) {
    throw new Error(`Failed to load season ${id}`, { cause: seasonError });
  }

  if (!season) {
    notFound();
  }

  const [
    { data: weekRows, error: weeksError },
    { data: teamRows, error: teamsError },
    { data: tierRows },
  ] = await Promise.all([
    // schedules hangs off the week, not the season — the fixture has no
    // season_id and no time of its own.
    supabase
      .from("season_weeks")
      .select(
        "id, week_number, match_time, is_playoff, schedules(id, court_number, team_a_id, team_b_id, sets(team_a_score, team_b_score))"
      )
      .eq("season_id", id)
      .order("week_number"),
    supabase
      .from("teams")
      .select(
        "id, name, tier_id, created_at, tiers(name), team_users(is_approved, is_captain, users(first_name, last_name))"
      )
      .eq("season_id", id)
      .order("id"),
    supabase
      .from("season_tiers")
      .select("tier_id, max_teams, tiers(name)")
      .eq("season_id", id),
  ]);

  if (weeksError) {
    throw new Error(`Failed to load the weeks for season ${id}`, {
      cause: weeksError,
    });
  }
  if (teamsError) {
    throw new Error(`Failed to load the teams for season ${id}`, {
      cause: teamsError,
    });
  }

  // PostgREST returns a single object for a many-to-one embed; supabase-js
  // infers an array without generated database types.
  const weeks = (weekRows as unknown as WeekRow[] | null) ?? [];
  const teams = (teamRows as unknown as TeamRow[] | null) ?? [];
  const seasonTiers = (tierRows as unknown as SeasonTierRow[] | null) ?? [];

  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  const rosters = teams.map((team) => {
    const approved = team.team_users.filter((member) => member.is_approved);
    const pending = team.team_users.length - approved.length;
    return {
      id: team.id,
      name: team.name,
      tierId: team.tier_id,
      tierName: team.tiers?.name ?? "Unknown",
      captain: captainName(team),
      registeredAt: team.created_at,
      playerCount: approved.length,
      pendingCount: pending,
      // The same rule generation uses, so this page explains its refusals.
      isConfirmed: approved.length >= MIN_PLAYERS_PER_TEAM,
    };
  });

  const fixtures = weeks.flatMap((week) =>
    week.schedules.map((fixture) => {
      const sets = fixture.sets.map((set) => ({
        teamAScore: set.team_a_score,
        teamBScore: set.team_b_score,
      }));
      return {
        id: fixture.id,
        weekNumber: week.week_number,
        matchTime: week.match_time,
        isPlayoff: week.is_playoff,
        courtNumber: fixture.court_number,
        teamAId: fixture.team_a_id,
        teamBId: fixture.team_b_id,
        sets,
        result: matchResult(sets),
      };
    })
  );

  const standings = computeStandings(
    fixtures
      .filter((fixture) => fixture.teamAId !== null && fixture.teamBId !== null)
      .map((fixture) => ({
        teamAId: fixture.teamAId as number,
        teamBId: fixture.teamBId as number,
        sets: fixture.sets,
      })),
    teams.map((team) => team.id)
  );

  const firstMatch = weeks[0]?.match_time;
  const lastMatch = weeks.at(-1)?.match_time;
  const now = new Date();

  const isComplete = lastMatch ? new Date(lastMatch) < now : false;
  const badge = statusBadge(isComplete ? "complete" : season.status);

  // Which week the season is on: the count of weeks already played.
  const weeksPlayed = weeks.filter(
    (week) => new Date(week.match_time) < now
  ).length;
  const currentWeek = Math.min(weeksPlayed + 1, weeks.length);

  const hasSchedule = fixtures.length > 0;
  const isPublished = season.status === "scheduled" || isComplete;
  // Same rule as generateSchedule: teams have to be settled before they can
  // be paired, and a published schedule can still be regenerated until a
  // score is recorded.
  const canGenerate =
    season.status === "closed" || season.status === "scheduled";

  // Only a nudge — tiers fill at different times and a cap can be raised, so
  // closing stays the admin's call rather than something the last sign-up
  // triggers by itself.
  const allTiersFull =
    seasonTiers.length > 0 &&
    seasonTiers.every(
      (seasonTier) =>
        rosters.filter((team) => team.tierId === seasonTier.tier_id).length >=
        seasonTier.max_teams
    );

  const courts = (season as SeasonRow).court_numbers;
  const courtsLabel =
    courts.length === 0
      ? "No courts set"
      : // 1,2,3,4 reads better as a range; 3,4,7 has to be listed.
        courts.length > 2 &&
          courts.every((court, index) => court === courts[0] + index)
        ? `Courts ${courts[0]}–${courts.at(-1)}`
        : `Court${courts.length > 1 ? "s" : ""} ${courts.join(", ")}`;

  const gameNight = firstMatch ? format(new Date(firstMatch), "EEEE") : null;
  const closesAt = firstMatch ? subWeeks(new Date(firstMatch), 1) : null;

  const scheduleActions = (
    <>
      <GenerateScheduleButton
        seasonId={season.id}
        seasonName={season.name}
        disabled={!canGenerate}
        label={hasSchedule ? "Regenerate" : "Generate schedule"}
      />
      {hasSchedule && !isPublished && (
        <PublishButton seasonId={season.id} seasonName={season.name} />
      )}
    </>
  );

  const schedulePanel = (
    <Panel
      title="Season schedule"
      actions={scheduleActions}
      // A draft schedule is admin-only in the database, not just here — the
      // read policy on schedules serves fixtures for scheduled and complete
      // seasons only. Amber is used nowhere else on this page, so this can't
      // be mistaken for the season's own status pill.
      notice={
        hasSchedule && !isPublished ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Draft schedule</span> — visible to
            admins only. Publish it to show players their matches.
          </p>
        ) : undefined
      }
      footer={
        hasSchedule && weeks.some((week) => week.is_playoff)
          ? "Playoff weeks aren't scheduled here — the bracket is seeded once the regular season finishes."
          : undefined
      }
    >
      {!hasSchedule ? (
        // 5a: nothing generated yet.
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="text-lg font-semibold">
            Season hasn&rsquo;t started yet
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {season.status === "draft"
              ? "Open registration so captains can enter teams, then generate the schedule."
              : season.status === "registration"
                ? "Close registration once every tier is full — the teams have to be settled before they can be paired up."
                : "Generate the schedule. You can regenerate it as often as you like until scores are recorded."}
          </p>
        </div>
      ) : (
        <table className="w-full min-w-160 text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-muted-foreground">
              <th className={cn(TH, "w-14")}>Wk</th>
              <th className={cn(TH, "w-24")}>Date</th>
              <th className={cn(TH, "w-20")}>Time</th>
              <th className={cn(TH, "w-16")}>Court</th>
              <th className={TH}>Team A</th>
              <th className={TH}>Team B</th>
              <th className={cn(TH, "w-20")}>Result</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => {
              const matchDate = new Date(fixture.matchTime);
              const isPast = matchDate < now;
              return (
                <tr
                  key={fixture.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/40",
                    // Played weeks recede; what is still to come stays at
                    // full contrast.
                    isPast && "text-muted-foreground"
                  )}
                >
                  <td className={TD}>
                    <span className="inline-flex size-6 items-center justify-center rounded-md bg-blue-500/10 text-xs font-bold text-blue-600 tabular-nums dark:text-blue-400">
                      {fixture.weekNumber}
                    </span>
                  </td>
                  <td className={TD}>{format(matchDate, "MMM d")}</td>
                  <td className={TD}>{format(matchDate, "h:mm a")}</td>
                  <td className={cn(TD, "tabular-nums")}>
                    {fixture.courtNumber ?? "—"}
                  </td>
                  <td className={cn(TD, "font-medium")}>
                    {teamNames.get(fixture.teamAId ?? -1) ?? "—"}
                  </td>
                  <td className={cn(TD, "font-medium")}>
                    {teamNames.get(fixture.teamBId ?? -1) ?? "—"}
                  </td>
                  <td className={cn(TD, "tabular-nums")}>
                    {fixture.result ? (
                      `${
                        fixture.result.teamASets > fixture.result.teamBSets
                          ? "W"
                          : "L"
                      } ${fixture.result.teamASets}-${fixture.result.teamBSets}`
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );

  const teamsPanel = (
    <Panel title="Teams signed up">
      {rosters.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <p className="text-sm text-muted-foreground">
            No teams have registered yet.
          </p>
        </div>
      ) : (
        <table className="w-full min-w-140 text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-muted-foreground">
              <th className={TH}>Team</th>
              <th className={cn(TH, "w-32")}>Tier</th>
              <th className={cn(TH, "w-32")}>Captain</th>
              <th className={cn(TH, "w-28")}>Players</th>
              <th className={cn(TH, "w-24")}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {rosters.map((team) => (
              <tr
                key={team.id}
                className="border-b last:border-b-0 hover:bg-muted/40"
              >
                <td className={cn(TD, "font-medium")}>
                  <Link href={`/teams/${team.id}`} className="hover:underline">
                    {team.name}
                  </Link>
                  {/* Why a team is missing from the fixtures. */}
                  {!team.isConfirmed && (
                    <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Not scheduled
                    </span>
                  )}
                </td>
                <td className={TD}>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      TIER_PILLS[team.tierName] ?? "bg-muted text-foreground"
                    )}
                  >
                    {team.tierName}
                  </span>
                </td>
                <td className={cn(TD, "text-muted-foreground")}>
                  {team.captain}
                </td>
                <td className={cn(TD, "tabular-nums")}>
                  {team.playerCount}/{MIN_PLAYERS_PER_TEAM}
                  {/* Pending rows are join requests, and they do not count
                      towards a schedulable team. */}
                  {team.pendingCount > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      +{team.pendingCount} pending
                    </span>
                  )}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>
                  {format(new Date(team.registeredAt), "MMM d")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );

  // Standings come from recorded set scores. Nothing in the app records
  // them yet, so this stays empty until the scores feature lands rather
  // than showing a fabricated table.
  const hasResults = standings.some(
    (standing) => standing.wins > 0 || standing.losses > 0
  );

  const standingsPanel = (
    <Panel title="Standings">
      {!hasResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
          <p className="font-semibold">No results recorded yet</p>
          <p className="text-sm text-muted-foreground">
            Standings will populate once week 1 results are entered.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-muted-foreground">
              <th className={cn(TH, "w-12")}>#</th>
              <th className={TH}>Team</th>
              <th className={cn(TH, "w-20")}>W-L</th>
              <th className={cn(TH, "w-24")}>Sets</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => (
              <tr
                key={standing.teamId}
                className="border-b last:border-b-0 hover:bg-muted/40"
              >
                <td className={cn(TD, "text-muted-foreground tabular-nums")}>
                  {index + 1}
                </td>
                <td className={cn(TD, "font-medium")}>
                  {teamNames.get(standing.teamId) ?? "Unknown"}
                </td>
                <td className={cn(TD, "tabular-nums")}>
                  {standing.wins}-{standing.losses}
                </td>
                <td className={cn(TD, "text-muted-foreground tabular-nums")}>
                  {standing.setsWon}-{standing.setsLost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );

  return (
    // From lg up the page is exactly the viewport minus the site header
    // (h-14) and never scrolls; the active tab panel scrolls instead. An
    // explicit height rather than flex-1, because body only sets
    // min-height, so a flex child there is free to grow past the viewport.
    // Below lg the page scrolls normally — a locked viewport on a phone is
    // miserable.
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:flex lg:h-[calc(100svh-3.5rem)] lg:flex-col lg:overflow-hidden lg:py-5">
      {/* Three explicit rows — title, tab strip, content — shared by both
          columns, so the sidebar begins exactly on the tab underline.
          minmax(0,1fr) on the last one is what makes the panels scroll: an
          auto-sized row grows to fit the whole table, so the row has to be
          told it may shrink below its content before any child can
          overflow.

          Source order is the narrow-screen order: title, status, sidebar,
          then the tabs. Desktop places every child explicitly, so moving
          the sidebar up here costs the wide layout nothing. */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_320px] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-x-6">
        {/* Spans both columns so a long season name has the full width to
            run into before the pill wraps. */}
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <Link
            href="/admin/seasons"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← All seasons
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{season.name}</h1>
            <span
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                badge.className
              )}
            >
              {hasSchedule && isPublished && weeks.length > 0 && !isComplete
                ? `Week ${currentWeek} of ${weeks.length}`
                : `Status: ${badge.label}`}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {weeks.length} weeks · {teams.length}{" "}
            {teams.length === 1 ? "team" : "teams"} · {courtsLabel}
          </p>
        </div>

        {/* The sidebar scrolls on its own rather than growing the page. */}
        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-3 lg:min-h-0 lg:overflow-y-auto">
          <SidebarCard title="Teams signed up">
            {seasonTiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This season offers no tiers.
              </p>
            ) : (
              [...seasonTiers]
                .sort((a, b) => a.tier_id - b.tier_id)
                .map((seasonTier) => {
                  const count = rosters.filter(
                    (team) => team.tierId === seasonTier.tier_id
                  ).length;
                  const spotsLeft = Math.max(0, seasonTier.max_teams - count);
                  return (
                    <div
                      key={seasonTier.tier_id}
                      className="flex flex-col gap-1.5"
                    >
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">
                          {seasonTier.tiers?.name ?? "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {count} of {seasonTier.max_teams} spots
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (count / seasonTier.max_teams) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {spotsLeft === 0
                          ? "Full"
                          : `${spotsLeft} ${
                              spotsLeft === 1 ? "spot" : "spots"
                            } left`}
                        {closesAt &&
                          season.status === "registration" &&
                          ` · registration closes ${format(closesAt, "MMM d")}`}
                      </p>
                    </div>
                  );
                })
            )}

            {/* create_team_with_captain accepts only a season still in
                'registration', so this is what actually stops new teams
                arriving under a schedule that is being drafted. bind rather
                than a client component: the trailing FormData the form adds
                is simply ignored by the two-argument action. */}
            {season.status === "registration" && (
              <form
                action={setSeasonStatus.bind(null, season.id, "closed")}
                className="flex flex-col gap-2 border-t pt-3"
              >
                <p className="text-xs text-muted-foreground">
                  {allTiersFull
                    ? "Every tier is full. Close registration to build the schedule."
                    : "Closing stops new teams signing up so the schedule can be built."}
                </p>
                <Button type="submit" variant="outline" size="sm">
                  Close registration
                </Button>
              </form>
            )}
          </SidebarCard>

          <SidebarCard title="Season details">
            <dl className="flex flex-col text-sm">
              {[
                ["Length", `${weeks.length} weeks`],
                [
                  weeksPlayed > 0 ? "Started" : "Starts",
                  firstMatch ? format(new Date(firstMatch), "MMM d, yyyy") : "—",
                ],
                [
                  "Ends",
                  lastMatch ? format(new Date(lastMatch), "MMM d, yyyy") : "—",
                ],
                ["Game night", gameNight ? `${gameNight}s` : "—"],
                ["Courts", courts.length > 0 ? courts.join(", ") : "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 border-b py-2 last:border-b-0"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </SidebarCard>

          {/* teams_season_tier_offered is RESTRICT, so a season with teams
              cannot be deleted even by a direct POST. Offering it only when
              the season is empty keeps the button honest. */}
          {teams.length === 0 && (
            <form
              action={deleteSeason}
              className="flex shrink-0 flex-col gap-3 rounded-xl border border-destructive/30 p-4"
            >
              <SectionLabel>Danger zone</SectionLabel>
              <p className="text-sm text-muted-foreground">
                Deleting removes this season and its weeks. Only possible while
                no team has registered.
              </p>
              <input type="hidden" name="seasonId" value={season.id} />
              <Button type="submit" variant="outline" size="sm">
                Delete season
              </Button>
            </form>
          )}
        </aside>

        {/* Last in source order so the sidebar sits above it on a phone;
            on desktop the strip and panel place themselves in rows 2 and
            3 of column 1. */}
        <SeasonTabs
          tabs={[
            {
              id: "schedule",
              label: "Schedule",
              count: fixtures.length,
              panel: schedulePanel,
            },
            {
              id: "teams",
              label: "Teams",
              count: rosters.length,
              panel: teamsPanel,
            },
            { id: "standings", label: "Standings", panel: standingsPanel },
          ]}
        />
      </div>
    </div>
  );
}
