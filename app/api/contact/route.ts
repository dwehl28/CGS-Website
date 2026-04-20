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
      full_name: normalizeString(body.full_name, 120),
      email: normalizeString(body.email, 200).toLowerCase(),
      phone: normalizeString(body.phone, 40),
      enquiry_type: normalizeString(body.enquiry_type, 60),
      preferred_contact: normalizeString(body.preferred_contact, 20),
      subject: normalizeString(body.subject, 160),
      message: normalizeString(body.message, 2000),
    };

    if (
      !submission.full_name ||
      !submission.email ||
      !submission.enquiry_type ||
      !submission.subject ||
      !submission.message
    ) {
      return NextResponse.json(
        { error: "Please complete the required contact fields." },
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
      .from("contact_enquiries")
      .insert([submission]);

    if (error) {
      console.error("Contact enquiry insert error:", error);

      if (error.code === "42P01") {
        return NextResponse.json(
          { error: missingTableMessage },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save your message." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
