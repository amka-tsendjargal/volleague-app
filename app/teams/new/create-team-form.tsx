"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, X } from "lucide-react";
import {
  createTeam,
  checkTeamNameAvailability,
  type CreateTeamState,
} from "./actions";
import {
  TEAM_TIERS,
  MIN_TEAM_NAME_LENGTH,
  TEAM_NAME_PATTERN,
} from "@/lib/constants";
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
import { toast } from "@/components/ui/toast";

type Jersey = { id: number; kit_name: string };
type Position = { id: number; name: string };

type NameStatus = "idle" | "checking" | "available" | "taken" | "error";

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
  jerseys,
  positions,
}: {
  jerseys: Jersey[];
  positions: Position[];
}) {
  const [state, formAction, pending] = useActionState(
    createTeam,
    initialState
  );
  const router = useRouter();

  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [tier, setTier] = useState("");
  const [jerseyId, setJerseyId] = useState("");
  const [positionId, setPositionId] = useState("");

  const trimmedName = name.trim();
  const hasMinLength = trimmedName.length >= MIN_TEAM_NAME_LENGTH;
  const hasValidChars =
    trimmedName.length === 0 || TEAM_NAME_PATTERN.test(trimmedName);
  const meetsNameRequirements = hasMinLength && hasValidChars;

  const isFormFilled =
    name.trim().length > 0 &&
    tier !== "" &&
    jerseyId !== "" &&
    positionId !== "";

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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create a team</CardTitle>
        <CardDescription>
          Set up your team and you&apos;ll be added as captain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
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
            <Label htmlFor="tier">
              Tier<span className="text-destructive">*</span>
            </Label>
            <Select
              name="tier"
              required
              value={tier}
              onValueChange={(value) => setTier(value ?? "")}
            >
              <SelectTrigger id="tier" className="w-full">
                <SelectValue placeholder="Select a tier">
                  {(value: string) =>
                    TEAM_TIERS.find((option) => String(option.value) === value)
                      ?.label ?? "Select a tier"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TEAM_TIERS.map((tier) => (
                  <SelectItem key={tier.value} value={String(tier.value)}>
                    {tier.label}
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="positionId">
              Position<span className="text-destructive">*</span>
            </Label>
            <Select
              name="positionId"
              required
              value={positionId}
              onValueChange={(value) => setPositionId(value ?? "")}
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

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button
            type="submit"
            disabled={
              pending ||
              !isFormFilled ||
              !meetsNameRequirements ||
              nameStatus === "checking" ||
              nameStatus === "taken"
            }
          >
            {pending ? "Creating…" : "Create team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
