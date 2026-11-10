import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CglRoundHub from "@/components/cgl/CglRoundHub";
import { cglRounds } from "@/lib/cgl-demo";

type RoundPageProps = { params: Promise<{ roundId: string }> };

export async function generateMetadata({
  params,
}: RoundPageProps): Promise<Metadata> {
  const { roundId } = await params;
  const round = cglRounds.find(
    (entry) => entry.id === roundId && entry.status === "open",
  );

  return {
    title: round
      ? `Round ${round.number} · ${round.course}`
      : "Round not found",
    description:
      "Round achievements, player scorecards and league standings. CGL design preview with fictional sample results.",
    robots: { index: false, follow: false },
  };
}

export default async function CglRoundPage({ params }: RoundPageProps) {
  const { roundId } = await params;
  const round = cglRounds.find(
    (entry) => entry.id === roundId && entry.status === "open",
  );
  if (!round) notFound();

  return <CglRoundHub key={round.id} roundId={round.id} />;
}
