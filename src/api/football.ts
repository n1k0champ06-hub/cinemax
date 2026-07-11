/**
 * Football API — ScoreBat highlights + worldcup26.ir World Cup 2026 data
 * Both sources are free and require no API key.
 */

// ─── ScoreBat Types ──────────────────────────────────────────────────────────

export interface ScoreBatTeam {
  name: string;
  slug: string;
  id: number;
}

export interface ScoreBatVideo {
  id: string;
  title: string;
  embed: string;
}

export interface ScoreBatMatch {
  title: string;
  competition: string;
  matchviewUrl: string;
  competitionUrl: string;
  thumbnail: string;
  date: string;
  homeTeam: ScoreBatTeam;
  awayTeam: ScoreBatTeam;
  videos: ScoreBatVideo[];
}

// ─── World Cup 2026 Types ────────────────────────────────────────────────────

export type WCMatchType =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third"
  | "final";

export interface WCMatch {
  _id?: string;
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string | number | null;
  away_score: string | number | null;
  home_scorers?: string;
  away_scorers?: string;
  group: string; // "A"–"L", "R32", "R16", "QF", "SF", "3RD", "FINAL"
  matchday: string;
  local_date: string; // "MM/DD/YYYY HH:mm"
  persian_date?: string;
  stadium_id: string;
  finished: string; // "TRUE" or "FALSE"
  time_elapsed: string; // "finished", "notstarted", or elapsed time
  type: WCMatchType;
  // Group-stage team names
  home_team_name_en?: string;
  home_team_name_fa?: string;
  away_team_name_en?: string;
  away_team_name_fa?: string;
  // Knockout-stage labels (e.g., "Winner Group A")
  home_team_label?: string;
  away_team_label?: string;
  [key: string]: unknown;
}

export interface WCTeam {
  id: number;
  name: string;
  code: string;
  flag?: string;
  group?: string;
  [key: string]: unknown;
}

export interface WCGroup {
  name: string;
  teams: WCTeam[];
  [key: string]: unknown;
}

export interface WCStadium {
  id: number;
  name: string;
  city: string;
  country?: string;
  capacity?: number;
  image?: string;
  [key: string]: unknown;
}

// ─── Computed Standings ──────────────────────────────────────────────────────

export interface TeamStanding {
  team: string;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStanding {
  group: string;
  standings: TeamStanding[];
  matches: WCMatch[];
}

// ─── API Constants ───────────────────────────────────────────────────────────

const SCOREBAT_API = "https://www.scorebat.com/video-api/v3/";
const WORLDCUP_API = "https://worldcup26.ir";

// ─── ScoreBat Fetch ──────────────────────────────────────────────────────────

export async function fetchHighlights(): Promise<ScoreBatMatch[]> {
  try {
    const res = await fetch(SCOREBAT_API);
    if (!res.ok) throw new Error(`ScoreBat API error: ${res.status}`);
    const data = await res.json();
    // API returns { warning: string, response: ScoreBatMatch[] }
    const matches: ScoreBatMatch[] = data.response || data || [];
    return matches;
  } catch (err) {
    console.error("[Football] Failed to fetch ScoreBat highlights:", err);
    return [];
  }
}

/**
 * Filter highlights by competition keyword.
 * E.g., "Premier League", "La Liga", "Bundesliga", "Serie A", "World Cup"
 */
export function filterByCompetition(
  matches: ScoreBatMatch[],
  keyword: string
): ScoreBatMatch[] {
  if (!keyword || keyword === "All") return matches;
  const lower = keyword.toLowerCase();
  return matches.filter((m) =>
    m.competition.toLowerCase().includes(lower)
  );
}

// ─── World Cup 2026 Fetch ────────────────────────────────────────────────────

async function fetchWC<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${WORLDCUP_API}${endpoint}`);
    if (!res.ok) throw new Error(`WorldCup API error: ${res.status}`);
    const data = await res.json();
    return data as T;
  } catch (err) {
    console.error(`[Football] Failed to fetch ${endpoint}:`, err);
    return null;
  }
}

export async function fetchWorldCupGames(): Promise<WCMatch[]> {
  const data = await fetchWC<{ games: WCMatch[] } | WCMatch[]>("/get/games");
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if ("games" in data) return data.games;
  return (data as any).data || [];
}

export async function fetchWorldCupGroups(): Promise<WCGroup[]> {
  const data = await fetchWC<WCGroup[] | { data: WCGroup[] }>("/get/groups");
  if (!data) return [];
  return Array.isArray(data) ? data : (data as any).data || [];
}

export async function fetchWorldCupTeams(): Promise<WCTeam[]> {
  const data = await fetchWC<WCTeam[] | { data: WCTeam[] }>("/get/teams");
  if (!data) return [];
  return Array.isArray(data) ? data : (data as any).data || [];
}

export async function fetchWorldCupStadiums(): Promise<WCStadium[]> {
  const data = await fetchWC<any>("/get/stadiums");
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.stadiums || data.data || [];
}

// ─── Match Helpers ───────────────────────────────────────────────────────────

/** Parse the local_date format "MM/DD/YYYY HH:mm" into a Date */
export function parseWCDate(localDate: string): Date {
  // Format: "06/11/2026 13:00"
  const [datePart, timePart] = localDate.split(" ");
  if (!datePart) return new Date(0);
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = (timePart || "00:00").split(":");
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}

/** Get home team display name (works for group + knockout) */
export function getHomeTeam(match: WCMatch): string {
  return match.home_team_name_en || match.home_team_label || "TBD";
}

/** Get away team display name (works for group + knockout) */
export function getAwayTeam(match: WCMatch): string {
  return match.away_team_name_en || match.away_team_label || "TBD";
}

/** Check if a match is finished */
export function isFinished(match: WCMatch): boolean {
  return match.finished === "TRUE" || match.time_elapsed === "finished";
}

/** Get numeric score or null */
export function getScore(val: string | number | null): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Parse scorers string from API into array */
export function parseScorers(scorersStr?: string): string[] {
  if (!scorersStr || scorersStr === "null") return [];
  // Format: {"Scorer1 27'","Scorer2 75'"}
  const cleaned = scorersStr.replace(/^\{|\}$/g, "").replace(/\\"/g, '"');
  if (!cleaned) return [];
  return cleaned
    .split('","')
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

/** Classify matches by stage */
export function classifyByStage(games: WCMatch[]) {
  const group: WCMatch[] = [];
  const r32: WCMatch[] = [];
  const r16: WCMatch[] = [];
  const qf: WCMatch[] = [];
  const sf: WCMatch[] = [];
  const third: WCMatch[] = [];
  const final: WCMatch[] = [];

  for (const g of games) {
    switch (g.type) {
      case "group":
        group.push(g);
        break;
      case "r32":
        r32.push(g);
        break;
      case "r16":
        r16.push(g);
        break;
      case "qf":
        qf.push(g);
        break;
      case "sf":
        sf.push(g);
        break;
      case "third":
        third.push(g);
        break;
      case "final":
        final.push(g);
        break;
    }
  }

  // Sort each stage by date
  const sortByDate = (a: WCMatch, b: WCMatch) =>
    parseWCDate(a.local_date).getTime() - parseWCDate(b.local_date).getTime();

  group.sort(sortByDate);
  r32.sort(sortByDate);
  r16.sort(sortByDate);
  qf.sort(sortByDate);
  sf.sort(sortByDate);

  return { group, r32, r16, qf, sf, third, final };
}

// ─── Group Standings Computation ─────────────────────────────────────────────

/**
 * Compute standings for all groups from finished group-stage matches.
 */
export function computeGroupStandings(games: WCMatch[]): GroupStanding[] {
  // Filter to group-stage matches only
  const groupMatches = games.filter((g) => g.type === "group");

  // Group matches by their group letter
  const groupsMap = new Map<string, WCMatch[]>();
  for (const match of groupMatches) {
    const grp = match.group;
    if (!groupsMap.has(grp)) groupsMap.set(grp, []);
    groupsMap.get(grp)!.push(match);
  }

  const standings: GroupStanding[] = [];

  for (const [groupName, matches] of groupsMap) {
    // Build standings map from team names
    const teamsMap = new Map<string, TeamStanding>();

    // First pass: discover all teams from all matches in this group
    for (const m of matches) {
      const home = m.home_team_name_en || m.home_team_id;
      const away = m.away_team_name_en || m.away_team_id;
      if (!teamsMap.has(home)) {
        teamsMap.set(home, {
          team: home,
          teamId: m.home_team_id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        });
      }
      if (!teamsMap.has(away)) {
        teamsMap.set(away, {
          team: away,
          teamId: m.away_team_id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        });
      }
    }

    // Second pass: compute stats from finished matches only
    for (const m of matches) {
      if (!isFinished(m)) continue;
      const hs = getScore(m.home_score);
      const as_ = getScore(m.away_score);
      if (hs === null || as_ === null) continue;

      const home = m.home_team_name_en || m.home_team_id;
      const away = m.away_team_name_en || m.away_team_id;
      const hStand = teamsMap.get(home)!;
      const aStand = teamsMap.get(away)!;

      hStand.played++;
      aStand.played++;
      hStand.goalsFor += hs;
      hStand.goalsAgainst += as_;
      aStand.goalsFor += as_;
      aStand.goalsAgainst += hs;

      if (hs > as_) {
        hStand.won++;
        hStand.points += 3;
        aStand.lost++;
      } else if (hs < as_) {
        aStand.won++;
        aStand.points += 3;
        hStand.lost++;
      } else {
        hStand.drawn++;
        aStand.drawn++;
        hStand.points += 1;
        aStand.points += 1;
      }
    }

    // Compute GD
    for (const t of teamsMap.values()) {
      t.goalDifference = t.goalsFor - t.goalsAgainst;
    }

    // Sort: points desc → GD desc → GF desc
    const sorted = [...teamsMap.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference)
        return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    // Sort matches by date
    const sortedMatches = [...matches].sort(
      (a, b) =>
        parseWCDate(a.local_date).getTime() -
        parseWCDate(b.local_date).getTime()
    );

    standings.push({
      group: groupName,
      standings: sorted,
      matches: sortedMatches,
    });
  }

  // Sort groups alphabetically
  standings.sort((a, b) => a.group.localeCompare(b.group));

  return standings;
}

/** Check if a match is today */
export function isToday(match: WCMatch): boolean {
  const matchDate = parseWCDate(match.local_date);
  const now = new Date();
  return (
    matchDate.getFullYear() === now.getFullYear() &&
    matchDate.getMonth() === now.getMonth() &&
    matchDate.getDate() === now.getDate()
  );
}

/** Check if a match is live (today and not finished) */
export function isLive(match: WCMatch): boolean {
  if (isFinished(match)) return false;
  const matchDate = parseWCDate(match.local_date);
  const now = new Date();
  // Match started if current time is past match start time
  // and match hasn't finished
  return matchDate.getTime() <= now.getTime() && !isFinished(match);
}

// ─── Competition Metadata ────────────────────────────────────────────────────

export const COMPETITIONS = [
  { label: "All", keyword: "All", color: "#ffffff" },
  { label: "World Cup", keyword: "World Cup", color: "#eab308" },
  { label: "Premier League", keyword: "Premier League", color: "#7c3aed" },
  { label: "La Liga", keyword: "La Liga", color: "#ef4444" },
  { label: "Bundesliga", keyword: "Bundesliga", color: "#dc2626" },
  { label: "Serie A", keyword: "Serie A", color: "#3b82f6" },
  { label: "Ligue 1", keyword: "Ligue 1", color: "#06b6d4" },
  { label: "Champions League", keyword: "Champions League", color: "#1d4ed8" },
  { label: "Europa League", keyword: "Europa League", color: "#f97316" },
] as const;
