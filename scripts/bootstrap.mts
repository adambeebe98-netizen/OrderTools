/**
 * First-time production setup: creates (or finds) a super-admin account and a team.
 *
 *   npm run bootstrap -- --email you@company.com --password 'a-long-password' --team "North Install Team"
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL
 * from the environment (e.g. `node --env-file=.env.production.local`).
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import { makeTeamSlug } from "../src/lib/names.ts";

const { values } = parseArgs({
  options: { email: { type: "string" }, password: { type: "string" }, team: { type: "string" }, name: { type: "string" } },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
if (!values.email) throw new Error("--email is required");

const db = createClient(url, key, { auth: { persistSession: false } });
const email = values.email.trim().toLowerCase();

let { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
if (!profile) {
  if (!values.password || values.password.length < 10) throw new Error("--password (10+ characters) is required for a new account");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: values.password,
    email_confirm: true,
    user_metadata: values.name ? { full_name: values.name } : undefined,
  });
  if (error) throw error;
  profile = { id: data.user.id };
  console.log(`Created account ${email}`);
} else {
  console.log(`Found existing account ${email}`);
}

const { error: saErr } = await db.from("profiles").update({ is_super_admin: true }).eq("id", profile.id);
if (saErr) throw saErr;
console.log("Granted super admin");

if (values.team) {
  const { data: team, error } = await db.from("teams").insert({ name: values.team, slug: makeTeamSlug(values.team) }).select("id, slug").single();
  if (error) throw error;
  await db.from("team_members").insert({ team_id: team.id, user_id: profile.id });
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`Created team "${values.team}"`);
  console.log(`  Technician link: ${site}/r/${team.slug}`);
  console.log(`  Dashboard:       ${site}/admin/${team.id}`);
}
