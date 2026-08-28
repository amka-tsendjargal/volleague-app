// Shared by the seasons list and the season details page, so the same
// season can't read as "Open" on one and something else on the other.

// The `seasons.status` values, as a captain-facing word plus the colour that
// word carries. Only registration gets an accent — the rest are states nobody
// needs to act on. `complete` is here to be displayed, never to be set: the
// pages derive it from the last week having passed.
//
// `closed` stays neutral even though it is a state the admin acts on, because
// amber belongs to the draft-schedule banner. A season badge and a schedule
// badge sharing a colour would read as one scale with two labels.
export const STATUS_BADGES: Record<string, { label: string; className: string }> =
  {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    registration: {
      label: "Open",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    },
    closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
    scheduled: {
      label: "Scheduled",
      className: "bg-muted text-muted-foreground",
    },
    complete: { label: "Complete", className: "bg-muted text-muted-foreground" },
  };

// Tiers are rows, not an enum, so a tier we have no colour for still has to
// render — it falls back to the neutral pill.
export const TIER_PILLS: Record<string, string> = {
  Competitive: "bg-rose-100 text-rose-900",
  Intermediate: "bg-emerald-100 text-emerald-900",
};

export function statusBadge(status: string) {
  return (
    STATUS_BADGES[status] ?? {
      label: status,
      className: "bg-muted text-muted-foreground",
    }
  );
}
