"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <h2 className="font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.digest ? `Error reference ${error.digest}. ` : ""}Try again, and if it keeps happening, reload the page.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
