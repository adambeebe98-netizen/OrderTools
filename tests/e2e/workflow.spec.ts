import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end: technician submits → manager sees it → partial order → technician
 * sees partial status → manager orders the rest → technician sees Ordered.
 * Requires the local Supabase stack with seed data (`npx supabase db reset`).
 */
const SLUG = "north-install-demo";
const tech = `E2E Tech ${Date.now().toString(36)}`;

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.fill("#email", "manager@example.com");
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/[0-9a-f-]{36}$/);
  return page.url();
}

test("technician request to Grainger order, with partial fulfillment", async ({ page, browser }) => {
  // --- Technician submits ---
  await page.goto(`/r/${SLUG}`);
  await page.fill("#tech-name", tech);
  await page.getByRole("button", { name: "Continue" }).click();
  // Browse by category: open one, add items with +, go back, open another.
  await page.getByRole("button", { name: /Anchors & Fasteners/ }).click();
  await page.getByRole("button", { name: /^Add Toggle Bolts/ }).click();
  await page.getByRole("button", { name: /^Increase Toggle Bolts/ }).click();
  await page.getByRole("button", { name: "Categories" }).click();
  await expect(page.getByText("1 added")).toBeVisible();
  await page.getByRole("button", { name: /Safety & Cleanup/ }).click();
  await page.getByRole("button", { name: /^Add Shoe Covers/ }).click();
  await page.goBack(); // phone back button returns to categories, cart kept
  await expect(page.getByText("Most ordered")).toBeVisible();
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(page.getByRole("dialog")).toContainText(tech);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();

  // Name is remembered on reload; history shows Requested.
  await page.goto(`/r/${SLUG}/history`);
  await expect(page.getByText("Waiting to be ordered")).toBeVisible();
  await expect(page.getByText("Toggle Bolts 1/8\" (Snaptoggle)")).toBeVisible();

  // --- Manager orders one of the two items ---
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const base = await login(admin);
  await admin.goto(`${base}/requests?q=${encodeURIComponent(tech)}`);
  await admin.getByRole("link", { name: new RegExp(tech) }).click();
  await expect(admin.getByRole("heading", { name: tech })).toBeVisible();
  await admin.getByRole("checkbox", { name: /Select Shoe Covers/ }).click(); // leave shoe covers outstanding
  await admin.getByRole("button", { name: /Mark 1 ordered/ }).click();
  await admin.fill("#order-ref", "E2E-PO-1");
  await admin.getByRole("button", { name: "Mark ordered" }).click();
  await expect(admin.getByText("order E2E-PO-1")).toBeVisible();

  // Technician sees partial progress.
  await page.reload();
  await expect(page.getByText("1 of 2 ordered")).toBeVisible();

  // --- Manager orders the rest from the shopping list (by technician) ---
  await admin.goto(`${base}/shopping-list?view=technician`);
  await admin.getByRole("checkbox", { name: "Select all" }).first().click(); // unselect all
  await admin.getByRole("checkbox", { name: `Include all items for ${tech}` }).click();
  await admin.getByRole("button", { name: "Mark selected ordered" }).click();
  await admin.getByRole("button", { name: "Mark ordered" }).click();
  await expect(admin.getByText(/Marked 1 item ordered/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ordered" })).toBeVisible();
  await expect(page.getByText("Waiting to be ordered")).toHaveCount(0);
});

test("other team's manager cannot open this team", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/login");
  await page.fill("#email", "other@example.com");
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/[0-9a-f-]{36}$/);
  // North team id from the seed (uuid v5, stable).
  const res = await page.goto("/admin/fb4dc8c8-25c3-5605-ad64-5e2129faa323/requests");
  expect(res?.status()).toBe(404);
});

test("public API rejects bad input and silently drops honeypot submissions", async ({ request }) => {
  const bad = await request.post(`/api/r/${SLUG}/requests`, { data: { name: "", items: [] } });
  expect(bad.status()).toBe(400);
  const missing = await request.post(`/api/r/not-a-team-zzz/requests`, {
    data: { name: "x", items: [{ custom_name: "a", quantity: 1 }] },
  });
  expect(missing.status()).toBe(404);
  const bot = await request.post(`/api/r/${SLUG}/requests`, {
    data: { name: "Bot", items: [{ custom_name: "spam", quantity: 1 }], website: "http://spam" },
  });
  expect(bot.status()).toBe(201);
  const hist = await request.post(`/api/r/${SLUG}/history`, { data: { name: "Bot" } });
  expect((await hist.json()).requests).toEqual([]);
});
