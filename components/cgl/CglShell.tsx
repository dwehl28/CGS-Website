"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, UserRound, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./CglShell.module.css";

const links = [
  { href: "/cgl", label: "The clubhouse" },
  { href: "/cgl/competition", label: "Competition" },
  { href: "/cgl/leaderboard", label: "Leaderboards" },
  { href: "/cgl/calendar", label: "Seasons" },
  { href: "/cgl/prizes", label: "Prizes & rewards" },
  { href: "/cgl/memberships", label: "Memberships" },
];

export default function CglShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
          >
            <Image
              src="/cgl/cgs-logo-official.png"
              width={64}
              height={64}
              alt="Crossodog Golf Society"
              priority
            />
            <span className={styles.brandLetters}>
              CGL<span> /</span>
            </span>
            <span className={styles.brandName}>
              Crossodog
              <br />
              Golf League
            </span>
          </Link>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.back}>
              <ArrowLeft size={14} /> CGS home
            </Link>
            <Link href="/cgl/dashboard" className={styles.account}>
              <UserRound size={14} /> My clubhouse
            </Link>
          </div>
        </div>
        <div className={styles.navWrap}>
          <div className={styles.navInner}>
            <nav aria-label="CGL navigation" className={styles.navigation}>
              {links.map((link) => {
                const matchPath = link.href.startsWith("/cgl/players")
                  ? "/cgl/players/"
                  : link.href.startsWith("/cgl/rounds")
                    ? "/cgl/rounds/"
                    : link.href;
                const active =
                  link.href === "/cgl"
                    ? pathname === link.href
                    : pathname.startsWith(matchPath);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link href="/cgl/how-it-works">How it works</Link>
            </nav>
          </div>
        </div>
      </header>

      {legacyPreview ? (
        <div className={styles.preview}>
          <div>
            <FlaskConical size={15} aria-hidden="true" />
            <strong>Design preview</strong>
            <span>
              Sample scores. Real players and SGT results are in the Trial hub.
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.launch}>
          <span>MEMBER REVIEW · MEMBERSHIP SALES ARE CLOSED</span>
          <Link href="/cgl/preview/2027">
            See example standings <ArrowUpRight size={12} />
          </Link>
        </div>
      )}

      <main id="cgl-main" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div>
          <Link href="/cgl" className={styles.footerLogo}>
            CGL<span>.</span>
          </Link>
          <p>Your simulator. Your schedule. Your league.</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/cgl/rules">Rules & handicaps</Link>
          <Link href="/cgl/faq">FAQs</Link>
          <Link href="/cgl/archive">Results archive</Link>
          <Link href="/cgl/terms">Membership policies</Link>
          <Link href="/privacy">
            Privacy <ArrowUpRight size={12} />
          </Link>
          <Link href="/cgl/trial">
            SGT trial <ArrowUpRight size={12} />
          </Link>
        </div>
        <p className={styles.footerNote}>
          A Crossodog Golf Society league. 2027 season details to be confirmed.
          Trial results remain separate.
        </p>
      </footer>
    </div>
  );
}
