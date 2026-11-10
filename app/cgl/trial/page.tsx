import type { Metadata } from "next";
import CglSgtViewer from "@/components/cgl/CglSgtViewer";
import CglTrialPlayers from "@/components/cgl/CglTrialPlayers";
import { getCglTrialRoster } from "@/lib/cgl-roster";

export const metadata: Metadata = { title: "Trial league" };

export default async function CglTrialPage() {
  const roster = await getCglTrialRoster();
  const scorecards = roster.players.flatMap((player) =>
    player.scorecardUrl
      ? [{ username: player.username, url: player.scorecardUrl }]
      : [],
  );
  return (
    <>
      <CglSgtViewer scorecards={scorecards} />
      <CglTrialPlayers roster={roster} />
    </>
  );
}
