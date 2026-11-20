"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Flag,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  buildSgtStatCategories,
  buildSgtTournamentLeaderboard,
  formatSgtStatValue,
  formatSgtToPar,
  sgtExtractRows,
  sgtFirst,
  sgtNumber,
  sgtPlayerName,
  sgtRows,
  sgtScore,
  sgtScorecardHoles,
  type SgtRow,
  type SgtScoreMode,
} from "@/lib/cgl-sgt-live";
import { date, row, str, type CglSnapshot } from "./cgl-ui";
import s from "./CglSgtLive.module.css";

type LiveView = "leaderboard" | "scorecards" | "statistics" | "tour";

function standingsFor(tour: SgtRow, mode: SgtScoreMode) {
  return sgtExtractRows(
    mode === "net" ? tour.standings_net : tour.standings_gross,
    ["standings", "results", "rows"],
  );
}

function isCurrentTournament(tournament: SgtRow) {
  const status = str(tournament.status, "").toLowerCase();
  if (/in progress|active|live|open/.test(status)) return true;
  const today = new Date().toISOString().slice(0, 10);
  return (
    str(tournament.start_date, "") <= today &&
    str(tournament.end_date, "") >= today
  );
}

function relativeTime(value: unknown, observedAt: number) {
  if (typeof value !== "string") return "not yet confirmed";
  const milliseconds = observedAt - Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "not yet confirmed";
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 20) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function eventDate(tournament: SgtRow) {
  const start = date(tournament.start_date);
  const end = date(tournament.end_date);
  if (start === end) return start;
  return `${start} – ${end}`;
}

function formatTotal(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("en-AU", { maximumFractionDigits: 1 });
}

function scoreMarker(gross: number | null, par: number | null) {
  if (gross === null || par === null) return "";
  const difference = gross - par;
  if (difference <= -2) return s.eagle;
  if (difference === -1) return s.birdie;
  if (difference === 1) return s.bogey;
  if (difference >= 2) return s.doubleBogey;
  return s.par;
}

function useSgtLiveFeed() {
  const [data, setData] = useState<CglSnapshot>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [feedMessage, setFeedMessage] = useState("");
  const inFlight = useRef(false);
  const etag = useRef("");

  async function requestFeed(pulse = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    if (pulse) setRefreshing(true);
    try {
      const response = await fetch(
        pulse ? "/api/cgl/sgt/live" : "/api/cgl/live",
        {
          method: pulse ? "POST" : "GET",
          cache: "no-store",
          headers:
            !pulse && etag.current
              ? { "If-None-Match": etag.current }
              : undefined,
        },
      );
      setLastCheckedAt(new Date());
      if (response.status === 304) {
        setFeedMessage("");
        return;
      }
      const value = (await response.json()) as CglSnapshot;
      if (!response.ok && value.status !== "ready")
        throw new Error(str(value.message, "Live data is temporarily unavailable."));
      const nextEtag = response.headers.get("etag");
      if (nextEtag) etag.current = nextEtag;
      const pulseState = row(value.pulse);
      setFeedMessage(
        str(pulseState.status, "") === "delayed"
          ? str(
              pulseState.message,
              "SGT is delayed. Showing the last confirmed results.",
            )
          : "",
      );
      startTransition(() => setData(value));
    } catch (error) {
      setFeedMessage(
        error instanceof Error
          ? error.message
          : "Live data is temporarily unavailable. Retrying automatically.",
      );
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }

  const beginLiveFeed = useEffectEvent(async () => {
    await requestFeed(false);
    await requestFeed(true);
  });
  const pollLiveFeed = useEffectEvent((pulse: boolean) => requestFeed(pulse));

  useEffect(() => {
    let tick = 0;
    void beginLiveFeed();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      tick += 1;
      void pollLiveFeed(tick % 3 === 0);
    }, 15_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void pollLiveFeed(false);
    };
    const handleOnline = () => void pollLiveFeed(true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return {
    data,
    refreshing,
    lastCheckedAt,
    feedMessage,
    refresh: () => requestFeed(true),
  };
}

export default function CglSgtLive() {
  const { data, refreshing, lastCheckedAt, feedMessage, refresh } =
    useSgtLiveFeed();
  const sgt = row(data.sgt);
  const connection = row(sgt.connection);
  const tours = sgtRows(sgt.tours).toSorted(
    (a, b) =>
      Number(b.active === true) - Number(a.active === true) ||
      str(b.start_date, "").localeCompare(str(a.start_date, "")),
  );
  const tournaments = sgtRows(sgt.tournaments).toSorted(
    (a, b) =>
      Number(isCurrentTournament(b)) - Number(isCurrentTournament(a)) ||
      str(b.start_date, "").localeCompare(str(a.start_date, "")),
  );
  const [tourId, setTourId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [mode, setMode] = useState<SgtScoreMode>("net");
  const [view, setView] = useState<LiveView>("leaderboard");
  const [cardName, setCardName] = useState("");
  const [roundNumber, setRoundNumber] = useState(0);
  const [statKey, setStatKey] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const preferredTourId = String(
    tournaments.find(isCurrentTournament)?.sgt_tour_id ??
      tournaments[0]?.sgt_tour_id ??
      "",
  );
  const selectedTour =
    tours.find((tour) => String(tour.sgt_tour_id) === tourId) ??
    tours.find((tour) => String(tour.sgt_tour_id) === preferredTourId) ??
    tours[0];
  const tourTournaments = tournaments.filter(
    (tournament) =>
      !selectedTour ||
      String(tournament.sgt_tour_id) === String(selectedTour.sgt_tour_id),
  );
  const selectedTournament =
    tourTournaments.find(
      (tournament) =>
        String(tournament.sgt_tournament_id) === tournamentId,
    ) ?? tourTournaments[0];
  const scorecards = selectedTournament
    ? sgtExtractRows(selectedTournament.scorecards, [
        "scorecards",
        "results",
        "rows",
      ])
    : [];
  const registrations = selectedTournament
    ? sgtExtractRows(selectedTournament.registrations, [
        "registrations",
        "results",
        "rows",
      ])
    : [];
  const leaderboard = buildSgtTournamentLeaderboard(
    scorecards,
    mode,
    selectedTournament?.stableford === true,
  );
  const standings = selectedTour ? standingsFor(selectedTour, mode) : [];
  const tournamentStats = buildSgtStatCategories(selectedTournament?.stats);
  const tourStats = buildSgtStatCategories(selectedTour?.stats);
  const statCategories = tournamentStats.length ? tournamentStats : tourStats;
  const selectedStat =
    statCategories.find((category) => category.key === statKey) ??
    statCategories[0];
  const playerNames = [...new Set(scorecards.map(sgtPlayerName))].toSorted();
  const selectedPlayerName = playerNames.includes(cardName)
    ? cardName
    : playerNames.includes(leaderboard[0]?.name)
      ? leaderboard[0].name
      : playerNames[0] ?? "";
  const playerCards = scorecards
    .filter((card) => sgtPlayerName(card) === selectedPlayerName)
    .toSorted(
      (a, b) =>
        (sgtNumber(sgtFirst(a, ["round", "round_number"])) ?? 1) -
        (sgtNumber(sgtFirst(b, ["round", "round_number"])) ?? 1),
    );
  const selectedCard =
    playerCards.find(
      (card) =>
        (sgtNumber(sgtFirst(card, ["round", "round_number"])) ?? 1) ===
        roundNumber,
    ) ?? playerCards.at(-1);
  const holes = selectedCard ? sgtScorecardHoles(selectedCard) : [];
  const filteredLeaderboard = leaderboard.filter(
    (entry) => !deferredSearch || entry.name.toLowerCase().includes(deferredSearch),
  );
  const filteredStandings = standings.filter(
    (entry) =>
      !deferredSearch || sgtPlayerName(entry).toLowerCase().includes(deferredSearch),
  );
  const livePlayers = leaderboard.filter((entry) => entry.status === "live");
  const finishedPlayers = leaderboard.filter(
    (entry) => entry.status === "finished",
  );
  const fieldSize = Math.max(registrations.length, leaderboard.length);
  const leader = leaderboard[0];
  const sourceUpdatedAt = str(
    connection.source_updated_at ?? selectedTournament?.synced_at,
    "",
  );
  const observedAt =
    lastCheckedAt?.getTime() ?? Date.parse(str(data.updated_at, ""));
  const sourceAge =
    Number.isFinite(Date.parse(sourceUpdatedAt)) && Number.isFinite(observedAt)
    ? Math.max(0, observedAt - Date.parse(sourceUpdatedAt))
    : Number.POSITIVE_INFINITY;
  const connected = ["connected", "syncing"].includes(
    str(connection.status, ""),
  );
  const health = !connected || sourceAge > 5 * 60_000
    ? "delayed"
    : sourceAge > 90_000
      ? "updating"
      : "live";

  if (data.status === "loading")
    return (
      <div className={s.loading}>
        <div className={s.loadingMark}>CGL</div>
        <RefreshCw aria-hidden="true" />
        <strong>Opening the live tournament centre…</strong>
        <span>Loading official SGT results</span>
      </div>
    );

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <div className={`${s.liveBadge} ${s[health]}`}>
            <span />
            {health === "live"
              ? "Live tournament feed"
              : health === "updating"
                ? "Updating official results"
                : "Results feed delayed"}
          </div>
          <p className={s.overline}>CGL live centre · Powered by official SGT data</p>
          <h1>
            Follow every shot.
            <span> Know the whole story.</span>
          </h1>
          <p>
            Live positions, round progress, complete scorecards and the full
            performance picture from the CGSBunker Simulator Golf Tour club.
          </p>
          <div className={s.heroActions}>
            <a href="#live-board" className={s.primary}>
              View live positions <ArrowUpRight size={15} />
            </a>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? s.spinning : ""} />
              {refreshing ? "Checking SGT…" : "Refresh now"}
            </button>
          </div>
        </div>
        <div className={s.heroScore} aria-label="Current tournament summary">
          <div className={s.heroScoreTop}>
            <span>{str(selectedTournament?.status, "Tournament")}</span>
            <small>Official feed</small>
          </div>
          <strong>{leader ? formatSgtToPar(leader.toPar) : "—"}</strong>
          <p>
            {leader
              ? `${leader.tied ? "Joint leaders" : "Leader"}: ${leader.name}`
              : "Waiting for the first scorecard"}
          </p>
          <div>
            <span><Activity size={13} /> {livePlayers.length} playing</span>
            <span><CheckCircle2 size={13} /> {finishedPlayers.length} finished</span>
          </div>
        </div>
      </section>

      <section className={s.freshness} aria-live="polite">
        <div>
          <CircleGauge size={18} />
          <span>
            <strong>Official SGT data</strong>
            Source updated {relativeTime(sourceUpdatedAt, observedAt)}
          </span>
        </div>
        <div>
          Browser checked {lastCheckedAt ? relativeTime(lastCheckedAt.toISOString(), observedAt) : "on opening"}
          <span>Auto-checks every 15 seconds</span>
        </div>
      </section>

      {feedMessage || health === "delayed" ? (
        <section className={s.delayNotice} role="status">
          <Clock3 size={18} />
          <div>
            <strong>Showing the last confirmed SGT results</strong>
            <p>
              {feedMessage ||
                "The official connection needs attention. Results remain available while automatic refresh retries."}
            </p>
          </div>
        </section>
      ) : null}

      {!tours.length ? (
        <section className={s.empty}>
          <span>SGT / CGSBUNKER</span>
          <h2>The live feed is ready for its first tournament.</h2>
          <p>
            Once the secure club connection is refreshed, tours, live positions,
            scorecards and statistics will appear here automatically.
          </p>
          <Link href="/cgl/trial">View the existing trial hub</Link>
        </section>
      ) : (
        <>
          <section className={s.eventSelector} aria-label="Choose live event">
            <div className={s.selectorIntro}>
              <span>Now following</span>
              <strong>{str(selectedTournament?.name, "Choose a tournament")}</strong>
            </div>
            <label>
              Tour
              <select
                value={String(selectedTour?.sgt_tour_id ?? "")}
                onChange={(event) => {
                  setTourId(event.target.value);
                  setTournamentId("");
                  setCardName("");
                }}
              >
                {tours.map((tour) => (
                  <option key={String(tour.sgt_tour_id)} value={String(tour.sgt_tour_id)}>
                    {str(tour.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tournament
              <select
                value={String(selectedTournament?.sgt_tournament_id ?? "")}
                onChange={(event) => {
                  setTournamentId(event.target.value);
                  setCardName("");
                  setRoundNumber(0);
                }}
              >
                {tourTournaments.map((tournament) => (
                  <option
                    key={String(tournament.sgt_tournament_id)}
                    value={String(tournament.sgt_tournament_id)}
                  >
                    {isCurrentTournament(tournament) ? "LIVE · " : ""}
                    {str(tournament.name)}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.scoreMode} aria-label="Score mode">
              <button
                type="button"
                aria-pressed={mode === "net"}
                onClick={() => setMode("net")}
              >
                Nett
              </button>
              <button
                type="button"
                aria-pressed={mode === "gross"}
                onClick={() => setMode("gross")}
              >
                Gross
              </button>
            </div>
          </section>

          <section className={s.eventHeader}>
            <div className={s.eventTitle}>
              <span>{str(selectedTournament?.status, "Tournament")}</span>
              <h2>{str(selectedTournament?.name, "Tournament details")}</h2>
              <p>{str(selectedTour?.name)}</p>
            </div>
            <div className={s.eventFacts}>
              <div><MapPin size={17} /><span>Course<strong>{str(selectedTournament?.course_name, "In SGT")}</strong></span></div>
              <div><CalendarDays size={17} /><span>Playing window<strong>{eventDate(selectedTournament ?? {})}</strong></span></div>
              <div><Flag size={17} /><span>Format<strong>{str(selectedTournament?.gameplay, selectedTournament?.stableford ? "Stableford" : "Stroke play")}</strong></span></div>
              <div><UsersRound size={17} /><span>Field<strong>{fieldSize || "Awaiting entries"}</strong></span></div>
            </div>
          </section>

          <section className={s.pulseGrid} aria-label="Tournament pulse">
            <article>
              <span>Current leader</span>
              <strong>{leader?.name ?? "Awaiting scores"}</strong>
              <em>{leader ? formatSgtToPar(leader.toPar) : "—"}</em>
            </article>
            <article>
              <span>On course</span>
              <strong>{livePlayers.length}</strong>
              <em>{livePlayers.length === 1 ? "player live" : "players live"}</em>
            </article>
            <article>
              <span>Cards in</span>
              <strong>{finishedPlayers.length}</strong>
              <em>of {fieldSize || "—"} players</em>
            </article>
            <article>
              <span>Statistics</span>
              <strong>{statCategories.length}</strong>
              <em>live categories</em>
            </article>
          </section>

          <section id="live-board" className={s.liveBoard}>
            <div className={s.viewTabs} role="tablist" aria-label="Tournament live data">
              {[
                ["leaderboard", Trophy, "Live positions"],
                ["scorecards", Flag, "Scorecards"],
                ["statistics", BarChart3, "Player stats"],
                ["tour", Gauge, "Tour standings"],
              ].map(([item, Icon, label]) => {
                const ViewIcon = Icon as typeof Trophy;
                return (
                  <button
                    key={String(item)}
                    type="button"
                    role="tab"
                    aria-selected={view === item}
                    onClick={() => setView(item as LiveView)}
                  >
                    <ViewIcon size={15} /> {String(label)}
                  </button>
                );
              })}
            </div>

            {(view === "leaderboard" || view === "tour") ? (
              <label className={s.search}>
                <Search size={16} />
                <span className={s.srOnly}>Search player</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a player"
                />
              </label>
            ) : null}

            {view === "leaderboard" ? (
              <div className={s.panel} role="tabpanel">
                <header className={s.panelHeader}>
                  <div>
                    <span>Live tournament leaderboard</span>
                    <h2>{mode === "net" ? "Nett positions" : "Gross positions"}</h2>
                  </div>
                  <strong>{filteredLeaderboard.length} players</strong>
                </header>
                {filteredLeaderboard.length ? (
                  <div className={s.tableWrap}>
                    <table className={s.leaderboardTable}>
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Player / team</th>
                          <th>Score</th>
                          <th>Total</th>
                          <th>Thru</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaderboard.map((entry) => (
                          <tr key={entry.name} data-live={entry.status === "live"}>
                            <td>{entry.tied ? "T" : ""}{entry.position}</td>
                            <td>
                              <Link href={`/cgl/players/${encodeURIComponent(entry.name)}`}>
                                <strong>{entry.name}</strong>
                                <small>{entry.cards.length} round{entry.cards.length === 1 ? "" : "s"}</small>
                              </Link>
                            </td>
                            <td className={s.toPar}>{formatSgtToPar(entry.toPar)}</td>
                            <td>{formatTotal(entry.total)}</td>
                            <td>{entry.status === "live" ? `R${entry.currentRound} · ${entry.thru}` : entry.thru}</td>
                            <td><span className={`${s.rowStatus} ${s[entry.status]}`}>{entry.status === "live" ? "Playing" : entry.status === "finished" ? "Finished" : "Waiting"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={s.noData}>No scorecards match this view yet.</p>
                )}
              </div>
            ) : null}

            {view === "scorecards" ? (
              <div className={s.panel} role="tabpanel">
                <header className={s.panelHeader}>
                  <div>
                    <span>Official tournament card</span>
                    <h2>{selectedPlayerName || "Scorecards"}</h2>
                  </div>
                  <div className={s.cardSelectors}>
                    <label>
                      Player
                      <select
                        value={selectedPlayerName}
                        onChange={(event) => {
                          setCardName(event.target.value);
                          setRoundNumber(0);
                        }}
                      >
                        {playerNames.map((name) => <option key={name}>{name}</option>)}
                      </select>
                    </label>
                    {playerCards.length > 1 ? (
                      <label>
                        Round
                        <select
                          value={String(sgtNumber(sgtFirst(selectedCard ?? {}, ["round", "round_number"])) ?? 1)}
                          onChange={(event) => setRoundNumber(Number(event.target.value))}
                        >
                          {playerCards.map((card, index) => {
                            const round = sgtNumber(sgtFirst(card, ["round", "round_number"])) ?? index + 1;
                            return <option key={round} value={round}>Round {round}</option>;
                          })}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </header>
                {selectedCard && holes.length ? (
                  <>
                    <div className={s.cardTotals}>
                      <span>Gross<strong>{formatTotal(sgtScore(selectedCard, "gross"))}</strong></span>
                      <span className={s.netTotal}>Nett<strong>{formatTotal(sgtScore(selectedCard, "net"))}</strong></span>
                      <span>Handicap<strong>{formatTotal(sgtNumber(sgtFirst(selectedCard, ["hcp_index", "handicap", "hcp", "playing_handicap"])))}</strong></span>
                      <span>Position<strong>{leaderboard.find((entry) => entry.name === selectedPlayerName)?.position ?? "—"}</strong></span>
                    </div>
                    <div className={s.holes}>
                      {holes.map((hole) => (
                        <article key={hole.hole} data-played={hole.gross !== null || hole.net !== null}>
                          <header><span>Hole {hole.hole}</span><small>Par {hole.par ?? "—"}</small></header>
                          <div className={s.holeScores}>
                            <div className={scoreMarker(hole.gross, hole.par)}><span>Gross</span><strong>{hole.gross ?? "—"}</strong></div>
                            <div className={s.netScore}><span>Nett</span><strong>{hole.net ?? "—"}</strong></div>
                          </div>
                          <footer>SI {hole.strokeIndex ?? "—"}</footer>
                        </article>
                      ))}
                    </div>
                    <div className={s.scoreLegend}>
                      <span><i className={s.eagle} /> Eagle or better</span>
                      <span><i className={s.birdie} /> Birdie</span>
                      <span><i className={s.bogey} /> Bogey</span>
                      <span><i className={s.doubleBogey} /> Double or worse</span>
                    </div>
                  </>
                ) : (
                  <p className={s.noData}>No scorecard has been posted for this tournament yet.</p>
                )}
              </div>
            ) : null}

            {view === "statistics" ? (
              <div className={s.panel} role="tabpanel">
                <header className={s.panelHeader}>
                  <div>
                    <span>Performance lab</span>
                    <h2>Every available SGT statistic</h2>
                  </div>
                  <strong>{statCategories.length} categories</strong>
                </header>
                {selectedStat ? (
                  <>
                    <div className={s.statPicker} aria-label="Statistic category">
                      {statCategories.map((category) => (
                        <button
                          key={category.key}
                          type="button"
                          aria-pressed={selectedStat.key === category.key}
                          onClick={() => setStatKey(category.key)}
                        >
                          {category.shortLabel}
                        </button>
                      ))}
                    </div>
                    <div className={s.statFeature}>
                      <div>
                        <span>Category leader</span>
                        <h3>{selectedStat.entries[0]?.name}</h3>
                        <p>{selectedStat.description}</p>
                      </div>
                      <strong>{selectedStat.entries[0] ? formatSgtStatValue(selectedStat.entries[0].value, selectedStat) : "—"}</strong>
                    </div>
                    <div className={s.statRows}>
                      {selectedStat.entries.map((entry, index) => (
                        <article key={`${selectedStat.key}-${entry.name}`}>
                          <span>{index + 1}</span>
                          <Link href={`/cgl/players/${encodeURIComponent(entry.name)}`}>{entry.name}</Link>
                          <strong>{formatSgtStatValue(entry.value, selectedStat)}</strong>
                          <small>{entry.average === null ? "" : `Field avg ${formatSgtStatValue(entry.average, selectedStat)}`}</small>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={s.noData}>SGT statistics will appear after eligible rounds are recorded.</p>
                )}
              </div>
            ) : null}

            {view === "tour" ? (
              <div className={s.panel} role="tabpanel">
                <header className={s.panelHeader}>
                  <div>
                    <span>Season-long table</span>
                    <h2>{mode === "net" ? "Nett tour standings" : "Gross tour standings"}</h2>
                  </div>
                  <strong>{filteredStandings.length} competitors</strong>
                </header>
                {filteredStandings.length ? (
                  <div className={s.tableWrap}>
                    <table>
                      <thead><tr><th>Pos</th><th>Player / team</th><th>Events</th><th>Points</th><th>Top 5</th><th>HCP</th></tr></thead>
                      <tbody>
                        {filteredStandings.map((entry, index) => (
                          <tr key={`${sgtPlayerName(entry)}-${index}`}>
                            <td>{String(sgtFirst(entry, ["position", "pos", "rank"], index + 1))}</td>
                            <td><Link href={`/cgl/players/${encodeURIComponent(sgtPlayerName(entry))}`}><strong>{sgtPlayerName(entry)}</strong></Link></td>
                            <td>{String(sgtFirst(entry, ["events", "played", "rounds", "p"], "—"))}</td>
                            <td className={s.toPar}>{String(sgtFirst(entry, ["points", "pts", "total_points"], "—"))}</td>
                            <td>{String(sgtFirst(entry, ["top5", "top_5"], "—"))}</td>
                            <td>{String(sgtFirst(entry, ["hcp", "handicap"], "—"))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className={s.noData}>SGT has not published tour standings yet.</p>}
              </div>
            ) : null}
          </section>
        </>
      )}

      <section className={s.trustBar}>
        <ShieldCheck size={21} />
        <div>
          <strong>Official results, protected connection</strong>
          <p>
            CGL displays read-only data from the CGSBunker SGT club. The API key
            stays server-side, and the last confirmed result remains visible if
            either service briefly disconnects.
          </p>
        </div>
        <a
          href={str(connection.source_url, "https://simulatorgolftour.com/club/CGSBunker")}
          target="_blank"
          rel="noreferrer"
        >
          Open CGSBunker on SGT <ArrowUpRight size={13} />
        </a>
      </section>
    </div>
  );
}
