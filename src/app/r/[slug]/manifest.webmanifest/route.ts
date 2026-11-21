import { NextResponse } from "next/server";
import { getPublicTeam } from "@/lib/data/public";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(
    {
      name: `${team.name} — Supplies`,
      short_name: "Supplies",
      description: "Request installation supplies",
      id: `/r/${slug}`,
      start_url: `/r/${slug}`,
      scope: `/r/${slug}`,
      display: "standalone",
      background_color: "#0f1115",
      theme_color: "#0f1115",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
