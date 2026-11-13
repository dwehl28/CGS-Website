import type { Metadata } from "next";
import CglSgtLive from "@/components/cgl/CglSgtLive";

export const metadata: Metadata = {
  title: "Live SGT clubhouse",
  description:
    "Official CGSBunker Simulator Golf Tour standings, tournaments, scorecards and statistics.",
};

export default function CglLivePage() {
  return <CglSgtLive />;
}
