export default function SportsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h1 className="text-5xl font-black mb-4 text-center">Sports Hub</h1>

        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
          Keep an eye on the sports that matter to the CGS community. This hub
          will eventually bring together golf, AFL, NRL, and F1 in one place.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Golf
            </p>
            <h2 className="text-3xl font-bold mb-3">PGA Tour</h2>
            <p className="text-zinc-300 mb-4">
              Future home for PGA results, live leaderboard tracking, and major
              championship updates.
            </p>
            <p className="text-zinc-500 text-sm">
              Status: Placeholder for future live data or widgets
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Football
            </p>
            <h2 className="text-3xl font-bold mb-3">AFL</h2>
            <p className="text-zinc-300 mb-4">
              Future home for AFL scores, standings, and weekly ladder updates.
            </p>
            <p className="text-zinc-500 text-sm">
              Status: Placeholder for future live data or widgets
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Rugby League
            </p>
            <h2 className="text-3xl font-bold mb-3">NRL</h2>
            <p className="text-zinc-300 mb-4">
              Future home for NRL results, fixtures, and ladder movement across
              the season.
            </p>
            <p className="text-zinc-500 text-sm">
              Status: Placeholder for future live data or widgets
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Motorsport
            </p>
            <h2 className="text-3xl font-bold mb-3">Formula 1</h2>
            <p className="text-zinc-300 mb-4">
              Future home for F1 race results, championship standings, and major
              weekend updates.
            </p>
            <p className="text-zinc-500 text-sm">
              Status: Placeholder for future live data or widgets
            </p>
          </div>
        </div>

        <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Why this exists</h2>
          <p className="text-zinc-300 max-w-3xl mx-auto leading-7">
            CGS is more than just events. The Sports Hub gives the community
            another reason to check in regularly and helps turn the website into
            a broader clubhouse-style destination.
          </p>
        </div>
      </section>
    </main>
  );
}