"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  date,
  row,
  rows,
  str,
  type CglRow,
  useCglPublic,
} from "./cgl-ui";
import s from "./CglSgtLive.module.css";

function first(record: CglRow, keys: string[], fallback: unknown = null) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function player(record: CglRow) {
  return str(
    first(record, [
      "user_name",
      "username",
      "player_name",
      "playerName",
      "display_name",
      "name",
      "team_name",
      "teamName",
    ]),
    "Player",
  );
}

function score(record: CglRow, mode: "gross" | "net") {
  return first(
    record,
    mode === "net"
      ? ["net", "net_score", "netscore", "netTotal", "total_net", "points"]
      : ["gross", "gross_score", "grossscore", "grossTotal", "total_gross", "score"],
    "—",
  );
}

function extractRows(value: unknown, keys: string[] = []) {
  const direct = rows(value);
  if (direct.length) return direct;
  const object = row(value);
  for (const key of keys) {
    const nested = rows(object[key]);
    if (nested.length) return nested;
  }
  return [];
}

function standingsFor(tour: CglRow, mode: "gross" | "net") {
  return extractRows(
    mode === "net" ? tour.standings_net : tour.standings_gross,
    ["standings", "results", "rows"],
  );
}

function holesFor(card: CglRow) {
  const nested = row(card.scorecard);
  const direct = extractRows(
    card.holes ?? card.scores ?? nested.holes ?? nested.scores,
    ["holes", "scores"],
  );
  if (direct.length)
    return direct.slice(0, 18).map((hole, index) => ({
      hole: first(hole, ["hole", "hole_number", "number"], index + 1),
      par: first(hole, ["par", "hole_par"], "—"),
      gross: first(hole, ["gross", "score", "strokes"], "—"),
      net: first(hole, ["net", "net_score", "netscore"], "—"),
    }));

  return Array.from({ length: 18 }, (_, index) => {
    const hole = index + 1;
    return {
      hole,
      par: first(card, [`par${hole}`, `par_${hole}`, `hole${hole}_par`], "—"),
      gross: first(
        card,
        [`h${hole}`, `hole${hole}`, `gross${hole}`, `gross_${hole}`],
        "—",
      ),
      net: first(card, [`net${hole}`, `net_${hole}`, `hole${hole}_net`], "—"),
    };
  }).filter((hole) => hole.gross !== "—" || hole.net !== "—");
}

function statRows(value: unknown) {
  const direct = extractRows(value, ["stats", "results", "leaders", "rows"]);
  if (direct.length) return direct;
  const object = row(value);
  return Object.entries(object).flatMap(([category, item]) => {
    const categoryRows = extractRows(item, ["results", "leaders", "rows"]);
    if (categoryRows.length)
      return categoryRows.map((entry) => ({ category, ...entry }));
    if (item === null || ["string", "number"].includes(typeof item))
      return [{ category, value: item }];
    return [];
  });
}

function formatStatLabel(value: unknown) {
  return str(value, "Statistic")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CglSgtLive() {
  const data = useCglPublic(true, 60_000);
  const sgt = row(data.sgt);
  const connection = row(sgt.connection);
  const tours = rows(sgt.tours).toSorted(
    (a, b) =>
      Number(b.active === true) - Number(a.active === true) ||
      str(b.start_date, "").localeCompare(str(a.start_date, "")),
  );
  const tournaments = rows(sgt.tournaments).toSorted((a, b) =>
    str(b.start_date, "").localeCompare(str(a.start_date, "")),
  );
  const [tourId, setTourId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [mode, setMode] = useState<"gross" | "net">("net");
  const [view, setView] = useState<"standings" | "scorecards" | "stats">(
    "standings",
  );

  const selectedTour =
    tours.find((tour) => str(tour.sgt_tour_id, "") === tourId) ?? tours[0];
  const tourTournaments = tournaments.filter(
    (tournament) =>
      !selectedTour || tournament.sgt_tour_id === selectedTour.sgt_tour_id,
  );

  const selectedTournament =
    tourTournaments.find(
      (tournament) =>
        str(tournament.sgt_tournament_id, "") === tournamentId,
    ) ?? tourTournaments[0];
  const standings = selectedTour ? standingsFor(selectedTour, mode) : [];
  const scorecards = selectedTournament
    ? extractRows(selectedTournament.scorecards, ["scorecards", "results", "rows"])
    : [];
  const statistics = statRows(
    selectedTournament?.stats ?? selectedTour?.stats ?? {},
  );
  const [cardName, setCardName] = useState("");
  const selectedCard =
    scorecards.find((card) => player(card) === cardName) ?? scorecards[0];
  const holes = selectedCard ? holesFor(selectedCard) : [];

  if (data.status === "loading")
    return (
      <div className={s.loading}>
        <RefreshCw aria-hidden="true" />
        <strong>Loading the official SGT clubhouse…</strong>
      </div>
    );

  const live = ["connected", "syncing"].includes(str(connection.status, ""));
  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <div className={s.kicker}>
            <span className={live ? s.liveDot : s.waitingDot} />
            {live ? "Official club data live" : "Official connection awaiting setup"}
          </div>
          <p className={s.overline}>CGSBunker / Simulator Golf Tour</p>
          <h1>
            Every round.
            <span> One clubhouse.</span>
          </h1>
          <p>
            Follow official CGS tours, current tournament standings,
            scorecards and performance statistics as they are recorded in SGT.
          </p>
          <div className={s.heroActions}>
            <a
              href={str(connection.source_url, "https://simulatorgolftour.com/club/CGSBunker")}
              target="_blank"
              rel="noreferrer"
              className={s.primary}
            >
              Open CGSBunker on SGT <ArrowUpRight size={15} />
            </a>
            <span>
              Last refreshed {connection.last_success_at ? date(connection.last_success_at, true) : "after connection"}
            </span>
          </div>
        </div>
        <div className={s.heroMark} aria-hidden="true">
          <span>SGT</span>
          <strong>LIVE</strong>
          <small>READ-ONLY OFFICIAL FEED</small>
        </div>
      </section>

      {!tours.length ? (
        <section className={s.empty}>
          <span>SGT / CGSBUNKER</span>
          <h2>The live feed is ready for its first connection.</h2>
          <p>
            Once the club administrator completes the secure one-time connection,
            tours, tournaments and scorecards will appear here automatically.
          </p>
          <Link href="/cgl/trial">View the existing trial hub</Link>
        </section>
      ) : (
        <>
          <section className={s.controls} aria-label="Live SGT view controls">
            <label>
              Tour
              <select
                value={str(selectedTour?.sgt_tour_id, "")}
                onChange={(event) => {
                  setTourId(event.target.value);
                  setTournamentId("");
                }}
              >
                {tours.map((tour) => (
                  <option key={str(tour.sgt_tour_id)} value={str(tour.sgt_tour_id)}>
                    {str(tour.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tournament
              <select
                value={str(selectedTournament?.sgt_tournament_id, "")}
                onChange={(event) => setTournamentId(event.target.value)}
              >
                {tourTournaments.map((tournament) => (
                  <option
                    key={str(tournament.sgt_tournament_id)}
                    value={str(tournament.sgt_tournament_id)}
                  >
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

          <section className={s.eventStrip}>
            <div>
              <span>Current tour</span>
              <strong>{str(selectedTour?.name)}</strong>
            </div>
            <div>
              <span>Selected event</span>
              <strong>{str(selectedTournament?.name, "No tournament published")}</strong>
            </div>
            <div>
              <span>Course</span>
              <strong>{str(selectedTournament?.course_name, "Course in SGT")}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>{str(selectedTournament?.gameplay, selectedTournament?.stableford ? "Stableford" : "Tournament")}</strong>
            </div>
          </section>

          <div className={s.viewTabs} role="tablist" aria-label="SGT live data">
            {(["standings", "scorecards", "stats"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
              >
                {item === "stats" ? "Statistics" : formatStatLabel(item)}
              </button>
            ))}
          </div>

          {view === "standings" ? (
            <section className={s.board}>
              <header>
                <div>
                  <span>Live tour table</span>
                  <h2>{mode === "net" ? "Nett standings" : "Gross standings"}</h2>
                </div>
                <strong>{standings.length} competitors</strong>
              </header>
              {standings.length ? (
                <div className={s.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Player / team</th>
                        <th>Played</th>
                        <th>{mode === "net" ? "Nett" : "Gross"}</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.slice(0, 100).map((entry, index) => (
                        <tr key={`${player(entry)}-${index}`}>
                          <td>{String(first(entry, ["position", "pos", "rank"], index + 1))}</td>
                          <td><strong>{player(entry)}</strong></td>
                          <td>{String(first(entry, ["played", "rounds", "events", "p"], "—"))}</td>
                          <td className={s.score}>{String(score(entry, mode))}</td>
                          <td>{String(first(entry, ["points", "pts", "total_points"], "—"))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={s.noData}>SGT has not published standings for this tour yet.</p>
              )}
            </section>
          ) : null}

          {view === "scorecards" ? (
            <section className={s.scorecardPanel}>
              <header>
                <div>
                  <span>Official tournament card</span>
                  <h2>{player(selectedCard ?? {})}</h2>
                </div>
                {scorecards.length ? (
                  <label>
                    Player
                    <select
                      value={player(selectedCard ?? {})}
                      onChange={(event) => setCardName(event.target.value)}
                    >
                      {scorecards.map((card, index) => (
                        <option key={`${player(card)}-${index}`} value={player(card)}>
                          {player(card)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </header>
              {selectedCard && holes.length ? (
                <>
                  <div className={s.cardTotals}>
                    <span>Gross <strong>{String(score(selectedCard, "gross"))}</strong></span>
                    <span>Nett <strong>{String(score(selectedCard, "net"))}</strong></span>
                    <span>Handicap <strong>{String(first(selectedCard, ["handicap", "hcp", "playing_handicap"], "—"))}</strong></span>
                    <span>Thru <strong>{String(first(selectedCard, ["thru", "through", "active_hole", "holes_played"], holes.length))}</strong></span>
                  </div>
                  <div className={s.holes}>
                    {holes.map((hole) => (
                      <article key={String(hole.hole)}>
                        <span>Hole {String(hole.hole)}</span>
                        <small>Par {String(hole.par)}</small>
                        <strong>{String(mode === "net" ? hole.net : hole.gross)}</strong>
                        <em>{mode === "net" ? "NETT" : "GROSS"}</em>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className={s.noData}>No scorecard has been posted for this tournament yet.</p>
              )}
            </section>
          ) : null}

          {view === "stats" ? (
            <section className={s.statsPanel}>
              <header>
                <span>Performance lab</span>
                <h2>Tournament statistics</h2>
              </header>
              {statistics.length ? (
                <div className={s.statsGrid}>
                  {statistics.slice(0, 48).map((stat, index) => (
                    <article key={`${str(stat.category, "stat")}-${index}`}>
                      <span>{formatStatLabel(first(stat, ["category", "stat", "label", "name"]))}</span>
                      <strong>{String(first(stat, ["value", "result", "stat_value", "average", "distance"], "—"))}</strong>
                      <small>{player(stat)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={s.noData}>SGT statistics will appear after eligible rounds are recorded.</p>
              )}
            </section>
          ) : null}
        </>
      )}

      <section className={s.trustBar}>
        <strong>How this feed works</strong>
        <p>
          Tournament data is read from the official CGSBunker SGT club account.
          CGL stores a protected display cache, refreshes it automatically and
          never exposes the club API key or administrator password.
        </p>
        <Link href="/cgl/rules">CGL rules & handicaps <ArrowUpRight size={13} /></Link>
      </section>
    </div>
  );
}
