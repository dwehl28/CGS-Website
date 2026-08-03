import { getPublishedDoubleEliminationBracketBySlug } from "@/lib/double-elimination";

type BracketApiRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: BracketApiRouteProps) {
  const { slug } = await params;
  const bracket = await getPublishedDoubleEliminationBracketBySlug(slug);

  if (!bracket) {
    return Response.json({ message: "Bracket not found." }, { status: 404 });
  }

  return Response.json(bracket, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
