import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 bg-black px-6 py-4">
      <div className="text-xl font-bold text-white">CGS</div>

      <div className="flex gap-6 text-sm text-zinc-300">
        <Link href="/">Home</Link>
        <Link href="/events">Events</Link>
        <Link href="/membership">Membership</Link>
        <Link href="/merch">Merch</Link>
        <Link href="/media">Media</Link>
      </div>

      <div>
        <Link
          href="/membership"
          className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-black"
        >
          Join CGS
        </Link>
      </div>
    </nav>
  );
}
