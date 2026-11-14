import type { Metadata } from "next";

import CglSeasonOnePreview from "@/components/cgl/CglSeasonOnePreview";

export const metadata: Metadata = {
  title: "Hidden Gems Tour · Season 1 Preview",
  description:
    "Review the proposed 2027 CGL Hidden Gems Tour format, calendar, course pairings and membership presentation.",
  robots: { index: false, follow: false },
};

export default function CglSeasonOnePreviewPage() {
  return <CglSeasonOnePreview />;
}
