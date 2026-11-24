"use client";

import Image from "next/image";
import { CGL_CASH_PRIZE_CENTS } from "@/lib/cgl-season-one";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  Flag,
  Globe2,
  ShieldCheck,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  CglConditionsPanel,
  CglRoundSpotlight,
  CglSeasonFacts,
  CglSeasonTimeline,
  getCglFeatureWeek,
} from "./CglSeasonExperience";
import {
  aud,
  date,
  num,
  playerName,
  row,
  rows,
  str,
  useCglPublic,
  type CglRow,
  type CglSnapshot,
} from "./cgl-ui";
import s from "./Cgl2027.module.css";
const faq = [
  [
    "Where can I play?",
    "At home or at any simulator facility running GSPro with the required SGT competition access. Australia is our starting point, and international players are welcome. Your simulator session and SGT access are separate from CGL membership.",
  ],
  [
    "Do I need an SGT account?",
    "Yes, an SGT identity is required for tournament and score matching. A CGS website account is optional: enter your exact SGT username when purchasing, or link your SGT profile from a CGS account. Never share your SGT password.",
  ],
  [
    "Which scores count towards the championship?",
    "Each season has three qualification weeks followed by ten championship weeks. You earn points for your finish within your locked division. Your best eight weekly points totals count; missing weeks count as zero.",
  ],
  [
    "How do handicaps and divisions work?",
    "CGL uses verified SGT handicaps. A Grade is 9.9 or lower, including plus handicaps; B Grade is 10.0 or higher. Your division locks at championship start. A new player needs 54 eligible qualifying holes, subject to SGT verification.",
  ],
  [
    "Can I join after a season starts?",
    "Yes. Available events and entry eligibility depend on published deadlines, verified handicap and membership status. You will see any initial prorated payment before confirming a purchase.",
  ],
  [
    "How do CGS Credits work?",
    "Credits are awarded after verified results are published. Full members earn 20 for lowest net, 20 for lowest gross or 10 for CTP; casual entrants earn 10, 10 or 5. One weekly prize per player. Credits are not transferable or redeemable as cash and expire 18 months after issue.",
  ],
  [
    "Can I cancel my membership?",
    "Yes. Account holders can cancel a recurring membership from the member dashboard. If you purchased without an account, contact CGS using the purchase email and Square receipt. Cancellation stops the next renewal at the end of the period already paid for, and access remains active until that paid-through date. Casual Registration and the Season Pass are one-off purchases and do not automatically renew.",
  ],
  [
    "Are trial results part of the 2027 championship?",
    "The existing SGT trial is kept separately. Its accounts and linked scorecards remain accessible in the trial hub. Trial results are not automatically recalculated under the new 2027 rules.",
  ],
];

export function CglHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.heading}>
      <div className={s.eyebrow}>{label}</div>
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
export function CglEmpty({
  title = "The first scores are still to come",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <Flag size={25} />
      <h3>{title}</h3>
      <p>
        {children ??
          "Verified, published CGL results will appear here. You can follow the existing SGT trial in the meantime."}
      </p>
    </div>
  );
}
function SectionHead({
  label,
  title,
  text,
  href,
  link,
}: {
  label?: string;
  title: string;
  text?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className={s.sectionHead}>
      <div>
        {label ? <div className={s.eyebrow}>{label}</div> : null}
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {href ? (
        <Link className={s.textLink} href={href}>
          {link ?? "View all"}
        </Link>
      ) : null}
    </div>
  );
}

function WeeklyHonours({ data }: { data: CglSnapshot }) {
  const rewards = row(row(data.settings).rewards);
  const full = row(rewards.full),
    casual = row(rewards.casual);
  const publishedWeek = rows(data.weeks)
    .filter((w) => w.results_published)
    .sort((a, b) =>
      str(b.closes_at, "").localeCompare(str(a.closes_at, "")),
    )[0];
  const prizes = rows(data.prizes).filter(
    (p) =>
      (p.state === "awarded" || p.state === "claimed") &&
      p.week_id === publishedWeek?.id,
  );
  return (
    <div className={s.grid3}>
      {[
        ["Lowest net", "20 / 10 credits", Trophy],
        ["Lowest gross", "20 / 10 credits", Award],
        ["Closest to the pin", "10 / 5 credits", Target],
      ].map(([title, credits, Icon], i) => {
        const prize = prizes.find((p) =>
          str(p.category, "").includes(["net", "gross", "ctp"][i]),
        );
        const Mark = Icon as typeof Trophy;
        return (
          <article className={s.award} key={String(title)}>
            <div className={s.awardHeader}>
              <span>Weekly honour · 0{i + 1}</span>
              <Mark size={20} />
            </div>
            <h3>{String(title)}</h3>
            <p>
              {prize
                ? playerName(prize)
                : "The next name on the honours board could be yours."}
            </p>
            <div className={s.awardFooter}>
              <span>
                {prize ? "Published winner" : "Awaiting verified results"}
              </span>
              <strong>{`${str(full[["net", "gross", "ctp"][i]], String(credits).split(" / ")[0])} / ${str(casual[["net", "gross", "ctp"][i]], String(credits).split(" / ")[1].split(" ")[0])} credits`}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CglPerformanceHighlights({
  results,
  personal = false,
}: {
  results: CglRow[];
  personal?: boolean;
}) {
  const metrics = [
    {
      key: "longest_drive_metres",
      label: "Longest drive",
      unit: " m",
      low: false,
    },
    { key: "gir", label: "Greens in regulation", unit: "%", low: false },
    { key: "fir", label: "Fairways in regulation", unit: "%", low: false },
    { key: "total_putts", label: "Fewest putts", unit: "", low: true },
    {
      key: "putting_distance_metres",
      label: "Total distance putted",
      unit: " m",
      low: false,
    },
    { key: "birdies", label: "Most birdies", unit: "", low: false },
  ];
  return (
    <div className={s.grid3}>
      {metrics.map((metric) => {
        const eligible = results.filter(
          (r) => typeof row(r.stats)[metric.key] === "number",
        );
        const values = eligible.map((r) => num(row(r.stats)[metric.key]));
        const best = values.length
          ? metric.low
            ? Math.min(...values)
            : Math.max(...values)
          : null;
        const winners = eligible.filter(
          (r) => row(r.stats)[metric.key] === best,
        );
        return (
          <article className={s.metric} key={metric.key}>
            <span>{metric.label}</span>
            <strong>
              {best === null ? "—" : `${Number(best.toFixed(1))}${metric.unit}`}
            </strong>
            <small>
              {winners.length
                ? personal
                  ? "Best verified weekly result"
                  : winners.map(playerName).join(" · ")
                : "Awaiting verified SGT statistics"}
            </small>
          </article>
        );
      })}
    </div>
  );
}

export function CglStandingsTable({
  data,
  compact = false,
  initialMode = "points",
}: {
  data: CglSnapshot;
  compact?: boolean;
  initialMode?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [sort, setSort] = useState("position");
  const [ascending, setAscending] = useState(true);
  const seasons = rows(data.seasons);
  const weeks = rows(data.weeks).filter(
    (w) => !season || w.season_id === season,
  );
  const effectiveWeek =
    mode === "points"
      ? ""
      : week ||
        [...weeks]
          .filter((w) => w.results_published || w.review_until)
          .sort((a, b) =>
            str(b.closes_at, "").localeCompare(str(a.closes_at, "")),
          )[0]?.id;
  const weeklyScope = rows(data.results).filter(
    (r) =>
      (!effectiveWeek || r.week_id === effectiveWeek) &&
      (!season || r.season_id === season) &&
      (division === "all" || r.division === division),
  );
  const source: CglRow[] =
    mode === "points"
      ? rows(data.standings).map((record) => ({
          ...record,
          played:
            record.events_played ??
            record.rounds_played ??
            record.rounds_counted ??
            record.counted_weeks ??
            0,
          wins: record.wins ?? record.first ?? 0,
          top_three:
            record.top_three ?? record.top3 ?? record.podiums ?? 0,
        }))
      : weeklyScope.map((r) => ({
          ...r,
          position:
            1 +
            weeklyScope.filter((other) => num(other[mode]) < num(r[mode]))
              .length,
          weekly_tied:
            weeklyScope.filter((other) => other[mode] === r[mode]).length > 1,
        }));
  const filtered = source
    .filter(
      (r) =>
        (!query || playerName(r).toLowerCase().includes(query.toLowerCase())) &&
        (division === "all" ||
          str(r.division ?? r.grade ?? r.division_code, "").replace(
            " Grade",
            "",
          ) === division) &&
        (!season || r.season_id === season) &&
        (!effectiveWeek || r.week_id === effectiveWeek),
    )
    .sort((a, b) => {
      const key =
        sort === "score"
          ? mode
          : sort === "points"
            ? "total_points"
            : sort === "username"
              ? "sgt_username"
              : sort;
      const av = a[key] ?? (key === "position" ? a.rank : undefined);
      const bv = b[key] ?? (key === "position" ? b.rank : undefined);
      const comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : str(av, "").localeCompare(str(bv, ""));
      return ascending ? comparison : -comparison;
    });
  function sortBy(key: string) {
    if (sort === key) setAscending(!ascending);
    else {
      setSort(key);
      setAscending(key !== "points");
    }
  }
  const hasFilters = !!query || division !== "all" || !!week || !!season;
  return (
    <div>
      {!compact ? (
        <>
          <div className={s.tabs} role="tablist" aria-label="Leaderboard view">
            {[
              ["points", "Season points"],
              ["net", "Weekly net"],
              ["gross", "Weekly gross"],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={mode === key}
                onClick={() => {
                  setMode(key);
                  setWeek("");
                  setSort(key === "points" ? "position" : "score");
                  setAscending(true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={s.filters}>
            <label className={s.field}>
              Season
              <select
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setWeek("");
                }}
              >
                <option value="">All published seasons</option>
                {seasons.map((se) => (
                  <option key={str(se.id)} value={str(se.id)}>
                    {str(se.name)}
                  </option>
                ))}
              </select>
            </label>
            {mode !== "points" ? (
              <label className={s.field}>
                Competition week
                <select value={week} onChange={(e) => setWeek(e.target.value)}>
                  <option value="">Latest published competition</option>
                  {weeks.map((w) => (
                    <option key={str(w.id)} value={str(w.id)}>
                      {str(w.name, `Week ${str(w.week_number)}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={s.field}>
              Division
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                <option value="all">All divisions</option>
                <option value="A">A Grade</option>
                <option value="B">B Grade</option>
                {row(row(data.settings).divisions).c_grade_enabled === true ? (
                  <option value="C">C Grade</option>
                ) : null}
              </select>
            </label>
            <label className={s.field}>
              Find a player
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search SGT username"
              />
            </label>
          </div>
        </>
      ) : null}
      <div className={s.dataFreshness} role="status">
        <span>
          <CheckCircle2 size={15} aria-hidden="true" /> Verified SGT source
        </span>
        <span>Snapshot updated {date(data.updated_at, true)}</span>
        <span>
          {source.length
            ? "Published CGL standings"
            : "No official Season 1 standings published"}
        </span>
      </div>
      {mode !== "points" && weeks.some((item) => item.id === effectiveWeek && item.review_until) ? (
        <div className={s.notice}>
          Results are provisional. Review closes {date(weeks.find((item) => item.id === effectiveWeek)?.review_until, true)} Brisbane time.
          {" "}<Link className={s.textLink} href="/contact">Report a scoring issue</Link> with your SGT username, round and scorecard links. Points and credits are not final.
        </div>
      ) : null}
      {data.status === "loading" ? (
        <div className={s.empty} role="status">
          Loading published results…
        </div>
      ) : filtered.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption>
              {mode === "points"
                ? "Championship · best eight of ten · points earned within each division"
                : "Weekly net and gross results"}
            </caption>
            <thead>
              <tr>
                {[
                  ["position", "Pos"],
                  ["username", "Player"],
                  ["division", "Grade"],
                  ["handicap", "HCP"],
                  ...(mode === "points"
                    ? [
                        ["played", "Played"],
                        ["wins", "Wins"],
                        ["top_three", "Top 3"],
                      ]
                    : []),
                  [
                    mode === "points" ? "points" : "score",
                    mode === "points"
                      ? "Points"
                      : mode === "net"
                        ? "Net"
                        : "Gross",
                  ],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className={
                      ["handicap", "played", "wins", "top_three"].includes(key)
                        ? s.optionalColumn
                        : undefined
                    }
                    scope="col"
                    aria-sort={
                      sort === key
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button onClick={() => sortBy(key)}>
                      {label} {sort === key ? (ascending ? "↑" : "↓") : "↕"}
                    </button>
                  </th>
                ))}
                <th scope="col">
                  {mode === "points" ? "Counted" : "Scorecard"}
                </th>
              </tr>
            </thead>
            <tbody>
              {(compact ? filtered.slice(0, 5) : filtered).map((r, i) => (
                <tr key={str(r.id ?? r.member_id, String(i))}>
                  <td>
                    {mode !== "points" && r.weekly_tied ? "T" : ""}
                    {str(r.position ?? r.rank)}
                    {r.provisional ? <span className={s.badge}>Provisional</span> : null}
                    {r.pending ? (
                      <span className={s.badge}>Pending</span>
                    ) : null}
                  </td>
                  <td>
                    <Link
                      href={`${data.preview ? "/cgl/preview/2027/players" : "/cgl/players"}/${encodeURIComponent(playerName(r))}`}
                    >
                      {playerName(r)}
                    </Link>
                  </td>
                  <td>
                    <span className={s.badge}>
                      {str(r.division ?? r.division_code ?? r.grade)}
                    </span>
                  </td>
                  <td className={s.optionalColumn}>{str(r.handicap)}</td>
                  {mode === "points" ? (
                    <>
                      <td className={s.optionalColumn}>{str(r.played, "0")}</td>
                      <td className={s.optionalColumn}>{str(r.wins, "0")}</td>
                      <td className={s.optionalColumn}>{str(r.top_three, "0")}</td>
                    </>
                  ) : null}
                  <td>
                    <strong>
                      {str(
                        mode === "points"
                          ? (r.points ?? r.total_points)
                          : (r[mode] ?? r[`${mode}_score`]),
                      )}
                    </strong>
                  </td>
                  <td>
                    {mode === "points" ? (
                      `${str(r.rounds_counted ?? r.counted_weeks ?? r.counted_count, "0")} / 8`
                    ) : typeof r.scorecard_url === "string" &&
                      r.scorecard_url.startsWith(
                        "https://simulatorgolftour.com/",
                      ) ? (
                      <a
                        href={r.scorecard_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open <ExternalLink size={11} />
                      </a>
                    ) : (
                      "Pending link"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CglEmpty
          title={
            hasFilters
              ? "No players match these filters"
              : data.status === "error"
                ? "Results are temporarily unavailable"
                : "The 2027 standings start here"
          }
        >
          {hasFilters
            ? "Try another division or clear your search."
            : "No 2027 championship scores have been published. Trial scores are available in the trial hub."}
        </CglEmpty>
      )}
      {hasFilters ? (
        <button
          className={s.smallButton}
          style={{ marginTop: 14 }}
          onClick={() => {
            setQuery("");
            setDivision("all");
            setSeason("");
            setWeek("");
          }}
        >
          Clear filters
        </button>
      ) : null}
      <p className={s.fine}>
        Championship points are awarded within each division. Weekly prize
        categories compare the whole eligible field.
      </p>
    </div>
  );
}

function AnnualStandings({ data }: { data: CglSnapshot }) {
  const records = rows(data.annual);
  const years = [...new Set(records.map((r) => str(r.year, "2027")))]
    .sort()
    .reverse();
  const [selectedYear, setSelectedYear] = useState("");
  const year = selectedYear || years[0];
  const current = records
    .filter((r) => str(r.year, "2027") === year && r.status === "calculated")
    .sort((a, b) => num(b.points) - num(a.points));
  return (
    <>
      {years.length > 1 ? (
        <label className={s.field} style={{ maxWidth: 250, marginBottom: 20 }}>
          Year
          <select
            value={year}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      ) : null}
      {current.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption>Approved annual formula · {year}</caption>
            <thead>
              <tr>
                <th>Position</th>
                <th>Player</th>
                <th>Annual points</th>
              </tr>
            </thead>
            <tbody>
              {current.map((r) => (
                <tr key={playerName(r)}>
                  <td>
                    {1 +
                      current.filter((p) => num(p.points) > num(r.points))
                        .length}
                  </td>
                  <td>
                    <Link
                      href={`/cgl/players/${encodeURIComponent(playerName(r))}`}
                    >
                      {playerName(r)}
                    </Link>
                  </td>
                  <td>{str(r.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CglEmpty title="Annual formula awaiting approval">
          CGL will publish the calculation before an annual championship begins.
          Season points remain visible in the division standings.
        </CglEmpty>
      )}
    </>
  );
}

export function CglPricing({ data }: { data: CglSnapshot }) {
  const defaults = [
    {
      id: "annual",
      name: "Annual",
      price_cents: 24900,
      interval: "/ year",
      detail:
        "Charged when you join, then renews yearly on your purchase anniversary until cancelled.",
    },
    {
      id: "monthly",
      name: "Monthly",
      price_cents: 2995,
      interval: "/ month",
      detail:
        "Joins immediately. Your first payment may be prorated to the next first of the month, then $29.95 renews monthly on the first.",
    },
    {
      id: "weekly",
      name: "Weekly",
      price_cents: 895,
      interval: "/ week",
      detail:
        "Charged when you join, then renews every seven days until cancelled.",
    },
    {
      id: "casual_registration",
      name: "Casual",
      price_cents: 2900,
      interval: "registration / year",
      detail:
        "Purchase at any time. Add a separate $100 Season Pass only for a season you choose.",
    },
  ];
  const plans = rows(data.plans);
  return (
    <>
      <div className={s.plans}>
        {defaults.map((p, i) => {
          const actual = plans.find((a) => a.code === p.id || a.id === p.id);
          const price = actual?.price_cents ?? p.price_cents;
          return (
            <article
              key={p.id}
              className={`${s.plan} ${i === 0 ? s.featuredPlan : ""}`}
            >
              {i < 3 ? <span className={s.planLabel}>Open now</span> : null}
              <h3>{p.name}</h3>
              <div className={s.price}>
                {aud(price)} <small>{p.interval}</small>
              </div>
              <p>
                {p.id === "casual_registration"
                  ? `Purchase at any time. Add a separate ${aud(plans.find((plan) => plan.code === "casual_season")?.price_cents ?? 10000)} Season Pass only for a season you choose.`
                  : p.detail}
              </p>
              <ul>
                {(i === 3
                  ? [
                      "Choose your seasons",
                      "Championship prize eligibility",
                      "Standard weekly credits",
                      "No automatic renewal",
                    ]
                  : [
                      "All four seasons while active",
                      "Championship prize eligibility",
                      "Double weekly credits",
                      "Seasonal gift, when eligible",
                    ]
                ).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <Link className={s.primary} href={`/cgl/join?plan=${p.id}`}>
                Choose {p.name.toLowerCase()}
              </Link>
            </article>
          );
        })}
      </div>
      <p className={s.fine}>
        All prices and Square charges are in AUD. The $29 Casual Registration
        and all recurring memberships can be purchased at any time. Only the
        separate $100 Season Pass requires an open season. Recurring plans
        continue until cancelled. Simulator hire and SGT access are separate.
      </p>
    </>
  );
}

function MembershipComparison() {
  const benefits = [
    ["Access", "All four seasons", "All four seasons", "All four seasons", "Chosen seasons"],
    ["Billing", "A$249 yearly", "A$29.95 monthly", "A$8.95 weekly", "A$29 for 12 months"],
    ["Season entry", "Included while active", "Included while active", "Included while active", "A$100 per chosen season"],
    ["Weekly credits", "Double", "Double", "Double", "Standard"],
    ["Prize eligibility", "Included", "Included", "Included", "With an active Season Pass"],
    ["Renewal", "Yearly", "Monthly", "Every seven days", "No automatic renewal"],
  ];
  return (
    <div className={s.membershipCompareWrap}>
      <table className={s.membershipCompare}>
        <caption>Membership inclusions and payment cadence</caption>
        <thead>
          <tr>
            <th scope="col">Compare</th>
            <th scope="col">Annual</th>
            <th scope="col">Monthly</th>
            <th scope="col">Weekly</th>
            <th scope="col">Casual</th>
          </tr>
        </thead>
        <tbody>
          {benefits.map(([label, ...values]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {values.map((value, index) => (
                <td key={`${label}-${index}`}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembershipTeaser({ data }: { data: CglSnapshot }) {
  const plans = rows(data.plans);
  const options = [
    ["annual", "Annual", 24900, "Best value"],
    ["monthly", "Monthly", 2995, "Flexible"],
    ["weekly", "Weekly", 895, "Pay weekly"],
    ["casual_registration", "Casual", 2900, "No renewal"],
  ] as const;
  return (
    <div className={s.membershipTeaser}>
      <div className={s.membershipTeaserCopy}>
        <span>Memberships open</span>
        <h2>Join your way.</h2>
        <p>
          Start now with or without a CGS website account. Every Square charge
          is in AUD and your exact SGT username links you to competition data.
        </p>
        <Link className={s.primary} href="/cgl/memberships">
          Compare memberships
        </Link>
      </div>
      <div className={s.membershipOptions}>
        {options.map(([code, name, fallback, note]) => {
          const plan = plans.find((item) => item.code === code || item.id === code);
          return (
            <Link href={`/cgl/join?plan=${code}`} key={code}>
              <span>{note}</span>
              <strong>{name}</strong>
              <b>{aud(plan?.price_cents ?? fallback)}</b>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PlayerDirectory({ data }: { data: CglSnapshot }) {
  const players = rows(data.players)
    .filter((player) => {
      const status = str(player.status, "active").toLowerCase();
      return status !== "deleted" && status !== "hidden";
    })
    .sort((a, b) => playerName(a).localeCompare(playerName(b)));
  const standings = rows(data.standings);
  return players.length ? (
    <div className={s.playerDirectory}>
      {players.map((player) => {
        const name = playerName(player);
        const standing = standings.find(
          (record) =>
            record.member_id === player.id || playerName(record) === name,
        );
        return (
          <Link
            href={`/cgl/players/${encodeURIComponent(name)}`}
            key={str(player.id, name)}
          >
            <span className={s.playerInitial}>{name.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>
                {str(
                  standing?.division ?? player.division ?? player.grade,
                  "Division pending",
                )}
              </small>
            </span>
            <b>
              {standing
                ? `${str(standing.total_points ?? standing.points, "0")} pts`
                : "Profile"}
            </b>
          </Link>
        );
      })}
    </div>
  ) : (
    <CglEmpty title="The Season 1 field is forming">
      Public player profiles will appear here as registrations are approved and
      SGT identities are linked. A CGS website account is not required to enter.
    </CglEmpty>
  );
}

function Calendar({ data }: { data: CglSnapshot }) {
  return (
    <>
      <div className={s.calendarIntro}>
        <div>
          <span>Season 1 · Hidden Gems Tour</span>
          <h2>Thirteen weeks. One complete championship.</h2>
          <p>
            Qualification opens across three Mondays in February. The ten-round
            championship begins Monday 1 March 2027, with the best eight results
            counting towards the title.
          </p>
        </div>
        <div className={s.calendarDates}>
          <div>
            <span>Registration</span>
            <strong>1 February 2027</strong>
          </div>
          <div>
            <span>Qualification</span>
            <strong>8 February 2027</strong>
          </div>
          <div>
            <span>Championship</span>
            <strong>1 March 2027</strong>
          </div>
          <div>
            <span>Final round opens</span>
            <strong>3 May 2027</strong>
          </div>
        </div>
      </div>
      <CglSeasonFacts />
      <div className={s.section}>
        <CglSeasonTimeline data={data} />
      </div>
      <section className={`${s.section} ${s.seasonRoadmap}`}>
        <div className={s.seasonRoadmapIntro}>
          <span>2027 roadmap</span>
          <h2>One year. Four distinct seasons.</h2>
          <p>
            Season 1 is the only published competition plan. Later seasons are
            visible so players can understand the annual structure without us
            inventing dates, courses or formats before they are approved.
          </p>
        </div>
        <div className={s.seasonRoadmapGrid}>
          <article className={s.activeSeasonCard}>
            <span>Season 1 · Published plan</span>
            <strong>Hidden Gems Tour</strong>
            <p>Qualification from 8 February. Championship from 1 March.</p>
            <Link href="/cgl/competition">Open competition centre</Link>
          </article>
          {[2, 3, 4].map((seasonNumber) => (
            <article key={seasonNumber}>
              <span>Season {seasonNumber} · Planning</span>
              <strong>To be announced</strong>
              <p>Dates, courses and format have not been published.</p>
              <small>Registration is not yet open</small>
            </article>
          ))}
        </div>
      </section>
      <div className={s.notice}>
        Opening dates are confirmed for the Season 1 plan. Course pairs and
        conditions remain proposed until each SGT event is verified. Exact close
        times will come from the published event window rather than an assumed
        weekly deadline.
      </div>
    </>
  );
}

function Rules() {
  return (
    <div className={s.grid2}>
      {[
        [
          "Your handicap, verified",
          "SGT is the source of your playing handicap. Season 1 requires 18 verified holes for established handicaps, or 54 eligible holes for new handicaps. Use approved CGL or external SGT rounds. Late entrants may play verified rounds that remain open.",
        ],
        [
          "A division for your game",
          "A Grade is 9.9 or lower, including plus handicaps. B Grade is 10.0 or higher. Your division locks at championship start. C Grade remains inactive until CGS decides to introduce it.",
        ],
        [
          "Best eight of ten",
          "Points follow the standard PGA-style 500-point event table. Weekly finishing positions are calculated within each division. Your best eight of ten weekly points totals count; missing weeks score zero.",
        ],
        [
          "Countback and fair play",
          "Season 1 counts back from the hardest hole on Course B, then Course A. An exact points tie shares the occupied points. Weekly prize ties use verified SGT completion times where applicable. The designated par-three CTP uses the first tee shot only. Missing evidence goes to review.",
        ],
        [
          "One weekly prize per player",
          "Weekly net, gross and CTP prizes use the whole eligible field. The initial priority is net, then gross, then CTP; a player already awarded is skipped for the next category. The published event configuration controls the final order.",
        ],
        [
          "Annual rankings",
          "An annual championship is planned. Its aggregation formula is pending CGS approval. Annual rankings will remain unpublished until that formula is approved.",
        ],
      ].map(([title, body]) => (
        <article className={s.panel} key={title}>
          <ShieldCheck
            size={22}
            style={{ color: "#217b9e", marginBottom: 16 }}
          />
          <h2>{title}</h2>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}

function CglHome({ data }: { data: CglSnapshot }) {
  const feature = getCglFeatureWeek(data);
  return (
    <div className={s.page}>
      <section className={s.seasonHero}>
        <Image
          src="/cgl/cgl-hidden-gems-hero.webp"
          alt="Illustrative coastal golf course at sunrise"
          fill
          priority
          sizes="(max-width: 860px) 100vw, 1480px"
          className={s.seasonHeroImage}
        />
        <div className={s.seasonHeroShade} />
        <div className={s.seasonHeroContent}>
          <div className={s.seasonHeroBrand}>
            <Image
              src="/cgl/cgl-logo-official.jpg"
              width={1914}
              height={816}
              alt="Crossodog Golf League"
              priority
            />
          </div>
          <span className={s.heroKicker}>Season 1 · 2027</span>
          <h1>
            Hidden Gems
            <br />
            <em>Tour</em>
          </h1>
          <p>
            Two courses. Eighteen holes. One championship race. Discover
            lesser-known GSPro courses, compete in your division and follow the
            season from anywhere.
          </p>
          <div className={s.actions}>
            <Link className={s.primary} href="/cgl/join">
              Join CGL
            </Link>
            <Link className={s.heroSecondary} href="/cgl/competition">
              Explore Season 1
            </Link>
          </div>
          <div className={s.heroTrust}>
            <span>Account optional</span>
            <span>Square checkout in AUD</span>
            <span>Results powered by SGT</span>
          </div>
        </div>
        <aside className={s.heroRoundCard} aria-label="Season 1 format">
          <span>Every championship round</span>
          <div>
            <strong>9</strong>
            <small>Course A</small>
          </div>
          <b>+</b>
          <div>
            <strong>9</strong>
            <small>Course B</small>
          </div>
          <b>=</b>
          <div className={s.heroRoundTotal}>
            <strong>18</strong>
            <small>Combined holes</small>
          </div>
          <p>Best eight championship results count.</p>
        </aside>
        <small className={s.heroImageNote}>Illustrative CGL course imagery</small>
      </section>

      <CglSeasonFacts />

      <section className={s.section}>
        <SectionHead
          label="Play next"
          title="The round in front of you."
          text="Opening dates come from the confirmed Season 1 plan. Exact closing windows, courses and settings are clearly marked until verified in SGT."
        />
        <CglRoundSpotlight data={data} />
      </section>

      <section className={`${s.section} ${s.seasonOverview}`}>
        <div>
          <SectionHead
            label="Season path"
            title="Know what is coming."
            text="The next four scheduled releases, from qualification through the championship."
            href="/cgl/calendar"
            link="Full Season 1 calendar"
          />
          <CglSeasonTimeline data={data} limit={4} />
        </div>
        <aside className={s.howCard}>
          <span>How the chase works</span>
          <h2>Simple to enter. Worth following.</h2>
          {[
            ["Join", "Choose a membership or casual registration. A CGS account is optional."],
            ["Play", "Complete both nine-hole rounds in GSPro before the published close."],
            ["Follow", "SGT results flow into CGL standings, profiles and weekly honours."],
          ].map(([title, text], index) => (
            <div key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <p>
                <strong>{title}</strong>
                {text}
              </p>
            </div>
          ))}
          <Link href="/cgl/how-it-works">See the complete player journey</Link>
        </aside>
      </section>

      <section className={s.section}>
        <SectionHead
          label="The championship"
          title="Two divisions. One live chase."
          text="Published A and B Grade standings update from verified results. No placeholder scores or fictional players are shown."
          href="/cgl/leaderboard"
          link="Open full leaderboard"
        />
        <div className={s.standingsFrame}>
          <div className={s.divisionLegend}>
            <span>A Grade · 9.9 and lower</span>
            <span>B Grade · 10.0 and higher</span>
          </div>
          <CglStandingsTable compact data={data} />
        </div>
      </section>

      <section className={s.section}>
        <SectionHead
          label="Weekly honours"
          title="Every great round has a story."
          text="Lowest net, lowest gross and closest to the pin are verified before credits are awarded."
          href="/cgl/prizes"
          link="See prizes and rewards"
        />
        <WeeklyHonours data={data} />
      </section>

      <section className={s.section}>
        <MembershipTeaser data={data} />
      </section>

      <section className={s.presenterBand}>
        <div>
          <span>Presented by Crossodog Golf Society</span>
          <h2>Built for golfers who want more from every round.</h2>
          <p>
            CGL brings the competition, stories and rivalries of the society to
            GSPro players wherever they choose to play.
          </p>
          <Link href="/contact">Partner with CGL</Link>
        </div>
        <Image
          src="/cgl/cgs-logo-official.png"
          width={640}
          height={640}
          alt="Crossodog Golf Society"
        />
      </section>

      {data.status === "error" ? (
        <p className={`${s.notice} ${s.error}`} role="alert">
          {str(data.message)} The confirmed Season 1 schedule remains available
          while the live feed reconnects.
        </p>
      ) : null}

      <span className={s.visuallyHidden}>
        Featured competition: {feature.name}, opening {feature.openingLabel}.
      </span>
    </div>
  );
}

export default function CglPublicExperience({
  section = "home",
  previewData,
}: {
  section?: string;
  previewData?: CglSnapshot;
}) {
  const remoteData = useCglPublic(!previewData);
  const data = previewData ?? remoteData;
  const latestPublishedWeek = rows(data.weeks)
    .filter((w) => w.results_published)
    .sort((a, b) =>
      str(b.closes_at, "").localeCompare(str(a.closes_at, "")),
    )[0];
  const weeklyResults = rows(data.results).filter(
    (r) => r.week_id === latestPublishedWeek?.id,
  );
  const featureWeek = getCglFeatureWeek(data);
  const snapshotAt = Date.parse(str(data.updated_at,""));
  const openWeeks = rows(data.weeks).filter((week) => ["published","open"].includes(str(week.status)) &&
    Date.parse(str(week.opens_at)) <= snapshotAt && Date.parse(str(week.closes_at)) + 1000 > snapshotAt);
  if (section === "home") return <CglHome data={data} />;
  const titles: Record<string, [string, string, string]> = {
    memberships: [
      "Memberships",
      "Make CGL part of your week.",
      "Choose a full membership for all four seasons, or take the casual route and enter the seasons you want.",
    ],
    calendar: [
      "Season 1 · 2027",
      "The Hidden Gems Tour calendar.",
      "Three qualification weeks lead into ten championship rounds. Every round combines nine holes from two different courses.",
    ],
    leaderboard: [
      "Results & standings",
      "The chase, by the numbers.",
      "Browse verified weekly scores and follow the best-eight championship in each division.",
    ],
    competition: [
      "Competition centre",
      "Everything for your next round.",
      "Courses, opening dates, conditions, eligibility and live results in one place. Unverified details are labelled rather than guessed.",
    ],
    annual: [
      "Annual championship",
      "The bigger picture.",
      "Season titles are the first step. The annual ranking formula is awaiting approval before rankings can be published.",
    ],
    prizes: [
      "Prizes & rewards",
      "Play for more than a number.",
      "Weekly achievements across the field. Season champions in each division. CGS Credits to spend on eligible rewards.",
    ],
    players: [
      "CGL players",
      "The people behind the scores.",
      "Browse approved public profiles, follow division positions and open each player's verified CGL history.",
    ],
    rules: [
      "Rules & handicaps",
      "A clear game. A fair competition.",
      "The 2027 competition framework. Final membership, prize and competition terms require CGS approval before launch.",
    ],
    archive: [
      "Results archive",
      "Every season has a story.",
      "Completed championships will stay available here, with player histories and verified results.",
    ],
    faq: [
      "Good to know",
      "A few things before you tee off.",
      "How to join, where to play and what counts towards your season.",
    ],
    "how-it-works": [
      "How CGL works",
      "From your sim to the standings.",
      "Play on GSPro at home or at a facility. Follow the whole CGL season here at Crossodog.",
    ],
  };
  const [label, title, intro] = titles[section] ?? titles.rules;
  return (
    <div className={s.page}>
      <CglHeading label={label} title={title}>
        {intro}
      </CglHeading>
      {section === "memberships" ? (
        <>
          <CglPricing data={data} />
          <section className={s.section}>
            <SectionHead
              label="Compare plans"
              title="Choose the access that fits your season."
              text="Memberships and Casual Registration are separate from Season 1 entry. A website account is optional at checkout, and all charges are shown in AUD before payment."
            />
            <MembershipComparison />
          </section>
          <div className={`${s.panel} ${s.section}`}>
            <h2>Before you confirm</h2>
            <p>
              Casual Registration is a $29 one-off AUD payment for 12 months
              and does not automatically renew. It is not tied to one season.
              Annual, monthly and weekly memberships renew automatically at the
              disclosed cadence until cancelled from the member dashboard or,
              for an account-free purchase, by contacting CGS.
            </p>
            <Link className={s.textLink} href="/cgl/terms">
              Review pricing and policy status
            </Link>
          </div>
        </>
      ) : null}
      {section === "calendar" ? <Calendar data={data} /> : null}
      {section === "leaderboard" ? (
        <>
          <CglStandingsTable data={data} />
          <section className={s.section}>
            <SectionHead title="This week's honours" />
            <WeeklyHonours data={data} />
          </section>
          <section className={s.section}>
            <SectionHead
              title="The standout stats"
              text="Best verified statistics from the latest published competition. These achievements are separate from weekly credit prizes."
            />
            <CglPerformanceHighlights results={weeklyResults} />
          </section>
        </>
      ) : null}
      {section === "players" ? (
        <>
          <div className={s.playerDirectoryIntro}>
            <div>
              <strong>{rows(data.players).length}</strong>
              <span>public player profiles</span>
            </div>
            <p>
              Profiles only use approved CGL and SGT competition information.
              Purchase can be completed without an account; players can link an
              optional CGS account later.
            </p>
          </div>
          <PlayerDirectory data={data} />
        </>
      ) : null}
      {section === "competition" ? (
        <>
          <CglRoundSpotlight data={data} />
          {openWeeks.length > 1 ? <section className={s.section}>
            <SectionHead title="All open rounds" text="Championship windows overlap. Play any open round you are eligible for and enrolled in." />
            <div className={s.grid3}>{openWeeks.map((week) => <article className={s.panel} key={str(week.id)}>
              <h3>{str(week.name)}</h3><p>{str(week.course_name)} / {str(week.second_course_name)}</p><p>Closes {date(week.closes_at,true)} Brisbane time</p>
            </article>)}</div>
          </section> : null}
          <nav className={s.competitionSubnav} aria-label="Competition sections">
            <a href="#round-format">Round format</a>
            <a href="#course-conditions">Course & conditions</a>
            <a href="#player-results">Player results</a>
            <a href="#weekly-honours">Weekly honours</a>
            <Link href="/cgl/rules">Rules</Link>
          </nav>
          <div id="round-format" className={`${s.grid2} ${s.section}`}>
            <article className={s.panel}>
              <div className={s.eyebrow}>Round format</div>
              <h2>Two nines become one result.</h2>
              <p>
                Complete nine holes on each published course. Your two eligible
                net scores combine into one 18-hole competition result for the
                week.
              </p>
              <div className={s.miniFormat}>
                <span>Course A</span><strong>9</strong><b>+</b>
                <span>Course B</span><strong>9</strong><b>=</b>
                <span>Weekly result</span><strong>18</strong>
              </div>
            </article>
            <article className={`${s.panel} ${s.entryChecklist}`}>
              <div className={s.eyebrow}>Before you play</div>
              <h2>Ready for {featureWeek.name}?</h2>
              <ul>
                <li>Use the exact SGT username linked to your CGL entry.</li>
                <li>Confirm both published courses and competition settings.</li>
                <li>Finish both rounds before the published close time.</li>
                <li>Check your scorecard and report any issue promptly.</li>
              </ul>
              <div className={s.actions}>
                <Link className={s.primary} href="/cgl/join">
                  Enter CGL
                </Link>
                <Link className={s.secondary} href="/cgl/dashboard">
                  Check my eligibility
                </Link>
              </div>
            </article>
          </div>
          <section id="course-conditions" className={s.section}>
            <SectionHead
              label="Course setup"
              title="Conditions at a glance."
              text="Pending settings are deliberately left pending until the corresponding SGT event is verified."
            />
            <CglConditionsPanel week={featureWeek} />
          </section>
          <section className={s.section}>
            <SectionHead
              label="Coming up"
              title="The next rounds."
              text="Course selections stay marked as proposed until the corresponding SGT event is verified."
              href="/cgl/calendar"
              link="Full season calendar"
            />
            <CglSeasonTimeline data={data} limit={5} />
          </section>
          <section id="player-results" className={s.section}>
            <SectionHead
              label="Results"
              title="Verified player scores."
              text="Switch between weekly net, weekly gross and championship points. Official scorecard links appear only when supplied by SGT."
              href="/cgl/leaderboard"
              link="Full leaderboard"
            />
            <CglStandingsTable data={data} initialMode="net" />
          </section>
          <section id="weekly-honours" className={s.section}>
            <SectionHead
              label="Weekly honours"
              title="The performances that earn the spotlight."
              href="/cgl/prizes"
              link="Prize details"
            />
            <WeeklyHonours data={data} />
          </section>
          <div className={s.actions}>
            <Link className={s.primary} href="/cgl/leaderboard">
              Follow live standings
            </Link>
            <Link className={s.secondary} href="/cgl/rules">
              Competition rules
            </Link>
          </div>
        </>
      ) : null}
      {section === "annual" ? (
        <>
          <AnnualStandings data={data} />
          <div className={s.actions}>
            <Link className={s.secondary} href="/cgl/leaderboard">
              Division standings
            </Link>
          </div>
        </>
      ) : null}
      {section === "prizes" ? (
        <>
          <WeeklyHonours data={data} />
          <div className={`${s.prizeSchedule} ${s.section}`}>
            {(["seasonal", "annual"] as const).flatMap((period) => (["A","B"] as const).map((division) => {
              const prize = CGL_CASH_PRIZE_CENTS[period][division];
              return <article key={`${period}-${division}`}>
                <span>{period === "seasonal" ? "Seasonal" : "Annual"} championship</span>
                <h2>{division} Grade</h2>
                <div><small>Champion</small><strong>{aud(prize.champion)}</strong></div>
                <div><small>Runner-up</small><strong>{aud(prize.runner_up)}</strong></div>
              </article>;
            }))}
          </div>
          <div className={`${s.grid2} ${s.section}`}>
            <article className={s.panel}>
              <Trophy size={25} />
              <h2 style={{ marginTop: 18 }}>Championship prize eligibility</h2>
              <p>
                Eligible full members and casual Season Pass entrants compete
                for the same division cash prizes. Results, membership status
                and competition integrity checks are reviewed before winners
                are confirmed.
              </p>
            </article>
            <article className={s.panel}>
              <Wallet size={25} />
              <h2 style={{ marginTop: 18 }}>The CGS Rewards Store</h2>
              <p>
                Spend credits on available CGS merchandise, equipment and
                sponsor rewards. Each item shows its credit price. Credits stay
                with your participant record after cancellation and expire 18
                months from issue. A CGS account is required only to redeem them
                through the private dashboard.
              </p>
              <div className={s.actions}>
                <Link
                  href="/cgl/dashboard?tab=rewards"
                  className={s.smallButton}
                >
                  View your rewards
                </Link>
              </div>
            </article>
          </div>
          <section className={`${s.section} ${s.creditExplainer}`}>
            <div>
              <span>CGS Credits</span>
              <h2>Rewards with a clear value.</h2>
              <p>
                Credits are issued as whole numbers and can be redeemed against
                eligible items in the CGS Rewards Store.
              </p>
            </div>
            <dl>
              <div><dt>Value</dt><dd>2 credits = A$1</dd></div>
              <div><dt>Expiry</dt><dd>18 months from issue</dd></div>
              <div><dt>Ownership</dt><dd>Not transferable or redeemable for cash</dd></div>
              <div><dt>Offers</dt><dd>Cannot be stacked unless explicitly stated</dd></div>
            </dl>
          </section>
          <div className={s.notice}>
            Weekly priority is lowest net, then lowest gross, then closest to the pin. Credits are held through results review. Season cash prizes are paid manually by bank transfer, targeting 14 calendar days after the final results are confirmed.
          </div>
        </>
      ) : null}
      {section === "rules" ? <Rules /> : null}
      {section === "archive" ? (
        <>
          {rows(data.seasons).some((se) => se.status === "archived") ? (
            <Calendar
              data={{
                ...data,
                seasons: rows(data.seasons).filter(
                  (se) => se.status === "archived",
                ),
              }}
            />
          ) : (
            <CglEmpty title="The first chapter is still ahead">
              Completed 2027 seasons will appear here. Existing trial results
              and scorecard links are preserved separately.
            </CglEmpty>
          )}
          <div className={s.actions}>
            <Link className={s.secondary} href="/cgl/trial">
              View trial results
            </Link>
            <Link className={s.textLink} href="/cgl/preview/2027">
              2027 presentation preview
            </Link>
          </div>
        </>
      ) : null}
      {section === "faq" ? (
        <div className={`${s.panel} ${s.faq}`}>
          {faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      ) : null}
      {section === "how-it-works" ? (
        <>
          <div className={s.grid3}>
            {[
              [
                Globe2,
                "Play where it suits you",
                "Any compatible GSPro simulator, at home or at a venue. Check the event's published course and settings before starting.",
              ],
              [
                ShieldCheck,
                "Compete in your division",
                "Link your SGT identity and verify your handicap. A/B division assignments lock for the championship.",
              ],
              [
                CheckCircle2,
                "Keep track of everything",
                "Live public standings work without a CGS account. An optional account adds a private dashboard for rounds, rewards and billing.",
              ],
            ].map(([Icon, t, b]) => {
              const Mark = Icon as typeof Globe2;
              return (
                <article key={String(t)} className={s.panel}>
                  <Mark style={{ color: "#197c9f", marginBottom: 20 }} />
                  <h2>{String(t)}</h2>
                  <p>{String(b)}</p>
                </article>
              );
            })}
          </div>
          <section className={s.section}>
            <SectionHead
              title="The Season 1 journey"
              text="Confirmed opening dates, with proposed course pairs clearly labelled until SGT verification."
            />
            <Calendar data={data} />
          </section>
          <div className={s.actions}>
            <Link href="/cgl/join" className={s.primary}>
              Join the clubhouse
            </Link>
            <Link href="/cgl/rules" className={s.secondary}>
              Read the rules
            </Link>
          </div>
        </>
      ) : null}
      {data.status === "error" ? (
        <p className={`${s.notice} ${s.error}`} role="alert">
          {str(data.message)}
        </p>
      ) : null}
    </div>
  );
}
