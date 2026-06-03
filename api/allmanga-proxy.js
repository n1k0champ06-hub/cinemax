import crypto from 'crypto';

export const config = {
  // We don't specify edge runtime so we can use standard Node.js crypto easily
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// AllAnime hex map from ani-cli
const ALLANIME_HEX_MAP = {
  79: "A",
  "7a": "B",
  "7b": "C",
  "7c": "D",
  "7d": "E",
  "7e": "F",
  "7f": "G",
  70: "H",
  71: "I",
  72: "J",
  73: "K",
  74: "L",
  75: "M",
  76: "N",
  77: "O",
  68: "P",
  69: "Q",
  "6a": "R",
  "6b": "S",
  "6c": "T",
  "6d": "U",
  "6e": "V",
  "6f": "W",
  60: "X",
  61: "Y",
  62: "Z",
  59: "a",
  "5a": "b",
  "5b": "c",
  "5c": "d",
  "5d": "e",
  "5e": "f",
  "5f": "g",
  50: "h",
  51: "i",
  52: "j",
  53: "k",
  54: "l",
  55: "m",
  56: "n",
  57: "o",
  48: "p",
  49: "q",
  "4a": "r",
  "4b": "s",
  "4c": "t",
  "4d": "u",
  "4e": "v",
  "4f": "w",
  40: "x",
  41: "y",
  42: "z",
  "08": "0",
  "09": "1",
  "0a": "2",
  "0b": "3",
  "0c": "4",
  "0d": "5",
  "0e": "6",
  "0f": "7",
  "00": "8",
  "01": "9",
  15: "-",
  16: ".",
  67: "_",
  46: "~",
  "02": ":",
  17: "/",
  "07": "?",
  "1b": "#",
  63: "[",
  65: "]",
  78: "@",
  19: "!",
  "1c": "$",
  "1e": "&",
  10: "(",
  11: ")",
  12: "*",
  13: "+",
  14: ",",
  "03": ";",
  "05": "=",
  "1d": "%",
};

function decodeAllanimeUrl(encoded) {
  if (encoded.startsWith("--")) encoded = encoded.slice(2);
  let result = "";
  for (let i = 0; i < encoded.length; i += 2) {
    const pair = encoded.slice(i, i + 2);
    result += ALLANIME_HEX_MAP[pair] !== undefined ? ALLANIME_HEX_MAP[pair] : pair;
  }
  return result.replace(/\\u002F/gi, "/").replace(/\\\|/g, "");
}

// AES-256-CTR key derived from SHA256("Xot36i3lK3:v1")
const ALLANIME_KEY = crypto
  .createHash("sha256")
  .update("Xot36i3lK3:v1")
  .digest();

function decodeTobeparsed(blob) {
  try {
    const buf = Buffer.from(blob, "base64");
    const iv12 = buf.slice(1, 13);
    const iv16 = Buffer.concat([iv12, Buffer.from([0, 0, 0, 2])]);
    const ct = buf.slice(13, buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-ctr", ALLANIME_KEY, iv16);
    decipher.setAutoPadding(false);
    const plain = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString("utf8");

    const sources = [];
    for (const chunk of plain.split(/[{}]/)) {
      const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/);
      const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
      const prioMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
      if (urlMatch) {
        sources.push({
          sourceUrl: urlMatch[1],
          sourceName: nameMatch ? nameMatch[1] : "",
          priority: prioMatch ? parseFloat(prioMatch[1]) : 0,
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

function parseEpisodeSourceUrls(body) {
  const tbMatch = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/);
  if (tbMatch) {
    const sources = decodeTobeparsed(tbMatch[1]);
    if (sources.length) return sources;
  }
  try {
    const sourceUrls = JSON.parse(body)?.data?.episode?.sourceUrls;
    return sourceUrls?.length ? sourceUrls : null;
  } catch {
    return null;
  }
}

function sanitizeTitle(t) {
  return t
    .replace(/[''`´]/g, "")
    .replace(/[:!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function anilistSeasonTitle(baseTitle, seasonNumber) {
  return new Promise((resolve) => {
    const resolveS1 = seasonNumber <= 1;
    const query = `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`;
    const body = JSON.stringify({ query, variables: { search: baseTitle } });

    const fallback = {
      title: baseTitle,
      romaji: null,
      episodes: null,
      nextTitle: null,
      nextRomaji: null,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    fetch("https://graphql.anilist.co/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        clearTimeout(timeoutId);
        const media = json?.data?.Media;
        if (!media) return resolve(fallback);

        const s1Romaji = media?.title?.romaji || null;
        const s1Episodes = media?.episodes || null;
        const sequels = (media.relations?.edges || [])
          .filter(
            (e) =>
              e.relationType === "SEQUEL" &&
              e.node.type === "ANIME" &&
              (e.node.format === "TV" || e.node.format === "TV_SHORT")
          )
          .sort((a, b) => {
            const ya = a.node.startDate?.year || a.node.seasonYear || 9999;
            const yb = b.node.startDate?.year || b.node.seasonYear || 9999;
            return ya - yb;
          });

        const getTitle = (node) => node.title?.english || node.title?.romaji || null;
        const getRomaji = (node) => node.title?.romaji || null;

        if (resolveS1) {
          const next = sequels[0]?.node ?? null;
          return resolve({
            title: media.title?.english || baseTitle,
            romaji: s1Romaji,
            episodes: s1Episodes,
            nextTitle: next ? getTitle(next) : null,
            nextRomaji: next ? getRomaji(next) : null,
          });
        }

        const target = sequels[seasonNumber - 2];
        if (!target) return resolve({ ...fallback, romaji: s1Romaji });

        const nextNode = sequels[seasonNumber - 1]?.node ?? null;
        resolve({
          title: getTitle(target.node) || baseTitle,
          romaji: getRomaji(target.node) || s1Romaji,
          episodes: target.node.episodes || null,
          nextTitle: nextNode ? getTitle(nextNode) : null,
          nextRomaji: nextNode ? getRomaji(nextNode) : null,
        });
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(fallback);
      });
  });
}

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
const EPISODE_GQL_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

async function allanimeGQL(variables, query) {
  const body = JSON.stringify({ variables, query });
  const res = await fetch("https://api.allanime.day/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      Referer: "https://allmanga.to",
      Origin: "https://allmanga.to",
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function allanimeGQLEpisode(variables) {
  try {
    const encodedVars = encodeURIComponent(JSON.stringify(variables));
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
    });
    const encodedExt = encodeURIComponent(extensions);
    const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodedExt}`;

    const res = await fetch(getUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        Referer: "https://allmanga.to",
        Origin: "https://youtu-chan.com",
        Accept: "*/*",
      },
    });
    const text = await res.text();
    if (text && text.includes("tobeparsed")) {
      return { status: res.status, body: text };
    }
  } catch (e) {
    // Ignore and fallback to POST
  }
  return allanimeGQL(variables, EPISODE_GQL);
}

async function followRedirects(urlStr, maxHops = 10) {
  let url = urlStr;
  let hops = 0;
  while (hops < maxHops) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*",
        }
      });
      
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc) {
          url = loc.startsWith('http') ? loc : new URL(loc, url).href;
          hops++;
          continue;
        }
      }
      return url;
    } catch {
      return url;
    }
  }
  return url;
}

const PROVIDER_PRIORITY = ["S-mp4", "Luf-Mp4", "Yt-mp4", "Default", "Sl-Hls"];

async function trySourceUrls(sourceUrls) {
  const decodedSources = sourceUrls
    .filter((s) => s.sourceUrl?.startsWith("--"))
    .map((s) => ({
      sourceName: s.sourceName || "",
      priority: s.priority || 0,
      path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json"),
    }))
    .sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const resolved = [];

  for (const src of decodedSources) {
    let fetchUrl = src.path;
    if (fetchUrl.startsWith("//")) fetchUrl = "https:" + fetchUrl;
    else if (fetchUrl.startsWith("/")) fetchUrl = "https://allanime.day" + fetchUrl;
    else if (!fetchUrl.startsWith("http")) fetchUrl = "https://allanime.day/" + fetchUrl;

    try {
      if (fetchUrl.includes("fast4speed.rsvp") || src.sourceName === "Yt-mp4") {
        const finalUrl = await followRedirects(fetchUrl).catch(() => null);
        if (!finalUrl) continue;

        if (finalUrl.includes("youtube.com/watch") || finalUrl.includes("youtu.be/")) {
          // Skip YouTube URLs since we don't have yt-dlp on Serverless/Edge
          continue;
        }

        resolved.push({
          url: finalUrl,
          quality: "auto",
          sourceName: src.sourceName,
          isHLS: finalUrl.includes(".m3u8"),
          headers: { Referer: "https://allmanga.to" },
        });
        continue;
      }

      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*",
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const links = data?.links;
      if (!links?.length) continue;

      for (const l of links) {
        if (!l.link) continue;
        resolved.push({
          url: l.link,
          quality: l.resolutionStr || "auto",
          sourceName: src.sourceName,
          isHLS: l.link.includes(".m3u8"),
          headers: { Referer: "https://allmanga.to" },
        });
      }
    } catch {
      // Continue trying other sources
    }
  }

  return resolved;
}

const HARDCODED_SHOW_IDS = {
  "jojo's bizarre adventure": [
    "MeX4czvkwKGo3zdDp",
    "zyqDjR8te4z6taKyk",
    "GTAQH8Z9K6WbAdXsS",
    "JS9PzKiPanesGRvs5",
    "b6xFsr7MDSMcJArB9",
    "pwduJkjBLytqiWCvM",
  ],
};

const SPLIT_SEASONS = {
  "spy x family": {
    1: [
      { from: 1, showId: null, offset: 0 },
      { from: 13, showId: "H8Aey6QXE7HSqwvW3", offset: 12 },
    ],
  },
};

async function resolveEpisodeFromId(showId, epStr, dubSub) {
  const candidates = [epStr];
  if (!epStr.includes(".")) candidates.push(epStr + ".0");

  let sourceUrls = null;
  for (const attempt of candidates) {
    const epRes = await allanimeGQLEpisode({
      showId,
      translationType: dubSub,
      episodeString: attempt,
    });
    if (!epRes.body) continue;
    const urls = parseEpisodeSourceUrls(epRes.body);
    if (urls?.length) {
      sourceUrls = urls;
      break;
    }
  }
  if (!sourceUrls) return null;
  return trySourceUrls(sourceUrls);
}

// Handler function
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const title = url.searchParams.get('title');
  const seasonNumber = parseInt(url.searchParams.get('season') || '1', 10);
  const episodeNumber = parseInt(url.searchParams.get('episode') || '1', 10);
  const isMovie = url.searchParams.get('isMovie') === 'true';
  const translationType = url.searchParams.get('translationType') === 'dub' ? 'dub' : 'sub';

  if (!title) {
    return json({ error: 'Missing title' }, 400);
  }

  try {
    const season = seasonNumber || 1;
    const dubSub = translationType;

    // 1. Check split season map
    if (!isMovie) {
      const splitParts = SPLIT_SEASONS[title.toLowerCase()]?.[season];
      if (splitParts) {
        let activePart = splitParts[0];
        for (const part of splitParts) {
          if (episodeNumber >= part.from) activePart = part;
        }
        const partEp = episodeNumber - activePart.offset;
        if (activePart.showId) {
          const result = await resolveEpisodeFromId(
            activePart.showId,
            String(partEp),
            dubSub
          );
          if (result && result.length > 0) return json({ ok: true, streams: result });
        }
      }
    }

    // 2. Check hardcoded show IDs
    if (!isMovie) {
      const hardcodedIds = HARDCODED_SHOW_IDS[title.toLowerCase()];
      if (hardcodedIds) {
        const showId = hardcodedIds[season - 1] ?? hardcodedIds[hardcodedIds.length - 1];
        const result = await resolveEpisodeFromId(
          showId,
          String(episodeNumber),
          dubSub
        );
        if (result && result.length > 0) return json({ ok: true, streams: result });
      }
    }

    // 3. AniList season title lookup
    const anilistResult = isMovie
      ? { title, romaji: null, episodes: null, nextTitle: null, nextRomaji: null }
      : await anilistSeasonTitle(title, season);

    let searchTitle = anilistResult.title;
    let adjustedEpisodeNumber = episodeNumber;

    if (
      !isMovie &&
      anilistResult.episodes &&
      episodeNumber > anilistResult.episodes &&
      anilistResult.nextTitle
    ) {
      adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
      searchTitle = anilistResult.nextTitle;
    }

    const epStr = isMovie ? "1" : String(adjustedEpisodeNumber);

    // 4. Build search candidate list
    const candidateSet = new Set([
      searchTitle,
      sanitizeTitle(searchTitle),
      ...(anilistResult.romaji && searchTitle === anilistResult.title ? [anilistResult.romaji] : []),
      ...(anilistResult.nextRomaji && searchTitle === anilistResult.nextTitle ? [anilistResult.nextRomaji] : []),
      title,
      sanitizeTitle(title),
    ]);
    const candidates = [...candidateSet].filter(Boolean);

    // 5. Search AllManga
    async function searchAllmanga(query) {
      const vars = {
        search: {
          allowAdult: true,
          allowUnknown: false,
          query: query.toLowerCase(),
        },
        limit: 40,
        page: 1,
        translationType: dubSub,
        countryOrigin: "ALL",
      };
      const res = await allanimeGQL(vars, SEARCH_GQL);
      if (!res.body) return null;
      try {
        const edges = JSON.parse(res.body)?.data?.shows?.edges;
        return edges?.length ? edges : null;
      } catch {
        return null;
      }
    }

    let edges = null, matchedTitle = searchTitle;
    for (const candidate of candidates) {
      edges = await searchAllmanga(candidate);
      if (edges) {
        matchedTitle = candidate;
        break;
      }
    }
    if (!edges) {
      return json({ error: "No results for: " + searchTitle, streams: [] }, 404);
    }

    const titleLower = matchedTitle.toLowerCase();
    const anime = edges.find((e) => (e.name || "").toLowerCase() === titleLower) || edges[0];

    // 6. Get episode sourceUrls
    const epCandidates = [epStr];
    if (!epStr.includes(".")) epCandidates.push(epStr + ".0");

    let sourceUrls = null;
    for (const attempt of epCandidates) {
      const epRes = await allanimeGQLEpisode({
        showId: anime._id,
        translationType: dubSub,
        episodeString: attempt,
      });
      if (!epRes.body) continue;
      const urls = parseEpisodeSourceUrls(epRes.body);
      if (urls?.length) {
        sourceUrls = urls;
        break;
      }
    }

    if (!sourceUrls?.length) {
      return json({ error: "No sourceUrls for ep " + epStr, streams: [] }, 404);
    }

    // 7. Decode and try each source
    const streams = await trySourceUrls(sourceUrls);
    return json({ ok: true, streams });

  } catch (e) {
    return json({ error: e.message, streams: [] }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 's-maxage=600, stale-while-revalidate=1200' : 'no-store',
    },
  });
}
