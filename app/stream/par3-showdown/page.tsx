import type { Metadata } from "next";

import Par3StreamAsset from "@/components/par3/Par3StreamAsset";
import { getPublicPar3Snapshot } from "@/lib/par3-showdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Par 3 Championship Stream Asset",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function Par3StreamPage({ searchParams }: PageProps) {
  const { view: requestedView } = await searchParams;
  const view = requestedView === "portrait" ? "portrait" : "banner";
  const snapshot = await getPublicPar3Snapshot();

  return (
    <main className={`par3-stream-page is-${view}`}>
      <Par3StreamAsset initialSnapshot={snapshot} view={view} />
    </main>
  );
}
