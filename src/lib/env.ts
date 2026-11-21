function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  vapidPublicKey: () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
};

export const serverEnv = {
  serviceRoleKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  rateLimitSalt: () => process.env.RATE_LIMIT_SALT || "",
  vapidPrivateKey: () => process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: () => process.env.VAPID_SUBJECT || "mailto:admin@example.com",
};
