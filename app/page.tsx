import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flag,
  MapPin,
  Medal,
  Radio,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import Par3Countdown from "@/components/par3/Par3Countdown";
import Par3LiveTournament from "@/components/par3/Par3LiveTournament";
import Par3RegistrationForm from "@/components/par3/Par3RegistrationForm";
import { getPublicPar3Snapshot } from "@/lib/par3-showdown";
import {
  getPar3RemainingSpots,
  PAR3_FINALS_STAGES,
  PAR3_POOL_STAGES,
} from "@/lib/par3-showdown-types";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Par 3 Championship II | 7 November 2026",
  description:
    "Enter the CGS Par 3 Championship II at The Tee Lounge: 24 players, six pools, two CTP contests, and a live-streamed Round of 16.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: "CGS Par 3 Championship II",
    description:
      "Saturday 7 November, 5:00pm at The Tee Lounge. Register, follow the draw, and watch every live result.",
    url: absoluteUrl("/"),
    type: "website",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "CGS Par 3 Championship II",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CGS Par 3 Championship II",
    description:
      "24 players. Six pools. One winner. Saturday 7 November at The Tee Lounge.",
    images: [absoluteUrl("/opengraph-image")],
  },
};

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );

  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1` : null;
}

export default async function Home() {
  const snapshot = await getPublicPar3Snapshot();
  const { event } = snapshot;
  const confirmedPlayers = snapshot.players.filter(
    (player) => !player.isWithdrawn
  ).length;
  const remainingSpots = getPar3RemainingSpots(snapshot);
  const embedUrl = event.isLive ? getYouTubeEmbedUrl(event.youtubeUrl) : null;
  const feeLabel = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(event.entryFeeCents / 100);
  const courseStages = [...PAR3_POOL_STAGES, ...PAR3_FINALS_STAGES];

  return (
    <main className="par3-home par3-v2-home">
      <section className="par3-v2-hero">
        <div className="par3-v2-hero-noise" aria-hidden="true" />
        <div className="par3-v2-hero-inner">
          <div className="par3-v2-hero-copy">
            <div className="par3-v2-eyebrow">
              <span className={event.registrationsOpen ? "is-open" : ""} />
              {remainingSpots === 0 ? "Sold out" : event.statusLabel}
            </div>
            <div className="par3-v2-title-lockup">
              <div className="par3-v2-logo-mark">
                <i aria-hidden="true">II</i>
                <Image
                  src="/par3/par3-logo.png"
                  alt="CGS Par 3"
                  width={280}
                  height={280}
                  priority
                />
              </div>
              <div>
                <span>CGS Par 3</span>
                <h1>Championship <b>II</b></h1>
                <p>Small course. Bigger competition.</p>
              </div>
            </div>

            <div className="par3-v2-event-grid" aria-label="Event details">
              <div><CalendarDays /><span>Saturday<strong>7 November</strong></span></div>
              <div><Clock3 /><span>First tee<strong>5:00pm start</strong></span></div>
              <div><MapPin /><span>Venue<strong>The Tee Lounge</strong></span></div>
              <div><CircleDollarSign /><span>Entry<strong>{feeLabel}</strong></span></div>
              <div><Users /><span>Maximum<strong>24 players</strong></span></div>
              <div className="is-availability">
                <Radio />
                <span>Available now<strong>{remainingSpots === 0 ? "Sold out" : `${remainingSpots} spots`}</strong></span>
              </div>
            </div>

            <div className="par3-v2-hero-actions">
              <a href="#register" className="par3-v2-button is-primary">
                {remainingSpots === 0 ? "Join the waitlist" : "Claim your place"}
                <ArrowRight />
              </a>
              <a href="#live" className="par3-v2-button is-secondary">
                Open live centre <Radio />
              </a>
            </div>
            <Par3Countdown startsAt={event.startsAt} />
          </div>

          <div className="par3-v2-poster-wrap">
            <span>Official event poster</span>
            <Image
              src="/par3/championship-ii-poster.webp"
              alt="CGS Par 3 Championship II event poster"
              width={567}
              height={701}
              priority
            />
          </div>
        </div>
        <div className="par3-v2-scroll-cue">
          <span>Registration open</span>
          <i />
          <span>Six pools of four</span>
          <i />
          <span>Live streamed</span>
          <i />
          <span>Two CTP contests</span>
          <i />
          <span>One champion</span>
        </div>
      </section>

      <section id="register" className="par3-v2-register-section">
        <div className="par3-v2-section-head">
          <div>
            <span>01 / Secure a place</span>
            <h2>The field is filling live.</h2>
          </div>
          <p>
            Register here and the availability count updates automatically. CGS
            will contact you with payment and event-night details.
          </p>
        </div>
        <div className="par3-v2-register-layout">
          <Par3RegistrationForm
            maxPlayers={event.maxPlayers}
            initialConfirmedPlayers={confirmedPlayers}
            registrationsOpen={event.registrationsOpen}
            entryFeeCents={event.entryFeeCents}
          />
          <div className="par3-v2-field-card">
            <div>
              <span>Championship field</span>
              <strong>{confirmedPlayers}<small> / {event.maxPlayers}</small></strong>
              <p>{remainingSpots === 0 ? "The field is complete." : `${remainingSpots} places remain.`}</p>
            </div>
            <div className="par3-v2-player-dots" aria-hidden="true">
              {Array.from({ length: event.maxPlayers }, (_, index) => (
                <i key={index} className={index < confirmedPlayers ? "is-filled" : ""} />
              ))}
            </div>
            <ul>
              <li><CheckCircle2 /> Three pool matches guaranteed</li>
              <li><CheckCircle2 /> Live fixtures and simulator calls</li>
              <li><CheckCircle2 /> Finals and CTP qualification paths</li>
              <li><CheckCircle2 /> Full CGS livestream coverage</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="format" className="par3-v2-format-section">
        <div className="par3-v2-section-head is-light">
          <div>
            <span>02 / The format</span>
            <h2>Six pools. Two routes through.</h2>
          </div>
          <p>
            Every player gets three head-to-head matches before the best sixteen
            move into a single-elimination finals bracket.
          </p>
        </div>

        <div className="par3-v2-format-road">
          <article>
            <span>Stage 01</span>
            <Users />
            <h3>Pool play</h3>
            <strong>6 pools of 4</strong>
            <p>Every player faces each opponent in their pool once.</p>
          </article>
          <article>
            <span>Stage 02</span>
            <Trophy />
            <h3>Automatic spots</h3>
            <strong>Top 2 advance</strong>
            <p>Twelve players lock in their Round of 16 places.</p>
          </article>
          <article>
            <span>Stage 03</span>
            <Target />
            <h3>CTP playoff</h3>
            <strong>Top 4 advance</strong>
            <p>All third-place players shoot for the final four bracket spots.</p>
          </article>
          <article>
            <span>Side contest</span>
            <Medal />
            <h3>CTP prize</h3>
            <strong>Fourth places</strong>
            <p>A separate closest-to-pin contest keeps every pool alive.</p>
          </article>
          <article className="is-final">
            <span>Stage 04</span>
            <Flag />
            <h3>Finals</h3>
            <strong>16 to 1</strong>
            <p>Win and advance through the Round of 16 to the title.</p>
          </article>
        </div>

        <div className="par3-v2-rules">
          <span>No handicaps</span>
          <span>Three-hole match play</span>
          <span>One point per pool win</span>
          <span>CTP decides tied knockout matches</span>
        </div>
      </section>

      <section id="live" className="par3-v2-live-section">
        <div className="par3-v2-section-head">
          <div>
            <span>03 / Event-night command centre</span>
            <h2>Know where to play next.</h2>
          </div>
          <p>
            Live tables, results, bracket progress, and a clear UP NEXT call for
            every simulator all update in one place.
          </p>
        </div>
        <Par3LiveTournament initialSnapshot={snapshot} />
      </section>

      <section className="par3-v2-course-section">
        <div className="par3-v2-course-copy">
          <span>04 / Eight stages</span>
          <h2>A different test every round.</h2>
          <p>
            The course changes as the pressure rises. Pool allocations, simulator
            calls, and the complete schedule will be published in the live centre.
          </p>
        </div>
        <div className="par3-v2-course-grid">
          {courseStages.map((stage, index) => (
            <article key={stage.key}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{stage.label}</span>
              <strong>{stage.course}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="watch" className="par3-v2-watch-section">
        <div className="par3-v2-watch-copy">
          <span><Radio /> Live from The Tee Lounge</span>
          <h2>Every match. Every move. One champion.</h2>
          <p>
            Watch Championship II with live CGS coverage, on-screen fixtures,
            simulator calls, current standings, and the full finals run.
          </p>
          <a
            href={event.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="par3-v2-button is-primary"
          >
            Open CGS YouTube <ExternalLink />
          </a>
        </div>
        <div className="par3-v2-video-frame">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title="CGS Par 3 Championship II live stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div>
              <div className="par3-v2-logo-mark is-small">
                <i aria-hidden="true">II</i>
                <Image src="/par3/par3-logo.png" alt="CGS Par 3" width={220} height={220} />
              </div>
              <strong>Livestream appears here on event night</strong>
              <span>Saturday 7 November / 5:00pm</span>
            </div>
          )}
        </div>
      </section>

      <section className="par3-v2-closing">
        <Image src="/cgs-logo.png" alt="Crossodog Golf Society" width={130} height={130} />
        <div>
          <span>Ready for Championship II?</span>
          <h2>{remainingSpots === 0 ? "The field is locked." : `${remainingSpots} chances left to enter.`}</h2>
        </div>
        <a href="#register" className="par3-v2-button is-primary">
          {remainingSpots === 0 ? "View the live draw" : "Register now"} <ArrowRight />
        </a>
        <Link href="/about">About CGS</Link>
      </section>
    </main>
  );
}
