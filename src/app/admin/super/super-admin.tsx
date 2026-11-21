"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import { addManager, createTeam, removeManager, setSuperAdmin, setTeamActive } from "@/lib/actions/team";

type Team = { id: string; name: string; slug: string; is_active: boolean; openRequests: number; managers: string[] };
type Profile = { id: string; email: string; full_name: string | null; is_super_admin: boolean };

export function SuperAdmin({ currentUserId, teams, profiles }: { currentUserId: string; teams: Team[]; profiles: Profile[] }) {
  const router = useRouter();
  const [newTeam, setNewTeam] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            const res = await createTeam(newTeam);
            setCreating(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Team created");
            setNewTeam("");
            router.refresh();
          }}
        >
          <Input placeholder="New team name" aria-label="New team name" value={newTeam} maxLength={100} onChange={(e) => setNewTeam(e.target.value)} />
          <Button type="submit" disabled={!newTeam.trim() || creating}>
            {creating ? <Spinner /> : <Plus />} Create team
          </Button>
        </form>
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} byId={byId} />
        ))}
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4" /> Super admins
        </h2>
        <ul className="divide-y rounded-lg border text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">
                {p.full_name ? `${p.full_name} · ` : ""}
                <span className="text-muted-foreground">{p.email}</span>
              </span>
              <Switch
                checked={p.is_super_admin}
                disabled={p.id === currentUserId}
                aria-label={`Super admin: ${p.email}`}
                onCheckedChange={async (v) => {
                  const res = await setSuperAdmin(p.id, v);
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TeamCard({ team, byId }: { team: Team; byId: Map<string, Profile> }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [usePassword, setUsePassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={`/admin/${team.id}`} className="text-base font-semibold hover:underline">
          {team.name}
        </Link>
        {!team.is_active && <Badge variant="outline">Inactive</Badge>}
        <span className="text-xs text-muted-foreground">
          /r/{team.slug} · {team.openRequests} outstanding
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Active
          <Switch
            checked={team.is_active}
            onCheckedChange={async (v) => {
              const res = await setTeamActive(team.id, v);
              if (!res.ok) return void toast.error(res.error);
              router.refresh();
            }}
          />
        </label>
      </div>
      <ul className="mb-3 divide-y rounded-lg border text-sm">
        {team.managers.length === 0 && <li className="px-3 py-2 text-muted-foreground">No managers yet.</li>}
        {team.managers.map((id) => {
          const p = byId.get(id);
          return (
            <li key={id} className="flex items-center justify-between px-3 py-1.5">
              <span>{p?.full_name || p?.email}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p?.email} from ${team.name}`}
                onClick={async () => {
                  const res = await removeManager(team.id, id);
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                }}
              >
                <UserMinus />
              </Button>
            </li>
          );
        })}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await addManager(team.id, email, usePassword ? password : undefined);
          setBusy(false);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? "Manager added");
          setEmail("");
          setPassword("");
          router.refresh();
        }}
      >
        <Input type="email" placeholder="manager@company.com" aria-label={`Add manager to ${team.name}`} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy && <Spinner />} Add manager
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
          <Switch checked={usePassword} onCheckedChange={setUsePassword} /> New person: set a temporary password instead of emailing an invite
        </label>
        {usePassword && (
          <Input
            type="text"
            placeholder="Temporary password (10+ characters)"
            aria-label="Temporary password"
            value={password}
            minLength={10}
            onChange={(e) => setPassword(e.target.value)}
            className="sm:col-span-2"
            autoComplete="off"
          />
        )}
      </form>
    </div>
  );
}
