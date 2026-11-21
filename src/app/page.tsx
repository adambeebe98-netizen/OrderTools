import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-2xl bg-primary/10 p-4 text-primary">
        <PackageSearch className="size-10" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Supply Requests</h1>
        <p className="text-muted-foreground">
          Technicians: open the team link your manager sent you to request supplies.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/admin">Manager sign in</Link>
      </Button>
    </main>
  );
}
