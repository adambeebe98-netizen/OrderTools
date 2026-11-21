"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, ShoppingBasket, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cleanName } from "@/lib/names";
import { cn } from "@/lib/utils";

const NAME_KEY = "supply-portal:name";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode / storage disabled: name just won't be remembered.
  }
}

/** Technician name remembered on this device. `undefined` until loaded on the client. */
export function useTechnicianName() {
  const [name, setNameState] = React.useState<string | null | undefined>(undefined);
  React.useEffect(() => {
    setNameState(readLocal(NAME_KEY));
  }, []);
  const setName = React.useCallback((value: string) => {
    const cleaned = cleanName(value);
    writeLocal(NAME_KEY, cleaned);
    setNameState(cleaned);
  }, []);
  return [name, setName] as const;
}

export function useLocalJson<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(initial);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    const raw = readLocal(key);
    if (raw) {
      try {
        setValue(JSON.parse(raw) as T);
      } catch {
        // ignore corrupt storage
      }
    }
    setLoaded(true);
  }, [key]);
  React.useEffect(() => {
    if (loaded) writeLocal(key, JSON.stringify(value));
  }, [key, value, loaded]);
  return [value, setValue, loaded] as const;
}

export function NameForm({
  initial,
  onSave,
  submitLabel = "Continue",
  autoFocus = true,
}: {
  initial?: string | null;
  onSave: (name: string) => void;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = React.useState(initial ?? "");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned = cleanName(value);
        if (!cleaned) return setError("Enter your name");
        if (cleaned.length > 60) return setError("Name is too long");
        onSave(cleaned);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="tech-name">Your name</Label>
        <Input
          id="tech-name"
          autoFocus={autoFocus}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="First and last name"
          value={value}
          maxLength={60}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          className="h-12 text-base"
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Use the same name each time so your manager can find your requests.</p>
        )}
      </div>
      <Button type="submit" size="xl">
        {submitLabel}
      </Button>
    </form>
  );
}

export function NameGate({ teamName, onSave }: { teamName: string; onSave: (name: string) => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-primary/10 p-4 text-primary">
          <ShoppingBasket className="size-9" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{teamName}</h1>
        <p className="text-muted-foreground">Request supplies in a few taps. No account needed.</p>
      </div>
      <NameForm onSave={onSave} />
    </main>
  );
}

export function ChangeNameDialog({
  open,
  onOpenChange,
  name,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null | undefined;
  onSave: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your name</DialogTitle>
          <DialogDescription>Your name is saved on this device only.</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-5">
          <NameForm
            initial={name}
            submitLabel="Save name"
            onSave={(n) => {
              onSave(n);
              onOpenChange(false);
            }}
          />
        </DialogBody>
        <DialogFooter className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

export function TechHeader({
  slug,
  teamName,
  name,
  onChangeName,
  active,
}: {
  slug: string;
  teamName: string;
  name: string | null | undefined;
  onChangeName: () => void;
  active: "catalog" | "history";
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{teamName}</p>
          <button
            type="button"
            onClick={onChangeName}
            className="flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
          >
            <UserRound className="size-3" aria-hidden />
            <span className="truncate">{name || "Set your name"}</span>
            <span className="text-primary">· change</span>
          </button>
        </div>
        <nav className="flex shrink-0 gap-1" aria-label="Main">
          <Link
            href={`/r/${slug}`}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
              active === "catalog" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            aria-current={active === "catalog" ? "page" : undefined}
          >
            <ShoppingBasket className="size-4" aria-hidden /> Request
          </Link>
          <Link
            href={`/r/${slug}/history`}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
              active === "history" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            aria-current={active === "history" ? "page" : undefined}
          >
            <ClipboardList className="size-4" aria-hidden /> My requests
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function QuantityStepper({
  value,
  onChange,
  label,
  size = "lg",
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: "lg" | "md";
  min?: number;
}) {
  const btn = size === "lg" ? "size-11" : "size-9";
  return (
    <div className="flex items-center rounded-xl border bg-card" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        className={cn(btn, "flex items-center justify-center rounded-l-xl text-xl font-medium hover:bg-muted active:bg-muted/70 disabled:opacity-30")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={value <= 1 && min === 0 ? `Remove ${label}` : `Decrease ${label}`}
      >
        −
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        className="w-10 bg-transparent text-center text-base font-semibold tabular-nums focus:outline-none"
        value={value}
        aria-label={`${label} quantity`}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
          onChange(Math.max(min, Math.min(999, n)));
        }}
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        className={cn(btn, "flex items-center justify-center rounded-r-xl text-xl font-medium hover:bg-muted active:bg-muted/70")}
        onClick={() => onChange(Math.min(999, value + 1))}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
