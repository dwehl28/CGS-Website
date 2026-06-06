export default function Loading() {
  return (
    <main className="min-h-screen text-white">
      <section className="page-shell md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="eyebrow">Loading clubhouse</div>
          <h1 className="mt-6 text-5xl md:text-6xl">Crossodog Golf Society</h1>
          <p className="mt-4 text-zinc-400">
            Loading the next part of the clubhouse.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel rounded-[2rem] p-8">
            <div className="loading-bar h-4 w-32 rounded-full" />
            <div className="loading-bar mt-6 h-12 w-full rounded-3xl" />
            <div className="loading-bar mt-4 h-12 w-4/5 rounded-3xl" />
            <div className="loading-bar mt-8 h-4 w-full rounded-full" />
            <div className="loading-bar mt-3 h-4 w-5/6 rounded-full" />
            <div className="loading-bar mt-10 h-12 w-40 rounded-full" />
          </div>

          <div className="panel rounded-[2rem] p-8">
            <div className="loading-bar h-4 w-24 rounded-full" />
            <div className="loading-bar mt-6 h-32 w-full rounded-[1.5rem]" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="loading-bar h-24 rounded-[1.25rem]" />
              <div className="loading-bar h-24 rounded-[1.25rem]" />
              <div className="loading-bar h-24 rounded-[1.25rem]" />
              <div className="loading-bar h-24 rounded-[1.25rem]" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
