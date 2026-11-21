"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronsUpDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string; slug: string };

const NAV = [
  { href: "", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/requests", label: "Requests", icon: ClipboardList, mobile: true, badge: "outstanding" as const },
  { href: "/shopping-list", label: "Shopping list", icon: ShoppingCart, mobile: true },
  { href: "/catalog", label: "Catalog", icon: Package, mobile: true },
  { href: "/technicians", label: "Technicians", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useUnread(teamId: string) {
  const [counts, setCounts] = React.useState<{ newCount: number; outstanding: number } | null>(null);
  const router = useRouter();
  const prevNew = React.useRef<number | null>(null);

  React.useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/admin/${teamId}/unread`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { newCount: number; outstanding: number };
        if (stopped) return;
        // New request arrived while the page is open → refresh server data.
        if (prevNew.current !== null && data.newCount > prevNew.current) router.refresh();
        prevNew.current = data.newCount;
        setCounts(data);
      } catch {
        // offline: keep last value
      }
    };
    load();
    const t = setInterval(load, 30_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [teamId, router]);

  return counts;
}

export function AdminShell({
  team,
  teams,
  user,
  children,
}: {
  team: Team;
  teams: Team[];
  user: { email: string; name: string | null; isSuperAdmin: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/${team.id}`;
  const counts = useUnread(team.id);
  const isActive = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));

  return (
    <div className="min-h-dvh bg-muted/30 lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card lg:flex">
        <div className="p-3">
          <TeamSwitcher team={team} teams={teams} />
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Admin">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={base + item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                isActive(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge && counts && counts.outstanding > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">{counts.outstanding}</span>
              )}
            </Link>
          ))}
          {user.isSuperAdmin && (
            <Link
              href="/admin/super"
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="size-4" aria-hidden /> Teams &amp; admins
            </Link>
          )}
        </nav>
        <div className="border-t p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur lg:bg-card/80">
          <div className="min-w-0 flex-1 lg:hidden">
            <TeamSwitcher team={team} teams={teams} compact />
          </div>
          <div className="hidden flex-1 lg:block" />
          <Link
            href={`${base}/requests?status=requested&new=1`}
            className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={counts?.newCount ? `${counts.newCount} new requests` : "No new requests"}
          >
            <Bell className="size-5" />
            {!!counts?.newCount && (
              <span className="absolute right-1 top-1 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4.5 text-white">
                {counts.newCount > 99 ? "99+" : counts.newCount}
              </span>
            )}
          </Link>
          <div className="lg:hidden">
            <UserMenu user={user} compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:py-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Admin">
        {NAV.filter((n) => n.mobile).map((item) => (
          <Link
            key={item.href}
            href={base + item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive(item.href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden />
            {item.label === "Shopping list" ? "Shopping" : item.label}
            {item.badge && counts && counts.outstanding > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {counts.outstanding}
              </span>
            )}
          </Link>
        ))}
        <MoreMenu base={base} isSuperAdmin={user.isSuperAdmin} active={isActive("/technicians") || isActive("/settings")} />
      </nav>
    </div>
  );
}

function TeamSwitcher({ team, teams, compact }: { team: Team; teams: Team[]; compact?: boolean }) {
  if (teams.length <= 1) {
    return (
      <div className={cn("flex items-center gap-2", !compact && "rounded-lg p-1.5")}>
        <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{team.name}</p>
          <p className="text-xs text-muted-foreground">Supply requests</p>
        </div>
      </div>
    );
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted">
        <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{team.name}</p>
          <p className="text-xs text-muted-foreground">Switch team</p>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className="z-50 min-w-56 rounded-xl border bg-card p-1 shadow-lg">
          {teams.map((t) => (
            <DropdownMenu.Item key={t.id} asChild>
              <Link
                href={`/admin/${t.id}`}
                className={cn("flex rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted", t.id === team.id && "font-semibold")}
              >
                {t.name}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UserMenu({ user, compact }: { user: { email: string; name: string | null }; compact?: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn("flex items-center gap-2 rounded-lg text-left hover:bg-muted", compact ? "size-10 justify-center" : "w-full p-1.5")}
        aria-label="Account menu"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-4" />
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
            {user.name && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
          </span>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-xl border bg-card p-1 shadow-lg">
          <DropdownMenu.Item asChild>
            <Link href="/admin/account" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted">
              <UserRound className="size-4" /> Account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted"
            onSelect={() => signOut()}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MoreMenu({ base, isSuperAdmin, active }: { base: string; isSuperAdmin: boolean; active: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
      >
        <MoreHorizontal className="size-5" aria-hidden />
        More
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="end" sideOffset={8} className="z-50 min-w-52 rounded-xl border bg-card p-1 shadow-lg">
          {[
            { href: `${base}/technicians`, label: "Technicians", icon: Users },
            { href: `${base}/settings`, label: "Settings & notifications", icon: Settings },
            ...(isSuperAdmin ? [{ href: "/admin/super", label: "Teams & admins", icon: ShieldCheck }] : []),
          ].map((i) => (
            <DropdownMenu.Item key={i.href} asChild>
              <Link href={i.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted">
                <i.icon className="size-4" /> {i.label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
