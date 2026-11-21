import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Manager sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/icons/icon-192.png" alt="" className="mx-auto mb-3 size-12 rounded-xl" />
          <h1 className="text-xl font-semibold tracking-tight">Manager sign in</h1>
          <p className="text-sm text-muted-foreground">Supply Requests dashboard</p>
        </div>
        <LoginForm next={next} initialError={error === "link" ? "That sign-in link is invalid or has expired." : undefined} />
      </div>
    </main>
  );
}
