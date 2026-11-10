import Link from "next/link";
import { CglHeading } from "@/components/cgl/CglPublicExperience";
import s from "@/components/cgl/Cgl2027.module.css";

const documents = [
  [
    "Membership Terms",
    "Full membership provides access during the paid membership period. Casual registration and season entry are separate purchases. Final eligibility, start dates and inclusions require CGS approval.",
  ],
  [
    "Automatic Renewal Disclosure",
    "Annual, monthly and weekly plans are intended to renew automatically. Casual registration and casual season entry never automatically renew. The exact charge and next billing date must be disclosed before purchase.",
  ],
  [
    "Cancellation Policy",
    "Proposed: monthly and weekly cancellations take effect at the next published 13-week season boundary; annual cancellations take effect at the end of the paid annual term. The proposed minimum commitment and future payments require Australian legal review before live activation.",
  ],
  [
    "Competition Rules",
    "Verified SGT results, locked A/B divisions, published event conditions, points within division and best eight of ten championship weeks. Missing tie details require review. The admin must approve the final rules and countback configuration.",
  ],
  [
    "Prize Conditions",
    "Weekly net, gross and CTP prizes compare all eligible divisions, with one prize per player. Season prizes require published eligibility and approval. Physical prizes may be claimed until the end of the following season. Credits follow their own expiry dates.",
  ],
  [
    "CGS Credits Terms",
    "Promotional credits are non-transferable and cannot be withdrawn as cash. Credits expire 18 months after each issue date and remain with the account after membership cancellation. Available catalogue items show their exact credit price and conditions.",
  ],
  [
    "Privacy Policy",
    "Public CGL results use SGT usernames. Contact information, billing records, internal notes and credit transactions are private. SGT and Square process information needed for their respective services. The CGL-specific data handling policy requires approval.",
  ],
  [
    "Refund and Consumer Rights",
    "A final refund policy must preserve rights under applicable Australian consumer law and explain billing errors, cancellations and competition changes. This review screen does not replace legal advice or an approved customer contract.",
  ],
];
export default function CglTermsPage() {
  return (
    <div className={s.page}>
      <CglHeading label="Policy review" title="Before the season opens.">
        Draft policy summaries for CGS review. These are not legally approved
        membership terms.
      </CglHeading>
      <div className={s.notice}>
        Live billing and formal membership commitments remain disabled until CGS
        approves final documents following the required legal review.
      </div>
      <div className={s.grid2}>
        {documents.map(([title, text]) => (
          <article className={s.panel} key={title}>
            <span className={s.badge}>Awaiting approval</span>
            <h2 style={{ marginTop: 16 }}>{title}</h2>
            <p>{text}</p>
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
