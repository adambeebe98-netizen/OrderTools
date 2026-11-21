# Handoff: redesign the supply icons

You're picking up a small, self-contained design + code task in an existing Next.js app (OrderTools, a supply request portal for smart-home installation technicians). Technicians open it on their phones, tap a category, and tap **+** next to supplies. Every product shows a small line icon. The current icons were drawn quickly, and several don't look like the real object (the Speedbor is the worst: it reads as a shield, not a spade bit). **Your job: redesign all 16 icons so each one is an honest, instantly recognizable, minimal line drawing of the real object, then implement and ship them.**

Spend your effort on the drawing. The code change itself is one file.

---

## 1. Where things live

| File | What it is |
| --- | --- |
| `src/components/icons/supply-icons.tsx` | **The only file you need to edit.** An `ICONS` object mapping each key to `{ label, d }`, where `d` is the JSX inside the `<svg>`. `SupplyIcon` renders it. |
| `src/lib/icon-names.ts` | The list of valid icon keys. **Do not rename or remove keys**: the database stores these strings on products. (Adding new keys is fine, see §6.) |
| `src/components/admin/catalog-products.tsx` | Manager's icon picker (grid of all icons). Picks up changes automatically. |
| `src/components/tech/technician-app.tsx` | Technician screen. Renders icons at **28px** inside a 48px rounded tile (`bg-muted`), and the sheet header at 44px. |

How `SupplyIcon` renders (keep this contract):

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
     strokeLinecap="round" strokeLinejoin="round">{icon.d}</svg>
```

The app is **dark themed**: icons are drawn in near-white (`text-foreground/85`) on a dark grey tile (~#2a2d36). The manager's picker also shows them in the primary blue when selected.

---

## 2. Style rules (apply to every icon)

- **Canvas:** `viewBox="0 0 24 24"`. Keep artwork inside a **2px safe margin** (2 → 22) so the strokes never clip; the object should fill most of the live area.
- **Stroke only:** `fill="none"`, `stroke="currentColor"`, width **1.75** (inherited; don't set it per path). Round caps and joins. No fills, gradients, opacity tricks or text.
- **Simple:** about **3–7 elements** per icon. Smallest gap between parallel strokes ≥ **1.5 units**, otherwise it smears into a blob at phone size. Prefer one strong silhouette plus 1–3 defining details over many small details.
- **Grid:** put coordinates on whole or half units where you can (crisp rendering).
- **Consistent orientation:**
  - **Bits and fasteners** (twist bit, hole saw, spade bit, screw): draw them **diagonal at 45°, shank at top-right, working end at bottom-left**. This uses the square well and makes them feel like one family.
  - **Everything else:** upright, front or slight ¾ view, whichever is most recognizable.
- **Visual weight:** all icons should feel the same size and density side by side. Check them together in the preview sheet (§5), not one at a time.
- **Style reference:** think Lucide/Feather icons. Clean, friendly, geometric, a bit rounded.
- **Test sizes:** they must read at **28px** (main use) and still be identifiable at **16px**.

---

## 3. The icons, one by one

For each: what the real object is, what makes it recognizable (the "must-have" features), what to avoid, and what's wrong today. The **key** column must stay exactly as written.

### Drill bits family (diagonal, shank top-right → tip bottom-left)

**`drill-bit`: twist drill bit.** Used for Short Bit, Long Bit, Extra-Long Bit (wood and masonry) and the 3 ft Flex Bit.
- Real object: a straight cylinder. The top ~35% is the smooth round **shank**; the rest is the **fluted body**, two spiral grooves wrapping around it; it ends in a **pointed tip** (~118° cone).
- Must have: the long narrow silhouette; a clear change between the smooth shank and the twisted body; 3–4 parallel slanted lines across the body suggesting the spiral; a pointed end.
- Avoid: looking like a pencil (no eraser/ferrule band), a screw (no head) or a nail.
- Today: vertical, a bit stubby, flute lines cramped. Make it diagonal and longer, with cleaner flutes.

**`hole-saw`: hole saw on an arbor.**
- Real object: a short, wide steel **cup** (cylinder open at the bottom) whose bottom rim is a row of **saw teeth**. A **pilot drill bit** runs down the center and sticks out past the teeth. A short **arbor shank** comes out the top.
- Must have: a wide cup shape (wider than tall); a zig-zag tooth edge on the open end; the pilot bit poking out beyond the teeth; the shank on the closed end.
- A slight ¾ view (an ellipse for the open end) can read better than a flat side view, as long as it stays simple. Your call.
- Avoid: looking like a crown, a cake or a bucket. The teeth and pilot bit are what sell it.
- Today: OK-ish, but flat and the pilot bit is weak.

**`spade-bit`: Speedbor (spade/paddle bit).** ⚠️ The most wrong one today.
- Real object (Irwin Speedbor): a long thin **hex shank** that ends in a **flat paddle blade**, a thin flat steel plate much wider than the shank. Its cutting end has a **long, sharp center point** (lead spur) that sticks out well past the blade, and **two small pointed spurs at the outer corners**. Speedbors also have a round **hole punched in the paddle** near the shank. Overall it looks like a flat shovel or spade on a stick, with a spike in the middle.
- Must have: the thin shaft; a flat rectangular or slightly tapered paddle clearly wider than the shaft; the cutting edge with a long center spike and two short corner spurs (like a trident or a "W" with a long middle stroke); optional small circle in the paddle.
- Avoid: a pentagon, shield or arrowhead outline (today's mistake), or a solid triangle point.
- Today: a pentagon on a stick. Redesign from scratch.

**`screw`: install screw (wood/drywall, Phillips).**
- Real object: a flat countersunk **head** (seen from the side, a wide short wedge), a **threaded shank** with slanted thread lines, and a sharp **point**.
- Must have: a head clearly wider than the shank; 3–4 slanted thread lines; a pointed tip. Follow the diagonal orientation of the bit family.
- Avoid: looking like the drill bit. The head is the difference, so make it obvious.
- Today: OK but vertical and the head is boxy. Make it diagonal with a proper countersunk wedge head.

### Wiring & connectors

**`rj45`: RJ45 (Ethernet) plug.**
- Real object: a small clear plastic rectangular plug with **8 gold contacts** across its front end, a **springy latch tab** on one face angling back, and the **cable** exiting the rear through a short boot.
- Must have: the rectangular body; a row of contact lines at the front end (draw **3–4**, not 8); the cable leaving the back; ideally the latch hint (a line angling off the body).
- Suggested view: plug pointing up, cable going down out of the bottom. That's the familiar "network port" silhouette.
- Avoid: looking like a USB stick, a battery or a tooth.
- Today: a box with lines and a tab at the bottom; no cable, so it's ambiguous.

**`gel-connector`: "dolphin beans" (UY/UR gel-filled crimp connectors).**
- What techs mean: tiny bean-sized translucent connectors filled with gel, used for low-voltage alarm wire. Two or three thin wires go into **holes on one end**; you squeeze the **raised button/cap on top** with pliers to crimp them.
- Must have: a small rounded rectangular body (bean/pill shaped); a raised button on top (a smaller rounded rectangle sitting on the body); **2 wires** entering from one end.
- Avoid: looking like a plug or a car. Keep the body compact and the wires thin and parallel.
- Today: close, but the body is plug-like. Make it more of a rounded "bean" with an obvious crimp button.

**`wire-nut`: twist-on wire connector.**
- Real object: a **cone/thimble** shape with a rounded top, **spiral ribs** on the outside for grip (sometimes small wings), and an open bottom where **2 twisted wires** go in.
- Must have: the rounded cone; 2–3 ribs (slightly slanted reads as "twist"); 2 wires coming out the bottom.
- Avoid: looking like a rocket, a bullet or a traffic cone (no flat base plate).
- Today: decent. Refine proportions and make the ribs slant.

**`tape`: tape roll.** Used for Electrical Tape and Double-Sided Mounting Tape.
- Real object: a roll, i.e. a thick ring (outer edge and inner cardboard core) with the **loose end peeling off** tangentially.
- Must have: two concentric circles (a thick band, not two thin lines close together; keep the ≥1.5 gap); a tail strip leaving the outer edge tangentially, with a cut end.
- Avoid: looking like a donut or a target (the tail is what makes it tape).
- Today: good. Light polish only. Keep it balanced in the square (the roll is currently off-center left).

**`zip-tie`: cable tie.**
- Real object: a long thin strap with a small square **ratchet head** at one end. In use it's **looped** into a circle with the tail passing through the head and **sticking out**.
- Must have: the loop; the square head where the loop closes; the tail sticking out of the head; optionally 2–3 tick marks for the teeth on the tail.
- Avoid: looking like a lasso, a key or a padlock.
- Today: reads a bit like a key or a person. Make the loop bigger and the head and tail clearer.

**`staple`: insulated cable staple.**
- Real object (what installers use for coax/Cat6): a plastic **saddle/arch** that straddles a cable, with a **steel nail** through each side (or one nail through the top). Hammered into a stud, it holds the cable against the wood.
- Must have: a cable (a circle in cross-section, or a short horizontal line run); the arch over it; nail(s) going down through the arch's flanges into a surface line.
- Avoid: an office staple or a horseshoe magnet.
- Today: an arch over a circle with feet. Close, but it reads as a magnet. Adding nail heads and shanks plus a surface line will fix it.

### Mounting & sealing

**`sign`: security yard sign.**
- Real object: smart-home and alarm companies put a **small rectangular sign on a metal stake** in the customer's yard. The common stake is an "H" frame (two prongs into the ground).
- Must have: a rectangular placard; the stake legs below going into a short ground line.
- Optional: a tiny shield shape on the placard (security sign) instead of text lines. Only if it stays clean.
- Today: a board with two text lines and two legs. Fine. Optional polish.

**`raceway`: surface wire raceway (e.g. Wiremold).**
- Real object: a long, thin, flat plastic **channel** with a snap-on cover, stuck to a wall to hide wires. Its cross-section is a shallow rounded rectangle (often with a little lip where the cover snaps in).
- Must have: a long thin piece shown in **¾ perspective** (so it reads as a long channel, not a box), with the **end profile** visible; optionally a wire coming out of the open end.
- Avoid: looking like a battery or a ruler.
- Today: a flat rectangle with two dots. Reads as a battery or a VHS tape. Redesign.

**`caulk-tube`: silicone/caulk cartridge.**
- Real object: a cylindrical **tube** with a **long tapered nozzle** at one end (tip cut at an angle) and a plunger cap at the other.
- Must have: the cylinder body; the long cone nozzle with an angled tip; a ring line near the bottom for the plunger. Diagonal (nozzle top-left or top-right) is fine and reads well.
- Avoid: looking like a glue stick, a bottle or a pencil.
- Today: vertical and short-nozzled. Lengthen the nozzle; consider a diagonal.

**`putty`: putty / duct seal.**
- What techs mean: grey **duct seal putty**, a soft clay pressed around cables where they go through an exterior wall. It comes as a soft brick or lump.
- Pick the clearest of: (a) a soft lump or brick with rounded, slightly bulging edges and a **thumbprint dent** on top; (b) a small tub with a lid and a scoop of putty above it. Prefer (a) if you can make it read; fall back to (b).
- Avoid: a bucket that reads as a trash can (today's problem), or a blob that reads as a cloud.
- Today: a tub that looks like a bucket or trash can. Redesign.

### Power

**`splitter`: 3-way plug splitter (cube tap / triple outlet adapter).**
- Real object: a small block that plugs into a wall outlet (**two prongs** on the back) and offers **three outlets**. A US outlet face is **two vertical slots** (one slightly longer) with an optional round ground hole.
- Must have: a compact rounded block; at least one clear US outlet face (two short vertical slots); the two prongs; a hint that there are 3 outlets.
- Suggested: a ¾ view of the cube showing a front face with one outlet and a side face with another, plus prongs on the back. Or a flat front view with three outlet faces in a row or triangle, each drawn as **two slots** (not circles). The two-slot face is what reads as "outlet".
- Avoid: dots or circles as outlets (today they read as a face or dice).
- Today: three circles on a box. Reads as dice or a face. Redesign.

**`power-strip`: power strip.**
- Real object: a long rounded bar with **3–4 outlets** along it, a small **rocker switch** at one end, and a **cord** leaving the other end.
- Must have: the long bar (diagonal or horizontal); outlet faces drawn as pairs of short slots (at least 2–3 outlets); the cord trailing out; the switch is optional.
- Avoid: looking like a battery, a keyboard or a harmonica.
- Today: a bar with circles and a cord. Circles read as a battery gauge. Use slot pairs.

---

## 4. Which products use which icon (production data)

| Icon key | Products using it |
| --- | --- |
| `drill-bit` | Short Bit, Long Bit, Extra-Long Bit (groups), 3 ft Flex Bit |
| `hole-saw` | Hole Saw |
| `spade-bit` | Speedbor |
| `rj45` | RJ45 Connectors |
| `gel-connector` | Dolphin Beans |
| `wire-nut` | Wire Nuts |
| `tape` | Electrical Tape, Double-Sided Mounting Tape |
| `zip-tie` | Zip Ties |
| `staple` | Staples |
| `screw` | Screws |
| `sign` | Sign Hardware |
| `raceway` | Raceway |
| `caulk-tube` | Silicone Sealant |
| `putty` | Putty |
| `splitter` | 3-Way Plug Splitter |
| `power-strip` | Power Strip |

Because products reference icons by key, **redrawing an icon updates it everywhere automatically**. No database change is needed.

---

## 5. How to preview, check and ship

1. **Edit** `src/components/icons/supply-icons.tsx`: replace each icon's `d` JSX. Keep the `label`s (you may improve their wording) and the keys.
2. **Preview sheet** (do this; judge them together, at real size, on the dark background). Create a throwaway script, e.g. `scripts/.icons.tsx`:

   ```tsx
   import * as React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { SUPPLY_ICON_OPTIONS, SupplyIcon } from "../src/components/icons/supply-icons";
   void React;
   const cell = (o: { key: any; label: string }) =>
     `<div class=c><div class=big>${renderToStaticMarkup(<SupplyIcon name={o.key} />)}</div>
      <div class=tile>${renderToStaticMarkup(<SupplyIcon name={o.key} />)}</div>
      <div class=small>${renderToStaticMarkup(<SupplyIcon name={o.key} />)}</div><span>${o.label}</span></div>`;
   console.log(`<html><body style="margin:0;background:#16181f;color:#e8eaf0;font:13px system-ui">
   <style>.g{display:grid;grid-template-columns:repeat(4,180px);gap:10px;padding:14px}
   .c{display:flex;flex-direction:column;align-items:center;gap:8px;background:#1f222b;border-radius:12px;padding:12px}
   .big svg{width:72px;height:72px}.tile{background:#2a2d36;border-radius:12px;width:48px;height:48px;display:grid;place-items:center}
   .tile svg{width:28px;height:28px}.small svg{width:16px;height:16px}span{text-align:center}</style>
   <div class=g>${SUPPLY_ICON_OPTIONS.map(cell).join("")}</div></body></html>`);
   ```

   Run `npx tsx scripts/.icons.tsx > /tmp/icons.html`, then screenshot it with the preinstalled Playwright Chromium (`chromium.launch()`, viewport ~780 wide, `fullPage: true`) and **look at it**. Iterate until every icon passes the "would a technician name this object in one second at 28px?" test. Delete the throwaway script afterwards.
3. **Checks:** `npx tsc --noEmit && npx eslint . && npm test`. (DB tests skip if the local Supabase isn't running. That's fine for an icon-only change.)
4. **Ship:** commit on branch `claude/supply-request-portal-20vw5l` and push. Vercel deploys that branch to production automatically (https://order-tools-nine.vercel.app) in about a minute. Then check the technician page on a phone-sized viewport: team link `/r/my-install-team-67a1c5` → **Drill Bits**, **Wiring & Connectors**, etc.

## 6. Optional extras (only if they clearly help)

- A distinct **`flex-bit`** icon (a long flexible shaft drawn with a gentle S-curve, small bit on the end) for the 3 ft Flex Bit.
- A distinct **`mounting-tape`** icon (a roll with a peeled-back liner, or a square foam pad) for Double-Sided Mounting Tape.

If you add a key: add it to `SUPPLY_ICON_KEYS` in `src/lib/icon-names.ts` **and** to `ICONS`. The TypeScript `satisfies` check enforces that both lists match. Then assign it to the product in the app's **Catalog → Products → edit** (icon picker). No migration is needed; the database column accepts any lowercase key.

## 7. Done means

- All 16 icons redrawn per §3, consistent family look, bits/fasteners on the shared diagonal.
- The preview sheet looks cohesive, and every icon is identifiable at 28px (and roughly at 16px).
- Speedbor clearly reads as a flat spade bit with a center spike; raceway, putty, splitter and power strip no longer read as battery, trash can, dice or face.
- Type check, lint and tests pass; pushed; live site checked on a phone-sized screen.
