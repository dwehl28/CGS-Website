export default function CGSMajorPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-3">
          Featured Major
        </p>

        <h1 className="text-5xl font-black mb-4">CGS Major</h1>

        <p className="text-zinc-400 text-lg mb-8 max-w-3xl">
          A Masters-style Crossodog Golf Society event played at the Waste
          Management Course, featuring both scratch and handicap competitions
          across two sessions and streamed live for the CGS community.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-6">Event Overview</h2>

          <div className="grid md:grid-cols-2 gap-6 text-sm text-zinc-300">
            <div>
              <p className="text-zinc-500 mb-1">Date</p>
              <p>2 May</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Venue</p>
              <p>Waste Management Course</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Format</p>
              <p>Scratch + Handicap</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Stream</p>
              <p>Live streamed</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Session One</p>
              <p>12pm – 4pm</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Session Two</p>
              <p>5pm – 9pm</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Member Price</p>
              <p>$65</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Public Price</p>
              <p>$70</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-4">About the Event</h2>

          <p className="text-zinc-300 leading-7 mb-4">
            The CGS Major is one of the signature events on the Crossodog Golf
            Society calendar. Designed with a Masters-style feel, it combines
            strong competition with the creator-driven and community-focused
            energy that defines CGS.
          </p>

          <p className="text-zinc-300 leading-7">
            Players will compete in both scratch and handicap formats, giving a
            wider range of golfers a chance to be part of the event. With live
            streaming throughout the day, the CGS Major is built to be both a
            serious event and a showcase moment for the brand.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-4">Registration</h2>

          <p className="text-zinc-300 mb-6">
            Interested in playing the CGS Major? Reach out through the contact
            page for now while registrations are being handled manually.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="/contact"
              className="bg-sky-400 text-black px-6 py-3 rounded-full font-semibold inline-block"
            >
              Register Interest
            </a>

            <a
              href="/events"
              className="border border-white px-6 py-3 rounded-full inline-block"
            >
              Back to Events
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}