import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Play,
  Calendar,
  Globe,
  MapPin,
  Users,
  Tv,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  X,
  Zap,
  Clock,
  Shield,
  GitBranch,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  fetchHighlights,
  fetchWorldCupGames,
  fetchWorldCupGroups,
  fetchWorldCupTeams,
  fetchWorldCupStadiums,
  filterByCompetition,
  computeGroupStandings,
  classifyByStage,
  parseWCDate,
  getHomeTeam,
  getAwayTeam,
  isFinished,
  getScore,
  parseScorers,
  isToday,
  isLive,
  COMPETITIONS,
  type ScoreBatMatch,
  type WCMatch,
  type WCGroup,
  type WCTeam,
  type WCStadium,
  type GroupStanding,
} from "../../api/football";

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

type SubTab = "highlights" | "worldcup" | "stadiums";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "highlights", label: "Highlights", icon: Play },
  { id: "worldcup", label: "World Cup 2026", icon: Trophy },
  { id: "stadiums", label: "Stadiums", icon: MapPin },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export const FootballPage = () => {
  const [subTab, setSubTab] = useState<SubTab>("worldcup");
  const [competitionFilter, setCompetitionFilter] = useState("World Cup");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{
    embed: string;
    title: string;
  } | null>(null);

  // ─── Data Queries ────────────────────────────────────────────────────────

  const {
    data: highlights = [],
    isLoading: loadingHighlights,
    error: highlightsError,
  } = useQuery({
    queryKey: ["football-highlights"],
    queryFn: fetchHighlights,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: wcGames = [], isLoading: loadingGames } = useQuery({
    queryKey: ["wc-games"],
    queryFn: fetchWorldCupGames,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: subTab === "worldcup",
  });

  const { data: wcGroups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["wc-groups"],
    queryFn: fetchWorldCupGroups,
    staleTime: 30 * 60 * 1000,
    enabled: subTab === "worldcup",
  });

  const { data: wcTeams = [] } = useQuery({
    queryKey: ["wc-teams"],
    queryFn: fetchWorldCupTeams,
    staleTime: 60 * 60 * 1000,
  });

  const { data: wcStadiums = [], isLoading: loadingStadiums } = useQuery({
    queryKey: ["wc-stadiums"],
    queryFn: fetchWorldCupStadiums,
    staleTime: 60 * 60 * 1000,
  });

  const filteredHighlights = useMemo(
    () => filterByCompetition(highlights, competitionFilter),
    [highlights, competitionFilter]
  );

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-32 px-4 md:px-8">
      {/* Compact Header & Navigation */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 pl-4 md:pl-6 bg-[#0a0a0a]/60 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-lg shadow-black/50">
          {/* Header Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border border-yellow-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-500">
                World Cup 2026
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  Live & Highlights
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer select-none flex items-center gap-2 whitespace-nowrap",
                    active
                      ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 shadow-[0_4px_15px_rgba(234,179,8,0.1)]"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.05] border border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 transition-all duration-300",
                      active ? "text-yellow-400 scale-110" : ""
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {subTab === "highlights" && (
            <motion.div
              key="highlights"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <HighlightsSection
                matches={filteredHighlights}
                loading={loadingHighlights}
                error={highlightsError}
                competitionFilter={competitionFilter}
                setCompetitionFilter={setCompetitionFilter}
                expandedMatch={expandedMatch}
                setExpandedMatch={setExpandedMatch}
                setVideoModal={setVideoModal}
              />
            </motion.div>
          )}

          {subTab === "worldcup" && (
            <motion.div
              key="worldcup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <WorldCupSection
                games={wcGames}
                groups={wcGroups}
                teams={wcTeams}
                loadingGames={loadingGames}
                loadingGroups={loadingGroups}
                setVideoModal={setVideoModal}
              />
            </motion.div>
          )}

          {subTab === "stadiums" && (
            <motion.div
              key="stadiums"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <StadiumsSection
                stadiums={wcStadiums}
                loading={loadingStadiums}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {videoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setVideoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setVideoModal(null)}
                className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-colors cursor-pointer z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-sm text-white/60 mb-3 font-medium">
                {videoModal.title}
              </div>
              <div
                className="rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/5"
                dangerouslySetInnerHTML={{ __html: videoModal.embed }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Highlights Section ──────────────────────────────────────────────────────

function HighlightsSection({
  matches,
  loading,
  error,
  competitionFilter,
  setCompetitionFilter,
  expandedMatch,
  setExpandedMatch,
  setVideoModal,
}: {
  matches: ScoreBatMatch[];
  loading: boolean;
  error: Error | null;
  competitionFilter: string;
  setCompetitionFilter: (v: string) => void;
  expandedMatch: string | null;
  setExpandedMatch: (v: string | null) => void;
  setVideoModal: (
    v: { embed: string; title: string } | null
  ) => void;
}) {
  return (
    <div>
      {/* Competition Filter Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
        {COMPETITIONS.map((comp) => (
          <button
            key={comp.label}
            onClick={() => setCompetitionFilter(comp.keyword)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border",
              competitionFilter === comp.keyword
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                : "text-neutral-400 border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:text-white"
            )}
          >
            {comp.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="ml-3 text-neutral-400 text-sm">
            Loading highlights...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="w-10 h-10 text-yellow-500/60" />
          <p className="text-neutral-400 text-sm text-center max-w-md">
            Could not load highlights. The ScoreBat API may be temporarily
            unavailable. Please try again later.
          </p>
        </div>
      )}

      {/* Match Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-16 gap-3">
              <Tv className="w-10 h-10 text-neutral-600" />
              <p className="text-neutral-500 text-sm">
                No highlights found for this filter.
              </p>
            </div>
          )}

          {matches.map((match) => (
            <MatchCard
              key={match.matchviewUrl}
              match={match}
              expanded={expandedMatch === match.matchviewUrl}
              onToggle={() =>
                setExpandedMatch(
                  expandedMatch === match.matchviewUrl
                    ? null
                    : match.matchviewUrl
                )
              }
              onPlayVideo={(embed, title) =>
                setVideoModal({ embed, title })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Match Card ──────────────────────────────────────────────────────────────

function MatchCard({
  match,
  expanded,
  onToggle,
  onPlayVideo,
}: {
  key?: React.Key;
  match: ScoreBatMatch;
  expanded: boolean;
  onToggle: () => void;
  onPlayVideo: (embed: string, title: string) => void;
}) {
  const date = new Date(match.date);
  const isRecent =
    Date.now() - date.getTime() < 2 * 24 * 60 * 60 * 1000;

  return (
    <motion.div
      layout
      className={cn(
        "bg-white/[0.03] border rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/[0.05] group",
        expanded
          ? "border-emerald-500/20 shadow-[0_0_30px_rgba(34,197,94,0.06)]"
          : "border-white/[0.06]"
      )}
    >
      {/* Thumbnail + Click to expand */}
      <div className="relative cursor-pointer" onClick={onToggle}>
        <img
          src={match.thumbnail}
          alt={match.title}
          className="w-full aspect-video object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225' fill='%23111'%3E%3Crect width='400' height='225'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='14'%3E⚽%3C/text%3E%3C/svg%3E";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-2xl backdrop-blur-sm">
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Match info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            {isRecent && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                New
              </span>
            )}
            <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
              {match.competition}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-tight">
            {match.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/40">
            <Calendar className="w-3 h-3" />
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Expanded: Video list */}
      <AnimatePresence>
        {expanded && match.videos.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-3 border-t border-white/[0.06] flex flex-col gap-2">
              {match.videos.map((video, idx) => (
                <button
                  key={video.id}
                  onClick={() =>
                    onPlayVideo(video.embed, `${match.title} — ${video.title}`)
                  }
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/[0.04] hover:border-emerald-500/20 transition-all duration-200 cursor-pointer group/btn text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover/btn:bg-emerald-500/20 transition-colors">
                    <Play
                      className="w-3.5 h-3.5 text-emerald-400 ml-0.5"
                      fill="currentColor"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80 truncate">
                      {video.title || `Video ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-white/30">
                      Click to play
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle indicator */}
      {match.videos.length > 0 && (
        <button
          onClick={onToggle}
          className="w-full py-2 flex items-center justify-center gap-1 text-[10px] text-neutral-500 hover:text-emerald-400 transition-colors cursor-pointer border-t border-white/[0.04]"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide videos
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              {match.videos.length} video{match.videos.length > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}

// ─── World Cup Section ───────────────────────────────────────────────────────

type WCView = "live" | "groups" | "bracket";

function WorldCupSection({
  games,
  groups,
  teams,
  loadingGames,
  loadingGroups,
  setVideoModal,
}: {
  games: WCMatch[];
  groups: WCGroup[];
  teams: WCTeam[];
  loadingGames: boolean;
  loadingGroups: boolean;
  setVideoModal: (modal: { embed: string; title: string } | null) => void;
}) {
  const [wcView, setWcView] = useState<WCView>("groups");

  const stages = useMemo(() => classifyByStage(games), [games]);
  const groupStandings = useMemo(
    () => computeGroupStandings(games),
    [games]
  );

  const todayMatches = useMemo(
    () => games.filter((g) => isToday(g)),
    [games]
  );
  const liveMatches = useMemo(
    () => games.filter((g) => isLive(g)),
    [games]
  );

  const isLoading = loadingGames || loadingGroups;
  const hasData = games.length > 0;

  const WC_VIEWS: {
    id: WCView;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    {
      id: "live",
      label: liveMatches.length > 0 ? "Live" : "Today",
      icon: Zap,
      badge: liveMatches.length || todayMatches.length || undefined,
    },
    { id: "groups", label: "Groups", icon: Globe },
    { id: "bracket", label: "Bracket", icon: GitBranch },
  ];

  return (
    <div>
      {/* WC Sub-navigation */}
      <div className="flex items-center gap-2 mb-6">
        {WC_VIEWS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setWcView(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border",
                wcView === tab.id
                  ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                  : "text-neutral-400 border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:text-white"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span
                  className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[16px] text-center",
                    liveMatches.length > 0
                      ? "bg-red-500/20 text-red-300 animate-pulse"
                      : "bg-yellow-500/20 text-yellow-300"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          <span className="ml-3 text-neutral-400 text-sm">
            Loading World Cup data...
          </span>
        </div>
      )}

      {/* No data fallback */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Trophy className="w-12 h-12 text-yellow-500/30" />
          <h3 className="text-lg font-bold text-white/60">
            World Cup 2026 Data
          </h3>
          <p className="text-neutral-400 text-sm text-center max-w-lg leading-relaxed">
            The World Cup 2026 API (worldcup26.ir) is currently unavailable or
            has not published data yet. The tournament runs{" "}
            <strong className="text-white/70">June 11 – July 19, 2026</strong>{" "}
            across 16 stadiums in the USA, Canada & Mexico with 48 teams.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-sm">
            {[
              { label: "48", sub: "Teams" },
              { label: "104", sub: "Matches" },
              { label: "16", sub: "Stadiums" },
            ].map((stat) => (
              <div
                key={stat.sub}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center"
              >
                <div className="text-2xl font-black text-yellow-400">
                  {stat.label}
                </div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1 font-semibold">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live / Today View */}
      {!isLoading && hasData && wcView === "live" && (
        <LiveTodayView
          todayMatches={todayMatches}
          liveMatches={liveMatches}
          allGames={games}
          setVideoModal={setVideoModal}
        />
      )}

      {/* Groups View */}
      {!isLoading && hasData && wcView === "groups" && (
        <GroupsView
          standings={groupStandings}
          apiGroups={groups}
          teams={teams}
        />
      )}

      {/* Bracket View */}
      {!isLoading && hasData && wcView === "bracket" && (
        <BracketView stages={stages} setVideoModal={setVideoModal} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE / TODAY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTodayView({
  todayMatches,
  liveMatches,
  allGames,
  setVideoModal,
}: {
  todayMatches: WCMatch[];
  liveMatches: WCMatch[];
  allGames: WCMatch[];
  setVideoModal: (modal: { embed: string; title: string } | null) => void;
}) {
  // Find upcoming matches (next 5 that haven't started)
  const upcoming = useMemo(() => {
    const now = Date.now();
    return allGames
      .filter((g) => !isFinished(g) && parseWCDate(g.local_date).getTime() > now)
      .sort(
        (a, b) =>
          parseWCDate(a.local_date).getTime() -
          parseWCDate(b.local_date).getTime()
      )
      .slice(0, 8);
  }, [allGames]);

  // Recently finished (last 5)
  const recentResults = useMemo(() => {
    return allGames
      .filter((g) => isFinished(g))
      .sort(
        (a, b) =>
          parseWCDate(b.local_date).getTime() -
          parseWCDate(a.local_date).getTime()
      )
      .slice(0, 6);
  }, [allGames]);

  return (
    <div className="space-y-8">
      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Live Now
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((m) => (
              <WCMatchCard key={m.id} match={m} variant="live" setVideoModal={setVideoModal} />
            ))}
          </div>
        </div>
      )}

      {/* Today's Matches */}
      {todayMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Today's Matches
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayMatches.map((m) => (
              <WCMatchCard key={m.id} match={m} variant="today" setVideoModal={setVideoModal} />
            ))}
          </div>
        </div>
      )}

      {/* No matches today */}
      {todayMatches.length === 0 && liveMatches.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">
            No matches scheduled for today.
          </p>
        </div>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            Recent Results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentResults.map((m) => (
              <WCMatchCard key={m.id} match={m} variant="result" setVideoModal={setVideoModal} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Coming Up Next
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((m) => (
              <WCMatchCard key={m.id} match={m} variant="upcoming" setVideoModal={setVideoModal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WC Match Card ───────────────────────────────────────────────────────────

function WCMatchCard({
  match,
  variant,
  setVideoModal,
}: {
  key?: React.Key;
  match: WCMatch;
  variant: "live" | "today" | "result" | "upcoming" | "bracket";
  setVideoModal?: (modal: { embed: string; title: string } | null) => void;
}) {
  const home = getHomeTeam(match);
  const away = getAwayTeam(match);
  const hs = getScore(match.home_score);
  const as_ = getScore(match.away_score);
  const finished = isFinished(match);
  const matchDate = parseWCDate(match.local_date);
  const homeScorersList = parseScorers(match.home_scorers);
  const awayScorersList = parseScorers(match.away_scorers);
  const homeWin = finished && hs !== null && as_ !== null && hs > as_;
  const awayWin = finished && hs !== null && as_ !== null && as_ > hs;

  const stageLabel =
    match.type === "group"
      ? `Group ${match.group}`
      : match.type === "r32"
      ? "Round of 32"
      : match.type === "r16"
      ? "Round of 16"
      : match.type === "qf"
      ? "Quarter-final"
      : match.type === "sf"
      ? "Semi-final"
      : match.type === "third"
      ? "3rd Place"
      : match.type === "final"
      ? "Final"
      : match.group;

  // Retrieve cached teams and stadiums data
  const { data: teams = [] } = useQuery<WCTeam[]>({
    queryKey: ["wc-teams"],
    enabled: false,
  });

  const { data: wcStadiums = [] } = useQuery<WCStadium[]>({
    queryKey: ["wc-stadiums"],
    enabled: false,
  });

  const getTeamLogo = (teamName: string, teamId?: string) => {
    if (!teamName || teamName === "TBD") return "";

    // Official API-Football (api-sports.io) team logo URLs
    const logos: Record<string, string> = {
      "Belgium": "https://media.api-sports.io/football/teams/1.png",
      "France": "https://media.api-sports.io/football/teams/2.png",
      "Croatia": "https://media.api-sports.io/football/teams/3.png",
      "Sweden": "https://media.api-sports.io/football/teams/5.png",
      "Brazil": "https://media.api-sports.io/football/teams/6.png",
      "Uruguay": "https://media.api-sports.io/football/teams/7.png",
      "Colombia": "https://media.api-sports.io/football/teams/8.png",
      "Spain": "https://media.api-sports.io/football/teams/9.png",
      "England": "https://media.api-sports.io/football/teams/10.png",
      "Panama": "https://media.api-sports.io/football/teams/11.png",
      "Japan": "https://media.api-sports.io/football/teams/12.png",
      "Senegal": "https://media.api-sports.io/football/teams/13.png",
      "Serbia": "https://media.api-sports.io/football/teams/14.png",
      "Switzerland": "https://media.api-sports.io/football/teams/15.png",
      "Mexico": "https://media.api-sports.io/football/teams/16.png",
      "South Korea": "https://media.api-sports.io/football/teams/17.png",
      "Australia": "https://media.api-sports.io/football/teams/20.png",
      "Denmark": "https://media.api-sports.io/football/teams/21.png",
      "Iran": "https://media.api-sports.io/football/teams/22.png",
      "Saudi Arabia": "https://media.api-sports.io/football/teams/23.png",
      "Poland": "https://media.api-sports.io/football/teams/24.png",
      "Germany": "https://media.api-sports.io/football/teams/25.png",
      "Argentina": "https://media.api-sports.io/football/teams/26.png",
      "Portugal": "https://media.api-sports.io/football/teams/27.png",
      "Tunisia": "https://media.api-sports.io/football/teams/28.png",
      "Costa Rica": "https://media.api-sports.io/football/teams/29.png",
      "Morocco": "https://media.api-sports.io/football/teams/31.png",
      "Egypt": "https://media.api-sports.io/football/teams/32.png",
      "Turkey": "https://media.api-sports.io/football/teams/777.png",
      "Austria": "https://media.api-sports.io/football/teams/775.png",
      "Wales": "https://media.api-sports.io/football/teams/767.png",
      "Italy": "https://media.api-sports.io/football/teams/768.png",
      "Norway": "https://media.api-sports.io/football/teams/1090.png",
      "Netherlands": "https://media.api-sports.io/football/teams/1118.png",
      "Ivory Coast": "https://media.api-sports.io/football/teams/1501.png",
      "Democratic Republic of the Congo": "https://media.api-sports.io/football/teams/1508.png",
      "Ghana": "https://media.api-sports.io/football/teams/1504.png",
      "Cameroon": "https://media.api-sports.io/football/teams/1530.png",
      "Algeria": "https://media.api-sports.io/football/teams/1532.png",
      "Jordan": "https://media.api-sports.io/football/teams/1548.png",
      "Iraq": "https://media.api-sports.io/football/teams/1567.png",
      "Uzbekistan": "https://media.api-sports.io/football/teams/1568.png",
      "Qatar": "https://media.api-sports.io/football/teams/1569.png",
      "Ecuador": "https://media.api-sports.io/football/teams/2382.png",
      "USA": "https://media.api-sports.io/football/teams/2384.png",
      "United States": "https://media.api-sports.io/football/teams/2384.png",
      "New Zealand": "https://media.api-sports.io/football/teams/4673.png",
      "Canada": "https://media.api-sports.io/football/teams/5529.png",
      "Cape Verde": "https://media.api-sports.io/football/teams/1517.png"
    };

    if (logos[teamName]) return logos[teamName];

    // Fallback 1: cache team flag from teams API
    const team = teams.find(
      (t: any) =>
        (teamId && t.id?.toString() === teamId.toString()) ||
        t.name_en?.toLowerCase() === teamName.toLowerCase() ||
        t.name?.toLowerCase() === teamName.toLowerCase()
    );
    if (team?.flag) return team.flag;

    // Fallback 2: flagcdn
    const flags: Record<string, string> = {
      "Argentina": "https://flagcdn.com/w80/ar.png",
      "Australia": "https://flagcdn.com/w80/au.png",
      "Belgium": "https://flagcdn.com/w80/be.png",
      "Brazil": "https://flagcdn.com/w80/br.png",
      "Canada": "https://flagcdn.com/w80/ca.png",
      "Cape Verde": "https://flagcdn.com/w80/cv.png",
      "Colombia": "https://flagcdn.com/w80/co.png",
      "Croatia": "https://flagcdn.com/w80/hr.png",
      "Denmark": "https://flagcdn.com/w80/dk.png",
      "Ecuador": "https://flagcdn.com/w80/ec.png",
      "England": "https://flagcdn.com/w80/gb-eng.png",
      "France": "https://flagcdn.com/w80/fr.png",
      "Germany": "https://flagcdn.com/w80/de.png",
      "Ghana": "https://flagcdn.com/w80/gh.png",
      "Iran": "https://flagcdn.com/w80/ir.png",
      "Italy": "https://flagcdn.com/w80/it.png",
      "Japan": "https://flagcdn.com/w80/jp.png",
      "Mexico": "https://flagcdn.com/w80/mx.png",
      "Netherlands": "https://flagcdn.com/w80/nl.png",
      "New Zealand": "https://flagcdn.com/w80/nz.png",
      "Portugal": "https://flagcdn.com/w80/pt.png",
      "Saudi Arabia": "https://flagcdn.com/w80/sa.png",
      "Senegal": "https://flagcdn.com/w80/sn.png",
      "Spain": "https://flagcdn.com/w80/es.png",
      "Switzerland": "https://flagcdn.com/w80/ch.png",
      "Tunisia": "https://flagcdn.com/w80/tn.png",
      "Uruguay": "https://flagcdn.com/w80/uy.png",
      "USA": "https://flagcdn.com/w80/us.png",
      "United States": "https://flagcdn.com/w80/us.png",
      "Morocco": "https://flagcdn.com/w80/ma.png",
      "South Korea": "https://flagcdn.com/w80/kr.png",
      "Poland": "https://flagcdn.com/w80/pl.png",
      "Turkey": "https://flagcdn.com/w80/tr.png",
      "Algeria": "https://flagcdn.com/w80/dz.png",
      "Austria": "https://flagcdn.com/w80/at.png",
      "Jordan": "https://flagcdn.com/w80/jo.png",
      "Uzbekistan": "https://flagcdn.com/w80/uz.png",
      "Sweden": "https://flagcdn.com/w80/se.png",
      "Panama": "https://flagcdn.com/w80/pa.png",
      "Iraq": "https://flagcdn.com/w80/iq.png",
      "Norway": "https://flagcdn.com/w80/no.png",
      "Democratic Republic of the Congo": "https://flagcdn.com/w80/cd.png"
    };
    return flags[teamName] || "";
  };

  const homeLogo = getTeamLogo(home, match.home_team_id);
  const awayLogo = getTeamLogo(away, match.away_team_id);

  const stadium = wcStadiums.find(
    (s) => s.id?.toString() === match.stadium_id?.toString()
  );
  const stadiumName = stadium?.name_en || stadium?.name || "";

  // Map stadium ID to a highly specific, beautiful Unsplash stadium image
  const STADIUM_IMAGES: Record<string, string> = {
    "1": "photo-1599158156475-c9dbbeb25c93", // Estadio Azteca
    "2": "photo-1551958219-acbc608c6377", // Estadio Akron
    "3": "photo-1624887009213-04015690b2e8", // Estadio BBVA
    "4": "photo-1522771739844-6a9f6d5f14af", // AT&T Stadium
    "5": "photo-1536122985607-4fe00b283652", // SoFi Stadium
    "6": "photo-1508847154043-be12a7285657", // NRG Stadium
    "7": "photo-1508098682722-e99c43a406b2", // Mercedes-Benz Stadium
    "8": "photo-1518091205522-72108c50e4e1", // Hard Rock Stadium
    "9": "photo-1516738901171-8eb4fc13bd20", // Lincoln Financial Field
    "10": "photo-1529900748604-07564a03e7a6", // Lumen Field
    "11": "photo-1505242844905-ac1f3045472b", // Gillette Stadium
    "12": "photo-1504156806644-7089af7e53f0", // Arrowhead Stadium
    "13": "photo-1431324155629-1a6edd1dec8d", // Levi's Stadium
    "14": "photo-1614632537423-1e6c2e7a0aab", // BMO Field
    "15": "photo-1556056504-5c73a6e61f47", // BC Place
    "16": "photo-1517927033932-b3d18e61fb3a"  // MetLife Stadium
  };

  const bgId = STADIUM_IMAGES[match.stadium_id] || "photo-1508098682722-e99c43a406b2";
  const bgUrl = `https://images.unsplash.com/${bgId}?q=80&w=600&auto=format&fit=crop`;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl",
        variant === "live"
          ? "border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
          : variant === "result" && finished
          ? "border border-emerald-500/20"
          : "border border-white/10"
      )}
    >
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <img
          src={bgUrl}
          alt="Match Cover"
          onError={(e) => {
            if (!e.currentTarget.src.endsWith('/world_cup_bg.png')) {
              e.currentTarget.src = '/world_cup_bg.png';
            } else {
              e.currentTarget.style.display = 'none';
            }
          }}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-[#0a0a0a]/60" />
        <div className="absolute inset-0 bg-yellow-900/10 mix-blend-color" />
      </div>

      <div className="relative z-10 p-5">
        {/* Header: Stage + Date */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md",
              variant === "live"
                ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                : match.type === "final"
                ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                : match.type === "group"
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
            )}
          >
            {variant === "live" ? "● LIVE" : stageLabel}
          </span>
          <span className="text-xs font-medium text-neutral-300 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md">
            {matchDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {" · "}
            {matchDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        </div>

        {/* Teams + Score */}
        <div className="flex items-center gap-4 mb-4">
          {/* Home */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-end gap-2.5">
              <p
                className={cn(
                  "text-base md:text-lg font-black truncate drop-shadow-md",
                  homeWin ? "text-yellow-400" : "text-white"
                )}
              >
                {home}
              </p>
              {homeLogo && (
                <img
                  src={homeLogo}
                  alt={home}
                  className="w-6 h-6 object-contain shadow-sm shrink-0"
                />
              )}
            </div>
            {homeScorersList.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {homeScorersList.map((s, i) => (
                  <p key={i} className="text-[10px] text-neutral-400 truncate font-medium">
                    ⚽ {s}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Score */}
          <div
            className={cn(
              "px-4 py-2 rounded-xl text-xl font-black min-w-[72px] text-center shrink-0 border backdrop-blur-md shadow-lg",
              finished
                ? "bg-black/60 border-white/10 text-white"
                : variant === "live"
                ? "bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
                : "bg-black/40 border-white/5 text-neutral-400"
            )}
          >
            {hs !== null && as_ !== null ? `${hs} - ${as_}` : "VS"}
          </div>

          {/* Away */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-start gap-2.5">
              {awayLogo && (
                <img
                  src={awayLogo}
                  alt={away}
                  className="w-6 h-6 object-contain shadow-sm shrink-0"
                />
              )}
              <p
                className={cn(
                  "text-base md:text-lg font-black truncate drop-shadow-md",
                  awayWin ? "text-yellow-400" : "text-white"
                )}
              >
                {away}
              </p>
            </div>
            {awayScorersList.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {awayScorersList.map((s, i) => (
                  <p key={i} className="text-[10px] text-neutral-400 truncate font-medium">
                    ⚽ {s}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Venue Info */}
        {stadiumName && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider bg-black/45 px-3 py-1.5 rounded-lg border border-white/5 w-fit mx-auto backdrop-blur-md shadow-sm">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>{stadiumName}</span>
            {stadium?.city_en && <span className="text-neutral-500">· {stadium.city_en}</span>}
          </div>
        )}

        {/* Action Button */}
        {setVideoModal && (
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-center">
            <button
              onClick={() => {
                let embedHtml = `
<div class="w-full aspect-video bg-[#0a0a0a] flex flex-col items-center justify-center p-4 md:p-6 text-center rounded-xl">
  <div class="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
     <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
     </svg>
  </div>
  <h3 class="text-xl md:text-2xl font-bold text-white mb-2">Chọn nguồn phát</h3>
  <p class="text-neutral-400 text-sm md:text-base mb-6 max-w-md">Các nền tảng phát sóng trực tiếp và highlight tại Việt Nam cho trận đấu <strong class="text-white">${home}</strong> vs <strong class="text-white">${away}</strong>.</p>
  
  <div class="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full">`;

                if (variant === "live" || variant === "today") {
                  embedHtml += `
    <a href="https://vtvgo.vn" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)]">
      📺 VTV Go (Chính thống)
    </a>
    <a href="https://xoilacz.net" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl font-bold transition-colors border border-white/10 text-sm shadow-lg">
      ⚡ Xoilac TV (Lậu)
    </a>
    <a href="https://thapcam.net" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl font-bold transition-colors border border-white/10 text-sm shadow-lg">
      🔥 Thập Cẩm TV (Lậu)
    </a>`;
                }

                if (finished) {
                  embedHtml += `
    <a href="https://www.youtube.com/results?search_query=Highlights+${encodeURIComponent(home)}+vs+${encodeURIComponent(away)}+World+Cup" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors text-sm shadow-[0_0_15px_rgba(220,38,38,0.3)]">
      ▶️ YouTube Highlights
    </a>`;
                }

                embedHtml += `
  </div>
</div>`;

                setVideoModal({
                  embed: embedHtml,
                  title: `${home} vs ${away} - ${variant === "live" ? 'Trực tiếp' : 'Highlights'}`
                });
              }}
              className={cn(
                "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300",
                variant === "live"
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_4px_15px_rgba(220,38,38,0.3)]"
                  : finished
                  ? "bg-emerald-600/80 hover:bg-emerald-500 text-white backdrop-blur-md shadow-[0_4px_15px_rgba(5,150,105,0.2)]"
                  : "bg-white/10 hover:bg-white/20 text-neutral-300 backdrop-blur-md"
              )}
            >
              <Play className="w-4 h-4" />
              {variant === "live" ? "Watch Live" : finished ? "Watch Highlights" : "Remind Me"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function GroupsView({
  standings: computedStandings,
  apiGroups,
  teams,
}: {
  standings: GroupStanding[];
  apiGroups: WCGroup[];
  teams: WCTeam[];
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Use computed standings if available, otherwise fall back to API groups
  const displayGroups = computedStandings.length > 0 ? computedStandings : null;

  if (!displayGroups && apiGroups.length === 0) {
    return (
      <div className="text-center py-16">
        <Globe className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
        <p className="text-neutral-500 text-sm">
          Group data is not yet available.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {displayGroups
        ? displayGroups.map((gs) => (
            <GroupCard
              key={gs.group}
              groupStanding={gs}
              expanded={expandedGroup === gs.group}
              onToggle={() =>
                setExpandedGroup(
                  expandedGroup === gs.group ? null : gs.group
                )
              }
            />
          ))
        : apiGroups.map((group) => (
            <div
              key={group.name}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden"
            >
              <div className="px-4 py-3 bg-yellow-500/5 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-yellow-400">
                  {group.name}
                </h3>
              </div>
              <div className="p-3">
                {(group.teams || []).map((team, i) => (
                  <div
                    key={team.id || i}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    {team.flag && (
                      <img
                        src={team.flag}
                        alt={team.code}
                        className="w-6 h-4 rounded-sm object-cover"
                      />
                    )}
                    <span className="text-sm text-white font-medium flex-1">
                      {team.name}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      {team.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  );
}

function GroupCard({
  groupStanding,
  expanded,
  onToggle,
}: {
  key?: React.Key;
  groupStanding: GroupStanding;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { group, standings, matches } = groupStanding;

  return (
    <div
      className={cn(
        "bg-white/[0.03] border rounded-2xl overflow-hidden transition-all duration-300",
        expanded
          ? "border-yellow-500/20 shadow-[0_0_25px_rgba(234,179,8,0.06)]"
          : "border-white/[0.06]"
      )}
    >
      {/* Group Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/8 to-transparent border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Group {group}
        </h3>
        <span className="text-[9px] text-neutral-500 font-medium">
          {matches.filter(isFinished).length}/{matches.length} played
        </span>
      </div>

      {/* Standings Table */}
      <div className="px-3 py-2">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-neutral-500 uppercase tracking-wider">
              <th className="text-left py-1.5 font-semibold pl-1">#</th>
              <th className="text-left py-1.5 font-semibold">Team</th>
              <th className="text-center py-1.5 font-semibold w-6">P</th>
              <th className="text-center py-1.5 font-semibold w-6">W</th>
              <th className="text-center py-1.5 font-semibold w-6">D</th>
              <th className="text-center py-1.5 font-semibold w-6">L</th>
              <th className="text-center py-1.5 font-semibold w-8">GD</th>
              <th className="text-center py-1.5 font-semibold w-7">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => {
              const qualified = i < 2;
              const thirdPlace = i === 2;
              return (
                <tr
                  key={t.team}
                  className={cn(
                    "border-t border-white/[0.03] transition-colors",
                    qualified
                      ? "bg-emerald-500/[0.04]"
                      : thirdPlace
                      ? "bg-yellow-500/[0.02]"
                      : ""
                  )}
                >
                  <td className="py-1.5 pl-1 font-mono text-neutral-500">
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold",
                        qualified
                          ? "bg-emerald-500/20 text-emerald-300"
                          : thirdPlace
                          ? "bg-yellow-500/15 text-yellow-400/70"
                          : "text-neutral-600"
                      )}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-1.5 font-semibold text-white truncate max-w-[120px]">
                    {t.team}
                  </td>
                  <td className="text-center py-1.5 text-neutral-400">
                    {t.played}
                  </td>
                  <td className="text-center py-1.5 text-neutral-400">
                    {t.won}
                  </td>
                  <td className="text-center py-1.5 text-neutral-400">
                    {t.drawn}
                  </td>
                  <td className="text-center py-1.5 text-neutral-400">
                    {t.lost}
                  </td>
                  <td
                    className={cn(
                      "text-center py-1.5 font-semibold",
                      t.goalDifference > 0
                        ? "text-emerald-400"
                        : t.goalDifference < 0
                        ? "text-red-400"
                        : "text-neutral-500"
                    )}
                  >
                    {t.goalDifference > 0
                      ? `+${t.goalDifference}`
                      : t.goalDifference}
                  </td>
                  <td className="text-center py-1.5 font-black text-white">
                    {t.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expand to show matches */}
      <button
        onClick={onToggle}
        className="w-full py-2 flex items-center justify-center gap-1 text-[10px] text-neutral-500 hover:text-yellow-400 transition-colors cursor-pointer border-t border-white/[0.04]"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Hide matches
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Show matches
          </>
        )}
      </button>

      {/* Expanded matches */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/[0.04] pt-2">
              {matches.map((m) => {
                const home = getHomeTeam(m);
                const away = getAwayTeam(m);
                const hs = getScore(m.home_score);
                const as_ = getScore(m.away_score);
                const fin = isFinished(m);
                const d = parseWCDate(m.local_date);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]",
                      fin
                        ? "bg-white/[0.02]"
                        : "bg-white/[0.01] opacity-70"
                    )}
                  >
                    <span className="text-neutral-500 w-12 shrink-0 text-[10px]">
                      {d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-right font-semibold truncate",
                        fin && hs !== null && as_ !== null && hs > as_
                          ? "text-emerald-300"
                          : "text-white/80"
                      )}
                    >
                      {home}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold min-w-[40px] text-center",
                        fin
                          ? "bg-white/[0.06] text-white"
                          : "bg-white/[0.03] text-neutral-500"
                      )}
                    >
                      {fin && hs !== null && as_ !== null
                        ? `${hs}-${as_}`
                        : d.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                    </span>
                    <span
                      className={cn(
                        "flex-1 font-semibold truncate",
                        fin && hs !== null && as_ !== null && as_ > hs
                          ? "text-emerald-300"
                          : "text-white/80"
                      )}
                    >
                      {away}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function BracketView({
  stages,
  setVideoModal,
}: {
  stages: ReturnType<typeof classifyByStage>;
  setVideoModal: (modal: { embed: string; title: string } | null) => void;
}) {
  const bracketStages = [
    { key: "r32", label: "Round of 32", matches: stages.r32, color: "blue" },
    { key: "r16", label: "Round of 16", matches: stages.r16, color: "purple" },
    {
      key: "qf",
      label: "Quarter-finals",
      matches: stages.qf,
      color: "amber",
    },
    {
      key: "sf",
      label: "Semi-finals",
      matches: stages.sf,
      color: "orange",
    },
    {
      key: "third",
      label: "3rd Place",
      matches: stages.third,
      color: "neutral",
    },
    {
      key: "final",
      label: "Final",
      matches: stages.final,
      color: "yellow",
    },
  ];

  const totalKnockout =
    stages.r32.length +
    stages.r16.length +
    stages.qf.length +
    stages.sf.length +
    stages.third.length +
    stages.final.length;

  if (totalKnockout === 0) {
    return (
      <div className="text-center py-16">
        <GitBranch className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
        <p className="text-neutral-500 text-sm">
          Knockout stage data is not yet available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Bracket Overview Bar */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-x-auto scrollbar-hide">
        {bracketStages
          .filter((s) => s.matches.length > 0)
          .map((stage) => {
            const finished = stage.matches.filter(isFinished).length;
            const total = stage.matches.length;
            const pct = total > 0 ? (finished / total) * 100 : 0;
            return (
              <div
                key={stage.key}
                className="flex-1 min-w-[100px] px-3 py-2 text-center"
              >
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
                  {stage.label}
                </div>
                <div className="text-xs font-bold text-white">
                  {finished}/{total}
                </div>
                <div className="mt-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Bracket Stages */}
      {bracketStages
        .filter((s) => s.matches.length > 0)
        .map((stage) => (
          <BracketStage
            key={stage.key}
            label={stage.label}
            matches={stage.matches}
            colorTheme={stage.color}
            isFinal={stage.key === "final"}
            setVideoModal={setVideoModal}
          />
        ))}
    </div>
  );
}

function BracketStage({
  label,
  matches,
  colorTheme,
  isFinal,
  setVideoModal,
}: {
  key?: React.Key;
  label: string;
  matches: WCMatch[];
  colorTheme: string;
  isFinal: boolean;
  setVideoModal: (modal: { embed: string; title: string } | null) => void;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> =
    {
      blue: {
        bg: "bg-blue-500/8",
        text: "text-blue-300",
        border: "border-blue-500/20",
      },
      purple: {
        bg: "bg-purple-500/8",
        text: "text-purple-300",
        border: "border-purple-500/20",
      },
      amber: {
        bg: "bg-amber-500/8",
        text: "text-amber-300",
        border: "border-amber-500/20",
      },
      orange: {
        bg: "bg-orange-500/8",
        text: "text-orange-300",
        border: "border-orange-500/20",
      },
      yellow: {
        bg: "bg-yellow-500/10",
        text: "text-yellow-300",
        border: "border-yellow-500/25",
      },
      neutral: {
        bg: "bg-white/[0.04]",
        text: "text-neutral-300",
        border: "border-white/[0.08]",
      },
    };

  const colors = colorMap[colorTheme] || colorMap.neutral;

  return (
    <div>
      {/* Stage Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-bold border",
            colors.bg,
            colors.text,
            colors.border
          )}
        >
          {label}
        </div>
        <div className="flex-1 h-px bg-white/[0.04]" />
        <span className="text-[10px] text-neutral-600 font-medium">
          {matches.filter(isFinished).length}/{matches.length} completed
        </span>
      </div>

      {/* Match Grid */}
      <div
        className={cn(
          "grid gap-3",
          isFinal
            ? "grid-cols-1 max-w-lg mx-auto"
            : matches.length <= 2
            ? "grid-cols-1 md:grid-cols-2"
            : matches.length <= 4
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {matches.map((m) => (
          <BracketMatchCard
            key={m.id}
            match={m}
            isFinal={isFinal}
            colorTheme={colorTheme}
            setVideoModal={setVideoModal}
          />
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  isFinal,
  colorTheme,
  setVideoModal,
}: {
  key?: React.Key;
  match: WCMatch;
  isFinal: boolean;
  colorTheme: string;
  setVideoModal: (modal: { embed: string; title: string } | null) => void;
}) {
  const home = getHomeTeam(match);
  const away = getAwayTeam(match);
  const hs = getScore(match.home_score);
  const as_ = getScore(match.away_score);
  const finished = isFinished(match);
  const live = isLive(match);
  const d = parseWCDate(match.local_date);
  const homeWin = finished && hs !== null && as_ !== null && hs > as_;
  const awayWin = finished && hs !== null && as_ !== null && as_ > hs;
  const homeScorersList = parseScorers(match.home_scorers);
  const awayScorersList = parseScorers(match.away_scorers);

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all duration-300 hover:bg-white/[0.04]",
        isFinal
          ? "bg-gradient-to-br from-yellow-500/[0.06] to-white/[0.02] border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.06)]"
          : live
          ? "bg-white/[0.03] border-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.06)]"
          : finished
          ? "bg-white/[0.03] border-emerald-500/10"
          : "bg-white/[0.02] border-white/[0.06]"
      )}
    >
      {/* Match Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04]">
        <span className="text-[9px] text-neutral-500 font-medium">
          Match {match.id}
        </span>
        {live ? (
          <span className="flex items-center gap-1 text-[9px] text-red-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[9px] text-neutral-600">
            {d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {" · "}
            {d.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        )}
      </div>

      {/* Home Team */}
      <div
        className={cn(
          "px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.03]",
          homeWin ? "bg-emerald-500/[0.04]" : ""
        )}
      >
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-xs font-bold truncate",
              homeWin
                ? "text-emerald-300"
                : finished && awayWin
                ? "text-neutral-500"
                : "text-white/80"
            )}
          >
            {home}
          </p>
          {homeScorersList.length > 0 && (
            <p className="text-[8px] text-neutral-600 mt-0.5 truncate">
              {homeScorersList.join(", ")}
            </p>
          )}
        </div>
        <span
          className={cn(
            "text-sm font-black w-6 text-center",
            homeWin
              ? "text-emerald-300"
              : finished
              ? "text-white"
              : "text-neutral-600"
          )}
        >
          {hs !== null ? hs : "-"}
        </span>
      </div>

      {/* Away Team */}
      <div
        className={cn(
          "px-3 py-2.5 flex items-center gap-2",
          awayWin ? "bg-emerald-500/[0.04]" : ""
        )}
      >
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-xs font-bold truncate",
              awayWin
                ? "text-emerald-300"
                : finished && homeWin
                ? "text-neutral-500"
                : "text-white/80"
            )}
          >
            {away}
          </p>
          {awayScorersList.length > 0 && (
            <p className="text-[8px] text-neutral-600 mt-0.5 truncate">
              {awayScorersList.join(", ")}
            </p>
          )}
        </div>
        <span
          className={cn(
            "text-sm font-black w-6 text-center",
            awayWin
              ? "text-emerald-300"
              : finished
              ? "text-white"
              : "text-neutral-600"
          )}
        >
          {as_ !== null ? as_ : "-"}
        </span>
      </div>

      {/* Watch Button Overlay (Hover) */}
      <div className="px-3 pb-3 pt-1 border-t border-white/[0.02]">
         <button
            onClick={() => {
                const embedHtml = `
<div class="w-full aspect-video bg-[#0a0a0a] flex flex-col items-center justify-center p-4 md:p-6 text-center rounded-xl">
  <div class="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
     <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
     </svg>
  </div>
  <h3 class="text-xl md:text-2xl font-bold text-white mb-2">Chọn nguồn phát</h3>
  <p class="text-neutral-400 text-sm md:text-base mb-6 max-w-md">Các nền tảng phát sóng trực tiếp và highlight tại Việt Nam cho trận đấu <strong class="text-white">${home}</strong> vs <strong class="text-white">${away}</strong>.</p>
  
  <div class="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full">
    ${live ? `
    <a href="https://vtvgo.vn" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)]">
      📺 VTV Go (Chính thống)
    </a>
    <a href="https://xoilacz.net" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl font-bold transition-colors border border-white/10 text-sm shadow-lg">
      ⚡ Xoilac TV (Lậu)
    </a>
    <a href="https://thapcam.net" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-xl font-bold transition-colors border border-white/10 text-sm shadow-lg">
      🔥 Thập Cẩm TV (Lậu)
    </a>
    ` : ''}
    ${finished ? `
    <a href="https://www.youtube.com/results?search_query=Highlights+${encodeURIComponent(home)}+vs+${encodeURIComponent(away)}+World+Cup" target="_blank" rel="noopener noreferrer" class="px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors text-sm shadow-[0_0_15px_rgba(220,38,38,0.3)]">
      ▶️ YouTube Highlights
    </a>
    ` : ''}
  </div>
</div>
`;
              setVideoModal({
                embed: embedHtml,
                title: `${home} vs ${away} - ${live ? 'Trực tiếp' : 'Highlights'}`
              });
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
              live
                ? "bg-red-600 hover:bg-red-500 text-white"
                : finished
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 text-neutral-500 cursor-not-allowed"
            )}
            disabled={!live && !finished}
          >
            <Play className="w-3 h-3" />
            {live ? "Watch Live" : finished ? "Highlights" : "Upcoming"}
          </button>
      </div>
    </div>
  );
}

// ─── Stadiums Section ────────────────────────────────────────────────────────

function StadiumsSection({
  stadiums,
  loading,
}: {
  stadiums: WCStadium[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-neutral-400 text-sm">
          Loading stadiums...
        </span>
      </div>
    );
  }

  if (stadiums.length === 0) {
    // Hardcoded fallback for the 16 WC2026 stadiums
    const fallbackStadiums = [
      { name: "MetLife Stadium", city: "New York/New Jersey", capacity: 82500 },
      { name: "AT&T Stadium", city: "Dallas", capacity: 80000 },
      { name: "SoFi Stadium", city: "Los Angeles", capacity: 70240 },
      { name: "NRG Stadium", city: "Houston", capacity: 72220 },
      { name: "Mercedes-Benz Stadium", city: "Atlanta", capacity: 71000 },
      { name: "Hard Rock Stadium", city: "Miami", capacity: 65326 },
      { name: "Lincoln Financial Field", city: "Philadelphia", capacity: 69176 },
      { name: "Lumen Field", city: "Seattle", capacity: 69000 },
      { name: "Gillette Stadium", city: "Boston", capacity: 65878 },
      { name: "Arrowhead Stadium", city: "Kansas City", capacity: 76416 },
      { name: "Levi's Stadium", city: "San Francisco/Bay Area", capacity: 68500 },
      { name: "Estadio Azteca", city: "Mexico City", capacity: 87523 },
      { name: "Estadio BBVA", city: "Monterrey", capacity: 53500 },
      { name: "Estadio Akron", city: "Guadalajara", capacity: 49850 },
      { name: "BMO Field", city: "Toronto", capacity: 30991 },
      { name: "BC Place", city: "Vancouver", capacity: 54500 },
    ];

    return (
      <div>
        <div className="mb-6">
          <p className="text-neutral-400 text-sm">
            16 host stadiums across 3 countries — USA, Canada & Mexico.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {fallbackStadiums.map((s) => (
            <StadiumCard
              key={s.name}
              name={s.name}
              city={s.city}
              capacity={s.capacity}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {stadiums.map((s) => (
        <StadiumCard
          key={s.id}
          name={s.name}
          city={s.city}
          capacity={s.capacity}
          image={s.image}
        />
      ))}
    </div>
  );
}

function StadiumCard({
  name,
  city,
  capacity,
  image,
}: {
  key?: React.Key;
  name: string;
  city: string;
  capacity?: number;
  image?: string;
}) {
  // Derive country flag from city
  const isCanada = ["Toronto", "Vancouver"].some((c) =>
    city.includes(c)
  );
  const isMexico = ["Mexico", "Monterrey", "Guadalajara"].some((c) =>
    city.includes(c)
  );
  const flag = isCanada ? "🇨🇦" : isMexico ? "🇲🇽" : "🇺🇸";

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-emerald-500/15 hover:bg-white/[0.05] transition-all duration-300 group">
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-full h-36 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-emerald-950/50 to-[#0a0a0a] flex items-center justify-center">
          <MapPin className="w-10 h-10 text-emerald-500/15 group-hover:text-emerald-500/25 transition-colors" />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-sm font-bold text-white mb-1 leading-tight">
          {name}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <span>{flag}</span>
          <span>{city}</span>
        </div>
        {capacity != null && (
          <div className="mt-2 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-neutral-500" />
            <span className="text-[10px] text-neutral-500 font-medium">
              {capacity.toLocaleString()} seats
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
