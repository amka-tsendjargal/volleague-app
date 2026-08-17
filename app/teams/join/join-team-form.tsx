"use client";

import { useActionState, useState } from "react";
import { JOIN_CODE_LENGTH } from "@/lib/constants";
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
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { PositionForm, type Position } from "../position-form";
import { checkJoinCode, joinTeam, type JoinTeamState } from "./actions";

// Ordered, so the progress bar reads its position and total from the list
// rather than from numbers that have to be kept in sync by hand.
const STEPS = ["code", "position"] as const;

type Step = (typeof STEPS)[number];

const initialState: JoinTeamState = {};

export function JoinTeamForm({ positions }: { positions: Position[] }) {
  const [state, formAction, pending] = useActionState(joinTeam, initialState);

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Only used to name the team on step 2 — the code, not this, is what the
  // action resolves the team from.
  const [teamName, setTeamName] = useState("");
  const [positionId, setPositionId] = useState("");

  const trimmedCode = code.trim();

  async function handleCodeSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    // Step 1 never posts anywhere — it confirms the code names a real team,
    // then unlocks step 2, which is the form that carries both answers.
    event.preventDefault();
    setChecking(true);
    setCodeError(null);

    const result = await checkJoinCode(trimmedCode);
    setChecking(false);

    if ("error" in result) {
      setCodeError(result.error);
      return;
    }

    setTeamName(result.teamName);
    setStep("position");
  }

  const isCodeStep = step === "code";
  const stepNumber = STEPS.indexOf(step) + 1;
  const progressValue = (stepNumber / STEPS.length) * 100;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isCodeStep ? "Join a team" : "Pick your position"}</CardTitle>
        <CardDescription>
          {isCodeStep
            ? "Enter the join code your captain shared with you."
            : `Tell us where you play for ${teamName}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={progressValue} className="gap-1.5">
          <ProgressLabel className="text-xs font-normal text-muted-foreground">
            Step {stepNumber} of {STEPS.length}
          </ProgressLabel>
        </Progress>

        {isCodeStep ? (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">
                Join code<span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                name="code"
                required
                autoComplete="off"
                spellCheck={false}
                maxLength={JOIN_CODE_LENGTH}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeError(null);
                }}
                aria-invalid={Boolean(codeError)}
                // Shown uppercase for legibility; the action lowercases it
                // back before looking it up.
                className="font-mono uppercase"
              />
              {codeError && (
                <p className="text-sm text-destructive">{codeError}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={checking || trimmedCode.length !== JOIN_CODE_LENGTH}
            >
              {checking ? "Checking…" : "Next"}
            </Button>
          </form>
        ) : (
          <PositionForm
            positions={positions}
            positionId={positionId}
            onPositionChangeAction={setPositionId}
            hiddenFields={{ code: trimmedCode }}
            formAction={formAction}
            pending={pending}
            error={state.error}
            onBackAction={() => setStep("code")}
            submitLabel="Join team"
            pendingLabel="Joining…"
          />
        )}
      </CardContent>
    </Card>
  );
}
