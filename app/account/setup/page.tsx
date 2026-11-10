import type { Metadata } from "next";

import AccountSetup from "@/components/account/AccountSetup";

export const metadata: Metadata = {
  title: "Set your CGS password",
  description: "Choose a password to finish setting up your CGS account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AccountSetupPage() {
  return <AccountSetup />;
}
