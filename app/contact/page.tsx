export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h1 className="text-5xl font-black mb-4 text-center">Contact CGS</h1>

        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
          Want to get involved with Crossodog Golf Society, ask about events,
          talk merch, or discuss a collab? Reach out below.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Email
            </p>
            <h2 className="text-3xl font-bold mb-3">General Enquiries</h2>
            <p className="text-zinc-300 mb-6">
              For questions about CGS, membership, events, or general contact.
            </p>

            <a
              href="mailto:crossodoggolf@gmail.com"
              className="inline-block bg-sky-400 text-black px-6 py-3 rounded-full font-semibold"
            >
              crossodoggolf@gmail.com
            </a>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Partnerships
            </p>
            <h2 className="text-3xl font-bold mb-3">Sponsors & Collaborations</h2>
            <p className="text-zinc-300 mb-6">
              Interested in partnering with CGS, sponsoring an event, or working
              together on content? Get in touch.
            </p>

            <a
              href="mailto:crossodoggolf@gmail.com"
              className="inline-block border border-white px-6 py-3 rounded-full font-semibold hover:bg-white hover:text-black transition"
            >
              Contact for Partnerships
            </a>
          </div>
        </div>

        <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Follow CGS</h2>

          <div className="grid md:grid-cols-2 gap-4 text-center">
            <a
              href="https://www.instagram.com/crossogolf/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-zinc-700 rounded-xl px-4 py-4 hover:border-sky-400 transition"
            >
              Instagram
            </a>

            <a
              href="https://www.tiktok.com/@crossogs"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-zinc-700 rounded-xl px-4 py-4 hover:border-sky-400 transition"
            >
              TikTok
            </a>

            <a
              href="https://www.youtube.com/@CrossodogGolfSociety"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-zinc-700 rounded-xl px-4 py-4 hover:border-sky-400 transition"
            >
              YouTube
            </a>

            <a
              href="https://www.twitch.tv/crossodog"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-zinc-700 rounded-xl px-4 py-4 hover:border-sky-400 transition"
            >
              Twitch
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}