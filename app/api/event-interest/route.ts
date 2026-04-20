import { NextResponse } from "next/server";

import { isValidEmail, normalizeString } from "@/lib/form-utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const missingTableMessage =
  "Database form tables are not set up yet. Run the SQL in supabase/setup.sql and try again.";

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();

    const submission = {
      event_slug: normalizeString(body.event_slug, 80),
      event_name: normalizeString(body.event_name, 120),
      enquiry_type: normalizeString(body.enquiry_type, 60),
      full_name: normalizeString(body.full_name, 120),
      email: normalizeString(body.email, 200).toLowerCase(),
      phone: normalizeString(body.phone, 40),
      membership_status: normalizeString(body.membership_status, 40),
      handicap: normalizeString(body.handicap, 40),
      notes: normalizeString(body.notes, 1200),
    };

    if (
      !submission.event_slug ||
      !submission.event_name ||
      !submission.enquiry_type ||
      !submission.full_name ||
      !submission.email
    ) {
      return NextResponse.json(
        { error: "Please complete the required event enquiry fields." },
        { status: 400 }
      );
    }

    if (!isValidEmail(submission.email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("event_interest")
      .insert([submission]);

    if (error) {
      console.error("Event interest insert error:", error);

      if (error.code === "42P01") {
        return NextResponse.json(
          { error: missingTableMessage },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save your event interest." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event interest API error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
