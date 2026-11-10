import { z } from "zod";
import { cglApiFailure, getCglMemberIdentity, verifyCglOrigin } from "@/lib/cgl-platform";
import { CglSquareError, syncCglSquareMember } from "@/lib/cgl-square";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const identity = await getCglMemberIdentity(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024)
      return Response.json({ error: "The request is too large." }, { status: 413 });
    const input = z.object({ checkoutId: z.uuid().optional() }).strict().safeParse(JSON.parse(raw || "{}"));
    if (!input.success)
      return Response.json({ error: "Choose a valid checkout from your account." }, { status: 400 });
    return Response.json(await syncCglSquareMember(identity.id, input.data.checkoutId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Send a valid checkout request." }, { status: 400 });
    if (error instanceof CglSquareError)
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return cglApiFailure(error);
  }
}
