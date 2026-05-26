import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  X,
  Plus,
  Check,
  Search,
  Download,
  Youtube,
  Users
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SafeImage } from "../ui/ImageShimmer";
import { NetflixPlayer } from "../player/NetflixPlayer";
import { SimilarMovies } from "./SimilarMovies";
import { CustomSelect } from "../ui/CustomSelect";
import { useMovieDetail } from "../../hooks/movie/useMovieDetail";
import { YoutubeTrailerModal } from "./YoutubeTrailerModal";
import { fetchSearch } from "../../api/phimApi";

export const MovieDetail = ({
  slug,
  onClose,
  onSelect,
}: {
  slug: string;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) => {
  const {
    data, isLoading,
    actorsData, imdbRating, trailerYoutubeId, finalTmdbData,
    activeEp, setActiveEp,
    isPlaying, setIsPlaying,
    inList, handleToggleList,
    servers, selectedServerId, setSelectedServerId,
    seasonMap, currentSeasonNumber,
    tmdbEpisodeMap
  } = useMovieDetail(slug);

  const [isShowingTrailer, setIsShowingTrailer] = useState(false);
  const [searchEp, setSearchEp] = useState("");

  const handleSimilarSelect = useCallback(
    (s: string) => {
      onSelect(s);
    },
    [onSelect],
  );

  if (isLoading)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#050505] flex flex-col justify-center items-center"
      >
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </motion.div>
    );

  if (!data?.movie) return null;
  const { movie } = data;

  const currentServer = servers[selectedServerId] || servers[0];
  const rawEpList = currentServer?.server_data || [];
  
  const epList = searchEp ? rawEpList.filter((ep: any) => ep.name.toLowerCase().includes(searchEp.toLowerCase()) || ep.overview?.toLowerCase().includes(searchEp.toLowerCase())) : rawEpList;

  const handleSelectEpisode = (ep: any) => {
    setActiveEp(ep);
    setIsPlaying(true);
  };

  const fbUrl = movie.thumb_url || movie.poster_url;
  const tmdbBackdropUrl = finalTmdbData?.backdrop_path ? `https://image.tmdb.org/t/p/original${finalTmdbData.backdrop_path}` : null;
  const tmdbPosterUrl = finalTmdbData?.poster_path ? `https://image.tmdb.org/t/p/w780${finalTmdbData.poster_path}` : null;
  
  const bgDetailImg = tmdbBackdropUrl || (typeof fbUrl === "string" && fbUrl.startsWith("http") ? fbUrl : `https://phimimg.com/${fbUrl}`);
  const posterUrl = tmdbPosterUrl || (movie.poster_url ? (movie.poster_url.startsWith("http") ? movie.poster_url : `https://phimimg.com/${movie.poster_url}`) : bgDetailImg);

  // TMDB metadata bổ sung
  const tmdbOverview = finalTmdbData?.overview;
  const tmdbRuntime = finalTmdbData?.runtime || finalTmdbData?.episode_run_time?.[0];
  const tmdbReleaseDate = finalTmdbData?.release_date || finalTmdbData?.first_air_date;
  const tmdbOriginalLang = finalTmdbData?.original_language;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto custom-scrollbar"
    >
      {!isPlaying && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[120] w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl border border-white/20 hover:scale-105"
        >
          <X size={24} />
        </button>
      )}

      {!isPlaying && (
        <div className="absolute top-0 left-0 w-full h-[60vh] sm:h-[75vh] 2xl:h-[80vh] pointer-events-none">
           <SafeImage src={bgDetailImg} alt="Hero" className="w-full h-full object-cover object-top opacity-50" />
           <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
           <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent" />
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-10 pb-20 pt-[25vh] sm:pt-[35vh] lg:pt-[45vh] relative z-10 flex flex-col gap-8 xl:gap-12">
        
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {isPlaying && activeEp ? (
              <motion.div 
                key="player"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full aspect-video rounded-2xl overflow-hidden bg-black mb-12 shadow-2xl relative z-[110] -mt-[15vh] sm:-mt-[25vh] lg:-mt-[35vh]"
              >
                <NetflixPlayer
                  url={activeEp.link_m3u8}
                  embedUrl={activeEp.link_embed}
                  title={`${movie.name} - ${activeEp.name}`}
                  slug={slug}
                  episodeName={activeEp.name}
                  posterUrl={bgDetailImg}
                  movieName={movie.name}
                  onClose={() => setIsPlaying(false)}
                  servers={servers}
                  selectedServerId={selectedServerId}
                  onServerChange={(newId) => {
                    setSelectedServerId(newId);
                    if (servers[newId]?.server_data?.find((ep: any) => ep.slug === activeEp.slug)) {
                      setActiveEp(servers[newId].server_data.find((ep: any) => ep.slug === activeEp.slug));
                    } else if (servers[newId]?.server_data?.[0]) {
                      setActiveEp(servers[newId].server_data[0]);
                    }
                  }}
                  episodes={rawEpList}
                  onEpisodeSelect={handleSelectEpisode}
                  progressStore={{}} // Note: Add proper progress store if needed
                />
              </motion.div>
            ) : (
              <motion.div 
                key="info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col md:flex-row gap-8 lg:gap-10 relative z-10"
              >
                <div className="w-48 sm:w-56 md:w-64 xl:w-72 shrink-0 mx-auto md:mx-0">
                  <SafeImage src={posterUrl} alt="Poster" className="w-full aspect-[2/3] object-cover rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10" />
                </div>

                <div className="flex-1 flex flex-col justify-end pb-4 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                    {imdbRating && (
                      <span className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-2xl text-xs font-bold text-yellow-400 shrink-0">
                        ⭐ {imdbRating} / 10
                      </span>
                    )}
                    {tmdbReleaseDate && (
                      <span className="bg-[#1a1a1a] border border-white/10 px-3 py-1.5 rounded-2xl text-xs font-semibold text-white/70 shrink-0">
                        📅 {new Date(tmdbReleaseDate).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    )}
                    {tmdbRuntime && (
                      <span className="bg-[#1a1a1a] border border-white/10 px-3 py-1.5 rounded-2xl text-xs font-semibold text-white/70 shrink-0">
                        🕐 {tmdbRuntime} phút
                      </span>
                    )}
                    {movie.category?.slice(0, 3).map((c: any) => (
                      <span key={c.name} className="bg-[#1a1a1a] border border-white/10 px-4 py-1.5 rounded-full text-xs font-medium text-gray-300">
                        {c.name === "Hanh Dong" ? "Hành Động" : 
                         c.name === "Tinh Cam" ? "Tình Cảm" : 
                         c.name === "Hai Huoc" ? "Hài Hước" : 
                         c.name === "Chinh Kich" ? "Chính Kịch" :
                         c.name === "Hinh Su" ? "Hình Sự" : c.name}
                      </span>
                    ))}
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight mb-6 drop-shadow-2xl">
                    {movie.name}
                  </h1>
                  
                  <div className="bg-[#111]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 mb-8 text-left">
                    <p className="text-base sm:text-lg text-gray-300/90 leading-relaxed font-medium">
                      {tmdbOverview || <span dangerouslySetInnerHTML={{ __html: movie.content }} />}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    <button 
                      onClick={() => { 
                        if(rawEpList[0] && !activeEp) handleSelectEpisode(rawEpList[0]);
                        else if (activeEp) setIsPlaying(true);
                        else if(rawEpList[0]) handleSelectEpisode(rawEpList[0]); 
                      }} 
                      className="bg-white hover:bg-gray-200 text-black px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors w-full sm:w-auto shadow-xl"
                    >
                      <Play size={20} fill="currentColor" /> Xem Ngay
                    </button>
                    <button 
                      onClick={handleToggleList} 
                      className="bg-[#1a1a1a] hover:bg-[#222] border border-white/10 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                    >
                      {inList ? <Check size={20} /> : <Plus size={20} />} Danh Sách
                    </button>
                    {trailerYoutubeId && (
                      <button 
                        onClick={() => setIsShowingTrailer(true)}
                        className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                      >
                        <Youtube size={20} /> Trailer
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actors Block similarly to Image 2 - Below the description */}
          {!isPlaying && actorsData && actorsData.length > 0 && (
            <div className="mt-8 bg-[#111]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users size={18} className="text-purple-400" /> Diễn Viên
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {actorsData.slice(0, 6).map((actor: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                    {actor.image || actor.avatar ? (
                      <img src={actor.image || actor.avatar} alt={actor.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-xl font-bold">
                        {actor.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white text-sm">{actor.name}</div>
                      <div className="text-xs text-gray-500">{actor.character || actor.role || "Chưa rõ"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawEpList.length > 0 && (
            <div className="mt-12 w-full">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white whitespace-nowrap">Danh sách tập</h2>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  {/* Nút chọn Server */}
                  {servers.length > 1 ? (
                    <CustomSelect
                      value={selectedServerId}
                      onChange={(newId: number) => {
                        setSelectedServerId(newId);
                        if (servers[newId]?.server_data?.[0]) {
                          setActiveEp(servers[newId].server_data[0]);
                        }
                      }}
                      options={servers.map((s: any, i: number) => ({
                        label: s.server_name,
                        value: i
                      }))}
                      className="min-w-[140px]"
                    />
                  ) : (
                    <div className="bg-[#111] border border-white/10 px-4 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap">
                      {servers[0]?.server_name || "Server 1"}
                    </div>
                  )}

                  {/* Nút chọn Phần (Season) thông minh từ PhimAPI */}
                  {seasonMap && seasonMap.length > 1 && (
                    <CustomSelect
                      value={seasonMap.findIndex((s: any) => s.seasonNumber === currentSeasonNumber)}
                      onChange={(idx: number) => {
                        const selected = seasonMap[idx];
                        if (selected && selected.slug !== slug) {
                          onSelect(selected.slug);
                        }
                      }}
                      options={seasonMap.map((s: any, i: number) => ({
                        label: s.name,
                        value: i
                      }))}
                      className="min-w-[140px]"
                    />
                  )}

                  {/* Search Bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#111] border border-white/10 rounded-lg w-full sm:w-64 focus-within:bg-[#1a1a1a] focus-within:border-white/30 transition-colors">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm tập phim..." 
                      value={searchEp}
                      onChange={(e) => setSearchEp(e.target.value)}
                      className="bg-transparent text-white outline-none placeholder:text-gray-500 w-full text-sm font-medium" 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {epList.length === 0 && (
                  <div className="col-span-full text-center py-10 text-gray-500 bg-[#111] rounded-xl">
                     Không tìm kiếm được tập nào.
                  </div>
                )}
                {epList.map((ep: any, i: number) => {
                  const isSelected = activeEp === ep;
                  // Extract episode number from name for TMDB lookup
                  const epNumMatch = ep.name?.match(/(\d+)/);
                  const epNum = epNumMatch ? parseInt(epNumMatch[1]) : i + 1;
                  const tmdbEp = tmdbEpisodeMap?.get(epNum);
                  const epStillPath = tmdbEp?.still_path || ep.still_path;
                  const epOverview = tmdbEp?.overview || ep.overview || '';
                  return (
                    <div 
                      key={i} 
                      onClick={() => handleSelectEpisode(ep)} 
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group relative",
                        isSelected ? "bg-[#1a1a1a] border border-white/20" : "bg-transparent border border-transparent"
                      )}
                    >
                      <span className="text-base font-bold text-gray-600 w-6 text-center shrink-0">
                        {isSelected ? <Play size={16} fill="currentColor" className="text-red-500 mx-auto" /> : i + 1}
                      </span>
                      
                      <div className="relative w-24 sm:w-32 shrink-0 aspect-video rounded-lg overflow-hidden bg-[#111] border border-white/5">
                        {epStillPath ? 
                          <SafeImage src={epStillPath} alt={ep.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" /> 
                        : 
                          <SafeImage src={bgDetailImg} alt="thumbnail" className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity mix-blend-luminosity" />
                        }
                        <div className="absolute inset-0 flex justify-center items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 rounded-full border-2 border-white flex justify-center items-center backdrop-blur-md">
                             <Play size={14} fill="white" className="ml-0.5 text-white" />
                          </div>
                        </div>
                        {isSelected && (
                           <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className={cn("font-bold text-sm mb-1 truncate", isSelected ? "text-white" : "text-gray-300 group-hover:text-white")}>
                          {ep.name.startsWith("Tập") ? ep.name : `Tập ${ep.name}`}
                        </h4>
                        {epOverview ? (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {epOverview}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-600 italic line-clamp-1">
                            Nội dung đang cập nhật...
                          </p>
                        )}
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); }}
                        className="w-8 h-8 rounded-full hover:bg-white/10 hidden sm:flex items-center justify-center text-gray-500 hover:text-white shrink-0 transition-colors"
                        title="Tải Xuống"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Similar Movies Bottom Section */}
        <div className="w-full">
           <SimilarMovies
              categorySlug={movie.category?.[0]?.slug}
              onSelect={handleSimilarSelect}
              currentSlug={movie.slug}
           />
        </div>
      </div>

      <YoutubeTrailerModal 
         videoId={trailerYoutubeId}
         isOpen={isShowingTrailer}
         onClose={() => setIsShowingTrailer(false)}
      />
    </motion.div>
  );
};
