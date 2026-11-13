import Link from "next/link";
import { CglHeading } from "@/components/cgl/CglPublicExperience";
import s from "@/components/cgl/Cgl2027.module.css";

const documents = [
  {
    title: "Confirmed pricing",
    status: "CGS confirmed",
    text: "All prices are AUD. Annual membership is $249 per year, monthly is $29.95 per month and weekly is $8.95 per week. Casual registration is a $29 one-off purchase lasting one year, and the Season Pass is a separate $100 one-off purchase.",
  },
  {
    title: "Membership terms",
    status: "Final document pending",
    text: "Annual, monthly, weekly and casual registration can be purchased at any time and are not linked to one specific season. Only the separate $100 Season Pass requires an open season to be selected. Final eligibility, season dates, inclusions and the complete customer contract still require publication and approval before live sales open.",
  },
  {
    title: "Automatic renewal disclosure",
    status: "Recurring launch blocked",
    text: "Annual, monthly and weekly plans are intended to renew automatically. Casual registration and casual season entry never automatically renew. The exact charge and next billing date must be displayed before purchase. Recurring production checkout stays disabled until this provider flow is verified.",
  },
  {
    title: "Cancellation policy",
    status: "CGS confirmed",
    text: "Monthly and weekly cancellations take effect at the next published 13-week season boundary. Annual cancellation takes effect at the end of the paid annual term. The membership centre must show the effective date and remaining scheduled payments before a request is submitted.",
  },
  {
    title: "Competition and prize rules",
    status: "Final rules pending",
    text: "Verified SGT results, locked A/B divisions, published conditions, points within division and the best eight of ten championship weeks form the current competition model. Countback, prize eligibility and claim conditions must be finalised before the season is published.",
  },
  {
    title: "CGS Credits terms",
    status: "Final document pending",
    text: "The current model makes promotional credits non-transferable and not redeemable as cash. Credits expire 18 months after each issue and remain with the account after cancellation. Final catalogue and consumer wording still require approval.",
  },
  {
    title: "Privacy, refunds and consumer rights",
    status: "Final document pending",
    text: "Contact details, billing records, internal notes and credit transactions remain private. Final privacy and refund documents must explain Square and SGT data use, billing errors, cancellations, competition changes and all applicable Australian consumer rights.",
  },
];
export default function CglTermsPage() {
  return (
    <div className={s.page}>
      <CglHeading label="Launch policy" title="Clear before anyone pays.">
        CGS has confirmed the prices and cancellation timing. The complete
        customer terms and recurring-payment flow are still being finalised.
      </CglHeading>
      <div className={s.notice}>
        Live checkout remains disabled until the final documents, Square
        production account and launch checks are approved. This page records
        the current CGS position; it is not legal advice or the final customer
        contract.
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
      <div className={s.actions}>
        <Link className={s.secondary} href="/privacy">
          Existing CGS privacy policy
        </Link>
        <Link className={s.secondary} href="/cgl/memberships">
          Memberships
        </Link>
      </div>
    </div>
  );
}
