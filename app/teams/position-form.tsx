"use client";

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
 * The final step of both the create-team and join-team flows: the player's
 * own position.
 *
 * This is the form that actually calls the Server Action, so every answer
 * from the earlier step rides along in `hiddenFields` — those fields are
 * unmounted by the time this renders, and only what is inside this <form>
 * reaches the action.
 */
export function PositionForm({
  positions,
  positionId,
  onPositionChangeAction,
  hiddenFields,
  formAction,
  pending,
  error,
  onBackAction,
  submitLabel,
  pendingLabel,
}: {
  positions: Position[];
  positionId: string;
  onPositionChangeAction: (value: string) => void;
  hiddenFields: Record<string, string>;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  onBackAction: () => void;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

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

      {error && <p className="text-sm text-destructive">{error}</p>}

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
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
