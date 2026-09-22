import { NextResponse } from "next/server";

import { registerPar3Player } from "@/lib/par3-showdown";
import type { Par3TeeCategory } from "@/lib/par3-showdown-types";

export const dynamic = "force-dynamic";

type RegistrationBody = {
  name?: unknown;
  phone?: unknown;
  teeCategory?: unknown;
  consent?: unknown;
  website?: unknown;
};

const teeCategories = new Set<Par3TeeCategory>([
  "championship",
  "ladies",
  "junior",
]);

export async function POST(request: Request) {
  let body: RegistrationBody;

  try {
    body = (await request.json()) as RegistrationBody;
  } catch {
    return NextResponse.json(
      { error: "Registration details could not be read." },
      { status: 400 }
    );
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const teeCategory = body.teeCategory;

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Enter the player name as it should appear in the draw." },
      { status: 400 }
    );
  }

  if (phone.replace(/\D/g, "").length < 8 || phone.length > 30) {
    return NextResponse.json(
      { error: "Enter a valid contact phone number." },
      { status: 400 }
    );
  }

  if (
    typeof teeCategory !== "string" ||
    !teeCategories.has(teeCategory as Par3TeeCategory)
  ) {
    return NextResponse.json(
      { error: "Choose the correct tee category." },
      { status: 400 }
    );
  }

  if (body.consent !== true) {
    return NextResponse.json(
      { error: "Registration consent is required." },
      { status: 400 }
    );
  }

  try {
    const result = await registerPar3Player({
      name,
      phone,
      teeCategory: teeCategory as Par3TeeCategory,
      consent: true,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration could not be saved.";
    const conflict = /sold out|closed|already/i.test(message);

    console.error("Par 3 public registration error:", error);
    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 500 }
    );
  }
}
