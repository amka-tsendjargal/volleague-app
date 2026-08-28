"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SeasonTab = {
  id: string;
  label: string;
  // Omitted for tabs where a number would be noise (standings).
  count?: number;
  panel: ReactNode;
};

/**
 * One panel at a time, each getting the full height of the column.
 *
 * The panels are built on the server and handed over as props — this
 * component only decides which one is on screen, so making it a Client
 * Component costs nothing but the switch itself.
 */
export function SeasonTabs({ tabs }: { tabs: SeasonTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) {
    return null;
  }

  return (
    // lg:contents dissolves this wrapper on desktop so the tab strip and
    // the panel become grid items of the page's own layout — that is what
    // lets the sidebar start exactly on the tab underline instead of being
    // nudged down by a hardcoded offset. This component is page-specific,
    // so knowing those row numbers is a fair trade for dropping the magic
    // number. Below lg the wrapper stays a normal flex column; the height
    // constraints are lg-only because `flex-1` with `min-h-0` inside an
    // auto-height container resolves to zero and would blank the panel.
    <div className="flex flex-col gap-4 lg:contents">
      <div
        role="tablist"
        className="flex shrink-0 gap-7 border-b lg:col-start-1 lg:row-start-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                // -mb-px so the active underline sits on the tablist's own
                // border rather than below it.
                "-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums",
                    isActive
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        // Deliberately carries no padding of its own. The space below the
        // tab strip comes from the wrapper's gap-4 on narrow screens and
        // from the grid's row gap on wide ones, so the panel and the
        // sidebar clear the strip by the same amount. A `pt-4 lg:pt-0`
        // pair here would work only as long as the two rules keep their
        // relative order in the stylesheet, which dev-mode HMR does not
        // guarantee.
        className="lg:col-start-1 lg:row-start-3 lg:flex lg:min-h-0 lg:flex-col"
      >
        {active.panel}
      </div>
    </div>
  );
}
