import {
  cglApiFailure,
  executeCglMemberAction,
  getCglMemberIdentity,
  getCglMemberSnapshot,
  readCglBody,
  verifyCglOrigin,
} from "@/lib/cgl-platform";
import { getCglSquareReadiness } from "@/lib/cgl-square";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const identity = await getCglMemberIdentity(request);
    const snapshot = await getCglMemberSnapshot(identity);
    const [{ data: checkouts, error }, { data: seasonEntitlements }] = await Promise.all([getSupabaseAdmin()
      .from("cgl_square_checkout_intents")
      .select("id,plan_code,season_id,amount_cents,recurring,state,created_at,completed_at")
      .eq("member_id", identity.id)
      .order("created_at", { ascending: false })
      .limit(25), getSupabaseAdmin()
        .from("cgl_square_season_entitlements")
        .select("checkout_id,season_id,paid_at,expires_at,environment")
        .eq("member_id", identity.id)
        .limit(25)]);
    return Response.json(
      {
        ...snapshot,
        billing: {
          ...snapshot.billing,
          readiness: getCglSquareReadiness(),
          checkouts: error ? [] : checkouts ?? [],
          seasonEntitlements: seasonEntitlements ?? [],
          ...(error ? { notice: "Sandbox billing setup is not yet available." } : {}),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const identity = await getCglMemberIdentity(request);
    return Response.json(
      {
        status: "completed",
        result: await executeCglMemberAction(
          identity,
          await readCglBody(request),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
