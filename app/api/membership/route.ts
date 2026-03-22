import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      full_name,
      email,
      membership_type,
      handicap,
      handicap_type,
      interested_in_events,
    } = body;

    if (!full_name || !email || !membership_type) {
      return NextResponse.json(
        { error: "Full name, email, and membership type are required." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("membership_interest")
      .insert([
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