"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import { signOut, updatePassword, updateProfileName } from "@/lib/actions/auth";

function Status({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-destructive" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-success" role="status">{state.ok}</p>;
  return null;
}

export function AccountForms({ fullName, mustSetPassword }: { fullName: string; mustSetPassword: boolean }) {
  const [nameState, nameAction, namePending] = useActionState(updateProfileName, undefined);
  const [pwState, pwAction, pwPending] = useActionState(updatePassword, undefined);
  return (
    <div className="grid gap-4">
      {mustSetPassword && (
        <p className="rounded-lg border border-primary/30 bg-accent p-3 text-sm">Welcome! Set a password so you can sign in next time.</p>
      )}
      <form action={pwAction} className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">{mustSetPassword ? "Set your password" : "Change password"}</h2>
        <Field label="New password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Status state={pwState} />
        <Button type="submit" disabled={pwPending} className="justify-self-start">
          {pwPending && <Spinner />} Save password
        </Button>
      </form>
      <form action={nameAction} className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">Profile</h2>
        <Field label="Your name" htmlFor="full_name">
          <Input id="full_name" name="full_name" defaultValue={fullName} maxLength={100} autoComplete="name" />
        </Field>
        <Status state={nameState} />
        <Button type="submit" variant="outline" disabled={namePending} className="justify-self-start">
          {namePending && <Spinner />} Save
        </Button>
      </form>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );
}
