import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyTeams, requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default async function AdminIndex() {
  const { profile } = await requireUser();
  const teams = await listMyTeams();
  if (teams.length > 0) redirect(`/admin/${teams[0].id}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">No team yet</h1>
      <p className="text-muted-foreground">
        You&apos;re signed in as {profile.email}, but you haven&apos;t been added to a team. Ask your administrator to add you.
      </p>
      <div className="flex gap-2">
        {profile.is_super_admin && (
          <Button asChild>
            <Link href="/admin/super">Create a team</Link>
          </Button>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
