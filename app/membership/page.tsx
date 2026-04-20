import type { Metadata } from "next";

import MembershipPageClient from "@/components/MembershipPageClient";
import { buildMetadata } from "@/lib/seo";
import { membershipFaqs } from "@/lib/site-content";
import { buildFaqJsonLd, createJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Membership",
  description:
    "Join Crossodog Golf Society as an online social member or a playing member for in-person events and member pricing.",
  path: "/membership",
});

export default function MembershipPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildFaqJsonLd(membershipFaqs))}
      />
      <MembershipPageClient />
    </>
  );
}
