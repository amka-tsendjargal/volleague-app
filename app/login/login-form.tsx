"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
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

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");

  const emailError = getEmailError(email.trim());

  const isFormFilled = email.trim().length > 0 && password.length > 0;

  const fieldErrors = state.fieldErrors ?? {};

  // An address is invalid for most of the time it's being typed, so unlike the
  // signup password hint this waits for blur rather than nagging per keystroke.
  // Once they've left the field, it re-checks live so a fix clears right away.
  const emailMessage = emailTouched ? emailError : fieldErrors.email;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>
          Welcome back!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {/* Server Actions can't see the URL, so the destination rides
              along in the POST body. */}
          <input type="hidden" name="next" value={next ?? ""} />
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
            <Label htmlFor="password">
              Password<span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button
            type="submit"
            disabled={pending || !isFormFilled || Boolean(emailError)}
          >
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          {/* Carries the destination across, so bouncing to signup doesn't
              lose where they were going. */}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
