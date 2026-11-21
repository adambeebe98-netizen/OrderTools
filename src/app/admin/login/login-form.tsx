"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/misc";
import { sendPasswordReset, signIn } from "@/lib/actions/auth";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = React.useState<"login" | "reset">("login");
  const [state, action, pending] = useActionState(signIn, initialError ? { error: initialError } : undefined);
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordReset, undefined);

  if (mode === "reset") {
    return (
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <form action={resetAction} className="grid gap-4">
            <Field label="Email" htmlFor="reset-email">
              <Input id="reset-email" name="email" type="email" autoComplete="email" required />
            </Field>
            {resetState?.error && <p className="text-sm text-destructive" role="alert">{resetState.error}</p>}
            {resetState?.ok && <p className="text-sm text-success" role="status">{resetState.ok}</p>}
            <Button type="submit" disabled={resetPending}>
              {resetPending && <Spinner />} Send reset link
            </Button>
            <Button variant="link" onClick={() => setMode("login")}>
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 sm:pt-5">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} size="lg">
            {pending && <Spinner />} Sign in
          </Button>
          <Button variant="link" className="text-muted-foreground" onClick={() => setMode("reset")}>
            Forgot password?
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
