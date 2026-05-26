import { useQuery } from "@tanstack/react-query";

export const fetchOmdb = async (titleOrId: string, year?: string) => {
  if (!titleOrId) return null;
  const isId = titleOrId.startsWith('tt');
  const param = isId ? `i=${titleOrId}` : `t=${encodeURIComponent(titleOrId)}`;
  let url = `https://www.omdbapi.com/?apikey=a74b078b&${param}`;
  if (year && !isId) {
     url += `&y=${year}`;
  }
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.Response === "True") {
      return data;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const useOmdbMeta = (title: string | undefined, year?: string | number) => {
  return useQuery({
    queryKey: ["omdbMeta", title, year],
    queryFn: () => fetchOmdb(title || "", year?.toString()),
    enabled: !!title,
    staleTime: 24 * 60 * 60 * 1000,
  });
};

