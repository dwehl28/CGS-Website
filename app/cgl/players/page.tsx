import type { Metadata } from "next";

import CglPublicExperience from "@/components/cgl/CglPublicExperience";

export const metadata: Metadata = {
  title: "Players",
  description:
    "Browse approved Crossodog Golf League player profiles, divisions and published championship positions.",
};

export default function CglPlayersPage() {
  return <CglPublicExperience section="players" />;
}
