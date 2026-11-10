import { notFound } from "next/navigation";
import Cgl2027Player from "@/components/cgl/Cgl2027Player";
import { createCglPreviewSnapshot } from "@/scripts/cgl-preview-snapshot";
export default async function FixturePlayer({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = createCglPreviewSnapshot();
  const player = data.players.find(
    (item) => item.sgt_username.toLowerCase() === username.toLowerCase(),
  );
  if (!player) notFound();
  const matches = (item: { sgt_username: string }) =>
    item.sgt_username === player.sgt_username;
  return (
    <Cgl2027Player
      profile={{
        preview: true,
        username: player.sgt_username,
        results: data.results.filter(matches),
        standings: data.standings.filter(matches),
        prizes: data.prizes.filter(
          (item) => item.sgt_username === player.sgt_username,
        ),
        annual: null,
        seasons: data.seasons,
        weeks: data.weeks,
      }}
    />
  );
}
