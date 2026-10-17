import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TopDogLeagueBanner from "@/components/top-dog/TopDogLeagueBanner";
import { getPublishedTopDogSnapshot } from "@/lib/top-dog";

type PageProps = { params: Promise<{ season: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Dog Rotating League Banner",
  robots: { index: false, follow: false },
};

export default async function TopDogBannerPage({ params }: PageProps) {
  const { season } = await params;
  const snapshot = await getPublishedTopDogSnapshot(season);

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="top-dog-stream-page is-banner">
      <TopDogLeagueBanner initialSnapshot={snapshot} />
    </main>
  );
}
