import type { Metadata } from "next";
import Link from "next/link";

import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminShell, {
  AdminAccessState,
} from "@/components/admin/AdminShell";
import FantasyPointsStudio from "@/components/admin/FantasyPointsStudio";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "CGS Fantasy Points Studio",
    description:
      "Private CGS admin tool for creating branded weekly team fantasy-points graphics.",
    path: "/clubhouse-admin/fantasy-points",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function FantasyPointsStudioPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Fantasy Points Studio is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="CGS Fantasy Points Studio"
        description="Sign in to turn a team's weekly performance into a finished CGS fantasy-points post."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  return (
    <AdminShell
      eyebrow="Weekly social graphics"
      title="CGS Fantasy Points Studio"
      description="Import a completed scorecard, add driving and accuracy stats, then generate a colourful team fantasy-points graphic for Instagram."
      actions={
        <>
          <Link href="/clubhouse-admin/scorecards" className="btn-secondary">
            Scorecard Studio
          </Link>
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
      <FantasyPointsStudio />
    </AdminShell>
  );
}
