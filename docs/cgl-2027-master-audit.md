# CGL 2027 master implementation audit

Current assessment: 14 November 2026 (Australia/Brisbane).

## Existing architecture

- Next.js 16 App Router, React 19 and TypeScript deployed through Vercel.
- Supabase Postgres, Auth, Vault and Cron. CGL data uses additive `cgl_*` tables with RLS and explicit server-only access.
- Square hosted checkout is the payment authority. Signed webhooks and reconciliation control CGL entitlements; a browser return never activates access.
- The official SGT Club Admin connection is read-only. Protected syncs cache club tours, tournaments and source data without storing the SGT administrator password.
- Public, member and administrator projections are separate server routes. Existing CGS, Top Dog, Par 3, Ambrose and Stripe functionality remains independent.

## Reusable functionality

- Existing CGS accounts and CGL member extensions.
- Five configured membership products and live AUD one-off Square checkout.
- Season/week, eligibility, division, import, result, points, best-eight, prize, credit, catalogue, order, gift and audit models.
- Role-based CGL administration with results-only, league-admin and super-admin boundaries.
- Idempotent payment, import, publication and credit-ledger operations.
- Official SGT cache, health reporting and manual reviewed-result boundary.

## Production state found during audit

- CGL migrations are applied through `20261113060708_cgl_sgt_tournament_club_index`.
- Production currently has no `cgl_seasons`, `cgl_weeks` or official CGL results.
- Six CGL member extensions and existing payment/check-out records are present; these must not be replaced or reseeded.
- One-off Square production checkout is available. Recurring annual/monthly/weekly checkout remains disabled.
- Supabase reports no health advisories. Direct CGL table access is intentionally denied by RLS and server-only routing.
- Supabase leaked-password protection is disabled and should be enabled before a larger member launch.

## Existing admin functionality

The CGL operations centre already supports season and week records, member/handicap review, SGT connection health, reviewed imports, provisional calculation, publication, plans, prizes, credits, catalogue, gifts, settings, policy controls, finance scenarios, CSV reports and audit history.

## Additions required by the master brief

- Season 1 Hidden Gems Tour configuration and approval workflow.
- Public information architecture for Season 1, merchandise, facility partnerships and a clearer clubhouse hierarchy.
- Course-build, front/back routing, condition and SGT-identifier verification controls.
- Founding-member promotion rules and pre-launch activation safeguards.
- Merchandise shipping/tax/returns workflow and facility tournament packages.
- Expanded private financial reporting, liabilities and member-growth targets.
- Results review-window/dispute workflow and social graphic generation.
- Final legal review, full recurring Square acceptance and provider-specific course verification.

## Route plan

- Keep current public routes under `/cgl` and current administration at `/clubhouse-admin/cgl`.
- Add the approved Season 1 experience at `/cgl/season-1` only after preview approval.
- Review first at `/cgl/preview/season-1`; this route is non-indexed and performs no mutations.
- Extend existing `/api/cgl/public`, `/api/cgl/member` and `/api/cgl/admin` contracts rather than adding a parallel API.

## Data plan

The existing `cgl_seasons`, `cgl_weeks` and JSON configuration fields already support the 13-round structure, two courses, independent windows, conditions and provider references. New tables should be limited to genuinely new merchandise/facility/dispute concepts. All changes must be additive migrations with RLS, grants, audit records and isolated database tests.

## Realtime approach

CGL competition data is not a live scoring control surface. Continue using request-time server projections and the protected scheduled SGT cache. Add polling or Supabase Realtime only where a measured live-result requirement justifies it; do not introduce a second state channel prematurely.

## Risks and launch gates

- Course names, builds, routing and SGT identifiers are not yet verified.
- Exact round opening times and closing times are not approved; date-only proposals cannot be published as live windows.
- Recurring Square billing, founding promotion settlement and credit-assisted payments require full provider acceptance before activation.
- Prize, membership, cancellation, privacy, merchandise and facility terms need Australian legal review.
- A dedicated approved primary CGL logo file is not currently in the repository. Continue using the approved existing CGL wordmark treatment and supplied CGS bulldog until the asset is provided.

## Phase status

Phase 1 is in progress. The repository now contains a typed, validated Season 1 proposal and a non-mutating Hidden Gems Tour design preview. Production season records remain empty until the schedule, course verification and visual presentation are approved.
