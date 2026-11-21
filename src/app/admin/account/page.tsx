import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { AccountForms } from "./account-forms";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ "set-password"?: string }> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mb-6 text-sm text-muted-foreground">{profile.email}</p>
      <AccountForms fullName={profile.full_name ?? ""} mustSetPassword={sp["set-password"] === "1"} />
    </main>
  );
}
