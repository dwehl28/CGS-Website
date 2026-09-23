import type { Metadata } from "next";
import Link from "next/link";

import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminShell, {
  AdminAccessState,
} from "@/components/admin/AdminShell";
import ScorecardStudio from "@/components/admin/ScorecardStudio";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "CGS Scorecard Studio",
    description:
      "Private CGS admin tool for creating branded team scorecards with hole-by-hole net results and scoring marks.",
    path: "/clubhouse-admin/scorecards",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function ScorecardStudioPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Scorecard Studio is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="CGS Scorecard Studio"
        description="Sign in to enter an 18-hole team result and turn it into a finished CGS graphic for Instagram."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  return (
    <AdminShell
      eyebrow="Social graphics"
      title="CGS Scorecard Studio"
      description="Build a complete 18-hole team scorecard with gross and net results, automatic handicap strokes, professional scoring marks, and rotating Instagram designs."
      actions={
        <>
          <Link href="/clubhouse-admin" className="btn-secondary">
            Dashboard
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      <ScorecardStudio />
    </AdminShell>
  );
}
