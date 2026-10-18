import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TopDogStreamOverlay from "@/components/top-dog/TopDogStreamOverlay";
import { getPublishedTopDogSnapshot } from "@/lib/top-dog";

type PageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Top Dog Live Ticker", robots: { index: false, follow: false } };

export default async function TopDogTickerPage({ params, searchParams }: PageProps) {
  const { season } = await params;
  const { preview } = await searchParams;
  const snapshot = await getPublishedTopDogSnapshot(season);
  if (!snapshot) notFound();

  return (
    <main className="top-dog-stream-page">
      <TopDogStreamOverlay
        initialSnapshot={snapshot}
        view="ticker"
        preview={preview === "1"}
      />
    </main>
  );
}
