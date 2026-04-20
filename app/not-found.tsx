import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-24">
        <div className="panel mx-auto max-w-3xl rounded-[2rem] p-8 text-center md:p-12">
          <div className="eyebrow">Page not found</div>
          <h1 className="mt-6 text-5xl md:text-6xl">That page is off the fairway.</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-300">
            The link may be outdated, the page may have moved, or the address
            may have been typed incorrectly. The main parts of CGS are still
            easy to get back to.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/" className="btn-primary">
              Return home
            </Link>
            <Link href="/events" className="btn-secondary">
              Browse events
            </Link>
            <Link href="/contact" className="btn-secondary">
              Contact CGS
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
