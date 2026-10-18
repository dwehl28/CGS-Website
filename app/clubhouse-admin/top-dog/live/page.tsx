import type { Metadata } from "next";
import Link from "next/link";

import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import LeagueNightControlCentre from "@/components/top-dog/LeagueNightControlCentre";
import TopDogProductionDesk from "@/components/top-dog/TopDogProductionDesk";
import { hasAdminSecretConfigured, isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminTopDogProductionFeed } from "@/lib/top-dog-production";
import { getAdminTopDogSnapshot } from "@/lib/top-dog";

type TopDogLivePageProps = {
  searchParams: Promise<{
    round?: string | string[];
    panel?: string | string[];
    success?: string | string[];
    error?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Dog League Night Control | CGS Admin",
  robots: { index: false, follow: false },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TopDogLivePage({ searchParams }: TopDogLivePageProps) {
  const authenticated = hasAdminSecretConfigured()
    ? await isAdminAuthenticated()
    : false;

  if (!authenticated) {
    return (
      <AdminAccessState
        eyebrow="Private operations"
        title="Top Dog League Control"
        description="Sign in with the existing CGS admin account to run league-night fixtures, ladders, and broadcast graphics."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const query = await searchParams;
  const requestedRoundId = Number(firstValue(query.round));
  const roundId = Number.isInteger(requestedRoundId) ? requestedRoundId : null;
  const initialProductionTab = firstValue(query.panel) === "people" ? "people" : "live";
  const feed = await getAdminTopDogSnapshot({ roundId });
  const productionFeed = feed.snapshot
    ? await getAdminTopDogProductionFeed(feed.snapshot)
    : { snapshot: null, warningMessage: null };
  const successMessage = firstValue(query.success);
  const errorMessage = firstValue(query.error);

  return (
    <AdminShell
      eyebrow="Monday night command desk"
      title="Top Dog League Night Control"
      description="One live operating surface for fixtures, head-to-head scores, holes, ladder implications, and every OBS graphic Butters needs during league night."
      actions={
        <>
          {feed.snapshot ? (
            <>
              <Link href="#broadcast-assets" className="btn-secondary">
                All broadcast assets
              </Link>
              <Link href="#fixture-manager" className="btn-secondary">
                Manage fixtures
              </Link>
              <Link
                href={`/clubhouse-admin/top-dog/live?round=${feed.snapshot.selectedRound?.id ?? ""}&panel=people#player-rosters`}
                className="btn-secondary"
              >
                Players & rosters
              </Link>
            </>
          ) : null}
          <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
            Existing scoreboards
          </Link>
        </>
      }
    >
      {successMessage ? (
        <div className="top-dog-page-notice is-success">{successMessage}</div>
      ) : null}
      {errorMessage ? (
        <div className="top-dog-page-notice is-error">{errorMessage}</div>
      ) : null}
      {feed.warningMessage ? (
        <div className="top-dog-page-notice is-error">{feed.warningMessage}</div>
      ) : null}
      {productionFeed.warningMessage ? (
        <div className="top-dog-page-notice is-error">{productionFeed.warningMessage}</div>
      ) : null}

      {feed.snapshot ? (
        <>
          <LeagueNightControlCentre initialSnapshot={feed.snapshot} />
          {productionFeed.snapshot ? (
            <TopDogProductionDesk
              key={`${feed.snapshot.selectedRound?.id ?? "no-round"}-${initialProductionTab}`}
              core={feed.snapshot}
              initialProduction={productionFeed.snapshot}
              initialTab={initialProductionTab}
            />
          ) : null}
        </>
      ) : (
        <section className="panel rounded-[2rem] p-8 md:p-10">
          <h2 className="text-3xl">League Control is ready for its database foundation</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-300">
            No existing competition data has been changed. Apply the new additive migration and
            this page will import the current Top Dog scoreboard team names into the canonical
            team directory automatically.
          </p>
        </section>
      )}
    </AdminShell>
  );
}
