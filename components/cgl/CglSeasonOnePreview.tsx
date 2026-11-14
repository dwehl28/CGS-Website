import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Flag,
  Gauge,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wind,
} from "lucide-react";

import { CGL_DEFAULT_PLANS } from "@/lib/cgl-engine";
import {
  CGL_SEASON_ONE_PLAN,
  formatCglPlanDate,
  getCglSeasonOneMilestone,
} from "@/lib/cgl-season-one";

import styles from "./CglSeasonOnePreview.module.css";

const foundingPrices: Record<string, number> = {
  annual: 22410,
  monthly: 2696,
  weekly: 806,
};

const formatAud = (cents: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

function DateBlock({ label, date }: { label: string; date: string }) {
  return (
    <div className={styles.dateBlock}>
      <span>{label}</span>
      <time dateTime={date}>{formatCglPlanDate(date, true)}</time>
    </div>
  );
}

function CourseLine({ marker, name }: { marker: string; name: string }) {
  return (
    <div className={styles.courseLine}>
      <span>{marker}</span>
      <strong>{name}</strong>
      <small>9 holes · routing TBC</small>
    </div>
  );
}

export default function CglSeasonOnePreview() {
  const plan = CGL_SEASON_ONE_PLAN;
  const milestone = getCglSeasonOneMilestone();
  const qualification = plan.rounds.filter(
    (round) => round.phase === "qualification",
  );
  const championship = plan.rounds.filter(
    (round) => round.phase === "championship",
  );
  const fullPlans = CGL_DEFAULT_PLANS.filter((item) => item.fullMembership);

  return (
    <div className={styles.page}>
      <div className={styles.reviewBar} role="status">
        <span>Season 1 design review</span>
        <p>
          Proposed schedule and courses. Nothing on this page opens a round,
          changes a membership, or creates a payment.
        </p>
      </div>

      <section className={styles.hero} aria-labelledby="season-one-title">
        <div className={styles.heroCopy}>
          <div className={styles.brandLine}>
            <span className={styles.cglMark}>CGL</span>
            <span>Crossodog Golf League</span>
          </div>
          <div className={styles.kicker}>Season 1 · 2027</div>
          <h1 id="season-one-title">
            Hidden <em>Gems</em>
            <br /> Tour.
          </h1>
          <p className={styles.intro}>
            Discover the courses nobody talks about. Two different nine-hole
            layouts every round, with a fresh pairing and a new challenge each
            week.
          </p>
          <div className={styles.heroActions}>
            <Link href="#season-calendar" className={styles.primaryAction}>
              Explore the season <ArrowRight size={16} />
            </Link>
            <Link href="/cgl/memberships" className={styles.secondaryAction}>
              Review memberships
            </Link>
          </div>
          <p className={styles.heroFinePrint}>
            Course builds, nine-hole routing, conditions, SGT identifiers and
            closing times remain subject to administrator verification.
          </p>
        </div>

        <aside className={styles.launchBoard} aria-label="Season launch dates">
          <div className={styles.dogBadge}>
            <Image
              src="/cgl/cgs-logo-official.png"
              alt="Crossodog Golf Society bulldog"
              width={126}
              height={126}
              priority
            />
            <div>
              <span>Presented by</span>
              <strong>Crossodog Golf Society</strong>
            </div>
          </div>
          <div className={styles.milestone}>
            <span>{milestone.label}</span>
            <strong>{milestone.value}</strong>
            <small>{milestone.detail}</small>
          </div>
          <div className={styles.dateGrid}>
            <DateBlock
              label="Memberships"
              date={plan.membershipRegistrationDate}
            />
            <DateBlock
              label="Qualifying"
              date={plan.qualificationStartDate}
            />
            <DateBlock
              label="Championship"
              date={plan.championshipStartDate}
            />
          </div>
        </aside>
      </section>

      <section className={styles.statRail} aria-label="Season format summary">
        {[
          ["03", "Qualification rounds", CalendarDays],
          ["10", "Championship rounds", Trophy],
          ["2×9", "Different courses", MapPin],
          ["Best 8", "Results count", Target],
        ].map(([value, label, Icon]) => {
          const Mark = Icon as typeof Trophy;
          return (
            <article key={String(label)}>
              <Mark size={20} aria-hidden="true" />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </article>
          );
        })}
      </section>

      <section className={styles.section} aria-labelledby="format-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>The format</span>
          <h2 id="format-title">One round. Two hidden gems.</h2>
          <p>
            Each championship result combines one approved nine-hole segment
            from Course A and one approved nine-hole segment from Course B.
            Both segments use the same verified event conditions.
          </p>
        </div>
        <div className={styles.formatEquation}>
          <article className={styles.courseTile}>
            <span>Course A</span>
            <strong>Front or back nine</strong>
            <small>One verified 9-hole segment</small>
          </article>
          <div className={styles.operator}>+</div>
          <article className={styles.courseTile}>
            <span>Course B</span>
            <strong>Front or back nine</strong>
            <small>A different verified course</small>
          </article>
          <div className={styles.operator}>=</div>
          <article className={`${styles.courseTile} ${styles.totalTile}`}>
            <span>Weekly total</span>
            <strong>18 holes</strong>
            <small>Gross, net and statistics</small>
          </article>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.calendarSection}`}
        id="season-calendar"
        aria-labelledby="calendar-title"
      >
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Season calendar</span>
          <h2 id="calendar-title">Thirteen weeks. A different test every time.</h2>
          <p>
            Opening dates are agreed. Exact opening times, closing times, course
            routing and SGT references stay unconfirmed until the league admin
            completes the launch checks.
          </p>
        </div>

        <div className={styles.phaseHeader}>
          <div>
            <span>Phase 01</span>
            <h3>Qualification</h3>
          </div>
          <p>
            Three rounds to verify eligibility and establish the season handicap
            before divisions lock.
          </p>
        </div>
        <div className={styles.qualifierGrid}>
          {qualification.map((round) => (
            <article className={styles.qualifierCard} key={round.weekNumber}>
              <div className={styles.roundTop}>
                <span>Q{round.phaseRound}</span>
                <time dateTime={round.openingDate}>
                  {formatCglPlanDate(round.openingDate, true)}
                </time>
              </div>
              <CourseLine marker="A" name={round.courses[0].name} />
              <CourseLine marker="B" name={round.courses[1].name} />
              <div className={styles.draftLabel}>
                <CircleDashed size={13} /> Draft course pairing
              </div>
            </article>
          ))}
        </div>

        <div className={styles.phaseHeader}>
          <div>
            <span>Phase 02</span>
            <h3>Championship</h3>
          </div>
          <p>
            Ten full-field rounds across A and B Grade. Each player&apos;s best
            eight points results determine the season standings.
          </p>
        </div>
        <div className={styles.roundGrid}>
          {championship.map((round) => (
            <article className={styles.roundCard} key={round.weekNumber}>
              <div className={styles.roundTop}>
                <span>Round {String(round.phaseRound).padStart(2, "0")}</span>
                <time dateTime={round.openingDate}>
                  {formatCglPlanDate(round.openingDate, true)}
                </time>
              </div>
              <div className={styles.matchup}>
                <CourseLine marker="A" name={round.courses[0].name} />
                <span className={styles.plus}>+</span>
                <CourseLine marker="B" name={round.courses[1].name} />
              </div>
              <div className={styles.conditionStrip}>
                <span>
                  <Wind size={13} /> {round.conditions?.wind}
                </span>
                <span>
                  <Gauge size={13} /> Stimp {round.conditions?.greenSpeed}
                </span>
                <span>{round.conditions?.teeCategory}</span>
              </div>
              <div className={styles.draftLabel}>
                <CircleDashed size={13} /> SGT verification required
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="conditions-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Conditions ladder</span>
          <h2 id="conditions-title">The season changes gear.</h2>
          <p>
            These proposed settings create variety without turning the season
            into a lottery. Every value remains editable and must be matched to
            a supported GSPro/SGT option before a round is published.
          </p>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.conditionsTable}>
            <caption>Proposed Hidden Gems Tour championship conditions</caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">Wind</th>
                <th scope="col">Fairways</th>
                <th scope="col">Greens</th>
                <th scope="col">Speed</th>
                <th scope="col">Tee category</th>
              </tr>
            </thead>
            <tbody>
              {championship.map((round) => (
                <tr key={round.weekNumber}>
                  <th scope="row">{round.phaseRound}</th>
                  <td>{round.conditions?.wind}</td>
                  <td>{round.conditions?.fairwayFirmness}</td>
                  <td>{round.conditions?.greenFirmness}</td>
                  <td>{round.conditions?.greenSpeed}</td>
                  <td>{round.conditions?.teeCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.rulesBand} aria-labelledby="race-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>The championship race</span>
          <h2 id="race-title">Built to reward a complete season.</h2>
        </div>
        <div className={styles.ruleGrid}>
          {[
            [Users, "Two divisions", "A Grade at 9.9 or lower. B Grade at 10.0 or higher. The verified division locks for the championship."],
            [Trophy, "Best eight count", "Play all ten championship rounds, then drop the two lowest points results from the season total."],
            [Sparkles, "Weekly honours", "Lowest net, lowest gross and closest to pin are awarded across the eligible field after results are final."],
            [ShieldCheck, "Verified first", "SGT provenance, eligibility, score detail and countback must clear review before standings or credits become final."],
          ].map(([Icon, title, copy]) => {
            const Mark = Icon as typeof Trophy;
            return (
              <article key={String(title)}>
                <Mark size={23} aria-hidden="true" />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="membership-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Founding season</span>
          <h2 id="membership-title">Choose how you join the field.</h2>
          <p>
            These full-membership prices are the approved commercial proposal,
            not active recurring checkout options. The founding rate cannot be
            combined with CGS Credits on the same payment.
          </p>
        </div>
        <div className={styles.membershipGrid}>
          {fullPlans.map((membership) => (
            <article className={styles.membershipCard} key={membership.id}>
              <div>
                <span>{membership.interval} plan</span>
                <h3>{membership.name}</h3>
              </div>
              <div className={styles.price}>
                <strong>{formatAud(foundingPrices[membership.id])}</strong>
                <s>{formatAud(membership.priceCents)}</s>
              </div>
              <p>
                10% founding-member rate for the eligible Season 1 payment
                period.
              </p>
              <div className={styles.pendingLabel}>
                <CircleDashed size={13} /> Recurring checkout not yet enabled
              </div>
            </article>
          ))}
        </div>
        <div className={styles.casualBand}>
          <div>
            <span>Casual route</span>
            <strong>$29 registration</strong>
            <small>12 months · one-off</small>
          </div>
          <div className={styles.casualPlus}>+</div>
          <div>
            <span>Season entry</span>
            <strong>$100 pass</strong>
            <small>13 weeks · one-off</small>
          </div>
          <p>
            A current Casual Registration and Season Pass are both required for
            Season 1. Casual products do not receive the founding discount.
          </p>
        </div>
      </section>

      <section className={styles.readiness} aria-labelledby="readiness-title">
        <div>
          <span className={styles.eyebrow}>Launch control</span>
          <h2 id="readiness-title">Designed now. Activated safely.</h2>
          <p>
            The public experience can be approved independently from financial
            and competition activation. Every live dependency stays behind its
            existing admin control.
          </p>
        </div>
        <ul>
          {[
            "Verify every GSPro course build and SGT identifier",
            "Choose front or back nine for both courses",
            "Confirm exact Brisbane opening and closing timestamps",
            "Approve conditions supported by the live provider",
            "Complete recurring Square and policy launch review",
          ].map((item) => (
            <li key={item}>
              <CheckCircle2 size={17} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
        <div className={styles.readinessActions}>
          <Link href="/clubhouse-admin/cgl">
            Open CGL administration <ArrowRight size={15} />
          </Link>
          <Link href="/cgl">Return to the live clubhouse</Link>
        </div>
      </section>

      <div className={styles.previewFooter}>
        <Flag size={16} aria-hidden="true" />
        <p>
          Season 1 proposal · Australia/Brisbane · Course names are a draft
          shortlist until verified in GSPro and SGT.
        </p>
      </div>
    </div>
  );
}
