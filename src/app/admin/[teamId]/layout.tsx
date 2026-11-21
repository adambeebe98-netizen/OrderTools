import type { Metadata } from "next";
import { listMyTeams, requireTeam } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = { manifest: "/admin/manifest.webmanifest" };

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { team, profile } = await requireTeam(teamId);
  const teams = await listMyTeams();
  return (
    <AdminShell
      team={team}
      teams={teams}
      user={{ email: profile.email, name: profile.full_name, isSuperAdmin: profile.is_super_admin }}
    >
      {children}
      <ServiceWorkerRegister />
    </AdminShell>
  );
}
