// Shared between the client's debounced availability check and the
// server's validation so they agree on when a name is worth checking.
export const MIN_TEAM_NAME_LENGTH = 3;

// Letters, numbers, and spaces only — keeps team names simple and sidesteps
// ILIKE wildcard characters (%, _) entirely rather than escaping them.
export const TEAM_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;

// Six on the court, so a team below this can't field a lineup. A team is
// "confirmed" — and therefore schedulable — once it reaches this many
// players; schedule generation ignores the rest.
export const MIN_PLAYERS_PER_TEAM = 6;

// A tier needs two teams to have a match at all. Mirrors
// season_tiers_max_teams_valid.
export const MIN_TEAMS_PER_TIER = 2;