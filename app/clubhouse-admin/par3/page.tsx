import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  ExternalLink,
  ClipboardList,
  MonitorPlay,
  Printer,
  Radio,
  Trophy,
  Users,
} from "lucide-react";

import {
  createPar3PlayerAction,
  generatePar3KnockoutAction,
  generatePar3PoolFixturesAction,
  recordPar3KnockoutWinnerAction,
  resetPar3KnockoutMatchAction,
  startPar3KnockoutMatchAction,
  updatePar3EventAction,
  updatePar3CtpDistanceAction,
  updatePar3CtpWinnerAction,
  updatePar3TournamentFormatAction,
  allocatePar3PoolsAction,
  updatePar3PlayerAction,
  updatePar3PoolMatchAction,
} from "@/app/clubhouse-admin/par3/actions";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import Par3FormatControl from "@/components/admin/Par3FormatControl";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { getAdminPar3Snapshot } from "@/lib/par3-showdown";
import { getPar3DisplayQualification, getPar3PrizeCtpContestants, getPar3StageHoleLabel, getPar3DisplayCourseStages, PAR3_COURSE_POSTER_URL } from "@/lib/par3-display";
import {
  PAR3_MATCH_COMPLETED,
  PAR3_MATCH_RUNNING,
  buildPar3Pools,
  getPar3CtpContestants,
  getPar3CtpQualifiers,
  getPar3QualificationPlan,
  getPar3FinalsStages,
  getPar3CtpStage,
  getPar3PoolSizes,
  getPar3FinalsSize,
  isPar3PoolComplete,
  isPar3KnockoutBye,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3KnockoutRounds,
  getPar3RoundOf16Template,
  getPar3SimulatorQueues,
  getPar3RemainingSpots,
  getPoolStage,
  getTeeCategoryLabel,
  resolvePar3BracketSlot,
  type AdminPar3Player,
  type Par3PoolMatch,
} from "@/lib/par3-showdown-types";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Par 3 Tournament Control",
    description: "Private control room for the 2026 CGS Par 3 Championship.",
    path: "/clubhouse-admin/par3",
  }),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string; detail?: string }>;
};

const noticeMessages: Record<string, string> = {
  "settings-saved": "Public event status updated.",
  "settings-failed": "Event settings could not be saved.",
  "player-check": "Enter a name and phone number, and confirm consent.",
  "player-added": "Entrant added.",
  "player-saved": "Entrant details updated.",
  "player-failed": "Entrant details could not be saved.",
  "fixtures-created": "Pool fixtures generated.",
  "fixtures-failed":
    "Fixtures could not be generated. Check pool allocations, or existing results.",
  "result-saved": "Pool result updated.",
  "result-failed": "Pool result could not be saved.",
  "pool-format-saved": "Tournament pool format updated.",
  "pool-format-failed": "Pool format could not be changed. Check the current players, results, and finals status.",
  "pool-allocation-saved": "Players allocated to pools. Check the assignments, then generate the fixtures.",
  "pool-allocation-failed": "Players could not be allocated. Check capacity, saved format and existing matches.",
  "ctp-saved": "CTP selection confirmed for the finals.",
  "ctp-reset": "CTP selection cleared.",
  "ctp-failed": "CTP winner could not be updated. Confirm the pool tables first.",
  "ctp-distance-saved": "CTP distance saved.",
  "ctp-distance-failed": "CTP distance could not be saved.",
  "knockout-created": "Finals draw created from the confirmed qualifiers.",
  "knockout-failed":
    "Finals could not be created. Complete every pool and confirm all required CTP qualifiers.",
  "final-result-saved": "Finals result updated.",
  "final-result-failed": "Finals result could not be saved.",
  "final-live": "Finals match is now featured on the live centre.",
  "final-live-failed": "That finals match could not be marked live.",
  "final-reset": "Finals result reset.",
  "final-reset-failed":
    "That result cannot be reset after a later match has been completed.",
};

function TeeOptions() {
  return (
    <>
      <option value="championship">
        Championship tees
      </option>
      <option value="ladies">
        Ladies - red tees
      </option>
      <option value="junior">
        Junior - front tees
      </option>
    </>
  );
}

function PoolOptions({ poolCount }: { poolCount: number }) {
  return (
    <>
      <option value="">Not allocated</option>
      {Array.from({ length: poolCount }, (_, index) => index + 1).map((number) => (
        <option key={number} value={number}>
          Pool {String.fromCharCode(64 + number)}
        </option>
      ))}
    </>
  );
}

function PlayerEditor({
  player,
  eventId,
  poolCount,
  poolSizes,
}: {
  player: AdminPar3Player;
  eventId: number;
  poolCount: number;
  poolSizes: number[];
}) {
  return (
    <details
      id={`player-${player.id}`}
      className="simple-details border-t border-white/10 py-4 first:border-t-0"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <strong className="text-white">{player.name}</strong>
          <span className="ml-3 text-sm text-zinc-400">
            {player.poolNumber
              ? `Pool ${String.fromCharCode(64 + player.poolNumber)}`
              : "Unallocated"}
          </span>
        </span>
        <span className="text-xs text-zinc-500">
          {getTeeCategoryLabel(player.teeCategory)}
        </span>
      </summary>

      <form
        action={updatePar3PlayerAction}
        className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="player_id" value={player.id} />
        <div>
          <label className="field-label" htmlFor={`name-${player.id}`}>
            Player name
          </label>
          <input
            id={`name-${player.id}`}
            name="name"
            className="field-control"
            defaultValue={player.name}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`phone-${player.id}`}>
            Phone
          </label>
          <input
            id={`phone-${player.id}`}
            name="phone"
            className="field-control"
            defaultValue={player.phone}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`tee-${player.id}`}>
            Tee category
          </label>
          <select
            id={`tee-${player.id}`}
            name="tee_category"
            className="field-control"
            defaultValue={player.teeCategory}
          >
            <TeeOptions />
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`pool-${player.id}`}>
            Pool
          </label>
          <select
            id={`pool-${player.id}`}
            name="pool_number"
            className="field-control"
            defaultValue={player.poolNumber ?? ""}
          >
            <PoolOptions poolCount={poolCount} />
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`order-${player.id}`}>
            Display order
          </label>
          <input
            id={`order-${player.id}`}
            name="display_order"
            type="number"
            min="1"
            max="99"
            className="field-control"
            defaultValue={player.displayOrder}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`rank-${player.id}`}>
            Manual pool seed
          </label>
          <select
            id={`rank-${player.id}`}
            name="pool_rank_override"
            className="field-control"
            defaultValue={player.poolRankOverride ?? ""}
          >
            <option value="">Use results</option>
            {Array.from({ length: player.poolNumber ? poolSizes[player.poolNumber - 1] ?? 3 : Math.max(...poolSizes) }, (_, index) => index + 1).map((rank) => (
              <option key={rank} value={rank}>
                Seed {rank}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm text-zinc-200">
          <input type="checkbox" name="consent" defaultChecked={player.consent} />
          Consent confirmed
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="is_withdrawn"
            defaultChecked={player.isWithdrawn}
          />
          Withdrawn
        </label>
        <button type="submit" className="btn-primary md:col-span-2 xl:col-span-4">
          Save player
        </button>
      </form>
    </details>
  );
}

function PoolMatchControl({
  match,
  playersById,
  poolPlayerCount,
}: {
  match: Par3PoolMatch;
  playersById: Map<number, AdminPar3Player>;
  poolPlayerCount: number;
}) {
  const first = playersById.get(match.player1Id);
  const second = playersById.get(match.player2Id);
  const winner = match.winnerId ? playersById.get(match.winnerId) : null;
  const stage = getPoolStage(match.matchNumber, poolPlayerCount);

  if (!first || !second) {
    return null;
  }

  return (
    <div id={`match-${match.id}`} className="border-t border-white/10 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{stage?.label ?? `Match ${match.matchNumber}`} / Match {match.matchNumber}</span>
        <span className={`par3-admin-match-status is-${match.status}`}>
          {match.bayNumber ? `Simulator ${match.bayNumber}` : "Simulator not set"} / {match.status}
        </span>
      </div>
      {stage ? <p className="mt-2 text-sm text-zinc-400">{stage.course} / {getPar3StageHoleLabel(stage)}</p> : null}

      {winner ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-white">
            <Check className="mr-2 inline size-4 text-emerald-300" />
            {winner.name} won
          </p>
          <form action={updatePar3PoolMatchAction}>
            <input type="hidden" name="match_id" value={match.id} />
            <input type="hidden" name="bay_number" value={match.bayNumber ?? ""} />
            <input type="hidden" name="match_status" value="scheduled" />
            <button type="submit" className="btn-secondary">
              Undo
            </button>
          </form>
        </div>
      ) : (
        <form action={updatePar3PoolMatchAction} className="mt-3">
          <label className="sr-only" htmlFor={`bay-${match.id}`}>
            Simulator
          </label>
          <select
            id={`bay-${match.id}`}
            name="bay_number"
            className="field-control mb-2"
            defaultValue={match.bayNumber ?? ""}
          >
            <option value="">Simulator not set</option>
            <option value="1">Simulator 1</option>
            <option value="2">Simulator 2</option>
            <option value="3">Simulator 3</option>
          </select>
          <input type="hidden" name="match_id" value={match.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              name="winner_id"
              value={first.id}
              className="min-h-14 border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
            >
              {first.name}
            </button>
            <button
              type="submit"
              name="winner_id"
              value={second.id}
              className="min-h-14 border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
            >
              {second.name}
            </button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              name="match_status"
              value="scheduled"
              className="btn-secondary"
            >
              Add to queue
            </button>
            <button
              type="submit"
              name="match_status"
              value="live"
              className="btn-primary"
            >
              Start on simulator
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AdminSimulatorCall({
  label,
  match,
  playersById,
}: {
  label: string;
  match: Par3PoolMatch | null;
  playersById: Map<number, AdminPar3Player>;
}) {
  const stage = match ? getPoolStage(match.matchNumber, [...playersById.values()].filter((player) => !player.isWithdrawn && player.poolNumber === match.poolNumber).length) : null;

  return (
    <div className="par3-admin-simulator-call">
      <span>{label}</span>
      {match ? (
        <>
          <strong>
            {playersById.get(match.player1Id)?.name ?? "TBD"}
            <i>vs</i>
            {playersById.get(match.player2Id)?.name ?? "TBD"}
          </strong>
          <p>
            Pool {String.fromCharCode(64 + match.poolNumber)} / {stage?.shortCourse} / {getPar3StageHoleLabel(stage)}
          </p>
        </>
      ) : (
        <strong className="is-empty">Awaiting allocation</strong>
      )}
    </div>
  );
}

export default async function Par3AdminPage({ searchParams }: PageProps) {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const authenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Par 3 control is not ready"
        description="Configure the CGS admin session before using this route."
      />
    );
  }

  if (!authenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Par 3 tournament control"
        description="Sign in to manage entrants, pool results, and the finals bracket."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const { notice, detail } = await searchParams;
  let snapshot;

  try {
    snapshot = await getAdminPar3Snapshot();
  } catch (error) {
    console.error("Load Par 3 admin error:", error);
    return (
      <AdminShell
        eyebrow="Event control"
        title="Par 3 Championship"
        description="Tournament data could not be loaded. Check the connection and database setup, then reload this page."
      >
        <div className="panel p-6 text-zinc-300">
          <p>You can still explore different pool and finals sizes in the format calculator.</p>
          <Link href="/clubhouse-admin/par3/format-preview" className="btn-secondary mt-4">Open format calculator</Link>
        </div>
      </AdminShell>
    );
  }

  const { event, players, poolMatches } = snapshot;
  const pools = buildPar3Pools(snapshot);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const activePlayers = players.filter((player) => !player.isWithdrawn);
  const remainingSpots = getPar3RemainingSpots(snapshot);
  const simulatorQueues = getPar3SimulatorQueues(snapshot);
  const completedPoolMatches = poolMatches.filter(
    (match) => match.winnerId !== null
  ).length;
  const ctpContestants = getPar3CtpContestants(snapshot);
  const ctpPrizeContestants = getPar3PrizeCtpContestants(snapshot);
  const ctpQualifiers = getPar3CtpQualifiers(snapshot);
  const hasCtpSelection = players.some((player) => player.ctpRank !== null);
  const actualQualification = getPar3QualificationPlan(snapshot);
  const qualification = getPar3DisplayQualification(snapshot);
  const ctpBye = qualification.ctpPurpose === "bye";
  const ctpQualifierCount = qualification.ctpQualifierCount;
  const roundOf16Template = getPar3RoundOf16Template(actualQualification.errors.length ? event : snapshot);
  const firstFinalsLabel = getPar3FinalsStages(event)[0]?.label ?? "Finals";
  const poolStandingsLocked = actualQualification.errors.length === 0 && pools.every(isPar3PoolComplete);
  const finalsReady =
    poolStandingsLocked &&
    ctpQualifiers.length === ctpQualifierCount &&
    ctpQualifiers.every((player, index) => player.ctpRank === index + 1);
  const knockoutRounds = getPar3KnockoutRounds(event.knockoutData, event);
  const ctpStage = getPar3CtpStage();
  const courseStages = getPar3DisplayCourseStages(snapshot);
  const champion = getPar3Champion(event.knockoutData);

  return (
    <AdminShell
      eyebrow="Event control"
      title="Par 3 Championship II"
      description="Run registrations, simulator calls, pool results, CTP records, print sheets, and the finals from one event-night desk."
      actions={
        <>
          <Link href="/clubhouse-admin/par3/format-preview" className="btn-secondary">Format calculator</Link>
          <Link href="/" target="_blank" className="btn-secondary">
            Public hub <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <Link
            href="/stream/par3-showdown?view=banner"
            target="_blank"
            className="btn-secondary"
          >
            OBS banner <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <Link
            href="/stream/par3-showdown?view=tv"
            target="_blank"
            className="btn-secondary"
          >
            TV rotation <ExternalLink className="ml-2 inline size-4" />
          </Link>
          <Link
            href="/clubhouse-admin/par3/print?sheet=pack"
            target="_blank"
            className="btn-secondary"
          >
            Print pack <Printer className="ml-2 inline size-4" />
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {notice && noticeMessages[notice] ? (
        <div className="mb-6 border border-cyan-300/25 bg-cyan-300/8 px-5 py-4 text-sm text-cyan-50">
          {noticeMessages[notice]}
          {detail ? <span className="mt-2 block text-sm">{detail.slice(0, 240)}</span> : null}
        </div>
      ) : null}

      <nav className="mb-8 grid gap-2 sm:grid-cols-5">
        {[
          ["simulator-desk", "Live desk"],
          ["entrants", "1. Entrants"],
          ["pool-play", "2. Pool play"],
          ["ctp-playoff", "3. CTP playoff"],
          ["finals", "4. Finals"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={`#${href}`}
            className="flex min-h-12 items-center justify-between border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:border-cyan-300/50"
          >
            {label}
            <ChevronRight className="size-4 text-cyan-300" />
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[
          ["Entrants", `${activePlayers.length} / ${event.maxPlayers}`, Users],
          ["Spots left", remainingSpots ? String(remainingSpots) : "Sold out", Users],
          ["Pool results", `${completedPoolMatches} / ${poolMatches.length}`, Check],
          ["Phase", event.currentPhase, Radio],
          ["Champion", champion ?? "TBD", Trophy],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="border border-white/10 bg-white/4 p-5">
            <Icon className="size-5 text-cyan-300" />
            <p className="mt-5 text-xs font-semibold uppercase text-zinc-500">
              {String(label)}
            </p>
            <p className="mt-1 text-xl font-bold capitalize text-white">
              {String(value)}
            </p>
          </div>
        ))}
      </section>

      <section id="simulator-desk" className="scroll-mt-24 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Event-night desk</p>
            <h2 className="mt-3 text-3xl">Now playing and up next</h2>
          </div>
          <Link
            href="/stream/par3-showdown?view=up-next"
            target="_blank"
            className="btn-secondary"
          >
            Open public display <ExternalLink className="ml-2 inline size-4" />
          </Link>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          Queue fixtures from Pool Play below. Starting a fixture promotes it to
          NOW on the public site and stream while the next queued fixture stays
          clearly visible for players.
        </p>
        <div className="par3-admin-simulator-grid mt-6">
          {simulatorQueues.map((queue) => (
            <article key={queue.simulatorNumber}>
              <header>
                <span>Simulator</span>
                <strong>{queue.simulatorNumber}</strong>
              </header>
              <AdminSimulatorCall
                label="Now playing"
                match={queue.current}
                playersById={playersById}
              />
              <AdminSimulatorCall
                label="Up next"
                match={queue.upNext}
                playersById={playersById}
              />
              <footer>{queue.queued.length} queued fixture{queue.queued.length === 1 ? "" : "s"}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Print centre</p>
            <h2 className="mt-3 text-2xl">Event operations pack</h2>
          </div>
          <Link
            href="/clubhouse-admin/par3/print?sheet=pack"
            target="_blank"
            className="btn-primary"
          >
            Print everything <Printer className="ml-2 inline size-4" />
          </Link>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          Open any live sheet on its own or print the complete organiser pack.
          Pages use the latest draw, simulator allocations, standings, and finals data.
        </p>
        <div className="par3-admin-print-grid mt-5">
          {[
            ["pools", "Pool sheets"],
            ["standings", "Live standings"],
            ["schedule", "Match schedule"],
            ["simulators", "Simulator allocation"],
            ["courses", "Course allocation"],
            ["ctp", "CTP records"],
            ["round-of-16", firstFinalsLabel],
            ["finals", "Finals bracket"],
            ["reporting", "Reporting process"],
            ["scorecards", "Player match scorecards"],
          ].map(([sheet, label]) => (
            <Link
              key={sheet}
              href={`/clubhouse-admin/par3/print?sheet=${sheet}`}
              target="_blank"
            >
              <ClipboardList />
              <strong>{label}</strong>
              <Printer />
            </Link>
          ))}
        </div>
      </section>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Broadcast package</p>
            <h2 className="mt-3 text-2xl">OBS and TV assets</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Add any URL below as an OBS browser source. Every view reads the same live tournament data.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["thumbnail", "Livestream thumbnail", "1280 x 720"],
            ["starting", "Starting soon", "1920 x 1080"],
            ["banner", "Lower-third banner", "1920 x 180"],
            ["portrait", "Sidebar rotation", "407 x 1359"],
            ["pools", "Pool graphics", "1920 x 1080"],
            ["up-next", "Simulator up next", "1920 x 1080"],
            ["fixtures", "Fixture draw", "1920 x 1080"],
            ["results", "Latest results", "1920 x 1080"],
            ["standings", "Pool tables", "1920 x 1080"],
            ["bracket", "Finals bracket", "1920 x 1080"],
            ["finals", "Finals live centre", "1920 x 1080"],
            ["sponsors", "Sponsor slide", "1920 x 1080"],
            ["winner", "Winner screen", "1920 x 1080"],
            ["road", "Course schedule", "1920 x 1080"],
            ["tv", "Automatic TV rotation", "1920 x 1080"],
          ].map(([view, label, size]) => (
            <Link
              key={view}
              href={`/stream/par3-showdown?view=${view}`}
              target="_blank"
              className="flex min-h-20 items-center justify-between gap-3 border border-white/10 bg-white/5 p-4 hover:border-cyan-300/55 hover:bg-cyan-300/8"
            >
              <span>
                <strong className="block text-sm text-white">{label}</strong>
                <small className="mt-1 block text-xs uppercase tracking-wider text-zinc-500">{size}</small>
              </span>
              <MonitorPlay className="size-5 text-cyan-300" />
            </Link>
          ))}
        </div>
      </section>

      <details className="simple-details panel mt-8 p-6">
        <summary>Public event status</summary>
        <form action={updatePar3EventAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="event_id" value={event.id} />
          <div>
            <label className="field-label" htmlFor="status-label">
              Public status
            </label>
            <input
              id="status-label"
              name="status_label"
              className="field-control"
              defaultValue={event.statusLabel}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="current-phase">
              Current phase
            </label>
            <select
              id="current-phase"
              name="current_phase"
              className="field-control"
              defaultValue={event.currentPhase}
            >
              <option value="registrations">Registrations</option>
              <option value="pools">Pool play</option>
              <option value="ctp">CTP playoff</option>
              <option value="knockout">Finals</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="public-message">
              Public message
            </label>
            <input
              id="public-message"
              name="public_message"
              className="field-control"
              defaultValue={event.publicMessage}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="youtube-url">
              YouTube channel or live video URL
            </label>
            <input
              id="youtube-url"
              name="youtube_url"
              type="url"
              className="field-control"
              defaultValue={event.youtubeUrl}
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              name="registrations_open"
              defaultChecked={event.registrationsOpen}
            />
            Registrations open
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" name="is_live" defaultChecked={event.isLive} />
            Show event as live
          </label>
          <button type="submit" className="btn-primary md:col-span-2">
            Update public hub
          </button>
        </form>
      </details>

      <section id="entrants" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-3 text-3xl">Entrants and pools</h2>
          </div>
          <p className="text-sm text-zinc-400">
            Phone numbers stay private in admin.
          </p>
        </div>

        <Par3FormatControl
          eventId={event.id}
          initialPoolSizes={getPar3PoolSizes(event)}
          initialFinalsSize={getPar3FinalsSize(event)}
          initialFinalsFormat={event.finalsFormat ?? "standard"}
          assignedCounts={Array.from({ length: event.poolCount }, (_, index) => activePlayers.filter((player) => player.poolNumber === index + 1).length)}
          activePlayerCount={activePlayers.length}
          locked={Boolean(event.knockoutData) || poolMatches.some((match) => match.winnerId !== null || match.status !== "scheduled")}
          lockReason={event.knockoutData ? "The format is locked because finals have been generated." : "The format is locked because pool play has started. Recorded and live matches are protected."}
          finalsFormatLocked={Boolean(event.knockoutData) || hasCtpSelection}
          allocationLocked={Boolean(event.knockoutData) || poolMatches.some((match) => match.winnerId !== null || match.status === "live")}
          saveAction={updatePar3TournamentFormatAction}
          allocateAction={allocatePar3PoolsAction}
        />

        <details className="panel mt-6 p-6">
          <summary className="cursor-pointer font-semibold">Course schedule / {courseStages.length} stages</summary>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {courseStages.map((stage, index) => (
              <div key={stage.key} className="rounded-lg border border-black/10 p-4">
                <p className="text-xs font-bold" style={{ color: "#0b6675" }}>R{stage.stageNumber ?? index + 1} / {stage.label}</p>
                <p className="mt-2 font-semibold">{stage.course}</p>
                <p className="mt-1 text-sm text-zinc-400">{getPar3StageHoleLabel(stage)}</p>
              </div>
            ))}
          </div>
          <Link href={PAR3_COURSE_POSTER_URL} target="_blank" className="btn-secondary mt-4">View course draw poster <ExternalLink className="ml-2 inline size-4" /></Link>
        </details>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <form action={createPar3PlayerAction} className="panel grid content-start gap-4 p-6">
            <input type="hidden" name="event_id" value={event.id} />
            <input
              type="hidden"
              name="display_order"
              value={activePlayers.length + 1}
            />
            <h3 className="text-xl">Add entrant</h3>
            <div>
              <label className="field-label" htmlFor="new-player-name">
                Name
              </label>
              <input
                id="new-player-name"
                name="name"
                className="field-control"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-phone">
                Phone
              </label>
              <input
                id="new-player-phone"
                name="phone"
                type="tel"
                className="field-control"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-tee">
                Tee category
              </label>
              <select
                id="new-player-tee"
                name="tee_category"
                className="field-control"
                defaultValue="championship"
              >
                <TeeOptions />
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="new-player-pool">
                Pool
              </label>
              <select
                id="new-player-pool"
                name="pool_number"
                className="field-control"
                defaultValue=""
              >
                <PoolOptions poolCount={event.poolCount} />
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input type="checkbox" name="consent" required />
              Registration consent confirmed
            </label>
            <button type="submit" className="btn-primary">
              Add entrant
            </button>
          </form>

          <div className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl">Player list</h3>
              <span className="text-sm text-zinc-400">Tap a name to edit</span>
            </div>
            <div className="mt-4">
              {players.length ? (
                players.map((player) => (
                  <PlayerEditor
                    key={player.id}
                    player={player}
                    eventId={event.id}
                    poolCount={event.poolCount}
                    poolSizes={getPar3PoolSizes(event)}
                  />
                ))
              ) : (
                <p className="border border-dashed border-white/15 p-5 text-sm text-zinc-400">
                  No entrants yet. Add paid registrations here as they arrive.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="pool-play" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 className="mt-3 text-3xl">Pool play</h2>
          </div>
          <form action={generatePar3PoolFixturesAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <button type="submit" className="btn-primary">
              {poolMatches.length ? "Sync fixtures" : "Generate fixtures"}
            </button>
          </form>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          Assign at least two players to each pool, within its saved capacity. Fixture sync calculates a round-robin draw from the actual players, including byes for odd-sized pools. Recorded results and live matches are protected. Tap a winner once a match is complete; standings and head-to-head tie-breaks update automatically.
        </p>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {pools.map((pool) => (
            <details
              key={pool.number}
              className="simple-details panel p-6"
              open={pool.matches.some((match) => match.status === "live")}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <span className="text-xl font-bold text-white">{pool.label}</span>
                <span className="text-sm text-zinc-400">
                  {pool.players.length} players / {pool.matches.length} matches
                </span>
              </summary>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="pb-3">Seed</th>
                      <th className="pb-3">Player</th>
                      <th className="pb-3 text-center">P</th>
                      <th className="pb-3 text-center">W</th>
                      <th className="pb-3 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.standings.map((standing) => (
                      <tr key={standing.player.id} className="border-t border-white/10">
                        <td className="py-3 font-bold text-cyan-300">
                          {standing.position}
                        </td>
                        <td className="py-3 font-semibold text-white">
                          {standing.player.name}
                          {standing.tieBreakLabel ? (
                            <span className="ml-2 text-xs font-normal text-zinc-500">
                              {standing.tieBreakLabel}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 text-center text-zinc-300">
                          {standing.played}
                        </td>
                        <td className="py-3 text-center text-zinc-300">
                          {standing.wins}
                        </td>
                        <td className="py-3 text-center font-bold text-white">
                          {standing.wins}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 border-t border-white/10 pt-2">
                {pool.matches.length ? (
                  pool.matches.map((match) => (
                    <PoolMatchControl
                      key={match.id}
                      match={match}
                      playersById={playersById}
                      poolPlayerCount={pool.players.length}
                    />
                  ))
                ) : (
                  <p className="py-4 text-sm text-zinc-400">
                    Fixtures have not been generated.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="ctp-playoff" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2 className="mt-3 text-3xl">Closest-to-pin playoff</h2>
          </div>
          <span className="border border-amber-300/25 bg-amber-300/8 px-4 py-2 text-sm font-semibold text-amber-200">
            {ctpStage.course} / {getPar3StageHoleLabel(ctpStage)}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          {ctpBye
            ? `All ${event.poolCount} pool winners contest CTP. The winner advances straight to ${getPar3FinalsStages(event)[1]?.label.toLowerCase() ?? "the next round"}. All ${qualification.requiredPlayerCount} entrants reach the finals; the other ${qualification.requiredPlayerCount - 1} play ${qualification.openingMatchCount} opening matches.`
            : ctpQualifierCount === 0
            ? "This format fills the finals from automatic pool qualifiers. No bracket CTP playoff is needed."
            : `${qualification.automaticPlaces} players from each pool qualify automatically. ${qualification.ctpAllRemaining ? "All remaining players" : `Players in pool position ${qualification.ctpPoolPosition}`} enter the bracket CTP playoff for ${ctpQualifierCount} remaining finals place${ctpQualifierCount === 1 ? "" : "s"}.`}
        </p>
        {ctpBye && !poolStandingsLocked ? <p className="mt-2 text-sm" style={{ color: "#704b00" }}>CTP names below are provisional until every pool table is confirmed.</p> : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {[
            {
              title: ctpBye ? "Pool winners CTP" : "Bracket CTP",
              detail: ctpBye ? "One bye / all pool winners" : ctpQualifierCount ? `${ctpQualifierCount} finals places / nominated eligible players` : "No bracket CTP places required",
              contestants: ctpContestants,
            },
            {
              title: "Prize CTP",
              detail: "Last-place non-automatic qualifiers / closest shot wins",
              contestants: ctpPrizeContestants,
            },
          ].map((contest) => (
            <div key={contest.title} className="panel p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Distance records</p>
                  <h3 className="mt-2 text-xl">{contest.title}</h3>
                </div>
                <span className="text-xs text-zinc-500">{contest.detail}</span>
              </div>
              <div className="mt-4">
                {contest.contestants.length ? contest.contestants.map((standing) => (
                  <form
                    key={standing.player.id}
                    action={updatePar3CtpDistanceAction}
                    className="par3-admin-ctp-distance"
                  >
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="player_id" value={standing.player.id} />
                    <span>Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}</span>
                    <strong>{standing.player.name}</strong>
                    <label>
                      <span className="sr-only">Distance in centimetres</span>
                      <input
                        name="distance_cm"
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        className="field-control"
                        defaultValue={standing.player.ctpDistanceCm ?? ""}
                        placeholder="cm"
                      />
                    </label>
                    <button type="submit" className="btn-secondary">Save</button>
                  </form>
                )) : (
                  <p className="border border-dashed border-white/15 p-4 text-sm text-zinc-500">
                    Contestants appear after pool standings are confirmed.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="panel mt-6 p-6">
          {ctpQualifierCount === 0 ? (
            <p className="text-sm text-zinc-300">No bracket CTP selection is required for this format.</p>
          ) : poolStandingsLocked && ctpContestants.length >= ctpQualifierCount ? (
              <form action={updatePar3CtpWinnerAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: ctpQualifierCount }, (_, index) => {
                    const rank = index + 1;
                    const selected = ctpQualifiers.find(
                      (player) => player.ctpRank === rank
                    );

                    return (
                      <div key={rank} className="border border-white/10 bg-white/5 p-4">
                        <label className="field-label" htmlFor={`ctp-qualifier-${rank}`}>
                          {ctpBye ? "CTP winner — opening-round bye" : `CTP place ${rank}`}
                        </label>
                        <select
                          id={`ctp-qualifier-${rank}`}
                          name={`qualifier_${rank}`}
                          className="field-control"
                          defaultValue={selected?.id ?? ""}
                        >
                          <option value="">Not confirmed</option>
                          {ctpContestants.map((standing) => (
                            <option key={standing.player.id} value={standing.player.id}>
                              Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))} / {standing.player.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                  <p className="text-sm text-zinc-400">
                    {ctpBye ? "Confirm the winning pool winner before generating the draw. The other entrants stay in the opening round." : `All ${ctpQualifierCount} qualifying places must be assigned to different eligible players before generating finals.`}
                  </p>
                  <button type="submit" className="btn-primary" disabled={Boolean(event.knockoutData)}>{ctpBye ? "Confirm CTP bye winner" : "Save CTP qualifiers"}</button>
                </div>
              </form>
          ) : (
            <p className="border border-dashed border-white/15 p-5 text-sm text-zinc-400">
              Complete or uniquely seed all {event.poolCount} pool tables and confirm the eligible CTP field. {actualQualification.errors.join(" ")}
            </p>
          )}

          {hasCtpSelection ? (
            <form action={updatePar3CtpWinnerAction} className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <input type="hidden" name="event_id" value={event.id} />
              <p className="text-sm text-zinc-300">
                {ctpQualifiers.length ? <>Confirmed: <strong className="text-amber-300">{ctpQualifiers.map((player) => `${player.ctpRank}. ${player.name}`).join(" / ")}</strong></> : "An earlier CTP selection no longer matches the current eligible field. Clear it before changing the format or confirming a new selection."}
              </p>
              <button type="submit" className="btn-secondary" disabled={Boolean(event.knockoutData)}>{ctpBye ? "Clear CTP bye winner" : "Clear CTP places"}</button>
            </form>
          ) : null}
        </div>
      </section>

      <section id="finals" className="scroll-mt-24 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Step 4</p>
            <h2 className="mt-3 text-3xl">Finals bracket</h2>
          </div>
          {!event.knockoutData ? (
            <form action={generatePar3KnockoutAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" className="btn-primary" disabled={!finalsReady}>
                {ctpBye ? `Generate ${qualification.openingMatchCount} matches + CTP bye` : `Generate ${firstFinalsLabel}`}
              </button>
            </form>
          ) : null}
        </div>

        {champion ? (
          <div className="mt-6 border border-amber-300/30 bg-amber-300/8 p-6">
            <p className="text-xs font-bold uppercase text-amber-300">Champion</p>
            <p className="mt-2 text-3xl font-bold text-white">{champion}</p>
          </div>
        ) : null}

        {knockoutRounds.length ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {knockoutRounds.map((round) => (
              <div key={String(round.id)} className="panel p-6">
                <h3 className="text-xl">{round.label}</h3>
                <p className="mt-2 text-sm text-zinc-400">{getPar3FinalsStages(event)[round.number - 1]?.course} / {getPar3StageHoleLabel(getPar3FinalsStages(event)[round.number - 1])}</p>
                <div className="mt-4">
                  {round.matches.map((match) => {
                    const firstName = getKnockoutParticipantName(
                      event.knockoutData!,
                      match.opponent1?.id
                    );
                    const secondName = getKnockoutParticipantName(
                      event.knockoutData!,
                      match.opponent2?.id
                    );
                    const completed = match.status === PAR3_MATCH_COMPLETED;
                    const isBye = isPar3KnockoutBye(match);
                    const isLive = match.status === PAR3_MATCH_RUNNING;
                    const winnerName =
                      match.opponent1?.result === "win"
                        ? firstName
                        : match.opponent2?.result === "win"
                          ? secondName
                          : null;
                    const actionable =
                      !completed &&
                      match.opponent1?.id !== null &&
                      match.opponent1?.id !== undefined &&
                      match.opponent2?.id !== null &&
                      match.opponent2?.id !== undefined;

                    return (
                      <div
                        key={String(match.id)}
                        className="border-t border-white/10 py-4 first:border-t-0 first:pt-0"
                      >
                        <p className="text-xs uppercase text-zinc-500">
                          {isBye ? "CTP bye" : `Match ${match.number}`}
                        </p>
                        {isBye ? (
                          <p className="mt-2 font-semibold" style={{ color: "#0b6675" }}>{match.opponent1?.id !== null && match.opponent1?.id !== undefined ? firstName : secondName} advances to {knockoutRounds[1]?.label.toLowerCase() ?? "the next round"}.</p>
                        ) : winnerName ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold text-white">
                              <Check className="mr-2 inline size-4 text-emerald-300" />
                              {winnerName} won
                            </p>
                            <form action={resetPar3KnockoutMatchAction}>
                              <input type="hidden" name="event_id" value={event.id} />
                              <input type="hidden" name="match_id" value={String(match.id)} />
                              <button type="submit" className="btn-secondary">
                                Undo
                              </button>
                            </form>
                          </div>
                        ) : actionable ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center justify-between gap-3 sm:col-span-2">
                              {isLive ? (
                                <span className="inline-flex min-h-10 items-center gap-2 border border-red-400/35 bg-red-400/10 px-3 text-xs font-bold uppercase tracking-wider text-red-200">
                                  <i className="size-2 rounded-full bg-red-400" /> Live on finals centre
                                </span>
                              ) : (
                                <form action={startPar3KnockoutMatchAction}>
                                  <input type="hidden" name="event_id" value={event.id} />
                                  <input type="hidden" name="match_id" value={String(match.id)} />
                                  <button type="submit" className="btn-secondary">
                                    <Radio className="mr-2 inline size-4" /> Show live
                                  </button>
                                </form>
                              )}
                              <Link
                                href="/stream/par3-showdown?view=finals"
                                target="_blank"
                                className="text-xs font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-100"
                              >
                                Open display <ExternalLink className="ml-1 inline size-3.5" />
                              </Link>
                            </div>
                            {[firstName, secondName].map((name, index) => (
                              <form
                                key={`${String(match.id)}-${index}`}
                                action={recordPar3KnockoutWinnerAction}
                              >
                                <input type="hidden" name="event_id" value={event.id} />
                                <input type="hidden" name="match_id" value={String(match.id)} />
                                <input type="hidden" name="winner_side" value={index + 1} />
                                <button
                                  type="submit"
                                  className="min-h-14 w-full border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
                                >
                                  {name}
                                </button>
                              </form>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-500">
                            {firstName} vs {secondName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel mt-6 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Calculated draw</p>
                <h3 className="mt-2 text-xl">{ctpBye ? `${qualification.openingMatchCount} opening matches + CTP bye` : `${firstFinalsLabel} preview`}</h3>
                <p className="mt-2 text-sm text-zinc-400">{getPar3FinalsStages(event)[0]?.course} / {getPar3StageHoleLabel(getPar3FinalsStages(event)[0])}</p>
              </div>
              <span className={`text-sm font-semibold ${finalsReady ? "text-emerald-300" : "text-zinc-500"}`}>
                {finalsReady ? "Ready to generate" : ctpQualifierCount ? "Waiting for pool results + CTP" : "Waiting for pool results"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {roundOf16Template.map((pairing) => {
                const first = resolvePar3BracketSlot(snapshot, pairing.first);
                const second = resolvePar3BracketSlot(snapshot, pairing.second);

                return (
                  <div key={pairing.matchNumber} className="border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase text-zinc-500">
                      {pairing.first.isBye || pairing.second.isBye ? "CTP bye" : `Lane ${pairing.lane} / Match ${pairing.matchNumber}`}
                    </p>
                    <p className="mt-3 font-semibold text-white">
                      {poolStandingsLocked && first ? first.name : pairing.first.label}
                    </p>
                    <span className="my-1 block text-xs uppercase text-amber-300">{pairing.first.isBye || pairing.second.isBye ? "advances automatically" : "vs"}</span>
                    <p className="font-semibold text-white">
                      {poolStandingsLocked && second ? second.name : pairing.second.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-400">
              {ctpBye
                ? `The CTP winner advances to ${getPar3FinalsStages(event)[1]?.label.toLowerCase() ?? "the next round"}. The remaining ${qualification.requiredPlayerCount - 1} entrants form ${qualification.openingMatchCount} matches, avoiding same-pool pairings where possible. Names lock in after pool results and the CTP winner are confirmed.`
                : "The draw follows the saved pool and finals format, spreads leading seeds across the bracket and avoids same-pool first-round matches where possible. Existing five- and six-pool championship draws retain their established seeding."}
            </p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
