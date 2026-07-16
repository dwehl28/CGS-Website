import type { Metadata } from "next";

import PlayerAmbroseApp from "@/components/ambrose/PlayerAmbroseApp";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "CGS Golf",
  description:
    "Sign in to CGS Golf, manage your player profile, and enter team scores during sim competition rounds.",
  path: "/play",
});

export const dynamic = "force-dynamic";

export default function PlayPage() {
  return (
    <main className="min-h-screen overflow-x-hidden text-white">
      <section className="cgs-app-shell page-shell max-w-7xl">
        <PlayerAmbroseApp />
      </section>
    </main>
  );
}
