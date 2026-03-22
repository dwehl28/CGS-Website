export default function EventsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h1 className="text-5xl font-black mb-4 text-center">CGS Events</h1>

        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
          Follow the major events, livestream challenges, and big competition
          moments from Crossodog Golf Society.
        </p>

        <div className="grid gap-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Featured Major
            </p>

            <h2 className="text-3xl font-bold mb-3">CGS Major – May 2</h2>

            <p className="text-zinc-300 mb-4">
              A Masters-style CGS event played at the Waste Management Course,
              featuring both scratch and handicap competitions across two
              sessions.
            </p>

            <div className="space-y-2 text-sm text-zinc-400 mb-6">
              <p>Course: Waste Management Course</p>
              <p>Format: Scratch + Handicap</p>
              <p>Sessions: 12pm–4pm and 5pm–9pm</p>
              <p>Members: $65</p>
              <p>Non-members: $70</p>
              <p>Live streamed: Yes</p>
            </div>

            <div className="flex gap-4 flex-wrap">
              <a
                href="/events/cgs-major"
                className="bg-sky-400 text-black px-5 py-3 rounded-full font-semibold inline-block"
              >
                Register
              </a>
              <a
                href="/events/cgs-major"
                className="border border-white px-5 py-3 rounded-full inline-block"
              >
                View Event Details
              </a>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Charity Stream
            </p>

            <h2 className="text-3xl font-bold mb-3">
              Movember Charity Stream – Nov 28 to Nov 29
            </h2>

            <p className="text-zinc-300 mb-4">
              A 24-hour CGS challenge stream where the team plays golf the
              entire time to support Movember and create a major community
              event.
            </p>

            <div className="space-y-2 text-sm text-zinc-400 mb-6">
              <p>Start: Saturday 28 November</p>
              <p>Finish: Sunday 29 November</p>
              <p>Format: 24-hour golf challenge</p>
              <p>Purpose: Charity + content + community</p>
            </div>

            <div className="flex gap-4 flex-wrap">
             <a
 	       href="/events/movember-charity-stream"
               className="bg-sky-400 text-black px-5 py-3 rounded-full font-semibold inline-block"
             >
               Learn More
             </a>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Finals
            </p>

            <h2 className="text-3xl font-bold mb-3">CGS Grand Final</h2>

            <p className="text-zinc-300 mb-4">
              The Grand Final brings together the eligible teams from the league
              structure and acts as one of the major closing events of the CGS
              calendar.
            </p>

            <div className="space-y-2 text-sm text-zinc-400 mb-6">
              <p>Entry: Invite-only</p>
              <p>Eligibility: Based on league qualification</p>
              <p>Status: More details coming later</p>
            </div>

            <div className="flex gap-4 flex-wrap">
              <button className="border border-white px-5 py-3 rounded-full">
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}