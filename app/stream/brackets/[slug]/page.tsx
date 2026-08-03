import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamDoubleEliminationBracket from "@/components/brackets/StreamDoubleEliminationBracket";
import { getPublishedDoubleEliminationBracketBySlug } from "@/lib/double-elimination";

type StreamBracketPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    view?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: StreamBracketPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bracket = await getPublishedDoubleEliminationBracketBySlug(slug);

  return {
    title: bracket ? `${bracket.title} Stream Bracket` : "CGS Stream Bracket",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StreamBracketPage({
  params,
  searchParams,
}: StreamBracketPageProps) {
  const { slug } = await params;
  const { view: requestedView } = await searchParams;
  const bracket = await getPublishedDoubleEliminationBracketBySlug(slug);
  const view =
    requestedView === "upper" ||
    requestedView === "lower" ||
    requestedView === "live" ||
    requestedView === "banner" ||
    requestedView === "portrait"
      ? requestedView
      : "overview";

  if (!bracket) {
    notFound();
  }

  return (
    <main className={`stream-double-elimination-page is-${view}`}>
      <StreamDoubleEliminationBracket
        initialBracket={bracket}
        initialView={view}
      />
    </main>
  );
}
