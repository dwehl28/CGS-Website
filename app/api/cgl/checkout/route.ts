import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCglMemberIdentity, cglApiFailure, verifyCglOrigin } from "@/lib/cgl-platform";
import {
  CglSquareError,
  createCglSquareCheckout,
  getCglSquareOperationalReadiness,
  type CglSquareCheckout,
} from "@/lib/cgl-square";

export const runtime = "nodejs";

const input = z
  .object({
    planCode: z.enum([
      "annual",
      "monthly",
      "weekly",
      "casual_registration",
      "casual_season",
    ]),
    seasonId: z.uuid().optional(),
    requestKey: z.uuid(),
    termsAccepted: z.literal(true),
    acceptedAmountCents: z.number().int().positive(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    await getCglMemberIdentity(request);
    const planCode = new URL(request.url).searchParams.get("planCode");
    const { data: plan, error } = await getSupabaseAdmin()
      .from("cgl_plans")
      .select("code,price_cents,auto_renew,billing_interval,config")
      .eq("code", planCode ?? "")
      .eq("active", true)
      .maybeSingle();
    if (error || !plan)
      return Response.json(
        { error: "Choose an available CGL plan." },
        { status: 404 },
      );
    const readiness = await getCglSquareOperationalReadiness();
    return Response.json(
      {
        planCode: plan.code,
        amountCents: plan.price_cents,
        currency: "AUD",
        recurring: plan.auto_renew,
        billingInterval: plan.billing_interval,
        environment: readiness.environment,
        readiness,
        prorationAvailable: false,
        creditsAvailable: false,
        seasonRequired: plan.code === "casual_season",
        notice:
          plan.code === "casual_season"
            ? "This AUD quote is for a one-off Season Pass linked to the season you select."
            : "This AUD quote is not linked to a specific season. Prorated upgrades and credit-funded subscription invoices require CGS reconciliation before checkout.",
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
    // Bearer authentication is verified by Supabase; the existing shared admin token cannot buy a membership.
    const member = await getCglMemberIdentity(request);
    const readiness = await getCglSquareOperationalReadiness();
    if (!readiness.ready)
      throw new CglSquareError(
        readiness.environment === "sandbox"
          ? "CGL test payments are awaiting Square Sandbox setup and testing activation. No payment has been taken."
          : "CGL live payments are awaiting verified Square production setup and launch activation. No payment has been taken.",
      );
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      return Response.json(
        { error: "Checkout request is too large." },
        { status: 413 },
      );
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096)
      return Response.json({ error: "Checkout request is too large." }, { status: 413 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { return Response.json({ error: "Send a valid checkout request." }, { status: 400 }); }
    const body = input.safeParse(parsed);
    if (!body.success)
      return Response.json(
        {
          error:
            "Choose a CGL plan, accept the published terms and use a valid checkout request.",
        },
        { status: 400 },
      );
    if (readiness.environment === "production" && ["annual", "monthly", "weekly"].includes(body.data.planCode) && !readiness.subscriptionActionsEnabled)
      throw new CglSquareError(
        "Recurring Square memberships are still in controlled verification. Choose a one-off casual option for now.",
        409,
        "square_recurring_disabled",
      );
    const seasonId =
      body.data.planCode === "casual_season" ? body.data.seasonId ?? null : null;
    if (body.data.planCode === "casual_season" && !seasonId)
      return Response.json(
        { error: "Choose an open season for the $100 Season Pass." },
        { status: 400 },
      );
    const { data, error } = await getSupabaseAdmin().rpc(
      readiness.environment === "production"
        ? "cgl_prepare_square_live_checkout"
        : "cgl_prepare_square_checkout",
      {
        p_member_id: member.id,
        p_plan_code: body.data.planCode,
        p_season_id: seasonId,
        p_request_key: body.data.requestKey,
        p_accepted_amount_cents: body.data.acceptedAmountCents,
      },
    );
    if (error)
      return Response.json(
        {
          error:
            "This checkout is unavailable. Check your membership, registration and season eligibility, or ask CGS to review it.",
        },
        { status: 409 },
      );
    const checkout = data as CglSquareCheckout;
    if (!checkout?.id)
      throw new CglSquareError(
        "The checkout could not be prepared. No payment has been taken.",
      );
    if (checkout.amount_cents !== body.data.acceptedAmountCents)
      throw new CglSquareError(
        "The membership price has changed. Review the current quote before confirming payment.",
        409,
      );
    const url = await createCglSquareCheckout(checkout);
    return Response.json(
      {
        url,
        checkoutId: checkout.id,
        amountCents: checkout.amount_cents,
        currency: "AUD",
        environment: readiness.environment,
        recurring: checkout.recurring,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CglSquareError)
      return Response.json({ error: error.message }, { status: error.status });
    return cglApiFailure(error);
  }
}
