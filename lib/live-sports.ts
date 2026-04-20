type LeagueConfig = {
  key: string;
  title: string;
  label: string;
  leagueId: string;
  leagueName: string;
  description: string;
  standingsVariant: "afl" | "nrl" | "none";
  seasonStartMonth: number;
  seasonStartDay: number;
};

type SportsDbEvent = {
  idEvent?: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  intRound?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strVenue?: string;
  strStatus?: string;
  idLeague?: string;
};

type SportsDbTeam = {
  idTeam?: string;
  idLeague?: string;
  strTeam?: string;
  strTeamAlternate?: string;
  strTeamShort?: string;
  strBadge?: string;
};

type SportsDbResponse = {
  events?: SportsDbEvent[] | null;
  teams?: SportsDbTeam[] | null;
};

type TeamDirectoryEntry = {
  id: string;
  teamName: string;
  teamDisplayName: string;
  badge: string | null;
};

type StandingAccumulator = TeamDirectoryEntry & {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  pointsFor: number;
  pointsAgainst: number;
  ladderPoints: number;
};

export type LeagueEventSummary = {
  id: string;
  title: string;
  subtitle: string;
  when: string;
  venue: string;
  status: string;
  score: string | null;
};

export type LeagueStandingRow = {
  position: number;
  teamId: string;
  teamName: string;
  teamDisplayName: string;
  badge: string | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  pointsFor: number;
  pointsAgainst: number;
  ladderPoints: number;
  percentage: number | null;
  differential: number | null;
};

export type LeagueSnapshot = {
  key: string;
  title: string;
  label: string;
  description: string;
  nextEvent: LeagueEventSummary | null;
  lastEvent: LeagueEventSummary | null;
  standingsVariant: "afl" | "nrl" | "none";
  standingsRows: LeagueStandingRow[];
  standingsSummary: string | null;
  standingsMessage: string;
};

const API_KEY = process.env.THESPORTSDB_API_KEY ?? "123";
const API_BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const BRISBANE_TIMEZONE = "Australia/Brisbane";
const STANDINGS_LOOKAHEAD_DAYS = 10;
const STANDINGS_REVALIDATE_SECONDS = 900;

export const leagueConfigs: LeagueConfig[] = [
  {
    key: "golf",
    title: "PGA Tour",
    label: "Golf",
    leagueId: "4425",
    leagueName: "PGA Tour",
    description:
      "Upcoming PGA Tour action and the most recent completed event.",
    standingsVariant: "none",
    seasonStartMonth: 1,
    seasonStartDay: 1,
  },
  {
    key: "afl",
    title: "AFL",
    label: "Football",
    leagueId: "4456",
    leagueName: "Australian AFL",
    description: "Live fixture context for the AFL season, including recent scores.",
    standingsVariant: "afl",
    seasonStartMonth: 2,
    seasonStartDay: 20,
  },
  {
    key: "nrl",
    title: "NRL",
    label: "Rugby League",
    leagueId: "4416",
    leagueName: "Australian National Rugby League",
    description:
      "Track the next NRL matchups and the latest completed results.",
    standingsVariant: "nrl",
    seasonStartMonth: 2,
    seasonStartDay: 20,
  },
  {
    key: "f1",
    title: "Formula 1",
    label: "Motorsport",
    leagueId: "4370",
    leagueName: "Formula 1",
    description: "See the next race weekend and the latest race result.",
    standingsVariant: "none",
    seasonStartMonth: 1,
    seasonStartDay: 1,
  },
];

function parseNumericValue(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function createLocalDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRISBANE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function createDateFromLocalString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysToLocalDate(value: string, days: number) {
  const date = createDateFromLocalString(value);
  date.setUTCDate(date.getUTCDate() + days);
  return createLocalDateString(date);
}

function listDateStrings(start: string, end: string) {
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDaysToLocalDate(cursor, 1);
  }

  return dates;
}

async function fetchSportsDb<T extends SportsDbResponse>(url: string) {
  const response = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: STANDINGS_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sports data: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

async function fetchLeagueEvents(
  endpoint: "eventsnextleague.php" | "eventspastleague.php",
  leagueId: string
) {
  const data = await fetchSportsDb<SportsDbResponse>(
    `${API_BASE}/${endpoint}?id=${leagueId}`
  );

  return data.events ?? [];
}

async function fetchTeamsForLeague(league: LeagueConfig) {
  if (league.standingsVariant === "none") {
    return [];
  }

  try {
    const data = await fetchSportsDb<SportsDbResponse>(
      `${API_BASE}/search_all_teams.php?l=${encodeURIComponent(league.leagueName)}`
    );

    return (data.teams ?? []).filter((team) => team.idLeague === league.leagueId);
  } catch (error) {
    console.error(`Team directory fetch failed for ${league.title}:`, error);
    return [];
  }
}

async function fetchSeasonScheduleWindow(league: LeagueConfig) {
  if (league.standingsVariant === "none") {
    return [];
  }

  const today = createLocalDateString(new Date());
  const seasonYear = today.slice(0, 4);
  const seasonStart = `${seasonYear}-${`${league.seasonStartMonth}`.padStart(2, "0")}-${`${league.seasonStartDay}`.padStart(2, "0")}`;
  const rangeEnd = addDaysToLocalDate(today, STANDINGS_LOOKAHEAD_DAYS);
  const dates = listDateStrings(seasonStart, rangeEnd);

  const eventSets = await mapWithConcurrency(dates, 6, async (date) => {
    try {
      const data = await fetchSportsDb<SportsDbResponse>(
        `${API_BASE}/eventsday.php?d=${date}&l=${encodeURIComponent(league.leagueName)}`
      );

      return data.events ?? [];
    } catch (error) {
      console.error(`Schedule day fetch failed for ${league.title} on ${date}:`, error);
      return [];
    }
  });

  const dedupedEvents = new Map<string, SportsDbEvent>();

  for (const events of eventSets) {
    for (const event of events) {
      if (event.idLeague !== league.leagueId) {
        continue;
      }

      const key = event.idEvent ?? `${event.dateEvent}-${event.strEvent}`;
      dedupedEvents.set(key, event);
    }
  }

  return [...dedupedEvents.values()];
}

function formatEventTitle(event: SportsDbEvent) {
  if (event.strHomeTeam && event.strAwayTeam) {
    return `${event.strHomeTeam} vs ${event.strAwayTeam}`;
  }

  return event.strEvent ?? "Event update";
}

function formatSubtitle(event: SportsDbEvent) {
  if (event.strEvent && event.strHomeTeam && event.strAwayTeam) {
    return event.strEvent;
  }

  return event.strVenue || "Details coming soon";
}

function formatWhen(event: SportsDbEvent) {
  const timestamp =
    event.strTimestamp ||
    (event.dateEvent
      ? `${event.dateEvent}T${event.strTime || "00:00:00"}`
      : undefined);

  if (!timestamp) {
    return "Time TBC";
  }

  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return event.dateEvent ?? "Time TBC";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatVenue(event: SportsDbEvent) {
  return event.strVenue ?? "Venue TBC";
}

function formatStatus(event: SportsDbEvent, kind: "next" | "last") {
  if (event.strStatus) {
    return event.strStatus;
  }

  return kind === "next" ? "Upcoming" : "Completed";
}

function formatScore(event: SportsDbEvent) {
  if (!event.intHomeScore || !event.intAwayScore) {
    return null;
  }

  return `${event.intHomeScore} - ${event.intAwayScore}`;
}

function summarizeEvent(
  event: SportsDbEvent | undefined,
  kind: "next" | "last"
): LeagueEventSummary | null {
  if (!event) {
    return null;
  }

  return {
    id: event.idEvent ?? `${kind}-${event.strEvent ?? "event"}`,
    title: formatEventTitle(event),
    subtitle: formatSubtitle(event),
    when: formatWhen(event),
    venue: formatVenue(event),
    status: formatStatus(event, kind),
    score: formatScore(event),
  };
}

function normaliseTeamLabel(value: string) {
  return value
    .replace(/\bFootball Club\b/gi, "")
    .replace(/\bRugby League Football Club\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTeamDisplayName(teamName: string, alternateName?: string, shortName?: string) {
  if (shortName?.trim()) {
    return shortName.trim();
  }

  if (alternateName?.trim()) {
    return alternateName.trim();
  }

  return normaliseTeamLabel(teamName);
}

function resolveTeamKey(id: string | undefined, teamName: string | undefined) {
  if (id?.trim()) {
    return id;
  }

  return (teamName ?? "unknown-team").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildTeamDirectory(teams: SportsDbTeam[], events: SportsDbEvent[]) {
  const directory = new Map<string, TeamDirectoryEntry>();

  for (const team of teams) {
    if (!team.strTeam) {
      continue;
    }

    const key = resolveTeamKey(team.idTeam, team.strTeam);
    directory.set(key, {
      id: key,
      teamName: team.strTeam,
      teamDisplayName: getTeamDisplayName(
        team.strTeam,
        team.strTeamAlternate,
        team.strTeamShort
      ),
      badge: team.strBadge ?? null,
    });
  }

  for (const event of events) {
    const homeName = event.strHomeTeam;
    const awayName = event.strAwayTeam;

    if (homeName) {
      const key = resolveTeamKey(event.idHomeTeam, homeName);

      if (!directory.has(key)) {
        directory.set(key, {
          id: key,
          teamName: homeName,
          teamDisplayName: getTeamDisplayName(homeName),
          badge: event.strHomeTeamBadge ?? null,
        });
      }
    }

    if (awayName) {
      const key = resolveTeamKey(event.idAwayTeam, awayName);

      if (!directory.has(key)) {
        directory.set(key, {
          id: key,
          teamName: awayName,
          teamDisplayName: getTeamDisplayName(awayName),
          badge: event.strAwayTeamBadge ?? null,
        });
      }
    }
  }

  return directory;
}

function createInitialStanding(team: TeamDirectoryEntry): StandingAccumulator {
  return {
    ...team,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    ladderPoints: 0,
  };
}

function parseRound(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function isRegularSeasonEvent(event: SportsDbEvent) {
  const round = parseRound(event.intRound);
  return round !== null && round >= 1 && round < 100;
}

function hasCountableScore(event: SportsDbEvent) {
  return (
    parseNumericValue(event.intHomeScore) !== null &&
    parseNumericValue(event.intAwayScore) !== null
  );
}

function getEventDateTime(event: SportsDbEvent) {
  const timestamp =
    event.strTimestamp ||
    (event.dateEvent
      ? `${event.dateEvent}T${event.strTime || "00:00:00"}`
      : null);

  if (!timestamp) {
    return null;
  }

  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function buildAflStandings(
  directory: Map<string, TeamDirectoryEntry>,
  events: SportsDbEvent[]
) {
  const standings = new Map<string, StandingAccumulator>();

  for (const team of directory.values()) {
    standings.set(team.id, createInitialStanding(team));
  }

  const countableEvents = events.filter(
    (event) => isRegularSeasonEvent(event) && hasCountableScore(event)
  );

  for (const event of countableEvents) {
    const homeScore = parseNumericValue(event.intHomeScore);
    const awayScore = parseNumericValue(event.intAwayScore);
    const homeName = event.strHomeTeam;
    const awayName = event.strAwayTeam;

    if (
      homeScore === null ||
      awayScore === null ||
      !homeName ||
      !awayName
    ) {
      continue;
    }

    const homeKey = resolveTeamKey(event.idHomeTeam, homeName);
    const awayKey = resolveTeamKey(event.idAwayTeam, awayName);
    const homeStanding = standings.get(homeKey);
    const awayStanding = standings.get(awayKey);

    if (!homeStanding || !awayStanding) {
      continue;
    }

    homeStanding.played += 1;
    awayStanding.played += 1;
    homeStanding.pointsFor += homeScore;
    homeStanding.pointsAgainst += awayScore;
    awayStanding.pointsFor += awayScore;
    awayStanding.pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeStanding.wins += 1;
      awayStanding.losses += 1;
      homeStanding.ladderPoints += 4;
      continue;
    }

    if (awayScore > homeScore) {
      awayStanding.wins += 1;
      homeStanding.losses += 1;
      awayStanding.ladderPoints += 4;
      continue;
    }

    homeStanding.draws += 1;
    awayStanding.draws += 1;
    homeStanding.ladderPoints += 2;
    awayStanding.ladderPoints += 2;
  }

  const sortedRows = [...standings.values()].sort((left, right) => {
    if (left.ladderPoints !== right.ladderPoints) {
      return right.ladderPoints - left.ladderPoints;
    }

    const leftPercentage =
      left.pointsAgainst > 0 ? (left.pointsFor / left.pointsAgainst) * 100 : 0;
    const rightPercentage =
      right.pointsAgainst > 0 ? (right.pointsFor / right.pointsAgainst) * 100 : 0;

    if (leftPercentage !== rightPercentage) {
      return rightPercentage - leftPercentage;
    }

    if (left.pointsFor !== right.pointsFor) {
      return right.pointsFor - left.pointsFor;
    }

    return left.teamName.localeCompare(right.teamName, "en-AU");
  });

  const latestRound = Math.max(
    0,
    ...countableEvents.map((event) => parseRound(event.intRound) ?? 0)
  );

  return {
    rows: sortedRows.map((row, index) => ({
      position: index + 1,
      teamId: row.id,
      teamName: row.teamName,
      teamDisplayName: row.teamDisplayName,
      badge: row.badge,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      byes: 0,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      ladderPoints: row.ladderPoints,
      percentage:
        row.pointsAgainst > 0
          ? Number(((row.pointsFor / row.pointsAgainst) * 100).toFixed(1))
          : null,
      differential: row.pointsFor - row.pointsAgainst,
    })),
    summary:
      latestRound > 0
        ? `CGS-calculated through completed AFL Round ${latestRound}.`
        : "CGS ladder will populate once regular-season scores are live.",
  };
}

function buildNrlStandings(
  directory: Map<string, TeamDirectoryEntry>,
  events: SportsDbEvent[]
) {
  const standings = new Map<string, StandingAccumulator>();

  for (const team of directory.values()) {
    standings.set(team.id, createInitialStanding(team));
  }

  const regularSeasonEvents = events.filter(isRegularSeasonEvent);
  const countableEvents = regularSeasonEvents.filter(hasCountableScore);

  for (const event of countableEvents) {
    const homeScore = parseNumericValue(event.intHomeScore);
    const awayScore = parseNumericValue(event.intAwayScore);
    const homeName = event.strHomeTeam;
    const awayName = event.strAwayTeam;

    if (
      homeScore === null ||
      awayScore === null ||
      !homeName ||
      !awayName
    ) {
      continue;
    }

    const homeKey = resolveTeamKey(event.idHomeTeam, homeName);
    const awayKey = resolveTeamKey(event.idAwayTeam, awayName);
    const homeStanding = standings.get(homeKey);
    const awayStanding = standings.get(awayKey);

    if (!homeStanding || !awayStanding) {
      continue;
    }

    homeStanding.played += 1;
    awayStanding.played += 1;
    homeStanding.pointsFor += homeScore;
    homeStanding.pointsAgainst += awayScore;
    awayStanding.pointsFor += awayScore;
    awayStanding.pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeStanding.wins += 1;
      awayStanding.losses += 1;
      homeStanding.ladderPoints += 2;
      continue;
    }

    if (awayScore > homeScore) {
      awayStanding.wins += 1;
      homeStanding.losses += 1;
      awayStanding.ladderPoints += 2;
      continue;
    }

    homeStanding.draws += 1;
    awayStanding.draws += 1;
    homeStanding.ladderPoints += 1;
    awayStanding.ladderPoints += 1;
  }

  const today = createLocalDateString(new Date());
  const roundMap = new Map<number, SportsDbEvent[]>();

  for (const event of regularSeasonEvents) {
    const round = parseRound(event.intRound);

    if (round === null) {
      continue;
    }

    const roundEvents = roundMap.get(round) ?? [];
    roundEvents.push(event);
    roundMap.set(round, roundEvents);
  }

  for (const [round, roundEvents] of roundMap.entries()) {
    void round;

    const roundStarted = roundEvents.some((event) => {
      const eventDate = getEventDateTime(event);
      return eventDate ? createLocalDateString(eventDate) <= today : false;
    });

    if (!roundStarted) {
      continue;
    }

    const scheduledTeamIds = new Set<string>();

    for (const event of roundEvents) {
      if (event.strHomeTeam) {
        scheduledTeamIds.add(resolveTeamKey(event.idHomeTeam, event.strHomeTeam));
      }

      if (event.strAwayTeam) {
        scheduledTeamIds.add(resolveTeamKey(event.idAwayTeam, event.strAwayTeam));
      }
    }

    const byeTeams = [...standings.values()].filter(
      (team) => !scheduledTeamIds.has(team.id)
    );

    if (byeTeams.length === 1) {
      byeTeams[0].byes += 1;
      byeTeams[0].ladderPoints += 2;
    }
  }

  const sortedRows = [...standings.values()].sort((left, right) => {
    if (left.ladderPoints !== right.ladderPoints) {
      return right.ladderPoints - left.ladderPoints;
    }

    const leftDifferential = left.pointsFor - left.pointsAgainst;
    const rightDifferential = right.pointsFor - right.pointsAgainst;

    if (leftDifferential !== rightDifferential) {
      return rightDifferential - leftDifferential;
    }

    if (left.pointsFor !== right.pointsFor) {
      return right.pointsFor - left.pointsFor;
    }

    return left.teamName.localeCompare(right.teamName, "en-AU");
  });

  const latestRound = Math.max(
    0,
    ...countableEvents.map((event) => parseRound(event.intRound) ?? 0)
  );

  return {
    rows: sortedRows.map((row, index) => ({
      position: index + 1,
      teamId: row.id,
      teamName: row.teamName,
      teamDisplayName: row.teamDisplayName,
      badge: row.badge,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      byes: row.byes,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      ladderPoints: row.ladderPoints,
      percentage: null,
      differential: row.pointsFor - row.pointsAgainst,
    })),
    summary:
      latestRound > 0
        ? `CGS-calculated through NRL Round ${latestRound}, including live bye points.`
        : "CGS ladder will populate once regular-season scores are live.",
  };
}

async function getComputedStandings(league: LeagueConfig) {
  if (league.standingsVariant === "none") {
    return {
      rows: [] as LeagueStandingRow[],
      summary: null,
      message:
        league.key === "f1"
          ? "Formula 1 needs a dedicated championship points feed before CGS can calculate a reliable standings table."
          : "PGA TOUR works better as event leaderboards than a normal league ladder, so that table is still staged.",
    };
  }

  try {
    const [teams, events] = await Promise.all([
      fetchTeamsForLeague(league),
      fetchSeasonScheduleWindow(league),
    ]);
    const directory = buildTeamDirectory(teams, events);

    if (directory.size === 0) {
      return {
        rows: [] as LeagueStandingRow[],
        summary: null,
        message: "Standings are waiting for enough team and fixture data to build the ladder.",
      };
    }

    if (league.standingsVariant === "afl") {
      const standings = buildAflStandings(directory, events);
      return {
        rows: standings.rows,
        summary: standings.summary,
        message:
          standings.rows.length > 0
            ? "CGS-calculated from AFL season scores, percentage, and competition points."
            : "Standings are waiting for enough AFL results to build the ladder.",
      };
    }

    const standings = buildNrlStandings(directory, events);

    return {
      rows: standings.rows,
      summary: standings.summary,
      message:
        standings.rows.length > 0
          ? "CGS-calculated from NRL results, differential, and scheduled bye points."
          : "Standings are waiting for enough NRL results to build the ladder.",
    };
  } catch (error) {
    console.error(`Standings build failed for ${league.title}:`, error);

    return {
      rows: [] as LeagueStandingRow[],
      summary: null,
      message: "Live ladder data is unavailable right now while the standings feed refreshes.",
    };
  }
}

export async function getLeagueSnapshot(
  league: LeagueConfig
): Promise<LeagueSnapshot> {
  try {
    const [nextEvents, pastEvents, standings] = await Promise.all([
      fetchLeagueEvents("eventsnextleague.php", league.leagueId),
      fetchLeagueEvents("eventspastleague.php", league.leagueId),
      getComputedStandings(league),
    ]);

    return {
      key: league.key,
      title: league.title,
      label: league.label,
      description: league.description,
      nextEvent: summarizeEvent(nextEvents[0], "next"),
      lastEvent: summarizeEvent(pastEvents[0], "last"),
      standingsVariant: league.standingsVariant,
      standingsRows: standings.rows,
      standingsSummary: standings.summary,
      standingsMessage: standings.message,
    };
  } catch (error) {
    console.error(`Sports feed failed for ${league.title}:`, error);

    return {
      key: league.key,
      title: league.title,
      label: league.label,
      description: league.description,
      nextEvent: null,
      lastEvent: null,
      standingsVariant: league.standingsVariant,
      standingsRows: [],
      standingsSummary: null,
      standingsMessage:
        "Live ladder data is unavailable right now while the feed refreshes.",
    };
  }
}

export async function getSportsHubSnapshots() {
  return Promise.all(leagueConfigs.map((league) => getLeagueSnapshot(league)));
}
