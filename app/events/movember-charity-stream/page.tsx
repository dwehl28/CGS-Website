export default function MovemberCharityStreamPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-3">
          Charity Stream
        </p>

        <h1 className="text-5xl font-black mb-4">Movember Charity Stream</h1>

        <p className="text-zinc-400 text-lg mb-8 max-w-3xl">
          A 24-hour Crossodog Golf Society challenge stream where the CGS team
          plays golf the entire time to raise awareness, create content, and
          support the Movember cause.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-6">Event Overview</h2>

          <div className="grid md:grid-cols-2 gap-6 text-sm text-zinc-300">
            <div>
              <p className="text-zinc-500 mb-1">Start</p>
              <p>Saturday 28 November</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Finish</p>
              <p>Sunday 29 November</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Duration</p>
              <p>24 hours</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Format</p>
              <p>Continuous golf challenge stream</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Purpose</p>
              <p>Charity + content + community</p>
            </div>

            <div>
              <p className="text-zinc-500 mb-1">Status</p>
              <p>Planning stage</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-4">About the Event</h2>

          <p className="text-zinc-300 leading-7 mb-4">
            The Movember Charity Stream is designed to be one of the biggest
            community and content moments on the CGS calendar. Over the course
            of 24 hours, the team will take on a continuous golf challenge while
            livestreaming the full experience.
          </p>

          <p className="text-zinc-300 leading-7">
            This event is about more than golf. It is a charity-driven stream
            built to bring together supporters, viewers, and the broader CGS
            audience around a meaningful cause while creating a memorable annual
            event.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-10">
          <h2 className="text-2xl font-bold mb-4">Support or Get Involved</h2>

          <p className="text-zinc-300 mb-6">
            Want to support the event, collaborate, sponsor, or help with the
            Movember Charity Stream? Reach out through the contact page.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="/contact"
              className="bg-sky-400 text-black px-6 py-3 rounded-full font-semibold inline-block"
            >
              Contact CGS
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