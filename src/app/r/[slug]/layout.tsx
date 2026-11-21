import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTeam } from "@/lib/data/public";
import { ServiceWorkerRegister } from "@/components/sw-register";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = await getPublicTeam(slug);
  return {
    title: team ? `${team.name} supplies` : "Supply Requests",
    manifest: `/r/${slug}/manifest.webmanifest`,
  };
}

export default async function TechLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) notFound();
  return (
    <>
      {children}
      <ServiceWorkerRegister />
    </>
  );
}
