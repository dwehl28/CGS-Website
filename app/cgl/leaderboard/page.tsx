import type { Metadata } from "next";
import CglPublicExperience from "@/components/cgl/CglPublicExperience";

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "CGL weekly results and A/B Grade best-eight championship standings.",
  robots: { index: false, follow: false },
};

export default function CglLeaderboardPage() {
  return <CglPublicExperience section="leaderboard" />;
}
