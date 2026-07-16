"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/clubhouse-admin", label: "Dashboard" },
  { href: "/clubhouse-admin/inbox", label: "Inbox" },
  { href: "/clubhouse-admin/scoreboard", label: "Scoreboards" },
  { href: "/clubhouse-admin/round-stats", label: "Round Stats" },
  { href: "/clubhouse-admin/ambrose", label: "Ambrose App" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {adminLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/clubhouse-admin" && pathname.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              isActive
                ? "bg-[var(--accent-soft)] text-white"
                : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/8"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
