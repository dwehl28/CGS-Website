import { NextResponse } from "next/server";

import { getPublishedCompetitionScoreboardBySlug } from "@/lib/scoreboards";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const competition = await getPublishedCompetitionScoreboardBySlug(slug);

  if (!competition) {
    return NextResponse.json({ error: "Scoreboard not found." }, { status: 404 });
  }

  return NextResponse.json(competition, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
