import { NextResponse } from "next/server";

import { isValidEmail, normalizeString } from "@/lib/form-utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getMissingTableMessage() {
  return "Database form tables are not set up yet. Run the SQL in supabase/setup.sql and try again.";
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();

    const full_name = normalizeString(body.full_name, 120);
    const email = normalizeString(body.email, 200).toLowerCase();
    const membership_type = normalizeString(body.membership_type, 80);
    const handicap = normalizeString(body.handicap, 40);
    const handicap_type = normalizeString(body.handicap_type, 40);
    const interested_in_events = normalizeString(body.interested_in_events, 20);

    if (!full_name || !email || !membership_type) {
      return NextResponse.json(
        { error: "Full name, email, and membership type are required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("membership_interest").insert([
      {
        full_name,
        email,
        membership_type,
        handicap,
        handicap_type,
        interested_in_events,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);

      if (error.code === "42P01") {
        return NextResponse.json(
          { error: getMissingTableMessage() },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save membership interest." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
