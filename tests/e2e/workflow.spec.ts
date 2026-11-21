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

test("technician request to Grainger order, with variants and partial fulfillment", async ({ page, browser }) => {
  // --- Technician picks an exact variant in one sheet, plus a simple item ---
  await page.goto(`/r/${SLUG}`);
  await page.fill("#tech-name", tech);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Drill Bits/ }).click();
  await page.getByRole("button", { name: "Choose Long Bit" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: /Choose type and size/ })).toBeDisabled();
  await expect(sheet.getByRole("radio")).toHaveCount(2); // only Type until a type is chosen
  await sheet.getByRole("radio", { name: "Masonry" }).click();
  await expect(sheet.getByRole("radio")).toHaveCount(5); // Wood, Masonry + 3 masonry sizes
  await sheet.getByRole("radio", { name: '3/8"' }).click();
  await sheet.getByRole("button", { name: /Increase Long Bit/ }).click();
  await sheet.getByRole("button", { name: "Add to request" }).click();
  // Sheet stays open for adding more; Type is kept, Size is cleared for the next pick.
  await expect(sheet.getByRole("status")).toContainText('Added Long Bit — Masonry — 3/8" × 2');
  await expect(sheet.getByRole("radio", { name: "Masonry" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("radio", { name: '1/2"' }).click();
  await sheet.getByRole("button", { name: "Add to request" }).click();
  await expect(sheet.getByText("Already in your request")).toBeVisible();
  await expect(sheet.getByRole("button", { name: 'Remove Long Bit — Masonry — 1/2"' })).toBeVisible();
  await sheet.getByRole("button", { name: 'Remove Long Bit — Masonry — 1/2"' }).click();
  await sheet.getByRole("button", { name: "Close" }).click(); // the X
  await expect(page.getByText("1 added")).toBeVisible();

  // Single-option groups come pre-selected.
  await page.getByRole("button", { name: "Choose Short Bit" }).click();
  await sheet.getByRole("radio", { name: "Masonry" }).click();
  await expect(sheet.getByRole("radio", { name: '1/4"' })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  // Products with a single option (Hole Saw, Speedbor, 3 ft Flex Bit) get a plain + button.
  await expect(page.getByRole("button", { name: "Choose Hole Saw" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Hole Saw" }).click();
  await expect(page.getByRole("button", { name: "Increase Hole Saw" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Hole Saw" }).click(); // back to 0 → removed
  await expect(page.getByRole("button", { name: "Add 3 ft Flex Bit" })).toBeVisible();

  await page.getByRole("button", { name: "Categories" }).click();
  await page.getByRole("button", { name: /Wiring & Connectors/ }).click();
  await page.getByRole("button", { name: /^Add Zip Ties/ }).click();
  await page.goBack(); // phone back button returns to categories, cart kept
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();

  await page.getByRole("button", { name: "Review request" }).click();
  await expect(page.getByRole("dialog")).toContainText('Long Bit — Masonry — 3/8"');
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();
  await expect(page.getByText('Long Bit — Masonry — 3/8"', { exact: true })).toBeVisible();

  // --- Manager sees the exact variant on the request and the shopping list ---
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const base = await login(admin);
  await admin.goto(`${base}/shopping-list`);
  const line = admin.getByRole("listitem").filter({ hasText: 'Long Bit — Masonry — 3/8"' }).first();
  await expect(line).toContainText("DEMO-1001");
  await expect(line).toContainText(`${tech} 2`);

  await admin.goto(`${base}/requests?q=${encodeURIComponent(tech)}`);
  await admin.getByRole("link", { name: new RegExp(tech) }).click();
  await expect(admin.getByRole("heading", { name: tech })).toBeVisible();
  await admin.getByRole("checkbox", { name: /Select Zip Ties/ }).click(); // leave zip ties outstanding
  await admin.getByRole("button", { name: /Mark 1 ordered/ }).click();
  await admin.fill("#order-ref", "E2E-PO-1");
  await admin.getByRole("button", { name: "Mark ordered" }).click();
  await expect(admin.getByText("order E2E-PO-1")).toBeVisible();

  await page.goto(`/r/${SLUG}/history`);
  await expect(page.getByText("1 of 2 ordered")).toBeVisible();

  await admin.goto(`${base}/shopping-list?view=technician`);
  await admin.getByRole("checkbox", { name: "Select all" }).first().click(); // unselect all
  await admin.getByRole("checkbox", { name: `Include all items for ${tech}` }).click();
  await admin.getByRole("button", { name: "Mark selected ordered" }).click();
  await admin.getByRole("button", { name: "Mark ordered" }).click();
  await expect(admin.getByText(/Marked 1 item ordered/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ordered" })).toBeVisible();
});

test("manager adds a variant; technicians can pick it", async ({ page, browser }) => {
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const base = await login(admin);
  await admin.goto(`${base}/catalog`);
  await admin.getByRole("button", { name: /^Hole Saw/ }).click(); // expand group
  await admin.getByRole("button", { name: "Add variant" }).click();
  await admin.getByLabel("Size").fill('1"');
  await admin.getByLabel("Grainger SKU").fill("E2E-HS-1");
  await admin.getByRole("button", { name: "Add variant" }).last().click();
  await expect(admin.getByText("SKU E2E-HS-1")).toBeVisible();

  await page.goto(`/r/${SLUG}`);
  await page.evaluate(() => localStorage.setItem("supply-portal:name", "Variant Viewer"));
  await page.reload();
  await page.getByRole("button", { name: /Drill Bits/ }).click();
  await page.getByRole("button", { name: "Choose Hole Saw" }).click();
  const sizes = page.getByRole("dialog").getByRole("radio");
  await expect(sizes).toHaveText(['3/4"', '1"']);
  await page.keyboard.press("Escape");

  // Never-requested variants can be deleted outright.
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: 'Delete Hole Saw — 1"' }).click();
  await expect(admin.getByText("SKU E2E-HS-1")).toHaveCount(0);
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
