# Hidden Gems Tour: Season 1 launch readiness

## Prepared, not released

Use **Clubhouse Admin → CGL → Season 1 launch → Create or complete the draft** after the operations migration is applied to the intended database. The operation uses existing season/week tables, creates one `(2027, 1)` draft, fills only missing fixtures and audits new records. It will not adopt an unrelated or already released Season 1. The screen displays the real season UUID after creation; do not copy test UUIDs into production.

- Season slug: `hidden-gems-tour-2027`. Official hosted season UUID and SGT event IDs: **not assigned by this implementation run**.
- Season: individual stroke play, three single-course 18-hole qualifiers, ten two-course 9+9 championship rounds, A/B divisions and best eight points results.
- Existing AUD products: annual A$249, monthly A$29.95, weekly A$8.95; A$29 one-off Casual Registration; A$100 one-off Season Pass. Full members do not need a pass. Casuals need both active registration and a paid pass. No Square catalogue, charge, subscription date, or 8 February billing activation changes were made.
- Nominal entry opens 1 February at 09:00 AEST. Calendar ends 9 May at 23:59:59 AEST. The season record's `ends_at` is the 23 May **submission/access** deadline, not calendar end; Square already uses that field as the Season Pass entitlement boundary. `config.calendar_ends_at` records the separate calendar end. Neither triggers final results or activates Season 2.

## Proposed Brisbane windows

All dates are in 2027. All starts are **00:00:00 AEST** and ends **23:59:59 AEST** (UTC+10). The Monday dates are confirmed. Exact times and the three-week championship submission windows remain subject to approval.

| Event | Open | Close |
|---|---|---|
| Q1 | 8 Feb | 14 Feb |
| Q2 | 15 Feb | 21 Feb |
| Q3 | 22 Feb | 28 Feb |
| R1 | 1 Mar | 21 Mar |
| R2 | 8 Mar | 28 Mar |
| R3 | 15 Mar | 4 Apr |
| R4 | 22 Mar | 11 Apr |
| R5 | 29 Mar | 18 Apr |
| R6 | 5 Apr | 25 Apr |
| R7 | 12 Apr | 2 May |
| R8 | 19 Apr | 9 May |
| R9 | 26 Apr | 16 May |
| R10 | 3 May | 23 May |

## Operator checklist

1. **Set up and approve**: apply and rehearse the additive migration in staging; create the draft. Use **Seasons & fixtures** to review and edit dates/conditions; use **Season 1 launch** to approve the schedule. Release the parent season explicitly. Review Square in test mode before selling the existing pass. The production database gate also enforces the approved opening time for new Season 1 pass intents.
2. **Verify Q1–Q3 first**: the [SGT Hidden Gems Qualifier tour](https://simulatorgolftour.com/tour/4265) lists [Q1 85268](https://simulatorgolftour.com/tournament/85268) Club Sports Belvédère (par 72), [Q2 85269](https://simulatorgolftour.com/tournament/85269) Trail Creek Golf Course (par 72), and [Q3 85270](https://simulatorgolftour.com/tournament/85270) Gilbert Plains Country Club (par 71). Public settings match across all three: Blue tees, Saturday pins, Normal fairways/greens and putting, 6-foot gimmies, Stimp 10, Calm and Clear. These public listings are linked in the preview, but do not prove the course build or handicap contribution. In **SGT live sync**, refresh the club listing and match the event IDs. Check the exact course ID and build version in GSPro, holes 1–18, tee yardages, handicap contribution, mulligans, attempt limit and the Brisbane windows. Approve shared settings and the schedule before release. R1 still uses the two-nine verification flow.
3. **Enrol manually**: verify the unique SGT player ID, payment status, and championship qualification and locked grade. Use the fixture's queue, then confirm the same player ID in every mapped SGT event and record the evidence. Signed-in entrants receive a website inbox notice; notify account-free entrants directly using the recorded contact. Automated enrolment is disabled and does not have a provider write implementation. The official public SGT docs did not expose a verified account-specific Club API registration-write operation; validate the actual authenticated API specification before designing one. Do not request player passwords.
4. **Qualify and import**: in **Season 1 launch**, import a complete 18-hole scorecard from the synced event after verifying the match and SGT completion time. Only one valid card per player per qualifier is counted. Use the external card form for approved SGT rounds including after February. Separately verify the current eligible SGT handicap and lock A/B. For championship scoring, use **Results & imports** and enter Course A then B with distinct IDs and URLs. Season 1 requires each attempt's `sgtPlayerId`, `tournamentId`, `courseId`, `nine`, `playedAt`, and `scorecardUrl` in addition to the existing fields. `played_at` is the later completion. Provide verified index/gross/net hole data for countback. Only include CTP with the designated `ctp_hole`, `ctp_first_shot: true` and verified time/distance. The championship form does not authenticate free-form scorecard content against SGT.
5. **Publish safely**: verify and calculate provisional results, then open review in **Season 1 launch**. Players see provisional results and a reporting link. Log disputes by fixture and record resolution/extension reasons. The 48-hour review starts when provisional results are presented, after play closes. Result or award changes require renewed review. One disputed fixture does not block other fixtures. Use **Results & imports** to explicitly finalise; points/credits use the existing transaction and immutable ledger. Unrelated awards *within* a disputed round are held too in this release.
6. **Cash prizes**: approve the Season 1 schedule in admin without changing historical prizes. A Grade A$500/A$200 and B Grade A$200/A$100. Weekly credits are 20/20/10 for full members, 10/10/5 for casuals, net then gross then CTP, one award per person. After all ten rounds are final, prepare the cash list, subject to existing prize terms approval. Use the existing prize status flow and record manual bank transfer completion, targeting 14 days. Never enter bank details. Annual prizes are displayed (A$500/A$100 and B$300/A$100); annual rankings remain a separate approval.

## Verification and remaining decisions

- Isolated regression tests cover duplicate payment/award protection, draft replay, overlapping windows, manual enrolment identity and replay, qualification paths, one combined result, shared exact-tie points, stroke-index order and dispute holds. The production app/database, Square and SGT were not used for a full play/settlement rehearsal.
- Finishing-position counts include all ten events even when points are discarded. If tied after finishing-position countback, cash preparation blocks for review. An approved cross-course net comparability rule (and a durable final override workflow) is still needed for that last tiebreak. Technical-failure attempts require verified source correction and an audit reason; no automatic GSPro reset is available.
- Before release: stage the migration and check the actual environment, approve schedule and prize/points settings, verify Q1–Q3 and R1 in GSPro/SGT, and test one guest and one signed-in player with non-live payments through round completion. The first provisional review and finalisation should be supervised. No official season IDs, linked event IDs, verified course builds or live payment tests should be claimed until that rehearsal is recorded.
