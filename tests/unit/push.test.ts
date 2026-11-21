import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendNotification = vi.fn();
// Shape matches the real CommonJS module (no default export).
vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification }));

// Minimal fake of the Supabase query builder used by push.ts.
const deleted: string[][] = [];
const tables: Record<string, Record<string, unknown>[]> = {
  team_members: [
    { team_id: "team", user_id: "u1", notify_new_requests: true },
    { team_id: "team", user_id: "u2", notify_new_requests: false },
  ],
  push_subscriptions: [
    { id: "s1", user_id: "u1", endpoint: "https://push/ok", p256dh: "k", auth: "a" },
    { id: "s2", user_id: "u1", endpoint: "https://push/gone", p256dh: "k", auth: "a" },
    { id: "s3", user_id: "u2", endpoint: "https://push/optedout", p256dh: "k", auth: "a" },
  ],
};
function query(table: string) {
  let rows = tables[table];
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => ((rows = rows.filter((r) => r[col] === val)), q),
    in: (col: string, vals: unknown[]) => ((rows = rows.filter((r) => vals.includes(r[col]))), q),
    delete: () => ({ in: (_c: string, ids: string[]) => (deleted.push(ids), Promise.resolve({})) }),
    then: (resolve: (v: { data: unknown }) => void) => resolve({ data: rows }),
  };
  return q;
}
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: query }) }));

describe("notifyTeamManagers", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendNotification.mockReset();
    deleted.length = 0;
  });

  it("sends only to opted-in managers and prunes expired subscriptions", async () => {
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    });
    const { notifyTeamManagers } = await import("@/lib/push");
    const res = await notifyTeamManagers("team", { title: "t", body: "b", url: "/admin/team/requests/1" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const endpoints = sendNotification.mock.calls.map((c) => c[0].endpoint);
    expect(endpoints).not.toContain("https://push/optedout");
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({ url: "/admin/team/requests/1" });
    expect(res.sent).toBe(1);
    expect(deleted).toEqual([["s2"]]);
  });

  it("is a no-op when VAPID keys are missing", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { notifyTeamManagers } = await import("@/lib/push");
    expect(await notifyTeamManagers("team", { title: "t", body: "b", url: "/" })).toEqual({ sent: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
