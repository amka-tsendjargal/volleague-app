"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Circle, X } from "lucide-react";
import { signup, type SignupState } from "./actions";
import { minPasswordLength } from "./validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEmailError } from "@/lib/email";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: SignupState = {};

function PasswordRequirement({
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

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signup, initialState);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  const hasMinLength = password.length >= minPasswordLength;
  // Only flag the requirement as failed once the user has typed something.
  const passwordInvalid = password.length > 0 && !hasMinLength;

  const emailError = getEmailError(email.trim());

  const isFormFilled =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phoneNumber.trim().length > 0 &&
    password.length > 0;

  const fieldErrors = state.fieldErrors ?? {};

  // An address is invalid for most of the time it's being typed, so unlike the
  // password requirement above this waits for blur rather than nagging per
  // keystroke. Once they've left the field, it re-checks live so a fix clears
  // right away.
  const emailMessage = emailTouched ? emailError : fieldErrors.email;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up to join a league and start playing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {/* Server Actions can't see the URL, so the destination rides
              along in the POST body. */}
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">
              First name<span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              required
              maxLength={255}
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.firstName)}
            />
            {fieldErrors.firstName && (
              <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">
              Last name<span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              required
              maxLength={255}
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.lastName)}
            />
            {fieldErrors.lastName && (
              <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">
              Email<span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              maxLength={255}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={Boolean(emailMessage)}
            />
            {emailMessage && (
              <p className="text-sm text-destructive">{emailMessage}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phoneNumber">
              Phone number<span className="text-destructive">*</span>
            </Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              required
              maxLength={255}
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              aria-invalid={Boolean(fieldErrors.phoneNumber)}
            />
            {fieldErrors.phoneNumber && (
              <p className="text-sm text-destructive">
                {fieldErrors.phoneNumber}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">
              Password<span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={passwordInvalid || Boolean(fieldErrors.password)}
            />
            <ul className="flex flex-col gap-1 text-sm">
              <PasswordRequirement
                met={hasMinLength}
                invalid={passwordInvalid}
                label={`At least ${minPasswordLength} characters`}
              />
            </ul>
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button
            type="submit"
            disabled={
              pending || !isFormFilled || !hasMinLength || Boolean(emailError)
            }
          >
            {pending ? "Signing up…" : "Sign up"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          {/* Carries the destination across, so bouncing to login doesn't
              lose where they were going. */}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="underline underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
