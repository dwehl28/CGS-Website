"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { Check, Radio, RefreshCw, Target, Trophy, Users } from "lucide-react";

import {
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3KnockoutRounds,
  getTeeCategoryLabel,
  type Par3Snapshot,
} from "@/lib/par3-showdown-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type TournamentTab = "pools" | "matches" | "finals";
type SyncState = "connecting" | "connected" | "polling";

const tabs: Array<{
  id: TournamentTab;
  label: string;
  icon: typeof Users;
}> = [
  { id: "pools", label: "Pools", icon: Users },
  { id: "matches", label: "Matches", icon: Radio },
  { id: "finals", label: "Finals", icon: Trophy },
];

export default function Par3LiveTournament({
  initialSnapshot,
}: {
  initialSnapshot: Par3Snapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeTab, setActiveTab] = useState<TournamentTab>(() => {
    if (initialSnapshot.event.currentPhase === "knockout") return "finals";
    if (
      initialSnapshot.event.currentPhase === "pools" ||
      initialSnapshot.event.currentPhase === "ctp"
    ) return "matches";
    return "pools";
  });
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const playersById = useMemo(
    () => new Map(snapshot.players.map((player) => [player.id, player])),
    [snapshot.players]
  );
  const pools = useMemo(() => buildPar3Pools(snapshot), [snapshot]);
  const knockoutRounds = useMemo(
    () => getPar3KnockoutRounds(snapshot.event.knockoutData),
    [snapshot.event.knockoutData]
  );
  const champion = getPar3Champion(snapshot.event.knockoutData);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/par3-showdown", { cache: "no-store" });

      if (!response.ok) return;

      const nextSnapshot = (await response.json()) as Par3Snapshot;
      startTransition(() => setSnapshot(nextSnapshot));
    } catch (error) {
      console.error("Par 3 live refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    const pollingInterval = window.setInterval(() => {
      void handleRealtimeRefresh();
    }, 5_000);
    const supabase = getSupabaseBrowserClient();

    if (!supabase || snapshot.event.id === 0) {
      setSyncState("polling");
      return () => window.clearInterval(pollingInterval);
    }

    const channel = supabase
      .channel(`par3-showdown:${snapshot.event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_par3_events",
          filter: `id=eq.${snapshot.event.id}`,
        },
        () => void handleRealtimeRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_par3_players",
          filter: `event_id=eq.${snapshot.event.id}`,
        },
        () => void handleRealtimeRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_par3_pool_matches",
          filter: `event_id=eq.${snapshot.event.id}`,
        },
        () => void handleRealtimeRefresh()
      )
      .subscribe((status) => {
        setSyncState(status === "SUBSCRIBED" ? "connected" : "connecting");
      });

    return () => {
      window.clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };
  }, [snapshot.event.id]);

  const liveMatches = snapshot.poolMatches.filter(
    (match) => match.status === "live"
  );
  const scheduledMatches = snapshot.poolMatches.filter(
    (match) => match.status === "scheduled"
  );
  const completedMatches = snapshot.poolMatches
    .filter((match) => match.status === "complete" && match.winnerId !== null)
    .slice()
    .reverse();
  return (
    <div className="par3-live-console">
      <div className="par3-live-toolbar">
        <div>
          <div className="par3-live-kicker">
            <span className={snapshot.event.isLive ? "is-live" : ""} />
            {snapshot.event.statusLabel}
          </div>
          <h2>Live tournament centre</h2>
          <p>{snapshot.event.publicMessage}</p>
        </div>
        <button
          type="button"
          className="par3-refresh-button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          title="Refresh tournament results"
          aria-label="Refresh tournament results"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          <span>{syncState === "connected" ? "Live" : "Updating"}</span>
        </button>
      </div>

      <div className="par3-tabs" role="tablist" aria-label="Tournament views">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="par3-tab-panel">
        {activeTab === "pools" ? (
          snapshot.players.length ? (
            <div className="par3-pool-grid">
              {pools.map((pool) => (
                <section key={pool.number} className="par3-pool-table">
                  <div className="par3-pool-heading">
                    <h3>{pool.label}</h3>
                    <span>{pool.players.length} players</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Seed</th>
                        <th>Player</th>
                        <th>P</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.standings.map((standing) => (
                        <tr key={standing.player.id}>
                          <td>{standing.position}</td>
                          <td>
                            <strong>{standing.player.name}</strong>
                            <span>{getTeeCategoryLabel(standing.player.teeCategory)}</span>
                          </td>
                          <td>{standing.played}</td>
                          <td>{standing.wins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Player pools coming soon"
              detail="Confirmed entrants and pool allocations will appear here."
            />
          )
        ) : null}

        {activeTab === "matches" ? (
          snapshot.poolMatches.length ? (
            <div className="par3-match-columns">
              <section>
                <div className="par3-panel-heading">
                  <h3>On now</h3>
                  <span>{liveMatches.length} live</span>
                </div>
                <div className="par3-match-list">
                  {(liveMatches.length ? liveMatches : scheduledMatches.slice(0, 6)).map(
                    (match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        firstName={playersById.get(match.player1Id)?.name ?? "TBD"}
                        secondName={playersById.get(match.player2Id)?.name ?? "TBD"}
                        winnerName={null}
                      />
                    )
                  )}
                </div>
              </section>
              <section>
                <div className="par3-panel-heading">
                  <h3>Results</h3>
                  <span>{completedMatches.length} complete</span>
                </div>
                <div className="par3-match-list">
                  {completedMatches.slice(0, 12).map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      firstName={playersById.get(match.player1Id)?.name ?? "TBD"}
                      secondName={playersById.get(match.player2Id)?.name ?? "TBD"}
                      winnerName={
                        match.winnerId
                          ? (playersById.get(match.winnerId)?.name ?? "TBD")
                          : null
                      }
                    />
                  ))}
                  {!completedMatches.length ? (
                    <p className="par3-inline-empty">No completed matches yet.</p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <EmptyState
              title="Match schedule coming soon"
              detail="Pool fixtures will appear after the draw is confirmed."
            />
          )
        ) : null}

        {activeTab === "finals" ? (
          knockoutRounds.length && snapshot.event.knockoutData ? (
            <div className="par3-bracket-scroll">
              <div className="par3-bracket-grid">
                {knockoutRounds.map((round) => (
                  <section key={String(round.id)}>
                    <h3>{round.label}</h3>
                    <div>
                      {round.matches.map((match) => {
                        const first = getKnockoutParticipantName(
                          snapshot.event.knockoutData!,
                          match.opponent1?.id
                        );
                        const second = getKnockoutParticipantName(
                          snapshot.event.knockoutData!,
                          match.opponent2?.id
                        );

                        return (
                          <div key={String(match.id)} className="par3-bracket-match">
                            <p className={match.opponent1?.result === "win" ? "is-winner" : ""}>
                              <span>{first}</span>
                              {match.opponent1?.result === "win" ? <Check /> : null}
                            </p>
                            <p className={match.opponent2?.result === "win" ? "is-winner" : ""}>
                              <span>{second}</span>
                              {match.opponent2?.result === "win" ? <Check /> : null}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {champion ? (
                <div className="par3-champion">
                  <Trophy />
                  <span>2026 champion</span>
                  <strong>{champion}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Finals bracket not set"
              detail="The top two players from each of the eight pools will form the Round of 16."
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  firstName,
  secondName,
  winnerName,
}: {
  match: Par3Snapshot["poolMatches"][number];
  firstName: string;
  secondName: string;
  winnerName: string | null;
}) {
  return (
    <div className="par3-match-row">
      <div>
        <span>Pool {String.fromCharCode(64 + match.poolNumber)}</span>
        <span>{match.bayNumber ? `Bay ${match.bayNumber}` : `Match ${match.matchNumber}`}</span>
      </div>
      <p>
        <strong className={winnerName === firstName ? "is-winner" : ""}>{firstName}</strong>
        <span>vs</span>
        <strong className={winnerName === secondName ? "is-winner" : ""}>{secondName}</strong>
      </p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="par3-empty-state">
      <Target />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
