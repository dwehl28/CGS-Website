# Stripe setup

This project now has a hidden on-site Stripe checkout foundation for CGS.

## Environment variables

Add these values locally and in Vercel when you are ready to connect the real Stripe account:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Current draft checkout routes

These routes are scaffolded but intentionally not linked publicly yet:

- `/checkout/playing-member`
- `/checkout/cgs-major-entry`
- `/checkout/movember-support`

## How to switch a payment option on

1. Open `D:\cgs-website\lib\payments-catalog.ts`.
2. Set the product `status` to `ready`.
3. Add the final `amountInCents`.
4. Decide where the public button or link should point.
5. Add the public link on the relevant page.

## Before going live

- Add real Stripe live keys to local and Vercel environments.
- Register `crossodoggolf.com` in Stripe for wallets like Apple Pay if you want them later.
- Configure a webhook and order/fulfilment handling once real products go live.
