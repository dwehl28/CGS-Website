import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import Cgl2027Player, {
  type Cgl2027PlayerData,
} from "@/components/cgl/Cgl2027Player";
import CglPlayerProfile from "@/components/cgl/CglPlayerProfile";
import CglRegisteredPlayer, {
  CglRegisteredPlayerUnavailable,
} from "@/components/cgl/CglRegisteredPlayer";
import { getCglPlayer } from "@/lib/cgl-demo";
import { getCglTrialRoster } from "@/lib/cgl-roster";
import { getCglPublicSnapshot } from "@/lib/cgl-platform";

type PlayerPageProps = { params: Promise<{ username: string }> };

const publicSnapshot = cache(async () => {
  // Keep the dynamic-render boundary outside the error handler. A missing new
  // migration must not interrupt the established trial player pages.
  await connection();
  try {
    return await getCglPublicSnapshot();
  } catch {
    return null;
  }
});

function publicPlayer(
  snapshot: Awaited<ReturnType<typeof publicSnapshot>>,
  username: string,
): Cgl2027PlayerData | null {
  if (!snapshot) return null;
  const matches = (item: { sgt_username?: unknown }) =>
    typeof item.sgt_username === "string" &&
    item.sgt_username.toLowerCase() === username.toLowerCase();
  const results = snapshot.results.filter(matches);
  const standings = snapshot.standings.filter(matches);
  const annual = snapshot.annual.find(matches) ?? null;
  const prizes = snapshot.prizes.filter(matches);
  const found =
    results[0] ??
    standings[0] ??
    annual ??
    prizes[0] ??
    snapshot.players?.find(matches);
  if (!found || typeof found.sgt_username !== "string") return null;
  return {
    username: found.sgt_username,
    results,
    standings,
    annual,
    prizes,
    seasons: snapshot.seasons,
    weeks: snapshot.weeks,
  };
}

export async function generateMetadata({
  params,
}: PlayerPageProps): Promise<Metadata> {
  const { username } = await params;
  const samplePlayer = getCglPlayer(username);
  const [roster, snapshot] = samplePlayer
    ? [null, null]
    : await Promise.all([getCglTrialRoster(), publicSnapshot()]);
  const registeredPlayer = roster?.players.find(
    (player) => player.username.toLowerCase() === username.toLowerCase(),
  );
  const leaguePlayer = publicPlayer(snapshot, username);
  const player = samplePlayer ?? leaguePlayer ?? registeredPlayer;

  return {
    title: player
      ? `${player.username} · CGL Player Stats`
      : "CGL Player Profile",
    description: samplePlayer
      ? "Explore CGL season performance, round history and player statistics. Design preview with sample data."
      : leaguePlayer
        ? "View published CGL competition results, championship points, player statistics and official SGT scorecards."
        : "View this CGL trial player's linked CGL scorecards and SGT statistics.",
    robots: { index: false, follow: false },
  };
}

export default async function CglPlayerPage({ params }: PlayerPageProps) {
  const { username } = await params;
  const samplePlayer = getCglPlayer(username);
  if (samplePlayer)
    return (
      <CglPlayerProfile
        key={samplePlayer.username}
        username={samplePlayer.username}
      />
    );

  const [roster, snapshot] = await Promise.all([
    getCglTrialRoster(),
    publicSnapshot(),
  ]);
  const leaguePlayer = publicPlayer(snapshot, username);

  const registeredPlayer = roster.players.find(
    (player) => player.username.toLowerCase() === username.toLowerCase(),
  );
  if (registeredPlayer)
    return (
      <>
        <CglRegisteredPlayer player={registeredPlayer} />
        {leaguePlayer && leaguePlayer.results.length > 0 ? (
          <Cgl2027Player profile={leaguePlayer} embedded />
        ) : null}
      </>
    );
  if (leaguePlayer) return <Cgl2027Player profile={leaguePlayer} />;
  if (roster.status === "unavailable" || snapshot === null)
    return <CglRegisteredPlayerUnavailable />;
  notFound();
}
