import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "Supply Requests — Manager",
      short_name: "Supply Admin",
      id: "/admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#0f1115",
      theme_color: "#0f1115",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
