import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TopDogStreamOverlay from "@/components/top-dog/TopDogStreamOverlay";
import {
  getPublishedTopDogSnapshot,
  type TopDogCentralOverlay,
} from "@/lib/top-dog";

type PageProps = {
  params: Promise<{ season: string; overlay: string }>;
};

const overlayRoutes: Record<string, TopDogCentralOverlay[]> = {
  prize: ["best_team", "longest_drive", "ctp", "bunker_boy", "shot_of_night"],
  jackpot: ["one_putt_jackpot"],
  sponsor: ["sponsor"],
  subscribe: ["subscribe"],
  interview: ["player_interview"],
  result: ["match_result"],
  "wrap-up": ["night_wrap_up"],
  doghouse: ["doghouse"],
  "shot-of-night": ["shot_of_night"],
  "butters-board": ["butters_board"],
  "up-next": ["up_next"],
  "match-of-night": ["match_of_night"],
  "stat-of-week": ["stat_of_week"],
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Dog Broadcast Graphic",
  robots: { index: false, follow: false },
};

export default async function TopDogDedicatedOverlayPage({ params }: PageProps) {
  const { season, overlay } = await params;
  const allowedOverlays = overlayRoutes[overlay];

  if (!allowedOverlays) {
    notFound();
  }

  const snapshot = await getPublishedTopDogSnapshot(season);

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="top-dog-stream-page">
      <TopDogStreamOverlay
        initialSnapshot={snapshot}
        view="match"
        allowedOverlays={allowedOverlays}
      />
    </main>
  );
}
