"use client";

import { useActionState, useEffect } from "react";
import { CalendarPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { generateSchedule, type GenerateScheduleState } from "./actions";

const initialState: GenerateScheduleState = {};

export function GenerateScheduleButton({
  seasonId,
  seasonName,
  disabled,
}: {
  seasonId: number;
  seasonName: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    generateSchedule,
    initialState
  );

  // Both outcomes toast: the button sits in a row of season cards with
  // nowhere to put inline copy, and a refused generation has to say why.
  // Keyed per season so two cards don't overwrite each other's message.
  useEffect(() => {
    if (state.success) {
      toast.add({
        id: `schedule-generated-${seasonId}`,
        type: "success",
        title: "Schedule generated",
        description: `${state.fixtureCount} matches drafted for ${seasonName}.`,
      });
    } else if (state.error) {
      toast.add({
        id: `schedule-failed-${seasonId}`,
        type: "error",
        title: "Could not generate a schedule",
        description: state.error,
      });
    }
  }, [state, seasonId, seasonName]);

  return (
    <form action={formAction}>
      <input type="hidden" name="seasonId" value={seasonId} />
      <Button
        type="submit"
        variant="outline"
        size="icon"
        aria-label={`Generate schedule for ${seasonName}`}
        disabled={disabled || pending}
      >
        <CalendarPlusIcon />
      </Button>
    </form>
  );
}
