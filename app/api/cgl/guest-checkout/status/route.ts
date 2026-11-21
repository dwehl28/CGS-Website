import { createHash } from "node:crypto";
import { z } from "zod";
import { cglApiFailure, verifyCglOrigin } from "@/lib/cgl-platform";
import { CglSquareError, syncCglSquareMember } from "@/lib/cgl-square";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const statusInput = z.object({
  checkoutId: z.uuid(),
  accessKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024) {
      return Response.json({ error: "The request is too large." }, { status: 413 });
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Send a valid checkout status request." }, { status: 400 });
    }
    const parsed = statusInput.safeParse(decoded);
    if (!parsed.success) {
      return Response.json({ error: "This guest checkout link is invalid or incomplete." }, { status: 400 });
    }
    const accessHash = createHash("sha256").update(parsed.data.accessKey).digest("hex");
    const admin = getSupabaseAdmin();
    const { data: initial, error: initialError } = await admin
      .from("cgl_square_checkout_intents")
      .select("id,member_id,membership_id,plan_code,amount_cents,recurring,state,completed_at,guest_access_expires_at")
      .eq("id", parsed.data.checkoutId)
      .eq("checkout_channel", "guest")
      .eq("guest_access_key_hash", accessHash)
      .gt("guest_access_expires_at", new Date().toISOString())
      .maybeSingle();
    if (initialError || !initial) {
      return Response.json(
        { error: "This private checkout confirmation has expired or is unavailable. Use your Square receipt or contact CGS for help." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (initial.state !== "completed") {
      await syncCglSquareMember(initial.member_id, initial.id);
    }

    const [{ data: checkout }, { data: member }, { data: membership }] = await Promise.all([
      admin
        .from("cgl_square_checkout_intents")
        .select("id,member_id,membership_id,plan_code,amount_cents,recurring,state,completed_at")
        .eq("id", initial.id)
        .eq("guest_access_key_hash", accessHash)
        .single(),
      admin
        .from("cgl_members")
        .select("display_name,sgt_username")
        .eq("id", initial.member_id)
        .single(),
      admin
        .from("cgl_memberships")
        .select("state,starts_at,paid_through,next_billing_at")
        .eq("id", initial.membership_id)
        .single(),
    ]);
    if (!checkout || !member || !membership) {
      throw new CglSquareError("The checkout was found but its membership record needs CGS review.", 409);
    }
    return Response.json(
      {
        checkoutId: checkout.id,
        status: checkout.state,
        confirmed: checkout.state === "completed",
        planCode: checkout.plan_code,
        amountCents: checkout.amount_cents,
        recurring: checkout.recurring,
        completedAt: checkout.completed_at,
        membershipState: membership.state,
        paidThrough: membership.paid_through,
        nextBillingAt: membership.next_billing_at,
        displayName: member.display_name,
        sgtUsername: member.sgt_username,
        message: checkout.state === "completed"
          ? "Square confirmed your payment and CGL membership. Your SGT username is ready for automatic result matching."
          : "Square has not confirmed the payment yet. No membership is being assumed while confirmation is pending.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CglSquareError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return cglApiFailure(error);
  }
}
