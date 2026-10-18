"use client";

import Link from "next/link";
import {
  type FormEvent,
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import {
  Award,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  Flag,
  Gift,
  Mic2,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";

import type {
  TopDogChecklistItem,
  TopDogClipTag,
  TopDogInterviewType,
  TopDogProductionFeed,
  TopDogProductionSnapshot,
  TopDogSegmentType,
} from "@/lib/top-dog-production";
import type { TopDogSnapshot } from "@/lib/top-dog";

type ProductionTab = "live" | "people" | "wrap";

type TopDogProductionDeskProps = {
  core: TopDogSnapshot;
  initialProduction: TopDogProductionSnapshot;
  initialTab?: ProductionTab;
};

const clipTags: Array<{ value: TopDogClipTag; label: string }> = [
  { value: "great_shot", label: "Great Shot" },
  { value: "fail", label: "Fail" },
  { value: "celebration", label: "Celebration" },
  { value: "bunker_boy", label: "Bunker Boy" },
  { value: "trash_talk", label: "Trash Talk" },
  { value: "interview", label: "Interview" },
  { value: "one_putt", label: "One-Putt" },
  { value: "sponsor", label: "Sponsor" },
  { value: "funny_moment", label: "Funny Moment" },
  { value: "other", label: "Other" },
];

const prizeCategories = [
  ["best_team", "Best Performing Team"],
  ["longest_drive", "Longest Drive"],
  ["ctp", "Closest to Pin"],
  ["bunker_boy", "Bunker Boy"],
  ["shot_of_night", "Shot of the Night"],
  ["player_of_night", "Player of the Night"],
  ["sponsor_prize", "Sponsor Prize"],
  ["custom", "Custom Category"],
] as const;

const interviewTypes: Array<[TopDogInterviewType, string]> = [
  ["pre_match", "Pre Match"],
  ["post_match", "Post Match"],
  ["winner", "Winner"],
  ["prize_winner", "Prize Winner"],
  ["other", "Other"],
];

const segmentTypes: Array<[TopDogSegmentType, string]> = [
  ["doghouse", "The Doghouse"],
  ["shot_of_night", "Shot of the Night"],
  ["butters_board", "Butters' Board"],
  ["stat_of_week", "Stat of the Week"],
];

const fulfilmentFields = [
  ["logo_displayed", "logoDisplayed", "Logo displayed"],
  ["verbal_mention", "verbalMention", "Verbal mention"],
  ["product_shown", "productShown", "Product shown"],
  ["promo_code_shown", "promoCodeShown", "Promo code shown"],
  ["winner_photographed", "winnerPhotographed", "Winner photographed"],
  ["sponsor_tagged", "sponsorTagged", "Sponsor tagged"],
  ["social_post_completed", "socialPostCompleted", "Social post completed"],
] as const;

function formatClock(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function nullableNumber(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getPlayerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CG";
}

function getAvatarStyle(avatarUrl: string): React.CSSProperties | undefined {
  return avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
    : undefined;
}

function PanelHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <header className="td-production-heading">
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {icon}
    </header>
  );
}

function ChecklistColumn({
  phase,
  items,
  pending,
  onToggle,
}: {
  phase: TopDogChecklistItem["phase"];
  items: TopDogChecklistItem[];
  pending: boolean;
  onToggle: (item: TopDogChecklistItem) => void;
}) {
  const complete = items.filter((item) => item.isComplete).length;

  return (
    <section className="td-checklist-column">
      <header>
        <span>{phase} stream</span>
        <strong>{complete} / {items.length}</strong>
      </header>
      <div>
        {items.map((item) => (
          <label key={item.id} className={item.isComplete ? "is-complete" : ""}>
            <input
              type="checkbox"
              checked={item.isComplete}
              onChange={() => onToggle(item)}
              disabled={pending}
            />
            <i>{item.isComplete ? <Check aria-hidden="true" /> : null}</i>
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function TopDogProductionDesk({
  core,
  initialProduction,
  initialTab = "live",
}: TopDogProductionDeskProps) {
  const [production, setProduction] = useState(initialProduction);
  const [activeTab, setActiveTab] = useState<ProductionTab>(initialTab);
  const [selectedClipTag, setSelectedClipTag] = useState<TopDogClipTag>("great_shot");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const roundId = core.selectedRound?.id ?? production.roundId;
  const basePayload = {
    seasonId: core.season.id,
    seasonSlug: core.season.slug,
    roundId,
  };

  async function runAction(
    payload: Record<string, unknown>,
    successMessage: string,
    options?: { confirm?: string }
  ) {
    if (!roundId) {
      setErrorMessage("Select a league night before using the production desk.");
      return false;
    }

    if (options?.confirm && !window.confirm(options.confirm)) {
      return false;
    }

    setPending(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/top-dog/production", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, ...payload }),
      });
      const feed = (await response.json()) as TopDogProductionFeed & { message?: string };

      if (!response.ok || !feed.snapshot) {
        throw new Error(feed.message ?? feed.warningMessage ?? "The live production update failed.");
      }

      startTransition(() => setProduction(feed.snapshot!));
      setMessage(successMessage);
      window.setTimeout(() => setMessage(""), 3500);
      return true;
    } catch (error) {
      console.error("Top Dog production control error:", error);
      setErrorMessage(error instanceof Error ? error.message : "The live production update failed.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function refreshProduction() {
    if (!roundId || pending) {
      return;
    }

    const params = new URLSearchParams({
      season: core.season.slug,
      seasonId: String(core.season.id),
      round: String(roundId),
    });

    try {
      const response = await fetch(`/api/admin/top-dog/production?${params}`, {
        cache: "no-store",
      });
      const feed = (await response.json()) as TopDogProductionFeed;

      if (response.ok && feed.snapshot) {
        startTransition(() => setProduction(feed.snapshot!));
      }
    } catch (error) {
      console.error("Top Dog production refresh error:", error);
    }
  }

  const handleFallbackRefresh = useEffectEvent(() => {
    void refreshProduction();
  });

  useEffect(() => {
    const interval = window.setInterval(handleFallbackRefresh, 20000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialTab !== "people") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("player-rosters")?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialTab]);

  async function handleMarkClip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const profileId = nullableString(formData.get("profile_id"));
    const player = production.players.find((item) => item.profileId === profileId);
    const saved = await runAction(
      {
        action: "mark_clip",
        tag: selectedClipTag,
        fixtureId: nullableNumber(formData.get("fixture_id")),
        profileId,
        teamId: player?.teamId ?? nullableNumber(formData.get("team_id")),
        playerName: player?.displayName ?? String(formData.get("player_name") ?? ""),
        note: String(formData.get("note") ?? ""),
      },
      `${titleCase(selectedClipTag)} marked at ${formatClock(new Date().toISOString())}.`
    );

    if (saved) {
      form.reset();
    }
  }

  async function handlePrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const profileId = nullableString(formData.get("profile_id"));
    const player = production.players.find((item) => item.profileId === profileId);
    const teamId = player?.teamId ?? nullableNumber(formData.get("team_id"));
    const team = core.seasonTeams.find((item) => item.team.id === teamId)?.team;
    const saved = await runAction(
      {
        action: "save_prize",
        category: String(formData.get("category")),
        customCategory: String(formData.get("custom_category") ?? ""),
        profileId,
        teamId,
        displayName:
          player?.displayName || String(formData.get("display_name") ?? "").trim() || team?.name || "",
        resultValue: String(formData.get("result_value") ?? ""),
        prize: String(formData.get("prize") ?? ""),
        sponsorId: nullableNumber(formData.get("sponsor_id")),
        notes: String(formData.get("notes") ?? ""),
        winnerStatus: String(formData.get("winner_status")),
      },
      "Prize tracker updated."
    );

    if (saved) {
      form.reset();
    }
  }

  async function handleSponsor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const saved = await runAction(
      {
        action: "save_sponsor",
        name: String(formData.get("name") ?? ""),
        logoUrl: String(formData.get("logo_url") ?? ""),
        websiteUrl: String(formData.get("website_url") ?? ""),
        promoCode: String(formData.get("promo_code") ?? ""),
        prizeSupplied: String(formData.get("prize_supplied") ?? ""),
        campaign: String(formData.get("campaign") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      },
      "Sponsor saved to the CGS directory."
    );

    if (saved) {
      form.reset();
    }
  }

  async function handleActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const saved = await runAction(
      {
        action: "save_activation",
        sponsorId: Number(formData.get("sponsor_id")),
        campaign: String(formData.get("campaign") ?? ""),
        prizeSupplied: String(formData.get("prize_supplied") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      },
      "Sponsor added to this league night."
    );

    if (saved) {
      form.reset();
    }
  }

  async function handleInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const profileId = nullableString(formData.get("profile_id"));
    const player = production.players.find((item) => item.profileId === profileId);
    const teamId = player?.teamId ?? nullableNumber(formData.get("team_id"));
    const team = core.seasonTeams.find((item) => item.team.id === teamId)?.team;
    const playerName = player?.displayName || String(formData.get("player_name") ?? "").trim();

    if (!playerName) {
      setErrorMessage("Choose a linked player or enter a player name for the interview.");
      return;
    }

    const saved = await runAction(
      {
        action: "save_interview",
        fixtureId: nullableNumber(formData.get("fixture_id")),
        profileId,
        teamId,
        playerName,
        teamLabel: team?.name || String(formData.get("team_label") ?? ""),
        interviewType: String(formData.get("interview_type")),
        notes: String(formData.get("notes") ?? ""),
      },
      "Interview queued with suggested questions."
    );

    if (saved) {
      form.reset();
    }
  }

  async function runProfileRequest(
    method: "POST" | "PATCH" | "DELETE",
    body: FormData | string,
    successMessage: string
  ) {
    if (!roundId) {
      setErrorMessage("Select a league night before managing player profiles.");
      return false;
    }

    setPending(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/top-dog/profiles", {
        method,
        headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const feed = (await response.json()) as TopDogProductionFeed & { message?: string };

      if (!response.ok || !feed.snapshot) {
        throw new Error(feed.message ?? feed.warningMessage ?? "The player profile update failed.");
      }

      startTransition(() => setProduction(feed.snapshot!));
      setMessage(successMessage);
      window.setTimeout(() => setMessage(""), 3500);
      return true;
    } catch (error) {
      console.error("Top Dog player profile error:", error);
      setErrorMessage(error instanceof Error ? error.message : "The player profile update failed.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function addProfileContext(formData: FormData) {
    formData.set("season_id", String(core.season.id));
    formData.set("season_slug", core.season.slug);
    formData.set("round_id", String(roundId));
    return formData;
  }

  async function handleProfileCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const displayName = String(new FormData(form).get("display_name") ?? "Player");
    const saved = await runProfileRequest(
      "POST",
      addProfileContext(new FormData(form)),
      `${displayName} added to the CGS player directory.`
    );

    if (saved) {
      form.reset();
    }
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const displayName = String(formData.get("display_name") ?? "Player");
    await runProfileRequest(
      "PATCH",
      addProfileContext(formData),
      `${displayName}'s profile and team link were updated.`
    );
  }

  async function handleProfileDelete(profileId: string, displayName: string) {
    if (!roundId || !window.confirm(
      `Delete ${displayName}'s manually managed profile? This also removes their team link. This cannot be undone.`
    )) {
      return;
    }

    await runProfileRequest(
      "DELETE",
      JSON.stringify({
        seasonId: core.season.id,
        seasonSlug: core.season.slug,
        roundId,
        profileId,
      }),
      `${displayName}'s manually managed profile was deleted.`
    );
  }

  async function handleSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await runAction(
      {
        action: "save_segment",
        segmentType: String(formData.get("segment_type")),
        title: String(formData.get("title") ?? ""),
        primaryText: String(formData.get("primary_text") ?? ""),
        secondaryText: String(formData.get("secondary_text") ?? ""),
        status: formData.get("confirmed") ? "confirmed" : "draft",
      },
      "Recurring segment saved."
    );
  }

  async function handleJackpotSelect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const profileId = nullableString(formData.get("profile_id"));
    const player = production.players.find((item) => item.profileId === profileId);
    const playerName = player?.displayName || String(formData.get("player_name") ?? "").trim();

    await runAction(
      {
        action: "jackpot",
        command: "select",
        profileId,
        teamId: player?.teamId ?? nullableNumber(formData.get("team_id")),
        playerName,
      },
      `${playerName || "Player"} selected for the One-Putt Challenge.`
    );
  }

  const topStanding = core.projectedLadder[0];
  const tiedAtTop = topStanding
    ? core.projectedLadder.filter(
        (standing) =>
          standing.points === topStanding.points &&
          standing.differential === topStanding.differential
      ).length > 1
    : false;
  const bestTeamLabel = tiedAtTop ? "Tied" : topStanding?.team.name ?? "TBC";
  const checklistGroups = (["before", "during", "after"] as const).map((phase) => ({
    phase,
    items: production.checklist.filter((item) => item.phase === phase),
  }));

  return (
    <section className="td-production-desk">
      <header className="td-production-hero">
        <div>
          <span>League night operations</span>
          <h2>Production & Content Desk</h2>
          <p>
            Run prizes, the One-Putt Jackpot, interviews, sponsor fulfilment, clips,
            recurring segments, and the final recap without leaving League Control.
          </p>
        </div>
        <div className="td-production-hero-facts">
          <div><b>{production.clips.length}</b><span>clips marked</span></div>
          <div><b>{production.prizes.length}</b><span>prizes tracked</span></div>
          <div><b>{bestTeamLabel}</b><span>best team live</span></div>
        </div>
      </header>

      <nav className="td-production-tabs" aria-label="Production desk sections">
        <button
          type="button"
          className={activeTab === "live" ? "is-active" : ""}
          onClick={() => setActiveTab("live")}
        >
          <Zap aria-hidden="true" /> Live Desk
        </button>
        <button
          type="button"
          className={activeTab === "people" ? "is-active" : ""}
          onClick={() => setActiveTab("people")}
        >
          <Users aria-hidden="true" /> People & Partners
        </button>
        <button
          type="button"
          className={activeTab === "wrap" ? "is-active" : ""}
          onClick={() => setActiveTab("wrap")}
        >
          <ClipboardCheck aria-hidden="true" /> Story & Wrap-Up
        </button>
        <button type="button" onClick={() => void refreshProduction()} disabled={pending}>
          <RefreshCw aria-hidden="true" /> Refresh
        </button>
      </nav>

      {message ? (
        <div className="td-production-message is-success">
          <CheckCircle2 aria-hidden="true" /> {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="td-production-message is-error" role="alert">
          <X aria-hidden="true" /> {errorMessage}
          <button type="button" onClick={() => setErrorMessage("")}>Dismiss</button>
        </div>
      ) : null}

      {activeTab === "live" ? (
        <div className="td-production-tab-panel">
          <section className="td-production-panel td-clip-panel">
            <PanelHeading
              eyebrow="Fast content capture"
              title="Mark Clip"
              description="The timestamp is recorded the instant the button is pressed. Details are optional and can stay lightweight during play."
              icon={<Camera aria-hidden="true" />}
            />
            <form onSubmit={handleMarkClip}>
              <div className="td-clip-tags">
                {clipTags.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    className={selectedClipTag === tag.value ? "is-selected" : ""}
                    onClick={() => setSelectedClipTag(tag.value)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <div className="td-production-form-grid">
                <label>
                  Fixture
                  <select name="fixture_id" defaultValue="">
                    <option value="">General stream moment</option>
                    {core.fixtures.map((fixture) => (
                      <option key={fixture.id} value={fixture.id}>
                        {fixture.homeTeam.name} vs {fixture.awayTeam.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Linked player
                  <select name="profile_id" defaultValue="">
                    <option value="">No linked player</option>
                    {production.players.map((player) => (
                      <option key={player.profileId} value={player.profileId}>
                        {player.displayName} | {player.teamName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Player name
                  <input name="player_name" maxLength={120} placeholder="Optional manual name" />
                </label>
                <label>
                  Team
                  <select name="team_id" defaultValue="">
                    <option value="">No team</option>
                    {core.seasonTeams.map((item) => (
                      <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Quick note
                <input name="note" maxLength={1000} placeholder="Holed approach from 118m" />
              </label>
              <button type="submit" className="td-mark-clip" disabled={pending}>
                <Zap aria-hidden="true" /> Mark Clip Now
              </button>
            </form>
            <div className="td-recent-clips">
              <header>
                <strong>Recent markers</strong>
                {roundId ? (
                  <Link
                    href={`/api/admin/top-dog/clips/export?season=${core.season.slug}&round=${roundId}`}
                  >
                    <Download aria-hidden="true" /> Export CSV
                  </Link>
                ) : null}
              </header>
              {production.clips.slice(0, 5).map((clip) => (
                <div key={clip.id}>
                  <time>{formatClock(clip.markedAt)}</time>
                  <b>{titleCase(clip.tag)}</b>
                  <span>{clip.playerName || clip.note || "Stream marker"}</span>
                </div>
              ))}
              {production.clips.length === 0 ? <p>No clips marked for this round yet.</p> : null}
            </div>
          </section>

          <div className="td-production-two-column">
            <section className="td-production-panel">
              <PanelHeading
                eyebrow="Live awards"
                title="Prize Tracker"
                description="Save a leader or winner, then send the polished card straight to the central OBS source."
                icon={<Award aria-hidden="true" />}
              />
              <form className="td-production-form" onSubmit={handlePrize}>
                <div className="td-production-form-grid">
                  <label>
                    Category
                    <select name="category" defaultValue="longest_drive">
                      {prizeCategories.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Custom label
                    <input name="custom_category" maxLength={100} placeholder="Only for custom" />
                  </label>
                  <label>
                    Linked player
                    <select name="profile_id" defaultValue="">
                      <option value="">Manual or team award</option>
                      {production.players.map((player) => (
                        <option key={player.profileId} value={player.profileId}>
                          {player.displayName} | {player.teamName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team
                    <select name="team_id" defaultValue="">
                      <option value="">No team</option>
                      {core.seasonTeams.map((item) => (
                        <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Display name
                    <input name="display_name" maxLength={120} placeholder="Player or team" />
                  </label>
                  <label>
                    Result / value
                    <input name="result_value" maxLength={120} placeholder="286m" />
                  </label>
                  <label>
                    Prize
                    <input name="prize" maxLength={240} placeholder="Range Ratz golf ball" />
                  </label>
                  <label>
                    Sponsor
                    <select name="sponsor_id" defaultValue="">
                      <option value="">No sponsor</option>
                      {production.sponsors.map((sponsor) => (
                        <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Winner status
                    <select name="winner_status" defaultValue="leader">
                      <option value="tracking">Tracking</option>
                      <option value="leader">Current leader</option>
                      <option value="winner">Confirmed winner</option>
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <input name="notes" maxLength={1000} placeholder="Admin-only notes" />
                </label>
                <button type="submit" disabled={pending}><Save aria-hidden="true" /> Save prize</button>
              </form>

              <div className="td-prize-list">
                {production.prizes.map((prize) => (
                  <article key={prize.id}>
                    <span>{prize.customCategory || titleCase(prize.category)}</span>
                    <strong>{prize.displayName || "TBC"}</strong>
                    <b>{prize.resultValue || prize.winnerStatus}</b>
                    <button
                      type="button"
                      onClick={() => void runAction(
                        { action: "show_prize", prizeId: prize.id },
                        `${prize.displayName || "Prize"} is now on air.`
                      )}
                      disabled={pending}
                    >
                      <Eye aria-hidden="true" /> Show
                    </button>
                  </article>
                ))}
                {production.prizes.length === 0 ? <p>No prizes recorded for this league night.</p> : null}
              </div>
            </section>

            <section className="td-production-panel td-jackpot-panel">
              <PanelHeading
                eyebrow="Recurring live feature"
                title="One-Putt Jackpot"
                description="Select, reveal, run, and resolve the full challenge from this card."
                icon={<CircleDollarSign aria-hidden="true" />}
              />
              <div className={`td-jackpot-status is-${production.jackpot?.status ?? "idle"}`}>
                <span>{production.jackpot?.status ? titleCase(production.jackpot.status) : "Idle"}</span>
                <strong>${production.jackpot?.currentAmount.toFixed(0) ?? "100"}</strong>
                <b>{production.jackpot?.selectedName || "No player selected"}</b>
              </div>
              <form
                className="td-jackpot-amount"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void runAction(
                    { action: "jackpot", command: "set_amount", amount: Number(formData.get("amount")) },
                    "Jackpot value updated."
                  );
                }}
              >
                <label>
                  Current jackpot
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    max="100000"
                    defaultValue={production.jackpot?.currentAmount ?? 100}
                  />
                </label>
                <button type="submit" disabled={pending}>Save amount</button>
              </form>
              <form className="td-production-form" onSubmit={handleJackpotSelect}>
                <label>
                  Linked player
                  <select name="profile_id" defaultValue="">
                    <option value="">Manual selection</option>
                    {production.players.map((player) => (
                      <option key={player.profileId} value={player.profileId}>
                        {player.displayName} | {player.teamName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="td-production-form-grid">
                  <label>
                    Manual player
                    <input name="player_name" maxLength={120} placeholder="Player name" />
                  </label>
                  <label>
                    Team
                    <select name="team_id" defaultValue="">
                      <option value="">No team</option>
                      {core.seasonTeams.map((item) => (
                        <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="td-jackpot-select-actions">
                  <button type="submit" disabled={pending}><Target /> Select player</button>
                  <button
                    type="button"
                    onClick={() => void runAction(
                      { action: "jackpot", command: "random" },
                      "Random player selected."
                    )}
                    disabled={pending}
                  >
                    <Sparkles /> Random player
                  </button>
                </div>
              </form>
              <div className="td-jackpot-controls">
                <button
                  type="button"
                  onClick={() => void runAction({ action: "jackpot", command: "reveal" }, "Player reveal is on air.")}
                  disabled={pending}
                >Reveal</button>
                <button
                  type="button"
                  onClick={() => void runAction({ action: "jackpot", command: "start" }, "One-Putt Challenge started.")}
                  disabled={pending}
                >Start challenge</button>
                <button
                  type="button"
                  className="is-success"
                  onClick={() => void runAction({ action: "jackpot", command: "success" }, "Jackpot win is on air.")}
                  disabled={pending}
                >Success</button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => void runAction({ action: "jackpot", command: "miss" }, "Miss recorded and shown.")}
                  disabled={pending}
                >Miss</button>
                <button
                  type="button"
                  onClick={() => void runAction({ action: "jackpot", command: "rollover" }, "Jackpot rollover is on air.")}
                  disabled={pending}
                >Rollover</button>
                <button
                  type="button"
                  onClick={() => void runAction(
                    { action: "jackpot", command: "reset" },
                    "Jackpot reset.",
                    { confirm: "Reset the One-Putt Jackpot to its default value and clear the selected player?" }
                  )}
                  disabled={pending}
                ><RotateCcw /> Reset</button>
              </div>
              <div className="td-jackpot-history">
                <strong>Attempt history</strong>
                {production.jackpotAttempts.slice(0, 5).map((attempt) => (
                  <div key={attempt.id}>
                    <span>{formatClock(attempt.attemptedAt)}</span>
                    <b>{attempt.playerName || "Player TBC"}</b>
                    <em className={`is-${attempt.result}`}>{titleCase(attempt.result)}</em>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === "people" ? (
        <div className="td-production-tab-panel">
          <div className="td-production-two-column">
            <section className="td-production-panel">
            <PanelHeading
              eyebrow="Lower-third workflow"
              title="Player Interviews"
              description="Queue a player, keep the suggested questions in admin, then send only the clean lower-third to OBS."
              icon={<Mic2 aria-hidden="true" />}
            />
            <form className="td-production-form" onSubmit={handleInterview}>
              <div className="td-production-form-grid">
                <label>
                  Interview type
                  <select name="interview_type" defaultValue="pre_match">
                    {interviewTypes.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fixture
                  <select name="fixture_id" defaultValue="">
                    <option value="">No fixture</option>
                    {core.fixtures.map((fixture) => (
                      <option key={fixture.id} value={fixture.id}>
                        {fixture.homeTeam.name} vs {fixture.awayTeam.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Linked player
                  <select name="profile_id" defaultValue="">
                    <option value="">Manual player</option>
                    {production.players.map((player) => (
                      <option key={player.profileId} value={player.profileId}>
                        {player.displayName} | {player.teamName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Manual player
                  <input name="player_name" maxLength={120} placeholder="Player name" />
                </label>
                <label>
                  Team
                  <select name="team_id" defaultValue="">
                    <option value="">No linked team</option>
                    {core.seasonTeams.map((item) => (
                      <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Manual team label
                  <input name="team_label" maxLength={120} placeholder="Optional" />
                </label>
              </div>
              <label>
                Producer notes
                <input name="notes" maxLength={1000} placeholder="Admin-only context" />
              </label>
              <button type="submit" disabled={pending}><Mic2 /> Queue interview</button>
            </form>

            <div className="td-interview-list">
              {production.interviews.map((interview) => (
                <article key={interview.id} className={`is-${interview.status}`}>
                  <header>
                    <span>{titleCase(interview.interviewType)}</span>
                    <b>{titleCase(interview.status)}</b>
                  </header>
                  <strong>{interview.playerName}</strong>
                  <p>{interview.teamLabel || "CGS player"}</p>
                  <ul>
                    {interview.suggestedQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                  <div>
                    <button
                      type="button"
                      onClick={() => void runAction(
                        { action: "interview_status", interviewId: interview.id, status: "live" },
                        `${interview.playerName} interview is on air.`
                      )}
                      disabled={pending || interview.status === "live"}
                    ><Radio /> Go live</button>
                    <button
                      type="button"
                      onClick={() => void runAction(
                        { action: "interview_status", interviewId: interview.id, status: "complete" },
                        "Interview completed and lower-third hidden."
                      )}
                      disabled={pending || interview.status === "complete"}
                    ><Check /> Complete</button>
                  </div>
                </article>
              ))}
            </div>
            </section>

            <section className="td-production-panel">
            <PanelHeading
              eyebrow="Partner delivery"
              title="Sponsors & Fulfilment"
              description="Maintain one CGS sponsor directory, activate partners for tonight, and prove every promised deliverable was completed."
              icon={<Gift aria-hidden="true" />}
            />
            <details className="td-production-details">
              <summary>Add or update a sponsor</summary>
              <form className="td-production-form" onSubmit={handleSponsor}>
                <div className="td-production-form-grid">
                  <label>Sponsor name<input name="name" required maxLength={120} /></label>
                  <label>Logo URL<input name="logo_url" maxLength={500} /></label>
                  <label>Website<input name="website_url" maxLength={500} /></label>
                  <label>Promo code<input name="promo_code" maxLength={100} /></label>
                  <label>Campaign<input name="campaign" maxLength={240} /></label>
                  <label>Prize supplied<input name="prize_supplied" maxLength={240} /></label>
                </div>
                <label>Notes<input name="notes" maxLength={1000} /></label>
                <button type="submit" disabled={pending}><Save /> Save sponsor</button>
              </form>
            </details>

            <form className="td-production-form td-activation-form" onSubmit={handleActivation}>
              <strong>Activate a sponsor tonight</strong>
              <div className="td-production-form-grid">
                <label>
                  Sponsor
                  <select name="sponsor_id" required defaultValue="">
                    <option value="" disabled>Choose sponsor</option>
                    {production.sponsors.map((sponsor) => (
                      <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>
                    ))}
                  </select>
                </label>
                <label>Campaign<input name="campaign" maxLength={240} /></label>
                <label>Prize supplied<input name="prize_supplied" maxLength={240} /></label>
                <label>Notes<input name="notes" maxLength={1000} /></label>
              </div>
              <button type="submit" disabled={pending || production.sponsors.length === 0}>
                <Gift /> Add to league night
              </button>
            </form>

            <div className="td-activation-list">
              {production.sponsorActivations.map((activation) => {
                const sponsor = production.sponsors.find((item) => item.id === activation.sponsorId);

                return (
                  <article key={activation.id}>
                    <header>
                      <div>
                        <span>League night partner</span>
                        <strong>{sponsor?.name ?? "Sponsor"}</strong>
                        <p>{activation.campaign || activation.prizeSupplied || "CGS partner activation"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void runAction(
                          { action: "show_sponsor", sponsorId: activation.sponsorId },
                          `${sponsor?.name ?? "Sponsor"} is now on air.`
                        )}
                        disabled={pending}
                      ><Eye /> Show</button>
                    </header>
                    <div className="td-fulfilment-grid">
                      {fulfilmentFields.map(([databaseField, property, label]) => {
                        const checked = activation[property];
                        return (
                          <label key={databaseField} className={checked ? "is-complete" : ""}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => void runAction(
                                {
                                  action: "toggle_activation",
                                  activationId: activation.id,
                                  field: databaseField,
                                  value: !checked,
                                },
                                `${label} ${checked ? "reopened" : "completed"}.`
                              )}
                              disabled={pending}
                            />
                            <i>{checked ? <Check /> : null}</i>
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
              {production.sponsorActivations.length === 0 ? (
                <p>No sponsor activations assigned to this league night.</p>
              ) : null}
            </div>
            </section>
          </div>

          <section className="td-production-panel td-roster-panel" id="player-rosters">
            <PanelHeading
              eyebrow="One player directory, every live graphic"
              title="Players & Team Rosters"
              description="Add real players, upload their photos, and connect them to a Top Dog team. The same profile is then available for interviews, prizes, the jackpot, content tags, statistics, and player-focused stream graphics."
              icon={<Users aria-hidden="true" />}
            />
            <form className="td-production-form td-profile-create-form" onSubmit={handleProfileCreate}>
              <div className="td-profile-create-heading">
                <UserPlus aria-hidden="true" />
                <div>
                  <strong>Add a player</strong>
                  <span>No website login is required. Leave the team blank if the player is not assigned yet.</span>
                </div>
              </div>
              <div className="td-profile-form-grid">
                <label>
                  Full name
                  <input name="display_name" maxLength={120} required placeholder="Tommy Smith" />
                </label>
                <label>
                  Nickname
                  <input name="nickname" maxLength={80} placeholder="Tommy" />
                </label>
                <label>
                  Profile handle
                  <input name="handle" maxLength={80} placeholder="Auto-created from name" />
                </label>
                <label>
                  Handicap
                  <input name="handicap" type="number" min={-10} max={80} step="0.1" placeholder="Optional" />
                </label>
                <label>
                  Top Dog team
                  <select name="team_id" defaultValue="">
                    <option value="">Unassigned for now</option>
                    {core.seasonTeams.filter((item) => item.isActive).map((item) => (
                      <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Team role
                  <input name="role_label" maxLength={80} defaultValue="Player" />
                </label>
                <label>
                  Player photo
                  <input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp" />
                </label>
                <label>
                  Or photo URL
                  <input name="avatar_url" type="url" maxLength={2000} placeholder="https://..." />
                </label>
              </div>
              <button type="submit" disabled={pending}>
                <UserPlus aria-hidden="true" /> {pending ? "Saving..." : "Add player profile"}
              </button>
            </form>
            <div className="td-roster-directory-heading">
              <div>
                <strong>Player directory</strong>
                <span>{production.profileDirectory.length} profile{production.profileDirectory.length === 1 ? "" : "s"}</span>
              </div>
              <p>Select a player to edit details or change their team.</p>
            </div>
            <div className="td-roster-grid">
              {production.profileDirectory.map((profile) => (
                <details key={profile.profileId} className={profile.teamId ? "is-assigned" : ""}>
                  <summary>
                    <span
                      className={`td-roster-avatar ${profile.avatarUrl ? "has-photo" : ""}`}
                      style={getAvatarStyle(profile.avatarUrl)}
                    >
                      {!profile.avatarUrl ? getPlayerInitials(profile.displayName) : null}
                    </span>
                    <span className="td-roster-summary-copy">
                      <b>{profile.teamName || "Unassigned"}</b>
                      <strong>{profile.displayName}</strong>
                      <small>
                        @{profile.handle} | {profile.managedByAdmin ? "Admin managed" : "Website account"}
                      </small>
                    </span>
                    <span className="td-roster-edit-label">Edit</span>
                  </summary>
                  <form className="td-production-form td-profile-edit-form" onSubmit={handleProfileUpdate}>
                    <input type="hidden" name="profile_id" value={profile.profileId} />
                    <div className="td-profile-form-grid">
                      <label>
                        Full name
                        <input name="display_name" maxLength={120} required defaultValue={profile.displayName} />
                      </label>
                      <label>
                        Nickname
                        <input name="nickname" maxLength={80} defaultValue={profile.nickname} />
                      </label>
                      <label>
                        Profile handle
                        <input name="handle" maxLength={80} required defaultValue={profile.handle} />
                      </label>
                      <label>
                        Handicap
                        <input
                          name="handicap"
                          type="number"
                          min={-10}
                          max={80}
                          step="0.1"
                          defaultValue={profile.handicap ?? ""}
                        />
                      </label>
                      <label>
                        Top Dog team
                        <select name="team_id" defaultValue={profile.teamId ?? ""}>
                          <option value="">Unassigned</option>
                          {core.seasonTeams.filter((item) => item.isActive).map((item) => (
                            <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Team role
                        <input name="role_label" maxLength={80} defaultValue={profile.roleLabel || "Player"} />
                      </label>
                      <label>
                        Replace player photo
                        <input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp" />
                      </label>
                      <label>
                        Photo URL
                        <input name="avatar_url" type="url" maxLength={2000} defaultValue={profile.avatarUrl} />
                      </label>
                    </div>
                    <div className="td-profile-actions">
                      <button type="submit" disabled={pending}>
                        <Save aria-hidden="true" /> Save player
                      </button>
                      {profile.managedByAdmin ? (
                        <button
                          type="button"
                          className="is-danger"
                          disabled={pending}
                          onClick={() => void handleProfileDelete(profile.profileId, profile.displayName)}
                        >
                          <Trash2 aria-hidden="true" /> Delete profile
                        </button>
                      ) : (
                        <span>Login-backed profile: editable here, but deletion remains protected.</span>
                      )}
                    </div>
                  </form>
                </details>
              ))}
              {production.profileDirectory.length === 0 ? (
                <p>No player profiles yet. Use Add a player above to build the live roster.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "wrap" ? (
        <div className="td-production-tab-panel">
          <section className="td-production-panel">
            <PanelHeading
              eyebrow="Run-of-show safety net"
              title="League Night Checklist"
              description="The standard CGS template is copied into every round, so each league night keeps its own completion record."
              icon={<ClipboardCheck aria-hidden="true" />}
            />
            <div className="td-checklist-grid">
              {checklistGroups.map((group) => (
                <ChecklistColumn
                  key={group.phase}
                  phase={group.phase}
                  items={group.items}
                  pending={pending}
                  onToggle={(item) => void runAction(
                    { action: "toggle_checklist", itemId: item.id, isComplete: !item.isComplete },
                    `${item.label} ${item.isComplete ? "reopened" : "completed"}.`
                  )}
                />
              ))}
            </div>
          </section>

          <div className="td-production-two-column">
            <section className="td-production-panel">
              <PanelHeading
                eyebrow="Recurring CGS stories"
                title="Segments"
                description="Save the story once, then trigger its dedicated broadcast card when the stream is ready."
                icon={<Sparkles aria-hidden="true" />}
              />
              <form className="td-production-form" onSubmit={handleSegment}>
                <div className="td-production-form-grid">
                  <label>
                    Segment
                    <select name="segment_type" defaultValue="doghouse">
                      {segmentTypes.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>Card title<input name="title" maxLength={120} placeholder="The Doghouse" /></label>
                </div>
                <label>Main line<input name="primary_text" maxLength={240} placeholder="Player, team, or headline" /></label>
                <label>Supporting line<textarea name="secondary_text" maxLength={500} rows={3} /></label>
                <label className="td-inline-check">
                  <input type="checkbox" name="confirmed" /> Confirmed for the night
                </label>
                <button type="submit" disabled={pending}><Save /> Save segment</button>
              </form>
              <div className="td-segment-admin-list">
                {segmentTypes.map(([type, label]) => {
                  const segment = production.segments.find((item) => item.segmentType === type);
                  return (
                    <article key={type}>
                      <div>
                        <span>{label}</span>
                        <strong>{segment?.primaryText || "Not set"}</strong>
                        <p>{segment?.secondaryText || "Add the story when it happens."}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void runAction(
                          { action: "show_segment", segmentType: type },
                          `${label} is now on air.`
                        )}
                        disabled={pending || !segment}
                      ><Eye /> Show</button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="td-production-panel">
              <PanelHeading
                eyebrow="Automatic close"
                title="Tonight in Top Dog"
                description="Compile final results, ladder, prizes, jackpot, Shot of the Night, and Doghouse into one reusable recap."
                icon={<Trophy aria-hidden="true" />}
              />
              <div className="td-recap-actions">
                <button
                  type="button"
                  onClick={() => void runAction({ action: "generate_recap" }, "Night recap generated.")}
                  disabled={pending}
                ><Sparkles /> Generate recap</button>
                <button
                  type="button"
                  onClick={() => void runAction({ action: "show_recap" }, "Tonight in Top Dog is now on air.")}
                  disabled={pending || !production.recap}
                ><Eye /> Show on stream</button>
              </div>
              <pre className="td-recap-copy">
                {production.recap?.recapText || "Generate the recap once the league-night results and awards are ready."}
              </pre>
              <div className="td-export-actions">
                {roundId ? (
                  <>
                    <Link href={`/api/admin/top-dog/clips/export?season=${core.season.slug}&round=${roundId}`}>
                      <FileDown /> Clip CSV
                    </Link>
                    <Link href={`/api/admin/top-dog/backup?season=${core.season.slug}&round=${roundId}`}>
                      <Download /> Night backup
                    </Link>
                  </>
                ) : null}
              </div>
            </section>
          </div>

          <section className="td-production-panel">
            <PanelHeading
              eyebrow="Season intelligence"
              title="Top Dog Statistics"
              description="Final fixtures drive the team records automatically. Linked player records add prize and One-Putt history without duplicating profiles."
              icon={<Flag aria-hidden="true" />}
            />
            <div className="td-stats-table">
              <div className="td-stats-head">
                <span>Team</span><span>P</span><span>W</span><span>D</span><span>L</span><span>Win %</span><span>Pts</span><span>+/-</span><span>Big win</span><span>Streak</span>
              </div>
              {production.teamStats.map((stat) => (
                <div key={stat.team.id}>
                  <strong><i style={{ background: stat.team.accentColor }} />{stat.team.name}</strong>
                  <span>{stat.played}</span>
                  <span>{stat.wins}</span>
                  <span>{stat.draws}</span>
                  <span>{stat.losses}</span>
                  <span>{stat.winPercentage}%</span>
                  <b>{stat.points}</b>
                  <span>{stat.differential > 0 ? "+" : ""}{stat.differential}</span>
                  <span>{stat.biggestWin || "-"}</span>
                  <span>{stat.streak}</span>
                </div>
              ))}
            </div>
            {production.playerStats.length > 0 ? (
              <div className="td-player-stats">
                {production.playerStats.map((stat) => (
                  <article key={stat.player.profileId}>
                    <span>{stat.player.teamName}</span>
                    <strong>{stat.player.displayName}</strong>
                    <p>{stat.appearances} apps | {stat.wins} wins | {stat.prizeWins} prizes</p>
                    <b>{stat.longestDrivePb ? `${stat.longestDrivePb}m drive PB` : `${stat.onePuttWins}/${stat.onePuttAttempts} one-putts`}</b>
                  </article>
                ))}
              </div>
            ) : (
              <p className="td-production-empty">
                Player statistics will populate as existing CGS profiles are linked to league teams.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
