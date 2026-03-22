export default function MerchPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto text-center">
        <h1 className="text-5xl font-black mb-4">CGS Merch</h1>

        <p className="text-zinc-400 max-w-2xl mx-auto mb-12">
          Rep the Crossodog Golf Society brand with current CGS merch. Browse
          the latest drops and head to the official store to order.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-left">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Current Item
            </p>
            <h2 className="text-3xl font-bold mb-3">CGS Shirts</h2>
            <p className="text-zinc-300 mb-4">
              Clean CGS-branded shirts built for the community, content, and
              event days.
            </p>
            <p className="text-zinc-500 text-sm">
              More sizing and design options available through the official
              store.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-left">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Current Item
            </p>
            <h2 className="text-3xl font-bold mb-3">CGS Golf Balls</h2>
            <p className="text-zinc-300 mb-4">
              CGS golf balls for players who want to bring the brand onto the
              course.
            </p>
            <p className="text-zinc-500 text-sm">
              Limited runs and future merch drops will be listed through the
              CGS store.
            </p>
          </div>
        </div>

        <a
          href="https://crossodoggolfs-shop.bigcartel.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-sky-400 text-black px-8 py-4 rounded-full font-semibold text-lg"
        >
          Shop Official Merch
        </a>
      </section>
    </main>
  );
}