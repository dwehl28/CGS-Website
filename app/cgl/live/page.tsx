import type { Metadata } from "next";
import CglSgtLive from "@/components/cgl/CglSgtLive";

export const metadata: Metadata = {
  title: "Live tournament centre",
  description:
    "Follow live CGL positions, round progress, scorecards and player statistics from the official CGSBunker Simulator Golf Tour feed.",
};

export default function CglLivePage() {
  return <CglSgtLive />;
}
