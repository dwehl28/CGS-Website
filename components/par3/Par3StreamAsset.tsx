"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Check, Radio, Trophy } from "lucide-react";

import {
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3KnockoutRounds,
  type Par3Snapshot,
} from "@/lib/par3-showdown-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamView = "banner" | "portrait";

export default function Par3StreamAsset({
  initialSnapshot,
  view,
}: {
  initialSnapshot: Par3Snapshot;
  view: StreamView;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [slideIndex, setSlideIndex] = useState(0);
  const playersById = useMemo(
    () => new Map(snapshot.players.map((player) => [player.id, player])),
    [snapshot.players]
  );
  const pools = useMemo(() => buildPar3Pools(snapshot), [snapshot]);
  const rounds = useMemo(
    () => getPar3KnockoutRounds(snapshot.event.knockoutData),
    [snapshot.event.knockoutData]
  );
  const champion = getPar3Champion(snapshot.event.knockoutData);

  async function refresh() {
    try {
      const response = await fetch("/api/par3-showdown", { cache: "no-store" });
      if (response.ok) setSnapshot((await response.json()) as Par3Snapshot);
    } catch (error) {
      console.error("Par 3 stream refresh error:", error);
    }
  }

  const handleRefresh = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    const pollingInterval = window.setInterval(() => void handleRefresh(), 5_000);
    const supabase = getSupabaseBrowserClient();

    if (!supabase || snapshot.event.id === 0) {
      return () => window.clearInterval(pollingInterval);
    }

    const channel = supabase
      .channel(`par3-stream:${snapshot.event.id}:${view}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cgs_par3_events" },
        () => void handleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_par3_players",
          filter: `event_id=eq.${snapshot.event.id}`,
        },
        () => void handleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_par3_pool_matches",
          filter: `event_id=eq.${snapshot.event.id}`,
        },
        () => void handleRefresh()
      )
      .subscribe();

    return () => {
      window.clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };
  }, [snapshot.event.id, view]);

  useEffect(() => {
    if (view !== "portrait") return;

    const interval = window.setInterval(() => {
      setSlideIndex((current) => current + 1);
    }, 8_000);

    return () => window.clearInterval(interval);
  }, [view]);

  if (view === "banner") {
    const featuredMatches = snapshot.poolMatches
      .filter((match) => match.status === "live")
      .concat(snapshot.poolMatches.filter((match) => match.status === "scheduled"))
      .slice(0, 3);

    return (
      <div className="par3-stream-banner">
        <div className="par3-stream-brand">
          <Image src="/par3/par3-logo.png" alt="CGS Par 3" width={112} height={112} />
          <div>
            <strong>Par 3 Championship</strong>
            <span>{snapshot.event.statusLabel}</span>
          </div>
        </div>
        <div className="par3-stream-banner-matches">
          {featuredMatches.length ? (
            featuredMatches.map((match) => (
              <div key={match.id}>
                <span>
                  {match.status === "live" ? <Radio /> : null}
                  Pool {String.fromCharCode(64 + match.poolNumber)}
                  {match.bayNumber ? ` / Bay ${match.bayNumber}` : ""}
                </span>
                <p>
                  <strong>{playersById.get(match.player1Id)?.name ?? "TBD"}</strong>
                  <small>vs</small>
                  <strong>{playersById.get(match.player2Id)?.name ?? "TBD"}</strong>
                </p>
              </div>
            ))
          ) : (
            <div className="par3-stream-message">
              <span>Next event</span>
              <p>Saturday 12 September / Tee-off 6:00pm</p>
            </div>
          )}
        </div>
        <div className="par3-stream-live-mark">
          <span className={snapshot.event.isLive ? "is-live" : ""} />
          {snapshot.event.isLive ? "Live" : "Tournament centre"}
        </div>
      </div>
    );
  }

  const slideCount = Math.max(1, pools.length + rounds.length);
  const normalizedIndex = slideIndex % slideCount;
  const poolSlide = normalizedIndex < pools.length ? pools[normalizedIndex] : null;
  const roundIndex = normalizedIndex - pools.length;
  const roundSlide = roundIndex >= 0 ? rounds[roundIndex] : null;

  return (
    <div className="par3-stream-portrait">
      <header>
        <Image src="/par3/par3-logo.png" alt="CGS Par 3" width={92} height={92} />
        <div>
          <strong>Par 3 Championship</strong>
          <span>{snapshot.event.statusLabel}</span>
        </div>
      </header>

      <div className="par3-stream-portrait-body" key={normalizedIndex}>
        {poolSlide ? (
          <section className="par3-stream-pool-slide">
            <div className="par3-stream-slide-title">
              <span>Pool standings</span>
              <h2>{poolSlide.label}</h2>
            </div>
            <div>
              {poolSlide.standings.map((standing) => (
                <div key={standing.player.id}>
                  <span>{standing.position}</span>
                  <strong>{standing.player.name}</strong>
                  <small>{standing.wins} pts</small>
                </div>
              ))}
              {!poolSlide.standings.length ? (
                <p className="par3-stream-empty">Pool draw coming soon</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {roundSlide && snapshot.event.knockoutData ? (
          <section className="par3-stream-finals-slide">
            <Trophy />
            <div className="par3-stream-slide-title">
              <span>Finals bracket</span>
              <h2>{roundSlide.label}</h2>
            </div>
            <div>
              {roundSlide.matches.map((match) => {
                const first = getKnockoutParticipantName(
                  snapshot.event.knockoutData!,
                  match.opponent1?.id
                );
                const second = getKnockoutParticipantName(
                  snapshot.event.knockoutData!,
                  match.opponent2?.id
                );

                return (
                  <div key={String(match.id)}>
                    <p className={match.opponent1?.result === "win" ? "is-winner" : ""}>
                      {first}
                      {match.opponent1?.result === "win" ? <Check /> : null}
                    </p>
                    <p className={match.opponent2?.result === "win" ? "is-winner" : ""}>
                      {second}
                      {match.opponent2?.result === "win" ? <Check /> : null}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <footer>
        <span>{champion ? "2026 champion" : "Live tournament data"}</span>
        <strong>{champion ?? "crossodoggolf.com"}</strong>
        <div>
          {Array.from({ length: slideCount }, (_, index) => (
            <i key={index} className={index === normalizedIndex ? "is-active" : ""} />
          ))}
        </div>
      </footer>
    </div>
  );
}
