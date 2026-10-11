import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TopDogStreamOverlay from "@/components/top-dog/TopDogStreamOverlay";
import { getPublishedTopDogSnapshot } from "@/lib/top-dog";

type PageProps = { params: Promise<{ season: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Top Dog Live Ladder", robots: { index: false, follow: false } };

export default async function TopDogLadderPage({ params }: PageProps) {
  const { season } = await params;
  const snapshot = await getPublishedTopDogSnapshot(season);
  if (!snapshot) notFound();

  return <main className="top-dog-stream-page"><TopDogStreamOverlay initialSnapshot={snapshot} view="ladder" /></main>;
}
