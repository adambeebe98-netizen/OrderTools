/** Keys of the custom supply icons (see components/icons/supply-icons.tsx). */
export const SUPPLY_ICON_KEYS = [
  "drill-bit",
  "masonry-bit",
  "flex-bit",
  "hole-saw",
  "spade-bit",
  "rj45",
  "b-connector",
  "gel-connector",
  "wire-nut",
  "tape",
  "mounting-tape",
  "zip-tie",
  "staple",
  "screw",
  "sign",
  "raceway",
  "caulk-tube",
  "putty",
  "splitter",
  "power-strip",
] as const;
export type SupplyIconKey = (typeof SUPPLY_ICON_KEYS)[number];
