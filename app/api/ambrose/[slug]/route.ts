import { getPublishedAmbroseEventBySlug } from "@/lib/ambrose-events";

type AmbroseEventApiRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: AmbroseEventApiRouteProps) {
  const { slug } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  if (!event) {
    return Response.json({ message: "Ambrose event not found." }, { status: 404 });
  }

  return Response.json(event);
}
