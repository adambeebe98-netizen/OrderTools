"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, checkRateLimits, clientFingerprint } from "@/lib/rate-limit";

export type FormState = { error?: string; ok?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!(await checkRateLimits([LIMITS.loginPerClient(await clientFingerprint())]))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Incorrect email or password." };
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

const passwordSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return { ok: "Password updated." };
}

export async function updateProfileName(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = z.string().trim().max(100).safeParse(formData.get("full_name"));
  if (!name.success) return { error: "Name is too long" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { error } = await supabase.from("profiles").update({ full_name: name.data || null }).eq("id", user.id);
  if (error) return { error: "Could not save." };
  return { ok: "Saved." };
}

export async function sendPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email" };
  if (!(await checkRateLimits([LIMITS.loginPerClient(await clientFingerprint())]))) {
    return { error: "Too many attempts. Please wait a few minutes." };
  }
  const supabase = await createClient();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${site}/admin/auth/confirm?next=/admin/account`,
  });
  // Same response whether or not the account exists.
  return { ok: "If that email has an account, a reset link is on its way." };
}
