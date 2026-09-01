"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { publishSchedule, type PublishScheduleState } from "./actions";

const initialState: PublishScheduleState = {};

export function PublishButton({
  seasonId,
  seasonName,
}: {
  seasonId: number;
  seasonName: string;
}) {
  const [state, formAction, pending] = useActionState(
    publishSchedule,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.add({
        id: `schedule-published-${seasonId}`,
        type: "success",
        title: "Schedule published",
        description: `${seasonName} is now visible to everyone.`,
      });
    } else if (state.error) {
      toast.add({
        id: `publish-failed-${seasonId}`,
        type: "error",
        title: "Could not publish",
        description: state.error,
      });
    }
  }, [state, seasonId, seasonName]);

  return (
    <form action={formAction}>
      <input type="hidden" name="seasonId" value={seasonId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Publishing…" : "Publish schedule"}
      </Button>
    </form>
  );
}
