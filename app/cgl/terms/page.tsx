import Link from "next/link";
import { CglHeading } from "@/components/cgl/CglPublicExperience";
import s from "@/components/cgl/Cgl2027.module.css";
import {
  CGL_MEMBERSHIP_TERMS_EFFECTIVE_DATE,
  CGL_MEMBERSHIP_TERMS_VERSION,
} from "@/lib/cgl-terms";
import { siteConfig } from "@/lib/site-content";

const documents = [
  {
    title: "$29 Casual Registration",
    status: "Available at launch",
    text: "A one-off payment in Australian dollars gives the registered member 12 months of Casual Registration from verified payment. It does not automatically renew and is not tied to one season. Simulator hire, SGT access and individual season entry are separate unless expressly included in a published offer.",
  },
  {
    title: "$100 Season Pass",
    status: "Requires an open season",
    text: "A Season Pass is a separate one-off payment in Australian dollars for the selected published season. It does not automatically renew. A current Casual Registration and the relevant competition eligibility requirements are also required. It cannot be purchased until CGS opens a season for registration.",
  },
  {
    title: "Recurring memberships",
    status: "Available now",
    text: "The $249 Annual Membership is charged when purchased and renews each year on the purchase anniversary. The $8.95 Weekly Membership is charged when purchased and renews every seven days. Both continue until cancelled. These memberships can be purchased at any time and are not tied to one season.",
  },
  {
    title: "$29.95 Monthly Membership",
    status: "Renews on the first of each month",
    text: "The standard monthly price is $29.95 AUD. When joining after the first day of a month, Square may charge a smaller prorated amount for access from the purchase date to the next first of the month. Square displays that first charge before payment. After that, $29.95 is charged automatically on the first day of each month until cancelled.",
  },
  {
    title: "Payment and activation",
    status: "Secure Square checkout",
    text: "Square processes the payment in AUD. CGS activates access only after Square confirms a completed payment; returning to the CGS website is not proof of payment. If the price changes before payment, the customer must review a fresh quote. Duplicate, incomplete or unmatched payments are held for review rather than granting unverified access.",
  },
  {
    title: "Eligibility and fair use",
    status: "Account holder responsibility",
    text: "The member must provide accurate account information and comply with published competition, conduct and eligibility rules. A purchase does not guarantee entry after a deadline, access to a full event, a prize, simulator hire or SGT services. CGS may suspend access for fraud, chargeback abuse or serious rule breaches while preserving any rights that apply under law.",
  },
  {
    title: "Changes, cancellations and refunds",
    status: "Consumer rights preserved",
    text: "A recurring membership can be cancelled from the member dashboard. Cancellation stops the next automatic renewal at the end of the current paid billing period, and access remains available until that paid-through date. Cancellation does not automatically refund the current paid period. One-off purchases do not need an automatic-renewal cancellation. Contact CGS promptly about a duplicate charge, payment error, inability to access a purchased service or a materially changed or cancelled event. Nothing in these terms excludes, restricts or modifies rights or remedies that cannot lawfully be excluded under the Australian Consumer Law.",
  },
  {
    title: "Privacy and records",
    status: "Minimum payment data",
    text: "Square handles the payment form and card details. CGS stores the amount, currency, payment status, provider references, membership entitlement and the version of these terms accepted for the purchase. CGS uses those records to provide access, issue support, prevent duplicate activation and reconcile refunds or disputes. See the CGS privacy page for more information.",
  },
];
export default function CglTermsPage() {
  return (
    <div className={s.page}>
      <CglHeading label="Membership purchase terms" title="Clear before you pay.">
        These terms apply to CGL membership purchases from Crossodog Golf
        Society. Review the product, amount and inclusions shown at checkout
        before authorising payment.
      </CglHeading>
      <div className={s.notice}>
        <strong>Effective {CGL_MEMBERSHIP_TERMS_EFFECTIVE_DATE}</strong>
        {" · "}Version {CGL_MEMBERSHIP_TERMS_VERSION}. Seller: Crossodog Golf
        Society (CGS). All prices and charges are in Australian dollars.
      </div>
      <div className={s.grid2}>
        {documents.map((document) => (
          <article className={s.panel} key={document.title}>
            <span className={s.badge}>{document.status}</span>
            <h2 style={{ marginTop: 16 }}>{document.title}</h2>
            <p>{document.text}</p>
          </article>
        ))}
      </div>
      <article className={s.panel} style={{ marginTop: 24 }}>
        <h2>Support and agreement</h2>
        <p>
          By ticking the terms box and continuing to Square, you confirm that
          you have reviewed the displayed product, AUD amount and these terms.
          The terms version is saved with the checkout record. Future changes
          apply to future purchases, not retrospectively to a completed
          purchase unless required by law or agreed with you.
        </p>
        <p>
          For billing, access, cancellation or refund help, email{" "}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. Please
          include the email used for your CGS account and your receipt or
          payment reference, but never send card details by email.
        </p>
      </article>
      <div className={s.actions}>
        <Link className={s.secondary} href="/privacy">
          CGS privacy policy
        </Link>
        <Link className={s.secondary} href="/cgl/memberships">
          Memberships
        </Link>
      </div>
    </div>
  );
}
