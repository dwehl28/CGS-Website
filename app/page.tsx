import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flag,
  MapPin,
  Play,
  Radio,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import Par3Countdown from "@/components/par3/Par3Countdown";
import Par3LiveTournament from "@/components/par3/Par3LiveTournament";
import Par3MotionStripes from "@/components/par3/Par3MotionStripes";
import { getPublicPar3Snapshot } from "@/lib/par3-showdown";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Par 3 Championship | 12 September 2026",
  description:
    "Follow the 2026 CGS Par 3 Championship live: 32 golfers, eight pools, and a single-elimination Round of 16 at The Tee Lounge.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: "CGS Par 3 Championship",
    description:
      "Saturday 12 September at The Tee Lounge. Follow every pool, result, qualifier, and finals match live.",
    url: absoluteUrl("/"),
    type: "website",
    images: [
      {
        url: absoluteUrl("/par3/par3-championship.png"),
        width: 1122,
        height: 1402,
        alt: "CGS Par 3 Championship event poster",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CGS Par 3 Championship",
    description: "32 golfers. Eight pools. One winner. Follow it live on 12 September.",
    images: [absoluteUrl("/par3/par3-championship.png")],
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
  const embedUrl = event.isLive ? getYouTubeEmbedUrl(event.youtubeUrl) : null;
  const confirmedPlayers = snapshot.players.filter(
    (player) => !player.isWithdrawn
  ).length;

  return (
    <main className="par3-home">
      <section className="par3-hero">
        <div className="par3-hero-shade" />
        <Par3MotionStripes tone="mixed" words={["PAR 3", "CHAMPIONSHIP"]} />
        <div className="par3-hero-inner">
          <div className="par3-hero-copy">
            <div className="par3-status-line">
              <span className={event.isLive ? "is-live" : ""} />
              {event.statusLabel}
            </div>
            <Image
              src="/par3/par3-logo.png"
              alt="CGS Par 3"
              width={300}
              height={300}
              className="par3-hero-logo"
              priority
            />
            <h1>
              <span>CGS Par 3</span>
              <strong>Championship</strong>
            </h1>
            <p className="par3-hero-offer">
              {event.maxPlayers} golfers. {event.poolCount} pools. Three-hole match
              play. One winner.
            </p>
            <div className="par3-hero-meta">
              <span><CalendarDays /> Saturday 12 September 2026</span>
              <span><Clock3 /> Warm-up 5:30pm / Tee-off 6:00pm</span>
              <span><MapPin /> The Tee Lounge, Underwood</span>
            </div>
            <div className="par3-hero-actions">
              {event.registrationsOpen ? (
                <a
                  href={event.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="par3-button par3-button-primary"
                >
                  Buy entry <ExternalLink />
                </a>
              ) : null}
              <a href="#live" className="par3-button par3-button-secondary">
                Follow tournament <ArrowRight />
              </a>
              <a
                href={event.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="par3-button par3-button-secondary"
              >
                Watch CGS <Play />
              </a>
            </div>
            <Par3Countdown startsAt={event.startsAt} />
          </div>
        </div>
      </section>

      <div className="par3-hype-ticker" aria-label="Par 3 Championship highlights">
        <div>
          <span>{event.maxPlayers} golfers</span>
          <i />
          <span>{event.poolCount} pools</span>
          <i />
          <span>Cash prizes</span>
          <i />
          <span>Live commentary</span>
          <i />
          <span>3-hole match play</span>
          <i />
          <span>One champion</span>
          <i />
          <span aria-hidden="true">{event.maxPlayers} golfers</span>
          <i aria-hidden="true" />
          <span aria-hidden="true">{event.poolCount} pools</span>
          <i aria-hidden="true" />
          <span aria-hidden="true">Cash prizes</span>
          <i aria-hidden="true" />
          <span aria-hidden="true">Live commentary</span>
          <i aria-hidden="true" />
          <span aria-hidden="true">3-hole match play</span>
          <i aria-hidden="true" />
          <span aria-hidden="true">One champion</span>
          <i aria-hidden="true" />
        </div>
      </div>

      <section className="par3-fact-strip" aria-label="Event summary">
        <div>
          <Users />
          <strong>{confirmedPlayers || event.maxPlayers}</strong>
          <span>{confirmedPlayers ? "Confirmed players" : "Player capacity"}</span>
        </div>
        <div>
          <Flag />
          <strong>{event.poolCount} pools</strong>
          <span>Four golfers in each</span>
        </div>
        <div>
          <Target />
          <strong>3 holes</strong>
          <span>Every match</span>
        </div>
        <div>
          <Trophy />
          <strong>1 winner</strong>
          <span>Single-elimination finish</span>
        </div>
      </section>

      <section id="live" className="par3-section par3-live-section">
        <Par3MotionStripes tone="cyan" words={["LIVE", "RESULTS"]} />
        <div className="par3-section-marker" aria-hidden="true">
          <span>01</span>
          <strong>Live centre</strong>
        </div>
        <div className="par3-section-heading">
          <div>
            <p className="par3-kicker"><Radio /> Tournament updates</p>
            <h2>Everything happening live</h2>
          </div>
          <p>
            Pool tables, current fixtures, and the finals bracket update here
            throughout the night.
          </p>
        </div>
        <Par3LiveTournament initialSnapshot={snapshot} />
      </section>

      <section id="watch" className="par3-watch-band">
        <Par3MotionStripes tone="gold" words={["ON AIR", "CGS"]} />
        <div className="par3-section-marker" aria-hidden="true">
          <span>02</span>
          <strong>Broadcast</strong>
        </div>
        <div className="par3-watch-inner">
          <div>
            <p className="par3-kicker"><Play /> Live coverage</p>
            <h2>Watch the Championship</h2>
            <p>
              Follow the full event with live commentary on the Crossodog Golf
              Society YouTube channel.
            </p>
            <a
              href={event.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="par3-button par3-button-primary"
            >
              Open YouTube <ExternalLink />
            </a>
          </div>
          <div className="par3-video-frame">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="CGS Par 3 Championship live stream"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="par3-video-placeholder">
                <Image
                  src="/par3/par3-logo.png"
                  alt="CGS Par 3"
                  width={240}
                  height={240}
                />
                <span>Live stream appears here on event night</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="format" className="par3-section par3-format-section">
        <Par3MotionStripes tone="mixed" words={["MATCH", "PLAY"]} />
        <div className="par3-section-marker" aria-hidden="true">
          <span>03</span>
          <strong>Format</strong>
        </div>
        <div className="par3-poster-wrap">
          <Image
            src="/par3/par3-championship-format.png"
            alt="How the CGS Par 3 Championship works"
            width={1122}
            height={1402}
            className="par3-poster"
          />
        </div>
        <div className="par3-format-copy">
          <p className="par3-kicker"><Flag /> Competition format</p>
          <h2>Simple format. Big competition.</h2>
          <div className="par3-format-steps">
            <div>
              <span>01</span>
              <h3>Pool play</h3>
              <p>
                Eight pools of four. Everyone plays everyone in their pool. A win
                is one point and a loss is zero.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Qualification</h3>
              <p>
                The top two from every pool advance. Tied players are split by their
                head-to-head result.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>Round of 16</h3>
              <p>
                Eight pool winners face eight runners-up in the opening knockout
                round.
              </p>
            </div>
            <div>
              <span>04</span>
              <h3>Finals</h3>
              <p>
                Every round is single elimination. If a match is tied, hole three
                becomes a closest-to-pin tiebreak.
              </p>
            </div>
          </div>
          <div className="par3-rule-line">
            <strong>No handicaps</strong>
            <span>Championship, ladies red, and junior front tees</span>
          </div>
        </div>
      </section>

      <section id="enter" className="par3-entry-band">
        <Par3MotionStripes tone="cyan" words={["12 SEP", "READY"]} />
        <div className="par3-section-marker" aria-hidden="true">
          <span>04</span>
          <strong>Enter</strong>
        </div>
        <div className="par3-entry-inner">
          <div className="par3-entry-copy">
            <p className="par3-kicker"><CircleDollarSign /> Limited field</p>
            <h2>Ready to play?</h2>
            <p>
              Entry is $30 with only {event.maxPlayers} places available. CGS members
              and guests can register with a name, phone number, tee category, and
              consent.
            </p>
            <div className="par3-entry-details">
              <span><CalendarDays /> Saturday 12 September</span>
              <span><MapPin /> {event.venueAddress}</span>
              <span><Clock3 /> Warm-up 5:30pm / Tee-off 6:00pm</span>
            </div>
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="par3-button par3-button-primary"
            >
              Buy through the CGS shop <ExternalLink />
            </a>
          </div>
          <Image
            src="/par3/par3-championship-details.png"
            alt="CGS Par 3 Championship entry information"
            width={1122}
            height={1402}
            className="par3-entry-poster"
          />
        </div>
      </section>

      <section id="cgs" className="par3-history-band">
        <div className="par3-history-inner">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society"
            width={150}
            height={150}
          />
          <div>
            <p className="par3-kicker">Crossodog Golf Society</p>
            <h2>Built for everyday golfers</h2>
            <p>
              CGS combines social golf, genuine competition, and creator-led live
              coverage. From the Season 1 team final through Season 2 Stableford and
              the return to Ambrose in Season 3, every event adds to a growing public
              record of the players and moments that shaped the society.
            </p>
            <div className="par3-history-links">
              <Link href="/about">Our story <ArrowRight /></Link>
              <Link href="/events/season-2">Past results <ArrowRight /></Link>
              <a
                href="https://www.youtube.com/@CrossodogGolfSociety"
                target="_blank"
                rel="noopener noreferrer"
              >
                CGS on YouTube <ExternalLink />
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
