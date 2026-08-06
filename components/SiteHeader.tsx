"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Menu, X } from "lucide-react";
import { useState } from "react";

const eventLinks = [
  { href: "/#live", label: "Live" },
  { href: "/#watch", label: "Watch" },
  { href: "/#format", label: "Format" },
  { href: "/#cgs", label: "About CGS" },
];

const shopUrl = "https://crossodoggolfs-shop.bigcartel.com";

export default function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="par3-site-header">
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
            <strong>CGS Par 3 Showdown</strong>
            <small>12 September 2026</small>
          </span>
        </Link>

        <nav className="par3-desktop-nav" aria-label="Par 3 event navigation">
          {eventLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="par3-header-entry"
        >
          Buy entry <ExternalLink />
        </a>

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
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
          >
            Buy entry <ExternalLink />
          </a>
        </nav>
      ) : null}
    </header>
  );
}
