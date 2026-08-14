"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, EllipsisIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSeasonStatus } from "./actions";

// The statuses an admin drives by hand. `complete` is deliberately absent:
// a season is over once its last week has passed, so the card derives it
// rather than waiting for someone to remember to set it.
const SELECTABLE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "registration", label: "Open" },
  { value: "scheduled", label: "Scheduled" },
] as const;

export function SeasonStatusMenu({
  seasonId,
  status,
}: {
  seasonId: number;
  status: string;
}) {
  // Seeded from the row, then owned locally so the tick moves on click
  // instead of waiting for the round trip.
  const [selected, setSelected] = useState(status);

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button variant="outline" size="icon" aria-label="Season actions">
            <EllipsisIcon />
          </Button>
        }
      />
      <Menu.Portal>
        <Menu.Positioner className="outline-hidden" sideOffset={6}>
          <Menu.Popup className="min-w-40 origin-(--transform-origin) rounded-lg border bg-background p-1 shadow-md outline-hidden">
            {/* Controlled: revalidatePath re-renders this card with a new
                `status` prop, and Base UI rejects a defaultValue that changes
                after the first render. */}
            <Menu.RadioGroup
              value={selected}
              onValueChange={(value) => {
                setSelected(value);
                setSeasonStatus(seasonId, value);
              }}
            >
              {/* GroupLabel reads its group from context, so it has to live
                  inside the RadioGroup, not next to it. */}
              <Menu.GroupLabel className="px-2 py-1.5 text-xs text-muted-foreground">
                Status
              </Menu.GroupLabel>
              {SELECTABLE_STATUSES.map((seasonStatus) => (
                <Menu.RadioItem
                  key={seasonStatus.value}
                  value={seasonStatus.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-muted"
                >
                  <Menu.RadioItemIndicator className="col-start-1">
                    <CheckIcon className="size-4" />
                  </Menu.RadioItemIndicator>
                  <span className="col-start-2">{seasonStatus.label}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
