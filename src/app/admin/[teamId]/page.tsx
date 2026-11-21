import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, Clock, PackageCheck, ShoppingCart, Sparkles, Users, ClipboardList } from "lucide-react";
import { requireTeam } from "@/lib/auth";
import { getDashboard, getLastSeen } from "@/lib/data/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDateTime, plural, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { supabase, user, team } = await requireTeam(teamId);
  const { lastSeen, isMember } = await getLastSeen(supabase, teamId, user.id);
  const d = await getDashboard(supabase, teamId, lastSeen);

  if (isMember) {
    after(async () => {
      await supabase.from("team_members").update({ last_seen_at: new Date().toISOString() }).eq("team_id", teamId).eq("user_id", user.id);
    });
  }

  const base = `/admin/${teamId}`;
  const stats = [
    { label: "Outstanding requests", value: d.outstandingRequests, icon: ClipboardList, href: `${base}/requests` },
    { label: "Technicians waiting", value: d.techniciansWaiting.length, icon: Users, href: `${base}/shopping-list?view=technician` },
    { label: "New since last visit", value: d.newSinceLastVisit, icon: Sparkles, href: `${base}/requests`, highlight: d.newSinceLastVisit > 0 },
    { label: "Items to order", value: d.outstandingItems, icon: ShoppingCart, href: `${base}/shopping-list` },
  ];

  return (
    <>
      <PageHeader
        title={team.name}
        description={`Last visit ${timeAgo(lastSeen)}`}
        actions={
          d.outstandingItems > 0 && (
            <Button asChild>
              <Link href={`${base}/shopping-list`}>
                <ShoppingCart /> Open shopping list
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className={s.highlight ? "border-primary/40 bg-accent/50" : "transition-colors group-hover:border-input"}>
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium sm:text-sm">{s.label}</span>
                  <s.icon className="size-4" aria-hidden />
                </div>
                <span className={`text-2xl font-semibold tabular-nums sm:text-3xl ${s.highlight ? "text-primary" : ""}`}>{s.value}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Waiting on an order</CardTitle>
            <Link href={`${base}/requests`} className="text-sm text-primary hover:underline">
              All requests
            </Link>
          </CardHeader>
          <CardContent>
            {d.techniciansWaiting.length === 0 ? (
              <EmptyState icon={<PackageCheck />} title="All caught up" description="Nothing is waiting to be ordered." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {d.techniciansWaiting.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`${base}/requests?technician=${t.id}&status=requested`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {t.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.name}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" aria-hidden /> waiting since {timeAgo(t.oldest)}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">{plural(t.items, "item")}</span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recently ordered</CardTitle>
            </CardHeader>
            <CardContent>
              {d.recentBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders marked yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {d.recentBatches.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 rounded-md bg-success-soft p-1.5 text-success">
                        <PackageCheck className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {plural(b.itemCount, "item")} · {plural(b.requestCount, "request")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(b.created_at)}
                          {b.reference && ` · Order ${b.reference}`}
                          {b.by && ` · ${b.by}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {d.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="relative grid gap-3 border-l pl-4">
                  {d.activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="absolute -left-1 mt-1.5 size-2 rounded-full bg-input" aria-hidden />
                      {a.request_id ? (
                        <Link href={`${base}/requests/${a.request_id}`} className="hover:underline">
                          {a.summary}
                        </Link>
                      ) : (
                        a.summary
                      )}
                      <span className="block text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
