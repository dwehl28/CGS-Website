# CGL 2027 calculation rules and sources

The new `lib/cgl-engine.ts` is independent of the earlier trial/demo scoring.
Its calculations are pure: no function sends an email, imports external scores,
charges a card, changes an account or persists an award. Server commands must
authorise the actor and store results, rule versions and source evidence.

## Points reference

Verified 4 November 2026 against the official [2026 PGA TOUR Player Handbook and
Tournament Regulations](https://openqsection.pgatourhq.com/static-assets/uploads/2026-PGA%20TOUR%20Player%20Handbook%20and%20Regulations-2-6-26.pdf),
printed pages 87–88, **PGA TOUR Events** column. The complete numeric column is
included in `CGL_DEFAULT_POINTS_TABLE.values`, positions 1–85, with a named
version. Positions 66–85 are published to accommodate possible ties for 65th.
No major, Signature Event, additional-event or playoff column is used.

The CGL brief changes how those placement values are applied: each division is
scored separately, golf ties use configured stroke-index countback, and the best
eight of ten championship weeks count. The PGA's separate tie-averaging rule is
not applied. Missing countback information or an uncovered finishing position
holds the affected points for manual review. A calculation records both the
CGL rules version and points table version; changing a table does not change a
previously persisted calculation. The imported default is marked unapproved
until CGS approves the published competition rules.

## Rules requiring CGS decisions

- Annual aggregation remains `pending_approval`. Sum and best-season methods
  require explicit approved configuration.
- Monthly/weekly season-boundary cancellation quotes list exact future payment
  dates and amounts, but unapproved terms return `review_required`.
- Annual cancellation uses the paid annual term; casual registration and season
  purchases have no automatic renewal.
- Proration requires explicit period boundaries supplied by the billing
  configuration; it uses integer cents and a non-zero minimum. Weekly payments
  remain full price. An upgrade discloses an existing subscription that must
  stop before a replacement is activated. Prior payments are credited only when
  explicitly configured, never automatically assumed.
- Default weekly prize priority is net, gross, CTP. It is editable. One player
  can receive one weekly award across all divisions. Verified, published results
  and confirmed membership classification are required. An unresolved higher
  priority award stops subsequent awards for review; callers must not persist a
  partial award run.
- Default countback checks stroke index 1 onward. When two course segments have
  the same stroke index it compares their summed verified scores at that index.
  Administrators can configure the index order. The source scorecards must
  actually supply comparable scores; missing holes are not inferred.
- A Redemption event expects two submitted nine-hole records and chooses the
  best eligible verified one. An excluded or ineligible attempt can remain as
  evidence. Equal attempts need verified countback, or review.
- C Grade stays inactive until explicitly enabled. Locked championship
  divisions survive handicap changes. Overrides require an administrator ID
  and recorded reason. The A maximum and optional B maximum can be configured;
  crossed, non-finite or out-of-range boundaries are rejected. The initial
  published defaults remain A through 9.9, B from 10.0, and optional C from 20.0.
- Reaching 54 eligible holes does not itself create an SGT handicap. A verified
  value is required; established verified SGT handicaps bypass CGL qualification.
- Seasonal gift release defaults to Week 5 plus the configured season
  conditions and annual/monthly/weekly payment thresholds of 1/2/5. Mid-season
  joiners require review unless CGS chooses a specific policy. Gift allocations
  must have a unique member-and-season constraint in persistence.

## Credits and financial integrity

Credits are rebuilt from immutable issue, redemption, expiry and authorised
adjustment events. Individual lots expire after 18 calendar months; month-end
expiry dates are clamped to the last valid day. Redemptions allocate the earliest
expiry first. The engine rejects duplicate identifiers, reused command keys with
different payloads, cross-account lots, insufficient credits, invalid allocations
and negative balances. Duplicate commands return the original event unchanged.

The server must execute ledger writes, stock changes and redemption orders in
one database transaction with row locks and unique idempotency constraints.
The pure engine alone does not make concurrent writes safe.

Fee redemption has configurable enablement, limits and full-funding eligibility;
there is no default 25% cap. Fully funded recurring billing is blocked unless a
supported, reconciled Square mechanism is explicitly enabled. A quote does not
claim that a Square invoice was discounted or paid. The internal accounting
conversion is used for admin calculations, not promotional customer copy.

The scenario calculator labels its output `forecast`, includes outstanding
reward exposure as a budgeted cost, and accepts configured plan prices and fees.
Its output is not a report of collected or contracted revenue.

## Running the isolated rules tests

Node 24 supports TypeScript type stripping without another test dependency:

```text
node --experimental-strip-types --test --test-isolation=none tests/cgl-engine.test.ts
```

Tests exercise boundaries and failure cases for membership lifecycle, score
verification, points, ties, awards, expiring credits, redemption, gifts,
permissions and financial scenarios. They do not access real CGS records or
contact Square / SGT.

`scripts/cgl-development-fixture.ts` exports synthetic fixture data only. It has
no database client, environment access, network access or seeding side effects.
It includes 20 full members (10 annual, 6 monthly, 4 weekly), four casuals, A/B
grades, a 13-week season, qualifying progress, ten championship events, verified
hole totals, missing rounds, pending results, failed billing, an unapproved
cancellation, expiring/expired credits, merchandise orders and gift states.
Reserved `.invalid` emails and `fixture-` identifiers make the separation clear.
The fixture season dates are test inputs, not the approved 2027 CGL calendar.

`tests/cgl-platform.test.cjs` tests the server's authentication, ownership,
permissions, public/private separation, failure-week eligibility and scheduler
without live services. `tests/cgl-player.test.cjs` covers published 2027 player
routes, combined trial history, unavailable data, scorecard host validation and
public rendering. These tests deliberately replace database and Next services
with local test doubles; they do not assert that a hosted migration was applied.
