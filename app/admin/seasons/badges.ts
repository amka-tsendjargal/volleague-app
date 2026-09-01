// Shared by the seasons list and the season details page, so the same
// season can't read as "Open" on one and something else on the other.

// The `seasons.status` values, as a captain-facing word plus the colour it
// carries and a line saying what the status means for players — the word
// alone never did, which is why the badge used to read as decoration. Every
// live status gets one; `complete` is here to be displayed, never to be set:
// the pages derive it from the last week having passed.
//
// The colour is spelled out twice because Tailwind only sees class names it
// can read literally in the source.
//
// `closed` stays neutral and silent: registration being shut is a step on the
// way to a schedule, not a state a captain acts on.
type SeasonBadge = {
  label: string;
  className: string;
  note?: string;
  noteClassName?: string;
};

export const STATUS_BADGES: Record<string, SeasonBadge> = {
  draft: {
    label: "Draft",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    note: "Not visible to players — registration won’t open until you publish",
    noteClassName: "text-amber-700 dark:text-amber-400",
  },
  registration: {
    label: "Open",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    note: "Visible to players — teams can register now",
    noteClassName: "text-emerald-700 dark:text-emerald-400",
  },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
  scheduled: {
    label: "Scheduled",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    note: "Registration is closed",
    noteClassName: "text-purple-700 dark:text-purple-400",
  },
  complete: { label: "Complete", className: "bg-muted text-muted-foreground" },
};

// Tiers are rows, not an enum, so a tier we have no colour for still has to
// render — it falls back to the neutral pill.
export const TIER_PILLS: Record<string, string> = {
  Competitive: "bg-rose-100 text-rose-900",
  Intermediate: "bg-emerald-100 text-emerald-900",
};

export function statusBadge(status: string): SeasonBadge {
  return (
    STATUS_BADGES[status] ?? {
      label: status,
      className: "bg-muted text-muted-foreground",
    }
  );
}