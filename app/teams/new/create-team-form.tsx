"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, X } from "lucide-react";
import {
  createTeam,
  checkTeamNameAvailability,
  type CreateTeamState,
} from "./actions";
import { MIN_TEAM_NAME_LENGTH, TEAM_NAME_PATTERN } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { PositionForm, type Position } from "../position-form";

type Tier = { id: number; name: string };
type Season = { id: number; name: string; tiers: Tier[] };
type Jersey = { id: number; kit_name: string };

type NameStatus = "idle" | "checking" | "available" | "taken" | "error";

// Ordered, so the progress bar reads its position and total from the list
// rather than from numbers that have to be kept in sync by hand.
const STEPS = ["details", "position"] as const;

type Step = (typeof STEPS)[number];

const DEBOUNCE_MS = 500;
const initialState: CreateTeamState = {};

function NameRequirement({
  met,
  invalid = false,
  label,
}: {
  met: boolean;
  invalid?: boolean;
  label: string;
}) {
  const colorClass = met
    ? "text-emerald-600"
    : invalid
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <li className={`flex items-center gap-1.5 ${colorClass}`}>
      {met ? (
        <Check className="size-3.5" />
      ) : invalid ? (
        <X className="size-3.5" />
      ) : (
        <Circle className="size-3.5" />
      )}
      {label}
    </li>
  );
}

export function CreateTeamForm({
  seasons,
  jerseys,
  positions,
  preselectedSeasonId,
  preselectedTierId,
}: {
  seasons: Season[];
  jerseys: Jersey[];
  positions: Position[];
  preselectedSeasonId?: string;
  preselectedTierId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createTeam,
    initialState
  );
  const router = useRouter();

  // Every field lives here rather than in the step that renders it, so
  // stepping back and forth never loses what was already filled in.
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  // Preselected from the ?seasonId=&tierId= link, or when there's only one
  // season open — the usual case. Ids that aren't on offer fall through to no
  // selection rather than putting a dead value in the Select, and the tier
  // only survives if the preselected season actually runs it.
  const linkedSeason =
    seasons.find((season) => String(season.id) === preselectedSeasonId) ??
    (seasons.length === 1 ? seasons[0] : undefined);

  const [seasonId, setSeasonId] = useState(
    linkedSeason ? String(linkedSeason.id) : ""
  );
  const [tierId, setTierId] = useState(
    linkedSeason?.tiers.some((tier) => String(tier.id) === preselectedTierId)
      ? preselectedTierId!
      : ""
  );
  const [jerseyId, setJerseyId] = useState("");
  const [positionId, setPositionId] = useState("");

  const availableTiers =
    seasons.find((season) => String(season.id) === seasonId)?.tiers ?? [];

  const trimmedName = name.trim();
  const hasMinLength = trimmedName.length >= MIN_TEAM_NAME_LENGTH;
  const hasValidChars =
    trimmedName.length === 0 || TEAM_NAME_PATTERN.test(trimmedName);
  const meetsNameRequirements = hasMinLength && hasValidChars;

  const canContinue =
    trimmedName.length > 0 &&
    seasonId !== "" &&
    tierId !== "" &&
    jerseyId !== "" &&
    meetsNameRequirements &&
    nameStatus !== "checking" &&
    nameStatus !== "taken";

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an older, slower check response overwriting a newer one.
  const requestIdRef = useRef(0);

  function clearDebounce() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  async function runAvailabilityCheck(value: string) {
    const requestId = ++requestIdRef.current;
    setNameStatus("checking");
    setNameMessage(null);

    const result = await checkTeamNameAvailability(value);
    if (requestId !== requestIdRef.current) return;

    if ("error" in result) {
      setNameStatus("error");
      setNameMessage(result.error);
    } else if (result.available) {
      setNameStatus("available");
      setNameMessage("Team name is available.");
    } else {
      setNameStatus("taken");
      setNameMessage("That team name is already taken.");
    }
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setName(value);
    clearDebounce();

    const trimmed = value.trim();
    const isValid =
      trimmed.length >= MIN_TEAM_NAME_LENGTH && TEAM_NAME_PATTERN.test(trimmed);
    if (!isValid) {
      requestIdRef.current++; // invalidate any in-flight check
      setNameStatus("idle");
      setNameMessage(null);
      return;
    }

    debounceRef.current = setTimeout(
      () => runAvailabilityCheck(trimmed),
      DEBOUNCE_MS
    );
  }

  function handleNameBlur() {
    clearDebounce();
    const trimmed = name.trim();
    const isValid =
      trimmed.length >= MIN_TEAM_NAME_LENGTH && TEAM_NAME_PATTERN.test(trimmed);
    if (!isValid) return;
    runAvailabilityCheck(trimmed);
  }

  useEffect(() => clearDebounce, []);

  function handleDetailsSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    // Step 1 never posts anywhere — it only unlocks step 2, which is the
    // form that carries every answer to createTeam.
    event.preventDefault();
    if (!canContinue) return;
    setStep("position");
  }

  // The Toaster lives in the root layout, so the snackbar survives the redirect.
  useEffect(() => {
    if (!state.success) return;
    toast.add({
      id: "team-created",
      type: "success",
      title: "Team created",
      description: `${state.teamName} is set up and you're listed as captain.`,
    });
    // TODO: route to teams page once available
    router.push("/");
  }, [state.success, state.teamName, router]);

  const isDetailsStep = step === "details";
  const stepNumber = STEPS.indexOf(step) + 1;
  const progressValue = (stepNumber / STEPS.length) * 100;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {isDetailsStep ? "Create a team" : "Pick your position"}
        </CardTitle>
        <CardDescription>
          {isDetailsStep
            ? "Set up your team and you'll be added as captain."
            : `Tell us where you play for ${trimmedName}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={progressValue} className="gap-1.5">
          <ProgressLabel className="text-xs font-normal text-muted-foreground">
            Step {stepNumber} of {STEPS.length}
          </ProgressLabel>
        </Progress>

        {isDetailsStep ? (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                Team name<span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={255}
                value={name}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                aria-invalid={
                  !hasValidChars || nameStatus === "taken" || nameStatus === "error"
                }
              />
              <ul className="flex flex-col gap-1 text-sm">
                <NameRequirement
                  met={hasMinLength}
                  label={`At least ${MIN_TEAM_NAME_LENGTH} characters`}
                />
                <NameRequirement
                  met={hasValidChars}
                  invalid={!hasValidChars}
                  label="Letters, numbers, and spaces only"
                />
              </ul>
              {nameStatus === "checking" && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Checking availability…
                </p>
              )}
              {nameStatus === "available" && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <Check className="size-3.5" />
                  {nameMessage}
                </p>
              )}
              {nameStatus === "taken" && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <X className="size-3.5" />
                  {nameMessage}
                </p>
              )}
              {nameStatus === "error" && (
                <p className="text-sm text-muted-foreground">{nameMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="seasonId">
                Season<span className="text-destructive">*</span>
              </Label>
              <Select
                name="seasonId"
                required
                value={seasonId}
                onValueChange={(value) => {
                  setSeasonId(value ?? "");
                  // Tiers are per-season, so the old pick may not be offered.
                  setTierId("");
                }}
              >
                <SelectTrigger id="seasonId" className="w-full">
                  <SelectValue placeholder="Select a season">
                    {(value: string) =>
                      seasons.find((season) => String(season.id) === value)
                        ?.name ?? "Select a season"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={String(season.id)}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tierId">
                Tier<span className="text-destructive">*</span>
              </Label>
              <Select
                name="tierId"
                required
                disabled={seasonId === ""}
                value={tierId}
                onValueChange={(value) => setTierId(value ?? "")}
              >
                <SelectTrigger id="tierId" className="w-full">
                  <SelectValue placeholder="Select a tier">
                    {(value: string) =>
                      availableTiers.find((tier) => String(tier.id) === value)
                        ?.name ?? "Select a tier"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableTiers.map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.id)}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="jerseyId">
                Jersey<span className="text-destructive">*</span>
              </Label>
              <Select
                name="jerseyId"
                required
                value={jerseyId}
                onValueChange={(value) => setJerseyId(value ?? "")}
              >
                <SelectTrigger id="jerseyId" className="w-full">
                  <SelectValue placeholder="Select a jersey">
                    {(value: string) =>
                      jerseys.find((jersey) => String(jersey.id) === value)
                        ?.kit_name ?? "Select a jersey"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {jerseys.map((jersey) => (
                    <SelectItem key={jersey.id} value={String(jersey.id)}>
                      {jersey.kit_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={!canContinue}>
              Next
            </Button>
          </form>
        ) : (
          <PositionForm
            positions={positions}
            positionId={positionId}
            onPositionChangeAction={setPositionId}
            hiddenFields={{ name: trimmedName, seasonId, tierId, jerseyId }}
            formAction={formAction}
            pending={pending}
            error={state.error}
            errorTeam={state.errorTeam}
            onBackAction={() => setStep("details")}
            submitLabel="Create team"
            pendingLabel="Creating…"
          />
        )}
      </CardContent>
    </Card>
  );
}
