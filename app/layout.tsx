import "./globals.css";

export const metadata = {
  title: "Crossodog Golf Society",
  description: "Where Golf meets the average person",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/90 backdrop-blur">
  <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
    <a href="/" className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold">
        CG
      </div>
      <div>
        <p className="text-white font-bold leading-none">Crossodog Golf Society</p>
        <p className="text-xs text-zinc-400">Where Golf meets the average person</p>
      </div>
    </a>

    <div className="hidden md:flex gap-6 text-sm text-zinc-300">
      <a href="/" className="hover:text-white">Home</a>
      <a href="/events" className="hover:text-white">Events</a>
      <a href="/membership" className="hover:text-white">Membership</a>
      <a href="/merch" className="hover:text-white">Merch</a>
      <a href="/media" className="hover:text-white">Media</a>
      <a href="/contact" className="hover:text-white">Contact</a>
      <a href="/sports" className="hover:text-white">Sports Hub</a>
    </div>

    <div>
      <a
        href="/membership"
        className="bg-sky-400 text-black px-4 py-2 rounded-full font-semibold text-sm hover:opacity-90"
      >
        Join CGS
      </a>
    </div>
  </div>
</nav>

        {children}

        <footer className="border-t border-zinc-800 mt-16">
          <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-10">
            <div>
              <h3 className="text-xl font-bold mb-2">Crossodog Golf Society</h3>
              <p className="text-zinc-400 text-sm">
                Where Golf meets the average person.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <div className="flex flex-col gap-2 text-sm text-zinc-400">
                <a href="/">Home</a>
                <a href="/events">Events</a>
                <a href="/membership">Membership</a>
                <a href="/merch">Merch</a>
                <a href="/media">Media</a>
                <a href="/contact">Contact</a>
                <a href="/sports">Sports Hub</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Connect</h4>
              <div className="flex flex-col gap-2 text-sm text-zinc-400">
                <a href="https://www.instagram.com/crossogolf/" target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
                <a href="https://www.tiktok.com/@crossogs" target="_blank" rel="noopener noreferrer">
                  TikTok
                </a>
                <a href="https://www.youtube.com/@CrossodogGolfSociety" target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
                <a href="https://www.twitch.tv/crossodog" target="_blank" rel="noopener noreferrer">
                  Twitch
                </a>
                <a href="mailto:crossodoggolf@gmail.com">
                  crossodoggolf@gmail.com
                </a>
                <a
                  href="https://crossodoggolfs-shop.bigcartel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official Merch Store
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 px-6 py-4 text-center text-xs text-zinc-500">
            © 2026 Crossodog Golf Society. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}