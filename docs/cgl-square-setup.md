# CGL Square Sandbox billing

The existing CGS Stripe payment-intent route is preserved. CGL uses a separate Square REST adapter pinned to API version `2026-09-16`. Its API origin is fixed to `https://connect.squareupsandbox.com/v2`; setting an environment value to `production` disables the adapter. The supplied application ID identifies the application; it does not authenticate requests or prove that a merchant, location, catalogue, webhook or checkout has been connected. Record actual provider-test evidence before describing any part of the integration as externally verified.

## Application and environment boundaries

The user supplied Sandbox application ID `sandbox-sq0idb-coifDq2jybhW8YXqBoxAyw`. Select that application in the Square Developer Console and keep its environment toggle on **Sandbox**. The supplied production application ID `sq0idp-D7j5iaD6eNFS0_KiNk3YEA` is recorded for identification only; it is not used to enable billing. Both application IDs are public identifiers, not access tokens, webhook signature keys or location IDs.

Square Sandbox resources and credentials are separate from production resources. Use an Australian Sandbox test seller and test payment details. Never test by charging a real card. Square's Sandbox Dashboard does not send emails, generate receipts, display/edit subscriptions or issue refunds; use the Sandbox APIs or API Explorer to inspect subscriptions and issue test refunds. A stored CGL payment record is not evidence that a receipt email was delivered. See [Square Sandbox](https://developer.squareup.com/docs/devtools/sandbox/overview).

### Verified setup status — 7 November 2026

- Read-only Sandbox API checks verified merchant `MLT5FSYY8VYTM` and active Australian/AUD location `LMV4KAJKXAY6B`. The location currently uses `UTC`, so the Brisbane-midnight cancellation helper requires review and must not claim an exact season-boundary cancellation is supported.
- The initial Sandbox catalogue inventory was empty. One new CGL plan and three new recurring variations have now been created; their exact mapping is recorded below. The production catalogue was not changed.
- Replacement Sandbox credentials were verified with successful API responses and stored securely in Vercel's server environment, together with the Sandbox application ID, merchant/location IDs, webhook URL and signature key. No production access token was used.
- Sandbox webhook `wbhk_69e8f841562846888fb2f22d0c387e87` is enabled at `https://crossodoggolf.com/api/cgl/square-webhook`, using API version `2026-09-16` and the ten events listed below, including `invoice.updated`.
- `CGL_SQUARE_ENVIRONMENT=sandbox`, checkout and explicit Sandbox-testing flags are enabled for the authorised hosted test. `CGL_SQUARE_TERMS_APPROVED=false`; legal and cancellation approval remain false. Live payments and automatic subscription cancellation remain disabled.
- Hosted additive migrations `20261106202122` (CGL foundation) and `20261106202134` (Square Sandbox) are applied. The original seven Auth accounts, 41 Par3 players and 45 fixtures were preserved. Four additional, separate synthetic Sandbox testers were created for the billing checks.
- Current website deployment `dpl_EqrtH9JuzisTHKh4ye47aKFJvsZm` reached `READY` in `sin1`. It includes original-checkout recovery and prevents reusing any checkout with a recorded payment attempt; its source manifest SHA-256 is `948258c3c26f5911d4001c02dab7cd283a304b4067bd56d0967e6e8887ad1982`. Verified external checks and unresolved recurring-provider checks are recorded separately below.

## Verification evidence — 7 November 2026

### Passed against the hosted site and Square Sandbox

| Check | Observed result |
| --- | --- |
| Authenticated hosted checkout creation | Annual, monthly and weekly requests returned HTTP 200 at `24900`, `2995` and `895` AUD cents; casual registration returned HTTP 200 at `2900` cents. Creating a link is not proof of a paid subscription. |
| Recovering a provider link before local attachment | The annual retry recovered the exact original unattached Square link after `IDEMPOTENCY_KEY_REUSED`; it did not create a replacement purchase. |
| Repeating a saved checkout | Repeating the weekly request returned the identical hosted link. |
| Actual casual Sandbox payment | Square returned `COMPLETED`. Official `payment.created` and `payment.updated` notifications each reconciled once. The casual checkout produced exactly one TEST payment and one active TEST registration period. |
| Duplicate signed notification | A separately constructed valid signed notification was posted twice: HTTP 200 with `duplicate: false`, then HTTP 200 with `duplicate: true`. The existing payment remained unchanged. This replay check is separate from the official Square deliveries above. |
| Account ownership | A different member requested sync for the casual checkout and received HTTP 200 with an empty owned-checkout list, exposing no checkout or payment belonging to its owner. |
| Forged signature and protected recovery | Forged webhook signature: HTTP 401. Scheduler call without its credential: HTTP 403. Authenticated scheduler call: HTTP 200. |
| Settled annual Sandbox refund | Square's retrieved refund reached `COMPLETED`, and official refund notifications reconciled it. The annual CGL TEST payment is `refunded`, with `refunded_cents: 24900`. No paid subscription coverage or real entitlement had been granted. |
| Real-entitlement separation | Hosted checks found zero REAL memberships, payments or season entries created by these Sandbox tests. TEST billing did not activate real league access. |
| Existing CGS service checks | Public CGS home, CGL home, memberships, Par3 API and stream returned HTTP 200. The original seven Auth accounts, 41 Par3 players and 45 fixtures were preserved; the four synthetic TEST accounts are additional. |

Checkout URLs and private test-account credentials are deliberately omitted from this evidence. A completed Sandbox transaction is not real collected revenue or proof of a delivered receipt.

### Observed provider behavior and checks still pending

The actual hosted annual and monthly Sandbox checkout simulations created payments, but successful `SearchSubscriptions` calls returned zero subscriptions and no invoices were available. CGL therefore retained these recurring results for review without granting a paid subscription coverage period. The annual payment's later completed refund is recorded separately above. These simulator runs do not verify initial recurring enrolment, renewals or paid invoice coverage.

Two direct native API controls have now completed: an exact-template weekly subscription and a separate provider-only control without phase overrides. Both `CreateSubscription` requests returned HTTP 200 with `ACTIVE`, then changed to `DEACTIVATED` within seconds. Neither produced invoice IDs, a charged-through date or subscription payments. The exact-template case preserved its original phase/template identity; official subscription notifications updated the linked CGL TEST membership to cancelled without a paid-through period. Unrelated provider-only objects remained unmatched rather than being reassigned through an email match.

This observed deactivation is consistent with Square staff's 25 September 2026 confirmation that Sandbox subscription support is incomplete in the [Square Developer Forum discussion](https://developer.squareup.com/forums/t/sandbox-createsubscription-is-immediately-deactivated-before-start-subscription/27964). That same thread includes a reported working hosted payment-link case, so the evidence does not establish that all hosted Sandbox subscriptions are impossible. For this CGL seller and these test runs, however, **paid recurring coverage and renewals remain unverified because the provider did not generate the required subscription invoices/payments**. The native controls themselves are complete, not pending tests.

The next step is Square support confirmation of an accepted Sandbox verification path for this behavior. No live charge is required or authorised as a substitute test by this guide. Any later live payment activation remains a separate user decision and requires explicit authorisation. Renewal failure, billing-boundary behavior and replacement-card handling must not be claimed as provider-verified from link creation, an initial `ACTIVE` status or a standalone payment.

Actual casual **season entry** remains pending because no open CGL season is configured for the hosted test. The casual registration success above does not prove season entry. The isolated tests cover season purchase eligibility and separate TEST entitlements, but no corresponding provider season-entry pass is claimed.

The annual refund was initially `PENDING` and subsequently settled to `COMPLETED`, verified by a Square GET and official refund notifications. Its final CGL state is recorded in the passed-evidence table. This verifies the tested full Sandbox refund path; it is not proof of every partial-refund or live refund scenario.

### Local automated verification

All **167 CGL tests passed**, as did TypeScript checking and targeted lint. These checks cover the rules, database transactions, ownership, replay/idempotency, namespace separation and client behavior represented by the test suites. The final two checks verify that an `OPEN` Square order with a recorded payment attempt is never returned as payable, including recovery before local link attachment. They are local automated evidence; they do not replace the unresolved provider paid-subscription coverage, renewal or hosted season-entry checks above.

## What is implemented

- Authenticated, server-priced quote and checkout routes. Browser-supplied prices are never authoritative; the confirmed price must match the database checkout snapshot.
- Hosted one-off checkout for casual registration and season entry. These requests never contain a subscription plan, so neither purchase automatically renews.
- Hosted recurring checkout for a configured, single-phase, indefinite, fixed-price annual/monthly/weekly Sandbox variation. The adapter retrieves the variation and checks AUD, price and cadence before creating the link. Square handles card entry, card-on-file consent and subscriptions. CGL stores no card number or token; Sandbox receipt delivery is not available.
- A member lock, durable checkout request keys, provider idempotency keys and saved order/link IDs prevent repeated requests creating a second checkout. Existing active or pending full memberships block another subscription. Additional unexpected payments against a completed checkout are flagged for reconciliation and never issue a second entitlement.
- Raw-body HMAC-SHA256 verification using the exact configured notification URL, constant-time signature comparison, merchant/location checks, optional Sandbox-header enforcement and a one-megabyte event limit. A valid notification is durably queued before acknowledgement; provider reads run through the immediate `after()` worker and protected recovery jobs.
- Re-reading provider payments, invoices and subscriptions before processing; event-ID deduplication and atomic payment/entitlement reconciliation. Only completed payments can advance the corresponding Sandbox billing state; test records do not grant real eligibility. `subscription.ACTIVE` alone is not proof of payment. Unmatched identities and amount/currency/customer mismatches remain in an admin review queue.
- Recording failed payments without deleting results or rewards. Failed initial purchases do not establish a paid billing state. The real membership eligibility service must ignore Sandbox records, including their failure/grace states.
- Refund notifications record confirmed refunded amounts and flag entitlement review. Full refunds are recorded as refunded; partial refunds remain completed with `metadata.refunded_cents` for net revenue reporting. An administrator decides any entitlement correction.
- Exact-date and minimum-term provider cancellation remain blocked. The maintenance cancellation helper returns a blocked result and issues no Square cancellation action. A proposed CGL season boundary is never represented as a confirmed provider cancellation.

## Required server environment variables

| Variable                           | Value                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `CGL_SQUARE_APPLICATION_ID`        | Public Sandbox identifier `sandbox-sq0idb-coifDq2jybhW8YXqBoxAyw`; not a secret |
| `CGL_SQUARE_ENVIRONMENT`           | `sandbox` only                                                          |
| `CGL_SQUARE_ACCESS_TOKEN`          | Square application Sandbox access token                                 |
| `CGL_SQUARE_LOCATION_ID`           | AUD Sandbox business location                                           |
| `CGL_SQUARE_MERCHANT_ID`           | Expected Sandbox merchant                                               |
| `CGL_SQUARE_WEBHOOK_SIGNATURE_KEY` | Sandbox endpoint signature key                                          |
| `CGL_SQUARE_WEBHOOK_URL`           | Exact public HTTPS endpoint URL, including its path                     |
| `CGL_SQUARE_CHECKOUT_ENABLED`      | Explicitly enabled for the authorised Sandbox test; not live billing    |
| `CGL_SQUARE_SANDBOX_TESTING_ENABLED` | Explicit opt-in to controlled Sandbox test billing; start `false`      |
| `CGL_SQUARE_TERMS_APPROVED`        | Keep `false`; Sandbox testing does not approve live legal terms |
| `CGL_JOB_SECRET`                  | Independent private secret for the protected maintenance/recovery endpoint |
| `CRON_SECRET`                     | Private Vercel daily recovery credential; at least 32 random characters |

Never prefix these variables with `NEXT_PUBLIC_`. Keep separate Sandbox and eventual live credentials. No production path is provided by this adapter.

The repository's `.env.example` provides empty secret placeholders and disabled checkout flags. Use an isolated database for development tests. The user-authorised hosted integration reuses the existing CGS backend with explicit Sandbox namespaces and no live entitlements; its release evidence is recorded below. The Supabase service-role key remains server-only. Verify the selected database, migration history and backups before applying migrations.

Sandbox payment, subscription and checkout rows must be visibly labelled **TEST** in member/admin views and remain excluded from real competition eligibility, seasonal gifts, reward qualification and collected-revenue reports. A successful Sandbox purchase tests the billing state machine; it is not a real paid membership. Do not merge Sandbox and eventual live rows by customer ID, email or reused external IDs.

Store secrets through the approved server environment settings or a private, ignored local environment file. Do not paste them into committed documentation, screenshots, client code, checkout query strings or chat. Leave checkout, Sandbox-testing and terms-approval flags `false` during initial configuration. An application ID by itself cannot satisfy any missing access-token, merchant, location or signature-key requirement.

Use authenticated, read-only Sandbox requests to verify the token before creating objects:

- `GET /v2/merchants/me` must return the intended test seller. Save its merchant ID as `CGL_SQUARE_MERCHANT_ID`.
- `GET /v2/locations` must contain the chosen active Australian, AUD location, with credit-card processing available. Save its location ID as `CGL_SQUARE_LOCATION_ID`. Verify `Australia/Brisbane` before testing any cancellation date workflow.
- Record the application, merchant, location and environment in the private setup evidence. Never derive a location or merchant ID from the public application ID.

These checks use [RetrieveMerchant](https://developer.squareup.com/reference/square/merchants-api/retrieve-merchant) and [ListLocations](https://developer.squareup.com/reference/square/locations-api/list-locations). A successful connection check still does not prove checkout or entitlement processing works.

## Catalogue mapping without overwriting existing products

Inventory the Sandbox catalogue first using [ListCatalog](https://developer.squareup.com/reference/square/catalog-api/list-catalog), explicitly requesting `SUBSCRIPTION_PLAN,SUBSCRIPTION_PLAN_VARIATION` and following every cursor. Preserve a private export of object IDs, versions, prices and phases. Do not overwrite a variation because its display name resembles a CGL plan, and do not alter or delete unrelated CGS products, taxes, customers or subscriptions.

Use an existing variation only after its ID, owning plan, location availability, single indefinite phase, AUD amount and cadence have been checked. Otherwise create a new, clearly labelled CGL Sandbox plan and new variations. Preserve old versions and use stable provisioning idempotency keys so rerunning setup does not create another catalogue. Store the actual returned variation IDs in `cgl_plans.config.square_plan_variation_id`; retain other configuration properties when saving that mapping.

| CGL plan code | Checkout kind | Required Square cadence | Initial draft price in the foundation migration |
| --- | --- | --- | --- |
| `annual` | Recurring plan variation | `ANNUAL` | AUD 249.00 |
| `monthly` | Recurring plan variation | `MONTHLY` | AUD 29.95 |
| `weekly` | Recurring plan variation | `WEEKLY` | AUD 8.95 |
| `casual_registration` | One-off payment link; no subscription variation | None | AUD 29.00 |
| `casual_season` | One-off payment link for a selected season | None | AUD 100.00 |

These are seed values to review, not approval to sell a membership at those prices. Use the currently approved staging database amount as the source of truth; never overwrite a changed price from this table. The annual cadence spelling is `ANNUAL`, not `YEARLY`. See [SubscriptionCadence](https://developer.squareup.com/reference/square/enums/SubscriptionCadence).

The verified hosted Sandbox mapping uses parent plan `VGM746TQPCEJ3J73ZNMYS3TP`:

| CGL plan code | New Sandbox variation ID | AUD amount in cents | Cadence |
| --- | --- | --- | --- |
| `annual` | `RD7MB5JWIV573CDWDDYMVKED` | `24900` | `ANNUAL` |
| `monthly` | `SMTJ6VANVO6SSGM7YCGNPNQN` | `2995` | `MONTHLY` |
| `weekly` | `WDCF6LPBALMOLD6HY55U27XM` | `895` | `WEEKLY` |

Only new Sandbox objects were created. These identifiers must not be used with a production access token, copied into an eventual live mapping or treated as proof that a customer subscription has been paid.

Square Checkout supports one paid phase or a free phase followed by one paid phase; CGL deliberately accepts only one paid indefinite phase. The checkout field `subscription_plan_id` takes a **variation** ID, despite its name. Initial `price_money` must match the variation; a mismatch can override pricing. Keep custom anchors and proration disabled until the initial and subsequent payments have been tested together. See [Subscription Plan Checkout](https://developer.squareup.com/docs/checkout-api/subscription-plan-checkout).

## Customer and subscription reconciliation

An authenticated CGS account owns the local checkout intent. That ownership must come from the verified CGS session, never a member ID supplied by the browser. Square-hosted subscription checkout separately identifies its customer using the buyer's supplied phone number and can create a new Square customer. CGL does not send optional `buyer_email` prepopulation to Square. The buyer's contact details or an email match are not proof that this Square customer is the signed-in CGS member.

The documented payment-link related resources are `orders` and `subscription_plans`; there is no documented returned `related_resources.subscription_id` to use as the membership key. See [PaymentLinkRelatedResources](https://developer.squareup.com/reference/square/objects/PaymentLinkRelatedResources). A catalogue variation ID identifies the product, not the buyer's subscription.

Reconcile through provider evidence: the saved checkout order or an exact supported checkout reference on a retrieved payment; the invoice's order and tender payment IDs; and the invoice's subscription ID, then the retrieved subscription's customer, variation and location. This is a chain to verify against actual Sandbox responses, not a claim that every hosted checkout emits that chain. [Invoice](https://developer.squareup.com/reference/square/objects/Invoice) documents the invoice's subscription relationship. Customer-based subscription searches can locate candidates, but customer/plan similarity alone cannot grant access or select a subscription when more than one candidate exists.

An `ACTIVE` subscription notification is not a paid invoice. An email match, a phone match, a return to the website, a browser-provided checkout ID or a successful console test notification must never grant paid access. If the initial paid checkout cannot be unambiguously connected to its subscription, retain the event as unmatched/review and reconcile with recorded provider evidence. Do not grant the next billing period by guessing.

## Setup and verification

1. Run the isolated database tests before reviewing the additive CGL foundation and Square migrations for the intended backend. New Square tables and RPCs grant access only to the service role; browser clients cannot set payments or entitlements. The hosted installation below preserves existing CGS accounts and trial records.
2. In the Square Developer Console create/select a Sandbox application, AUD test seller and location. Configure the secrets above in the staging server environment.
3. Create annual, monthly and weekly subscription plan variations. Each must have one indefinite paid phase, static AUD pricing matching the CGL database, and no custom monthly anchor or automatic initial proration. Save each variation ID under the corresponding `cgl_plans.config.square_plan_variation_id`. A plan ID is different from a variation ID.
4. For authorised Sandbox testing, set `CGL_SQUARE_CHECKOUT_ENABLED=true`, `CGL_SQUARE_SANDBOX_TESTING_ENABLED=true` and `cgl_settings.square_sandbox.value.testing_enabled=true`. Keep `CGL_SQUARE_TERMS_APPROVED=false`, the legal approval false and the cancellation policy unapproved. Every checkout still requires the authenticated member to acknowledge the displayed test disclosures. These separate testing gates do not approve real billing or a binding season commitment.
5. Register the exact public `/api/cgl/square-webhook` address in the application's **Sandbox** webhook settings, matching `CGL_SQUARE_WEBHOOK_URL` and API version `2026-09-16`. The hosted URL is recorded above. Subscribe to `payment.created`, `payment.updated`, `subscription.created`, `subscription.updated`, `invoice.payment_made`, `invoice.updated`, `invoice.scheduled_charge_failed`, `invoice.refunded`, `refund.created` and `refund.updated`. `invoice.payment_failed` is not listed in the current official event catalogue; do not depend on it as a subscribed event. The route's defensive acceptance of that name does not establish provider support.
6. Sign into a staging member. `GET /api/cgl/checkout?planCode=casual_registration` returns a current standard-period quote and configuration status. POST with a Bearer token and `{planCode, requestKey: UUID, termsAccepted: true, acceptedAmountCents}`. Casual season entry also requires `seasonId` and a current paid casual registration. The response contains the Square-hosted Sandbox checkout URL.
7. Complete checkout using Square's published Sandbox test details. Returning to the website is not proof of payment. Verify the signed event created exactly one TEST payment and the expected test billing period, without creating real eligibility or gifts. Replay the event; balances and billing dates must not change. Test two simultaneous checkout requests, bad signatures, a mismatched amount, failed payment, refund, and notification arrival before checkout-link persistence.
8. For subscriptions, verify the subscription/invoice/payment link can be reconciled to the initial CGL checkout. Square-hosted checkout determines its own customer identity; CGL does not match accounts by a typed email or customer phone number. If the official payloads cannot establish that chain, the event remains unmatched and requires an administrator's evidence-backed reconciliation. Do not grant a subscription by guessing from the customer or plan alone.
9. Verify the immediate durable webhook worker, protected daily recovery and owned-member sync described below. These process saved billing notifications; they do not automatically cancel subscriptions. `processDueCglSquareCancellations()` remains blocked until the policy and exact provider-date workflow are approved and tested.
10. Reconcile Sandbox order IDs, payment status, subscription/invoice IDs and amounts against CGL's payment history before wider testing. Record each test result below; do not infer that a live provider test passed from local automated tests or an application ID.

## Webhook operating checks

The endpoint must be publicly reachable over HTTPS. Its registered URL and `CGL_SQUARE_WEBHOOK_URL` must match exactly, including path, hostname and trailing slash. Copy the signature key from this Sandbox webhook subscription, not from another environment. Verification uses the raw body plus that exact URL and constant-time HMAC comparison. See [Subscribe to Event Notifications](https://developer.squareup.com/docs/webhooks/step2subscribe) and [Webhook signature verification](https://developer.squareup.com/docs/webhooks/step3validate).

Square may deliver duplicate and out-of-order notifications. Persist the event identity and reconciliation outcome, and preserve rejected/unmatched evidence for review. A configuration-only console test can confirm routing and signature handling; its synthetic IDs need not resolve to real test payments. A complete test must produce a real Sandbox payment and verify its retrieved state before updating CGL.

Monitor delivery latency: Square treats responses taking longer than ten seconds as a timeout. `receiveCglSquareWebhook()` verifies the signature and records the event through `cgl_enqueue_square_event` before the route acknowledges receipt. It does not perform Square resource reads before acknowledgement. Next's `after()` then invokes `processQueuedCglSquareEvents({eventId, limit: 1})` immediately. The worker re-reads provider evidence and reconciles the leased event atomically; a failed worker leaves a recoverable record rather than losing the notification.

The protected `GET /api/cgl/billing/reconcile` recovery route uses a server `CRON_SECRET` of at least 32 random characters. Vercel's configured daily schedule is `14:00 UTC`, which is midnight in Brisbane. It calls `processQueuedCglSquareEvents({limit: 5})`. The existing protected `POST /api/cgl/jobs` also processes up to five queued Square events, using its separate `CGL_JOB_SECRET` credential. No cron or job secret belongs in a browser request or public documentation.

The member's `POST /api/cgl/billing/sync` accepts a verified CGS Bearer session and an optional owned `checkoutId`. `syncCglSquareMember()` scopes the checkout lookup to that member; it does not trust a browser-supplied Square customer, subscription, payment or merchant ID. The clubhouse uses this route on checkout return and for manual refresh. Returning from Square itself is never proof of payment.

The daily job is a recovery fallback, not a promise of timely processing during an outage or growing backlog. Inspect queue state, retries, leases and reconciliation outcomes during the authorised tests. Frequent trusted recovery is needed before any broad live rollout. Prove that duplicates, worker interruption and provider timeouts still produce one test payment/billing period; do not count a repeated event as a new payment.

## End-to-end evidence required before wider Sandbox access

Run the isolated local suites with `npm run test:cgl`, then complete the following against the authorised Sandbox backend and test seller, using the separate synthetic billing testers. Record **not run**, **passed**, or the concrete failure, with redacted provider IDs/timestamps and the inspected CGL records. Local mocked tests, completed migrations and a ready deployment do not satisfy provider payment checks.

| Scenario | Required evidence |
| --- | --- |
| Missing configuration or disabled Sandbox-testing flag | Checkout blocked; no provider link, payment or paid access is assumed. Legal approval remains false during explicit test billing; no live commitment is established. |
| New and existing CGS accounts | Same verified CGS identity through login, CGL profile, checkout ownership and member-only payment history; another account cannot read it. |
| Annual, monthly and weekly signup | Reviewed initial/renewal amount and cadence; exactly one saved intent/order/link; completed TEST payment and confirmed subscription linkage; one correct test billing period, excluded from real entitlements, gifts and revenue. |
| Casual registration then casual season | No recurring subscription for either payment; season purchase requires current casual registration and records the chosen season only. |
| Abandoned checkout or declined initial payment | No paid access or gift qualification; no card details saved by CGL. |
| Browser reload, double click and concurrent requests | Recover one pending checkout; duplicate request keys or signed events never create a second entitlement. |
| Payment arrives before link persistence; invoice/subscription notifications arrive in either order | Safe recovery using verified evidence; unmatched notifications stay reviewable and never create speculative access. |
| Renewal payment and renewal failure | Only the completed test renewal extends TEST paid-through once; failure records TEST past-due state; real eligibility/grace unaffected and no score/credit history erased. |
| Wrong signature, modified body/URL, wrong merchant/location/environment, wrong currency/amount/customer | Request rejected or held for review; no unauthorised access. |
| Foreign or duplicate subscription for the same Square customer | No email/phone-based reassignment; ambiguous identity held for review. |
| Full and partial test refunds via API | Retrieved refund/payment totals recorded once; net revenue correct; entitlement correction explicitly reviewed. |
| Same event replay and timeout retry | Stable payment, credit and entitlement counts/dates; durable event outcome retained. |
| Cancellation request | Exact proposed Brisbane effective date and future payments disclosed; request retained; no claim of provider cancellation until evidence confirms it. |
| Return from checkout before webhook completion | Member sees payment pending and can refresh; success URL alone never changes paid access. |

Use only [Square's current Sandbox payment values](https://developer.squareup.com/docs/devtools/sandbox/payments). Verify renewal behavior through the supported Sandbox/API workflow rather than simulating a calendar change in production. Sandbox has no delivered receipt-email evidence to collect.

## The 13-week commitment is still a policy decision

The proposed season has 13 weeks. That does not automatically make an indefinitely recurring monthly/weekly Square variation a 13-week contract or force cancellation to a particular season boundary. The current local cancellation queue and quote are an administrator review workflow, and accepting a binding request must remain unavailable while policy approval is pending. Confirm the published cancellation policy, minimum commitment, season boundary, remaining charges, late joining, refunds, upgrades, failed-payment grace and renewal disclosures before accepting recurring commitments. Keep policy approval false while those decisions are pending. Preserve each accepted policy version and its exact future boundary; a future policy edit must not silently rewrite an earlier commitment.

Square's standard cancellation ends the active billing cycle; it cannot be presented as proof that a CGL season boundary was enforced. Preserve the approved date and future-payment disclosure, then establish and test a supported provider workflow. See [Pause, Resume, or Cancel Subscriptions](https://developer.squareup.com/docs/subscriptions-api/pause-resume-cancel-subscriptions). Any future live rollout needs a separate review and explicit user approval, even after every Sandbox test passes.

## Deliberately gated limitations

**Prorated initial payments and upgrades:** The shared billing rules calculate proposed proration, but the hosted checkout adapter currently accepts only an exact standard-period price. Square Checkout supports limited phase combinations, and a different `price_money` can override the variation price. Passing a temporary reduced price without a verified subsequent subscription schedule risks recurring undercharging. Custom anchors, automatic proration and configurations marked `proration_required` are blocked. An existing full membership must be reconciled before creating another, preventing parallel subscriptions. A complete prorated upgrade flow still needs a tested saved-card/Subscriptions API workflow and a displayed, persisted quote including the initial payment and following renewal amount/date.

**Credits against membership invoices:** The adapter accepts no browser credit discount and does not mark credit-funded recurring invoices paid. Full and partial credit-funded payment workflows remain disabled until transactional credit reservation, Square invoice reconciliation, failure recovery and correct recurring renewal pricing are implemented together. No arbitrary redemption cap is imposed.

**Payment-method updates:** Square-hosted subscription checkout obtains initial saved-card consent. A CGL self-service replacement-card authorisation workflow has not been implemented. Do not collect card details in ordinary CGL forms; use a supported Square card authorisation flow before updating `card_id`.

**Season-boundary provider cancellation:** The proposed local quote/request workflow remains unavailable for binding Sandbox requests while policy approval is pending. Square's current [Subscription object reference](https://developer.squareup.com/reference/square/objects/Subscription) says `canceled_date` can only be cleared after creation, while the broader management guide describes setting it. The standard cancel endpoint ends the current billing cycle, and the pause endpoint can shift dates inside that cycle. The adapter performs no exact-date update or early cancellation; its maintenance helper returns blocked. Automatic provider enforcement needs a verified workflow aligned to the approved policy and season boundary.

**Cash-plus-credit merchandise:** Rewards and inventory are handled by the CGL rewards ledger; this adapter does not create cash-plus-credit retail orders. It is disabled pending stock reservation and payment/refund reconciliation.

**Communications:** Square Sandbox does not generate receipts or send emails. CGL reminder/confirmation templates use the platform notification queue; neither a queued message nor a stored payment record proves delivery. Eventual live receipt settings require separate verification.

**Live payments:** The adapter has no live Square API path. Hosting a Sandbox integration on the existing CGS website does not enable live billing. Live payment activation requires a separately reviewed implementation and explicit user approval. The release evidence below records any hosted backend or website changes separately.

## Rollback

Disable `CGL_SQUARE_CHECKOUT_ENABLED` first. Preserve all payment, event and entitlement records for reconciliation. Remove the CGL checkout UI/server release before rolling back database objects. Do not drop tables holding payment records; export/retain them and restore the prior release. The extension is additive and does not alter earlier CGS event or trial records.

## Official references checked

- [CreatePaymentLink](https://developer.squareup.com/reference/square/checkout-api/create-payment-link): current hosted checkout endpoint and idempotency contract.
- [Subscription plan checkout](https://developer.squareup.com/docs/checkout-api/subscription-plan-checkout): variation IDs, phase limits and saved-card flow.
- [Subscription billing](https://developer.squareup.com/docs/subscriptions-api/subscription-billing): anchor and proration behaviour.
- [Managing subscriptions](https://developer.squareup.com/docs/subscriptions-api/manage-subscriptions): explicit `canceled_date` versus the end-of-billing-period cancellation endpoint.
- [Webhook verification](https://developer.squareup.com/docs/webhooks/step3validate): raw body, exact notification URL and constant-time HMAC comparison.
- [Square order checkout](https://developer.squareup.com/docs/checkout-api/square-order-checkout): payment customer identity is obtained from the payment, not an assumed order customer.
- [Invoice object](https://developer.squareup.com/reference/square/objects/Invoice): subscription and order reconciliation.
- [Square Sandbox](https://developer.squareup.com/docs/devtools/sandbox/overview): environment isolation and Dashboard/email/receipt limitations.
- [SubscriptionCadence](https://developer.squareup.com/reference/square/enums/SubscriptionCadence): `ANNUAL`, `MONTHLY` and `WEEKLY`.
- [PaymentLinkRelatedResources](https://developer.squareup.com/reference/square/objects/PaymentLinkRelatedResources): documented order and catalogue-plan resources.
- [Webhook event catalogue](https://developer.squareup.com/reference/square/webhooks): actual subscribed event names.

Marketplace discovery was attempted with the Vercel integration categories command, but this environment's npm offline-cache restriction prevented loading the CLI for that command. Square was explicitly selected by CGS; no alternative processor or marketplace service was provisioned.
