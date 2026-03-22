export default function MediaPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h1 className="text-5xl font-black mb-4 text-center">CGS Media</h1>

        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
          Follow Crossodog Golf Society across all platforms for livestreams,
          clips, event content, highlights, and community updates.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <a
            href="https://www.instagram.com/crossogolf/"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-sky-400 transition"
          >
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Social
            </p>
            <h2 className="text-3xl font-bold mb-3">Instagram</h2>
            <p className="text-zinc-300">
              Follow CGS photos, posts, event updates, and branded content.
            </p>
          </a>

          <a
            href="https://www.tiktok.com/@crossogs"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-sky-400 transition"
          >
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Social
            </p>
            <h2 className="text-3xl font-bold mb-3">TikTok</h2>
            <p className="text-zinc-300">
              Catch CGS short-form videos, clips, and moments from the course.
            </p>
          </a>

          <a
            href="https://www.youtube.com/@CrossodogGolfSociety"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-sky-400 transition"
          >
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Video
            </p>
            <h2 className="text-3xl font-bold mb-3">YouTube</h2>
            <p className="text-zinc-300">
              Watch full videos, major recaps, challenge content, and CGS event
              coverage.
            </p>
          </a>

          <a
            href="https://www.twitch.tv/crossodog"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-sky-400 transition"
          >
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Live
            </p>
            <h2 className="text-3xl font-bold mb-3">Twitch</h2>
            <p className="text-zinc-300">
              Tune in for livestreams, event coverage, and live CGS content.
            </p>
          </a>
        </div>

        <div className="mt-14 text-center">
          <p className="text-zinc-500 mb-4">
            Business or collab enquiries
          </p>

          <a
            href="mailto:crossodoggolf@gmail.com"
            className="inline-block border border-white px-6 py-3 rounded-full font-semibold hover:bg-white hover:text-black transition"
          >
            crossodoggolf@gmail.com
          </a>
        </div>
      </section>
    </main>
  );
}