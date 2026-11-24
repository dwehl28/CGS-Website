import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flag,
  Gauge,
  MapPin,
} from "lucide-react";

import {
  CGL_SEASON_ONE_PLAN,
  CGL_QUALIFIER_SGT_EVENTS,
  CGL_QUALIFIER_SGT_LISTED_SETTINGS,
  formatCglPlanDate,
  type CglRoundProposal,
} from "@/lib/cgl-season-one";
import { date, row, rows, str, type CglRow, type CglSnapshot } from "./cgl-ui";
import styles from "./CglSeasonExperience.module.css";

export type CglDisplayWeek = {
  id: string;
  name: string;
  phase: "qualification" | "championship";
  phaseRound: number;
  weekNumber: number;
  opensAt: string | null;
  closesAt: string | null;
  openingLabel: string;
  closingLabel: string;
  courseA: string;
  courseB: string;
  par?: number;
  eventId?: string;
  status: string;
  conditions: CglRow;
  proposed: boolean;
  entrantCount: number | null;
  completedCount: number | null;
};

function proposalWeek(round: CglRoundProposal): CglDisplayWeek {
  return {
    id: `season-one-${round.weekNumber}`,
    name:
      round.phase === "qualification"
        ? `Qualification ${round.phaseRound}`
        : `Hidden Gems Round ${round.phaseRound}`,
    phase: round.phase,
    phaseRound: round.phaseRound,
    weekNumber: round.weekNumber,
    opensAt: `${round.openingDate}T00:00:00+10:00`,
    closesAt: null,
    openingLabel: `${formatCglPlanDate(round.openingDate)}${round.phase === "qualification" ? ", 12:00 am AEST (time proposed)" : ""}`,
    closingLabel: round.closingDate ? `Proposed close: ${formatCglPlanDate(round.closingDate, true)}, 11:59:59 pm AEST` : "Closing window to be published",
    courseA: round.courses[0].name,
    courseB: round.courses[1]?.name ?? "",
    par: round.courses[0].par,
    eventId: round.phase === "qualification" ? CGL_QUALIFIER_SGT_EVENTS[round.phaseRound - 1] : undefined,
    status: "scheduled",
    conditions: (round.conditions ?? {}) as CglRow,
    proposed: true,
    entrantCount: null,
    completedCount: null,
  };
}

function realWeek(week: CglRow): CglDisplayWeek {
  const config = row(week.config);
  const phase = str(week.phase, "championship") === "qualification"
    ? "qualification"
    : "championship";
  const phaseRound = Number(
    week.championship_week ?? config.phase_round ?? week.week_number ?? 1,
  );
  return {
    id: str(week.id),
    name: str(
      week.name,
      phase === "qualification"
        ? `Qualification ${phaseRound}`
        : `Hidden Gems Round ${phaseRound}`,
    ),
    phase,
    phaseRound,
    weekNumber: Number(week.week_number ?? 1),
    opensAt: typeof week.opens_at === "string" ? week.opens_at : null,
    closesAt: typeof week.closes_at === "string" ? week.closes_at : null,
    openingLabel: date(week.opens_at, phase === "qualification"),
    closingLabel: week.closes_at
      ? `Closes ${date(week.closes_at, true)}`
      : "Closing window to be published",
    courseA: str(week.course_name, str(row(config.course_a).name, "Course A")),
    courseB: str(
      week.second_course_name,
      str(row(config.course_b).name, "Course B"),
    ),
    par: Number(row(week.course_a).par) || undefined,
    eventId: /^\d+$/.test(str(week.sgt_tournament_id,"")) && row(week.course_a).segment === "full_18" ? str(week.sgt_tournament_id) : undefined,
    status: str(week.status, "scheduled"),
    conditions: row(week.conditions),
    proposed:
      config.approval_state === "proposal" ||
      config.course_verification === "required",
    entrantCount:
      typeof week.entrant_count === "number" ? week.entrant_count : null,
    completedCount:
      typeof week.completed_count === "number" ? week.completed_count : null,
  };
}

export function getCglDisplayWeeks(data: CglSnapshot): CglDisplayWeek[] {
  const officialSeasonIds = new Set(
    rows(data.seasons)
      .filter((season) => {
        return (Number(season.year) === 2027 && Number(season.season_number) === 1) || str(season.slug) === CGL_SEASON_ONE_PLAN.slug;
      })
      .map((season) => str(season.id)),
  );
  const configured = rows(data.weeks)
    .filter((week) => officialSeasonIds.has(str(week.season_id)) && (week.phase!=="qualification" || row(week.course_a).segment==="full_18"))
    .map(realWeek)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const byNumber = new Map(configured.map((week) => [week.weekNumber,week]));
  return CGL_SEASON_ONE_PLAN.rounds.map((round) => byNumber.get(round.weekNumber) ?? proposalWeek(round));
}

export function getCglFeatureWeek(data: CglSnapshot): CglDisplayWeek {
  const weeks = getCglDisplayWeeks(data);
  const now = Date.now();
  return (
    weeks.find(
      (week) =>
        (["open", "live", "published"].includes(week.status.toLowerCase()) && week.opensAt &&
          Date.parse(week.opensAt) <= now &&
          week.closesAt &&
          Date.parse(week.closesAt)+1000 > now),
    ) ??
    weeks.find((week) => week.opensAt && Date.parse(week.opensAt) > now) ??
    weeks.at(-1)!
  );
}

export function CglStatusBadge({
  status,
  proposed = false,
}: {
  status: string;
  proposed?: boolean;
}) {
  const normalized = status.toLowerCase();
  const live = normalized === "open" || normalized === "live";
  return (
    <span className={`${styles.status} ${live ? styles.statusLive : ""}`}>
      <CircleDot size={13} aria-hidden="true" />
      {live ? "Open for play" : proposed ? "Opening date confirmed" : str(status)}
    </span>
  );
}

function conditionsSummary(conditions: CglRow) {
  const values = [
    conditions.wind,
    conditions.teeCategory ?? conditions.tee_category,
    conditions.greenSpeed
      ? `Stimp ${conditions.greenSpeed}`
      : conditions.green_speed
        ? `Stimp ${conditions.green_speed}`
        : null,
  ].filter(Boolean);
  return values.length ? values.map((value) => String(value)).join(" · ") : null;
}

export function CglCoursePair({
  week,
  compact = false,
}: {
  week: CglDisplayWeek;
  compact?: boolean;
}) {
  const conditions = conditionsSummary(week.conditions);
  if (week.phase === "qualification") return <div className={styles.qualifierCourse}>
    <span>Individual stroke play · 18 holes{week.par ? ` · Par ${week.par}` : ""}</span>
    <strong>{week.courseA}</strong>
    {!compact && conditions ? <p>{conditions}</p> : null}
  </div>;
  return (
    <div className={`${styles.coursePair} ${compact ? styles.coursePairCompact : ""}`}>
      <article>
        <span>Course A · 9 holes</span>
        <strong>{week.courseA}</strong>
      </article>
      <div className={styles.plus} aria-label="plus">
        +
      </div>
      <article>
        <span>Course B · 9 holes</span>
        <strong>{week.courseB}</strong>
      </article>
      {!compact ? (
        <p>
          <Gauge size={15} aria-hidden="true" />
          {conditions ?? "18-hole combined net score"}
        </p>
      ) : null}
    </div>
  );
}

export function CglRoundSpotlight({ data }: { data: CglSnapshot }) {
  const week = getCglFeatureWeek(data);
  const weekResults = rows(data.results).filter(
    (result) => result.week_id === week.id,
  );
  const entrantCount =
    week.entrantCount ??
    (weekResults.length
      ? new Set(weekResults.map((result) => str(result.member_id ?? result.id))).size
      : null);
  const completedCount =
    week.completedCount ??
    weekResults.filter(
      (result) =>
        result.status === "verified" ||
        result.status === "published" ||
        result.verified === true,
    ).length;
  return (
    <section className={styles.spotlight} aria-labelledby="cgl-feature-round">
      <div className={styles.spotlightTop}>
        <div>
          <span className={styles.kicker}>Current / next competition</span>
          <h2 id="cgl-feature-round">{week.name}</h2>
        </div>
        <CglStatusBadge status={week.status} proposed={week.proposed} />
      </div>
      <div className={styles.meta}>
        <span>
          <CalendarDays size={17} aria-hidden="true" /> Opens {week.openingLabel}
        </span>
        <span>
          <Clock3 size={17} aria-hidden="true" /> {week.closingLabel}
        </span>
        <span>
          <MapPin size={17} aria-hidden="true" /> Play on GSPro via SGT
        </span>
      </div>
      <CglCoursePair week={week} />
      <div className={styles.roundPulse}>
        <div>
          <span>Verified entrants</span>
          <strong>{entrantCount ?? "Not published"}</strong>
        </div>
        <div>
          <span>Completed results</span>
          <strong>{completedCount || "None yet"}</strong>
        </div>
        <div>
          <span>Result status</span>
          <strong>{weekResults.length ? "Provisional" : "Upcoming"}</strong>
        </div>
      </div>
      {week.proposed ? (
        <p className={styles.disclosure}>
          The course setup and exact play window need SGT verification and CGL approval before this fixture opens.
        </p>
      ) : null}
      <div className={styles.actions}>
        <Link href="/cgl/competition" className={styles.primaryAction}>
          Competition details
        </Link>
        <Link href="/cgl/leaderboard" className={styles.secondaryAction}>
          View standings
        </Link>
      </div>
    </section>
  );
}

export function CglConditionsPanel({ week }: { week: CglDisplayWeek }) {
  const conditions = week.conditions;
  const items = [
    ["Wind", str(conditions.wind, "Pending")],
    [
      "Fairways",
      str(conditions.fairwayFirmness ?? conditions.fairway_firmness, "Pending"),
    ],
    [
      "Greens",
      str(conditions.greenFirmness ?? conditions.green_firmness, "Pending"),
    ],
    [
      "Green speed",
      conditions.greenSpeed || conditions.green_speed
        ? `Stimp ${str(conditions.greenSpeed ?? conditions.green_speed)}`
        : "Pending",
    ],
    [
      "Tee category",
      str(conditions.teeCategory ?? conditions.tee_category, "Pending"),
    ],
    [
      "Pins / CTP",
      str(conditions.pins ?? conditions.ctp_hole, "Published with event"),
    ],
  ];
  return (
    <div className={styles.conditions}>
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <p>
        {week.proposed
          ? "Proposed settings only. Confirm every value in the published SGT event before playing."
          : "Settings shown from the published CGL competition configuration."}
      </p>
    </div>
  );
}

export function CglSeasonTimeline({
  data,
  limit,
  includeQualification = true,
}: {
  data: CglSnapshot;
  limit?: number;
  includeQualification?: boolean;
}) {
  const feature = getCglFeatureWeek(data);
  const source = getCglDisplayWeeks(data).filter(
    (week) => includeQualification || week.phase === "championship",
  );
  const start = limit
    ? Math.max(0, source.findIndex((week) => week.id === feature.id))
    : 0;
  const weeks = limit ? source.slice(start, start + limit) : source;

  return (
    <div className={styles.timeline}>
      {weeks.map((week) => (
        <article
          className={`${styles.timelineRow} ${week.id === feature.id ? styles.timelineFeatured : ""}`}
          key={week.id}
        >
          <div className={styles.roundMark}>
            <span>{week.phase === "qualification" ? "Q" : "R"}</span>
            <strong>{week.phaseRound}</strong>
          </div>
          <div className={styles.timelineCopy}>
            <div>
              <span>{week.openingLabel}</span>
              <h3>{week.name}</h3>
            </div>
            <p>{week.courseA}{week.phase === "championship" ? <> <b>+</b> {week.courseB}</> : <> · 18 holes</>}</p>
            {limit == null ? <p>{week.closingLabel}</p> : null}
          </div>
          <div className={styles.timelineStatus}>
            {week.proposed ? "Courses proposed" : str(week.status)}
          </div>
        </article>
      ))}
    </div>
  );
}

export function CglQualificationCards({ data }: { data: CglSnapshot }) {
  const qualifiers = getCglDisplayWeeks(data).filter((week) => week.phase === "qualification");
  const now = Date.parse(str(data.updated_at,""));
  return <section className={styles.qualifierSection} aria-labelledby="qualifier-title">
    <div className={styles.qualifierIntro}>
      <span>Qualification · February 2027</span>
      <h2 id="qualifier-title">THE ROAD TO SEASON 1</h2>
      <p>Three courses. Three rounds. Fifty-four holes to get championship-ready.</p>
    </div>
    <div className={styles.qualifierGrid}>
      {qualifiers.map((week) => {
        const state = week.proposed ? "Awaiting verification" : now >= Date.parse(week.closesAt ?? "") + 1000 ? "Closed" : now >= Date.parse(week.opensAt ?? "") ? "Open for play" : "Verified · upcoming";
        return <article key={week.id} className={styles.qualifierCard}>
          <div><span>Qualifier 0{week.phaseRound}</span><b>{state}</b></div>
          <h3>{week.courseA}</h3>
          <p>18 holes · Par {week.par ?? "pending"} · Individual stroke play</p>
          <p><strong>Opens</strong> {week.openingLabel}<br />{week.closingLabel}</p>
          <p>Calm wind · Medium fairways and greens target · Stimp 10 · Clear weather · No mulligans · One attempt</p>
          <p>{week.proposed ? `SGT lists ${CGL_QUALIFIER_SGT_LISTED_SETTINGS.tee} tees, ${CGL_QUALIFIER_SGT_LISTED_SETTINGS.pins} pins and ${CGL_QUALIFIER_SGT_LISTED_SETTINGS.gimmies} gimmies. CGL eligibility checks pending.` : `Pins: ${str(week.conditions.pins)}. Putting: ${str(week.conditions.putting)}. Gimmies: ${str(week.conditions.gimmies)}.`}</p>
          {week.eventId ? <a href={`https://simulatorgolftour.com/tournament/${week.eventId}`} target="_blank" rel="noreferrer">View SGT event <span aria-hidden>↗</span></a> : <small>SGT event link pending.</small>}
        </article>;
      })}
    </div>
    <p className={styles.qualifierNote}>One approved 18-hole round for established handicaps; three complete qualifiers for 54 holes on the new-handicap pathway. Approved external SGT rounds can count, including for late entrants. Qualification does not award championship points.</p>
  </section>;
}

export function CglSeasonFacts() {
  return (
    <div className={styles.facts}>
      <div>
        <Flag size={20} aria-hidden="true" />
        <span>Qualification</span>
        <strong>3 weeks</strong>
      </div>
      <div>
        <CalendarDays size={20} aria-hidden="true" />
        <span>Championship</span>
        <strong>10 rounds</strong>
      </div>
      <div>
        <CheckCircle2 size={20} aria-hidden="true" />
        <span>Points count</span>
        <strong>Best 8</strong>
      </div>
      <div>
        <MapPin size={20} aria-hidden="true" />
        <span>Championship format</span>
        <strong>9 + 9 holes</strong>
      </div>
    </div>
  );
}
