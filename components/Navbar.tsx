export default function Navbar() {
  return (
    <nav className="w-full bg-black border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
      
      <div className="text-white font-bold text-xl">
        CGS
      </div>

      <div className="flex gap-6 text-zinc-300 text-sm">
        <a href="/">Home</a>
        <a href="/events">Events</a>
        <a href="/membership">Membership</a>
        <a href="/merch">Merch</a>
        <a href="/media">Media</a>
      </div>

      <div>
        <a
          href="/membership"
          className="bg-sky-400 text-black px-4 py-2 rounded-full font-semibold text-sm"
        >
          Join CGS
        </a>
      </div>
    </nav>
  );
}