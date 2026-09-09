"use client";

import Link from "next/link";
import { FormEvent, useEffect, useEffectEvent, useMemo, useState } from "react";

import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import type {
  AmbroseEntry,
  AmbroseEvent,
  AmbroseTeam,
  PlayerAmbroseDashboard,
} from "@/lib/ambrose-events";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthMode = "sign-in" | "sign-up";
type StatusTone = "success" | "error";
type PlayerAppSession = {
  access_token: string;
  isAdmin?: boolean;
};

const ADMIN_APP_SESSION_STORAGE_KEY = "cgs-admin-app-access-token";

function getPlayerLabel(member: AmbroseTeam["members"][number]) {
  if (!member.profile) {
    return "Player";
  }

  return (
    member.profile.nickname ||
    member.profile.displayName ||
    member.profile.email ||
    member.profile.handle
  );
}

function getTeamHoleEntry(
  entries: AmbroseEntry[],
  teamId: number,
  holeId: number
) {
  return entries.find((entry) => entry.teamId === teamId && entry.holeId === holeId);
}

function getTeamScore(event: AmbroseEvent, teamId: number) {
  const entries = event.entries.filter(
    (entry) => entry.teamId === teamId && entry.scoreToPar !== null
  );

  return {
    score:
      entries.length > 0
        ? entries.reduce((total, entry) => total + (entry.scoreToPar ?? 0), 0)
        : null,
    holesComplete: entries.length,
  };
}

function formatScoreToPar(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  return `${value > 0 ? "+" : "-"}${Math.abs(value)}`;
}

function getDefaultHole(event: AmbroseEvent, team: AmbroseTeam | null) {
  if (!team) {
    return event.holes[0] ?? null;
  }

  return (
    event.holes.find(
      (hole) => !getTeamHoleEntry(event.entries, team.id, hole.id)?.grossStrokes
    ) ??
    event.holes[0] ??
    null
  );
}

function getRadioDefault(value: boolean | null) {
  if (value === true) {
    return "yes";
  }

  if (value === false) {
    return "no";
  }

  return "";
}

function getProfileStatValue(
  seasonStats: Record<string, unknown>,
  key: string
) {
  const value = seasonStats[key];
  return typeof value === "string" ? value : "";
}

function getCssImageUrl(value: string) {
  return `url(${JSON.stringify(value)})`;
}

function getStrokeOptions(par: number) {
  const start = Math.max(1, par - 2);
  return Array.from({ length: 8 }, (_, index) => start + index);
}

function getScoreOptionLabel(strokes: number, par: number) {
  const scoreToPar = strokes - par;

  if (scoreToPar <= -2) {
    return "Eagle";
  }

  if (scoreToPar === -1) {
    return "Birdie";
  }

  if (scoreToPar === 0) {
    return "Par";
  }

  if (scoreToPar === 1) {
    return "Bogey";
  }

  return `+${scoreToPar}`;
}

function formatHoleMeta(hole: AmbroseEvent["holes"][number]) {
  const parts = [`Par ${hole.par}`];

  if (hole.yardageYards !== null) {
    parts.push(`${hole.yardageYards}y`);
  }

  if (hole.strokeIndex !== null) {
    parts.push(`SI ${hole.strokeIndex}`);
  }

  return parts.join(" | ");
}

function TapNumberInput({
  label,
  name,
  options,
  defaultValue,
  allowBlank = false,
  blankLabel = "N/A",
  par,
  optionLabels,
  layout = "default",
}: {
  label: string;
  name: string;
  options: number[];
  defaultValue: number | null | undefined;
  allowBlank?: boolean;
  blankLabel?: string;
  par?: number;
  optionLabels?: Record<number, string>;
  layout?: "default" | "score" | "compact";
}) {
  const [value, setValue] = useState(
    defaultValue === null || defaultValue === undefined ? "" : String(defaultValue)
  );

  return (
    <div className={`score-tap-field score-tap-field-${layout}`}>
      <div className="score-tap-heading">
        <label className="field-label" htmlFor={`tap-${name}`}>
          {label}
        </label>
        <span>{value || "--"}</span>
      </div>
      <input id={`tap-${name}`} type="hidden" name={name} value={value} />
      <div className={`score-tap-grid score-tap-grid-${layout}`}>
        {allowBlank ? (
          <button
            type="button"
            className={`score-tap-button score-tap-button-muted ${
              value === "" ? "score-tap-button-active" : ""
            }`}
            onClick={() => setValue("")}
          >
            {blankLabel}
          </button>
        ) : null}
        {options.map((option) => {
          const optionValue = String(option);
          const optionLabel = optionLabels?.[option] ?? (par ? getScoreOptionLabel(option, par) : "");

          return (
            <button
              key={option}
              type="button"
              className={`score-tap-button ${
                value === optionValue ? "score-tap-button-active" : ""
              }`}
              onClick={() => setValue(optionValue)}
            >
              <span className="score-tap-button-value">{option}</span>
              {optionLabel ? (
                <span className="score-tap-button-label">{optionLabel}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TapBooleanInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: boolean | null | undefined;
}) {
  const [value, setValue] = useState(getRadioDefault(defaultValue ?? null));
  const options = [
    { value: "yes", label: "Hit" },
    { value: "no", label: "Miss" },
    { value: "", label: "N/A" },
  ];

  return (
    <div className="score-tap-field score-tap-field-compact">
      <div className="score-tap-heading">
        <label className="field-label" htmlFor={`tap-${name}`}>
          {label}
        </label>
        <span>{value === "yes" ? "Yes" : value === "no" ? "No" : "--"}</span>
      </div>
      <input id={`tap-${name}`} type="hidden" name={name} value={value} />
      <div className="score-binary-grid">
        {options.map((option) => (
          <button
            key={`${name}-${option.value || "blank"}`}
            type="button"
            className={`score-tap-button ${
              value === option.value ? "score-tap-button-active" : ""
            }`}
            onClick={() => setValue(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TapChoiceInput({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue: string | null | undefined;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="score-tap-field score-tap-field-compact">
      <div className="score-tap-heading">
        <label className="field-label" htmlFor={`tap-${name}`}>
          {label}
        </label>
        <span>{value || "--"}</span>
      </div>
      <input id={`tap-${name}`} type="hidden" name={name} value={value} />
      <div className="score-choice-grid">
        <button
          type="button"
          className={`score-tap-button score-tap-button-muted ${
            value === "" ? "score-tap-button-active" : ""
          }`}
          onClick={() => setValue("")}
        >
          N/A
        </button>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`score-tap-button ${
              value === option ? "score-tap-button-active" : ""
            }`}
            onClick={() => setValue(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PlayerAmbroseApp() {
  const [session, setSession] = useState<PlayerAppSession | null>(null);
  const [dashboard, setDashboard] = useState<PlayerAmbroseDashboard | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<StatusTone>("success");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedHoleId, setSelectedHoleId] = useState<number | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  function setStatus(nextMessage: string, tone: StatusTone = "success") {
    setMessageTone(tone);
    setMessage(nextMessage);
  }

  function clearStatus() {
    setMessage("");
    setMessageTone("success");
  }

  async function loadDashboard(accessToken: string) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/play/me", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = (await response.json()) as
        | PlayerAmbroseDashboard
        | { message?: string };

      if (!response.ok) {
        setStatus(
          "message" in payload && payload.message
            ? payload.message
            : "The player app could not be loaded.",
          "error"
        );
        setDashboard(null);
        return;
      }

      const nextDashboard = payload as PlayerAmbroseDashboard;
      const firstEvent =
        nextDashboard.events.find((event) => event.isLive) ??
        nextDashboard.events[0] ??
        null;
      const firstTeam =
        firstEvent?.teams.find((team) =>
          nextDashboard.assignedTeamIds.includes(team.id)
        ) ?? null;
      const firstHole = firstEvent ? getDefaultHole(firstEvent, firstTeam) : null;

      setDashboard(nextDashboard);
      setStatus(
        nextDashboard.warningMessage ?? "",
        nextDashboard.warningMessage ? "error" : "success"
      );
      setSelectedEventId((current) => current ?? firstEvent?.id ?? null);
      setSelectedTeamId((current) => current ?? firstTeam?.id ?? null);
      setSelectedHoleId((current) => current ?? firstHole?.id ?? null);
    } catch (error) {
      console.error("Player dashboard load error:", error);
      setStatus("The player app could not connect to CGS right now.", "error");
      setDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }

  const loadDashboardFromEffect = useEffectEvent(loadDashboard);

  useEffect(() => {
    const storedAdminToken = window.localStorage.getItem(
      ADMIN_APP_SESSION_STORAGE_KEY
    );

    if (storedAdminToken) {
      const adminSession = {
        access_token: storedAdminToken,
        isAdmin: true,
      };

      setSession(adminSession);
      void loadDashboardFromEffect(storedAdminToken);
      return;
    }

    if (!supabase) {
      setStatus("Supabase browser credentials are not configured.", "error");
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);

      if (data.session?.access_token) {
        void loadDashboardFromEffect(data.session.access_token);
      } else {
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.access_token) {
          void loadDashboardFromEffect(nextSession.access_token);
        } else {
          setDashboard(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const selectedEvent =
    dashboard?.events.find((event) => event.id === selectedEventId) ??
    dashboard?.events.find((event) => event.isLive) ??
    dashboard?.events[0] ??
    null;
  const assignedTeams =
    selectedEvent?.teams.filter((team) =>
      dashboard?.assignedTeamIds.includes(team.id)
    ) ?? [];
  const selectedTeam =
    assignedTeams.find((team) => team.id === selectedTeamId) ??
    assignedTeams[0] ??
    null;
  const selectedHole =
    selectedEvent?.holes.find((hole) => hole.id === selectedHoleId) ??
    (selectedEvent && selectedTeam ? getDefaultHole(selectedEvent, selectedTeam) : null);
  const selectedEntry =
    selectedEvent && selectedTeam && selectedHole
      ? getTeamHoleEntry(selectedEvent.entries, selectedTeam.id, selectedHole.id)
      : null;
  const isAdminSession = Boolean(session?.isAdmin);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    clearStatus();

    if (authMode === "sign-in" && email.trim().toLowerCase() === "admin") {
      try {
        const response = await fetch("/api/play/admin-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: email,
            password,
          }),
        });
        const payload = (await response.json()) as {
          accessToken?: string;
          message?: string;
        };

        if (!response.ok || !payload.accessToken) {
          setStatus(payload.message ?? "Admin login failed.", "error");
          return;
        }

        const adminSession = {
          access_token: payload.accessToken,
          isAdmin: true,
        };

        window.localStorage.setItem(
          ADMIN_APP_SESSION_STORAGE_KEY,
          payload.accessToken
        );
        setSession(adminSession);
        await loadDashboard(payload.accessToken);
      } catch (error) {
        console.error("Admin app login error:", error);
        setStatus("Admin login could not connect to CGS right now.", "error");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (!supabase) {
      setStatus("Supabase browser credentials are not configured.", "error");
      setIsSaving(false);
      return;
    }

    const authResult =
      authMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: displayName,
              },
            },
          });

    if (authResult.error) {
      setStatus(authResult.error.message, "error");
      setIsSaving(false);
      return;
    }

    if (authResult.data.session?.access_token) {
      setSession(authResult.data.session);
      await loadDashboard(authResult.data.session.access_token);
    } else {
      setStatus("Account created. Check your email if confirmation is enabled.");
    }

    setIsSaving(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !dashboard) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    clearStatus();

    try {
      let avatarUrl = String(formData.get("avatar_url") ?? "");
      const avatarFile = formData.get("avatar_file");

      if (avatarFile instanceof File && avatarFile.size > 0) {
        const photoFormData = new FormData();
        photoFormData.set("avatar_file", avatarFile);
        const photoResponse = await fetch("/api/play/profile-photo", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: photoFormData,
        });
        const photoPayload = (await photoResponse.json()) as {
          avatarUrl?: string;
          message?: string;
        };

        if (!photoResponse.ok || !photoPayload.avatarUrl) {
          setStatus(
            photoPayload.message ?? "Player photo could not be uploaded.",
            "error"
          );
          return;
        }

        avatarUrl = photoPayload.avatarUrl;
      }

      const response = await fetch("/api/play/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: formData.get("handle"),
          displayName: formData.get("display_name"),
          nickname: formData.get("nickname"),
          avatarUrl,
          handicap: formData.get("handicap"),
          isPublic: formData.get("is_public") === "on",
          averageDrive: formData.get("average_drive"),
          goToIron: formData.get("go_to_iron"),
          bestResult: formData.get("best_result"),
          biggestWeakness: formData.get("biggest_weakness"),
        }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus(payload.message ?? "Profile could not be saved.", "error");
        return;
      }

      setStatus("Profile saved.");
      await loadDashboard(session.access_token);
    } catch (error) {
      console.error("Player profile save error:", error);
      setStatus("Profile could not be saved.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !selectedEvent || !selectedTeam || !selectedHole) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    clearStatus();

    try {
      const response = await fetch("/api/play/ambrose-entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          teamId: selectedTeam.id,
          holeId: selectedHole.id,
          grossStrokes: formData.get("gross_strokes"),
          putts: formData.get("putts"),
          fairwayHit: formData.get("fairway_hit"),
          greenInRegulation: formData.get("green_in_regulation"),
          drivePlayerId: formData.get("drive_player_id"),
          driveDistanceMeters: formData.get("drive_distance_meters"),
          approachPlayerId: formData.get("approach_player_id"),
          ironClub: formData.get("iron_club"),
          ironDistanceMeters: formData.get("iron_distance_meters"),
        }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus(payload.message ?? "Team score could not be saved.", "error");
        return;
      }

      setStatus("Team score saved.");
      await loadDashboard(session.access_token);
    } catch (error) {
      console.error("Player Ambrose entry save error:", error);
      setStatus("Team score could not be saved.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTeamAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !selectedEvent) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    clearStatus();

    try {
      const response = await fetch("/api/play/ambrose-team", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: formData.get("action"),
          eventId: selectedEvent.id,
          teamId: formData.get("team_id"),
          name: formData.get("team_name"),
          joinCode: formData.get("join_code"),
        }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus(payload.message ?? "Team could not be updated.", "error");
        return;
      }

      setStatus(payload.message ?? "Team updated.");
      await loadDashboard(session.access_token);
    } catch (error) {
      console.error("Player team access error:", error);
      setStatus("Team could not be updated.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setStatus("Type DELETE to confirm account deletion.", "error");
      return;
    }

    setIsDeleting(true);
    clearStatus();

    try {
      const response = await fetch("/api/play/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus(payload.message ?? "Account could not be deleted.", "error");
        return;
      }

      await supabase?.auth.signOut();
      setSession(null);
      setDashboard(null);
      setDeleteConfirmation("");
      setStatus(
        payload.message ?? "Your CGS Golf account has been deleted."
      );
    } catch (error) {
      console.error("Player account deletion error:", error);
      setStatus("Account could not be deleted.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSignOut() {
    if (session?.isAdmin) {
      window.localStorage.removeItem(ADMIN_APP_SESSION_STORAGE_KEY);
    } else {
      await supabase?.auth.signOut();
    }

    setSession(null);
    setDashboard(null);
    clearStatus();
  }

  if (isLoading) {
    return (
      <div className="panel rounded-[2rem] p-8 text-center">
        <div className="loading-bar mx-auto h-2 w-48 rounded-full" />
        <p className="mt-5 text-sm text-zinc-400">Loading CGS player app...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto grid max-w-xl gap-5">
        <section className="panel rounded-[1.6rem] p-6 md:p-8">
          <div className="eyebrow">CGS Golf</div>
          <h1 className="mt-5 text-4xl md:text-5xl">Round entry</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Sign in, pick your team, tap the score numbers, and save the hole.
          </p>

          <div className="mt-5">
            <PwaInstallPrompt />
          </div>

          <div className="flex rounded-full border border-white/10 bg-black/12 p-1">
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                authMode === "sign-in"
                  ? "bg-[var(--sun)] text-slate-950"
                  : "text-zinc-300"
              }`}
              onClick={() => setAuthMode("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                authMode === "sign-up"
                  ? "bg-[var(--sun)] text-slate-950"
                  : "text-zinc-300"
              }`}
              onClick={() => setAuthMode("sign-up")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-6 grid gap-5">
            {authMode === "sign-up" ? (
              <div>
                <label className="field-label" htmlFor="player-display-name">
                  Name
                </label>
                <input
                  id="player-display-name"
                  className="field-control"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
            ) : null}

            <div>
              <label className="field-label" htmlFor="player-email">
                {authMode === "sign-in" ? "Email or admin username" : "Email"}
              </label>
              <input
                id="player-email"
                type={authMode === "sign-in" ? "text" : "email"}
                className="field-control"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete={authMode === "sign-in" ? "username" : "email"}
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="player-password">
                Password
              </label>
              <input
                id="player-password"
                type="password"
                className="field-control"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={authMode === "sign-up" ? 6 : 1}
                required
              />
            </div>

            {message ? (
              <p
                className={`form-status ${
                  messageTone === "success"
                    ? "form-status-success"
                    : "form-status-error"
                }`}
              >
                {message}
              </p>
            ) : null}

            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving
                ? "Please wait..."
                : authMode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="panel rounded-[2rem] p-8">
        <h1 className="text-4xl">Player app unavailable</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          {message || "The CGS player app could not be loaded."}
        </p>
        <button type="button" className="btn-secondary mt-6" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  const profile = dashboard.profile;
  const avatarSrc = profile.avatarUrl || "/cgs-logo.png";
  const broadcastStats = profile.seasonStats ?? {};

  return (
    <div className="grid gap-6">
      <section className="order-2 grid gap-5">
        <div className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div
              className="h-[72px] w-[72px] shrink-0 rounded-full border border-white/15 bg-white bg-cover bg-center"
              style={{ backgroundImage: getCssImageUrl(avatarSrc) }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="eyebrow">Signed in</div>
              <h1 className="mt-4 text-3xl md:text-4xl">
                {profile.nickname || profile.displayName || "CGS Player"}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">@{profile.handle}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!isAdminSession ? (
              <Link href={`/players/${profile.handle}`} className="btn-secondary">
                Public profile
              </Link>
            ) : null}
            <button type="button" className="btn-secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </div>

          <div className="mt-5">
            <PwaInstallPrompt />
          </div>

          {message ? (
            <p
              className={`form-status mt-6 ${
                messageTone === "success"
                  ? "form-status-success"
                  : "form-status-error"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>

        {isAdminSession ? (
          <div className="panel rounded-[2rem] p-6 md:p-8">
            <div className="eyebrow">Admin mode</div>
            <h2 className="mt-5 text-3xl">All teams unlocked</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              This login can enter scores for any published team. Player
              profiles, photos, and account deletion remain managed outside the
              app.
            </p>
          </div>
        ) : (
          <>
            <details className="simple-details panel rounded-[1.6rem] p-5 md:p-6">
              <summary>Profile and stream details</summary>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                These details feed public player profiles and stream assets.
              </p>

              <form onSubmit={handleProfileSubmit} className="mt-5 grid gap-5">
                <div className="grid gap-5">
                <div>
                  <label className="field-label" htmlFor="profile-display-name">
                    Name
                  </label>
                  <input
                    id="profile-display-name"
                    name="display_name"
                    className="field-control"
                    defaultValue={profile.displayName}
                    required
                  />
                </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="profile-nickname">
                  Nickname
                </label>
                <input
                  id="profile-nickname"
                  name="nickname"
                  className="field-control"
                  defaultValue={profile.nickname}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-handle">
                  Handle
                </label>
                <input
                  id="profile-handle"
                  name="handle"
                  className="field-control"
                  defaultValue={profile.handle}
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="profile-handicap">
                  Handicap
                </label>
                <input
                  id="profile-handicap"
                  name="handicap"
                  type="number"
                  step="0.1"
                  min={-10}
                  max={54}
                  className="field-control"
                  defaultValue={profile.handicap ?? ""}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-avatar-file">
                  Upload photo
                </label>
                <input
                  id="profile-avatar-file"
                  name="avatar_file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="field-control"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="profile-avatar">
                Photo URL fallback
              </label>
              <input
                id="profile-avatar"
                name="avatar_url"
                className="field-control"
                defaultValue={profile.avatarUrl}
                placeholder="https://..."
              />
            </div>

            <div className="rounded-[1.35rem] border border-white/8 bg-black/12 p-4">
              <h3 className="text-xl font-semibold text-white">
                Stream intro details
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="profile-average-drive">
                    Average drives
                  </label>
                  <input
                    id="profile-average-drive"
                    name="average_drive"
                    className="field-control"
                    defaultValue={getProfileStatValue(
                      broadcastStats,
                      "averageDrive"
                    )}
                    placeholder="245m carry"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="profile-go-to-iron">
                    Go-to irons
                  </label>
                  <input
                    id="profile-go-to-iron"
                    name="go_to_iron"
                    className="field-control"
                    defaultValue={getProfileStatValue(broadcastStats, "goToIron")}
                    placeholder="7 iron from anywhere"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="profile-best-result">
                    Best result
                  </label>
                  <input
                    id="profile-best-result"
                    name="best_result"
                    className="field-control"
                    defaultValue={getProfileStatValue(
                      broadcastStats,
                      "bestResult"
                    )}
                    placeholder="Season 3 Ambrose winner"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="profile-weakness">
                    Biggest weakness
                  </label>
                  <input
                    id="profile-weakness"
                    name="biggest_weakness"
                    className="field-control"
                    defaultValue={getProfileStatValue(
                      broadcastStats,
                      "biggestWeakness"
                    )}
                    placeholder="Trusts the hero shot too much"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="is_public"
                defaultChecked={profile.isPublic}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              Show my public player profile
            </label>

            <button type="submit" className="btn-secondary" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </button>
                </div>
              </form>
            </details>

        <details className="simple-details panel rounded-[1.6rem] p-5 md:p-6">
          <summary>Account</summary>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Delete your CGS Golf login, player profile, team memberships, and
            uploaded player photo. Existing competition score rows stay as
            shared event records with your player references removed.
          </p>

          <div className="mt-5">
            <Link href="/privacy" className="btn-secondary">
              Privacy policy
            </Link>
          </div>

          <form
            onSubmit={handleDeleteAccountSubmit}
            className="mt-6 grid gap-4 rounded-[1.2rem] border border-red-500/20 bg-red-500/8 p-4"
          >
            <div>
              <label className="field-label" htmlFor="delete-confirmation">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirmation"
                className="field-control"
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="btn-danger"
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? "Deleting..." : "Delete account"}
            </button>
          </form>
        </details>
          </>
        )}
      </section>

      <section className="order-1 grid gap-5">
        {dashboard.events.length === 0 ? (
          <div className="panel rounded-[2rem] p-6 md:p-8">
            <div className="eyebrow">Waiting for allocation</div>
            <h2 className="mt-5 text-4xl">No team assigned yet</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              Your account is ready. An admin now needs to allocate you to a
              CGS Ambrose team before round entry appears here.
            </p>
          </div>
        ) : (
          <>
            <div className="panel rounded-[2rem] p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="eyebrow">Live round entry</div>
                  <h2 className="mt-5 text-4xl">Team Ambrose</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Either allocated team member can save the team result for
                    each hole.
                  </p>
                </div>
                {selectedEvent ? (
                  <Link
                    href={`/competitions/${selectedEvent.slug}`}
                    className="btn-secondary"
                  >
                    Public board
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <select
                  className="field-control"
                  value={selectedEvent?.id ?? ""}
                  onChange={(event) => {
                    const nextEventId = Number(event.target.value);
                    const nextEvent =
                      dashboard.events.find((item) => item.id === nextEventId) ??
                      null;
                    const nextTeam =
                      nextEvent?.teams.find((team) =>
                        dashboard.assignedTeamIds.includes(team.id)
                      ) ?? null;
                    const nextHole = nextEvent
                      ? getDefaultHole(nextEvent, nextTeam)
                      : null;
                    setSelectedEventId(nextEvent?.id ?? null);
                    setSelectedTeamId(nextTeam?.id ?? null);
                    setSelectedHoleId(nextHole?.id ?? null);
                  }}
                >
                  {dashboard.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>

                <select
                  className="field-control"
                  value={selectedTeam?.id ?? ""}
                  onChange={(event) => {
                    const nextTeamId = Number(event.target.value);
                    const nextTeam =
                      assignedTeams.find((team) => team.id === nextTeamId) ??
                      null;
                    const nextHole =
                      selectedEvent && nextTeam
                        ? getDefaultHole(selectedEvent, nextTeam)
                        : null;
                    setSelectedTeamId(nextTeam?.id ?? null);
                    setSelectedHoleId(nextHole?.id ?? null);
                  }}
                >
                  {assignedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} | {team.bayLabel}
                    </option>
                  ))}
                </select>

                <select
                  className="field-control"
                  value={selectedHole?.id ?? ""}
                  onChange={(event) => setSelectedHoleId(Number(event.target.value))}
                >
                  {selectedEvent?.holes.map((hole) => {
                    const entry =
                      selectedTeam &&
                      getTeamHoleEntry(selectedEvent.entries, selectedTeam.id, hole.id);

                    return (
                      <option key={hole.id} value={hole.id}>
                        {hole.holeLabel} | {formatHoleMeta(hole)}
                        {entry ? ` | ${entry.scoreLabel}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedEvent && selectedTeam && selectedHole ? (
                <form
                  key={`${selectedTeam.id}-${selectedHole.id}-${selectedEntry?.updatedAt ?? "new"}`}
                  onSubmit={handleEntrySubmit}
                  className="score-entry-sheet mt-6"
                >
                  <div className="score-course-stage">
                    <div className="score-course-map" aria-hidden="true">
                      <span className="score-course-target score-course-target-tee" />
                      <span className="score-course-target score-course-target-green" />
                      <span className="score-course-line" />
                      <span className="score-course-distance">
                        {selectedHole.yardageYards !== null
                          ? `${selectedHole.yardageYards}y`
                          : "GSPro"}
                      </span>
                    </div>
                    <div className="score-hole-bar">
                      <div className="score-hole-number">
                        <span>Hole</span>
                        <strong>{selectedHole.holeNumber}</strong>
                      </div>
                      <div>
                        <span>Par</span>
                        <strong>{selectedHole.par}</strong>
                      </div>
                      <div>
                        <span>Team</span>
                        <strong>{selectedTeam.shortName || selectedTeam.name}</strong>
                      </div>
                      <div>
                        <span>SI</span>
                        <strong>{selectedHole.strokeIndex ?? "--"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="score-sheet-header">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {selectedTeam.bayLabel} | {selectedEvent.courseName}
                      </p>
                      <h3 className="mt-2 text-2xl md:text-3xl">
                        {selectedTeam.name}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500">
                        {selectedEntry
                          ? `Current entry ${selectedEntry.scoreLabel}`
                          : "No score saved yet"}
                      </p>
                    </div>
                    <strong className="score-current-mark">
                      {selectedEntry?.scoreLabel ?? "--"}
                    </strong>
                  </div>

                  <div className="score-primary-grid">
                    <TapNumberInput
                      label="Score"
                      name="gross_strokes"
                      options={getStrokeOptions(selectedHole.par)}
                      defaultValue={selectedEntry?.grossStrokes}
                      par={selectedHole.par}
                      layout="score"
                    />
                    <TapNumberInput
                      label="Putts"
                      name="putts"
                      options={[0, 1, 2, 3, 4]}
                      defaultValue={selectedEntry?.putts}
                      allowBlank
                      blankLabel="N/A"
                      optionLabels={{ 4: "4+" }}
                      layout="compact"
                    />
                  </div>

                  <div className="score-primary-grid">
                    <TapBooleanInput
                      label="Fairway Hit"
                      name="fairway_hit"
                      defaultValue={selectedEntry?.fairwayHit}
                    />
                    <TapBooleanInput
                      label="Green in Regulation"
                      name="green_in_regulation"
                      defaultValue={selectedEntry?.greenInRegulation}
                    />
                  </div>

                  <details className="score-detail-panel">
                    <summary className="score-detail-heading">
                      <h4>Shot details</h4>
                      <span>Optional</span>
                    </summary>
                    <div className="score-detail-grid">
                      <div>
                        <label className="field-label" htmlFor="entry-drive">
                          Drive by
                        </label>
                        <select
                          id="entry-drive"
                          name="drive_player_id"
                          className="field-control"
                          defaultValue={selectedEntry?.drivePlayerId ?? ""}
                        >
                          <option value="">Not recorded</option>
                          {selectedTeam.members.map((member) => (
                            <option key={member.id} value={member.profileId}>
                              {getPlayerLabel(member)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor="entry-drive-distance"
                        >
                          Drive distance
                        </label>
                        <input
                          id="entry-drive-distance"
                          name="drive_distance_meters"
                          type="number"
                          min={0}
                          max={500}
                          step="1"
                          className="field-control"
                          defaultValue={selectedEntry?.driveDistanceMeters ?? ""}
                          placeholder="Metres"
                        />
                      </div>
                    </div>

                    <div className="score-detail-grid">
                      <div>
                        <label className="field-label" htmlFor="entry-approach">
                          Iron by
                        </label>
                        <select
                          id="entry-approach"
                          name="approach_player_id"
                          className="field-control"
                          defaultValue={selectedEntry?.approachPlayerId ?? ""}
                        >
                          <option value="">Not recorded</option>
                          {selectedTeam.members.map((member) => (
                            <option key={member.id} value={member.profileId}>
                              {getPlayerLabel(member)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor="entry-iron-distance"
                        >
                          Iron distance
                        </label>
                        <input
                          id="entry-iron-distance"
                          name="iron_distance_meters"
                          type="number"
                          min={0}
                          max={300}
                          step="1"
                          className="field-control"
                          defaultValue={selectedEntry?.ironDistanceMeters ?? ""}
                          placeholder="Metres"
                        />
                      </div>
                    </div>

                    <TapChoiceInput
                      label="Iron"
                      name="iron_club"
                      options={["SW", "PW", "9i", "8i", "7i", "6i", "5i", "4i"]}
                      defaultValue={selectedEntry?.ironClub}
                    />
                  </details>

                  <div className="score-finish-bar">
                    <div>
                      <strong>{selectedHole.holeLabel}</strong>
                      <span>Finish hole</span>
                    </div>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              ) : selectedEvent && !isAdminSession ? (
                <div className="mt-6 grid gap-4 rounded-[1.35rem] border border-white/8 bg-black/12 p-5">
                  <div>
                    <h3 className="text-2xl">Team access</h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      Create a team password for your pairing, or join an
                      existing team if you have its password.
                    </p>
                  </div>

                  <form
                    onSubmit={handleTeamAccessSubmit}
                    className="grid gap-4 rounded-[1rem] border border-white/8 bg-black/16 p-4"
                  >
                    <input type="hidden" name="action" value="create" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor="new-team-name">
                          Team name
                        </label>
                        <input
                          id="new-team-name"
                          name="team_name"
                          className="field-control"
                          required
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="new-team-code">
                          Team password
                        </label>
                        <input
                          id="new-team-code"
                          name="join_code"
                          type="password"
                          minLength={4}
                          className="field-control"
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-secondary" disabled={isSaving}>
                      {isSaving ? "Saving..." : "Create team"}
                    </button>
                  </form>

                  <form
                    onSubmit={handleTeamAccessSubmit}
                    className="grid gap-4 rounded-[1rem] border border-white/8 bg-black/16 p-4"
                  >
                    <input type="hidden" name="action" value="join" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor="join-team-id">
                          Team
                        </label>
                        <select
                          id="join-team-id"
                          name="team_id"
                          className="field-control"
                          required
                        >
                          <option value="">Select team</option>
                          {selectedEvent.teams
                            .filter((team) => team.hasJoinCode)
                            .map((team) => (
                              <option
                                key={team.id}
                                value={team.id}
                                disabled={team.members.length >= 2}
                              >
                                {team.name} | {team.members.length}/2 players
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="join-team-code">
                          Team password
                        </label>
                        <input
                          id="join-team-code"
                          name="join_code"
                          type="password"
                          minLength={4}
                          className="field-control"
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-secondary" disabled={isSaving}>
                      {isSaving ? "Saving..." : "Join team"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.35rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm leading-7 text-zinc-400">
                  No competition is available.
                </div>
              )}
            </div>

            {selectedEvent ? (
              <details className="simple-details panel rounded-[1.6rem] p-5 md:p-6">
                <summary>Leaderboard</summary>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="eyebrow">Leaderboard</div>
                    <h2 className="mt-5 text-3xl">{selectedEvent.title}</h2>
                  </div>
                  <span className="chip text-zinc-100">
                    {selectedEvent.teams.length} teams
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {[...selectedEvent.teams]
                    .sort((left, right) => {
                      const leftScore = getTeamScore(selectedEvent, left.id);
                      const rightScore = getTeamScore(selectedEvent, right.id);

                      if (leftScore.score === null && rightScore.score !== null) {
                        return 1;
                      }

                      if (leftScore.score !== null && rightScore.score === null) {
                        return -1;
                      }

                      if (
                        leftScore.score !== null &&
                        rightScore.score !== null &&
                        leftScore.score !== rightScore.score
                      ) {
                        return leftScore.score - rightScore.score;
                      }

                      return rightScore.holesComplete - leftScore.holesComplete;
                    })
                    .map((team, index) => {
                      const teamScore = getTeamScore(selectedEvent, team.id);
                      const isOwnTeam = dashboard.assignedTeamIds.includes(team.id);

                      return (
                        <div
                          key={team.id}
                          className={`rounded-[1.2rem] border px-4 py-4 ${
                            isOwnTeam
                              ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]"
                              : "border-white/8 bg-black/12"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                                {index + 1} | {team.bayLabel}
                              </p>
                              <p className="mt-1 font-semibold text-white">
                                {team.name}
                              </p>
                            </div>
                            <strong className="text-2xl text-[var(--tan)]">
                              {formatScoreToPar(teamScore.score)}
                            </strong>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            Thru {teamScore.holesComplete}/{selectedEvent.holes.length}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
