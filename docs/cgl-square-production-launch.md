# CGL Square production launch

## Current safe state

The CGL billing code supports two deliberately separate Square environments:

- Sandbox keeps the existing test checkout, webhook and reconciliation flow.
- Production accepts only the one-off `casual_registration` ($29) and `casual_season` ($100) products.
- Annual ($249), monthly ($29.95) and weekly ($8.95) production checkout remains blocked until Square recurring subscriptions, invoices, renewals and cancellation timing are verified.
- Production credentials use dedicated environment variables. Sandbox credentials cannot satisfy production readiness.
- Database production checkout and the Vercel live-payment gate both start disabled.
- A completed, verified Square payment is required before access is granted. A browser return, open order, webhook note or customer email is not proof of payment.

CGS confirmed the pricing and cancellation model on 11 November 2026. Monthly and weekly cancellation takes effect at the next published 13-week season boundary. Annual cancellation takes effect at the end of the paid annual term. The complete customer contract, privacy wording, refund wording and recurring-payment disclosure still need a final published version.

## Launch gates

Complete these in order:

1. Sign in to the Square Developer Console using the CGS production seller account.
2. Confirm the production merchant is active in Australia and the selected location uses AUD and the intended Brisbane timezone.
3. Record the dedicated production application, access token, merchant and location IDs in Vercel. Never reuse Sandbox values.
4. Create a production webhook subscription for `https://crossodoggolf.com/api/cgl/square-webhook`, record its production signature key and enable the payment/order/refund events used by CGL.
5. Publish and approve a versioned customer terms document. Set the same version in the CGL database and `CGL_SQUARE_TERMS_VERSION`.
6. Confirm the first CGL season dates before offering the $100 casual season entry.
7. Verify the production merchant/location connection read-only.
8. Enable one-off production checkout in a controlled window. Keep recurring checkout disabled.
9. With explicit approval immediately before the transaction, make one low-value real one-off purchase using a CGS-owned test customer account.
10. Confirm the payment, webhook, membership activation, receipt reference, admin history and refund/review behaviour end to end.
11. Only after the evidence is retained should one-off checkout remain enabled for customers.

## Environment variables

```text
CGL_SQUARE_ENVIRONMENT=production
CGL_SQUARE_PRODUCTION_APPLICATION_ID=
CGL_SQUARE_PRODUCTION_ACCESS_TOKEN=
CGL_SQUARE_PRODUCTION_LOCATION_ID=
CGL_SQUARE_PRODUCTION_MERCHANT_ID=
CGL_SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY=
CGL_SQUARE_PRODUCTION_WEBHOOK_URL=https://crossodoggolf.com/api/cgl/square-webhook
CGL_SQUARE_CHECKOUT_ENABLED=false
CGL_SQUARE_LIVE_PAYMENTS_ENABLED=false
CGL_SQUARE_LIVE_RECURRING_ENABLED=false
CGL_SQUARE_TERMS_APPROVED=false
CGL_SQUARE_TERMS_VERSION=
```

The application deliberately requires both `CGL_SQUARE_CHECKOUT_ENABLED` and `CGL_SQUARE_LIVE_PAYMENTS_ENABLED`. Recurring checkout additionally requires `CGL_SQUARE_LIVE_RECURRING_ENABLED`, but that final gate must remain false until the provider evidence is complete.

## Rollback

Set `CGL_SQUARE_LIVE_PAYMENTS_ENABLED=false` and redeploy. Existing payment records and webhook history remain available for reconciliation. Do not delete or rewrite completed payments, checkout identities or webhook events. If a payment has already reached Square, disabling checkout does not refund it; process and verify the provider refund separately.

## Remaining owner input

- Square production account sign-in.
- The first 2027 season start and end dates.
- Final version identifier for the published customer terms.
- Explicit confirmation immediately before any real charge or refund.
