# Square support request: CGL recurring verification

## Subject

CGL hosted subscription checkout creates no usable Sandbox invoice or renewal evidence

## Message

Crossodog Golf Society is preparing an Australian, AUD membership service using Square-hosted checkout and the Subscriptions API. Our production launch is blocked until we can verify the complete recurring lifecycle safely.

In our Australian Sandbox seller, hosted checkout for fixed-price annual and monthly subscription variations created payments, but successful subscription searches returned no usable subscription/invoice lifecycle for entitlement reconciliation. We have also observed subscription attempts that became deactivated without producing the invoice and paid-period evidence required by our application.

Could you please confirm the supported verification path for all of the following before we activate recurring production billing?

1. Hosted checkout enrolment into an indefinite fixed-price annual, monthly or weekly subscription.
2. The authoritative invoice/payment fields for proving the paid-through period after the initial charge and each renewal.
3. How to simulate successful renewals, failed renewals and recovery in Sandbox.
4. How a customer payment method can be replaced for a failed subscription payment without our application handling card data.
5. Whether a subscription can be scheduled to cancel on an exact future season-boundary date in the Australia/Brisbane timezone, and which API action/event confirms that schedule.
6. The recommended production validation approach if the full lifecycle cannot be demonstrated in Sandbox.

Our application does not grant access from subscription `ACTIVE` status alone. It requires a completed payment tied to the correct order, invoice, subscription, customer, amount, currency and billing period. Production recurring checkout remains disabled while we seek this confirmation.

We can provide the application ID, Sandbox merchant/location IDs, redacted event timestamps and affected subscription/payment IDs through the private support channel.
