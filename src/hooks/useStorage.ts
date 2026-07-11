import { useState, useEffect, useCallback } from 'react';

export type MyListItem = {
  slug: string;
  name: string;
  poster_url: string;
  thumb_url: string;
};

export const useMyList = () => {
  const [myList, setMyList] = useState<MyListItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_mylist');
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setMyList(parsed);
    } catch (e) {}
  }, []);

  const addToList = useCallback((item: MyListItem) => {
    setMyList(prev => {
      if (prev.find(i => i.slug === item.slug)) return prev;
      const next = [item, ...prev];
      localStorage.setItem('cinemax_mylist', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromList = useCallback((slug: string) => {
    setMyList(prev => {
      const next = prev.filter(s => s.slug !== slug);
      localStorage.setItem('cinemax_mylist', JSON.stringify(next));
      return next;
    });
  }, []);

  const isInList = useCallback((slug: string) => !!myList.find(i => i.slug === slug), [myList]);

  const toggleListItem = useCallback((item: any) => {
    setMyList(prev => {
      const exists = prev.find(i => i.slug === item.slug);
      let next;
      if (exists) {
        next = prev.filter(s => s.slug !== item.slug);
      } else {
        next = [{ 
          slug: item.slug, 
          name: item.name, 
          poster_url: item.poster_url || item.thumb_url || "", 
          thumb_url: item.thumb_url || item.poster_url || "" 
        }, ...prev];
      }
      localStorage.setItem('cinemax_mylist', JSON.stringify(next));
      return next;
    });
  }, []);

  return { myList, addToList, removeFromList, isInList, toggleListItem };
};

export type ProgressStore = {
  [slug: string]: {
    episodeName: string;
    currentTime: number;
    duration: number;
    savedAt: number;
    posterUrl: string;
    thumbUrl?: string;
    movieName: string;
    season?: number;
    tmdbId?: string | number;
    type?: string;
  }
};

export const useWatchProgress = () => {
  const [progressStore, setProgressStore] = useState<ProgressStore>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_progress');
      const parsed = stored ? JSON.parse(stored) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) setProgressStore(parsed);
    } catch (e) {}
  }, []);

  const saveProgress = useCallback((slug: string, data: ProgressStore[string]) => {
    setProgressStore(prev => {
      const next = { ...prev };
      if (data.currentTime / data.duration > 0.95) {
        delete next[slug];
      } else {
        next[slug] = data;
      }
      localStorage.setItem('cinemax_progress', JSON.stringify(next));
      return next;
    });
  }, []);

  return { progressStore, saveProgress };
};
