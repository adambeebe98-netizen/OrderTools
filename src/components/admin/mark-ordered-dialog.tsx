"use client";

import * as React from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MarkOrderedDialog({
  open,
  onOpenChange,
  summary,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: React.ReactNode;
  onConfirm: (reference: string) => Promise<void>;
}) {
  const [reference, setReference] = React.useState("");
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    if (open) setReference("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              await onConfirm(reference.trim());
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Mark as ordered</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-4">
            <Field label="Grainger order number (optional)" htmlFor="order-ref" hint="Saved with this batch so you can look it up later.">
              <Input id="order-ref" value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 1234567890" autoComplete="off" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={pending}>
              {pending ? <Spinner /> : <PackageCheck />} Mark ordered
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
