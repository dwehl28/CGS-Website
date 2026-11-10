"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Flag,
  Globe2,
  Layers3,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
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

const formats = [
  [
    "01",
    "Aggregate Championship",
    "Two nine-hole rounds, same course. Both net scores count.",
  ],
  [
    "02",
    "Redemption Championship",
    "Two nine-hole attempts, same course. Your best eligible score counts.",
  ],
  [
    "03",
    "World Tour Championship",
    "Two nine-hole rounds, different courses. Combined net score.",
  ],
  [
    "04",
    "Elements Championship",
    "Two nine-hole rounds, different courses and conditions. Combined net score.",
  ],
];
const faq = [
  [
    "Where can I play?",
    "At home or at any simulator facility running GSPro with the required SGT competition access. Australia is our starting point, and international players are welcome. Your simulator session and SGT access are separate from CGL membership.",
  ],
  [
    "Do I need an SGT account?",
    "Yes. Use your existing CGS account and link your SGT username and numeric SGT ID. CGS checks the link before treating scores or a handicap as verified. Never share your SGT password.",
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
    "You can submit a cancellation request in your membership centre. The proposed monthly and weekly policy takes effect at a published season boundary; annual membership ends at the paid term. These terms require CGS approval and legal review before live billing opens.",
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
          <ArrowRight size={14} />
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
          .filter((w) => w.results_published)
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
      ? rows(data.standings)
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
                : "Verified weekly results"}
            </caption>
            <thead>
              <tr>
                {[
                  ["position", "Pos"],
                  ["username", "Player"],
                  ["division", "Grade"],
                  ["handicap", "HCP"],
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
                  <td>{str(r.handicap)}</td>
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
                        Open <ArrowUpRight size={11} />
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
      detail: "One annual payment. Renews every 12 months.",
    },
    {
      id: "monthly",
      name: "Monthly",
      price_cents: 2995,
      interval: "/ month",
      detail: "Monthly payments. Proposed season commitment applies.",
    },
    {
      id: "weekly",
      name: "Weekly",
      price_cents: 895,
      interval: "/ week",
      detail: "Weekly payments. Proposed season commitment applies.",
    },
    {
      id: "casual_registration",
      name: "Casual",
      price_cents: 2900,
      interval: "registration / year",
      detail:
        "Plus $100 for each season you choose. Both are one-off payments.",
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
              {i === 0 ? (
                <span className={s.planLabel}>Annual membership</span>
              ) : null}
              <h3>{p.name}</h3>
              <div className={s.price}>
                {aud(price)} <small>{p.interval}</small>
              </div>
              <p>
                {p.id === "casual_registration"
                  ? `Plus ${aud(plans.find((plan) => plan.code === "casual_season")?.price_cents ?? 10000)} for each season you choose. Both are one-off payments.`
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
              <Link
                className={i === 0 ? s.primary : s.secondary}
                href={`/cgl/join?plan=${p.id}`}
              >
                Choose {p.name.toLowerCase()}
                <ArrowRight size={13} />
              </Link>
            </article>
          );
        })}
      </div>
      <p className={s.fine}>
        AUD. Proposed launch pricing, subject to CGS approval. Simulator hire
        and SGT access are separate. Your exact charge, renewal terms and
        cancellation date must be shown before payment. Live membership sales
        are not open.
      </p>
    </>
  );
}

function Calendar({ data }: { data: CglSnapshot }) {
  const seasons = rows(data.seasons);
  return (
    <>
      <div className={s.notice}>
        The inaugural launch is planned for March 2027. Exact dates, courses and
        entry deadlines are still to be confirmed.
      </div>
      <div className={s.schedule}>
        {(seasons.length
          ? seasons
          : formats.map(([n, name, description]) => ({
              id: n,
              name,
              description,
            }))
        ).map((se: CglRow, i) => (
          <article className={s.scheduleRow} key={str(se.id)}>
            <strong>{String(i + 1).padStart(2, "0")}</strong>
            <div>
              <h3>{str(se.name)}</h3>
              <p>
                {str(
                  se.description,
                  formats[i]?.[2] ?? "See the published season format.",
                )}
              </p>
              <p>
                {se.starts_at
                  ? `${date(se.starts_at)} — ${date(se.ends_at)}`
                  : "13 weeks · 3 qualifying + 10 championship"}
              </p>
            </div>
            <span className={s.badge}>{str(se.status, "Dates pending")}</span>
          </article>
        ))}
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
          "SGT is the source of your playing handicap. Players without an accepted established handicap need 54 eligible holes, with verification against SGT requirements. Qualification runs in the first three weeks.",
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
          "Tied golf scores use the configured stroke-index countback starting at index 1. Identical CTP distances use the earliest verified qualifying timestamp. Missing detail requires an admin review before a prize is confirmed.",
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

export default function CglPublicExperience({
  section = "home",
  children,
  previewData,
}: {
  section?: string;
  children?: ReactNode;
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
  const season =
    rows(data.seasons).find(
      (se) => se.status === "active" || se.status === "published",
    ) ?? rows(data.seasons)[0];
  if (section === "home")
    return (
      <div className={s.page}>
        <section className={s.hero}>
          <div className={s.heroContent}>
            <div className={s.eyebrow}>Crossodog Golf League · 2027</div>
            <h1>
              Your round.
              <br />
              Your rivals.
              <br />
              <span>Your clubhouse.</span>
            </h1>
            <p>
              A simulator league with something to play for. Follow your scores,
              celebrate the standouts and chase your division title — wherever
              you play GSPro.
            </p>
            <div className={s.actions}>
              <Link className={s.primary} href="/cgl/trial">
                Explore the trial league
                <ArrowRight size={15} />
              </Link>
              <Link className={s.secondary} href="/cgl/memberships">
                Find your membership
              </Link>
            </div>
          </div>
          <div className={s.heroAside}>
            <div className={s.seasonCard}>
              <div className={s.seasonTop}>
                <div>
                  <small>Inaugural season</small>
                  <h2>{str(season?.name, "The chase starts here.")}</h2>
                  <span className={s.status}>
                    {str(season?.status, "2027 season in preparation")}
                  </span>
                </div>
                <Image
                  src="/cgl/cgs-logo-official.png"
                  width={84}
                  height={84}
                  alt="Crossodog Golf Society bulldog"
                  priority
                />
              </div>
              <div className={s.seasonDetail}>
                <div>
                  <span>Planned launch</span>
                  <strong>
                    {season?.starts_at
                      ? date(season.starts_at)
                      : "March 2027 · TBC"}
                  </strong>
                </div>
                <div>
                  <span>Championship</span>
                  <strong>Best 8 of 10 weeks</strong>
                </div>
                <div>
                  <span>Divisions</span>
                  <strong>A Grade / B Grade</strong>
                </div>
                <div>
                  <span>Play anywhere</span>
                  <strong>GSPro + SGT</strong>
                </div>
              </div>
              <Link href="/cgl/calendar">
                Meet the four seasons
                <ArrowRight size={15} />
              </Link>
            </div>
            <p style={{ fontSize: 11, marginTop: 15 }}>
              Already testing with us? Your CGS account and linked SGT
              scorecards are in the trial hub.
            </p>
          </div>
        </section>
        <div className={s.formatBar}>
          {[
            [Globe2, "Any GSPro simulator", "At home or at a facility"],
            [Users, "Two handicap divisions", "A fair chase for your title"],
            [
              Layers3,
              "Four seasons, four formats",
              "A new challenge each season",
            ],
            [Wallet, "CGS Credits", "Earn them. Enjoy the rewards."],
          ].map(([Icon, title, sub]) => {
            const Mark = Icon as typeof Globe2;
            return (
              <div key={String(title)}>
                <Mark size={22} />
                <div>
                  <strong>{String(title)}</strong>
                  <span>{String(sub)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <section className={s.section}>
          <SectionHead
            label="The honours board"
            title="Great rounds deserve the spotlight."
            text="Three weekly prizes across the whole field. One prize per player. Full members earn double credits."
            href="/cgl/prizes"
            link="Prizes & rewards"
          />
          <WeeklyHonours data={data} />
        </section>
        <section className={s.section}>
          <SectionHead
            label="The championship"
            title="Follow the chase."
            text="Division standings, weekly net and gross scores, and direct access to each player's CGL history."
            href="/cgl/leaderboard"
            link="Full leaderboard"
          />
          <CglStandingsTable compact data={data} />
        </section>
        <section className={`${s.section} ${s.grid2}`}>
          <article className={`${s.panel} ${s.darkPanel}`}>
            <div className={s.eyebrow} style={{ color: "#93bdcf" }}>
              Made for your game
            </div>
            <h2 style={{ fontSize: 29 }}>
              Your numbers.
              <br />
              All in one place.
            </h2>
            <p>
              Scores, handicap, championship points and weekly achievements.
              Your player dashboard brings your CGL season together, with SGT
              scorecards one click away.
            </p>
            <div className={s.actions}>
              <Link href="/cgl/dashboard" className={s.primary}>
                Open your clubhouse
                <ArrowRight size={14} />
              </Link>
            </div>
          </article>
          <article className={s.panel}>
            <div className={s.eyebrow}>How it works</div>
            {[
              [
                "01",
                "Join CGS, link SGT",
                "One CGS account. Your verified SGT identity.",
              ],
              [
                "02",
                "Play the available rounds",
                "Check the fixture, choose your sim, meet the deadline.",
              ],
              [
                "03",
                "Follow every result",
                "Your division chase, personal stats and earned rewards.",
              ],
            ].map(([n, title, body]) => (
              <div className={s.step} key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </article>
        </section>
        {children ? <section className={s.section}>{children}</section> : null}
        <section className={s.section}>
          <SectionHead
            label="Find your way in"
            title="A plan for the way you play."
            href="/cgl/memberships"
            link="Membership details"
          />
          <CglPricing data={data} />
        </section>
      </div>
    );
  const titles: Record<string, [string, string, string]> = {
    memberships: [
      "Memberships",
      "Make CGL part of your week.",
      "Choose a full membership for all four seasons, or take the casual route and enter the seasons you want.",
    ],
    calendar: [
      "The 2027 calendar",
      "Four seasons. A full year to chase.",
      "Every season has three qualification weeks and ten championship weeks. Published dates and available fixtures will appear here.",
    ],
    leaderboard: [
      "Results & standings",
      "The chase, by the numbers.",
      "Browse verified weekly scores and follow the best-eight championship in each division.",
    ],
    competition: [
      "Current competition",
      "Your next round starts here.",
      "Published events will include the course, format, conditions, eligibility and closing time.",
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
          <div className={`${s.panel} ${s.section}`}>
            <h2>Before you confirm</h2>
            <p>
              Annual, monthly and weekly memberships renew automatically under
              the final approved terms. Casual registration lasts one year and
              is manually renewed; each casual season entry is a separate
              one-off purchase. Initial charges, any prorated amount, future
              payments and effective cancellation dates must be disclosed before
              payment.
            </p>
            <Link className={s.textLink} href="/cgl/terms">
              Review the draft policies
              <ArrowRight size={13} />
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
      {section === "competition" ? (
        <>
          <div className={s.schedule}>
            {rows(data.weeks)
              .filter((w) => w.status === "published" || w.status === "open")
              .map((w) => (
                <article className={s.scheduleRow} key={str(w.id)}>
                  <Flag />
                  <div>
                    <h3>
                      {str(w.name, `Championship week ${str(w.week_number)}`)}
                    </h3>
                    <p>
                      {str(w.course_name, "Course details in SGT")} · Closes{" "}
                      {date(w.closes_at, true)}
                    </p>
                  </div>
                  <Link className={s.smallButton} href="/cgl/dashboard">
                    Check eligibility
                    <ArrowRight size={13} />
                  </Link>
                </article>
              ))}
          </div>
          {!rows(data.weeks).some(
            (w) => w.status === "published" || w.status === "open",
          ) ? (
            <CglEmpty title="The next 2027 event is being prepared">
              No 2027 event is open yet. The separate SGT trial is available
              now, with official tournament and player scorecard views.
            </CglEmpty>
          ) : null}
          <div className={s.actions}>
            <Link className={s.primary} href="/cgl/trial">
              Open the trial competition
              <ArrowRight size={14} />
            </Link>
            <Link className={s.secondary} href="/cgl/calendar">
              Season calendar
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
              <ArrowRight size={14} />
            </Link>
          </div>
        </>
      ) : null}
      {section === "prizes" ? (
        <>
          <WeeklyHonours data={data} />
          <div className={`${s.grid2} ${s.section}`}>
            <article className={s.panel}>
              <Trophy size={25} />
              <h2 style={{ marginTop: 18 }}>Season champions</h2>
              <p>
                Proposed allocation: A Grade champion{" "}
                {aud(row(row(data.settings).prizes).a_cash_cents ?? 30000)}{" "}
                cash; B Grade champion{" "}
                {str(row(row(data.settings).prizes).b_credits, "300")} CGS
                Credits. Eligible casual entrants can win the same season prize
                as full members. Final published eligibility and prize terms
                apply.
              </p>
            </article>
            <article className={s.panel}>
              <Wallet size={25} />
              <h2 style={{ marginTop: 18 }}>The CGS Rewards Store</h2>
              <p>
                Spend credits on available CGS merchandise, equipment and
                sponsor rewards. Each item shows its credit price. Credits stay
                with your account after cancellation and expire 18 months from
                issue.
              </p>
              <div className={s.actions}>
                <Link
                  href="/cgl/dashboard?tab=rewards"
                  className={s.smallButton}
                >
                  View your rewards
                  <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          </div>
          <div className={s.notice}>
            Prizes are confirmed after results are reviewed and published.
            Weekly priority starts with net, then gross, then CTP. The published
            event rules control the final order. Cash prizes and final
            conditions require CGS approval before activation.
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
              <ArrowRight size={14} />
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
                "Your rounds, best-eight points, published achievements and rewards all come together in your CGS account.",
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
            <SectionHead title="Four ways to challenge your game" />
            <Calendar data={data} />
          </section>
          <div className={s.actions}>
            <Link href="/cgl/join" className={s.primary}>
              Join the clubhouse
              <ArrowRight size={14} />
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
