"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ClipboardList, Trophy } from "lucide-react";
import { useState } from "react";
import { CglEmpty, CglPerformanceHighlights } from "./CglPublicExperience";
import { date, num, rows, str, type CglRow } from "./cgl-ui";
import s from "./Cgl2027.module.css";

export interface Cgl2027PlayerData {
  preview?: boolean;
  username: string;
  results: CglRow[];
  standings: CglRow[];
  annual: CglRow | null;
  prizes: CglRow[];
  seasons: CglRow[];
  weeks: CglRow[];
}

function officialCard(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["simulatorgolftour.com", "www.simulatorgolftour.com"].includes(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}

export default function Cgl2027Player({
  profile,
  embedded = false,
}: {
  profile: Cgl2027PlayerData;
  embedded?: boolean;
}) {
  const orderedSeasons = [...profile.seasons].sort(
    (a, b) =>
      Number(b.year) - Number(a.year) ||
      Number(b.season_number) - Number(a.season_number),
  );
  const preferred =
    orderedSeasons.find((season) => season.status === "active") ??
    orderedSeasons.find((season) =>
      profile.standings.some((standing) => standing.season_id === season.id),
    );
  const [selectedSeason, setSelectedSeason] = useState(str(preferred?.id, ""));
  const [scorecardId, setScorecardId] = useState("");
  const seasonResults = profile.results
    .filter((result) => !selectedSeason || result.season_id === selectedSeason)
    .sort((a, b) => str(b.played_at, "").localeCompare(str(a.played_at, "")));
  const standing = selectedSeason
    ? profile.standings.find((item) => item.season_id === selectedSeason)
    : null;
  const latest = seasonResults[0];
  const prizes = profile.prizes.filter(
    (prize) => !selectedSeason || prize.season_id === selectedSeason,
  );
  const scorecard = seasonResults.find((result) => result.id === scorecardId);
  const championshipWeeks = [
    ...rows(standing?.counted).map((item): CglRow & { counted: boolean } => ({
      ...item,
      counted: true,
    })),
    ...rows(standing?.discarded).map((item): CglRow & { counted: boolean } => ({
      ...item,
      counted: false,
    })),
  ].sort((a, b) => num(a.week) - num(b.week));
  const heading = embedded ? (
    <h2 style={{ fontSize: 32, fontWeight: 850 }}>
      {profile.username} · 2027 league history
    </h2>
  ) : (
    <h1
      style={{
        fontSize: "clamp(34px,5vw,56px)",
        fontWeight: 850,
        lineHeight: 1.1,
        overflowWrap: "anywhere",
      }}
    >
      {profile.username}
    </h1>
  );

  return (
    <section
      className={`${s.page} ${embedded ? s.section : ""}`}
      aria-label={`${profile.username} CGL league history`}
    >
      {!embedded ? (
        <Link
          href={profile.preview ? "/cgl/preview/2027" : "/cgl/leaderboard"}
          className={s.textLink}
        >
          <ArrowLeft size={14} /> All league standings
        </Link>
      ) : null}
      <header className={s.sectionHead} style={{ marginTop: 25 }}>
        <div>
          <div className={s.eyebrow}>CGL player profile</div>
          {heading}
          <p className={s.muted} style={{ marginTop: 15 }}>
            Published CGL results, championship points and verified
            achievements.
          </p>
        </div>
        {!profile.preview ? (
          <a
            className={s.smallButton}
            href={`https://simulatorgolftour.com/profile/${encodeURIComponent(profile.username)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SGT profile <ArrowUpRight size={14} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span className={s.badge}>Fictional development player</span>
        )}
      </header>

      <label className={s.field} style={{ maxWidth: 400, marginBottom: 24 }}>
        Season history
        <select
          value={selectedSeason}
          onChange={(event) => {
            setSelectedSeason(event.target.value);
            setScorecardId("");
          }}
        >
          <option value="">All published seasons</option>
          {orderedSeasons.map((season) => (
            <option key={str(season.id)} value={str(season.id)}>
              {str(season.name)}
            </option>
          ))}
        </select>
      </label>

      <div className={s.miniStats}>
        {[
          [
            "Division / handicap",
            `${str(standing?.division ?? latest?.division)} / ${str(standing?.handicap ?? latest?.handicap)}`,
            "Verified competition record",
          ],
          [
            "Championship position",
            standing?.position != null ? `#${str(standing.position)}` : "—",
            selectedSeason
              ? "Within this season's division"
              : "Select a season to view position",
          ],
          [
            "Championship points",
            standing ? str(standing.total_points) : "—",
            "Best eight of ten weekly results",
          ],
          [
            "Published weekly results",
            String(seasonResults.length),
            "CGL competitions only",
          ],
        ].map(([label, value, detail]) => (
          <article className={s.metric} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>

      {standing ? (
        <article className={s.panel}>
          <h2>Your best eight</h2>
          <p>
            {str(standing.rounds_counted, "0")} of eight results currently
            count. The two lowest of ten weekly points totals are discarded;
            missing weeks score zero.
          </p>
          <div
            className={s.progress}
            aria-label={`${Math.min(num(standing.rounds_counted), 8)} of eight championship results counted`}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                data-counted={index < Math.min(num(standing.rounds_counted), 8)}
              />
            ))}
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Counted and discarded championship weeks</caption>
              <thead>
                <tr>
                  <th scope="col">Championship week</th>
                  <th scope="col">Points</th>
                  <th scope="col">Calculation</th>
                </tr>
              </thead>
              <tbody>
                {championshipWeeks.map((item) => (
                  <tr key={str(item.week)}>
                    <td>Week {str(item.week)}</td>
                    <td>{str(item.points, "0")}</td>
                    <td>
                      {Array.isArray(standing.missing_weeks) &&
                      standing.missing_weeks.includes(item.week)
                        ? "Missing · zero points"
                        : item.counted
                          ? "Counted"
                          : "Discarded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <section className={s.section} aria-labelledby="cgl-public-player-stats">
        <div className={s.sectionHead}>
          <div>
            <div className={s.eyebrow}>Performance centre</div>
            <h2 id="cgl-public-player-stats">The standout numbers.</h2>
            <p>
              Only statistics supplied with verified, published CGL scorecards
              are shown.
            </p>
          </div>
          <Trophy size={23} />
        </div>
        <CglPerformanceHighlights results={seasonResults} personal />
      </section>

      <section
        className={s.section}
        id="league-scorecards"
        aria-labelledby="cgl-public-player-scorecards"
      >
        <div className={s.sectionHead}>
          <div>
            <div className={s.eyebrow}>Every shot has a story</div>
            <h2 id="cgl-public-player-scorecards">CGL rounds & scorecards</h2>
          </div>
          <ClipboardList size={23} />
        </div>
        {seasonResults.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption>Published CGL results for {profile.username}</caption>
              <thead>
                <tr>
                  {[
                    "Competition",
                    "Date",
                    "Gross",
                    "Net",
                    "Division position",
                    "Points",
                    "Scorecard",
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seasonResults.map((result) => (
                  <tr key={str(result.id)}>
                    <td>
                      {str(
                        result.week_name ??
                          profile.weeks.find(
                            (week) => week.id === result.week_id,
                          )?.name,
                        "CGL competition",
                      )}
                    </td>
                    <td>{date(result.played_at)}</td>
                    <td>{str(result.gross)}</td>
                    <td>{str(result.net)}</td>
                    <td>{str(result.position)}</td>
                    <td>{str(result.points)}</td>
                    <td>
                      {officialCard(result.scorecard_url) ? (
                        <button
                          className={s.smallButton}
                          onClick={() =>
                            setScorecardId(
                              scorecardId === result.id ? "" : str(result.id),
                            )
                          }
                          aria-expanded={scorecardId === result.id}
                          aria-controls="cgl-public-scorecard"
                        >
                          {scorecardId === result.id
                            ? "Close scorecard"
                            : "View scorecard"}
                        </button>
                      ) : (
                        "Not linked"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CglEmpty title="The first published CGL round is still ahead">
            Verified CGL results will appear here when the competition results
            are published. Statistics are never inferred from unrelated SGT
            rounds.
          </CglEmpty>
        )}
        {scorecard && officialCard(scorecard.scorecard_url) ? (
          <article
            className={s.panel}
            id="cgl-public-scorecard"
            style={{ marginTop: 22 }}
          >
            <div className={s.sectionHead}>
              <h3>{str(scorecard.week_name, "Official SGT scorecard")}</h3>
              <a
                className={s.textLink}
                href={scorecard.scorecard_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in SGT <ArrowUpRight size={14} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            <iframe
              src={scorecard.scorecard_url}
              title={`${profile.username} official CGL scorecard`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                width: "100%",
                height: 800,
                border: "1px solid #dbe4ea",
                borderRadius: 4,
              }}
            />
            <p className={s.fine}>
              Scroll inside the scorecard to see every hole. If SGT cannot load
              here, use Open in SGT.
            </p>
          </article>
        ) : null}
      </section>

      <section
        className={s.section}
        aria-labelledby="cgl-public-player-achievements"
      >
        <h2 id="cgl-public-player-achievements" style={{ marginBottom: 20 }}>
          Published achievements
        </h2>
        {prizes.length ? (
          <div className={s.grid3}>
            {prizes.map((prize) => (
              <article className={s.panel} key={str(prize.id)}>
                <Trophy size={20} />
                <h3 style={{ marginTop: 15 }}>
                  {str(prize.category).replaceAll("_", " ")}
                </h3>
                <p>
                  {str(
                    profile.seasons.find(
                      (season) => season.id === prize.season_id,
                    )?.name,
                    "CGL championship",
                  )}
                </p>
                <span className={s.badge}>{str(prize.state)}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className={s.muted}>
            Verified weekly and championship achievements will appear here after
            publication.
          </p>
        )}
      </section>
      <article className={s.panel}>
        <h2>Annual championship</h2>
        <p>
          {profile.annual?.status === "calculated"
            ? `${str(profile.annual.points)} points across approved season calculations.`
            : "The annual aggregation formula is awaiting CGS approval. No annual ranking has been assumed."}
        </p>
      </article>
    </section>
  );
}
