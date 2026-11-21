import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-foreground",
        requested: "border-warning/30 bg-warning-soft text-warning",
        ordered: "border-success/30 bg-success-soft text-[oklch(0.82_0.12_155)]",
        primary: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border text-muted-foreground",
        custom: "border-accent-foreground/20 bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: "requested" | "ordered" | string }) {
  return status === "ordered" ? (
    <Badge variant="ordered">
      <span className="size-1.5 rounded-full bg-success" aria-hidden /> Ordered
    </Badge>
  ) : (
    <Badge variant="requested">
      <span className="size-1.5 rounded-full bg-warning" aria-hidden /> Requested
    </Badge>
  );
}
