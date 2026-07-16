import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamAmbroseLeaderboard from "@/components/ambrose/StreamAmbroseLeaderboard";
import { getPublishedAmbroseEventBySlug } from "@/lib/ambrose-events";

type StreamAmbroseLeaderboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: StreamAmbroseLeaderboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  return {
    title: event ? `${event.title} Ambrose Stream Leaderboard` : "Ambrose Stream Leaderboard",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StreamAmbroseLeaderboardPage({
  params,
}: StreamAmbroseLeaderboardPageProps) {
  const { slug } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  if (!event) {
    notFound();
  }

  return (
    <main className="stream-overlay-page">
      <StreamAmbroseLeaderboard initialEvent={event} />
    </main>
  );
}
