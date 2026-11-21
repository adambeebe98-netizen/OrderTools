import * as React from "react";
import type { SupplyIconKey } from "@/lib/icon-names";

/**
 * Custom line-art icons for supplies. 24×24, currentColor, round caps/joins,
 * same stroke weight throughout so they sit well next to lucide icons.
 */
const ICONS = {
  "drill-bit": {
    label: "Drill bit",
    d: (
      <>
        <path d="M10.5 2h3v5h-3z" />
        <path d="M10 7h4v10l-2 5-2-5z" />
        <path d="M10 9.5l4 2M10 13l4 2M10.4 16.6l2.6 1.3" />
      </>
    ),
  },
  "hole-saw": {
    label: "Hole saw",
    d: (
      <>
        <path d="M12 2.5v6" />
        <path d="M5 8.5h14v7l-1.75 1.5-1.75-1.5-1.75 1.5L12 15.5l-1.75 1.5-1.75-1.5L6.75 17 5 15.5z" />
        <path d="M12 17v4.5" />
      </>
    ),
  },
  "spade-bit": {
    label: "Speedbor / spade bit",
    d: (
      <>
        <path d="M12 2v8.5" />
        <path d="M7.5 10.5h9l-1 6L12 19l-3.5-2.5z" />
        <path d="M12 19v3" />
      </>
    ),
  },
  rj45: {
    label: "RJ45 connector",
    d: (
      <>
        <rect x="5" y="5" width="14" height="12" rx="1.5" />
        <path d="M9 8.5v2.5M12 8.5v2.5M15 8.5v2.5" />
        <path d="M9 17v2.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V17" />
      </>
    ),
  },
  "gel-connector": {
    label: "Gel crimp connector (dolphin bean)",
    d: (
      <>
        <path d="M10 8h7.5a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1-3.5 3.5H10z" />
        <path d="M13 8V6h4.5v2" />
        <path d="M3 10.5h7M3 13.5h7" />
      </>
    ),
  },
  "wire-nut": {
    label: "Wire nut",
    d: (
      <>
        <path d="M7.5 19h9L15 8.5a3 3 0 0 0-6 0z" />
        <path d="M9.4 12h5.2M8.9 15.5h6.2" />
        <path d="M10.5 19v3M13.5 19v3" />
      </>
    ),
  },
  tape: {
    label: "Tape roll",
    d: (
      <>
        <circle cx="11" cy="12" r="7.5" />
        <circle cx="11" cy="12" r="3" />
        <path d="M11 4.5h9.5l-1.25 2.5" />
      </>
    ),
  },
  "zip-tie": {
    label: "Zip tie",
    d: (
      <>
        <rect x="8.5" y="3" width="5" height="4" rx="1" />
        <path d="M9.5 7v2.5a5 5 0 1 0 3 0V7" />
        <path d="M13.5 5h7.5" />
        <path d="M16 4.25v1.5M18.5 4.25v1.5" />
      </>
    ),
  },
  staple: {
    label: "Cable staple",
    d: (
      <>
        <path d="M5 21V10a7 7 0 0 1 14 0v11" />
        <circle cx="12" cy="11.5" r="3" />
        <path d="M3 21h4M17 21h4" />
      </>
    ),
  },
  screw: {
    label: "Screw",
    d: (
      <>
        <path d="M6.5 3h11v2.25a1.25 1.25 0 0 1-1.25 1.25h-8.5A1.25 1.25 0 0 1 6.5 5.25z" />
        <path d="M9.5 6.5h5V17L12 22l-2.5-5z" />
        <path d="M9.5 9.5l5-1M9.5 12.5l5-1M9.5 15.5l5-1" />
      </>
    ),
  },
  sign: {
    label: "Sign",
    d: (
      <>
        <rect x="3" y="4" width="18" height="11" rx="1.5" />
        <path d="M7 8.5h10M7 11.5h6" />
        <path d="M8 15v6M16 15v6" />
      </>
    ),
  },
  raceway: {
    label: "Raceway",
    d: (
      <>
        <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
        <path d="M2.5 10.5h19" />
        <circle cx="7" cy="13.25" r="1" />
        <circle cx="17" cy="13.25" r="1" />
      </>
    ),
  },
  "caulk-tube": {
    label: "Silicone / caulk tube",
    d: (
      <>
        <path d="M11 2h2l1 5h-4z" />
        <path d="M9 7h6v2H9z" />
        <rect x="7.5" y="9" width="9" height="12.5" rx="1.5" />
        <path d="M7.5 18h9" />
      </>
    ),
  },
  putty: {
    label: "Putty",
    d: (
      <>
        <rect x="4" y="6.5" width="16" height="3" rx="1" />
        <path d="M5.25 9.5h13.5l-1 9.75a1.5 1.5 0 0 1-1.5 1.25h-8.5a1.5 1.5 0 0 1-1.5-1.25z" />
        <path d="M8.5 14h7" />
        <path d="M9 6.5c0-2 1.5-3 3-3s3 1 3 3" />
      </>
    ),
  },
  splitter: {
    label: "3-way plug splitter",
    d: (
      <>
        <rect x="5" y="3.5" width="14" height="13.5" rx="2" />
        <circle cx="9" cy="8" r="1.4" />
        <circle cx="15" cy="8" r="1.4" />
        <circle cx="12" cy="12.75" r="1.4" />
        <path d="M10 17v4M14 17v4" />
      </>
    ),
  },
  "power-strip": {
    label: "Power strip",
    d: (
      <>
        <rect x="2" y="8" width="15.5" height="8" rx="2" />
        <circle cx="5.75" cy="12" r="1.25" />
        <circle cx="9.75" cy="12" r="1.25" />
        <circle cx="13.75" cy="12" r="1.25" />
        <path d="M17.5 12h2a2 2 0 0 1 2 2v5" />
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
