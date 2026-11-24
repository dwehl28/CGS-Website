"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  House,
  Menu,
  Radio,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import styles from "./CglShell.module.css";

const primaryLinks = [
  { href: "/cgl", label: "Home" },
  { href: "/cgl/competition", label: "Competition" },
  { href: "/cgl/leaderboard", label: "Leaderboards" },
  { href: "/cgl/calendar", label: "Season" },
  { href: "/cgl/players", label: "Players" },
  { href: "/cgl/prizes", label: "Prizes" },
  { href: "/cgl/memberships", label: "Memberships" },
];

const supportLinks = [
  { href: "/cgl/how-it-works", label: "How it works" },
  { href: "/cgl/rules", label: "Rules & handicaps" },
  { href: "/cgl/faq", label: "FAQs" },
  { href: "/cgl/archive", label: "Results archive" },
];

function isActive(pathname: string, href: string) {
  if (href === "/cgl") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CglShell({
  children,
  oneOffSalesOpen = false,
}: {
  children: ReactNode;
  oneOffSalesOpen?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const seasonOnePreview = pathname.startsWith("/cgl/preview/season-1");
  const legacyPreview =
    pathname.startsWith("/cgl/preview") ||
    pathname.startsWith("/cgl/rounds/") ||
    pathname.includes("/FairwayFox") ||
    pathname.includes("/PinSeeker") ||
    pathname.includes("/BunkerBandit") ||
    pathname.includes("/TheMulligan") ||
    pathname.includes("/KoalaFade") ||
    pathname.includes("/Sandgroper") ||
    pathname.includes("/BirdieBruce") ||
    pathname.includes("/WedgeWizard") ||
    pathname.includes("/ParTeeTime") ||
    pathname.includes("/GreenMachine");

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.shell}>
      <a href="#cgl-main" className={styles.skip}>
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            href="/cgl"
            className={styles.brand}
            aria-label="CGL — Crossodog Golf League home"
            onClick={closeMenu}
          >
            <span className={styles.brandPlate}>
              <Image
                src="/cgl/cgl-logo-official.jpg"
                width={1914}
                height={816}
                alt="Crossodog Golf League"
                priority
              />
            </span>
            <span className={styles.brandName}>
              <strong>Crossodog Golf League</strong>
              <small>Season 1 · 2027</small>
            </span>
          </Link>

          <div className={styles.headerActions}>
            <Link href="/cgl/live" className={styles.liveLink}>
              <Radio size={16} aria-hidden="true" /> Live
            </Link>
            <Link href="/cgl/dashboard" className={styles.account}>
              <UserRound size={17} aria-hidden="true" />
              <span>My clubhouse</span>
            </Link>
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={menuOpen}
              aria-controls="cgl-navigation"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <div
          id="cgl-navigation"
          className={`${styles.navWrap} ${menuOpen ? styles.navOpen : ""}`}
        >
          <div className={styles.navInner}>
            <nav aria-label="CGL navigation" className={styles.navigation}>
              {primaryLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className={styles.mobileSupport}>
              <p>League support</p>
              {supportLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={closeMenu}>
                  {link.label}
                </Link>
              ))}
              <Link href="/" onClick={closeMenu}>
                <House size={16} aria-hidden="true" /> CGS home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {legacyPreview ? (
        <div className={styles.preview}>
          <div>
            <FlaskConical size={17} aria-hidden="true" />
            <strong>Design preview</strong>
            <span>
              {seasonOnePreview
                ? "Season 1 presentation and draft schedule. No live records or payments are changed."
                : "Sample scores. Real players and SGT results are in the Trial hub."}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.launch}>
          <span className={styles.launchStatus} aria-hidden="true" />
          <strong>
            {oneOffSalesOpen
              ? "CGL memberships and Casual Registration are open"
              : "Explore CGL membership options"}
          </strong>
          <span>Play without creating an account.</span>
          <Link href="/cgl/join">View membership options</Link>
        </div>
      )}

      <main id="cgl-main" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Link href="/cgl" className={styles.footerLogo} aria-label="CGL home">
            <Image
              src="/cgl/cgl-logo-official.jpg"
              width={1914}
              height={816}
              alt="Crossodog Golf League"
                priority
            />
          </Link>
          <p>Two courses. Eighteen holes. One national simulator league.</p>
        </div>

        <div className={styles.footerNav}>
          <div>
            <strong>Compete</strong>
            <Link href="/cgl/competition">Current competition</Link>
            <Link href="/cgl/leaderboard">Leaderboards</Link>
            <Link href="/cgl/calendar">Season calendar</Link>
            <Link href="/cgl/players">Players</Link>
          </div>
          <div>
            <strong>Join</strong>
            <Link href="/cgl/memberships">Memberships</Link>
            <Link href="/cgl/how-it-works">How it works</Link>
            <Link href="/cgl/rules">Rules & handicaps</Link>
            <Link href="/cgl/faq">FAQs</Link>
          </div>
          <div>
            <strong>Account</strong>
            <Link href="/cgl/dashboard">My clubhouse</Link>
            <Link href="/cgl/live">Live tournament</Link>
            <Link href="/cgl/trial">SGT trial</Link>
            <Link href="/cgl/terms">Membership policies</Link>
          </div>
        </div>

        <div className={styles.presenter}>
          <span>Presented by</span>
          <Image
            src="/cgl/cgs-logo-official.png"
            width={640}
            height={640}
            alt="Crossodog Golf Society"
          />
        </div>

        <div className={styles.footerBase}>
          <p>
            Official CGSBunker SGT results update throughout live play. Trial
            results remain separate.
          </p>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cgl/archive">Archive</Link>
            <Link href="/">CGS home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
