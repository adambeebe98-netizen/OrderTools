# Technician Supply Request Portal — Architecture & Plan

## 1. Decisions made (defaults chosen where the spec left room)

| Question | Decision | Why |
| --- | --- | --- |
| How do technicians reach their team? | A **team link** `/r/<team-slug>`. The slug has a random suffix (e.g. `north-install-k7q2m9`) and managers can rotate it. | Zero friction, no codes to type. Works as the team identifier and as a soft access control. |
| Technician identity | Name typed once, stored in `localStorage`. On submit the server does find-or-create of a `technicians` row by normalized name (`"  mike  S"` → `mike s`) **within the team**. | No accounts. Managers can rename or merge duplicates. |
| Request history privacy | History is looked up by *team link + name*. It returns only date, item names, quantities, statuses, and the technician's own notes for the last 120 days. No addresses, phone numbers, manager notes, or team roster are ever exposed publicly. Lookups are rate limited. | A name isn't authentication, so the history page shows only low-sensitivity data that's fine for a teammate to see. |
| Statuses | Status lives on each **request item** (`requested` / `ordered`). The request status is derived by a trigger: a request is `ordered` only when every active item is ordered. | Makes partial fulfillment correct by construction. |
| Removing items | Soft delete (`removed_at`). If every item on a request is removed, the request is hidden (`requests.removed_at`). | Fixes accidents and duplicates while keeping an audit trail. |
| Ordering batches | Marking items ordered creates a lightweight `order_batches` row with an optional Grainger order number. | Lets you answer "what went on the order from Tuesday?" without building a procurement workflow. |
| Admin auth | Supabase Auth email + password. Managers are invited by a super admin. Public sign-ups should be **disabled** in Supabase. | No SMTP setup needed to get started. Even an account created by someone else can see nothing without a team membership. |
| Data access | Admin pages use the **logged-in user's** Supabase client, so Postgres Row Level Security enforces team isolation on every query. Public technician endpoints run on the server with the service-role key, scoped by team slug, behind validation and rate limits. `anon` has no table access at all. | Isolation is enforced in the database, not only in app code. |
| Abuse protection | Postgres-backed fixed-window rate limits (per hashed IP + team, and per team), a honeypot field, strict Zod validation, and caps on item count, quantity, and text length. | Works on Vercel serverless without Redis, and technicians never see a CAPTCHA. |
| Push | Standard Web Push (VAPID) via `web-push`. Subscriptions are stored server-side per manager device and sent after the response using `after()`. Dead subscriptions are pruned. | Works on Android/desktop Chrome, Edge, and Firefox, and on iOS 16.4+ when installed. |
| In-app fallback | The admin layout polls an unread count every 30 s and shows a badge. "New since last visit" uses `team_members.last_seen_at`. | Works with push disabled. |
| PWA | Hand-written service worker (`public/sw.js`) for push + offline fallback. A dynamic manifest per team link, so the installed technician app opens straight to their team. | Avoids fragile PWA plugins on the App Router. |

## 2. Architecture

```
Browser (tech, phone)          Browser (manager)
   │  /r/<slug>                    │  /admin/<teamId>/...
   ▼                               ▼
Next.js 15 (App Router, Vercel)
 ├─ Server Components: read data
 ├─ Route handlers: public submit / history (service role + rate limit)
 ├─ Server Actions: admin mutations (user session → RLS)
 └─ after(): web-push fan-out
   │
   ▼
Supabase: Postgres (RLS, triggers, RPCs) · Auth (managers) · Storage (catalog images)
```

## 3. Database schema (see `supabase/migrations`)

- `profiles` (1:1 with `auth.users`): `email`, `full_name`, `is_super_admin`
- `teams`: `name`, `slug` (public link), `is_active`
- `team_members`: `team_id`, `user_id`, `notify_new_requests`, `last_seen_at`
- `technicians`: `team_id`, `name`, `name_key` (unique per team), `archived_at`, `last_request_at`
- `categories`: `team_id`, `name`, `sort_order`, `archived_at`
- `catalog_items`: `team_id`, `category_id`, `name`, `description`, `image_url`, `grainger_sku`, `grainger_url`, `unit`, `sort_order`, `archived_at`
- `requests`: `team_id`, `technician_id`, `technician_name` (snapshot), `note`, `status` (derived), `ordered_at`, `removed_at`
- `request_items`: `request_id`, `team_id`, `catalog_item_id?`, snapshots (`name`, `unit`, `grainger_sku`, `grainger_url`), `quantity`, `is_custom`, `custom_note`, `custom_url`, `status`, `ordered_at`, `ordered_by`, `order_batch_id`, `removed_at`
- `order_batches`: `team_id`, `reference` (Grainger order #), `created_by`
- `activity_events`: `team_id`, `request_id`, `actor_id`, `kind`, `summary`
- `push_subscriptions`: `user_id`, `endpoint`, `p256dh`, `auth`
- `rate_limits`: `key`, `window_start`, `count`

Composite foreign keys (`(x_id, team_id)`) keep every cross-table reference inside one team.

## 4. Screens

**Technician** (`/r/<slug>`)
1. Name prompt (first visit only; editable from the header)
2. Catalog: search box first, category chips, item cards with large − / + steppers
3. "Other item" sheet: name, quantity, why, link
4. Review sheet: edit quantities, add a note, submit → success screen
5. My requests: date, items, quantities, Requested/Ordered badges

**Manager** (`/admin/<teamId>`)
1. Dashboard: outstanding requests, technicians waiting, new since last visit, recently ordered, activity
2. Requests: filters (technician, status), search, date sort, multi-select → mark ordered
3. Request detail: edit quantities, remove items, mark items/request ordered, undo
4. Shopping list: by product / by technician, item-level selection, copy / CSV / Grainger quick-order, mark selected ordered (with optional order #)
5. Catalog: items, categories, CSV import, image upload, custom-item review → convert to product
6. Technicians: rename, merge duplicates, archive
7. Settings: team link + QR code, rotate link, push notifications on/off for this device
8. Super admin: teams, managers

## 5. Implementation plan

- **Phase 1**: schema + RLS + RPCs, technician catalog/cart/submit, admin login, dashboard, request list/detail
- **Phase 2**: shopping list (both views, partial ordering, export), bulk actions, technician history, catalog management + CSV import + custom-item conversion
- **Phase 3**: web push + in-app indicator, multi-team + super admin, rate limiting/honeypot, PWA, tests, deployment docs
