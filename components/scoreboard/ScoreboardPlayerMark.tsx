import Image from "next/image";

import type { CompetitionScoreEntry } from "@/lib/scoreboards";

type ScoreboardPlayerMarkProps = {
  entry: CompetitionScoreEntry;
  className: string;
  size?: number;
};

export default function ScoreboardPlayerMark({
  entry,
  className,
  size = 34,
}: ScoreboardPlayerMarkProps) {
  if (!entry.photoUrl && !entry.isCgsMember) {
    return null;
  }

  return (
    <Image
      src={entry.photoUrl || "/cgs-logo.png"}
      alt=""
      width={size}
      height={size}
      className={`${className}${entry.photoUrl ? " is-player-photo" : ""}`}
      aria-hidden="true"
      unoptimized={Boolean(entry.photoUrl)}
    />
  );
}
