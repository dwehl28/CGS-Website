# CGL Square production launch

## Current safe state

The CGL billing code supports two deliberately separate Square environments:

- Sandbox keeps the existing test checkout, webhook and reconciliation flow.
- Production supports the one-off `casual_registration` ($29) and `casual_season` ($100) products plus annual ($249), monthly ($29.95) and weekly ($8.95) recurring memberships.
- Annual and weekly memberships charge immediately. Monthly membership is anchored to the first day of the month and Square prorates the initial period.
- Only the $100 casual season pass requires a configured season. Every other product can be purchased at any time.
- Production credentials use dedicated environment variables. Sandbox credentials cannot satisfy production readiness.
- The production application, merchant, AUD location, access token and webhook signature are stored as production-only Vercel settings.
- The production webhook must include payment, refund, subscription and invoice lifecycle events at the exact production notification URL.
- Database and Vercel recurring gates are switched on together only after the production webhook and deployed terms version have been verified.
- A completed, verified Square payment is required before access is granted. A browser return, open order, webhook note or customer email is not proof of payment.

CGS confirmed the pricing and paid-term cancellation model. The recurring purchase terms are published as `cgl-membership-terms-2026-11-20-recurring-v1`, with renewal timing, monthly first-payment proration, payment access, cancellation, refund-support and Australian Consumer Law wording. Annual, monthly and weekly cancellations stop the next renewal at the end of the period already paid for, which matches Square's hosted subscription cancellation workflow.

## Launch gates

Complete these in order:

1. Sign in to the Square Developer Console using the CGS production seller account. **Completed 12 November 2026.**
2. Confirm the production merchant is active in Australia and the selected location uses AUD and `Australia/Brisbane`. **Completed 13 November 2026.**
3. Record the dedicated production application, access token, merchant and location IDs in Vercel. Never reuse Sandbox values. **Completed 12 November 2026.**
4. Create a production webhook subscription for `https://crossodoggolf.com/api/cgl/square-webhook?environment=production`, record its production signature key and enable `payment.created`, `payment.updated`, `refund.created`, `refund.updated`, `subscription.created`, `subscription.updated`, `invoice.payment_made`, `invoice.updated`, `invoice.scheduled_charge_failed` and `invoice.refunded`. The base webhook was created on 12 November 2026; recurring events must be confirmed during launch.
5. Publish a versioned customer terms document. **Published in code as `cgl-membership-terms-2026-11-20-recurring-v1`; production database and environment approval remain part of the controlled launch switch.**
6. Confirm the first CGL season dates before offering the $100 casual season entry.
7. Verify the production merchant/location connection read-only. **Completed 12 November 2026; merchant and AUD location identities matched.**
8. Install the reviewed production plan-variation mappings and paid-term cancellation migration while recurring checkout remains gated off.
9. Deploy the reviewed code and matching terms version while recurring checkout remains gated off.
10. Confirm the production webhook includes the payment, refund, subscription and invoice events listed above.
11. Enable the database and Vercel recurring gates together, redeploy, and confirm each hosted checkout reaches Square in AUD with the correct product and cadence.
12. Stop at Square's payment screen. A real charge or refund requires explicit confirmation immediately before that financial transaction.
13. After an authorised real payment, verify the webhook, membership activation, paid-through date, receipt reference, admin history and cancellation quote end to end.

## Environment variables

```text
CGL_SQUARE_ENVIRONMENT=production
CGL_SQUARE_PRODUCTION_APPLICATION_ID=
CGL_SQUARE_PRODUCTION_ACCESS_TOKEN=
CGL_SQUARE_PRODUCTION_LOCATION_ID=
CGL_SQUARE_PRODUCTION_MERCHANT_ID=
CGL_SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY=
CGL_SQUARE_PRODUCTION_WEBHOOK_URL=https://crossodoggolf.com/api/cgl/square-webhook?environment=production
CGL_SQUARE_CHECKOUT_ENABLED=true
CGL_SQUARE_LIVE_PAYMENTS_ENABLED=true
CGL_SQUARE_LIVE_RECURRING_ENABLED=true
CGL_SQUARE_TERMS_APPROVED=true
CGL_SQUARE_TERMS_VERSION=cgl-membership-terms-2026-11-20-recurring-v1
```

The application deliberately requires both `CGL_SQUARE_CHECKOUT_ENABLED` and `CGL_SQUARE_LIVE_PAYMENTS_ENABLED`. The environment terms version and approved database terms version must both exactly match the version compiled into the deployment. Recurring checkout additionally requires `CGL_SQUARE_LIVE_RECURRING_ENABLED` and the matching database recurring gate. Keep those final recurring gates false until steps 8-10 are complete; the values above describe the launched production target.

## Rollback

Set `CGL_SQUARE_LIVE_PAYMENTS_ENABLED=false` and redeploy. Existing payment records and webhook history remain available for reconciliation. Do not delete or rewrite completed payments, checkout identities or webhook events. If a payment has already reached Square, disabling checkout does not refund it; process and verify the provider refund separately.

## Remaining owner input

- The first 2027 season record is required only before selling the $100 casual season pass.
- Explicit confirmation immediately before any real charge or refund.
