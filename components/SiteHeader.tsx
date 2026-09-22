"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const eventLinks = [
  { href: "/#register", label: "Register" },
  { href: "/#live", label: "Live" },
  { href: "/#watch", label: "Watch" },
  { href: "/#format", label: "Format" },
];

export default function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="par3-site-header">
      <div className="par3-header-alert">
        <span>CGS Par 3 Championship II</span>
        <strong>Saturday 7 November</strong>
        <span>24 places / The Tee Lounge</span>
      </div>
      <div className="par3-header-inner">
        <Link href="/" className="par3-header-brand" onClick={() => setIsOpen(false)}>
          <Image
            src="/par3/par3-logo.png"
            alt="CGS Par 3"
            width={58}
            height={58}
            priority
          />
          <span>
            <strong>CGS Par 3 Championship II</strong>
            <small>7 November 2026</small>
          </span>
        </Link>

        <nav className="par3-desktop-nav" aria-label="Par 3 event navigation">
          {eventLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/#register" className="par3-header-entry">
          Enter now
        </Link>

        <button
          type="button"
          className="par3-menu-button"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isOpen ? (
        <nav className="par3-mobile-nav" aria-label="Mobile event navigation">
          {eventLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href="/about" onClick={() => setIsOpen(false)}>
            About CGS
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
