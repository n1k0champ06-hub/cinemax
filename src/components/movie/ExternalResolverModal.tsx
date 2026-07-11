import React, { useEffect } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
import { useTmdbDetails } from '../../hooks/useTmdb';
import { fetchSearch } from '../../api/phimApi';
import { computeMatchScore, getResolvedSlug, setResolvedSlug } from '../../utils/movieMatcher';

export const ExternalResolverModal = ({
  id,
  onClose,
  onSelect,
}: {
  key?: React.Key;
  id: string; // e.g. "tmdb-123-movie" or "tmdb-123-tv" for TMDB
  onClose: () => void;
  onSelect: (slug: string, sourceId?: string) => void;
}) => {
  const isPresent = useIsPresent();
  const isTmdb = id.startsWith('tmdb-');
  
  // Check the resolved cache immediately to transition instantly if already computed
  useEffect(() => {
    if (!isPresent) return;
    const cached = getResolvedSlug(id);
    if (cached) {
      onSelect(cached, id);
    }
  }, [id, onSelect, isPresent]);

  const tmdbParts = isTmdb ? id.split('-') : []; // ["tmdb", "123", "tv", "2"]
  const tmdbId = isTmdb ? tmdbParts[1] : null;
  const tmdbType = isTmdb ? tmdbParts[2] as 'movie'|'tv' : 'movie';
  const tmdbSeason = isTmdb && tmdbParts[3] ? parseInt(tmdbParts[3]) : null;

  const { data: tmdbDetail, isLoading: isLoadingTmdb } = useTmdbDetails(tmdbId || 0, tmdbType);

  const isLatin = (str: string): boolean => {
    if (!str) return false;
    return /^[a-zA-Z0-9\s\-\:\(\)\[\]\+\&\'\.\,\!\?ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơ]*$/.test(str);
  };

  const titleLocalized = tmdbDetail?.title || tmdbDetail?.name || '';
  const titleOriginal = tmdbDetail?.original_title || tmdbDetail?.original_name || '';

  let primarySearchTitle = titleLocalized || titleOriginal;
  if (tmdbType === 'tv' && tmdbSeason && tmdbSeason > 1 && primarySearchTitle) {
      primarySearchTitle = `${primarySearchTitle} Season ${tmdbSeason}`;
  }

  const fallbackSearchTitle = (titleOriginal && titleOriginal !== titleLocalized && isLatin(titleOriginal)) ? titleOriginal : '';

  const displayTitle = titleLocalized || titleOriginal;

  // First attempt specific search (e.g. with Season)
  const { data: searchResultsSpecific, isLoading: isLoadingSearchSpecific } = useQuery({
    queryKey: ['phimapi_search', primarySearchTitle],
    queryFn: async () => {
      const results = await fetchSearch(primarySearchTitle);
      return results.filter((item: any) => !item.isTmdbOnly);
    },
    enabled: !!primarySearchTitle,
  });

  // If specific fails and we have a valid Latin-only original title, try searching with it
  const shouldTryFallback = !!fallbackSearchTitle && searchResultsSpecific && searchResultsSpecific.length === 0;
  const { data: searchResultsFallback, isLoading: isLoadingSearchFallback } = useQuery({
    queryKey: ['phimapi_search_fallback', fallbackSearchTitle],
    queryFn: async () => {
      const results = await fetchSearch(fallbackSearchTitle);
      return results.filter((item: any) => !item.isTmdbOnly);
    },
    enabled: shouldTryFallback,
  });

  const searchResults = (shouldTryFallback && searchResultsFallback) ? searchResultsFallback : searchResultsSpecific;
  const isLoadingSearch = isLoadingSearchSpecific || isLoadingSearchFallback;

  useEffect(() => {
    if (!isPresent) return;
    if (searchResults && searchResults.length > 0) {
      const tmdbInfo = {
        original_title: titleOriginal,
        title: titleLocalized,
        year: parseInt((tmdbDetail?.release_date || tmdbDetail?.first_air_date || '').substring(0, 4)) || 0,
        type: tmdbType
      };

      const scoredMatches = searchResults.map((item: any) => ({
        item,
        score: computeMatchScore(item, tmdbInfo)
      })).sort((a: any, b: any) => b.score - a.score);

      const bestMatch = scoredMatches[0];

      if (bestMatch && bestMatch.score >= 80) {
        setResolvedSlug(id, bestMatch.item.slug);
        onSelect(bestMatch.item.slug, id);
      } else {
        // No high quality match in KKPhim/Ophim. Fallback to direct TMDB/CinemaOS player!
        setResolvedSlug(id, "resolved-" + id);
        onSelect("resolved-" + id, id);
      }
    } else if (searchResults && searchResults.length === 0) {
      // Not found in our KKPhim/Ophim API. Try opening directly to fallback to TMDB + CinemaOS.
      setResolvedSlug(id, "resolved-" + id);
      onSelect("resolved-" + id, id);
    }
  }, [searchResults, onSelect, id, tmdbDetail, titleOriginal, titleLocalized, isPresent]);

  const isLoading = isLoadingTmdb || (!!primarySearchTitle && isLoadingSearch);
  const notFound = !isLoading && searchResults && searchResults.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col justify-center items-center"
    >
      {isLoading && (
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
          <h2 className="text-white text-xl font-bold animate-pulse">Đang tìm dữ liệu phim...</h2>
        </div>
      )}

      {notFound && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 text-center relative shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
             <Search size={32} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Không có trong máy chủ!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Rất tiếc bộ phim "{displayTitle}" chưa có sẵn trên hệ thống của chúng tôi. Bạn có thể sử dụng thanh tìm kiếm để tìm bộ phim khác nhé.
          </p>
          <button 
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold w-full py-3 rounded-xl transition-colors"
          >
            Đóng Xong
          </button>
        </div>
      )}
    </motion.div>
  );
};
