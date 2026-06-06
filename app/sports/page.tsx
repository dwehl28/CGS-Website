import type { Metadata } from "next";

import PageIntro from "@/components/PageIntro";
import SportsHubRotator from "@/components/SportsHubRotator";
import { getSportsHubSnapshots } from "@/lib/live-sports";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sports Hub",
  description:
    "Track the sports CGS cares about with rotating live fixtures, recent results, and CGS-calculated ladder views.",
  path: "/sports",
});

export const dynamic = "force-dynamic";

export default async function SportsPage() {
  const snapshots = await getSportsHubSnapshots();
  const updatedAtLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="Live clubhouse feed"
          title="Sports Hub"
          description="A rotating snapshot of the sports CGS talks about most, with fixtures, results, and CGS-calculated ladder views."
          align="center"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshots.map((snapshot) => (
            <div
              key={`${snapshot.key}-summary`}
              className="subtle-grid-card rounded-[1.35rem] px-4 py-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {snapshot.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {snapshot.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {snapshot.nextEvent?.title ?? snapshot.lastEvent?.title ?? "Feed updating"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <SportsHubRotator
            snapshots={snapshots}
            updatedAtLabel={updatedAtLabel}
            sourceLabel="CGS-calculated + TheSportsDB"
          />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="panel rounded-[1.75rem] p-8">
            <h2 className="text-3xl">Why it belongs in CGS</h2>
            <div className="mt-6 grid gap-4">
              {[
                "Keep the clubhouse conversation moving between league rounds and major events.",
                "Give CGS followers a quick snapshot of the sports they already talk about together.",
                "Use CGS-built ladders for AFL and NRL instead of depending on a third-party standings widget.",
              ].map((point, index) => (
                <div
                  key={point}
                  className="subtle-grid-card rounded-[1.3rem] px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-zinc-200">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-8">
            <h2 className="text-3xl">How the ladder works</h2>
            <p className="mt-4 leading-7 text-zinc-300">
              AFL and NRL are now calculated inside the site using season
              results, percentage, differential, and competition points. That
              means the ladder view is owned by CGS rather than embedded from
              another standings source.
            </p>
            <p className="mt-4 leading-7 text-zinc-300">
              Formula 1 and PGA TOUR still need standings-specific logic because
              they run on championship and points systems that do not behave
              like a normal club ladder, so those cards stay clearly staged for
              now.
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              Fixtures and results source: TheSportsDB. AFL and NRL ladder math:
              CGS.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
