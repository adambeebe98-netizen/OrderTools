import * as React from "react";
import type { SupplyIconKey } from "@/lib/icon-names";

/**
 * Custom line-art icons for supplies. 24×24, currentColor, round caps/joins,
 * same stroke weight throughout so they sit well next to lucide icons.
 *
 * Each one is a plain drawing of the real object, kept to a handful of strokes
 * with gaps of about 1.5 units so it still reads at 28px on a phone.
 */

/**
 * Long, thin tools (bits, screw, caulk tube) lie on the square's diagonal so
 * they can be longer than the box is wide. They are drawn upright around
 * x = 12 and turned 45°, which is why their coordinates run past 0 and 24.
 * Bits and the screw have the shank at the top (top-right once turned) and the
 * working end at the bottom (bottom-left).
 */
const diagonal = (children: React.ReactNode) => <g transform="rotate(45 12 12)">{children}</g>;

const ICONS = {
  "drill-bit": {
    label: "Twist drill bit (wood)",
    // Smooth shank, three flutes, sharp point.
    d: diagonal(
      <>
        <path d="M9.5 1.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21L12 25l-2.5-4z" />
        <path d="M9.5 11.5l5-4M9.5 15.5l5-4M9.5 19.5l5-4" />
      </>,
    ),
  },
  "masonry-bit": {
    label: "Masonry bit",
    // Same body as the twist bit, but ending in the wide, blunt carbide tip.
    d: diagonal(
      <>
        <path d="M9.5 19V1.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V19" />
        <path d="M8 19h8v2.5l-4 3-4-3z" />
        <path d="M9.5 11.5l5-4M9.5 16.5l5-4" />
      </>,
    ),
  },
  "flex-bit": {
    label: "Flex bit",
    // Short cutting head on a long, bendy shaft.
    d: diagonal(
      <>
        <path d="M9.5 12h5v9L12 25l-2.5-4z" />
        <path d="M9.5 16.5l5-3M9.5 20l5-3" />
        <path d="M12 12c0-4.5 4-3.5 4-7.5S12 1.5 12-2" />
      </>,
    ),
  },
  "hole-saw": {
    label: "Hole saw",
    // Upright on purpose: the tooth edge only reads as teeth when it is level.
    d: (
      <>
        <path d="M12 2v5" />
        <path d="M4 14.5v-6A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v6l-2 2.5-2-2.5-2 2.5-2-2.5-2 2.5-2-2.5-2 2.5z" />
        <path d="M12 15v7" />
      </>
    ),
  },
  "spade-bit": {
    label: "Speedbor / spade bit",
    // Thin shank, flat paddle, long centre point between two corner spurs.
    d: diagonal(
      <>
        <path d="M12-1.5v9" />
        <path d="M7 20V9l1.5-1.5h7L17 9v11l-1.5-2h-2.25L12 25.5 10.75 18H8.5z" />
      </>,
    ),
  },
  rj45: {
    label: "RJ45 connector",
    // Plug pointing up: contacts at the nose, boot and cable out the back.
    d: (
      <>
        <rect x="5" y="2.5" width="14" height="12" rx="1.5" />
        <path d="M8.5 5.5v3M12 5.5v3M15.5 5.5v3" />
        <path d="M8.5 14.5l1 4h5l1-4" />
        <path d="M12 18.5V22" />
      </>
    ),
  },
  "gel-connector": {
    label: "Dolphin bean (gel crimp connector)",
    // B-connector "beanie": a small capsule pinched by the crimp, two wires in one end.
    d: (
      <>
        <path d="M9.5 7.5h3c1.25 0 1.5 1.25 2.5 1.25s1.25-1.25 2.5-1.25a4.5 4.5 0 0 1 0 9c-1.25 0-1.5-1.25-2.5-1.25s-1.25 1.25-2.5 1.25h-3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
        <path d="M2.5 10.25h6M2.5 13.75h6" />
      </>
    ),
  },
  "wire-nut": {
    label: "Wire nut",
    // Ribbed cone with a twisted pair coming out of the open end.
    d: (
      <>
        <path d="M6.5 15.75 10 3.75a2.05 2.05 0 0 1 4 0l3.5 12z" />
        <path d="M8.9 8l5.7-1.75M7.8 11.75l7.7-2.25" />
        <path d="M10 15.75c0 3 4 3 4 6.25M14 15.75c0 3-4 3-4 6.25" />
      </>
    ),
  },
  tape: {
    label: "Tape roll",
    d: (
      <>
        <circle cx="10.5" cy="12.5" r="7.5" />
        <circle cx="10.5" cy="12.5" r="3" />
        <path d="M10.5 5H21l-1.5 3" />
      </>
    ),
  },
  "mounting-tape": {
    label: "Double-sided mounting tape",
    // A tape roll whose liner peels away from the sticky strip.
    d: (
      <>
        <circle cx="10" cy="13.5" r="7" />
        <circle cx="10" cy="13.5" r="2.5" />
        <path d="M10 6.5h11.5" />
        <path d="M14.5 6.5c2.5 0 4.5-1.5 5-4.5" />
      </>
    ),
  },
  "zip-tie": {
    label: "Zip tie",
    // Cinched loop, square ratchet head, tail sticking out.
    d: (
      <>
        <path d="M12 7.5H8.5a6 6 0 1 0 6 6V10" />
        <rect x="12" y="5" width="5" height="5" rx="1" />
        <path d="M17 7.5h5" />
      </>
    ),
  },
  staple: {
    label: "Cable staple",
    // Staple driven into a surface, holding a cable down.
    d: (
      <>
        <path d="M2 16h20" />
        <path d="M6 20v-9.5a6 6 0 0 1 12 0V20" />
        <circle cx="12" cy="12.75" r="3.25" />
      </>
    ),
  },
  screw: {
    label: "Screw",
    // Countersunk head, threads that stick out past the shank, sharp point.
    d: diagonal(
      <>
        <path d="M7 3h10l-3 3.5V20l-2 5-2-5V6.5z" />
        <path d="M9 11l6-1.5M9 14.5l6-1.5M9 18l6-1.5" />
      </>,
    ),
  },
  sign: {
    label: "Yard sign",
    d: (
      <>
        <rect x="3.5" y="2.5" width="17" height="10.5" rx="1.5" />
        <path d="M7.5 6.25h9M7.5 9.5H13" />
        <path d="M8.5 13v7.5M15.5 13v7.5" />
        <path d="M5 20.5h14" />
      </>
    ),
  },
  raceway: {
    label: "Raceway",
    // Long channel seen from one end, with a wire coming out of it.
    d: (
      <>
        <rect x="3" y="11.5" width="7" height="4" rx="1" />
        <path d="M3.25 11.65 14.5 4h7v4L9.75 15.35" />
        <path d="M9.75 11.65 21.5 4" />
        <path d="M6.5 13.5v3c0 3-1.5 4.5-4 5" />
      </>
    ),
  },
  "caulk-tube": {
    label: "Silicone / caulk tube",
    // Cartridge with a long nozzle cut at an angle, plunger ring at the back.
    d: diagonal(
      <>
        <rect x="8" y="7.5" width="8" height="14" rx="1.5" />
        <path d="M10 7.5l1.25-7.75 1.5-1L14 7.5" />
        <path d="M8 18.5h8" />
      </>,
    ),
  },
  putty: {
    label: "Putty",
    // Soft lump of duct seal with a thumb press in the top.
    d: (
      <>
        <path d="M5.5 6C8 4.5 13 4 17 5c3 .75 4.5 2.25 4.5 4.25 0 2.25-1.75 3.75-4.5 4.25-3.5.75-8 .75-11 0-2.25-.5-3.5-1.75-3.5-3.75 0-1.5 1-2.75 3-3.75z" />
        <path d="M2.5 10v4.5c0 2 1.25 3.5 3.5 4 3 .75 7.5.75 11 0 2.75-.5 4.5-2 4.5-4.25v-5" />
        <path d="M9.5 8.5c.5 1.75 5.5 2 6.5 0" />
      </>
    ),
  },
  splitter: {
    label: "3-way plug splitter",
    // Block with two prongs and three outlet faces (each a pair of slots).
    d: (
      <>
        <rect x="6" y="3" width="15.5" height="18" rx="2.5" />
        <path d="M2.5 9H6M2.5 15H6" />
        <path d="M12.5 6.5v3M15 6.5v3M9 14.5v3M11.5 14.5v3M16 14.5v3M18.5 14.5v3" />
      </>
    ),
  },
  "power-strip": {
    label: "Power strip",
    // Rocker switch, two outlets, cord trailing away underneath.
    d: (
      <>
        <rect x="2" y="5" width="20" height="9" rx="2.5" />
        <rect x="4.5" y="7.25" width="3" height="4.5" rx=".75" />
        <path d="M10.75 8v3M13 8v3M17 8v3M19.25 8v3" />
        <path d="M18.5 14v1.5a3 3 0 0 1-3 3H7" />
      </>
    ),
  },
} as const satisfies Record<SupplyIconKey, { label: string; d: React.ReactNode }>;

export type SupplyIconName = keyof typeof ICONS;

export const SUPPLY_ICON_OPTIONS = (Object.keys(ICONS) as SupplyIconName[]).map((key) => ({
  key,
  label: ICONS[key].label,
}));

export function isSupplyIconName(value: unknown): value is SupplyIconName {
  return typeof value === "string" && value in ICONS;
}

export function SupplyIcon({
  name,
  className,
  title,
  strokeWidth = 1.75,
}: {
  name: SupplyIconName;
  className?: string;
  title?: string;
  strokeWidth?: number;
}) {
  const icon = ICONS[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {icon.d}
    </svg>
  );
}
