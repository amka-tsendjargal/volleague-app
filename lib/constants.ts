// Stand-in for a real logged-in user until auth exists. Must match the
// auth.users row inserted in supabase/seed.sql.
export const SEED_CAPTAIN_ID = "11111111-1111-1111-1111-111111111111";

// `teams.tier` is a bare integer with no lookup table — this is the
// hardcoded set of options the create-team form offers.
export const TEAM_TIERS = [
  { value: 1, label: "Competitive" },
  { value: 2, label: "Intermediate" },
] as const;

// Shared between the client's debounced availability check and the
// server's validation so they agree on when a name is worth checking.
export const MIN_TEAM_NAME_LENGTH = 3;

// Letters, numbers, and spaces only — keeps team names simple and sidesteps
// ILIKE wildcard characters (%, _) entirely rather than escaping them.
export const TEAM_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;
