"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Position = { id: number; name: string };

/**
 * Step 2 of the create-team flow: the captain's own position.
 *
 * This is the form that actually calls createTeam, so the step 1 answers ride
 * along as hidden inputs — the step 1 fields are unmounted by the time this
 * renders, and only what is inside this <form> reaches the Server Action.
 */
export function PositionForm({
  positions,
  positionId,
  onPositionChangeAction,
  teamDetails,
  formAction,
  pending,
  error,
  errorTeam,
  onBackAction,
}: {
  positions: Position[];
  positionId: string;
  onPositionChangeAction: (value: string) => void;
  teamDetails: {
    name: string;
    seasonId: string;
    tierId: string;
    jerseyId: string;
  };
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  errorTeam?: { id: number; name: string };
  onBackAction: () => void;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="name" value={teamDetails.name} />
      <input type="hidden" name="seasonId" value={teamDetails.seasonId} />
      <input type="hidden" name="tierId" value={teamDetails.tierId} />
      <input type="hidden" name="jerseyId" value={teamDetails.jerseyId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="positionId">
          Position<span className="text-destructive">*</span>
        </Label>
        <Select
          name="positionId"
          required
          value={positionId}
          onValueChange={(value) => onPositionChangeAction(value ?? "")}
        >
          <SelectTrigger id="positionId" className="w-full">
            <SelectValue placeholder="Select your position">
              {(value: string) =>
                positions.find((position) => String(position.id) === value)
                  ?.name ?? "Select your position"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {positions.map((position) => (
              <SelectItem key={position.id} value={String(position.id)}>
                {position.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-1.5">
          <p className="text-sm text-destructive">{error}</p>
          {errorTeam && (
            <Link
              href={`/teams/${errorTeam.id}`}
              className="flex items-center gap-1 text-sm underline underline-offset-2"
            >
              View {errorTeam.name}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBackAction}
          disabled={pending}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={pending || positionId === ""}
          className="flex-1"
        >
          {pending ? "Creating…" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
