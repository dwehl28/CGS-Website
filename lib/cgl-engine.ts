/**
 * CGL 2027 rules. Pure functions: callers must authorise commands and persist the
 * resulting records inside database transactions. These rules do not recalculate
 * the earlier trial league or claim that a payment / SGT import took place.
 */

export const CGL_RULES_VERSION = "cgl-2027-v1";
export type CglDivision = "A" | "B" | "C";
export type CglPlanId =
  | "annual"
  | "monthly"
  | "weekly"
  | "casual_registration"
  | "casual_season";
export type FullMembershipPlan = "annual" | "monthly" | "weekly";
export type CglMembershipKind = "full" | "casual";
export type CompetitionFormat =
  | "aggregate"
  | "redemption"
  | "world_tour"
  | "elements";

export interface MembershipPlan {
  id: CglPlanId;
  name: string;
  priceCents: number;
  currency: "AUD";
  recurring: boolean;
  interval: "year" | "month" | "week" | "season";
  fullMembership: boolean;
}

export const CGL_DEFAULT_PLANS: readonly MembershipPlan[] = Object.freeze(
  [
    {
      id: "annual",
      name: "Annual membership",
      priceCents: 24900,
      currency: "AUD",
      recurring: true,
      interval: "year",
      fullMembership: true,
    },
    {
      id: "monthly",
      name: "Monthly membership",
      priceCents: 2995,
      currency: "AUD",
      recurring: true,
      interval: "month",
      fullMembership: true,
    },
    {
      id: "weekly",
      name: "Weekly membership",
      priceCents: 895,
      currency: "AUD",
      recurring: true,
      interval: "week",
      fullMembership: true,
    },
    {
      id: "casual_registration",
      name: "Casual registration",
      priceCents: 2900,
      currency: "AUD",
      recurring: false,
      interval: "year",
      fullMembership: false,
    },
    {
      id: "casual_season",
      name: "Casual season entry",
      priceCents: 10000,
      currency: "AUD",
      recurring: false,
      interval: "season",
      fullMembership: false,
    },
  ].map((plan) => Object.freeze(plan as MembershipPlan)),
);

export interface PointsTable {
  version: string;
  name: string;
  sourceUrl: string;
  approved: boolean;
  /** Array index zero represents first position. */
  values: readonly number[];
}

// Official 2026 PGA TOUR Handbook, pp. 87–88, "PGA TOUR Events" column.
// CGL borrows placement values only; its divisions, countback and best-eight
// rules are CGL rules. The official 66–85 values accommodate ties at 65th.
export const CGL_DEFAULT_POINTS_TABLE: PointsTable = Object.freeze({
  version: "pga-regular-500-2026-v1",
  name: "PGA regular full-field 500-point reference",
  sourceUrl:
    "https://openqsection.pgatourhq.com/static-assets/uploads/2026-PGA%20TOUR%20Player%20Handbook%20and%20Regulations-2-6-26.pdf",
  approved: false,
  values: Object.freeze([
    500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 57, 55, 53, 51,
    49, 47, 45, 43, 41, 39, 37, 35.5, 34, 32.5, 31, 29.5, 28, 26.5, 25, 23.5,
    22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10.5, 10, 9.5, 9, 8.5, 8,
    7.5, 7, 6.5, 6, 5.8, 5.6, 5.4, 5.2, 5, 4.8, 4.6, 4.4, 4.2, 4, 3.8, 3.6, 3.4,
    3.2, 3, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.9, 1.8, 1.7, 1.6,
    1.5,
  ]),
});

function validDate(value: string | Date): Date {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid timestamp is required.");
  return date;
}

function integer(value: number, name: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${name} must be an integer of at least ${minimum}.`);
  return value;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
  return value;
}

function nonEmpty(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name} is required.`);
  return value;
}

export function addCalendarMonths(
  value: string | Date,
  months: number,
): string {
  integer(months, "Months");
  const date = validDate(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const monthEnd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(originalDay, monthEnd));
  return date.toISOString();
}

/** Anchored renewal avoids drifting a January 31 billing anniversary to March 28. */
export function renewalAt(
  plan: MembershipPlan,
  anchor: string,
  cycle = 1,
): string | null {
  integer(cycle, "Billing cycle", 1);
  if (!plan.recurring) return null;
  if (plan.interval === "week")
    return new Date(
      validDate(anchor).getTime() + cycle * 7 * 86400000,
    ).toISOString();
  if (plan.interval === "month") return addCalendarMonths(anchor, cycle);
  if (plan.interval === "year") return addCalendarMonths(anchor, cycle * 12);
  throw new Error("A season purchase cannot recur.");
}

export const nextRenewalAt = renewalAt;

export interface ChargeQuote {
  planId: CglPlanId;
  amountCents: number;
  fullPriceCents: number;
  prorated: boolean;
  periodStart: string;
  periodEnd: string;
  currency: "AUD";
  recurring: boolean;
}

export function quoteInitialCharge(input: {
  plan: MembershipPlan;
  joinedAt: string;
  periodStart: string;
  periodEnd: string;
  prorate?: boolean;
  minimumChargeCents?: number;
}): ChargeQuote {
  const { plan } = input;
  const price = integer(plan.priceCents, "Plan price", 1);
  const start = validDate(input.periodStart).getTime();
  const end = validDate(input.periodEnd).getTime();
  const joined = validDate(input.joinedAt).getTime();
  if (end <= start || joined < start || joined >= end)
    throw new Error(
      "Joining date must be within a positive membership period.",
    );
  const minimum = integer(input.minimumChargeCents ?? 1, "Minimum charge", 1);
  if (minimum > price)
    throw new Error("Minimum charge cannot exceed the plan price.");
  const prorated =
    input.prorate !== false &&
    (plan.id === "annual" || plan.id === "monthly") &&
    joined > start;
  const amountCents = prorated
    ? Math.max(minimum, Math.round((price * (end - joined)) / (end - start)))
    : price;
  return {
    planId: plan.id,
    amountCents,
    fullPriceCents: price,
    prorated,
    periodStart: new Date(joined).toISOString(),
    periodEnd: new Date(end).toISOString(),
    currency: "AUD",
    recurring: plan.recurring,
  };
}

export function quoteUpgrade(
  input: Parameters<typeof quoteInitialCharge>[0] & {
    priorPaymentCreditCents?: number;
    existingSubscriptionId?: string | null;
    existingSubscriptionStopConfirmed?: boolean;
  },
): ChargeQuote & {
  appliedPaymentCreditCents: number;
  requiresExistingSubscriptionStop: boolean;
} {
  if (!input.plan.fullMembership)
    throw new Error("An upgrade must select a full membership plan.");
  const quote = quoteInitialCharge(input);
  const credit = integer(
    input.priorPaymentCreditCents ?? 0,
    "Prior payment credit",
  );
  const requiresExistingSubscriptionStop = Boolean(
    input.existingSubscriptionId && !input.existingSubscriptionStopConfirmed,
  );
  if (credit >= quote.amountCents)
    throw new Error(
      "A fully funded upgrade needs an approved credit-funded billing flow.",
    );
  return {
    ...quote,
    amountCents: quote.amountCents - credit,
    appliedPaymentCreditCents: credit,
    requiresExistingSubscriptionStop,
  };
}

export interface CancellationPolicy {
  mode: "season_boundary" | "paid_term" | "immediate";
  approved: boolean;
}

export function cancellationQuote(input: {
  plan: MembershipPlan;
  requestedAt: string;
  paidThrough: string;
  nextBillingAt?: string | null;
  billingAnchor?: string;
  seasonBoundaries: readonly string[];
  policy: CancellationPolicy;
}): {
  status: "ready" | "review_required";
  effectiveAt: string;
  futurePayments: { dueAt: string; amountCents: number }[];
  futureAmountCents: number;
  reason?: string;
} {
  const requested = validDate(input.requestedAt);
  const paidThrough = validDate(input.paidThrough);
  let effective = requested;
  if (
    !input.plan.recurring ||
    input.plan.id === "annual" ||
    input.policy.mode === "paid_term"
  ) {
    effective = paidThrough > requested ? paidThrough : requested;
  } else if (input.policy.mode === "season_boundary") {
    const boundary = input.seasonBoundaries
      .map(validDate)
      .filter((date) => date > requested)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!boundary)
      throw new Error(
        "Publish a future season boundary before calculating this cancellation.",
      );
    effective = boundary;
  }
  const futurePayments: { dueAt: string; amountCents: number }[] = [];
  if (
    input.plan.recurring &&
    input.plan.id !== "annual" &&
    input.nextBillingAt
  ) {
    const next = validDate(input.nextBillingAt);
    const anchor = input.billingAnchor ? validDate(input.billingAnchor) : next;
    let cycle = 0;
    let due = next;
    // The bounded loop also rejects malformed configuration instead of hanging.
    while (due < effective) {
      if (due >= requested)
        futurePayments.push({
          dueAt: due.toISOString(),
          amountCents: input.plan.priceCents,
        });
      let following = due;
      while (following <= due) {
        cycle += 1;
        if (cycle > 600)
          throw new Error(
            "Cancellation date is beyond the supported billing horizon.",
          );
        const candidate = renewalAt(input.plan, anchor.toISOString(), cycle);
        if (!candidate)
          throw new Error(
            "A recurring cancellation needs a supported billing interval.",
          );
        following = validDate(candidate);
      }
      due = following;
    }
  }
  const review = input.plan.recurring && !input.policy.approved;
  return {
    status: review ? "review_required" : "ready",
    effectiveAt: effective.toISOString(),
    futurePayments,
    futureAmountCents: futurePayments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    ),
    ...(review
      ? {
          reason:
            "Cancellation and renewal terms await CGS approval and legal review.",
        }
      : {}),
  };
}

export function competitionEligibility(input: {
  kind: CglMembershipKind;
  active: boolean;
  now: string;
  paidThrough?: string | null;
  competitionWeek: number;
  failedPaymentWeek?: number | null;
  paymentConfirmed?: boolean;
  casualRegistrationExpiresAt?: string | null;
  seasonEntryPaid?: boolean;
  suspended?: boolean;
  handicapEligible?: boolean;
}): { eligible: boolean; reason: string; billingWarning: boolean } {
  const now = validDate(input.now).getTime();
  integer(input.competitionWeek, "Competition week", 1);
  if (input.suspended)
    return {
      eligible: false,
      reason: "Eligibility is under administrator review.",
      billingWarning: false,
    };
  if (input.handicapEligible === false)
    return {
      eligible: false,
      reason: "An accepted verified SGT handicap is required.",
      billingWarning: false,
    };
  if (input.kind === "casual") {
    const validRegistration =
      input.casualRegistrationExpiresAt &&
      validDate(input.casualRegistrationExpiresAt).getTime() > now;
    return {
      eligible: Boolean(
        input.active && validRegistration && input.seasonEntryPaid,
      ),
      reason: !validRegistration
        ? "Casual registration needs manual renewal."
        : !input.seasonEntryPaid
          ? "A confirmed entry is required for this season."
          : !input.active
            ? "Casual entry is inactive."
            : "Eligible casual season entry.",
      billingWarning: false,
    };
  }
  const overdue =
    input.failedPaymentWeek != null && input.paymentConfirmed !== true;
  if (overdue) {
    integer(input.failedPaymentWeek!, "Failed payment week", 1);
    // Previously released weeks may remain open in the configured calendar.
    // Arrears block the following week, not an older entitled competition.
    const grace =
      input.active && input.competitionWeek <= input.failedPaymentWeek!;
    return {
      eligible: grace,
      reason: grace
        ? "Current-week grace period; update payment details before the next week."
        : "Payment is overdue. A confirmed payment restores entry.",
      billingWarning: true,
    };
  }
  const eligible =
    input.active &&
    Boolean(input.paidThrough && validDate(input.paidThrough).getTime() > now);
  return {
    eligible,
    reason: eligible
      ? "Active full membership."
      : "An active paid membership is required.",
    billingWarning: false,
  };
}

export function handicapEligibility(input: {
  established: boolean;
  verified: boolean;
  handicap: number | null;
  eligibleHoles: number;
  requiredHoles?: number;
}): {
  eligible: boolean;
  status: "verified" | "qualifying" | "awaiting_verification";
  holesRequired: number;
  holesCompleted: number;
} {
  const required = integer(
    input.requiredHoles ?? 54,
    "Qualifying holes required",
    1,
  );
  const completed = integer(input.eligibleHoles, "Eligible holes");
  const eligible =
    input.verified &&
    input.handicap != null &&
    Number.isFinite(input.handicap) &&
    (input.established || completed >= required);
  return {
    eligible,
    status: eligible
      ? "verified"
      : input.established || completed >= required
        ? "awaiting_verification"
        : "qualifying",
    holesRequired: required,
    holesCompleted: Math.min(completed, required),
  };
}

export function assignDivision(
  handicap: number | null,
  options: {
    cGradeEnabled?: boolean;
    aMaximum?: number;
    bMaximum?: number;
    lockedDivision?: CglDivision | null;
    championshipStarted?: boolean;
    override?: { division: CglDivision; reason: string; actorId: string };
  } = {},
): CglDivision | null {
  const aMaximum = finite(options.aMaximum ?? 9.9, "A Grade maximum handicap");
  const bMaximum = finite(options.bMaximum ?? 19.9, "B Grade maximum handicap");
  if (
    aMaximum < -20 ||
    aMaximum >= 54 ||
    (options.cGradeEnabled && (bMaximum <= aMaximum || bMaximum >= 54))
  )
    throw new Error(
      "Division thresholds must be ordered within the supported handicap range.",
    );
  if (options.override) {
    nonEmpty(options.override.reason, "Override reason");
    nonEmpty(options.override.actorId, "Administrator actor");
    if (options.override.division === "C" && !options.cGradeEnabled)
      throw new Error("C Grade has not been activated.");
    return options.override.division;
  }
  if (options.championshipStarted && options.lockedDivision)
    return options.lockedDivision;
  if (handicap == null) return null;
  finite(handicap, "Handicap");
  if (handicap <= aMaximum) return "A";
  return options.cGradeEnabled && handicap > bMaximum ? "C" : "B";
}

export interface HoleScore {
  strokeIndex: number;
  net: number;
  gross: number;
  segment?: number;
}

export interface NineHoleAttempt {
  id: string;
  courseId: string;
  conditionsId?: string | null;
  holesCompleted: number;
  gross: number;
  net: number;
  eligible: boolean;
  verified: boolean;
  holes?: readonly HoleScore[];
}

export function scoreCompetition(
  format: CompetitionFormat,
  attempts: readonly NineHoleAttempt[],
  options: { strokeIndexOrder?: readonly number[] } = {},
): {
  status: "complete" | "incomplete" | "manual_review";
  gross: number | null;
  net: number | null;
  countedAttemptIds: string[];
  reason?: string;
} {
  if (
    attempts.length > 2 ||
    new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length
  )
    return {
      status: "manual_review",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "Exactly two distinct nine-hole records may be submitted.",
    };
  if (
    attempts.some(
      (attempt) =>
        !Number.isFinite(attempt.gross) ||
        !Number.isFinite(attempt.net) ||
        attempt.gross <= 0 ||
        !attempt.courseId.trim(),
    )
  )
    return {
      status: "manual_review",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "A verified course and valid scores are required.",
    };
  const eligible = attempts.filter(
    (attempt) =>
      attempt.eligible && attempt.verified && attempt.holesCompleted === 9,
  );
  if (
    attempts.length < 2 ||
    (format !== "redemption" && eligible.length < 2) ||
    eligible.length === 0
  )
    return {
      status: "incomplete",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "Awaiting the required verified eligible nine-hole rounds.",
    };
  if (
    (format === "aggregate" || format === "redemption") &&
    attempts[0].courseId !== attempts[1].courseId
  )
    return {
      status: "manual_review",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "Both attempts must use the same course.",
    };
  if (
    (format === "world_tour" || format === "elements") &&
    attempts[0].courseId === attempts[1].courseId
  )
    return {
      status: "manual_review",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "This format requires two different courses.",
    };
  if (
    format === "elements" &&
    (!attempts[0].conditionsId ||
      !attempts[1].conditionsId ||
      attempts[0].conditionsId === attempts[1].conditionsId)
  )
    return {
      status: "manual_review",
      gross: null,
      net: null,
      countedAttemptIds: [],
      reason: "Verify the different playing conditions for both rounds.",
    };
  if (format === "redemption") {
    const sorted = [...eligible].sort((a, b) => a.net - b.net);
    if (sorted.length === 2 && sorted[0].net === sorted[1].net) {
      const comparison = compareCountback(
        sorted[0].holes,
        sorted[1].holes,
        options.strokeIndexOrder,
      );
      if (comparison.order === null || comparison.order === 0)
        return {
          status: "manual_review",
          gross: null,
          net: null,
          countedAttemptIds: [],
          reason:
            comparison.reason ?? "Equal attempts require verified countback.",
        };
      if (comparison.order > 0) sorted.reverse();
    }
    return {
      status: "complete",
      gross: sorted[0].gross,
      net: sorted[0].net,
      countedAttemptIds: [sorted[0].id],
    };
  }
  return {
    status: "complete",
    gross: eligible.reduce((sum, attempt) => sum + attempt.gross, 0),
    net: eligible.reduce((sum, attempt) => sum + attempt.net, 0),
    countedAttemptIds: eligible.map((attempt) => attempt.id),
  };
}

export function compareCountback(
  left: readonly HoleScore[] | undefined,
  right: readonly HoleScore[] | undefined,
  strokeIndexOrder: readonly number[] = Array.from(
    { length: 18 },
    (_, index) => index + 1,
  ),
  scoring: "net" | "gross" = "net",
): { order: -1 | 0 | 1 | null; reason?: string; decidingStrokeIndex?: number } {
  if (!left?.length || !right?.length || strokeIndexOrder.length === 0)
    return {
      order: null,
      reason:
        "Verified hole scores and stroke indices are required to resolve this tie.",
    };
  if (
    new Set(strokeIndexOrder).size !== strokeIndexOrder.length ||
    strokeIndexOrder.some((index) => !Number.isInteger(index) || index < 1)
  )
    throw new Error("Countback indices must be distinct positive integers.");
  for (const strokeIndex of strokeIndexOrder) {
    const a = left.filter((hole) => hole.strokeIndex === strokeIndex);
    const b = right.filter((hole) => hole.strokeIndex === strokeIndex);
    if (
      a.length === 0 ||
      b.length === 0 ||
      a.length !== b.length ||
      [...a, ...b].some((hole) => !Number.isFinite(hole[scoring]))
    )
      return {
        order: null,
        reason: `Verified comparable scores are missing for stroke index ${strokeIndex}.`,
      };
    const difference =
      a.reduce((sum, hole) => sum + hole[scoring], 0) -
      b.reduce((sum, hole) => sum + hole[scoring], 0);
    if (difference !== 0)
      return {
        order: difference < 0 ? -1 : 1,
        decidingStrokeIndex: strokeIndex,
      };
  }
  return {
    order: 0,
    reason:
      "Scores remain tied after the configured countback; administrator review is required.",
  };
}

export interface CompetitionResult {
  playerId: string;
  division: CglDivision;
  gross: number;
  net: number;
  verified: boolean;
  eligible: boolean;
  holes?: readonly HoleScore[];
  ctpMetres?: number | null;
  ctpVerifiedAt?: string | null;
  membership?: CglMembershipKind;
}

export interface CalculatedPointsRow {
  playerId: string;
  division: CglDivision;
  position: number | null;
  points: number | null;
  status: "calculated" | "manual_review";
  reason?: string;
  rulesVersion: string;
  pointsVersion: string;
}

export interface PointsCalculation {
  rows: CalculatedPointsRow[];
  manualReview: boolean;
}

export function calculateDivisionPoints(
  results: readonly CompetitionResult[],
  table: PointsTable = CGL_DEFAULT_POINTS_TABLE,
  strokeIndexOrder?: readonly number[],
): PointsCalculation {
  if (
    table.values.length === 0 ||
    table.values.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("A valid versioned points table is required.");
  if (new Set(results.map((result) => result.playerId)).size !== results.length)
    throw new Error("Each player may have one weekly combined result.");
  const rows: CalculatedPointsRow[] = [];
  for (const division of ["A", "B", "C"] as const) {
    const field = results
      .filter(
        (result) =>
          result.division === division && result.verified && result.eligible,
      )
      .sort((a, b) => a.net - b.net);
    for (const result of field) {
      finite(result.net, "Net score");
      finite(result.gross, "Gross score");
    }
    let offset = 0;
    while (offset < field.length) {
      const group = field.filter((result) => result.net === field[offset].net);
      const reasons: string[] = [];
      if (group.length > 1) {
        for (let i = 0; i < group.length; i += 1) {
          for (let j = i + 1; j < group.length; j += 1) {
            const comparison = compareCountback(
              group[i].holes,
              group[j].holes,
              strokeIndexOrder,
            );
            if (comparison.order == null || comparison.order === 0)
              reasons.push(comparison.reason ?? "Unresolved tie.");
          }
        }
        if (reasons.length === 0)
          group.sort(
            (a, b) =>
              compareCountback(a.holes, b.holes, strokeIndexOrder).order ?? 0,
          );
      }
      group.forEach((result, index) => {
        const position = offset + index + 1;
        const missingPoints = table.values[position - 1] == null;
        const review = reasons.length > 0 || missingPoints;
        rows.push({
          playerId: result.playerId,
          division,
          position: review ? null : position,
          points: review ? null : table.values[position - 1],
          status: review ? "manual_review" : "calculated",
          rulesVersion: CGL_RULES_VERSION,
          pointsVersion: table.version,
          ...(review
            ? {
                reason: missingPoints
                  ? `The points table does not cover position ${position}.`
                  : reasons[0],
              }
            : {}),
        });
      });
      offset += group.length;
    }
  }
  return {
    rows,
    manualReview: rows.some((row) => row.status === "manual_review"),
  };
}

export interface WeeklyPoints {
  week: number;
  points: number | null;
}

export function bestEightOfTen(
  results: readonly WeeklyPoints[],
  expectedWeeks = 10,
  countedWeeks = 8,
): {
  total: number;
  counted: WeeklyPoints[];
  discarded: WeeklyPoints[];
  missingWeeks: number[];
  roundsCounted: number;
  hasPending: boolean;
} {
  integer(expectedWeeks, "Championship weeks", 1);
  integer(countedWeeks, "Counted weeks", 1);
  if (countedWeeks > expectedWeeks)
    throw new Error("Counted weeks cannot exceed championship weeks.");
  if (new Set(results.map((result) => result.week)).size !== results.length)
    throw new Error("Duplicate championship weeks require reconciliation.");
  for (const result of results) {
    if (
      !Number.isInteger(result.week) ||
      result.week < 1 ||
      result.week > expectedWeeks ||
      (result.points != null &&
        (!Number.isFinite(result.points) || result.points < 0))
    )
      throw new Error("Invalid championship weekly points.");
  }
  const completed = new Map(
    results
      .filter((result) => result.points != null)
      .map((result) => [result.week, result.points!]),
  );
  const all = Array.from({ length: expectedWeeks }, (_, index) => ({
    week: index + 1,
    points: completed.get(index + 1) ?? 0,
  }));
  const ordered = all.sort(
    (a, b) =>
      b.points - a.points ||
      Number(completed.has(b.week)) - Number(completed.has(a.week)) ||
      a.week - b.week,
  );
  const counted = ordered.slice(0, countedWeeks);
  return {
    total: Number(
      counted.reduce((sum, result) => sum + result.points, 0).toFixed(3),
    ),
    counted,
    discarded: ordered.slice(countedWeeks),
    missingWeeks: all
      .filter((result) => !completed.has(result.week))
      .map((result) => result.week)
      .sort((a, b) => a - b),
    roundsCounted: counted.filter((result) => completed.has(result.week))
      .length,
    hasPending: results.some((result) => result.points == null),
  };
}

export function annualRanking(
  seasonPoints: readonly { seasonId: string; points: number }[],
  config: {
    approved: boolean;
    method: "pending" | "sum" | "best_seasons";
    countedSeasons?: number;
  },
): { status: "pending_approval" | "calculated"; points: number | null } {
  if (!config.approved || config.method === "pending")
    return { status: "pending_approval", points: null };
  if (
    new Set(seasonPoints.map((season) => season.seasonId)).size !==
      seasonPoints.length ||
    seasonPoints.some(
      (season) => !Number.isFinite(season.points) || season.points < 0,
    )
  )
    throw new Error("Unique valid season totals are required.");
  const values = seasonPoints
    .map((season) => season.points)
    .sort((a, b) => b - a);
  const selected =
    config.method === "best_seasons"
      ? values.slice(
          0,
          integer(config.countedSeasons ?? 0, "Counted seasons", 1),
        )
      : values;
  return {
    status: "calculated",
    points: Number(selected.reduce((sum, value) => sum + value, 0).toFixed(3)),
  };
}

export type WeeklyAwardCategory = "net" | "gross" | "ctp";
export interface WeeklyAward {
  key: string;
  playerId: string;
  category: WeeklyAwardCategory;
  credits: number;
  membership: CglMembershipKind;
}

export function selectWeeklyAwards(
  results: readonly CompetitionResult[],
  options: {
    verified: boolean;
    published: boolean;
    weekId: string;
    priority?: readonly WeeklyAwardCategory[];
    casualCredits?: Record<WeeklyAwardCategory, number>;
    fullMultiplier?: number;
    strokeIndexOrder?: readonly number[];
  },
): { awards: WeeklyAward[]; manualReview: boolean; reason?: string } {
  if (!options.verified || !options.published)
    return {
      awards: [],
      manualReview: false,
      reason: "Weekly awards await verified, published results.",
    };
  nonEmpty(options.weekId, "Competition week ID");
  if (new Set(results.map((result) => result.playerId)).size !== results.length)
    throw new Error("Duplicate player results require reconciliation.");
  const priority = options.priority ?? ["net", "gross", "ctp"];
  if (
    priority.length !== 3 ||
    new Set(priority).size !== 3 ||
    priority.some((category) => !["net", "gross", "ctp"].includes(category))
  )
    throw new Error(
      "Each weekly prize category must appear exactly once in the priority order.",
    );
  const credits = options.casualCredits ?? { net: 10, gross: 10, ctp: 5 };
  Object.values(credits).forEach((value) => integer(value, "Prize credits"));
  const multiplier = integer(
    options.fullMultiplier ?? 2,
    "Full-member multiplier",
    1,
  );
  const winners = new Set<string>();
  const awards: WeeklyAward[] = [];
  for (const category of priority) {
    const field = results.filter(
      (result) =>
        result.verified &&
        result.eligible &&
        !winners.has(result.playerId) &&
        (category !== "ctp" ||
          (result.ctpMetres != null &&
            Number.isFinite(result.ctpMetres) &&
            result.ctpMetres >= 0)),
    );
    const value = (result: CompetitionResult) =>
      category === "ctp" ? result.ctpMetres! : result[category];
    if (field.some((result) => !Number.isFinite(value(result))))
      return {
        awards,
        manualReview: true,
        reason: "A prize contender has an invalid score.",
      };
    field.sort((a, b) => value(a) - value(b));
    if (field.length === 0) continue;
    const tied = field.filter((result) => value(result) === value(field[0]));
    let winner = tied[0];
    if (tied.length > 1) {
      if (category === "ctp") {
        if (
          tied.some(
            (result) =>
              !result.ctpVerifiedAt ||
              !Number.isFinite(new Date(result.ctpVerifiedAt).getTime()),
          )
        )
          return {
            awards,
            manualReview: true,
            reason: "Equal CTP distances need verified qualifying timestamps.",
          };
        tied.sort(
          (a, b) =>
            validDate(a.ctpVerifiedAt!).getTime() -
            validDate(b.ctpVerifiedAt!).getTime(),
        );
        if (
          validDate(tied[0].ctpVerifiedAt!).getTime() ===
          validDate(tied[1].ctpVerifiedAt!).getTime()
        )
          return {
            awards,
            manualReview: true,
            reason:
              "Equal CTP distances and timestamps require administrator review.",
          };
        winner = tied[0];
      } else {
        for (let i = 0; i < tied.length; i += 1)
          for (let j = i + 1; j < tied.length; j += 1) {
            const comparison = compareCountback(
              tied[i].holes,
              tied[j].holes,
              options.strokeIndexOrder,
              category,
            );
            if (comparison.order == null || comparison.order === 0)
              return { awards, manualReview: true, reason: comparison.reason };
          }
        tied.sort(
          (a, b) =>
            compareCountback(
              a.holes,
              b.holes,
              options.strokeIndexOrder,
              category,
            ).order ?? 0,
        );
        winner = tied[0];
      }
    }
    if (!winner.membership)
      return {
        awards,
        manualReview: true,
        reason:
          "Confirm the winner's membership at the award eligibility date.",
      };
    winners.add(winner.playerId);
    awards.push({
      key: `weekly:${options.weekId}:${category}`,
      playerId: winner.playerId,
      category,
      credits:
        credits[category] * (winner.membership === "full" ? multiplier : 1),
      membership: winner.membership,
    });
  }
  return { awards, manualReview: false };
}

export interface CreditAllocation {
  lotId: string;
  credits: number;
}
export interface CreditLedgerEvent {
  id: string;
  key: string;
  memberId: string;
  type: "issue" | "redeem" | "expire" | "adjustment";
  /** Positive for an issue, negative for spending / expiry / a downward adjustment. */
  amount: number;
  occurredAt: string;
  expiresAt?: string;
  sourceId: string;
  allocations?: readonly CreditAllocation[];
  reason?: string;
  actorId?: string;
}
export interface CreditLot {
  id: string;
  memberId: string;
  original: number;
  remaining: number;
  issuedAt: string;
  expiresAt: string;
  sourceId: string;
}

/** Rebuild lots from immutable records. A stored balance is never the authority. */
export function creditLots(
  ledger: readonly CreditLedgerEvent[],
  memberId: string,
  now: string,
): { lots: CreditLot[]; available: number; expiredUnprocessed: number } {
  const at = validDate(now).getTime();
  const ids = new Set<string>();
  const keys = new Set<string>();
  const lots = new Map<string, CreditLot>();
  for (const event of ledger) {
    if (ids.has(event.id) || keys.has(event.key))
      throw new Error(
        "Duplicate ledger IDs or idempotency keys require reconciliation.",
      );
    ids.add(nonEmpty(event.id, "Ledger ID"));
    keys.add(nonEmpty(event.key, "Ledger key"));
  }
  const entries = ledger
    .filter(
      (event) =>
        event.memberId === memberId &&
        validDate(event.occurredAt).getTime() <= at,
    )
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        validDate(a.event.occurredAt).getTime() -
          validDate(b.event.occurredAt).getTime() || a.index - b.index,
    );
  for (const { event } of entries) {
    if (!Number.isSafeInteger(event.amount) || event.amount === 0)
      throw new Error("Ledger quantities must be non-zero integers.");
    if (event.type === "issue") {
      if (
        event.amount < 0 ||
        !event.expiresAt ||
        validDate(event.expiresAt) <= validDate(event.occurredAt)
      )
        throw new Error(
          "A credit issue requires a positive amount and future expiry.",
        );
      lots.set(event.id, {
        id: event.id,
        memberId,
        original: event.amount,
        remaining: event.amount,
        issuedAt: event.occurredAt,
        expiresAt: event.expiresAt,
        sourceId: event.sourceId,
      });
    } else {
      if (
        event.amount > 0 ||
        !event.allocations?.length ||
        event.allocations.reduce(
          (sum, allocation) =>
            sum + integer(allocation.credits, "Allocated credits", 1),
          0,
        ) !== -event.amount ||
        new Set(event.allocations.map((allocation) => allocation.lotId))
          .size !== event.allocations.length
      )
        throw new Error(
          "Credit debit allocations must match the transaction amount.",
        );
      if (
        event.type === "adjustment" &&
        (!event.reason?.trim() || !event.actorId?.trim())
      )
        throw new Error(
          "An adjustment requires an administrator and an audit reason.",
        );
      for (const allocation of event.allocations) {
        const lot = lots.get(allocation.lotId);
        if (!lot || lot.remaining < allocation.credits)
          throw new Error("Credits cannot be spent twice or become negative.");
        const expired = validDate(lot.expiresAt) <= validDate(event.occurredAt);
        if (event.type === "redeem" && expired)
          throw new Error("Expired credits cannot be redeemed.");
        if (event.type === "expire" && !expired)
          throw new Error(
            "Credits cannot expire before their issue-lot deadline.",
          );
        lot.remaining -= allocation.credits;
      }
    }
  }
  const all = [...lots.values()].sort(
    (a, b) =>
      validDate(a.expiresAt).getTime() - validDate(b.expiresAt).getTime() ||
      validDate(a.issuedAt).getTime() - validDate(b.issuedAt).getTime() ||
      a.id.localeCompare(b.id),
  );
  return {
    lots: all,
    available: all
      .filter((lot) => validDate(lot.expiresAt).getTime() > at)
      .reduce((sum, lot) => sum + lot.remaining, 0),
    expiredUnprocessed: all
      .filter((lot) => validDate(lot.expiresAt).getTime() <= at)
      .reduce((sum, lot) => sum + lot.remaining, 0),
  };
}

export interface CreditCommand {
  id: string;
  key: string;
  memberId: string;
  amount: number;
  occurredAt: string;
  sourceId: string;
  actorId?: string;
  reason?: string;
}
export interface CreditMutation {
  ledger: readonly CreditLedgerEvent[];
  event: CreditLedgerEvent | null;
  duplicate: boolean;
}

function existingCreditCommand(
  ledger: readonly CreditLedgerEvent[],
  command: CreditCommand,
  type: CreditLedgerEvent["type"],
): CreditLedgerEvent | undefined {
  nonEmpty(command.id, "Ledger ID");
  nonEmpty(command.key, "Idempotency key");
  nonEmpty(command.memberId, "Member ID");
  nonEmpty(command.sourceId, "Credit source");
  integer(command.amount, "Credit amount", 1);
  validDate(command.occurredAt);
  const existing = ledger.find((event) => event.key === command.key);
  if (
    existing &&
    (existing.memberId !== command.memberId ||
      existing.type !== type ||
      Math.abs(existing.amount) !== command.amount ||
      existing.sourceId !== command.sourceId)
  )
    throw new Error(
      "This idempotency key belongs to a different credit command.",
    );
  if (!existing && ledger.some((event) => event.id === command.id))
    throw new Error("Ledger ID is already in use.");
  return existing;
}

export function issueCredits(
  ledger: readonly CreditLedgerEvent[],
  command: CreditCommand & { expiryMonths?: number },
): CreditMutation {
  const existing = existingCreditCommand(ledger, command, "issue");
  if (existing) return { ledger, event: existing, duplicate: true };
  const event: CreditLedgerEvent = {
    ...command,
    type: "issue",
    occurredAt: validDate(command.occurredAt).toISOString(),
    expiresAt: addCalendarMonths(
      command.occurredAt,
      integer(command.expiryMonths ?? 18, "Credit expiry months", 1),
    ),
  };
  const next = [...ledger, event];
  creditLots(next, command.memberId, command.occurredAt);
  return { ledger: next, event, duplicate: false };
}

export function redeemCredits(
  ledger: readonly CreditLedgerEvent[],
  command: CreditCommand,
): CreditMutation {
  const existing = existingCreditCommand(ledger, command, "redeem");
  if (existing) return { ledger, event: existing, duplicate: true };
  const snapshot = creditLots(ledger, command.memberId, command.occurredAt);
  if (snapshot.available < command.amount)
    throw new Error("Insufficient unexpired CGS Credits.");
  let remaining = command.amount;
  const allocations: CreditAllocation[] = [];
  for (const lot of snapshot.lots.filter(
    (lot) => validDate(lot.expiresAt) > validDate(command.occurredAt),
  )) {
    const credits = Math.min(remaining, lot.remaining);
    if (credits > 0) allocations.push({ lotId: lot.id, credits });
    remaining -= credits;
    if (remaining === 0) break;
  }
  const event: CreditLedgerEvent = {
    ...command,
    amount: -command.amount,
    occurredAt: validDate(command.occurredAt).toISOString(),
    type: "redeem",
    allocations,
  };
  return { ledger: [...ledger, event], event, duplicate: false };
}

export function expireCredits(
  ledger: readonly CreditLedgerEvent[],
  input: Omit<CreditCommand, "amount">,
): CreditMutation {
  const snapshot = creditLots(ledger, input.memberId, input.occurredAt);
  const previous = ledger.find((event) => event.key === input.key);
  if (previous) {
    if (
      previous.memberId !== input.memberId ||
      previous.type !== "expire" ||
      previous.sourceId !== input.sourceId
    )
      throw new Error("This expiry idempotency key has already been used.");
    return { ledger, event: previous, duplicate: true };
  }
  if (snapshot.expiredUnprocessed === 0)
    return { ledger, event: null, duplicate: false };
  const command = { ...input, amount: snapshot.expiredUnprocessed };
  existingCreditCommand(ledger, command, "expire");
  const allocations = snapshot.lots
    .filter(
      (lot) =>
        lot.remaining > 0 &&
        validDate(lot.expiresAt) <= validDate(input.occurredAt),
    )
    .map((lot) => ({ lotId: lot.id, credits: lot.remaining }));
  const event: CreditLedgerEvent = {
    ...input,
    amount: -snapshot.expiredUnprocessed,
    occurredAt: validDate(input.occurredAt).toISOString(),
    type: "expire",
    allocations,
  };
  return { ledger: [...ledger, event], event, duplicate: false };
}

export function adjustCreditsDown(
  ledger: readonly CreditLedgerEvent[],
  command: CreditCommand,
): CreditMutation {
  nonEmpty(command.actorId ?? "", "Administrator actor");
  nonEmpty(command.reason ?? "", "Adjustment reason");
  const existing = existingCreditCommand(ledger, command, "adjustment");
  if (existing) return { ledger, event: existing, duplicate: true };
  const redeemed = redeemCredits(ledger, {
    ...command,
    key: `${command.key}:allocation`,
  });
  const event: CreditLedgerEvent = {
    ...redeemed.event!,
    key: command.key,
    type: "adjustment",
  };
  return { ledger: [...ledger, event], event, duplicate: false };
}

/** A quote is not a discount settlement. Reserve / consume the lots atomically. */
export function quoteFeeRedemption(input: {
  enabled: boolean;
  paymentType: "membership" | "season" | "registration" | "merchandise";
  priceCents: number;
  requestedCredits: number;
  availableCredits: number;
  centsPerCredit?: number;
  maximumCredits?: number | null;
  allowFullRedemption?: boolean;
  recurring?: boolean;
  recurringZeroInvoiceSupported?: boolean;
}): {
  credits: number;
  discountCents: number;
  cashDueCents: number;
  allowed: boolean;
  reason?: string;
} {
  const price = integer(input.priceCents, "Price", 1);
  const requested = integer(input.requestedCredits, "Requested credits");
  const available = integer(input.availableCredits, "Available credits");
  const value = integer(
    input.centsPerCredit ?? 50,
    "Internal credit redemption value",
    1,
  );
  const blocked = (reason: string) => ({
    credits: 0,
    discountCents: 0,
    cashDueCents: price,
    allowed: false,
    reason,
  });
  if (!input.enabled)
    return blocked("Credit redemption is not enabled for this purchase.");
  if (requested > available) return blocked("Insufficient available credits.");
  if (
    input.maximumCredits != null &&
    requested > integer(input.maximumCredits, "Maximum redeemable credits")
  )
    return blocked("The configured redemption limit is exceeded.");
  if (requested * value > price)
    return blocked("Requested credits exceed this purchase's price.");
  const cashDueCents = price - requested * value;
  if (cashDueCents === 0 && input.allowFullRedemption === false)
    return blocked("This purchase does not allow full credit redemption.");
  if (
    cashDueCents === 0 &&
    input.recurring &&
    !input.recurringZeroInvoiceSupported
  )
    return blocked(
      "Fully credit-funded recurring billing awaits a supported reconciled Square flow.",
    );
  return {
    credits: requested,
    discountCents: requested * value,
    cashDueCents,
    allowed: true,
  };
}

export function giftEligibility(input: {
  planId: CglPlanId;
  active: boolean;
  seasonWeek: number;
  successfulPayments: number;
  alreadyAllocated: boolean;
  joinedMidSeason?: boolean;
  midSeasonPolicy?: "review" | "same_rules";
  seasonConditionsMet: boolean;
  minimumSeasonWeek?: number;
  monthlyPaymentsRequired?: number;
  weeklyPaymentsRequired?: number;
}): {
  eligible: boolean;
  status:
    | "eligible"
    | "waiting"
    | "not_eligible"
    | "already_allocated"
    | "manual_review";
  reason: string;
} {
  integer(input.seasonWeek, "Season week", 1);
  integer(input.successfulPayments, "Successful payments");
  if (input.alreadyAllocated)
    return {
      eligible: false,
      status: "already_allocated",
      reason: "A gift has already been allocated for this season.",
    };
  if (
    input.planId === "casual_registration" ||
    input.planId === "casual_season"
  )
    return {
      eligible: false,
      status: "not_eligible",
      reason: "Complimentary seasonal gifts are a full-member benefit.",
    };
  if (!input.active)
    return {
      eligible: false,
      status: "not_eligible",
      reason: "An active full membership is required.",
    };
  if (input.joinedMidSeason && input.midSeasonPolicy !== "same_rules")
    return {
      eligible: false,
      status: "manual_review",
      reason:
        "Review the prorated membership and payment history for this mid-season join.",
    };
  if (
    !input.seasonConditionsMet ||
    input.seasonWeek < (input.minimumSeasonWeek ?? 5)
  )
    return {
      eligible: false,
      status: "waiting",
      reason: "The season's gift release conditions have not yet been met.",
    };
  const required =
    input.planId === "monthly"
      ? (input.monthlyPaymentsRequired ?? 2)
      : input.planId === "weekly"
        ? (input.weeklyPaymentsRequired ?? 5)
        : 1;
  integer(required, "Required successful payments", 1);
  if (input.successfulPayments < required)
    return {
      eligible: false,
      status: "waiting",
      reason: `${required} successful ${input.planId} payment${required === 1 ? " is" : "s are"} required.`,
    };
  return {
    eligible: true,
    status: "eligible",
    reason: "Eligible for this season's member gift.",
  };
}

export function reconcileImportedResult(
  existing: {
    externalId: string;
    verified: boolean;
    fingerprint: string;
  } | null,
  incoming: { externalId: string; fingerprint: string },
): {
  action: "insert" | "unchanged" | "update_unverified" | "manual_review";
  reason: string;
} {
  nonEmpty(incoming.externalId, "SGT result identifier");
  nonEmpty(incoming.fingerprint, "Source fingerprint");
  if (!existing)
    return { action: "insert", reason: "New traceable external result." };
  if (existing.externalId !== incoming.externalId)
    return {
      action: "manual_review",
      reason: "SGT result identifiers do not match.",
    };
  if (existing.fingerprint === incoming.fingerprint)
    return {
      action: "unchanged",
      reason: "This exact result has already been imported.",
    };
  return existing.verified
    ? {
        action: "manual_review",
        reason:
          "A verified result changed at its source; authorise a revision before replacing it.",
      }
    : {
        action: "update_unverified",
        reason:
          "An unverified source record can be updated with import history.",
      };
}

export type CglRole =
  | "super_admin"
  | "league_admin"
  | "results_admin"
  | "member"
  | "casual"
  | "public";
export type CglPermission =
  | "view_public"
  | "view_own"
  | "manage_results"
  | "manage_members"
  | "manage_seasons"
  | "manage_rewards"
  | "manage_billing"
  | "manage_settings"
  | "manage_roles";

export function canCgl(role: CglRole, action: CglPermission): boolean {
  if (
    ![
      "super_admin",
      "league_admin",
      "results_admin",
      "member",
      "casual",
      "public",
    ].includes(role)
  )
    return false;
  if (action === "view_public") return true;
  if (action === "view_own") return role !== "public";
  if (role === "super_admin") return true;
  if (role === "league_admin") return action !== "manage_roles";
  return role === "results_admin" && action === "manage_results";
}

export function financialScenario(input: {
  annualMembers: number;
  monthlyMembers: number;
  weeklyMembers: number;
  casualRegistrations: number;
  casualSeasonEntries: number;
  retentionMonths?: number;
  retentionWeeks?: number;
  sgtCostCents?: number;
  cashPrizesCents?: number;
  creditExposureCents?: number;
  merchandiseCostCents: number;
  contingencyCents?: number;
  feeBasisPoints: number;
  fixedFeeCents: number;
  profitGoalCents?: number;
  prices?: Partial<Record<CglPlanId, number>>;
}): {
  forecastRevenueCents: number;
  forecastPayments: number;
  estimatedFeesCents: number;
  budgetedCostsCents: number;
  forecastSurplusCents: number;
  targetGapCents: number;
  classification: "forecast";
} {
  const annual = integer(input.annualMembers, "Annual members"),
    monthly = integer(input.monthlyMembers, "Monthly members"),
    weekly = integer(input.weeklyMembers, "Weekly members"),
    registrations = integer(input.casualRegistrations, "Casual registrations"),
    entries = integer(input.casualSeasonEntries, "Casual season entries");
  const months = integer(input.retentionMonths ?? 12, "Retained months"),
    weeks = integer(input.retentionWeeks ?? 52, "Retained weeks");
  const price = (id: CglPlanId) =>
    integer(
      input.prices?.[id] ??
        CGL_DEFAULT_PLANS.find((plan) => plan.id === id)!.priceCents,
      "Configured plan price",
      1,
    );
  const forecastRevenueCents =
    annual * price("annual") +
    monthly * months * price("monthly") +
    weekly * weeks * price("weekly") +
    registrations * price("casual_registration") +
    entries * price("casual_season");
  const forecastPayments =
    annual + monthly * months + weekly * weeks + registrations + entries;
  const estimatedFeesCents =
    Math.round(
      (forecastRevenueCents *
        integer(input.feeBasisPoints, "Fee basis points")) /
        10000,
    ) +
    forecastPayments * integer(input.fixedFeeCents, "Fixed payment fee");
  const budgetedCostsCents =
    integer(input.sgtCostCents ?? 150000, "SGT annual budget") +
    integer(input.cashPrizesCents ?? 120000, "Cash prize budget") +
    integer(
      input.creditExposureCents ?? 160000,
      "Maximum credit redemption exposure",
    ) +
    integer(input.merchandiseCostCents, "Merchandise cost") +
    integer(input.contingencyCents ?? 30000, "Contingency") +
    estimatedFeesCents;
  const forecastSurplusCents = forecastRevenueCents - budgetedCostsCents;
  return {
    forecastRevenueCents,
    forecastPayments,
    estimatedFeesCents,
    budgetedCostsCents,
    forecastSurplusCents,
    targetGapCents: Math.max(
      0,
      integer(input.profitGoalCents ?? 100000, "Operating surplus goal") -
        forecastSurplusCents,
    ),
    classification: "forecast",
  };
}
