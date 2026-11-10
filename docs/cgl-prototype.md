# CGL customer prototype

CGL means Crossodog Golf League. It is a standalone CGS league and must stay separate from Top Dog.

## Scope of this pass

The design covers the CGL league home, round centre, public standings, trial hub and public player profiles. It is a clickable local preview within the existing CGS website. The round centre and season presentation use fictional usernames, results, statistics, courses, divisions and schedules. The trial hub and registered-player profiles use real, server-verified CGL player usernames and the supplied SGT views. These sources are labelled separately.

The six-round season from 1 February to 14 March 2027 is illustrative, not a committed schedule. The preview represents a fixed 17 February 2027 snapshot: rounds 1–3 are released and remain open; rounds 4–6 are upcoming. No status depends on the viewer's current date. Launch is intended for 2027 with approximately ten initial players; season length, price, prizes and final calendar remain undecided.

## Agreed league structure

- Individual, 18-hole rounds with actual putting and one attempt per round.
- One new round opens each week. Every released round stays open until the season closes.
- Every completed round counts towards the season total.
- Late entry is allowed, and late entrants can catch up on all released rounds before the season deadline.
- Show both gross and net results, with SGT managing handicaps.
- Round points are awarded for finishing position against the entire field. Division views filter those same points and must never award a second set of division points or recompute overall rank.
- Standings and points remain provisional while catch-up rounds can change the field.
- Visitors may browse standings and player histories. Public identities use SGT usernames. Personal history contains CGL rounds only.
- Entry is available to GSPro players in facilities or at home, initially focused on Australia and open to international players.
- Each season requires league payment and both a CGS account and an SGT account. Tester accounts and SGT identity links are provisioned; season payment and paid access are future integrations.
- Prizes are intended for the first season; details remain undecided.

## Proposed scoring represented in the prototype

The proposed points scale starts at 500, 300, 190, 135, 110, 100, 90, 85, 80 and 75 for first through tenth. The demo extends it through twentieth as 70, 65, 60, 57, 55, 53, 51, 49, 47 and 45. Confirm the complete production scale before opening entries. This is a FedExCup-style CGL proposal, with no PGA TOUR affiliation.

Ties pool the points of the occupied places. For example, two players tied first receive `(500 + 300) / 2 = 400` each; the next player receives third-place points. Missing rounds receive zero. Every demo scorecard has eighteen holes and represents a completed round; incomplete rounds, technical failures, withdrawals, disqualifications and retries need a final operations policy before launch.

The primary championship is currently presented as overall net points, with gross points available as a parallel view. The same player divisions apply to both views. Season points ties share a rank; prize tie-break rules are still to be decided. Division boundaries and reassignment rules are illustrative and require confirmation, especially if handicaps change during the season.

## Data and statistics

`lib/cgl-demo.ts` supplies the custom preview competition data: ten fictional usernames, six rounds and 24 completed cards over three released rounds. FairwayFox is the default example profile. Net and gross standings derive from each round's whole-field results, including pooled ties. Actual SGT results remain inside SGT-hosted views and do not populate these custom award cards or points tables.

`lib/cgl-roster.ts` reads server-controlled CGL trial membership from Supabase Auth and projects only public SGT usernames, profile links and verified CGL scorecard links. A profile is available before password setup; no password or email-confirmation status is exposed. Emails, full names, authentication IDs and long SGT IDs are excluded. The server helper uses per-request deduplication and waits for a real request before accessing Auth. Kevin remains private and pending until an SGT username is supplied.

Card distances use metres. `drive` is a round's illustrative average driving distance; `longestDrive` is its longest drive. `puttingDistance` means total distance of putts holed, not distance remaining or average putt length. `ctp` is that round's nearest qualifying shot to the pin. These definitions must be reconciled with the actual SGT data and units before integration.

The demo derives gross scores and putt counts from the eighteen hole entries. Net equals gross minus the handicap used for that round. FIR is fairways hit divided by eligible fairways (14); GIR is greens hit divided by 18. The current profile handicap happens to equal every round's playing handicap in this sample. Production must preserve SGT's actual round handicap rather than recalculate historical net scores with a current handicap.

SGT usernames are matched without case sensitivity. `getCglPlayerCards` returns cards from earliest to latest round. `getCglStandings(scoring, roundId)` returns the entire field; unplayed round rows have rank 0, no tie, zero points and zero rounds played. Apply division and search filters after calling this function. `formatCglRank` displays unplayed rank 0 as an em dash.

## Verified SGT views and remaining integration

The trial hub displays the supplied tour 3982 Net standings and tournament 80736 Gross/Net standings. The verified scorecard at `https://simulatorgolftour.com/scorecard/80736/51346` is linked to its player profile and can be viewed within CGS. Scorecard identifiers are opaque and cannot be calculated from the long SGT player ID. API access is not assumed.

The round centre presents best Net, best Gross, longest drive, most fairways, most greens, fewest putts, total putts holed distance, closest to pin and most birdies. Only completed 18-hole cards qualify. All joint leaders are retained. Each award links directly to the corresponding expanded preview scorecard. The round scoreboard supports Gross/Net, division filtering and username search, alongside the Net season standings.

Before replacing fictional results, verify:

- Embed behaviour on phones, keyboard access, contrast, sizing, scrolling and accessible fallbacks.
- Whether embeds expose round results, season points, individual scorecards and player histories.
- Whether the desired position, handicap, driving distance, FIR/GIR, putt count, total putting distance and CTP statistics are available, with clearly defined units and aggregation.
- Whether the SGT package supports several weekly competitions remaining open together.
- Which handicap applies when a player completes an earlier released round later in the season.
- Whether season points and divisions can be configured in SGT or require a supported CGS data workflow.
- Whether historical CGL-only stats can be presented within CGS without an API. Cross-origin embeds cannot be treated as a source of readable page data or silently scraped.

SGT remains the alternate access point through verified links. The embed is a display surface, not a supported data feed for custom CGL achievement calculations. Establish an authorised export, API or reviewed manual results import before replacing sample award results. SGT putting distance was observed in feet; the custom preview uses metres, so a production import must preserve source units and explicitly convert when required. SGT's mobile controls remain outside CGS styling and need separate usability review.

## Future work beyond design review

Season registration, authenticated personal dashboards, payment, paid-season access, competition provisioning, score corrections, administration and custom live result synchronisation remain future work. Provisioned testers already have server-controlled SGT identity links and public CGL profiles independent of activation. The presentation must continue to label sample results and avoid presenting non-functional payment or entry actions as live features.

Review the customer experience on a phone first: find a player and division, understand points and rounds completed, identify released rounds, then inspect round results and personal statistics. Final dates, venues, prizes, entry fee, division rules, handicap treatment and tie-break rules can be configured after that review and the SGT feasibility check.

## First-pass verification

The preview has been inspected at desktop width and in a 390-pixel viewport. Browser checks cover navigation, division filtering without changing whole-field ranks or points, empty search and reset, Net/Gross switching, selecting a round, joint leaders, switching players, round-specific statistics, unplayed-round messaging and expanding scorecards. Player switches reset the statistics period to the full season. Invalid usernames use Next's `notFound` handling; streamed responses can retain HTTP 200 while rendering the not-found screen.

Calculation checks cover all 24 cards, eighteen-hole score and putt totals, net/gross standings, pooled ties, missing rounds, total points and GIR consistency with the sample hole records. TypeScript and targeted ESLint checks passed, as did the production build. The build logs a dynamic sitemap fallback in the existing scoreboard code; it does not prevent a successful build.

## Round-centre presentation pass

The expanded round centre adds released-round navigation, nine achievement categories, joint winners, searchable whole-field results, pending cards and season context. Sample hole records include birdies while preserving gross, net and putting totals. A player link opens the matching scorecard automatically. The home page includes achievement teasers and the registered trial field; the trial hub switches between SGT tournament, league and scorecard views. Registered profiles show verified CGL scorecards or an honest missing-link state without inventing results.

Checks cover all achievement directions and joint winners, exclusion of incomplete/unreleased cards, division ranks and pooled tie points, empty search/reset, scorecard deep links, registered-player privacy, phone overflow and desktop layout. A CGL loading boundary keeps league navigation distinct from other CGS competitions. These presentation changes are prepared locally; the earlier account password setup page is already published separately.

Final production build passes with the request-time roster helper. The only remaining build warning is the existing sitemap's dynamic scoreboard fallback. Browser checks confirmed Tim's pre-activation public profile, Lachlan's embedded SGT scorecard, and no horizontal page overflow at 390 pixels. Public HTML checks for home, trial and registered profiles found no tester-private email addresses or long SGT identifiers.
