import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flag,
  ImageDown,
  MapPin,
  Medal,
  Radio,
  ScanLine,
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
  getPar3PoolSizes,
  getPar3FinalsStages,
} from "@/lib/par3-showdown-types";
import {
  getPar3DisplayCourseStages,
  getPar3DisplayQualification,
  getPar3DisplayFinalistCount,
  getPar3QualificationDescription,
  getPar3StageHoleLabel,
  getPar3DisplayPoolSize,
  PAR3_COURSE_POSTER_URL,
  par3Ordinal,
} from "@/lib/par3-display";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Par 3 Championship II | 7 November 2026",
  description:
    "Enter the CGS Par 3 Championship II at The Tee Lounge. Follow the current pools, live draw, results and knockout finals.",
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
      "Pool play. Knockout finals. One winner. Saturday 7 November at The Tee Lounge.",
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
  const courseStages = getPar3DisplayCourseStages(snapshot);
  const finalsStages = getPar3FinalsStages(event);
  const byeTarget = finalsStages[1]?.label.toLowerCase() ?? "the next round";
  const finalsPath = finalsStages.slice(1).map((stage) => stage.label.toLowerCase()).join(" → ");
  const qualification = getPar3DisplayQualification(snapshot);
  const poolSizes = qualification.allPlayersAdvance
    ? Array.from({ length: event.poolCount }, (_, index) => getPar3DisplayPoolSize(snapshot, index + 1))
    : getPar3PoolSizes(event);
  const smallestPool = Math.min(...poolSizes);
  const largestPool = Math.max(...poolSizes);
  const matchesPerPlayer = smallestPool === largestPool
    ? `${smallestPool - 1}`
    : `${smallestPool - 1}–${largestPool - 1}`;
  const poolSizeLabel = smallestPool === largestPool ? `${smallestPool}` : `${smallestPool}–${largestPool}`;

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
              <div><Users /><span>Maximum<strong>{event.maxPlayers} players</strong></span></div>
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
            <span>Official course draw</span>
            <Image
              src={PAR3_COURSE_POSTER_URL}
              alt="CGS Par 3 course draw: Gailes, Royal Canberra, Royal Hobart, Augusta, Royal Adelaide, New South Wales, The Australian and National Old Course"
              width={1122}
              height={1402}
              priority
            />
          </div>
        </div>
        <div className="par3-v2-scroll-cue">
          <span>{remainingSpots === 0 ? "Field complete" : event.registrationsOpen ? `${remainingSpots} places available` : "Registrations closed"}</span>
          <i />
          <span>{event.poolCount} pools / {poolSizeLabel} players per pool</span>
          <i />
          <span>Live streamed</span>
          <i />
          <span>{qualification.ctpPurpose === "bye" ? "Pool winners contest the finals bye" : qualification.ctpQualifierCount ? "CTP qualification playoff" : "Automatic qualification"}</span>
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
              <li><CheckCircle2 /> {matchesPerPlayer} pool matches per player in a full pool</li>
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
            <h2>{event.poolCount} pools. One champion.</h2>
          </div>
          <p>
            {qualification.allPlayersAdvance ? `All ${qualification.requiredPlayerCount} players advance from pool play. The ${event.poolCount} pool winners contest CTP for one bye to the ${byeTarget}; everyone else plays the opening round.` : <>
            Every player faces each opponent in their pool once. {getPar3DisplayFinalistCount(snapshot)} players
            advance into the single-elimination finals. {getPar3QualificationDescription(snapshot)}
            </>}
          </p>
        </div>

        {qualification.allPlayersAdvance ? <div className="par3-v2-format-summary" aria-label="Tournament format at a glance">
          <div><strong>{qualification.requiredPlayerCount}</strong><span>Players advance</span></div>
          <div><strong>{event.poolCount} × {poolSizeLabel}</strong><span>Pools × players</span></div>
          <div><strong>{qualification.openingMatchCount}</strong><span>Opening matches</span></div>
          <div><strong>1</strong><span>CTP bye to {byeTarget}</span></div>
        </div> : null}

        <div className={`par3-v2-format-road${qualification.allPlayersAdvance ? " is-bye-format" : ""}`}>
          {qualification.allPlayersAdvance ? <>
          <article>
            <span>Pool phase</span><Users /><h3>{event.poolCount} pools of {poolSizeLabel}</h3><strong>{matchesPerPlayer} matches per player</strong>
            <p>{smallestPool === 3 && largestPool === 3 ? "Three pool rounds, with one player resting in each round. Every player faces both pool opponents." : "Every player faces each pool opponent once. Odd pools rotate the resting player each round."} All {qualification.requiredPlayerCount} advance.</p>
          </article>
          <article>
            <span>CTP playoff</span><Target /><h3>{event.poolCount} pool winners</h3><strong>Bye to {byeTarget}</strong>
            <p>Pool winners shoot closest to the pin. The winner advances straight to the {byeTarget}.</p>
          </article>
          <article>
            <span>Opening round</span><Flag /><h3>{qualification.requiredPlayerCount - 1} players compete</h3><strong>{qualification.openingMatchCount} head-to-head matches</strong>
            <p>The CTP winner rests while the other {qualification.requiredPlayerCount - 1} players compete for the remaining places in the {byeTarget}.</p>
          </article>
          <article className="is-final">
            <span>Finals</span><Trophy /><h3>{qualification.finalsSize / 2} players remain</h3><strong>One champion</strong>
            <p>The {qualification.openingMatchCount} opening-round winners join the CTP winner. {finalsPath}.</p>
          </article>
          </> : <>
          <article>
            <span>Stage 01</span>
            <Users />
            <h3>Pool play</h3>
            <strong>{event.poolCount} pools of {poolSizeLabel}</strong>
            <p>Every player faces each opponent in their pool once.</p>
          </article>
          <article>
            <span>Stage 02</span>
            <Trophy />
            <h3>{qualification.allPlayersAdvance ? "Everyone advances" : "Automatic spots"}</h3>
            <strong>{qualification.allPlayersAdvance ? `All ${qualification.requiredPlayerCount} advance` : qualification.automaticPlaces ? `Top ${qualification.automaticPlaces} advance` : "CTP decides places"}</strong>
            <p>{qualification.allPlayersAdvance ? "Pool play determines the seeding and the pool winners’ CTP field." : `${qualification.automaticPlaces * event.poolCount} automatic finals places across the pools.`}</p>
          </article>
          <article>
            <span>Stage 03</span>
            <Target />
            <h3>CTP playoff</h3>
            <strong>{qualification.ctpPurpose === "bye" ? "Winner earns a bye" : qualification.ctpQualifierCount ? `Top ${qualification.ctpQualifierCount} advance` : "Not required"}</strong>
            <p>{qualification.ctpPurpose === "bye" ? `Pool winners contest CTP. The winner advances straight to the ${getPar3FinalsStages(event)[1]?.label ?? "next round"}.` : qualification.ctpQualifierCount ? `${qualification.ctpAllRemaining ? "Remaining pool players" : `${par3Ordinal(qualification.ctpPoolPosition)}-place finishers`} compete for the remaining finals places.` : "The nominated format fills every finals place automatically."}</p>
          </article>
          <article>
            <span>Side contest</span>
            <Medal />
            <h3>CTP prize</h3>
            <strong>Eligible last places</strong>
            <p>{qualification.allPlayersAdvance ? "A separate closest-to-pin prize contest for last-place pool finishers." : "A separate closest-to-pin prize contest for last-place finishers outside automatic qualification."}</p>
          </article>
          <article className="is-final">
            <span>Stage 04</span>
            <Flag />
            <h3>Finals</h3>
            <strong>{getPar3DisplayFinalistCount(snapshot)} to 1</strong>
            <p>{qualification.ctpPurpose === "bye" ? `${qualification.openingMatchCount} opening matches, one CTP bye, then the ${getPar3FinalsStages(event)[1]?.label ?? "next round"}.` : `Win and advance from the ${getPar3FinalsStages(event)[0]?.label ?? "opening round"} to the title.`}</p>
          </article>
          </>}
        </div>

        {qualification.allPlayersAdvance ? <p className="par3-v2-side-contest"><Medal /><span><strong>Separate CTP prize:</strong> last-place pool finishers compete for the closest-to-pin prize.</span></p> : null}

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

      <section id="courses" className="par3-v2-course-section">
        <div className="par3-v2-course-copy">
          <span>04 / {courseStages.length} stages</span>
          <h2>A different test every round.</h2>
          <p>
            The confirmed courses and hole selections are below. Follow the fixtures
            and simulator calls in the live tournament centre.
          </p>
          <a href={PAR3_COURSE_POSTER_URL} download="CGS-Par3-Course-Draw.png" className="par3-v2-button is-secondary">Download course and hole poster <ImageDown /></a>
        </div>
        <div className="par3-v2-course-grid">
          {courseStages.map((stage, index) => (
            <article key={stage.key}>
              <b>{stage.stageNumber ? `R${stage.stageNumber}` : String(index + 1).padStart(2, "0")}</b>
              <span>{stage.label}</span>
              <strong>{stage.course}</strong>
              <small className="par3-course-holes">{getPar3StageHoleLabel(stage)}</small>
            </article>
          ))}
        </div>
      </section>

      <section id="scorecard-tool" className="par3-v2-scorecard-section">
        <div className="par3-v2-scorecard-copy">
          <span>Free club tool</span>
          <h2>Turn the card into the post.</h2>
          <p>
            Upload a photo of a completed golf scorecard or enter it manually,
            check the result, and download a polished CGS Instagram graphic.
          </p>
          <Link href="/scorecard" className="par3-v2-button is-primary">
            Open scorecard studio <ArrowRight />
          </Link>
        </div>

        <div className="par3-v2-scorecard-demo" aria-label="How the scorecard studio works">
          <div className="par3-v2-scorecard-steps">
            <article>
              <Camera />
              <b>01</b>
              <strong>Photograph</strong>
              <span>Take a clear photo of the full card.</span>
            </article>
            <article>
              <ScanLine />
              <b>02</b>
              <strong>Review</strong>
              <span>Scores, pars, and distances fill automatically.</span>
            </article>
            <article>
              <ImageDown />
              <b>03</b>
              <strong>Download</strong>
              <span>Export a 1080 x 1350 Instagram post.</span>
            </article>
          </div>
          <div className="par3-v2-scorecard-strip">
            <span>Any course</span>
            <i />
            <span>Any round length</span>
            <i />
            <span>Gross + nett</span>
          </div>
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
