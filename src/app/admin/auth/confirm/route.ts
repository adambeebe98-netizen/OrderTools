import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Handles invite and password-recovery links from Supabase Auth emails. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/admin/account";
  const next = nextParam.startsWith("/admin") && !nextParam.startsWith("//") ? nextParam : "/admin";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
    if (type === "invite" || type === "recovery") dest.searchParams.set("set-password", "1");
  } else {
    dest.pathname = "/admin/login";
    dest.searchParams.set("error", "link");
  }
  return NextResponse.redirect(dest);
}
