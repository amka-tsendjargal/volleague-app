"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MIN_PLAYERS_PER_TEAM } from "@/lib/constants";
import { generateFixtures, validateTiers, type TierEntry } from "./round-robin";

// The statuses an admin may set. Narrower than the seasons_status_valid
// check constraint on purpose — `complete` is derived from the last week
// having passed, so nothing should be writing it here.
const VALID_STATUSES = ["draft", "registration", "scheduled"];

export async function setSeasonStatus(seasonId: number, status: string) {
  if (!VALID_STATUSES.includes(status)) return;

  const supabase = await createClient();

  // The layout already redirects non-admins; this catches a direct POST.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return;
  }

  await supabase.from("seasons").update({ status }).eq("id", seasonId);

  revalidatePath("/admin/seasons");
}

export type GenerateScheduleState = {
  error?: string;
  success?: boolean;
  fixtureCount?: number;
};

// Shapes returned by PostgREST, so these stay snake_case.
type TeamRow = {
  id: number;
  tier_id: number;
  tiers: { name: string } | null;
  team_users: { count: number }[];
};

type SeasonRow = { court_numbers: number[] };

type WeekRow = { id: number };

/**
 * Pairs every tier's confirmed teams round robin across the season's
 * regular weeks and stores the result.
 *
 * Leaves seasons.status alone: the fixtures are a draft to be reviewed,
 * and publishing them is a separate decision.
 */
export async function generateSchedule(
  _prevState: GenerateScheduleState,
  formData: FormData
): Promise<GenerateScheduleState> {
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isInteger(seasonId)) {
    return { error: "Could not tell which season to schedule." };
  }

  const supabase = await createClient();

  // The layout already hides /admin from non-admins; this catches a direct
  // POST. generate_schedule re-checks server-side too.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { error: "Only an admin can generate a schedule." };
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("court_numbers")
    .eq("id", seasonId)
    .maybeSingle();

  if (!season) {
    return { error: "That season no longer exists." };
  }

  // Playoff weeks are left empty on purpose — a bracket depends on final
  // standings, which do not exist until the regular season is played.
  const { data: weekRows } = await supabase
    .from("season_weeks")
    .select("id")
    .eq("season_id", seasonId)
    .eq("is_playoff", false)
    .order("week_number");

  const weeks = (weekRows as WeekRow[] | null) ?? [];
  if (weeks.length === 0) {
    return { error: "This season has no regular-season weeks to schedule." };
  }

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, tier_id, tiers(name), team_users(count)")
    .eq("season_id", seasonId)
    .order("id");

  const teams = (teamRows as unknown as TeamRow[] | null) ?? [];
  if (teams.length === 0) {
    return { error: "No teams have registered for this season yet." };
  }

  // A team short of a full lineup can't field one, so it sits out of the
  // schedule entirely rather than being handed matches it would forfeit.
  const tiers: TierEntry[] = [];
  for (const team of teams) {
    if ((team.team_users[0]?.count ?? 0) < MIN_PLAYERS_PER_TEAM) {
      continue;
    }
    const tier = tiers.find((entry) => entry.tierId === team.tier_id);
    if (tier) {
      tier.teamIds.push(team.id);
    } else {
      tiers.push({
        tierId: team.tier_id,
        tierName: team.tiers?.name ?? "This tier",
        teamIds: [team.id],
      });
    }
  }

  const { court_numbers: courtNumbers } = season as SeasonRow;

  const validationError = validateTiers(tiers, courtNumbers);
  if (validationError) {
    return { error: validationError };
  }

  const fixtures = generateFixtures(
    tiers,
    weeks.map((week) => week.id),
    courtNumbers
  );

  // snake_case because the RPC unpacks these straight into columns.
  const { data: fixtureCount, error } = await supabase.rpc(
    "generate_schedule",
    {
      target_season_id: seasonId,
      fixtures: fixtures.map((fixture) => ({
        season_week_id: fixture.seasonWeekId,
        team_a_id: fixture.teamAId,
        team_b_id: fixture.teamBId,
        court_number: fixture.courtNumber,
      })),
    }
  );

  if (error) {
    if (error.code === "55000") {
      return {
        error:
          "This season already has recorded scores, so its schedule can't be regenerated.",
      };
    }
    return { error: "Could not generate the schedule. Please try again." };
  }

  revalidatePath("/admin/seasons");

  return { success: true, fixtureCount: fixtureCount as number };
}

// The button only shows for seasons with no teams, and teams_season_tier_offered
// is RESTRICT, so this can't take real data even via a direct POST — a season
// with teams just errors and nothing is deleted.
export async function deleteSeason(formData: FormData) {
  const seasonId = Number(formData.get("seasonId"));
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return;

  await supabase.from("seasons").delete().eq("id", seasonId);

  revalidatePath("/admin/seasons");
}