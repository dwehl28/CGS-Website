import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="text-center py-16 px-6 max-w-6xl mx-auto">
        <div className="flex justify-center mb-8">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society logo"
            width={260}
            height={260}
            className="h-auto w-auto max-w-[260px]"
            priority
          />
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight">
          Crossodog Golf Society
        </h1>

        <p className="text-xl text-zinc-400 mb-6">
          Where Golf meets the average person
        </p>

        <p className="max-w-2xl mx-auto text-zinc-300 mb-8">
          A golf community for everyday players. Follow the content, join the
          events, rep the merch, and be part of CGS.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="/events"
            className="rounded-full bg-sky-400 px-6 py-3 text-black font-semibold"
          >
            View Events
          </a>

          <a
            href="/membership"
            className="rounded-full border border-white px-6 py-3 font-semibold"
          >
            Join CGS
          </a>
        </div>
      </section>

      <section className="px-6 py-10 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Featured Event</h2>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-lg">
          <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
            Live Streamed
          </p>

          <h3 className="text-2xl font-bold mb-2">CGS Major – May 2</h3>

          <p className="text-zinc-400 mb-4">
            Waste Management Course • Scratch & Handicap
          </p>

          <p className="mb-2 text-sm text-zinc-300">
            Sessions: 12pm–4pm and 5pm–9pm
          </p>

          <p className="mb-6 text-sm text-zinc-500">
            Members: $65 • Non-members: $70
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/events/cgs-major"
              className="bg-sky-400 text-black px-4 py-2 rounded-full font-semibold inline-block"
            >
              Register
            </a>

           <a
             href="/events/cgs-major"
             className="border border-white px-4 py-2 rounded-full inline-block"
           >
             View Details
           </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 max-w-6xl mx-auto">
       <div className="flex items-center justify-between mb-6">
         <h2 className="text-2xl font-bold">Latest Events</h2>

         <a
           href="/events"
           className="text-sky-400 text-sm font-semibold hover:underline"
         >
           View all events
         </a>
       </div>

       <div className="grid md:grid-cols-2 gap-6">
         <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
           <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
             Featured Major
           </p>

           <h3 className="text-2xl font-bold mb-2">CGS Major</h3>

           <p className="text-zinc-400 mb-4">
             Waste Management Course • Scratch + Handicap • 2 May
           </p>

           <a
             href="/events/cgs-major"
             className="inline-block bg-sky-400 text-black px-4 py-2 rounded-full font-semibold"
           >
             View Event
           </a>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
           <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
             Charity Stream
           </p>

           <h3 className="text-2xl font-bold mb-2">Movember Charity Stream</h3>

           <p className="text-zinc-400 mb-4">
             24-hour challenge stream • 28–29 November
           </p>

           <a
             href="/events/movember-charity-stream"
             className="inline-block border border-white px-4 py-2 rounded-full font-semibold"
           >
             Learn More
           </a>
         </div>
       </div>
     </section>
      <section className="px-6 py-10 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Membership Options
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-xl font-bold mb-2">Online Social</h3>
            <p className="text-zinc-400 mb-4">Free</p>

            <ul className="text-sm text-zinc-300 mb-4 space-y-2">
              <li>• Follow CGS content</li>
              <li>• Stay updated with news and events</li>
              <li>• Be part of the online community</li>
            </ul>

            <a
              href="/membership"
              className="w-full border border-white py-2 rounded-full inline-block text-center"
            >
              Join Free
            </a>
          </div>

          <section className="px-6 py-10 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Explore CGS</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
                  Store
                </p>

                <h3 className="text-2xl font-bold mb-3">Merch</h3>

                <p className="text-zinc-400 mb-4">
                  Rep the CGS brand with shirts, golf balls, and future drops.
                </p>

                <a
                  href="/merch"
                  className="inline-block bg-sky-400 text-black px-4 py-2 rounded-full font-semibold"
                >
                  View Merch
                </a>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
                  Content
                </p>

                <h3 className="text-2xl font-bold mb-3">Media</h3>

                <p className="text-zinc-400 mb-4">
                  Follow CGS across Instagram, TikTok, YouTube, and Twitch.
                </p>

                <a
                  href="/media"
                  className="inline-block border border-white px-4 py-2 rounded-full font-semibold"
                >
                  View Media
                </a>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-sky-400 text-sm font-semibold uppercase tracking-wide mb-2">
                  Clubhouse
                </p>

                <h3 className="text-2xl font-bold mb-3">Sports Hub</h3>

                <p className="text-zinc-400 mb-4">
                  Keep up with PGA, AFL, NRL, and F1 in one CGS sports space.
                </p>

                <a
                  href="/sports"
                  className="inline-block border border-white px-4 py-2 rounded-full font-semibold"
                >
                  Open Sports Hub
                </a>
              </div>
            </div>
          </section>

          <div className="bg-zinc-900 p-6 rounded-2xl border border-sky-400">
            <h3 className="text-xl font-bold mb-2">Playing Member</h3>
            <p className="text-zinc-400 mb-4">Paid</p>

            <ul className="text-sm text-zinc-300 mb-4 space-y-2">
              <li>• Play CGS in-person events</li>
              <li>• Discounted major entry</li>
              <li>• Priority access to registrations</li>
            </ul>

            <a
              href="/membership"
              className="w-full bg-sky-400 text-black py-2 rounded-full font-semibold inline-block text-center"
            >
              Join Now
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}