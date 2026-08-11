"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createSeason, type CreateSeasonState } from "./actions";
import { firstPlayoffWeek, regularWeeksNeeded } from "./validation";
import { generateWeekTimes } from "./week-times";
import { MIN_TEAMS_PER_TIER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type Tier = { id: number; name: string };

const initialState: CreateSeasonState = {};

export function CreateSeasonForm({ tiers }: { tiers: Tier[] }) {
  const [state, formAction, pending] = useActionState(
    createSeason,
    initialState
  );
  const router = useRouter();

  const [name, setName] = useState("");
  const [firstMatch, setFirstMatch] = useState("");
  const [regularWeeks, setRegularWeeks] = useState("13");
  const [playoffWeeks, setPlayoffWeeks] = useState("2");
  // Dates the season skips, by position in the generated run. Skipped dates
  // stay on screen — they're struck through, not removed — so it's obvious
  // which nights were given up and why the season got shorter.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  // Presence in the map is what selects a tier; the value is its cap.
  const [caps, setCaps] = useState<Record<number, string>>({});

  const playoffCount = Number(playoffWeeks);
  const slotCount = Number(regularWeeks) + playoffCount;

  // Changing either input regenerates the run, so skips made against the
  // old dates are dropped rather than silently kept. Adjusting state during
  // render is React's pattern for this; an effect would render once with
  // the stale dates first.
  const seed = `${firstMatch}|${slotCount}`;
  const [lastSeed, setLastSeed] = useState(seed);
  if (seed !== lastSeed) {
    setLastSeed(seed);
    setSkipped(new Set());
  }

  useEffect(() => {
    if (!state.success) return;
    toast.add({
      id: "season-created",
      type: "success",
      title: "Season created",
      description: `${state.seasonName} is set up as a draft.`,
    });
    router.push("/admin/seasons");
  }, [state.success, state.seasonName, router]);

  function toggleSkipped(index: number) {
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleTier(tierId: number) {
    setCaps((current) => {
      const next = { ...current };
      if (tierId in next) {
        delete next[tierId];
      } else {
        next[tierId] = "10";
      }
      return next;
    });
  }

  // Skipped dates take no week number, so every later night shifts up by
  // however many were skipped before it.
  const slots = generateWeekTimes(firstMatch, slotCount);
  const skippedBefore = (index: number) =>
    [...skipped].filter((skippedIndex) => skippedIndex < index).length;

  const rows = slots.map((matchTime, index) => {
    const isSkipped = skipped.has(index);
    return {
      matchTime,
      index,
      isSkipped,
      weekNumber: isSkipped ? null : index + 1 - skippedBefore(index),
    };
  });

  const playingWeeks = rows.filter((row) => !row.isSkipped);
  const playoffsStart = firstPlayoffWeek(playingWeeks.length, playoffCount);
  const actualRegularWeeks = Math.max(0, playingWeeks.length - playoffCount);

  const tierCaps = Object.entries(caps).map(([tierId, maxTeams]) => ({
    tierId: Number(tierId),
    maxTeams: Number(maxTeams),
  }));

  // A warning rather than a block: caps are a ceiling, and a tier capped at
  // 10 that only draws 8 teams needs fewer weeks than this assumes. The
  // real check runs at generation, when the team count is known.
  const weeksNeeded = regularWeeksNeeded(tierCaps);
  const tooFewRegularWeeks =
    playingWeeks.length > 0 && tierCaps.length > 0 && actualRegularWeeks < weeksNeeded;

  const isoWeekTimes = playingWeeks.map((row) => {
    const parsed = new Date(row.matchTime);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  });

  const isFormFilled =
    name.trim().length > 0 && playingWeeks.length > 0 && tierCaps.length > 0;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create a season</CardTitle>
        <CardDescription>
          Starts as a draft. Open registration once the dates and caps look
          right.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input
            type="hidden"
            name="weekTimes"
            value={JSON.stringify(isoWeekTimes)}
          />
          <input
            type="hidden"
            name="tierCaps"
            value={JSON.stringify(tierCaps)}
          />
          <input type="hidden" name="playoffWeeks" value={playoffWeeks} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              Season name<span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={255}
              placeholder="Fall 2026"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstMatch">
                First match<span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstMatch"
                type="datetime-local"
                required
                value={firstMatch}
                onChange={(event) => setFirstMatch(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Sets the day and time for every week.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="regularWeeksInput">Regular weeks</Label>
              <Input
                id="regularWeeksInput"
                type="number"
                min={1}
                value={regularWeeks}
                onChange={(event) => setRegularWeeks(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="playoffWeeksInput">Playoff weeks</Label>
              <Input
                id="playoffWeeksInput"
                type="number"
                min={0}
                value={playoffWeeks}
                onChange={(event) => setPlayoffWeeks(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">
              Tiers<span className="text-destructive">*</span>
            </legend>
            {tiers.map((tier) => (
              <div key={tier.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`tier-${tier.id}`}
                  checked={tier.id in caps}
                  onChange={() => toggleTier(tier.id)}
                  className="size-4"
                />
                <Label htmlFor={`tier-${tier.id}`} className="flex-1">
                  {tier.name}
                </Label>
                <Input
                  type="number"
                  min={MIN_TEAMS_PER_TIER}
                  aria-label={`${tier.name} team cap`}
                  className="w-24"
                  disabled={!(tier.id in caps)}
                  value={caps[tier.id] ?? ""}
                  onChange={(event) =>
                    setCaps((current) => ({
                      ...current,
                      [tier.id]: event.target.value,
                    }))
                  }
                />
                <span className="w-16 text-sm text-muted-foreground">teams</span>
              </div>
            ))}
          </fieldset>

          {rows.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                Schedule — skip any night the venue is closed
              </legend>
              <p className="text-sm text-muted-foreground">
                {actualRegularWeeks} regular {" + "} {playoffCount} playoff ={" "}
                {playingWeeks.length} playing{" "}
                {playingWeeks.length === 1 ? "night" : "nights"}
              </p>

              <ul className="flex flex-col divide-y rounded-lg border">
                {rows.map((row) => {
                  const isPlayoff =
                    row.weekNumber !== null && row.weekNumber >= playoffsStart;

                  return (
                    <li
                      key={row.index}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span
                        className={`w-20 text-sm ${
                          row.isSkipped
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {row.isSkipped ? "Skipped" : `Week ${row.weekNumber}`}
                      </span>

                      <span
                        className={`flex-1 text-sm ${
                          row.isSkipped
                            ? "text-destructive line-through"
                            : "text-foreground"
                        }`}
                      >
                        {format(
                          new Date(row.matchTime),
                          "EEE d MMM yyyy, h:mm a"
                        )}
                      </span>

                      {isPlayoff && (
                        <span className="text-xs text-muted-foreground">
                          Playoff
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSkipped(row.index)}
                      >
                        {row.isSkipped ? "Restore" : "Skip"}
                      </Button>
                    </li>
                  );
                })}
              </ul>

              {tooFewRegularWeeks && (
                <p className="text-sm text-destructive">
                  {actualRegularWeeks} regular weeks isn&apos;t enough for a tier
                  of {weeksNeeded + 1} teams to play everyone once — that needs{" "}
                  {weeksNeeded}. You can still save this; the schedule just
                  can&apos;t be generated until the numbers work.
                </p>
              )}
            </fieldset>
          )}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={pending || !isFormFilled}>
            {pending ? "Creating…" : "Create season"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}