import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useImdbTitleDetails, useImdbSimilar } from '../useImdb236New';
import { fetchOmdb } from '../useOmdb';
import { getRottenTomatoRating } from '../useRottenTomato';
import { useKinoCheckTrailer } from './useKinoCheckTrailer';
import { fetchSearch } from '../../api/phimApi';

export const useImdbDetail = (id: string) => {
  const { data: detail, isLoading } = useImdbTitleDetails(id);
  const { data: similar } = useImdbSimilar(id);
  
  const { data: omdbData } = useQuery({
    queryKey: ["omdb", id],
    queryFn: () => fetchOmdb(id),
    enabled: !!id,
  });

  const { data: rtData } = useQuery({
    queryKey: ["rt", detail?.primaryTitle],
    queryFn: () => getRottenTomatoRating(detail?.primaryTitle || ""),
    enabled: !!detail?.primaryTitle
  });

  const { data: trailerYoutubeId } = useKinoCheckTrailer(id);

  const { data: phimApiSearchData, isLoading: isPhimApiSearching } = useQuery({
    queryKey: ["phimapi_search", detail?.primaryTitle],
    queryFn: () => fetchSearch(detail?.primaryTitle || ""),
    enabled: !!detail?.primaryTitle
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [activeEp, setActiveEp] = useState<any>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  const { data: omdbSeasonData } = useQuery({
    queryKey: ["omdb_season", id, selectedSeason],
    queryFn: async () => {
       const res = await fetch(`https://www.omdbapi.com/?apikey=a74b078b&i=${id}&Season=${selectedSeason}`);
       return res.json();
    },
    enabled: !!id && (detail?.type === "tvSeries" || detail?.type === "tvMiniSeries"),
  });

  const totalSeasons = omdbData?.totalSeasons ? parseInt(omdbData.totalSeasons) : 0;
  const isSeries = detail?.type === "tvSeries" || detail?.type === "tvMiniSeries";

  return {
    detail, isLoading, similar, omdbData, rtData, trailerYoutubeId,
    phimApiSearchData, isPhimApiSearching,
    isPlaying, setIsPlaying,
    selectedSeason, setSelectedSeason,
    activeEp, setActiveEp,
    selectedActorId, setSelectedActorId,
    omdbSeasonData, totalSeasons, isSeries
  };
};
