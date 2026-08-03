var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cloudflare-worker.js
import crypto from "node:crypto";

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = /* @__PURE__ */ __name(function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
}, "freb");
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = /* @__PURE__ */ __name((function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
}), "hMap");
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = /* @__PURE__ */ __name(function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
}, "max");
var bits = /* @__PURE__ */ __name(function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
}, "bits");
var bits16 = /* @__PURE__ */ __name(function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
}, "bits16");
var shft = /* @__PURE__ */ __name(function(p) {
  return (p + 7) / 8 | 0;
}, "shft");
var slc = /* @__PURE__ */ __name(function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
}, "slc");
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = /* @__PURE__ */ __name(function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
}, "err");
var inflt = /* @__PURE__ */ __name(function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = /* @__PURE__ */ __name(function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  }, "cbuf");
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
}, "inflt");
var et = /* @__PURE__ */ new u8(0);
var b2 = /* @__PURE__ */ __name(function(d, b) {
  return d[b] | d[b + 1] << 8;
}, "b2");
var b4 = /* @__PURE__ */ __name(function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
}, "b4");
var b8 = /* @__PURE__ */ __name(function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
}, "b8");
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
__name(inflateSync, "inflateSync");
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = /* @__PURE__ */ __name(function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
}, "dutf8");
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
__name(strFromU8, "strFromU8");
var slzh = /* @__PURE__ */ __name(function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
}, "slzh");
var zh = /* @__PURE__ */ __name(function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
}, "zh");
var z64hs = /* @__PURE__ */ __name(function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
}, "z64hs");
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0; i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}
__name(unzipSync, "unzipSync");

// cloudflare-worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Api-Key"
};
var cloudflare_worker_default = {
  // Cron trigger: ping Render bridge + sync AI Movie Mappings
  async scheduled(event, env, ctx) {
    const bridgeUrl = (env.HOLLYSHEESH_API_URL || "").trim();
    if (bridgeUrl) {
      try {
        const res = await fetch(`${bridgeUrl}/health`, { signal: AbortSignal.timeout(1e4) });
        console.log(`[cron-ping] Bridge health: ${res.status}`);
      } catch (err2) {
        console.error(`[cron-ping] Bridge ping failed: ${err2.message}`);
      }
    }
    try {
      ctx.waitUntil(syncAiMovieMappings(env));
    } catch (err2) {
      console.error(`[cron-sync] AI mapping sync failed: ${err2.message}`);
    }
  },
  async fetch(request, env, ctx) {
    const edgeLogs = [];
    const addEdgeLog = /* @__PURE__ */ __name((category, level, message, metric) => {
      edgeLogs.push({ category, level, message, metric });
    }, "addEdgeLog");
    request.addEdgeLog = addEdgeLog;
    const requestUrl = new URL(request.url);
    const shouldLog = request.method !== "OPTIONS" && !requestUrl.pathname.includes("/img/");
    if (shouldLog) {
      addEdgeLog("SYSTEM", "INFO", `Request received: ${request.method} ${requestUrl.pathname}`);
    }
    let response;
    try {
      response = await handleRequest(request, env, ctx);
    } catch (err2) {
      if (shouldLog) {
        addEdgeLog("SYSTEM", "ERROR", `Worker unhandled exception: ${err2.message || err2}`);
      }
      response = new Response(JSON.stringify({ error: err2.message || err2 }), {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    }
    if (edgeLogs.length > 0) {
      try {
        const jsonStr = JSON.stringify(edgeLogs);
        let base64Logs;
        if (typeof Buffer !== "undefined") {
          base64Logs = Buffer.from(jsonStr).toString("base64");
        } else {
          base64Logs = btoa(unescape(encodeURIComponent(jsonStr)));
        }
        const hasBody = response.status !== 204 && response.status !== 205 && response.status !== 304;
        const newResponse = new Response(hasBody ? response.body : null, response);
        newResponse.headers.set("X-GodMode-Logs", base64Logs);
        const exposeHeaders = response.headers.get("Access-Control-Expose-Headers");
        if (exposeHeaders) {
          if (!exposeHeaders.includes("X-GodMode-Logs")) {
            newResponse.headers.set("Access-Control-Expose-Headers", `${exposeHeaders}, X-GodMode-Logs`);
          }
        } else {
          newResponse.headers.set("Access-Control-Expose-Headers", "X-GodMode-Logs");
        }
        newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Api-Key, X-GodMode-Logs, X-Gemini-Key");
        return newResponse;
      } catch (e) {
        console.error("Failed to inject X-GodMode-Logs header:", e);
        return response;
      }
    }
    return response;
  }
};
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }
  if (url.pathname === "/api/ai-mapping") {
    if (request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key parameter" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
      if (typeof env.MOVIE_CACHE !== "undefined") {
        try {
          const cached = await env.MOVIE_CACHE.get(key);
          if (cached) {
            return new Response(cached, {
              status: 200,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            });
          }
        } catch (e) {
          console.warn("[ai-mapping] KV read error:", e.message);
        }
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    } else if (request.method === "POST" && url.pathname.endsWith("/sync")) {
      try {
        const syncResult = await syncAiMovieMappings(env);
        return new Response(JSON.stringify(syncResult), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
    }
  }
  if (url.pathname === "/tmdb/bulk") {
    const requestsParam = url.searchParams.get("requests") || "";
    if (!requestsParam) {
      return json({ error: "Missing requests param" }, 400);
    }
    const requests = requestsParam.split(",").map((r) => {
      const [type, id] = r.split(":");
      return { type, id };
    });
    const token = env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || "";
    const results = {};
    const uncachedRequests = [];
    const cachedDataArray = typeof env.MOVIE_CACHE !== "undefined" ? await Promise.all(requests.map(async ({ type, id }) => {
      if (!type || !id) return null;
      const cacheKey = `tmdb_bulk_v3:${type}:${id}`;
      try {
        const cached = await env.MOVIE_CACHE.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } catch (e) {
        console.warn("[tmdb-bulk] KV cache read error:", e.message);
        return null;
      }
    })) : requests.map(() => null);
    for (let i2 = 0; i2 < requests.length; i2++) {
      const { type, id } = requests[i2];
      if (!type || !id) continue;
      const key = `${type}:${id}`;
      const cached = cachedDataArray[i2];
      if (cached) {
        results[key] = cached;
      } else {
        uncachedRequests.push({ type, id });
      }
    }
    if (uncachedRequests.length > 0) {
      const promises = uncachedRequests.map(async ({ type, id }) => {
        const key = `${type}:${id}`;
        try {
          const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?language=vi&append_to_response=images,external_ids&include_image_language=en,null,vi,ja,ko,zh`;
          const response = await fetch(tmdbUrl, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json"
            },
            cf: {
              cacheEverything: true,
              cacheTtl: 604800
              // Cache TMDB details for 7 days
            }
          });
          if (response.ok) {
            const data = await response.json();
            let logo_path = null;
            if (data.images && Array.isArray(data.images.logos) && data.images.logos.length > 0) {
              const viLogo = data.images.logos.find((l) => l.iso_639_1 === "vi");
              const enLogo = data.images.logos.find((l) => l.iso_639_1 === "en");
              const nullLogo = data.images.logos.find((l) => !l.iso_639_1);
              const logo = viLogo || enLogo || nullLogo || data.images.logos[0];
              if (logo) {
                logo_path = logo.file_path;
              }
            }
            const imdb_id = data.imdb_id || data.external_ids?.imdb_id || null;
            let imdb_rating = null;
            let metacritic_score = null;
            if (imdb_id) {
              try {
                const imdbUrl = `https://api.imdbapi.dev/titles/${imdb_id}`;
                const imdbRes = await fetch(imdbUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json"
                  },
                  cf: {
                    cacheEverything: true,
                    cacheTtl: 604800
                    // Cache IMDb details for 7 days
                  }
                });
                if (imdbRes.ok) {
                  const imdbData = await imdbRes.json();
                  imdb_rating = imdbData?.rating?.aggregateRating || null;
                  metacritic_score = imdbData?.metacritic?.score ?? null;
                }
              } catch (e) {
                console.warn("[tmdb-bulk] Server-side IMDb fetch error:", e.message);
              }
            }
            const payload = {
              title: data.title || null,
              name: data.name || null,
              backdrop_path: data.backdrop_path || null,
              poster_path: data.poster_path || null,
              logo_path,
              imdb_id,
              imdb_rating,
              metacritic_score
            };
            results[key] = payload;
            if (typeof env.MOVIE_CACHE !== "undefined") {
              const writePromise = (async () => {
                try {
                  const cacheKey = `tmdb_bulk_v3:${key}`;
                  await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(payload), {
                    expirationTtl: 86400
                  });
                } catch (e) {
                  console.warn("[tmdb-bulk] KV cache write error:", e.message);
                }
              })();
              if (ctx && typeof ctx.waitUntil === "function") {
                ctx.waitUntil(writePromise);
              }
            }
          } else {
            results[key] = null;
          }
        } catch (err2) {
          results[key] = null;
        }
      });
      await Promise.all(promises);
    }
    return json(results, 200, {
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800"
    });
  }
  if (url.pathname.startsWith("/tmdb/")) {
    const tmdbPath = url.pathname.replace("/tmdb", "");
    const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}${url.search}`);
    const token = env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || "";
    let cacheTtl = 86400;
    if (tmdbPath.includes("/movie/") || tmdbPath.includes("/tv/") || tmdbPath.includes("/person/")) {
      const isListing = tmdbPath.endsWith("/popular") || tmdbPath.endsWith("/top_rated") || tmdbPath.endsWith("/trending") || tmdbPath.includes("/recommendations") || tmdbPath.includes("/similar");
      if (!isListing) {
        cacheTtl = 86400 * 7;
      }
    }
    const response = await fetch(tmdbUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      },
      cf: {
        cacheEverything: true,
        cacheTtl
      }
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheTtl}`
      }
    });
  }
  if (url.pathname.startsWith("/img/")) {
    const imageUrl = url.pathname.replace("/img/", "") + url.search;
    if (!imageUrl || !imageUrl.startsWith("http")) {
      return new Response("Invalid URL", { status: 400, headers: CORS_HEADERS });
    }
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }
  if (url.pathname.startsWith("/api/sub-proxy")) {
    const provider = url.searchParams.get("provider") || "subdl";
    const lang = url.searchParams.get("lang") || "vi";
    if (provider === "download") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return json({ error: "Missing url" }, 400);
      }
      const allowed = [
        "dl.subdl.com",
        "sub.subdl.com",
        "api.subdl.com",
        "dl.opensubtitles.com",
        "opensubtitles.com",
        "api.opensubtitles.com",
        "opensubtitles.org",
        "strem.io",
        "subs5.strem.io",
        "elfhosted.com",
        url.hostname
      ];
      const target = new URL(targetUrl);
      const isAllowed = allowed.some((d) => target.hostname === d || target.hostname.endsWith("." + d));
      if (!isAllowed) {
        return json({ error: "Domain not allowed", hostname: target.hostname }, 403);
      }
      try {
        const resp = await fetch(targetUrl, {
          headers: { "User-Agent": "CinemaxApp/1.0" }
        });
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400"
          }
        });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    if (provider === "opensubtitles-download") {
      const fileId = url.searchParams.get("file_id");
      if (!fileId) {
        return json({ error: "Missing file_id" }, 400);
      }
      try {
        const dlUrl = `https://dl.opensubtitles.org/en/download/sub/${fileId}`;
        const dlResp = await fetch(dlUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.opensubtitles.org/"
          }
        });
        if (!dlResp.ok) {
          return json({ error: `OpenSubtitles legacy download returned ${dlResp.status}` }, dlResp.status);
        }
        const buffer = await dlResp.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const unzipped = unzipSync(uint8);
        const filenames = Object.keys(unzipped);
        if (filenames.length === 0) {
          return json({ error: "Empty zip file returned from OpenSubtitles" }, 404);
        }
        const srtFilename = filenames.find((name) => name.endsWith(".srt") || name.endsWith(".vtt")) || filenames[0];
        const fileData = unzipped[srtFilename];
        const srtText = new TextDecoder("utf-8").decode(fileData);
        return new Response(srtText, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400"
          }
        });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    if (provider === "subsource-download") {
      const subtitleId = url.searchParams.get("subtitle_id");
      if (!subtitleId) {
        return json({ error: "Missing subtitle_id" }, 400);
      }
      const subdlApiKey = env.SUBDL_API_KEY || env.VITE_SUBDL_API_KEY || "";
      try {
        const dlUrl = `https://api.subsource.net/api/v1/subtitles/${subtitleId}/download`;
        const dlResp = await fetch(dlUrl, {
          headers: {
            "X-API-Key": subdlApiKey,
            "Accept": "application/json",
            "User-Agent": "CinemaxApp/1.0"
          }
        });
        if (!dlResp.ok) {
          return json({ error: `Subsource download API returned ${dlResp.status}` }, dlResp.status);
        }
        const buffer = await dlResp.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const unzipped = unzipSync(uint8);
        const filenames = Object.keys(unzipped);
        if (filenames.length === 0) {
          return json({ error: "Empty zip file returned from Subsource" }, 404);
        }
        const firstFile = unzipped[filenames[0]];
        const srtText = new TextDecoder("utf-8").decode(firstFile);
        return new Response(srtText, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400"
          }
        });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    if (provider === "subdl") {
      const tmdbId = url.searchParams.get("tmdb_id");
      const imdbId = url.searchParams.get("imdb_id");
      const type = url.searchParams.get("type") || "movie";
      const season = url.searchParams.get("season");
      const episode = url.searchParams.get("episode");
      const subdlApiKey = env.SUBDL_API_KEY || env.VITE_SUBDL_API_KEY || "";
      const subdlPromise = (async () => {
        if (subdlApiKey.startsWith("sk_")) return [];
        const params = new URLSearchParams();
        if (tmdbId) params.set("tmdb_id", tmdbId);
        else if (imdbId) params.set("imdb_id", imdbId);
        else return [];
        params.set("languages", mapLangToSubdl(lang));
        params.set("type", type === "movie" ? "movie" : "tv");
        if (type !== "movie" && season) params.set("season_number", season);
        if (type !== "movie" && episode) params.set("episode_number", episode);
        if (subdlApiKey) params.set("api_key", subdlApiKey);
        const subdlUrl = `https://api.subdl.com/api/v1/subtitles?${params.toString()}`;
        try {
          const resp = await fetch(subdlUrl, {
            headers: {
              "User-Agent": "CinemaxApp/1.0",
              "Accept": "application/json"
            }
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return (data.subtitles || []).filter((s) => {
            const sLang = (s.lang || "").toLowerCase();
            const target = lang.toLowerCase();
            if (target === "vi") return sLang === "vietnamese" || sLang === "vi";
            if (target === "en") return sLang === "english" || sLang === "en";
            return sLang.startsWith(target) || sLang === target;
          }).map((s) => ({
            id: s.sd_id || String(Math.random()),
            language: lang,
            name: s.release_name || s.full_name || "Subdl Subtitle",
            downloadUrl: s.url ? `https://dl.subdl.com${s.url}` : s.download_link || "",
            format: "srt",
            hi: s.hi || false,
            rating: s.ratings || 0
          }));
        } catch (err2) {
          console.warn("[sub-proxy] subdl fetch failed:", err2.message);
          return [];
        }
      })();
      const stremioPromise = (async () => {
        if (!imdbId) return [];
        const DEFAULT_ADDONS = [
          "https://opensubtitles-v3.strem.io",
          "https://subhero.chromeknight.dev"
        ];
        const userAddons = (env.SUBTITLE_ADDONS || env.VITE_SUBTITLE_ADDONS || "").split(",").map((u) => u.trim()).filter(Boolean);
        const addons = [...DEFAULT_ADDONS, ...userAddons];
        const results = await Promise.all(
          addons.map((addon) => fetchStremioSubtitles(addon, type, imdbId, season, episode, lang))
        );
        return results.flat();
      })();
      const opensubtitlesPromise = (async () => {
        const apiKey = env.OPENSUBTITLES_API_KEY || env.VITE_OPENSUBTITLES_API_KEY || "wp8vrDdcuRwJUvFOkvNBDJ7FA5D989dp";
        const params = new URLSearchParams();
        params.set("languages", lang);
        if (imdbId) params.set("imdb_id", imdbId.replace("tt", ""));
        else if (tmdbId) params.set("tmdb_id", tmdbId);
        else return [];
        params.set("type", type === "movie" ? "movie" : "episode");
        if (type !== "movie") {
          if (season) params.set("season_number", season);
          if (episode) params.set("episode_number", episode);
        }
        params.set("per_page", "5");
        const osUrl = `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`;
        try {
          const resp = await fetch(osUrl, {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
              "User-Agent": "CinemaxApp v1.0"
            }
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          return (data.data || []).map((item) => {
            const fileId = item.attributes?.files?.[0]?.file_id;
            return {
              id: `os-${item.id || Math.random()}`,
              language: lang,
              name: item.attributes?.release || item.attributes?.feature_details?.title || "OpenSubtitles REST",
              downloadUrl: `${url.origin}/api/sub-proxy?provider=opensubtitles-download&file_id=${fileId}`,
              format: "srt",
              hi: item.attributes?.hearing_impaired || false,
              rating: item.attributes?.ratings || 0
            };
          }).filter((s) => s.downloadUrl && s.downloadUrl.includes("file_id="));
        } catch (err2) {
          console.warn("[sub-proxy] opensubtitles fetch failed:", err2.message);
          return [];
        }
      })();
      const subsourcePromise = (async () => {
        if (!subdlApiKey.startsWith("sk_")) return [];
        let movieId = null;
        try {
          if (imdbId) {
            const searchUrl = `https://api.subsource.net/api/v1/movies/search?searchType=imdb&imdb=${imdbId}`;
            const sResp = await fetch(searchUrl, {
              headers: {
                "X-API-Key": subdlApiKey,
                "Accept": "application/json",
                "User-Agent": "CinemaxApp/1.0"
              }
            });
            if (sResp.ok) {
              const sData = await sResp.json();
              if (sData.success && sData.data && sData.data.length > 0) {
                movieId = sData.data[0].movieId;
              }
            }
          }
          if (!movieId) return [];
          const subUrl = `https://api.subsource.net/api/v1/subtitles?movieId=${movieId}&languages=${lang === "vi" ? "vietnamese" : "english"}`;
          const rResp = await fetch(subUrl, {
            headers: {
              "X-API-Key": subdlApiKey,
              "Accept": "application/json",
              "User-Agent": "CinemaxApp/1.0"
            }
          });
          if (!rResp.ok) return [];
          const rData = await rResp.json();
          if (!rData.success || !rData.data) return [];
          return rData.data.filter((item) => {
            const itemLang = (item.language || "").toLowerCase();
            if (lang === "vi") return itemLang === "vietnamese" || itemLang === "vi";
            if (lang === "en") return itemLang === "english" || itemLang === "en";
            return itemLang.startsWith(lang.toLowerCase()) || itemLang === lang.toLowerCase();
          }).map((item) => ({
            id: `subsource-${item.subtitleId}`,
            language: lang,
            name: item.releaseInfo && item.releaseInfo[0] || item.commentary || "SubSource Subtitle",
            downloadUrl: `${url.origin}/api/sub-proxy?provider=subsource-download&subtitle_id=${item.subtitleId}`,
            format: "srt",
            hi: item.hearingImpaired || false,
            rating: (item.rating?.good || 0) - (item.rating?.bad || 0)
          }));
        } catch (err2) {
          console.warn("[sub-proxy] subsource fetch failed:", err2.message);
          return [];
        }
      })();
      try {
        const [subdlSubs, stremioSubs, osSubs, subsourceSubs] = await Promise.all([
          subdlPromise,
          stremioPromise,
          opensubtitlesPromise,
          subsourcePromise
        ]);
        const subtitles = [...subdlSubs, ...stremioSubs, ...osSubs, ...subsourceSubs];
        return json({ subtitles, source: "merged" }, 200, {
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
        });
      } catch (err2) {
        return json({ error: err2.message, subtitles: [], source: "merged" }, 500);
      }
    }
    if (provider === "opensubtitles") {
      const imdbId = url.searchParams.get("imdb_id");
      const tmdbId = url.searchParams.get("tmdb_id");
      const type = url.searchParams.get("type") || "movie";
      const season = url.searchParams.get("season");
      const episode = url.searchParams.get("episode");
      const apiKey = env.OPENSUBTITLES_API_KEY || env.VITE_OPENSUBTITLES_API_KEY || "";
      if (!apiKey) {
        return json({ error: "OpenSubtitles API key not configured", subtitles: [] });
      }
      const params = new URLSearchParams();
      params.set("languages", lang);
      if (imdbId) params.set("imdb_id", imdbId.replace("tt", ""));
      if (tmdbId) params.set("tmdb_id", tmdbId);
      if (type === "episode" || type === "tv") {
        if (season) params.set("season_number", season);
        if (episode) params.set("episode_number", episode);
      }
      params.set("type", type === "movie" ? "movie" : "episode");
      params.set("per_page", "5");
      const osUrl = `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`;
      try {
        const resp = await fetch(osUrl, {
          headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
            "User-Agent": "CinemaxApp v1.0"
          }
        });
        const data = await resp.json();
        const subtitles = (data.data || []).map((item) => ({
          id: item.id,
          language: lang,
          name: item.attributes?.release || item.attributes?.feature_details?.title || "Ti\u1EBFng Vi\u1EC7t",
          downloadUrl: item.attributes?.files?.[0] ? `https://api.opensubtitles.com/api/v1/download` : "",
          format: "srt",
          fileId: item.attributes?.files?.[0]?.file_id,
          hi: item.attributes?.hearing_impaired || false,
          rating: item.attributes?.ratings || 0
        })).filter((s) => s.fileId);
        return json({ subtitles, source: "opensubtitles" }, 200, {
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
        });
      } catch (err2) {
        return json({ error: err2.message, subtitles: [], source: "opensubtitles" }, 500);
      }
    }
    return json({ error: "Unknown provider" }, 400);
  }
  if (url.pathname === "/api/recommendations" && request.method === "POST") {
    try {
      const body = await request.json();
      const liked = body.liked || [];
      const passed = body.passed || [];
      const geminiKey = env.GEMINI_API_KEY || "AIzaSyAsA3AQZMb9qywj3uW-WwfBwhh9CEw9I6Y";
      const geminiBackupKey = "AIzaSyApNnjlqisTsgGtES506yoTV6DR9lQ2KE0";
      const systemPrompt = `You are a movie recommendation engine. Based on the user's liked movies and passed movies, analyze their taste and recommend 10 movie or TV show titles that they would love to watch. Do not recommend any movies from the liked or passed list. Output MUST be a valid JSON array of strings, containing only the titles of recommended movies or TV shows, e.g. ["Inception", "Interstellar"]. Do not output markdown code blocks or any extra text.`;
      const prompt = `Liked movies: ${JSON.stringify(liked)}
Passed movies: ${JSON.stringify(passed)}`;
      let geminiResponse;
      try {
        geminiResponse = await callGemini(geminiKey, systemPrompt, prompt);
      } catch (e) {
        console.warn("Primary Gemini key failed, trying backup...", e.message);
        geminiResponse = await callGemini(geminiBackupKey, systemPrompt, prompt);
      }
      let titles = [];
      try {
        const text = geminiResponse.candidates[0].content.parts[0].text;
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        titles = JSON.parse(cleanText);
      } catch (e) {
        console.error("Failed to parse Gemini response:", e.message, geminiResponse);
        return json({ error: "Failed to parse recommendations from AI" }, 500);
      }
      if (!Array.isArray(titles) || titles.length === 0) {
        return json({ results: [] }, 200);
      }
      const tmdbToken = env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || "";
      const searchPromises = titles.slice(0, 8).map(async (title) => {
        try {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&language=vi`;
          const resp = await fetch(searchUrl, {
            headers: { "Authorization": `Bearer ${tmdbToken}`, "Accept": "application/json" }
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
              const match = data.results.find((item) => item.poster_path && (item.media_type === "movie" || item.media_type === "tv"));
              return match ? { ...match, media_type: match.media_type || "movie" } : null;
            }
          }
        } catch (e) {
          console.error(`TMDB search failed for title ${title}:`, e.message);
        }
        return null;
      });
      const searchResults = (await Promise.all(searchPromises)).filter(Boolean);
      return json({ results: searchResults }, 200);
    } catch (err2) {
      return json({ error: err2.message }, 500);
    }
  }
  if (url.pathname.startsWith("/api/xem20-proxy")) {
    return await handleXem20Proxy(request, url);
  }
  if (url.pathname.startsWith("/api/allmanga-proxy")) {
    const title = url.searchParams.get("title");
    const seasonNumber = parseInt(url.searchParams.get("season") || "1", 10);
    const episodeNumber = parseInt(url.searchParams.get("episode") || "1", 10);
    const isMovie = url.searchParams.get("isMovie") === "true";
    const translationType = url.searchParams.get("translationType") === "dub" ? "dub" : "sub";
    if (!title) {
      return json({ error: "Missing title" }, 400);
    }
    try {
      const season = seasonNumber || 1;
      const dubSub = translationType;
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
      const anilistResult = isMovie ? { title, romaji: null, episodes: null, nextTitle: null, nextRomaji: null } : await anilistSeasonTitle(title, season);
      let searchTitle = anilistResult.title;
      let adjustedEpisodeNumber = episodeNumber;
      if (!isMovie && anilistResult.episodes && episodeNumber > anilistResult.episodes && anilistResult.nextTitle) {
        adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
        searchTitle = anilistResult.nextTitle;
      }
      const epStr = isMovie ? "1" : String(adjustedEpisodeNumber);
      const candidateSet = /* @__PURE__ */ new Set([
        searchTitle,
        sanitizeTitle(searchTitle),
        ...anilistResult.romaji && searchTitle === anilistResult.title ? [anilistResult.romaji] : [],
        ...anilistResult.nextRomaji && searchTitle === anilistResult.nextTitle ? [anilistResult.nextRomaji] : [],
        title,
        sanitizeTitle(title)
      ]);
      const candidates = [...candidateSet].filter(Boolean);
      async function searchAllmanga(query) {
        const vars = {
          search: {
            allowAdult: true,
            allowUnknown: false,
            query: query.toLowerCase()
          },
          limit: 40,
          page: 1,
          translationType: dubSub,
          countryOrigin: "ALL"
        };
        const res = await allanimeGQL(vars, SEARCH_GQL);
        if (!res.body) return null;
        try {
          const edges2 = JSON.parse(res.body)?.data?.shows?.edges;
          return edges2?.length ? edges2 : null;
        } catch {
          return null;
        }
      }
      __name(searchAllmanga, "searchAllmanga");
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
      const epCandidates = [epStr];
      if (!epStr.includes(".")) epCandidates.push(epStr + ".0");
      let sourceUrls = null;
      for (const attempt of epCandidates) {
        const epRes = await allanimeGQLEpisode({
          showId: anime._id,
          translationType: dubSub,
          episodeString: attempt
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
      const streams = await trySourceUrls(sourceUrls);
      return json({ ok: true, streams });
    } catch (e) {
      return json({ error: e.message, streams: [] }, 500);
    }
  }
  if (url.pathname.startsWith("/api/imdb-proxy")) {
    const imdbId = url.searchParams.get("imdbId");
    if (!imdbId) {
      return json({ error: "Missing imdbId" }, 400);
    }
    if (!/^tt\d+$/.test(imdbId)) {
      return json({ error: "Invalid imdbId format" }, 400);
    }
    try {
      const targetUrl = `https://api.imdbapi.dev/titles/${imdbId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12e3);
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        },
        signal: controller.signal,
        cf: {
          cacheEverything: true,
          cacheTtl: 604800
          // Cache IMDb rating details for 7 days
        }
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        console.error(`[imdb-proxy CF] IMDb API returned ${res.status}: ${errorText.slice(0, 200)}`);
        return json({ error: `IMDb API returned ${res.status}` }, res.status);
      }
      const data = await res.json();
      return json(data, 200, {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800"
      });
    } catch (err2) {
      if (err2.name === "AbortError") {
        return json({ error: "IMDb API request timed out (12s)" }, 504);
      }
      return json({ error: err2.message }, 500);
    }
  }
  if (url.pathname.startsWith("/api/kaa")) {
    const UA_KAA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const KAA_BASE = "https://kaa.lt";
    const KAA_HLS = "https://hls.krussdomi.com/manifest";
    const watchMatch = url.pathname.match(/^\/api\/kaa\/watch\/(\d+)\/(sub|dub)\/(\d+)$/);
    if (!watchMatch) return json({ error: "Not found" }, 404);
    const [, anilistId, audio, epNum] = watchMatch;
    const titles = (url.searchParams.get("titles") || "").split("|").filter(Boolean);
    if (!titles.length) return json({ error: "Missing titles param" }, 400);
    const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : null;
    try {
      let showSlug = null;
      for (const title of titles.slice(0, 4)) {
        if (/[\u3000-\u9fff\u4e00-\u9faf]/.test(title)) continue;
        const clean = title.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
        if (clean.length < 2) continue;
        const sr = await fetch(`${KAA_BASE}/api/fsearch`, {
          method: "POST",
          headers: { "User-Agent": UA_KAA, "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ page: 1, query: clean })
        });
        if (!sr.ok) continue;
        const sd = await sr.json();
        const results = Array.isArray(sd?.result) ? sd.result : [];
        if (!results.length) continue;
        const normQ = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
        const mediaType = url.searchParams.get("mediaType") || "tv";
        const scored = results.map((r) => {
          const t = (r.title_en || r.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const longer = Math.max(normQ.length, t.length) || 1;
          let match = 0;
          for (let i2 = 0; i2 < Math.min(normQ.length, t.length); i2++) if (normQ[i2] === t[i2]) match++;
          let titleScore = match / longer;
          if (year && r.year) {
            const diff = Math.abs(Number(r.year) - year);
            if (diff === 0) titleScore *= 1.3;
            else if (diff === 1) titleScore *= 0.7;
            else titleScore *= 0.2;
          }
          const kaaType = (r.type || "").toLowerCase();
          if (mediaType === "tv") {
            if (kaaType === "tv") titleScore *= 1.4;
            else if (kaaType === "ona" || kaaType === "ova") titleScore *= 0.5;
          } else if (mediaType === "movie") {
            if (kaaType === "movie") titleScore *= 1.4;
          }
          return { slug: r.slug, score: titleScore };
        }).sort((a, b) => b.score - a.score);
        if (scored[0]?.score >= 0.2) {
          showSlug = scored[0].slug;
          break;
        }
        if (!showSlug) showSlug = results[0].slug;
      }
      if (!showSlug) return json({ error: `KAA: no match for: ${titles[0]}` }, 404);
      const ep1 = await fetch(`${KAA_BASE}/api/show/${showSlug}/episodes?ep=1&lang=ja-JP`, {
        headers: { "User-Agent": UA_KAA, "Accept": "application/json" }
      });
      if (!ep1.ok) return json({ error: `KAA episodes list ${ep1.status}` }, 502);
      const epData = await ep1.json();
      let allEps = Array.isArray(epData?.result) ? [...epData.result] : [];
      for (const pg of Array.isArray(epData?.pages) ? epData.pages.slice(1) : []) {
        if (!pg.eps?.[0]) continue;
        const d = await fetch(`${KAA_BASE}/api/show/${showSlug}/episodes?ep=${pg.eps[0]}&lang=ja-JP`, {
          headers: { "User-Agent": UA_KAA, "Accept": "application/json" }
        }).then((r) => r.json()).catch(() => null);
        if (Array.isArray(d?.result)) allEps = allEps.concat(d.result);
      }
      const ep = allEps.find((e) => e.episode_number === Number(epNum));
      if (!ep) return json({ error: `KAA: ep ${epNum} not in ${showSlug}` }, 404);
      const fullSlug = `ep-${ep.episode_number}-${ep.slug}`;
      const svRes = await fetch(`${KAA_BASE}/api/show/${showSlug}/episode/${fullSlug}`, {
        headers: { "User-Agent": UA_KAA, "Accept": "application/json" }
      });
      if (!svRes.ok) return json({ error: `KAA servers ${svRes.status}` }, 502);
      const svData = await svRes.json();
      const servers = Array.isArray(svData?.servers) ? svData.servers : [];
      const streams = [];
      for (const s of servers) {
        const m = (s.src || "").match(/[?&]id=([^&]+)/);
        if (!m) continue;
        streams.push({
          url: `${KAA_HLS}/${m[1]}/master.m3u8`,
          type: "hls",
          server: s.name || "KAA",
          referer: "https://krussdomi.com/"
        });
      }
      if (!streams.length) return json({ error: `KAA: no HLS for ep ${epNum}` }, 404);
      return json({ anilistId: Number(anilistId), episode: Number(epNum), audio, showSlug, streams });
    } catch (err2) {
      return json({ error: err2.message }, 500);
    }
  }
  if (url.pathname.startsWith("/api/anivexa/anibd")) {
    const UA_ANIBD = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const ANIBD_BASE = "https://epeng.animeapps.top";
    const epMatch = url.pathname.match(/^\/api\/anivexa\/anibd\/episodes\/(\d+)$/);
    if (epMatch) {
      try {
        const anilistId = epMatch[1];
        const res = await fetch(`${ANIBD_BASE}/api2.php?epid=${anilistId}`, {
          headers: { "User-Agent": UA_ANIBD, Accept: "application/json" }
        });
        if (!res.ok) return json({ error: `anibd api2 ${res.status}` }, 502);
        const data = await res.json();
        return json(Array.isArray(data) ? data : []);
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    const watchMatch = url.pathname.match(/^\/api\/anivexa\/anibd\/watch\/(\d+)\/(sub|dub)\/(\d+)$/);
    if (watchMatch) {
      const [, anilistId, audio, epNum] = watchMatch;
      try {
        const groupsRes = await fetch(`${ANIBD_BASE}/api2.php?epid=${anilistId}`, {
          headers: { "User-Agent": UA_ANIBD, Accept: "application/json" }
        });
        if (!groupsRes.ok) return json({ error: `anibd api2 ${groupsRes.status}` }, 502);
        const groups = await groupsRes.json();
        let providerLink = null;
        for (const group of Array.isArray(groups) ? groups : []) {
          const isMatchAudio = audio === "dub" ? /dub/i.test(group.server_name || "") : !/dub/i.test(group.server_name || "");
          if (!isMatchAudio) continue;
          for (const ep of group.server_data || []) {
            if (Number(ep.name ?? ep.slug) === Number(epNum)) {
              providerLink = ep.link;
              break;
            }
          }
          if (providerLink) break;
        }
        if (!providerLink) {
          for (const group of Array.isArray(groups) ? groups : []) {
            for (const ep of group.server_data || []) {
              if (Number(ep.name ?? ep.slug) === Number(epNum)) {
                providerLink = ep.link;
                break;
              }
            }
            if (providerLink) break;
          }
        }
        if (!providerLink) return json({ error: `Episode ${epNum} not found in anibd` }, 404);
        const linksRes = await fetch(`${ANIBD_BASE}/apilink.php?data=${encodeURIComponent(providerLink)}`, {
          headers: { "User-Agent": UA_ANIBD, Accept: "application/json" }
        });
        if (!linksRes.ok) return json({ error: `anibd apilink ${linksRes.status}` }, 502);
        const playerEntries = await linksRes.json();
        const streams = [];
        for (const entry of Array.isArray(playerEntries) ? playerEntries : []) {
          if (!entry?.link) continue;
          try {
            const origin = new URL(entry.link).origin;
            const referer = `${origin}/`;
            const htmlRes = await fetch(entry.link, {
              headers: { "User-Agent": UA_ANIBD, Referer: referer, Accept: "text/html" }
            });
            if (!htmlRes.ok) throw new Error(`player ${htmlRes.status}`);
            const html = await htmlRes.text();
            const m = html.match(/videoUrl\s*:\s*"([^"]+)"/);
            if (!m) throw new Error("no videoUrl");
            const rawUrl = m[1];
            const hlsUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${origin}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
            streams.push({ url: hlsUrl, type: "hls", server: entry.server || "AniBD", referer });
          } catch {
            const origin = new URL(entry.link).origin;
            streams.push({ url: entry.link, type: "embed", server: entry.server || "AniBD", referer: `${origin}/` });
          }
        }
        return json({ anilistId: Number(anilistId), episode: Number(epNum), audio, streams });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    return json({ error: "Not found" }, 404);
  }
  if (url.pathname.startsWith("/api/anivexa/anizone")) {
    const UA_AZ = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const AZ_BASE = "https://anizone.to";
    const azWatchMatch = url.pathname.match(/^\/api\/anivexa\/anizone\/watch\/(\d+)$/);
    if (azWatchMatch) {
      const epNum = azWatchMatch[1];
      const title = url.searchParams.get("title") || "";
      const slug = url.searchParams.get("slug") || "";
      try {
        let resolvedSlug = slug;
        if (!resolvedSlug && title) {
          const searchHtml = await fetch(`${AZ_BASE}/anime?search=${encodeURIComponent(title)}`, {
            headers: { "User-Agent": UA_AZ, Accept: "text/html" }
          }).then((r) => r.text());
          const slugMatch = searchHtml.match(/href="(?:https:\/\/anizone\.to)?\/anime\/([a-z0-9-]+)"/);
          if (slugMatch) resolvedSlug = slugMatch[1];
        }
        if (!resolvedSlug) return json({ error: "AniZone: no match found for title" }, 404);
        const epHtml = await fetch(`${AZ_BASE}/anime/${resolvedSlug}/${epNum}`, {
          headers: { "User-Agent": UA_AZ, Accept: "text/html", Referer: `${AZ_BASE}/` }
        }).then((r) => r.text());
        const hlsMatch = epHtml.match(/<media-player[^>]+src="([^"]+\.m3u8[^"]*)"/i);
        if (!hlsMatch) return json({ error: "AniZone: no HLS stream found" }, 404);
        const hlsUrl = hlsMatch[1].replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
        const subtitles = [];
        const trackRe = /<track\b([^>]*)>/gi;
        let trackM;
        while ((trackM = trackRe.exec(epHtml)) !== null) {
          const attrs = trackM[1];
          const kind = attrs.match(/kind="([^"]*)"/i)?.[1] ?? "";
          if (kind !== "subtitles") continue;
          const src = attrs.match(/src=["']?([^\s"'>]+)["']?/i)?.[1] ?? "";
          const label = attrs.match(/label="([^"]*)"/i)?.[1] ?? "";
          const srclang = attrs.match(/srclang="([^"]*)"/i)?.[1] ?? "";
          if (src) subtitles.push({ url: src, label, srclang });
        }
        return json({
          slug: resolvedSlug,
          episode: Number(epNum),
          streams: [{ url: hlsUrl, type: "hls", server: "AniZone", referer: `${AZ_BASE}/`, subtitles }]
        });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    if (url.pathname === "/api/anivexa/anizone/search") {
      const title = url.searchParams.get("title") || "";
      if (!title) return json({ error: "Missing title" }, 400);
      try {
        const searchHtml = await fetch(`${AZ_BASE}/anime?search=${encodeURIComponent(title)}`, {
          headers: { "User-Agent": UA_AZ, Accept: "text/html" }
        }).then((r) => r.text());
        const results = [];
        const re = /href="(?:https:\/\/anizone\.to)?\/anime\/([a-z0-9-]+)"/g;
        let m;
        while ((m = re.exec(searchHtml)) !== null) {
          if (!results.includes(m[1])) results.push(m[1]);
        }
        return json({ title, slugs: results.slice(0, 5) });
      } catch (err2) {
        return json({ error: err2.message }, 500);
      }
    }
    return json({ error: "Not found" }, 404);
  }
  if (url.pathname === "/api/dev-logger") {
    return json({ success: true }, 200);
  }
  if (url.pathname.startsWith("/api/img-proxy")) {
    const imageUrl = url.searchParams.get("url");
    if (!imageUrl) {
      return new Response("Missing url", { status: 400, headers: CORS_HEADERS });
    }
    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    } catch (err2) {
      return new Response("Error fetching image", { status: 500, headers: CORS_HEADERS });
    }
  }
  if (url.pathname.startsWith("/api/m3u8-proxy")) {
    const targetUrl = url.searchParams.get("url");
    const referer = url.searchParams.get("referer") || "";
    const origin = url.searchParams.get("origin") || (referer ? new URL(referer).origin : "");
    const userAgent = url.searchParams.get("ua") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    if (!targetUrl) {
      return json({ error: "Missing url param" }, 400);
    }
    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsedTarget.protocol)) throw new Error("Invalid protocol");
    } catch {
      return json({ error: "Invalid url" }, 400);
    }
    const fetchHeaders = {
      "User-Agent": userAgent,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br"
    };
    if (referer) fetchHeaders["Referer"] = referer;
    if (origin) fetchHeaders["Origin"] = origin;
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;
    let res;
    const referersToTry = [referer];
    const isOPhimTarget = targetUrl.includes("opstream") || targetUrl.includes("ophim") || targetUrl.includes("phimimg") || referer.includes("ophim") || referer.includes("opstream");
    const isKKPhimTarget = targetUrl.includes("kkphim") || targetUrl.includes("phimapi") || referer.includes("kkphim") || referer.includes("phimapi");
    if (isOPhimTarget) {
      const candidates = [
        "https://ophim1.com/",
        "https://ophim.tv/",
        "https://ophim.cc/",
        "https://ophim.live/",
        "https://opstream.tv/"
      ];
      for (const c of candidates) {
        if (c && c !== referer) referersToTry.push(c);
      }
    } else if (isKKPhimTarget) {
      const candidates = [
        "https://phimapi.com/",
        "https://kkphim.com/",
        "https://kkphim.link/"
      ];
      for (const c of candidates) {
        if (c && c !== referer) referersToTry.push(c);
      }
    }
    for (let i2 = 0; i2 < referersToTry.length; i2++) {
      const currentReferer = referersToTry[i2];
      const headers = { ...fetchHeaders };
      if (currentReferer) {
        headers["Referer"] = currentReferer;
        try {
          headers["Origin"] = new URL(currentReferer).origin;
        } catch (e) {
        }
      } else {
        delete headers["Referer"];
        delete headers["Origin"];
      }
      try {
        res = await fetch(targetUrl, {
          headers,
          redirect: "follow"
        });
        if (res.ok || res.status === 206 || res.status !== 403) {
          break;
        }
        console.warn(`[m3u8-proxy CF] 403 Forbidden with referer ${currentReferer}, retrying next...`);
      } catch (err2) {
        if (i2 === referersToTry.length - 1) {
          return json({ error: `Fetch failed: ${err2.message}` }, 502);
        }
      }
    }
    if (!res.ok && res.status !== 206) {
      return json({ error: `Upstream returned ${res.status}` }, res.status);
    }
    const contentType = res.headers.get("Content-Type") || "";
    const isM3U8 = contentType.includes("mpegurl") || contentType.includes("x-mpegURL") || targetUrl.includes(".m3u8");
    const isTS = contentType.includes("video/") || contentType.includes("application/octet") || targetUrl.match(/\.(ts|aac|mp4|m4s|fmp4)(\?|$)/);
    if (isM3U8 || !isTS && !contentType.includes("video/")) {
      const text = await res.text();
      const rewritten = rewriteM3U8(text, targetUrl, referer, url);
      return new Response(rewritten, {
        status: res.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
          "X-Proxy-Source": parsedTarget.hostname
        }
      });
    }
    const body = await res.arrayBuffer();
    const responseHeaders = {
      ...CORS_HEADERS,
      "Content-Type": contentType || "video/MP2T",
      "Cache-Control": "public, max-age=3600"
    };
    if (res.status === 206) {
      const contentRange = res.headers.get("Content-Range");
      if (contentRange) responseHeaders["Content-Range"] = contentRange;
      responseHeaders["Accept-Ranges"] = "bytes";
    }
    return new Response(body, {
      status: res.status,
      headers: responseHeaders
    });
  }
  if (url.pathname === "/api/admin/scraper/streams") {
    const hollysheeshApiUrl = (env.HOLLYSHEESH_API_URL || "").trim().replace(/\/$/, "");
    if (!hollysheeshApiUrl) {
      return json({
        ok: true,
        streams: [],
        note: "HOLLYSHEESH_API_URL is not configured. Set it in Cloudflare Worker env vars to enable the database stream source."
      });
    }
    try {
      const forwardUrl = `${hollysheeshApiUrl}/api/admin/scraper/streams${url.search}`;
      const res = await fetch(forwardUrl, {
        headers: {
          "User-Agent": "CinemaxWorker/1.0",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) {
        return json({ ok: true, streams: [], error: `Bridge returned ${res.status}` });
      }
      const data = await res.json();
      return json(data);
    } catch (err2) {
      console.error("[worker-streams-api] Bridge error:", err2.message);
      return json({ ok: true, streams: [], error: err2.message });
    }
  }
  if (url.pathname === "/api/anime-sfw") {
    const hollysheeshApiUrl = (env.HOLLYSHEESH_API_URL || "").trim().replace(/\/$/, "");
    if (!hollysheeshApiUrl) {
      return json({ ok: true, results: [], note: "HOLLYSHEESH_API_URL not configured" });
    }
    try {
      const forwardUrl = `${hollysheeshApiUrl}/api/anime-sfw${url.search}`;
      const res = await fetch(forwardUrl, {
        headers: { "User-Agent": "CinemaxWorker/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(6e3)
      });
      if (!res.ok) return json({ ok: true, results: [], error: `Bridge returned ${res.status}` });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }
      });
    } catch (err2) {
      console.error("[worker-anime-sfw] Bridge error:", err2.message);
      return json({ ok: true, results: [], error: err2.message });
    }
  }
  if (url.pathname === "/api/anime-sfw/sync" && request.method === "POST") {
    const hollysheeshApiUrl = (env.HOLLYSHEESH_API_URL || "").trim().replace(/\/$/, "");
    if (!hollysheeshApiUrl) return json({ ok: false, error: "HOLLYSHEESH_API_URL not configured" }, 503);
    try {
      const res = await fetch(`${hollysheeshApiUrl}/api/anime-sfw/sync`, {
        method: "POST",
        headers: { "User-Agent": "CinemaxWorker/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(5e3)
      });
      const data = await res.json();
      return json(data);
    } catch (err2) {
      return json({ ok: false, error: err2.message }, 502);
    }
  }
  if (url.pathname === "/api/anilist/bulk") {
    const queriesParam = url.searchParams.get("queries") || "";
    if (!queriesParam) {
      return json({ error: "Missing queries param" }, 400);
    }
    let queries = [];
    try {
      queries = JSON.parse(queriesParam);
    } catch (e) {
      queries = queriesParam.split(",").map((q) => q.trim()).filter(Boolean);
    }
    const results = {};
    const promises = queries.map(async (query) => {
      const cleanTitle = query.replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/\s*-\s*Phần\s+\d+/gi, "").replace(/\s*Phần\s+\d+/gi, "").replace(/\s*Season\s+\d+/gi, "").replace(/\s*Part\s+\d+/gi, "").replace(/\s*P\d+/gi, "").trim();
      try {
        const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(cleanTitle)}&mediaType=ANIME&limit=1`;
        const response = await fetch(searchUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.results && data.results.length > 0) {
            const item = data.results[0];
            results[query] = {
              extraLarge: item.images?.coverXl || null,
              large: item.images?.coverLg || null,
              medium: item.images?.coverMd || null,
              banner: item.images?.bannerUrl || null,
              color: item.images?.coverColor || null
            };
            return;
          }
        }
      } catch (e) {
      }
      results[query] = null;
    });
    await Promise.all(promises);
    return json(results, 200, {
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200"
    });
  }
  if (url.pathname.startsWith("/api/anilist")) {
    const search = url.searchParams.get("search");
    if (!search) {
      return json({ error: "Missing search param" }, 400);
    }
    const cleanTitle = search.replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/\s*-\s*Phần\s+\d+/gi, "").replace(/\s*Phần\s+\d+/gi, "").replace(/\s*Season\s+\d+/gi, "").replace(/\s*Part\s+\d+/gi, "").replace(/\s*P\d+/gi, "").trim();
    try {
      const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(cleanTitle)}&mediaType=ANIME&limit=1`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
          const item = data.results[0];
          return json({
            extraLarge: item.images?.coverXl || null,
            large: item.images?.coverLg || null,
            medium: item.images?.coverMd || null,
            banner: item.images?.bannerUrl || null,
            color: item.images?.coverColor || null
          }, 200, {
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200"
          });
        }
      }
    } catch (err2) {
    }
    return json(null);
  }
  if (url.pathname === "/api/anime/details/bulk") {
    const anilistIdsParam = url.searchParams.get("anilist_ids") || "";
    if (!anilistIdsParam) {
      return json({ error: "Missing anilist_ids" }, 400);
    }
    const anilistIds = anilistIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
    const results = {};
    const uncachedIds = [];
    const cachedArray = typeof env.MOVIE_CACHE !== "undefined" ? await Promise.all(anilistIds.map(async (id) => {
      const cacheKey = `anime_details_${id}`;
      try {
        const cached = await env.MOVIE_CACHE.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } catch (e) {
        console.warn("[anime-details-bulk] KV cache read error:", e.message);
        return null;
      }
    })) : anilistIds.map(() => null);
    for (let i2 = 0; i2 < anilistIds.length; i2++) {
      const id = anilistIds[i2];
      const cached = cachedArray[i2];
      if (cached) {
        results[id] = cached;
      } else {
        uncachedIds.push(id);
      }
    }
    if (uncachedIds.length > 0) {
      try {
        const promises = uncachedIds.map(async (id) => {
          try {
            const res = await fetch(`https://api.animapper.net/api/v1/metadata?id=${id}`);
            if (res.ok) {
              const data = await res.json();
              const result = data?.result;
              if (result) {
                const title = result.titles?.vi || result.titles?.en || result.titles?.ja || "Unknown Title";
                const payload = {
                  ok: true,
                  anilistId: result.id,
                  title,
                  description: result.descriptions?.vi || result.descriptions?.en || null,
                  coverImage: result.images ? {
                    extraLarge: result.images.coverXl || null,
                    large: result.images.coverLg || null,
                    medium: result.images.coverMd || null
                  } : null,
                  bannerImage: result.images?.bannerUrl || null,
                  genres: (result.genres || []).map((g) => g.name || g),
                  year: result.seasonYear || null,
                  status: result.status || null,
                  episodesCount: result.totalUnits || result.units?.length || null,
                  showId: null,
                  episodes: []
                };
                results[id] = payload;
                if (typeof env.MOVIE_CACHE !== "undefined") {
                  const writePromise = (async () => {
                    try {
                      const cacheKey = `anime_details_${id}`;
                      await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(payload), {
                        expirationTtl: 86400
                      });
                    } catch (e) {
                      console.warn("[anime-details-bulk] KV cache write error:", e.message);
                    }
                  })();
                  if (ctx && typeof ctx.waitUntil === "function") {
                    ctx.waitUntil(writePromise);
                  }
                }
              }
            }
          } catch (e) {
          }
        });
        await Promise.all(promises);
      } catch (err2) {
        console.error("[anime-details-bulk] AniMapper fetch error:", err2.message);
      }
    }
    for (const id of anilistIds) {
      if (!results[id]) {
        results[id] = null;
      }
    }
    return json(results, 200, {
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    });
  }
  if (url.pathname.startsWith("/api/anime/episodes")) {
    const title = url.searchParams.get("title");
    if (!title) {
      return json({ error: "Missing title" }, 400);
    }
    const cacheKey = `anime_episodes_${encodeURIComponent(title.toLowerCase())}`;
    if (typeof env.MOVIE_CACHE !== "undefined") {
      try {
        const cached = await env.MOVIE_CACHE.get(cacheKey);
        if (cached) {
          console.log(`[anime-episodes] KV cache hit for ${cacheKey}`);
          return json(JSON.parse(cached), 200, {
            "Cache-Control": "public, max-age=86400, s-maxage=86400"
          });
        }
      } catch (e) {
        console.warn("[anime-episodes] KV cache read error:", e.message);
      }
    }
    try {
      const showId = await resolveAnimeIdFromTitle(title);
      let episodesList = [];
      if (showId) {
        console.log(`[anime-episodes] Found HiAnime show: ${showId}`);
        const numericShowId = showId.split("-").pop();
        const listJson = await fetchHiAnime(`/ajax/v2/episode/list/${numericShowId}`);
        if (listJson && listJson.html) {
          const html = listJson.html;
          const aRegex = /<a\s+([^>]+)>/g;
          for (const match of html.matchAll(aRegex)) {
            const attributes = match[1];
            const hrefMatch = attributes.match(/href="([^"]+)"/);
            const numMatch = attributes.match(/data-number="([^"]+)"/);
            const titleMatch = attributes.match(/title="([^"]*)"/);
            if (hrefMatch && numMatch) {
              const href = hrefMatch[1];
              const epId = href.replace(/^\/watch\//, "").replace(/^\//, "");
              episodesList.push({
                name: numMatch[1],
                id: epId,
                title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : `Episode ${numMatch[1]}`
              });
            }
          }
        }
      }
      const payload = {
        ok: true,
        showId: showId || null,
        episodes: episodesList
      };
      if (typeof env.MOVIE_CACHE !== "undefined" && payload.showId) {
        try {
          await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(payload), {
            expirationTtl: 86400
          });
        } catch (e) {
        }
      }
      return json(payload, 200, {
        "Cache-Control": "public, max-age=86400, s-maxage=86400"
      });
    } catch (err2) {
      return json({ error: err2.message, episodes: [] }, 500);
    }
  }
  if (url.pathname.startsWith("/api/anime/details")) {
    const anilistId = url.searchParams.get("anilist_id");
    if (!anilistId) {
      return json({ error: "Missing anilist_id" }, 400);
    }
    const cacheKey = `anime_details_${anilistId}`;
    if (typeof env.MOVIE_CACHE !== "undefined") {
      try {
        const cached = await env.MOVIE_CACHE.get(cacheKey);
        if (cached) {
          console.log(`[anime-details] KV cache hit for ${cacheKey}`);
          return json(JSON.parse(cached), 200, {
            "Cache-Control": "public, max-age=86400, s-maxage=86400"
          });
        }
      } catch (e) {
        console.warn("[anime-details] KV cache read error:", e.message);
      }
    }
    try {
      console.log(`[anime-details] Fetching AniMapper media: ${anilistId}`);
      const animapperRes = await fetch(`https://api.animapper.net/api/v1/metadata?id=${anilistId}`);
      if (!animapperRes.ok) {
        return json({ error: `AniMapper API error: ${animapperRes.statusText}` }, animapperRes.status);
      }
      const animapperData = await animapperRes.json();
      const result = animapperData?.result;
      if (!result) {
        return json({ error: "Anime not found on AniMapper" }, 404);
      }
      const title = result.titles?.vi || result.titles?.en || result.titles?.ja || "Unknown Title";
      console.log(`[anime-details] Resolved title: ${title}`);
      const showId = await resolveAnimeIdFromTitle(title);
      let episodesList = [];
      if (showId) {
        console.log(`[anime-details] Found HiAnime show: ${showId}`);
        const numericShowId = showId.split("-").pop();
        const listJson = await fetchHiAnime(`/ajax/v2/episode/list/${numericShowId}`);
        if (listJson && listJson.html) {
          const html = listJson.html;
          const aRegex = /<a\s+([^>]+)>/g;
          for (const match of html.matchAll(aRegex)) {
            const attributes = match[1];
            const hrefMatch = attributes.match(/href="([^"]+)"/);
            const numMatch = attributes.match(/data-number="([^"]+)"/);
            const titleMatch = attributes.match(/title="([^"]*)"/);
            if (hrefMatch && numMatch) {
              const href = hrefMatch[1];
              const epId = href.replace(/^\/watch\//, "").replace(/^\//, "");
              episodesList.push({
                name: numMatch[1],
                id: epId,
                title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : `Episode ${numMatch[1]}`
              });
            }
          }
        }
      } else {
        console.warn(`[anime-details] Could not resolve HiAnime show for: ${title}`);
      }
      if (episodesList.length === 0 && result.units) {
        episodesList = result.units.filter((unit) => unit.unitKind === "EPISODE").map((unit) => ({
          name: String(unit.number),
          id: String(unit.number),
          title: unit.titles?.vi || unit.titles?.en || unit.titles?.ja || `T\u1EADp ${unit.number}`
        }));
      }
      const payload = {
        ok: true,
        anilistId: result.id,
        title,
        description: result.descriptions?.vi || result.descriptions?.en || null,
        coverImage: result.images ? {
          extraLarge: result.images.coverXl || null,
          large: result.images.coverLg || null,
          medium: result.images.coverMd || null
        } : null,
        bannerImage: result.images?.bannerUrl || null,
        genres: (result.genres || []).map((g) => g.name || g),
        year: result.seasonYear || null,
        status: result.status || null,
        episodesCount: result.totalUnits || result.units?.length || null,
        showId: showId || null,
        episodes: episodesList
      };
      if (typeof env.MOVIE_CACHE !== "undefined") {
        try {
          await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(payload), {
            expirationTtl: 86400
          });
          console.log(`[anime-details] KV cached for ${cacheKey}`);
        } catch (e) {
          console.warn("[anime-details] KV cache write error:", e.message);
        }
      }
      return json(payload);
    } catch (err2) {
      console.error("[anime-details] Endpoint error:", err2.message);
      return json({ error: err2.message, episodes: [] }, 500);
    }
  }
  if (url.pathname.startsWith("/api/anime/subtitles")) {
    const episodeId = url.searchParams.get("id");
    if (!episodeId) {
      return new Response("Missing id", { status: 400, headers: CORS_HEADERS });
    }
    const tmdbId = url.searchParams.get("tmdb_id");
    const season = url.searchParams.get("season");
    const episode = url.searchParams.get("episode");
    const geminiKey = url.searchParams.get("gemini_key") || request.headers.get("X-Gemini-Key");
    const cleanEpisodeId = episodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const kvKey = `SUB_VI_${cleanEpisodeId}`;
    if (request.addEdgeLog) {
      request.addEdgeLog("EDGE_WORKER", "INFO", `Subtitle route called for Episode: ${cleanEpisodeId}`);
    }
    const kvStart = Date.now();
    if (typeof env.MOVIE_CACHE !== "undefined") {
      try {
        const cachedSub = await env.MOVIE_CACHE.get(kvKey);
        if (cachedSub) {
          console.log(`[subtitles-endpoint] KV Cache hit for: ${kvKey}`);
          if (request.addEdgeLog) {
            request.addEdgeLog("EDGE_WORKER", "INFO", `KV Cache Hit for: ${kvKey}. Returning cached WebVTT subtitles.`, `${Date.now() - kvStart}ms`);
          }
          return new Response(cachedSub, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "text/vtt; charset=utf-8",
              "Cache-Control": "public, max-age=86400"
            }
          });
        }
      } catch (e) {
        console.warn("[subtitles-endpoint] KV cache read error:", e.message);
      }
    }
    if (request.addEdgeLog) {
      request.addEdgeLog("EDGE_WORKER", "INFO", `KV Cache Miss for: ${kvKey}. Initiating fallback/translation chain.`, `${Date.now() - kvStart}ms`);
    }
    let hianimeSource = null;
    try {
      const decryptStart = Date.now();
      hianimeSource = await getHiAnimeDecryptedSource(episodeId, env);
      if (request.addEdgeLog) {
        request.addEdgeLog("EDGE_WORKER", "INFO", `HiAnime source decrypted successfully. Tracks found: ${hianimeSource?.tracks?.length || 0}`, `${Date.now() - decryptStart}ms`);
      }
    } catch (err2) {
      console.warn("[subtitles-endpoint] T\u1EA7ng 2 HiAnime fetch/decrypt error:", err2.message);
      if (request.addEdgeLog) {
        request.addEdgeLog("EDGE_WORKER", "WARN", `Failed to decrypt HiAnime source tracks: ${err2.message}`);
      }
    }
    if (hianimeSource && hianimeSource.tracks) {
      const viTrack = hianimeSource.tracks.find(
        (t) => (t.label || "").toLowerCase() === "vietnamese" || (t.lang || "").toLowerCase() === "vietnamese" || (t.label || "").toLowerCase() === "vi"
      );
      if (viTrack && viTrack.file) {
        try {
          console.log(`[subtitles-endpoint] Found Vietnamese track on HiAnime: ${viTrack.file}`);
          if (request.addEdgeLog) {
            request.addEdgeLog("EDGE_WORKER", "INFO", `Found Vietnamese subtitle track on HiAnime: ${viTrack.file}. Loading directly.`);
          }
          const viRes = await fetch(viTrack.file);
          if (viRes.ok) {
            const vttText = await viRes.text();
            if (typeof env.MOVIE_CACHE !== "undefined") {
              await env.MOVIE_CACHE.put(kvKey, vttText, { expirationTtl: 86400 * 30 });
              if (request.addEdgeLog) {
                request.addEdgeLog("EDGE_WORKER", "INFO", `HiAnime Vietnamese subtitle cached to KV with key: ${kvKey}`);
              }
            }
            return new Response(vttText, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "text/vtt; charset=utf-8",
                "Cache-Control": "public, max-age=86400"
              }
            });
          }
        } catch (e) {
          console.warn("[subtitles-endpoint] Failed to fetch HiAnime Vietnamese track:", e.message);
          if (request.addEdgeLog) {
            request.addEdgeLog("EDGE_WORKER", "WARN", `Failed to fetch HiAnime Vietnamese track: ${e.message}`);
          }
        }
      }
    }
    if (tmdbId) {
      try {
        if (request.addEdgeLog) {
          request.addEdgeLog("EDGE_WORKER", "INFO", `Querying OpenSubtitles for TMDB ID: ${tmdbId}`);
        }
        const osParams = new URLSearchParams();
        osParams.set("languages", "vi");
        osParams.set("tmdb_id", tmdbId);
        if (season) osParams.set("season_number", season);
        if (episode) osParams.set("episode_number", episode);
        osParams.set("type", season ? "episode" : "movie");
        osParams.set("per_page", "5");
        const searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?${osParams.toString()}`;
        console.log(`[subtitles-endpoint] Querying OpenSubtitles: ${searchUrl}`);
        const osResp = await fetch(searchUrl, {
          headers: {
            "Api-Key": "wp8vrDdcuRwJUvFOkvNBDJ7FA5D989dp",
            "Content-Type": "application/json",
            "User-Agent": "CinemaxApp v1.0"
          }
        });
        if (osResp.ok) {
          const osData = await osResp.json();
          const subItem = (osData.data || []).find((item) => item.attributes?.files?.[0]?.file_id);
          if (subItem) {
            const fileId = subItem.attributes.files[0].file_id;
            console.log(`[subtitles-endpoint] Found OpenSubtitles track with file_id: ${fileId}`);
            if (request.addEdgeLog) {
              request.addEdgeLog("EDGE_WORKER", "INFO", `Found Vietnamese track on OpenSubtitles. File ID: ${fileId}`);
            }
            const dlResp = await fetch(`https://api.opensubtitles.com/api/v1/download`, {
              method: "POST",
              headers: {
                "Api-Key": "wp8vrDdcuRwJUvFOkvNBDJ7FA5D989dp",
                "Content-Type": "application/json",
                "User-Agent": "CinemaxApp v1.0"
              },
              body: JSON.stringify({ file_id: fileId })
            });
            if (dlResp.ok) {
              const dlData = await dlResp.json();
              if (dlData.link) {
                console.log(`[subtitles-endpoint] Downloading subtitle file: ${dlData.link}`);
                const fileResp = await fetch(dlData.link);
                if (fileResp.ok) {
                  let subContent = await fileResp.text();
                  if (dlData.link.includes(".srt") || subContent.trim().startsWith("1")) {
                    console.log("[subtitles-endpoint] Converting SRT to VTT from OpenSubtitles");
                    subContent = convertSrtToVtt(subContent);
                  }
                  if (typeof env.MOVIE_CACHE !== "undefined") {
                    await env.MOVIE_CACHE.put(kvKey, subContent, { expirationTtl: 86400 * 30 });
                    if (request.addEdgeLog) {
                      request.addEdgeLog("EDGE_WORKER", "INFO", `Saved OpenSubtitles subtitle to KV: ${kvKey}`);
                    }
                  }
                  return new Response(subContent, {
                    status: 200,
                    headers: {
                      ...CORS_HEADERS,
                      "Content-Type": "text/vtt; charset=utf-8",
                      "Cache-Control": "public, max-age=86400"
                    }
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[subtitles-endpoint] OpenSubtitles error:", e.message);
        if (request.addEdgeLog) {
          request.addEdgeLog("EDGE_WORKER", "WARN", `OpenSubtitles fetch failed: ${e.message}`);
        }
      }
    }
    if (hianimeSource && hianimeSource.tracks) {
      if (!geminiKey) {
        if (request.addEdgeLog) {
          request.addEdgeLog("EDGE_WORKER", "WARN", "Vietnamese subtitles not found and Gemini API key is missing.");
        }
        return new Response("Vietnamese subtitles not found. Gemini API key required for translation.", {
          status: 404,
          headers: CORS_HEADERS
        });
      }
      const enTrack = hianimeSource.tracks.find(
        (t) => (t.label || "").toLowerCase() === "english" || (t.lang || "").toLowerCase() === "english" || (t.label || "").toLowerCase() === "en"
      );
      if (enTrack && enTrack.file) {
        try {
          console.log(`[subtitles-endpoint] Translating English subtitle with Gemini: ${enTrack.file}`);
          if (request.addEdgeLog) {
            request.addEdgeLog("EDGE_WORKER", "INFO", "No Vietnamese subtitle found in KV, HiAnime, or OpenSubtitles. Initiating Gemini AI Translation workflow.");
          }
          const enRes = await fetch(enTrack.file);
          if (enRes.ok) {
            const enVttText = await enRes.text();
            const { header, cues } = parseVttCues(enVttText);
            if (cues.length === 0) {
              throw new Error("No cues found in English subtitle");
            }
            console.log(`[subtitles-endpoint] Found ${cues.length} cues, translating...`);
            if (request.addEdgeLog) {
              request.addEdgeLog("EDGE_WORKER", "INFO", `Fetched English source subtitle for translation. Cues count: ${cues.length}`);
            }
            const translateStart = Date.now();
            const translatedTextsMap = await translateCuesWithGemini(cues, geminiKey);
            const translateTime = Date.now() - translateStart;
            const level = translateTime > 4e3 ? "WARN" : "INFO";
            if (request.addEdgeLog) {
              request.addEdgeLog("GEMINI_AI", level, `Gemini translated ${cues.length} WebVTT cues successfully.`, `${translateTime}ms`);
            }
            const viVttText = rebuildVtt(header, cues, translatedTextsMap);
            if (typeof env.MOVIE_CACHE !== "undefined") {
              await env.MOVIE_CACHE.put(kvKey, viVttText, { expirationTtl: 86400 * 30 });
              if (request.addEdgeLog) {
                request.addEdgeLog("EDGE_WORKER", "INFO", `Saved translated subtitle to KV: ${kvKey}`);
              }
            }
            return new Response(viVttText, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "text/vtt; charset=utf-8",
                "Cache-Control": "public, max-age=86400"
              }
            });
          }
        } catch (e) {
          console.error("[subtitles-endpoint] Gemini translation error:", e.message);
          if (request.addEdgeLog) {
            request.addEdgeLog("GEMINI_AI", "ERROR", `Gemini translation failed: ${e.message}`);
          }
          return new Response(`AI Translation failed: ${e.message}`, {
            status: 500,
            headers: CORS_HEADERS
          });
        }
      }
    }
    return new Response("Subtitles not found in any layer", { status: 404, headers: CORS_HEADERS });
  }
  if (url.pathname.startsWith("/api/anime/stream")) {
    let episodeId = url.searchParams.get("id");
    const category = url.searchParams.get("category") || "sub";
    if (request.addEdgeLog) {
      request.addEdgeLog("EDGE_WORKER", "INFO", `Stream proxy requested for Episode ID: ${episodeId || ""}`);
    }
    if (!episodeId) {
      const title = url.searchParams.get("title");
      const episode = url.searchParams.get("episode") || "1";
      if (!title) {
        return json({ error: "Missing episode id or title" }, 400);
      }
      console.log(`[anime-stream] Resolving show ID for title: ${title}`);
      const showId = await resolveAnimeIdFromTitle(title);
      if (!showId) {
        return json({ error: `Anime not found for title: ${title}` }, 404);
      }
      console.log(`[anime-stream] Resolving episode ID for show: ${showId}, ep: ${episode}`);
      episodeId = await resolveEpisodeIdFromShow(showId, episode);
      if (!episodeId) {
        return json({ error: `Episode ${episode} not found for show: ${showId}` }, 404);
      }
      console.log(`[anime-stream] Resolved episode ID: ${episodeId}`);
    }
    const cacheKey = `anime_stream_${episodeId}_${category}`;
    const cacheStart = Date.now();
    if (typeof env.MOVIE_CACHE !== "undefined") {
      try {
        const cached = await env.MOVIE_CACHE.get(cacheKey);
        if (cached) {
          console.log(`[anime-stream] KV cache hit for ${cacheKey}`);
          if (request.addEdgeLog) {
            request.addEdgeLog("EDGE_WORKER", "INFO", `KV cache hit for stream key: ${cacheKey}. Returning stream payload.`, `${Date.now() - cacheStart}ms`);
          }
          return json(JSON.parse(cached), 200, {
            "Cache-Control": "public, max-age=3600, s-maxage=3600"
          });
        }
      } catch (e) {
        console.warn("[anime-stream] KV cache read error:", e.message);
      }
    }
    if (request.addEdgeLog) {
      request.addEdgeLog("EDGE_WORKER", "INFO", `KV cache miss for stream key: ${cacheKey}. Resolving servers and links.`, `${Date.now() - cacheStart}ms`);
    }
    try {
      const serversJson = await fetchHiAnime(`/ajax/v2/episode/servers?episodeId=${episodeId.split("?ep=").pop()}`);
      if (!serversJson || !serversJson.html) {
        return json({ error: "Servers HTML not found" }, 404);
      }
      const servers = [];
      const divRegex = /<div\s+[^>]*class="[^"]*server-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
      for (const divMatch of serversJson.html.matchAll(divRegex)) {
        const innerHtml = divMatch[0];
        const idMatch = innerHtml.match(/data-id="([^"]+)"/);
        const serverIdMatch = innerHtml.match(/data-server-id="([^"]+)"/);
        const typeMatch = innerHtml.match(/data-type="([^"]+)"/);
        const aMatch = innerHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/);
        if (idMatch && serverIdMatch && typeMatch && aMatch) {
          servers.push({
            data_id: idMatch[1],
            server_id: serverIdMatch[1],
            type: typeMatch[1],
            // sub / dub / raw
            name: aMatch[1].replace(/<[^>]*>/g, "").trim()
          });
        }
      }
      if (servers.length === 0) {
        return json({ error: "No servers available for this episode" }, 404);
      }
      let activeServer = servers.find((s) => s.type === category && (s.name.toLowerCase() === "megacloud" || s.server_id === "4"));
      if (!activeServer) {
        activeServer = servers.find((s) => s.name.toLowerCase() === "megacloud" || s.server_id === "4");
      }
      if (!activeServer) {
        activeServer = servers.find((s) => s.type === category) || servers[0];
      }
      const sourcesJson = await fetchHiAnime(`/ajax/v2/episode/sources?id=${activeServer.data_id}`);
      if (!sourcesJson || !sourcesJson.link) {
        return json({ error: "Sources link not found" }, 404);
      }
      const embedUrl = sourcesJson.link;
      let streamResult;
      if (activeServer.name.toLowerCase() === "megacloud" || activeServer.server_id === "4" || embedUrl.includes("megacloud") || embedUrl.includes("rapidcloud")) {
        console.log(`[anime-stream] Decrypting MegaCloud source: ${embedUrl}`);
        const decryptStart = Date.now();
        streamResult = await decryptMegaCloudSource(embedUrl);
        const decryptDuration = Date.now() - decryptStart;
        if (request.addEdgeLog) {
          request.addEdgeLog("EDGE_WORKER", "INFO", `Decrypted MegaCloud source successfully. Server: ${activeServer.name}`, `${decryptDuration}ms`);
        }
      } else {
        console.log(`[anime-stream] Serving non-encrypted source: ${embedUrl}`);
        if (request.addEdgeLog) {
          request.addEdgeLog("EDGE_WORKER", "INFO", `Serving non-encrypted source. Server: ${activeServer.name}`);
        }
        streamResult = {
          link: { file: embedUrl, type: "embed" },
          tracks: [],
          server: activeServer.name,
          iframe: embedUrl
        };
      }
      if (!streamResult) {
        return json({ error: "Decryption failed" }, 500);
      }
      const rawHls = streamResult.link?.file || "";
      let proxiedHls = rawHls;
      if (rawHls && (rawHls.startsWith("http://") || rawHls.startsWith("https://"))) {
        const requestHeaders = {
          "Referer": activeServer.name.toLowerCase() === "megacloud" || activeServer.server_id === "4" || embedUrl.includes("megacloud") ? "https://megacloud.tv/" : "https://rapidcloud.co/"
        };
        const base64Headers = btoa(JSON.stringify(requestHeaders));
        proxiedHls = `${url.origin}/api/stream/m3u8?url=${encodeURIComponent(rawHls)}&headers=${encodeURIComponent(base64Headers)}`;
      }
      const tmdbId = url.searchParams.get("tmdb_id") || "";
      const season = url.searchParams.get("season") || "";
      const episode = url.searchParams.get("episode") || "";
      const geminiKey = url.searchParams.get("gemini_key") || "";
      const subParams = new URLSearchParams();
      subParams.set("id", episodeId);
      if (tmdbId) subParams.set("tmdb_id", tmdbId);
      if (season) subParams.set("season", season);
      if (episode) subParams.set("episode", episode);
      if (geminiKey) subParams.set("gemini_key", geminiKey);
      const viSubtitleUrl = `${url.origin}/api/anime/subtitles?${subParams.toString()}`;
      const tracks = streamResult.tracks || [];
      const viTrack = {
        file: viSubtitleUrl,
        label: "Vietnamese (Waterfall)",
        kind: "captions",
        default: true
      };
      const updatedTracks = [viTrack, ...tracks];
      const payload = {
        ok: true,
        hls: proxiedHls,
        raw_hls: rawHls,
        type: streamResult.link?.type || "hls",
        tracks: updatedTracks,
        intro: streamResult.intro || null,
        outro: streamResult.outro || null,
        server: streamResult.server || activeServer.name,
        iframe: streamResult.iframe || embedUrl,
        servers: servers.map((s) => ({ name: s.name, type: s.type, id: s.data_id }))
      };
      if (typeof env.MOVIE_CACHE !== "undefined" && payload.hls) {
        try {
          await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(payload), {
            expirationTtl: 3600
          });
          console.log(`[anime-stream] KV cached for ${cacheKey}`);
        } catch (e) {
          console.warn("[anime-stream] KV cache write error:", e.message);
        }
      }
      return json(payload);
    } catch (err2) {
      console.error("[anime-stream] Stream fetch error:", err2.message);
      return json({ error: err2.message }, 500);
    }
  }
  if (url.pathname.startsWith("/api/stream/m3u8")) {
    const targetUrlStr = url.searchParams.get("url");
    if (!targetUrlStr) {
      return new Response("Missing url parameter", { status: 400, headers: CORS_HEADERS });
    }
    const targetUrl = new URL(targetUrlStr);
    const headersParam = url.searchParams.get("headers");
    let requestHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": targetUrl.origin + "/"
    };
    if (headersParam) {
      try {
        const parsed = JSON.parse(atob(headersParam));
        requestHeaders = { ...requestHeaders, ...parsed };
      } catch (e) {
        console.warn("[m3u8-proxy] Failed to parse headers:", e.message);
      }
    }
    try {
      const res = await fetch(targetUrlStr, { headers: requestHeaders });
      if (!res.ok) {
        return new Response(`Target URL returned status ${res.status}`, { status: res.status, headers: CORS_HEADERS });
      }
      let m3u8Text = await res.text();
      const lines = m3u8Text.split("\n");
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }
        let absoluteUrl = trimmed;
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
          absoluteUrl = new URL(trimmed, targetUrlStr).toString();
        }
        const isPlaylist2 = absoluteUrl.includes(".m3u8") || absoluteUrl.split("?")[0].endsWith(".m3u8");
        const proxyEndpoint = isPlaylist2 ? "/api/stream/m3u8" : "/api/stream/segment";
        const base64Headers = btoa(JSON.stringify(requestHeaders));
        const proxiedUrl = `${url.origin}${proxyEndpoint}?url=${encodeURIComponent(absoluteUrl)}&headers=${encodeURIComponent(base64Headers)}`;
        return proxiedUrl;
      });
      m3u8Text = rewrittenLines.join("\n");
      return new Response(m3u8Text, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=300"
        }
      });
    } catch (err2) {
      return new Response(`Proxy error: ${err2.message}`, { status: 500, headers: CORS_HEADERS });
    }
  }
  if (url.pathname.startsWith("/api/stream/segment")) {
    const targetUrlStr = url.searchParams.get("url");
    if (!targetUrlStr) {
      return new Response("Missing url parameter", { status: 400, headers: CORS_HEADERS });
    }
    const targetUrl = new URL(targetUrlStr);
    const headersParam = url.searchParams.get("headers");
    let requestHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": targetUrl.origin + "/"
    };
    if (headersParam) {
      try {
        const parsed = JSON.parse(atob(headersParam));
        requestHeaders = { ...requestHeaders, ...parsed };
      } catch (e) {
        console.warn("[segment-proxy] Failed to parse headers:", e.message);
      }
    }
    try {
      const res = await fetch(targetUrlStr, { headers: requestHeaders });
      if (!res.ok) {
        return new Response(`Target segment returned status ${res.status}`, { status: res.status, headers: CORS_HEADERS });
      }
      return new Response(res.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": res.headers.get("Content-Type") || "video/mp2t",
          "Cache-Control": "public, max-age=86400"
        }
      });
    } catch (err2) {
      return new Response(`Segment proxy error: ${err2.message}`, { status: 500, headers: CORS_HEADERS });
    }
  }
  if (url.pathname.startsWith("/api/admin/scraper/")) {
    return new Response(JSON.stringify({ ok: true, streams: [], message: "Scraper endpoint is not available in production." }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  return new Response("Cinemax CF Worker Proxy is running!", {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" }
  });
}
__name(handleRequest, "handleRequest");
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
__name(json, "json");
function mapLangToSubdl(lang) {
  const map = {
    "vi": "VI",
    "en": "EN",
    "zh": "ZH",
    "ja": "JA",
    "ko": "KO",
    "fr": "FR",
    "de": "DE",
    "es": "ES",
    "pt": "PT",
    "ru": "RU",
    "ar": "AR",
    "th": "TH",
    "id": "ID"
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}
__name(mapLangToSubdl, "mapLangToSubdl");
async function fetchStremioSubtitles(addonUrl, type, imdbId, season, episode, lang) {
  const httpUrl = addonUrl.replace(/^stremio:\/\//i, "https://");
  const cleanBase = httpUrl.replace(/\/manifest\.json$/i, "").replace(/\/$/, "");
  const url = type === "movie" ? `${cleanBase}/subtitles/movie/${imdbId}.json` : `${cleanBase}/subtitles/series/${imdbId}:${season}:${episode}.json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CinemaxApp/1.0" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const map3To2 = {
      "vie": "vi",
      "eng": "en",
      "ind": "id",
      "zho": "zh",
      "chi": "zh",
      "fra": "fr",
      "deu": "de",
      "ger": "de",
      "spa": "es",
      "por": "pt",
      "rus": "ru",
      "ara": "ar",
      "tha": "th"
    };
    return (data.subtitles || []).filter((s) => {
      const sLang = (s.lang || "").toLowerCase();
      const mapped = map3To2[sLang] || sLang;
      return mapped === lang.toLowerCase() || sLang === lang.toLowerCase();
    }).map((s) => ({
      id: s.id || String(Math.random()),
      language: lang,
      name: s.name || s.g || `${lang.toUpperCase()} Subtitle (${s.id || "Stremio"})`,
      downloadUrl: s.url,
      format: s.url.endsWith(".vtt") ? "vtt" : "srt",
      hi: s.hi || false,
      rating: 0
    }));
  } catch (err2) {
    console.warn(`[sub-proxy] Stremio addon ${addonUrl} failed:`, err2.message);
    return [];
  }
}
__name(fetchStremioSubtitles, "fetchStremioSubtitles");
var REMOVE_URI_PATTERNS = [
  // KKPhim / OPhim convertv ad segment pattern
  /convertv\d*/i,
  // Original: opstream/ophim convertv pattern
  /\/v\d+\/[a-f0-9]{16,}\/segment_\d+\.ts(?:[?#].*)?$/i,
  // Ad segment with random hex token in path
  /\/[a-f0-9]{32,}\/[^/]+\.ts(?:[?#].*)?$/i,
  // Segments from paths with "ads", "advert", "commercial" keywords
  /\/(?:ads?|advert|commercial|sponsor|promo)[_\-/][^/]*\.ts(?:[?#].*)?$/i,
  // Gambling & betting ads (e.g. 9922, kubet, shbet, okvip, 789bet)
  /(?:9922|nhacai|cacuoc|kubet|shbet|okvip|789bet|new88|hi88|jun88|f8bet|bk8|w88|fun88|fb88|v9bet|ae888|mb66)/i,
  // Segments from paths matching typical gambling ad CDN structure
  /\/(?:quangcao|qc|banner)[_\-/][^/]*\.ts(?:[?#].*)?$/i
];
var AD_CDN_HOSTNAMES = /* @__PURE__ */ new Set([
  // Known ad injection CDNs for VN streaming
  "9922.com",
  "cdn-ads.vip",
  "ads.opstream.vip",
  "adstream.vip",
  "cdn-ad.net",
  "staticads.net",
  "adcdn.net",
  "stream-ads.net",
  "quangcao.net",
  "adserver.vn",
  "ads.vn",
  // Generic ad networks often injected
  "doubleclick.net",
  "googlesyndication.com",
  "adnxs.com",
  "adsrvr.org",
  "smartadserver.com",
  "rubiconproject.com",
  "openx.net",
  "pubmatic.com",
  "casalemedia.com",
  "criteo.com",
  "aniview.com",
  "springserve.com",
  "yieldmo.com"
]);
var CONVERT_PREFIX_PATTERN = /(^|\/)convertv\d+\//i;
var URI_LINE_PATTERN = /^[^#\s][^\s]*\.(?:ts|aac|m4s|fmp4)(?:[?#].*)?$/i;
var TAGS_TO_DROP_WITH_AD = /* @__PURE__ */ new Set([
  "#EXT-X-DISCONTINUITY",
  "#EXT-X-KEY"
]);
function extractHostname(urlStr) {
  try {
    if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
      return new URL(urlStr).hostname.toLowerCase();
    }
  } catch (_) {
  }
  return null;
}
__name(extractHostname, "extractHostname");
function isPlaylist(text) {
  return typeof text === "string" && text.includes("#EXTM3U") && text.includes("#EXTINF");
}
__name(isPlaylist, "isPlaylist");
function isAdUri(line) {
  const value = line.trim();
  if (CONVERT_PREFIX_PATTERN.test(value)) {
    return true;
  }
  if (REMOVE_URI_PATTERNS.some((pattern) => pattern.test(value))) return true;
  const hostname = extractHostname(value);
  if (hostname && AD_CDN_HOSTNAMES.has(hostname)) return true;
  if (hostname) {
    for (const blocked of AD_CDN_HOSTNAMES) {
      if (hostname === blocked || hostname.endsWith("." + blocked)) return true;
    }
  }
  return false;
}
__name(isAdUri, "isAdUri");
function normalizeSegmentUri(line) {
  return line.replace(CONVERT_PREFIX_PATTERN, "$1");
}
__name(normalizeSegmentUri, "normalizeSegmentUri");
function isSegmentUri(line) {
  return URI_LINE_PATTERN.test(line.trim());
}
__name(isSegmentUri, "isSegmentUri");
function isExtinf(line) {
  return line.trim().toUpperCase().startsWith("#EXTINF:");
}
__name(isExtinf, "isExtinf");
function isDropTag(line) {
  const normalized = line.trim().toUpperCase();
  for (const tag of TAGS_TO_DROP_WITH_AD) {
    if (normalized === tag || normalized.startsWith(`${tag}:`)) {
      return true;
    }
  }
  return false;
}
__name(isDropTag, "isDropTag");
function filterPlaylistAds(text, url = "") {
  if (!isPlaylist(text)) {
    return { text, removed: 0 };
  }
  const hadTrailingNewline = /\r?\n$/.test(text);
  let normalized = false;
  const lines = text.split(/\r?\n/).map((line) => {
    if (isSegmentUri(line) && CONVERT_PREFIX_PATTERN.test(line.trim())) {
      normalized = true;
      return normalizeSegmentUri(line);
    }
    return line;
  });
  const blocks = [];
  let blockStart = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (isSegmentUri(lines[index])) {
      blocks.push({
        start: blockStart,
        uriIndex: index,
        end: index,
        uri: lines[index].trim()
      });
      blockStart = index + 1;
    }
  }
  const removalRanges = [];
  for (const block of blocks) {
    if (isAdUri(block.uri, isKKPhim)) {
      let start = block.uriIndex;
      for (let index = block.uriIndex - 1; index >= block.start; index -= 1) {
        const line = lines[index];
        if (isExtinf(line) || isDropTag(line) || line.trim() === "") {
          start = index;
          continue;
        }
        break;
      }
      removalRanges.push({ start, end: block.end });
    }
  }
  if (blocks.length > 1) {
    const hostCounts = /* @__PURE__ */ new Map();
    for (const block of blocks) {
      const h = extractHostname(block.uri);
      if (h) hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
    }
    let mainHost = null;
    let maxCount = 0;
    for (const [h, count] of hostCounts) {
      if (count > maxCount) {
        mainHost = h;
        maxCount = count;
      }
    }
    const regions = [];
    let currentRegionBlocks = [];
    let regionStartLine = 0;
    let hasDiscBefore = false;
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      let discBeforeThisBlock = false;
      for (let i2 = b.start; i2 < b.uriIndex; i2++) {
        if (lines[i2].trim().toUpperCase() === "#EXT-X-DISCONTINUITY") {
          discBeforeThisBlock = true;
          break;
        }
      }
      if (discBeforeThisBlock && currentRegionBlocks.length > 0) {
        const prevBlock = currentRegionBlocks[currentRegionBlocks.length - 1];
        regions.push({
          blocks: currentRegionBlocks,
          startLine: regionStartLine,
          endLine: prevBlock.end,
          hasDiscBefore,
          hasDiscAfter: true
        });
        currentRegionBlocks = [];
        regionStartLine = b.start;
        hasDiscBefore = true;
      } else if (bi === 0) {
        hasDiscBefore = discBeforeThisBlock;
        regionStartLine = b.start;
      }
      currentRegionBlocks.push(b);
    }
    if (currentRegionBlocks.length > 0) {
      const lastBlock = currentRegionBlocks[currentRegionBlocks.length - 1];
      regions.push({
        blocks: currentRegionBlocks,
        startLine: regionStartLine,
        endLine: lastBlock.end,
        hasDiscBefore,
        hasDiscAfter: false
      });
    }
    for (const region of regions) {
      if (region.blocks.length === 0) continue;
      const isAdRegion = region.blocks.some((b) => {
        const norm = b.uri.toLowerCase();
        const segHost = extractHostname(b.uri);
        const isForeignHost = Boolean(mainHost && segHost && segHost !== mainHost);
        const matchesAdPattern = isAdUri(b.uri);
        return isForeignHost || matchesAdPattern;
      });
      if (isAdRegion && (region.hasDiscBefore || region.hasDiscAfter)) {
        for (const b of region.blocks) {
          let start = b.uriIndex;
          for (let index = b.uriIndex - 1; index >= b.start; index -= 1) {
            const line = lines[index];
            if (isExtinf(line) || isDropTag(line) || line.trim() === "") {
              start = index;
              continue;
            }
            break;
          }
          removalRanges.push({ start, end: b.end });
        }
      }
    }
  }
  if (removalRanges.length === 0) {
    if (normalized) {
      let normalizedText = lines.join("\n");
      if (hadTrailingNewline && !normalizedText.endsWith("\n")) {
        normalizedText += "\n";
      }
      return { text: normalizedText, removed: 0 };
    }
    return { text, removed: 0 };
  }
  const sorted = removalRanges.slice().sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }
  const kept = [];
  let rangeIndex = 0;
  let removed = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const range = merged[rangeIndex];
    if (range && index >= range.start && index <= range.end) {
      if (isSegmentUri(lines[index])) {
        removed += 1;
      }
      if (index === range.end) {
        rangeIndex += 1;
      }
      continue;
    }
    kept.push(lines[index]);
  }
  const compacted = [];
  let previousWasDiscontinuity = false;
  for (const line of kept) {
    const isDiscontinuity = line.trim().toUpperCase() === "#EXT-X-DISCONTINUITY";
    if (isDiscontinuity && previousWasDiscontinuity) {
      continue;
    }
    compacted.push(line);
    previousWasDiscontinuity = isDiscontinuity;
  }
  let nextText = compacted.join("\n");
  if (hadTrailingNewline && !nextText.endsWith("\n")) {
    nextText += "\n";
  }
  return { text: nextText, removed };
}
__name(filterPlaylistAds, "filterPlaylistAds");
function rewriteM3U8(content, baseUrl, referer, proxyReqUrl) {
  let filteredContent = content;
  try {
    const filterResult = filterPlaylistAds(content, baseUrl);
    if (filterResult.removed > 0) {
      console.log(`[m3u8-proxy CF] Automatically filtered out ${filterResult.removed} ad segment(s) from playlist: ${baseUrl}`);
    }
    filteredContent = filterResult.text;
  } catch (filterErr) {
    console.warn("[m3u8-proxy CF] Failed to filter ads from HLS playlist:", filterErr.message);
  }
  const baseUrlObj = new URL(baseUrl);
  const proxyBase = `${proxyReqUrl.origin}/api/m3u8-proxy`;
  const buildProxyUrl = /* @__PURE__ */ __name((absoluteUrl) => {
    const params = new URLSearchParams({
      url: absoluteUrl
    });
    if (referer) params.set("referer", referer);
    return `${proxyBase}?${params.toString()}`;
  }, "buildProxyUrl");
  const resolveUrl = /* @__PURE__ */ __name((url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("//")) {
      return `${baseUrlObj.protocol}${url}`;
    }
    if (url.startsWith("/")) {
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    }
    const base = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
    return `${base}${url}`;
  }, "resolveUrl");
  const lines = filteredContent.split("\n");
  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") && !trimmed.includes('URI="')) {
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = resolveUrl(uri);
          return `URI="${buildProxyUrl(absolute)}"`;
        });
      }
      return line;
    }
    if (!trimmed.startsWith("#")) {
      const absolute = resolveUrl(trimmed);
      const isPlaylist2 = absolute.toLowerCase().includes(".m3u8");
      if (isPlaylist2) {
        return buildProxyUrl(absolute);
      }
      return absolute;
    }
    return line;
  });
  return result.join("\n");
}
__name(rewriteM3U8, "rewriteM3U8");
var ALLANIME_HEX_MAP = {
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
  "1d": "%"
};
function decodeAllanimeUrl(encoded) {
  if (encoded.startsWith("--")) encoded = encoded.slice(2);
  let result = "";
  for (let i2 = 0; i2 < encoded.length; i2 += 2) {
    const pair = encoded.slice(i2, i2 + 2);
    result += ALLANIME_HEX_MAP[pair] !== void 0 ? ALLANIME_HEX_MAP[pair] : pair;
  }
  return result.replace(/\\u002F/gi, "/").replace(/\\\|/g, "");
}
__name(decodeAllanimeUrl, "decodeAllanimeUrl");
var ALLANIME_KEY = crypto.createHash("sha256").update("Xot36i3lK3:v1").digest();
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
      decipher.final()
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
          priority: prioMatch ? parseFloat(prioMatch[1]) : 0
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}
__name(decodeTobeparsed, "decodeTobeparsed");
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
__name(parseEpisodeSourceUrls, "parseEpisodeSourceUrls");
function sanitizeTitle(t) {
  return t.replace(/[''`´]/g, "").replace(/[:!.]/g, "").replace(/\s+/g, " ").trim();
}
__name(sanitizeTitle, "sanitizeTitle");
function anilistSeasonTitle(baseTitle, seasonNumber) {
  return new Promise(async (resolve) => {
    const resolveS1 = seasonNumber <= 1;
    const fallback = {
      title: baseTitle,
      romaji: null,
      episodes: null,
      nextTitle: null,
      nextRomaji: null
    };
    try {
      const cleanTitle = baseTitle.replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/\s*-\s*Phần\s+\d+/gi, "").replace(/\s*Phần\s+\d+/gi, "").replace(/\s*Season\s+\d+/gi, "").replace(/\s*Part\s+\d+/gi, "").replace(/\s*P\d+/gi, "").trim();
      let queryTitle = cleanTitle;
      if (seasonNumber > 1) {
        queryTitle = `${cleanTitle} ${seasonNumber}`;
      }
      const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(queryTitle)}&mediaType=ANIME&limit=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6e3);
      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
          const item = data.results[0];
          let nextTitle = null;
          let nextRomaji = null;
          if (resolveS1) {
            try {
              const nextSearchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(cleanTitle + " " + (seasonNumber + 1))}&mediaType=ANIME&limit=1`;
              const nextController = new AbortController();
              const nextTimeoutId = setTimeout(() => nextController.abort(), 4e3);
              const nextRes = await fetch(nextSearchUrl, { signal: nextController.signal });
              clearTimeout(nextTimeoutId);
              if (nextRes.ok) {
                const nextData = await nextRes.json();
                if (nextData.success && nextData.results && nextData.results.length > 0) {
                  const nextItem = nextData.results[0];
                  nextTitle = nextItem.titles?.en || nextItem.titles?.vi || null;
                  nextRomaji = nextItem.titles?.ja || null;
                }
              }
            } catch (e) {
            }
          }
          return resolve({
            title: item.titles?.en || item.titles?.vi || cleanTitle,
            romaji: item.titles?.ja || null,
            episodes: item.totalUnits || null,
            nextTitle,
            nextRomaji
          });
        }
      }
    } catch (err2) {
    }
    resolve(fallback);
  });
}
__name(anilistSeasonTitle, "anilistSeasonTitle");
var SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
var EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
var EPISODE_GQL_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";
async function allanimeGQL(variables, query) {
  const body = JSON.stringify({ variables, query });
  const res = await fetch("https://api.allanime.day/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      Referer: "https://allmanga.to",
      Origin: "https://allmanga.to"
    },
    body
  });
  const text = await res.text();
  return { status: res.status, body: text };
}
__name(allanimeGQL, "allanimeGQL");
async function allanimeGQLEpisode(variables) {
  try {
    const encodedVars = encodeURIComponent(JSON.stringify(variables));
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH }
    });
    const encodedExt = encodeURIComponent(extensions);
    const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodedExt}`;
    const res = await fetch(getUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        Referer: "https://allmanga.to",
        Origin: "https://youtu-chan.com",
        Accept: "*/*"
      }
    });
    const text = await res.text();
    if (text && text.includes("tobeparsed")) {
      return { status: res.status, body: text };
    }
  } catch (e) {
  }
  return allanimeGQL(variables, EPISODE_GQL);
}
__name(allanimeGQLEpisode, "allanimeGQLEpisode");
async function followRedirects(urlStr, maxHops = 10) {
  let url = urlStr;
  let hops = 0;
  while (hops < maxHops) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*"
        }
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc) {
          url = loc.startsWith("http") ? loc : new URL(loc, url).href;
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
__name(followRedirects, "followRedirects");
var PROVIDER_PRIORITY = ["S-mp4", "Luf-Mp4", "Yt-mp4", "Default", "Sl-Hls"];
async function trySourceUrls(sourceUrls) {
  const decodedSources = sourceUrls.filter((s) => s.sourceUrl?.startsWith("--")).map((s) => ({
    sourceName: s.sourceName || "",
    priority: s.priority || 0,
    path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json")
  })).sort((a, b) => {
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
          continue;
        }
        resolved.push({
          url: finalUrl,
          quality: "auto",
          sourceName: src.sourceName,
          isHLS: finalUrl.includes(".m3u8"),
          headers: { Referer: "https://allmanga.to" }
        });
        continue;
      }
      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*"
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
          headers: { Referer: "https://allmanga.to" }
        });
      }
    } catch {
    }
  }
  return resolved;
}
__name(trySourceUrls, "trySourceUrls");
var HARDCODED_SHOW_IDS = {
  "jojo's bizarre adventure": [
    "MeX4czvkwKGo3zdDp",
    "zyqDjR8te4z6taKyk",
    "GTAQH8Z9K6WbAdXsS",
    "JS9PzKiPanesGRvs5",
    "b6xFsr7MDSMcJArB9",
    "pwduJkjBLytqiWCvM"
  ]
};
var SPLIT_SEASONS = {
  "spy x family": {
    1: [
      { from: 1, showId: null, offset: 0 },
      { from: 13, showId: "H8Aey6QXE7HSqwvW3", offset: 12 }
    ]
  }
};
async function resolveEpisodeFromId(showId, epStr, dubSub) {
  const candidates = [epStr];
  if (!epStr.includes(".")) candidates.push(epStr + ".0");
  let sourceUrls = null;
  for (const attempt of candidates) {
    const epRes = await allanimeGQLEpisode({
      showId,
      translationType: dubSub,
      episodeString: attempt
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
__name(resolveEpisodeFromId, "resolveEpisodeFromId");
var HIANIME_DOMAINS = ["hianime.to", "hianime.mn", "hianime.cv"];
async function fetchHiAnime(path) {
  let lastError = null;
  for (const domain of HIANIME_DOMAINS) {
    const url = `https://${domain}${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Referer": `https://${domain}/`,
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      if (res.ok) return await res.json();
    } catch (err2) {
      console.warn(`[anime-stream] Failed to fetch from ${domain}:`, err2.message);
      lastError = err2;
    }
  }
  throw lastError || new Error("Failed to fetch from all HiAnime domains");
}
__name(fetchHiAnime, "fetchHiAnime");
async function resolveAnimeIdFromTitle(title) {
  try {
    const searchUrl = `/ajax/search/suggest?keyword=${encodeURIComponent(title)}`;
    const suggestionsJson = await fetchHiAnime(searchUrl);
    if (!suggestionsJson || !suggestionsJson.html) return null;
    const html = suggestionsJson.html;
    const matchRegex = /<a\s+[^>]*class="[^"]*nav-item[^"]*"[^>]*href="\/([^"?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const nameRegex = /<div\s+[^>]*class="[^"]*film-name[^"]*"\s*(?:data-jname="([^"]*)")?[^>]*>([\s\S]*?)<\/div>/;
    const candidates = [];
    for (const match of html.matchAll(matchRegex)) {
      const href = match[1];
      const innerHtml = match[2];
      const nameMatch = innerHtml.match(nameRegex);
      if (nameMatch) {
        const jName = (nameMatch[1] || "").trim();
        const enName = nameMatch[2].replace(/<[^>]*>/g, "").trim();
        candidates.push({
          id: href,
          enName,
          jName
        });
      }
    }
    if (candidates.length === 0) return null;
    const clean = /* @__PURE__ */ __name((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""), "clean");
    const targetClean = clean(title);
    let bestMatch = candidates.find((c) => clean(c.enName) === targetClean || clean(c.jName) === targetClean);
    if (!bestMatch) {
      bestMatch = candidates[0];
    }
    return bestMatch.id;
  } catch (err2) {
    console.error("[anime-stream] Error resolving anime ID from title:", err2.message);
    return null;
  }
}
__name(resolveAnimeIdFromTitle, "resolveAnimeIdFromTitle");
async function resolveEpisodeIdFromShow(showId, episodeNumber) {
  try {
    const numericShowId = showId.split("-").pop();
    const listUrl = `/ajax/v2/episode/list/${numericShowId}`;
    const listJson = await fetchHiAnime(listUrl);
    if (!listJson || !listJson.html) return null;
    const html = listJson.html;
    const epRegex = /<a\s+[^>]*href="([^"]+)"[^>]*data-number="([^"]+)"[^>]*>/g;
    for (const match of html.matchAll(epRegex)) {
      const href = match[1];
      const numStr = match[2];
      if (parseFloat(numStr) === parseFloat(episodeNumber)) {
        return href.replace(/^\/watch\//, "").replace(/^\//, "");
      }
    }
    return null;
  } catch (err2) {
    console.error("[anime-stream] Error resolving episode ID:", err2.message);
    return null;
  }
}
__name(resolveEpisodeIdFromShow, "resolveEpisodeIdFromShow");
function deriveKeyAndIV(password, salt) {
  const passwordBuffer = Buffer.from(password, "utf8");
  let keyAndIV = Buffer.alloc(0);
  let currentHash = Buffer.alloc(0);
  while (keyAndIV.length < 48) {
    const hash = crypto.createHash("md5");
    hash.update(Buffer.concat([currentHash, passwordBuffer, salt]));
    currentHash = hash.digest();
    keyAndIV = Buffer.concat([keyAndIV, currentHash]);
  }
  return {
    key: keyAndIV.slice(0, 32),
    iv: keyAndIV.slice(32, 48)
  };
}
__name(deriveKeyAndIV, "deriveKeyAndIV");
function decryptAes256Cbc(encryptedBase64, passphrase) {
  const ciphertextBytes = Buffer.from(encryptedBase64, "base64");
  if (ciphertextBytes.slice(0, 8).toString("ascii") !== "Salted__") {
    throw new Error("Invalid CryptoJS/OpenSSL ciphertext (missing Salted__ prefix)");
  }
  const salt = ciphertextBytes.slice(8, 16);
  const ciphertext = ciphertextBytes.slice(16);
  const { key, iv } = deriveKeyAndIV(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
__name(decryptAes256Cbc, "decryptAes256Cbc");
function xorDecrypt(a, P) {
  try {
    for (let i2 = 0; i2 < a.length; i2++) {
      a[i2] = a[i2] ^ P[i2 % P.length];
    }
  } catch (err2) {
    return null;
  }
}
__name(xorDecrypt, "xorDecrypt");
var megacloudWasmCache = null;
async function getMegacloudWasm(url) {
  if (megacloudWasmCache) return megacloudWasmCache;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok) throw new Error("Failed to fetch WASM loading.png");
  const bytes = await res.arrayBuffer();
  megacloudWasmCache = {
    module: await WebAssembly.compile(bytes),
    bytes: new Uint8Array(bytes)
  };
  return megacloudWasmCache;
}
__name(getMegacloudWasm, "getMegacloudWasm");
var MegacloudDecryptor = class {
  static {
    __name(this, "MegacloudDecryptor");
  }
  constructor(wasmModule, wasmBytes, embedUrl, imagePixels) {
    this.wasmModule = wasmModule;
    this.wasmBytes = wasmBytes;
    this.embedUrl = embedUrl;
    this.imagePixels = imagePixels;
    this.wasm = null;
    this.arr = new Array(128).fill(void 0);
    this.arr.push(void 0, null, true, false);
    this.pointer = this.arr.length;
    this.memoryBuff = null;
    this.dataView = null;
    this.size = 0;
    this.dateNow = Date.now();
    this.meta = { content: null };
    this.image_data = {
      height: 50,
      width: 65,
      data: imagePixels
    };
    const base_url = new URL(embedUrl).origin;
    this.canvas = {
      baseUrl: base_url,
      width: 0,
      height: 0,
      style: {
        style: {
          display: "inline"
        }
      },
      context2d: {}
    };
    const user_agent = "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";
    this.fake_window = {
      localStorage: {
        setItem: /* @__PURE__ */ __name((item, value) => {
          this.fake_window.localStorage[item] = value;
        }, "setItem")
      },
      navigator: {
        webdriver: false,
        userAgent: user_agent
      },
      length: 0,
      document: {
        cookie: ""
      },
      origin: base_url,
      location: {
        href: embedUrl,
        origin: base_url
      },
      performance: {
        timeOrigin: this.dateNow
      },
      xrax: embedUrl.split("/").pop().split("?").shift(),
      c: false,
      G: embedUrl.split("/").pop().split("?").shift(),
      z: /* @__PURE__ */ __name((a) => {
        return [
          (4278190080 & a) >> 24,
          (16711680 & a) >> 16,
          (65280 & a) >> 8,
          255 & a
        ];
      }, "z"),
      crypto: globalThis.crypto,
      msCrypto: globalThis.crypto,
      browser_version: 1676800512
    };
    this.nodeList = {
      image: {
        src: base_url + "/images/image.png?v=0.0.9",
        height: 50,
        width: 65,
        complete: true
      },
      context2d: {},
      length: 1
    };
  }
  get(index) {
    return this.arr[index];
  }
  getMemBuff() {
    return this.memoryBuff = this.memoryBuff !== null && this.memoryBuff.byteLength !== 0 ? this.memoryBuff : new Uint8Array(this.wasm.memory.buffer);
  }
  getDataView() {
    return this.dataView = this.dataView === null || this.dataView.byteLength === 0 || this.dataView.buffer !== this.wasm.memory.buffer ? new DataView(this.wasm.memory.buffer) : this.dataView;
  }
  addToStack(item) {
    if (this.pointer === this.arr.length) this.arr.push(this.arr.length + 1);
    const Qn = this.pointer;
    this.pointer = this.arr[Qn];
    this.arr[Qn] = item;
    return Qn;
  }
  shift(QP) {
    if (QP >= 132) {
      this.arr[QP] = this.pointer;
      this.pointer = QP;
    }
  }
  shiftGet(QP) {
    const Qn = this.get(QP);
    this.shift(QP);
    return Qn;
  }
  decodeSub(index, offset) {
    index >>>= 0;
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    return decoder.decode(this.getMemBuff().subarray(index, index + offset));
  }
  parse(text, func, func2) {
    const encoder = new TextEncoder();
    if (func2 === void 0) {
      const encoded = encoder.encode(text);
      const parsedIndex = func(encoded.length, 1) >>> 0;
      this.getMemBuff().subarray(parsedIndex, parsedIndex + encoded.length).set(encoded);
      this.size = encoded.length;
      return parsedIndex;
    }
    let len = text.length;
    let parsedLen = func(len, 1) >>> 0;
    const new_arr = this.getMemBuff();
    let i2 = 0;
    for (; i2 < len; i2++) {
      const char = text.charCodeAt(i2);
      if (char > 127) break;
      new_arr[parsedLen + i2] = char;
    }
    if (i2 !== len) {
      if (i2 !== 0) text = text.slice(i2);
      parsedLen = func2(parsedLen, len, len = i2 + 3 * text.length, 1) >>> 0;
      const encoded = this.getMemBuff().subarray(parsedLen + i2, parsedLen + len);
      i2 += encoder.encodeInto(text, encoded).written;
      parsedLen = func2(parsedLen, len, i2, 1) >>> 0;
    }
    this.size = i2;
    return parsedLen;
  }
  args(QP, Qn, QT, func) {
    const Qx = {
      a: QP,
      b: Qn,
      cnt: 1,
      dtor: QT
    };
    const bound = /* @__PURE__ */ __name((...Qw) => {
      Qx.cnt++;
      try {
        return func(Qx.a, Qx.b, ...Qw);
      } finally {
        if (--Qx.cnt === 0) {
          this.wasm.__wbindgen_export_2.get(Qx.dtor)(Qx.a, Qx.b);
          Qx.a = 0;
        }
      }
    }, "bound");
    bound.original = Qx;
    return bound;
  }
  applyToWindow(func, args) {
    try {
      return func.apply(this.fake_window, args);
    } catch (error) {
      this.wasm.__wbindgen_export_6(this.addToStack(error));
    }
  }
  Qj(QP, Qn) {
    Qn = Qn(+QP.length, 1) >>> 0;
    this.getMemBuff().set(QP, Qn);
    this.size = QP.length;
    return Qn;
  }
  async runChallenge() {
    const imports = {
      wbg: {
        __wbindgen_is_function: /* @__PURE__ */ __name((index) => typeof this.get(index) === "function", "__wbindgen_is_function"),
        __wbindgen_is_string: /* @__PURE__ */ __name((index) => typeof this.get(index) === "string", "__wbindgen_is_string"),
        __wbindgen_is_object: /* @__PURE__ */ __name((index) => {
          const obj = this.get(index);
          return typeof obj === "object" && obj !== null;
        }, "__wbindgen_is_object"),
        __wbindgen_number_get: /* @__PURE__ */ __name((offset, index) => {
          const number = this.get(index);
          this.getDataView().setFloat64(offset + 8, number === null || number === void 0 ? 0 : number, true);
          this.getDataView().setInt32(offset, number === null || number === void 0 ? 0 : 1, true);
        }, "__wbindgen_number_get"),
        __wbindgen_string_get: /* @__PURE__ */ __name((offset, index) => {
          const str = this.get(index);
          const val = this.parse(str, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, val, true);
        }, "__wbindgen_string_get"),
        __wbindgen_object_drop_ref: /* @__PURE__ */ __name((index) => {
          this.shiftGet(index);
        }, "__wbindgen_object_drop_ref"),
        __wbindgen_cb_drop: /* @__PURE__ */ __name((index) => {
          const org = this.shiftGet(index).original;
          return org.cnt-- === 1 && !(org.a = 0);
        }, "__wbindgen_cb_drop"),
        __wbindgen_string_new: /* @__PURE__ */ __name((index, offset) => this.addToStack(this.decodeSub(index, offset)), "__wbindgen_string_new"),
        __wbindgen_is_null: /* @__PURE__ */ __name((index) => this.get(index) === null, "__wbindgen_is_null"),
        __wbindgen_is_undefined: /* @__PURE__ */ __name((index) => this.get(index) === void 0, "__wbindgen_is_undefined"),
        __wbindgen_boolean_get: /* @__PURE__ */ __name((index) => {
          const bool = this.get(index);
          return typeof bool === "boolean" ? bool ? 1 : 0 : 2;
        }, "__wbindgen_boolean_get"),
        __wbg_instanceof_CanvasRenderingContext2d_4ec30ddd3f29f8f9: /* @__PURE__ */ __name(() => true, "__wbg_instanceof_CanvasRenderingContext2d_4ec30ddd3f29f8f9"),
        __wbg_subarray_adc418253d76e2f1: /* @__PURE__ */ __name((index, num1, num2) => this.addToStack(this.get(index).subarray(num1 >>> 0, num2 >>> 0)), "__wbg_subarray_adc418253d76e2f1"),
        __wbg_randomFillSync_5c9c955aa56b6049: /* @__PURE__ */ __name(() => {
        }, "__wbg_randomFillSync_5c9c955aa56b6049"),
        __wbg_getRandomValues_3aa56aa6edec874c: /* @__PURE__ */ __name((index1, index2) => {
          this.get(index1).getRandomValues(this.get(index2));
        }, "__wbg_getRandomValues_3aa56aa6edec874c"),
        __wbg_msCrypto_eb05e62b530a1508: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).msCrypto), "__wbg_msCrypto_eb05e62b530a1508"),
        __wbg_toString_6eb7c1f755c00453: /* @__PURE__ */ __name(() => this.addToStack("[object Storage]"), "__wbg_toString_6eb7c1f755c00453"),
        __wbg_toString_139023ab33acec36: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).toString()), "__wbg_toString_139023ab33acec36"),
        __wbg_require_cca90b1a94a0255b: /* @__PURE__ */ __name(() => {
          throw new Error("require is not supported at the Edge");
        }, "__wbg_require_cca90b1a94a0255b"),
        __wbg_crypto_1d1f22824a6a080c: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).crypto), "__wbg_crypto_1d1f22824a6a080c"),
        __wbg_process_4a72847cc503995b: /* @__PURE__ */ __name(() => {
          return this.addToStack({ versions: { node: "edge" } });
        }, "__wbg_process_4a72847cc503995b"),
        __wbg_versions_f686565e586dd935: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).versions), "__wbg_versions_f686565e586dd935"),
        __wbg_node_104a2ff8d6ea03a2: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).node), "__wbg_node_104a2ff8d6ea03a2"),
        __wbg_localStorage_3d538af21ea07fcc: /* @__PURE__ */ __name(() => this.addToStack(this.fake_window.localStorage), "__wbg_localStorage_3d538af21ea07fcc"),
        __wbg_setfillStyle_59f426135f52910f: /* @__PURE__ */ __name(() => {
        }, "__wbg_setfillStyle_59f426135f52910f"),
        __wbg_setshadowBlur_229c56539d02f401: /* @__PURE__ */ __name(() => {
        }, "__wbg_setshadowBlur_229c56539d02f401"),
        __wbg_setshadowColor_340d5290cdc4ae9d: /* @__PURE__ */ __name(() => {
        }, "__wbg_setshadowColor_340d5290cdc4ae9d"),
        __wbg_setfont_16d6e31e06a420a5: /* @__PURE__ */ __name(() => {
        }, "__wbg_setfont_16d6e31e06a420a5"),
        __wbg_settextBaseline_c3266d3bd4a6695c: /* @__PURE__ */ __name(() => {
        }, "__wbg_settextBaseline_c3266d3bd4a6695c"),
        __wbg_drawImage_cb13768a1bdc04bd: /* @__PURE__ */ __name(() => {
        }, "__wbg_drawImage_cb13768a1bdc04bd"),
        __wbg_getImageData_66269d289f37d3c7: /* @__PURE__ */ __name(() => this.addToStack(this.image_data), "__wbg_getImageData_66269d289f37d3c7"),
        __wbg_rect_2fa1df87ef638738: /* @__PURE__ */ __name(() => {
        }, "__wbg_rect_2fa1df87ef638738"),
        __wbg_fillRect_4dd28e628381d240: /* @__PURE__ */ __name(() => {
        }, "__wbg_fillRect_4dd28e628381d240"),
        __wbg_fillText_07e5da9e41652f20: /* @__PURE__ */ __name(() => {
        }, "__wbg_fillText_07e5da9e41652f20"),
        __wbg_setProperty_5144ddce66bbde41: /* @__PURE__ */ __name(() => {
        }, "__wbg_setProperty_5144ddce66bbde41"),
        __wbg_createElement_03cf347ddad1c8c0: /* @__PURE__ */ __name(() => this.addToStack(this.canvas), "__wbg_createElement_03cf347ddad1c8c0"),
        __wbg_querySelector_118a0639aa1f51cd: /* @__PURE__ */ __name(() => this.addToStack(this.meta), "__wbg_querySelector_118a0639aa1f51cd"),
        __wbg_querySelectorAll_50c79cd4f7573825: /* @__PURE__ */ __name(() => this.addToStack(this.nodeList), "__wbg_querySelectorAll_50c79cd4f7573825"),
        __wbg_getAttribute_706ae88bd37410fa: /* @__PURE__ */ __name((offset) => {
          const attr = this.meta.content;
          const todo = attr === null || attr === void 0 ? 0 : this.parse(attr, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, todo, true);
        }, "__wbg_getAttribute_706ae88bd37410fa"),
        __wbg_target_6795373f170fd786: /* @__PURE__ */ __name((index) => {
          const target = this.get(index).target;
          return target === null || target === void 0 ? 0 : this.addToStack(target);
        }, "__wbg_target_6795373f170fd786"),
        __wbg_addEventListener_f984e99465a6a7f4: /* @__PURE__ */ __name(() => {
        }, "__wbg_addEventListener_f984e99465a6a7f4"),
        __wbg_instanceof_HtmlCanvasElement_1e81f71f630e46bc: /* @__PURE__ */ __name(() => true, "__wbg_instanceof_HtmlCanvasElement_1e81f71f630e46bc"),
        __wbg_setwidth_233645b297bb3318: /* @__PURE__ */ __name((index, set) => {
          this.get(index).width = set >>> 0;
        }, "__wbg_setwidth_233645b297bb3318"),
        __wbg_setheight_fcb491cf54e3527c: /* @__PURE__ */ __name((index, set) => {
          this.get(index).height = set >>> 0;
        }, "__wbg_setheight_fcb491cf54e3527c"),
        __wbg_getContext_dfc91ab0837db1d1: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).context2d), "__wbg_getContext_dfc91ab0837db1d1"),
        __wbg_toDataURL_97b108dd1a4b7454: /* @__PURE__ */ __name((offset) => {
          const dataURL = "data:image/png;base64,challenge-skipped";
          const _dataUrl = this.parse(dataURL, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, _dataUrl, true);
        }, "__wbg_toDataURL_97b108dd1a4b7454"),
        __wbg_instanceof_HtmlDocument_1100f8a983ca79f9: /* @__PURE__ */ __name(() => true, "__wbg_instanceof_HtmlDocument_1100f8a983ca79f9"),
        __wbg_style_ca229e3326b3c3fb: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).style), "__wbg_style_ca229e3326b3c3fb"),
        __wbg_instanceof_HtmlImageElement_9c82d4e3651a8533: /* @__PURE__ */ __name(() => true, "__wbg_instanceof_HtmlImageElement_9c82d4e3651a8533"),
        __wbg_src_87a0e38af6229364: /* @__PURE__ */ __name((offset, index) => {
          const _src = this.parse(this.get(index).src, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, _src, true);
        }, "__wbg_src_87a0e38af6229364"),
        __wbg_width_e1a38bdd483e1283: /* @__PURE__ */ __name((index) => this.get(index).width, "__wbg_width_e1a38bdd483e1283"),
        __wbg_height_e4cc2294187313c9: /* @__PURE__ */ __name((index) => this.get(index).height, "__wbg_height_e4cc2294187313c9"),
        __wbg_complete_1162c2697406af11: /* @__PURE__ */ __name((index) => this.get(index).complete, "__wbg_complete_1162c2697406af11"),
        __wbg_data_d34dc554f90b8652: /* @__PURE__ */ __name((offset, index) => {
          const _data = this.Qj(this.get(index).data, this.wasm.__wbindgen_export_0);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, _data, true);
        }, "__wbg_data_d34dc554f90b8652"),
        __wbg_origin_305402044aa148ce: /* @__PURE__ */ __name((offset, index) => {
          const _origin = this.parse(this.get(index).origin, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, _origin, true);
        }, "__wbg_origin_305402044aa148ce"),
        __wbg_length_8a9352f7b7360c37: /* @__PURE__ */ __name((index) => this.get(index).length, "__wbg_length_8a9352f7b7360c37"),
        __wbg_get_c30ae0782d86747f: /* @__PURE__ */ __name((index) => {
          const _image = this.get(index).image;
          return _image === null || _image === void 0 ? 0 : this.addToStack(_image);
        }, "__wbg_get_c30ae0782d86747f"),
        __wbg_timeOrigin_f462952854d802ec: /* @__PURE__ */ __name((index) => this.get(index).timeOrigin, "__wbg_timeOrigin_f462952854d802ec"),
        __wbg_instanceof_Window_cee7a886d55e7df5: /* @__PURE__ */ __name(() => true, "__wbg_instanceof_Window_cee7a886d55e7df5"),
        __wbg_document_eb7fd66bde3ee213: /* @__PURE__ */ __name((index) => {
          const _document = this.get(index).document;
          return _document === null || _document === void 0 ? 0 : this.addToStack(_document);
        }, "__wbg_document_eb7fd66bde3ee213"),
        __wbg_location_b17760ac7977a47a: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).location), "__wbg_location_b17760ac7977a47a"),
        __wbg_performance_4ca1873776fdb3d2: /* @__PURE__ */ __name((index) => {
          const _performance = this.get(index).performance;
          return _performance === null || _performance === void 0 ? 0 : this.addToStack(_performance);
        }, "__wbg_performance_4ca1873776fdb3d2"),
        __wbg_origin_e1f8acdeb3a39a2b: /* @__PURE__ */ __name((offset, index) => {
          const _origin = this.parse(this.get(index).origin, this.wasm.__wbindgen_export_0, this.wasm.__wbindgen_export_1);
          this.getDataView().setInt32(offset + 4, this.size, true);
          this.getDataView().setInt32(offset, _origin, true);
        }, "__wbg_origin_e1f8acdeb3a39a2b"),
        __wbg_get_8986951b1ee310e0: /* @__PURE__ */ __name((index, decode1, decode2) => {
          const data = this.get(index)[this.decodeSub(decode1, decode2)];
          return data === null || data === void 0 ? 0 : this.addToStack(data);
        }, "__wbg_get_8986951b1ee310e0"),
        __wbg_setTimeout_6ed7182ebad5d297: /* @__PURE__ */ __name(() => 7, "__wbg_setTimeout_6ed7182ebad5d297"),
        __wbg_self_05040bd9523805b9: /* @__PURE__ */ __name(() => this.addToStack(this.fake_window), "__wbg_self_05040bd9523805b9"),
        __wbg_window_adc720039f2cb14f: /* @__PURE__ */ __name(() => this.addToStack(this.fake_window), "__wbg_window_adc720039f2cb14f"),
        __wbg_globalThis_622105db80c1457d: /* @__PURE__ */ __name(() => this.addToStack(this.fake_window), "__wbg_globalThis_622105db80c1457d"),
        __wbg_global_f56b013ed9bcf359: /* @__PURE__ */ __name(() => this.addToStack(this.fake_window), "__wbg_global_f56b013ed9bcf359"),
        __wbg_newnoargs_cfecb3965268594c: /* @__PURE__ */ __name((index, offset) => this.addToStack(new Function(this.decodeSub(index, offset))), "__wbg_newnoargs_cfecb3965268594c"),
        __wbindgen_object_clone_ref: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index)), "__wbindgen_object_clone_ref"),
        __wbg_eval_c824e170787ad184: /* @__PURE__ */ __name((index, offset) => {
          const script = this.decodeSub(index, offset);
          try {
            const fn = new Function("window", "self", "globalThis", `return (${script})`);
            const res = fn(this.fake_window, this.fake_window, this.fake_window);
            return this.addToStack(res);
          } catch (e) {
            console.error("Eval error on script:", script, e);
            return this.addToStack(null);
          }
        }, "__wbg_eval_c824e170787ad184"),
        __wbg_call_3f093dd26d5569f8: /* @__PURE__ */ __name((index, index2) => this.addToStack(this.get(index).call(this.get(index2))), "__wbg_call_3f093dd26d5569f8"),
        __wbg_call_67f2111acd2dfdb6: /* @__PURE__ */ __name((index, index2, index3) => this.addToStack(this.get(index).call(this.get(index2), this.get(index3))), "__wbg_call_67f2111acd2dfdb6"),
        __wbg_set_961700853a212a39: /* @__PURE__ */ __name((index, index2, index3) => Reflect.set(this.get(index), this.get(index2), this.get(index3)), "__wbg_set_961700853a212a39"),
        __wbg_buffer_b914fb8b50ebbc3e: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).buffer), "__wbg_buffer_b914fb8b50ebbc3e"),
        __wbg_newwithbyteoffsetandlength_0de9ee56e9f6ee6e: /* @__PURE__ */ __name((index, val, val2) => this.addToStack(new Uint8Array(this.get(index), val >>> 0, val2 >>> 0)), "__wbg_newwithbyteoffsetandlength_0de9ee56e9f6ee6e"),
        __wbg_newwithlength_0d03cef43b68a530: /* @__PURE__ */ __name((length) => this.addToStack(new Uint8Array(length >>> 0)), "__wbg_newwithlength_0d03cef43b68a530"),
        __wbg_new_b1f2d6842d615181: /* @__PURE__ */ __name((index) => this.addToStack(new Uint8Array(this.get(index))), "__wbg_new_b1f2d6842d615181"),
        __wbg_buffer_67e624f5a0ab2319: /* @__PURE__ */ __name((index) => this.addToStack(this.get(index).buffer), "__wbg_buffer_67e624f5a0ab2319"),
        __wbg_length_21c4b0ae73cba59d: /* @__PURE__ */ __name((index) => this.get(index).length, "__wbg_length_21c4b0ae73cba59d"),
        __wbg_set_7d988c98e6ced92d: /* @__PURE__ */ __name((index, index2, val) => {
          this.get(index).set(this.get(index2), val >>> 0);
        }, "__wbg_set_7d988c98e6ced92d"),
        __wbindgen_debug_string: /* @__PURE__ */ __name(() => {
        }, "__wbindgen_debug_string"),
        __wbindgen_throw: /* @__PURE__ */ __name((index, offset) => {
          throw new Error(this.decodeSub(index, offset));
        }, "__wbindgen_throw"),
        __wbindgen_memory: /* @__PURE__ */ __name(() => this.addToStack(this.wasm.memory), "__wbindgen_memory"),
        __wbindgen_closure_wrapper117: /* @__PURE__ */ __name((Qn, QT) => this.addToStack(this.args(Qn, QT, 2, (QP, Qn2) => this.shiftGet(this.wasm.__wbindgen_export_3(QP, Qn2)))), "__wbindgen_closure_wrapper117"),
        __wbindgen_closure_wrapper119: /* @__PURE__ */ __name((Qn, QT) => this.addToStack(this.args(Qn, QT, 2, (Qy, QO, QX) => this.wasm.__wbindgen_export_4(Qy, QO, this.addToStack(QX)))), "__wbindgen_closure_wrapper119"),
        __wbindgen_closure_wrapper121: /* @__PURE__ */ __name((Qn, QT) => this.addToStack(this.args(Qn, QT, 2, (QP, Qn2) => this.wasm.__wbindgen_export_5(QP, Qn2))), "__wbindgen_closure_wrapper121"),
        __wbindgen_closure_wrapper123: /* @__PURE__ */ __name((Qn, QT) => this.addToStack(this.args(Qn, QT, 9, (Qy, QO, QX) => this.wasm.__wbindgen_export_4(Qy, QO, this.addToStack(QX)))), "__wbindgen_closure_wrapper123")
      }
    };
    const instance = await WebAssembly.instantiate(this.wasmModule, imports);
    this.wasm = instance.exports;
    this.memoryBuff = null;
    this.dataView = null;
    this.wasm.groot();
    this.fake_window.bytes = this.wasmBytes;
    if (this.fake_window.jwt_plugin) {
      this.fake_window.jwt_plugin(this.wasmBytes);
    }
    if (this.fake_window.navigate) {
      return this.fake_window.navigate();
    }
    return this.wasmBytes;
  }
};
async function decryptMegaCloudSource(embedUrl) {
  const urlObj = new URL(embedUrl);
  const base_url = urlObj.origin;
  const embedPath = urlObj.pathname;
  const embedId = embedPath.split("/").pop();
  const embedPageRes = await fetch(embedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      "Referer": "https://hianime.to/"
    }
  });
  if (!embedPageRes.ok) throw new Error(`Failed to fetch embed page: ${embedPageRes.status}`);
  const html = await embedPageRes.text();
  const contentMatch = html.match(/name=["']j_crt["']\s+content=["']([^"']*)["']/i) || html.match(/content=["']([^"']*)["']\s+name=["']j_crt["']/i);
  if (!contentMatch) throw new Error("Could not find j_crt token in embed page");
  const jCrtContent = contentMatch[1] + "==";
  const wasmUrl = `${base_url}/images/loading.png?v=0.0.9`;
  const wasmCached = await getMegacloudWasm(wasmUrl);
  const pixelBytes = Buffer.from(STATIC_PNG_PIXELS_BASE64, "base64");
  const imagePixels = new Uint8ClampedArray(pixelBytes);
  const decryptor = new MegacloudDecryptor(wasmCached.module, wasmCached.bytes, embedUrl, imagePixels);
  decryptor.meta.content = jCrtContent;
  let challengeResult = await decryptor.runChallenge();
  const pathParts = embedPath.split("/");
  let getSourcesUrl = "";
  const browser_version = 1676800512;
  if (base_url.includes("mega")) {
    getSourcesUrl = `${base_url}/${pathParts[1]}/ajax/${pathParts[2]}/getSources?id=${decryptor.fake_window.pid}&v=${decryptor.fake_window.localStorage.kversion}&h=${decryptor.fake_window.localStorage.kid}&b=${browser_version}`;
  } else {
    getSourcesUrl = `${base_url}/ajax/${pathParts[1]}/getSources?id=${decryptor.fake_window.pid}&v=${decryptor.fake_window.localStorage.kversion}&h=${decryptor.fake_window.localStorage.kid}&b=${browser_version}`;
  }
  console.log(`[anime-stream] getSources URL: ${getSourcesUrl}`);
  const getSourcesRes = await fetch(getSourcesUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": embedUrl + "&autoPlay=1&oa=0&asi=1",
      "Accept-Language": "en,bn;q=0.9,en-US;q=0.8",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Site": "same-origin",
      "X-Requested-With": "XMLHttpRequest",
      "Sec-Fetch-Mode": "cors"
    }
  });
  if (!getSourcesRes.ok) throw new Error(`getSources AJAX failed with status ${getSourcesRes.status}`);
  const resp = await getSourcesRes.json();
  const kversion = decryptor.fake_window.localStorage.kversion;
  const keyDerivationSalt = decryptor.fake_window.z(kversion);
  const challengeBytes = new Uint8Array(challengeResult);
  let decryptionKeyBytes;
  if (resp.t !== 0) {
    xorDecrypt(challengeBytes, keyDerivationSalt);
    decryptionKeyBytes = challengeBytes;
  } else {
    const rawK = resp.k;
    const kBytes = new Uint8Array(Buffer.from(rawK, "utf8"));
    xorDecrypt(kBytes, keyDerivationSalt);
    decryptionKeyBytes = kBytes;
  }
  const passphraseString = Buffer.from(decryptionKeyBytes).toString("base64");
  const decryptedText = decryptAes256Cbc(resp.sources, passphraseString);
  const decryptedSources = JSON.parse(decryptedText);
  return {
    link: decryptedSources[0],
    tracks: resp.tracks || [],
    intro: resp.intro || null,
    outro: resp.outro || null,
    server: base_url.includes("mega") ? "MegaCloud" : "RapidCloud",
    iframe: embedUrl
  };
}
__name(decryptMegaCloudSource, "decryptMegaCloudSource");
async function getHiAnimeDecryptedSource(episodeId, env) {
  const cacheKey = `anime_decrypted_source_${episodeId}`;
  if (typeof env.MOVIE_CACHE !== "undefined") {
    try {
      const cached = await env.MOVIE_CACHE.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("[getHiAnimeDecryptedSource] Cache read error:", e.message);
    }
  }
  const epIdOnly = episodeId.split("?ep=").pop();
  const serversJson = await fetchHiAnime(`/ajax/v2/episode/servers?episodeId=${epIdOnly}`);
  if (!serversJson || !serversJson.html) {
    throw new Error("Servers HTML not found");
  }
  const servers = [];
  const divRegex = /<div\s+[^>]*class="[^"]*server-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  for (const divMatch of serversJson.html.matchAll(divRegex)) {
    const innerHtml = divMatch[0];
    const idMatch = innerHtml.match(/data-id="([^"]+)"/);
    const serverIdMatch = innerHtml.match(/data-server-id="([^"]+)"/);
    const typeMatch = innerHtml.match(/data-type="([^"]+)"/);
    const aMatch = innerHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (idMatch && serverIdMatch && typeMatch && aMatch) {
      servers.push({
        data_id: idMatch[1],
        server_id: serverIdMatch[1],
        type: typeMatch[1],
        name: aMatch[1].replace(/<[^>]*>/g, "").trim()
      });
    }
  }
  if (servers.length === 0) {
    throw new Error("No servers available for this episode");
  }
  let activeServer = servers.find((s) => s.type === "sub" && (s.name.toLowerCase() === "megacloud" || s.server_id === "4"));
  if (!activeServer) {
    activeServer = servers.find((s) => s.name.toLowerCase() === "megacloud" || s.server_id === "4");
  }
  if (!activeServer) {
    activeServer = servers.find((s) => s.type === "sub") || servers[0];
  }
  const sourcesJson = await fetchHiAnime(`/ajax/v2/episode/sources?id=${activeServer.data_id}`);
  if (!sourcesJson || !sourcesJson.link) {
    throw new Error("Sources link not found");
  }
  const embedUrl = sourcesJson.link;
  let streamResult;
  if (activeServer.name.toLowerCase() === "megacloud" || activeServer.server_id === "4" || embedUrl.includes("megacloud") || embedUrl.includes("rapidcloud")) {
    streamResult = await decryptMegaCloudSource(embedUrl);
  } else {
    streamResult = {
      link: { file: embedUrl, type: "embed" },
      tracks: [],
      server: activeServer.name,
      iframe: embedUrl
    };
  }
  if (streamResult && typeof env.MOVIE_CACHE !== "undefined") {
    try {
      await env.MOVIE_CACHE.put(cacheKey, JSON.stringify(streamResult), { expirationTtl: 3600 });
    } catch (e) {
      console.warn("[getHiAnimeDecryptedSource] Cache write error:", e.message);
    }
  }
  return streamResult;
}
__name(getHiAnimeDecryptedSource, "getHiAnimeDecryptedSource");
function parseVttCues(vttText) {
  const lines = vttText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const cues = [];
  let headerLines = [];
  let firstCueIndex = -1;
  for (let j = 0; j < lines.length; j++) {
    if (lines[j].includes("-->")) {
      if (j > 0 && lines[j - 1].trim() !== "" && !lines[j - 1].includes("WEBVTT") && !lines[j - 1].includes(":")) {
        firstCueIndex = j - 1;
      } else {
        firstCueIndex = j;
      }
      break;
    }
  }
  if (firstCueIndex === -1) {
    return { header: vttText, cues: [] };
  }
  headerLines = lines.slice(0, firstCueIndex);
  const header = headerLines.join("\n");
  let currentCue = null;
  let i2 = firstCueIndex;
  while (i2 < lines.length) {
    const line = lines[i2];
    if (line.includes("-->")) {
      if (currentCue) {
        cues.push(currentCue);
      }
      let id = "";
      if (i2 > 0 && lines[i2 - 1].trim() !== "") {
        if (i2 - 2 < firstCueIndex || lines[i2 - 2].trim() === "") {
          id = lines[i2 - 1].trim();
        }
      }
      currentCue = {
        id,
        timestamp: line.trim(),
        textLines: []
      };
      i2++;
      continue;
    }
    if (currentCue) {
      if (line.trim() === "") {
        cues.push(currentCue);
        currentCue = null;
      } else {
        const isNextLineTimestamp = i2 + 1 < lines.length && lines[i2 + 1].includes("-->");
        if (isNextLineTimestamp) {
          cues.push(currentCue);
          currentCue = null;
        } else {
          currentCue.textLines.push(line);
        }
      }
    }
    i2++;
  }
  if (currentCue) {
    cues.push(currentCue);
  }
  const formattedCues = cues.map((cue, index) => ({
    index,
    id: cue.id,
    timestamp: cue.timestamp,
    text: cue.textLines.join("\n").trim()
  })).filter((cue) => cue.text !== "");
  return { header, cues: formattedCues };
}
__name(parseVttCues, "parseVttCues");
function rebuildVtt(header, cues, translatedTextsMap) {
  let vtt = header.trim() + "\n\n";
  for (const cue of cues) {
    if (cue.id) {
      vtt += cue.id + "\n";
    }
    vtt += cue.timestamp + "\n";
    const translatedText = translatedTextsMap[cue.index] || cue.text;
    vtt += translatedText + "\n\n";
  }
  return vtt.trim() + "\n";
}
__name(rebuildVtt, "rebuildVtt");
async function translateCuesWithGemini(cues, apiKey) {
  const batchSize = 150;
  const batches = [];
  for (let i2 = 0; i2 < cues.length; i2 += batchSize) {
    batches.push(cues.slice(i2, i2 + batchSize));
  }
  const translatedMap = {};
  const promises = batches.map(async (batch, batchIdx) => {
    const inputPayload = batch.map((c) => ({ id: c.index, text: c.text }));
    const prompt = `You are a professional subtitle translator. Translate the following English anime subtitle lines into natural, fluent Vietnamese.
Ensure terms are translated appropriately for anime context (e.g. using natural, contextual pronouns like "c\u1EADu", "t\u1EDB", "anh", "em", "ta", "\xF4ng", "b\xE0", "ng\u01B0\u01A1i").
Keep the translations concise so they fit on screen.
Do not change the structure or add any commentary.
Return ONLY a JSON array of objects, where each object has:
- "id": the integer ID representing the line index
- "text": the translated Vietnamese text.

Input:
${JSON.stringify(inputPayload, null, 2)}`;
    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
    let success = false;
    let resultJson = null;
    let lastErr = null;
    for (const model of models) {
      if (success) break;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "INTEGER" },
                      text: { type: "STRING" }
                    },
                    required: ["id", "text"]
                  }
                }
              }
            })
          });
          if (!response.ok) {
            const errText = await response.text();
            if (response.status === 404) {
              throw new Error("Model not found");
            }
            throw new Error(`Gemini API returned ${response.status}: ${errText}`);
          }
          const data = await response.json();
          const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!textResponse) {
            throw new Error("Empty response from Gemini");
          }
          const parsed = JSON.parse(textResponse);
          if (Array.isArray(parsed)) {
            resultJson = parsed;
            success = true;
            break;
          } else {
            throw new Error("Gemini response is not a JSON array");
          }
        } catch (err2) {
          lastErr = err2;
          console.warn(`[translate-gemini] Batch ${batchIdx} model ${model} attempt ${attempt + 1} failed:`, err2.message);
          if (err2.message === "Model not found") {
            break;
          }
          await new Promise((r) => setTimeout(r, 1e3));
        }
      }
    }
    if (success && resultJson) {
      for (const item of resultJson) {
        if (item && typeof item.id === "number" && typeof item.text === "string") {
          translatedMap[item.id] = item.text;
        }
      }
    } else {
      throw lastErr || new Error("Failed to translate batch");
    }
  });
  await Promise.all(promises);
  return translatedMap;
}
__name(translateCuesWithGemini, "translateCuesWithGemini");
function convertSrtToVtt(srtText) {
  let text = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return "WEBVTT\n\n" + text.trim();
}
__name(convertSrtToVtt, "convertSrtToVtt");
var xem20SessionCookie = null;
async function getXem20Cookie() {
  if (xem20SessionCookie) return xem20SessionCookie;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
  try {
    const loginPageRes = await fetch("https://xem20.net/login", { headers });
    const html = await loginPageRes.text();
    const tokenMatch = html.match(/name="_token"\s+value="([^"]+)"/);
    if (!tokenMatch) throw new Error("No CSRF token");
    const csrfToken = tokenMatch[1];
    let cookieString = "";
    if (loginPageRes.headers.getSetCookie) {
      cookieString = loginPageRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    } else {
      const setCookies = loginPageRes.headers.get ? loginPageRes.headers.get("set-cookie") : null;
      if (setCookies) {
        cookieString = (Array.isArray(setCookies) ? setCookies : setCookies.split(",")).map((c) => c.split(";")[0]).join("; ");
      }
    }
    const loginData = new URLSearchParams();
    loginData.append("_token", csrfToken);
    loginData.append("login", "n1k0vac");
    loginData.append("password", "b@7hdY9X9RKYmNz");
    loginData.append("remember", "on");
    const loginRes = await fetch("https://xem20.net/login", {
      method: "POST",
      body: loginData.toString(),
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookieString,
        "Referer": "https://xem20.net/login",
        "Origin": "https://xem20.net"
      },
      redirect: "manual"
    });
    let newCookieString = "";
    if (loginRes.headers.getSetCookie) {
      const newCookies = loginRes.headers.getSetCookie();
      if (newCookies.length > 0) newCookieString = newCookies.map((c) => c.split(";")[0]).join("; ");
    } else {
      const setCookies = loginRes.headers.get ? loginRes.headers.get("set-cookie") : null;
      if (setCookies) {
        newCookieString = (Array.isArray(setCookies) ? setCookies : setCookies.split(",")).map((c) => c.split(";")[0]).join("; ");
      }
    }
    if (newCookieString) {
      const cookieMap = /* @__PURE__ */ new Map();
      cookieString.split("; ").forEach((c) => {
        if (c) {
          const [k, v] = c.split("=");
          cookieMap.set(k, v);
        }
      });
      newCookieString.split("; ").forEach((c) => {
        if (c) {
          const [k, v] = c.split("=");
          cookieMap.set(k, v);
        }
      });
      xem20SessionCookie = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
    } else {
      xem20SessionCookie = cookieString;
    }
    return xem20SessionCookie;
  } catch (err2) {
    console.warn("[xem20-proxy] Login failed:", err2.message);
    return null;
  }
}
__name(getXem20Cookie, "getXem20Cookie");
async function handleXem20Proxy(request, url) {
  const action = url.searchParams.get("action");
  const cookie = await getXem20Cookie();
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Cookie": cookie || "",
    "Referer": "https://xem20.net/"
  };
  const jsonResponse = /* @__PURE__ */ __name((obj, status = 200) => {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }, "jsonResponse");
  try {
    if (action === "search") {
      const keyword = url.searchParams.get("keyword");
      const res = await fetch(`https://xem20.net/tim-kiem?keyword=${encodeURIComponent(keyword)}`, { headers });
      const text = await res.text();
      let items = [];
      const ldMatches = [...text.matchAll(/<script type="application\/ld\+json">\s*(\{.*?\})\s*<\/script>/gs)];
      for (const match of ldMatches) {
        try {
          const data = JSON.parse(match[1]);
          if (data["@graph"]) {
            const itemList = data["@graph"].find((g) => g["@type"] === "ItemList");
            if (itemList && itemList.itemListElement) {
              items = itemList.itemListElement.map((i2) => ({
                name: i2.name,
                slug: i2.url.split("/").pop(),
                url: i2.url
              }));
            }
          }
        } catch (e) {
        }
      }
      return jsonResponse({ items });
    } else if (action === "episodes") {
      const slug = url.searchParams.get("slug");
      const movieUrl = `https://xem20.net/${slug}`;
      const mRes = await fetch(movieUrl, { headers });
      const mHtml = await mRes.text();
      let watchMatch = mHtml.match(/href="([^"]+tap[^"]+)"/i) || mHtml.match(/href="(https:\/\/xem20\.net\/xem-phim\/[^"]+)"/i) || mHtml.match(/href="(\/xem-phim\/[^"]+)"/i);
      let watchUrl = watchMatch ? watchMatch[1] : null;
      if (!watchUrl) throw new Error("Watch link not found on movie page");
      if (watchUrl.startsWith("/")) watchUrl = "https://xem20.net" + watchUrl;
      const wRes = await fetch(watchUrl, { headers });
      const wHtml = await wRes.text();
      const links = [...wHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*episode-link[^"]*"[^>]*>(.*?)<\/a>/gs)];
      const episodes = links.map((m) => {
        const epurl = m[1];
        let name = m[2].replace(/<[^>]+>/g, "").trim();
        return { name, url: epurl, epSlug: epurl.split("/xem-phim/")[1] };
      });
      return jsonResponse({ episodes });
    } else if (action === "stream") {
      const epSlug = url.searchParams.get("epSlug");
      const watchUrl = `https://xem20.net/xem-phim/${epSlug}`;
      const wRes = await fetch(watchUrl, { headers });
      const wHtml = await wRes.text();
      const jwFileMatch = wHtml.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/i);
      if (jwFileMatch) {
        return jsonResponse({ m3u8Url: jwFileMatch[1] });
      }
      const directM3u8Match = wHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (directM3u8Match) {
        return jsonResponse({ m3u8Url: directM3u8Match[1] });
      }
      const iframeMatch = wHtml.match(/<iframe[^>]+data-src="([^"]+)"/i) || wHtml.match(/<iframe[^>]+src="([^"]+)"/i);
      if (!iframeMatch) throw new Error("m3u8 and iframe not found in watch page");
      const playerUrl = iframeMatch[1];
      const pRes = await fetch(playerUrl, { headers: { "Referer": "https://xem20.net/", "User-Agent": headers["User-Agent"] } });
      const pHtml = await pRes.text();
      const m3u8Match = pHtml.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i);
      if (!m3u8Match) throw new Error("m3u8 not found in player");
      return jsonResponse({ m3u8Url: m3u8Match[1] });
    }
    throw new Error("Invalid action");
  } catch (err2) {
    return jsonResponse({ error: err2.message }, 500);
  }
}
__name(handleXem20Proxy, "handleXem20Proxy");
async function syncAiMovieMappings(env) {
  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  if (!env.MOVIE_CACHE) {
    throw new Error("MOVIE_CACHE KV Namespace is not bound.");
  }
  const sources = [
    { name: "ophim", url: "https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat?page=1" },
    { name: "kkphim", url: "https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1" }
  ];
  let totalMapped = 0;
  const logDetails = [];
  for (const src of sources) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.data?.items || data.items || [];
      for (const item of items.slice(0, 10)) {
        const title = item.name || item.origin_name;
        if (!title) continue;
        const tmdbToken = env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || "";
        const searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&language=vi`;
        const tmdbRes = await fetch(searchUrl, {
          headers: { "Authorization": `Bearer ${tmdbToken}`, "Accept": "application/json" }
        });
        if (!tmdbRes.ok) continue;
        const tmdbData = await tmdbRes.json();
        const candidates = (tmdbData.results || []).slice(0, 5).map((c) => ({
          id: c.id,
          media_type: c.media_type,
          title: c.title || c.name,
          original_title: c.original_title || c.original_name,
          release_date: c.release_date || c.first_air_date,
          overview: (c.overview || "").substring(0, 150)
        }));
        if (candidates.length === 0) continue;
        const systemPrompt = `You are a precise movie library matcher. Match the provided Vietnamese site movie entry with ONE candidate from the TMDB candidates list.
Respond ONLY with a JSON object format:
{"tmdb_id": number|null, "media_type": "movie"|"tv", "season": number, "slug": string, "confidence": number}
If no candidate matches, set tmdb_id to null.`;
        const userPrompt = `Item: "${item.name}" (Original: "${item.origin_name}", Year: ${item.year}, Slug: "${item.slug}")
TMDB Candidates: ${JSON.stringify(candidates)}`;
        const geminiRes = await callGemini(apiKey, systemPrompt, userPrompt);
        let text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          continue;
        }
        if (parsed && parsed.tmdb_id) {
          const mediaType = parsed.media_type || "movie";
          const seasonTag = mediaType === "tv" ? `:s${parsed.season || 1}` : "";
          const kvKey = `tmdb_map:${mediaType}:${parsed.tmdb_id}${seasonTag}`;
          const mappingValue = {
            slug: item.slug,
            provider: src.name,
            confidence: parsed.confidence || 0.95,
            mapped_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await env.MOVIE_CACHE.put(kvKey, JSON.stringify(mappingValue), {
            expirationTtl: 30 * 24 * 3600
            // 30 days cache
          });
          totalMapped++;
          logDetails.push({ kvKey, slug: item.slug });
        }
      }
    } catch (e) {
      console.warn(`[syncAiMovieMappings] Error syncing ${src.name}:`, e.message);
    }
  }
  return { success: true, totalMapped, logDetails };
}
__name(syncAiMovieMappings, "syncAiMovieMappings");
async function callGemini(apiKey, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${errText}`);
  }
  return await response.json();
}
__name(callGemini, "callGemini");
var STATIC_PNG_PIXELS_BASE64 = "9vb2/+Lq7P9xqrv/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP8A//8BPYujwDyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP6CtMT+8vP0/vb29v7z9PX+aaW4/jyMpP48i6T+PIuk/jyMpP48jKT+PIuk/jyMpP48jKT+PIuk/jyMpP48jKT+PIyk/jyLpP48jKT+PIyk/jyLpP48jKT+PIyk/zyLpP48i6T+PIyk/jyMpP48i6T+PIyk/jyMpP48i6T+PIyk/jyMpP48jKT+PIuk/jyMpP48jKT+PIuk/jyMpP48jKT+PIyk/jyLpP48jKT+PIyk/jyLpP48jKT+PIyk/jyLpP48i6T+PIyk/jyMpP48i6T+PIyk/jyMpP48i6T+PIyk/jyMpP48jKT+PIuk/jyMpP48jKT+PIuk/jyMpP48jKT+PIuk/jyLpP6EtcT+8/X1/rzU3P48i6T+PIyk/jyMpP48i6T+PIuk/jyMpP48i6T+PIuk/jyMpP48i6T/PIuk/jyLpP48jKT+PIuk/jyLpP48jKT+PIuk/jyLpP48jKT+PIyk/jyLpP48jKT+PIyk/jyLpP48i6T+PIyk/jyMpP48i6T+PIyk/jyMpP48i6T+PIuk/jyMpP48jKT+PIuk/jyMpP48jKT+PIuk/jyLpP48jKT+PIyk/jyLpP48jKT+PIyk/jyLpP48i6T+PIyk/jyMpP48i6T+PIyk/jyLpP48i6T+PIuk/jyMpP48i6T+PIuk/jyMpP48i6T+PIuk/jyMpP48jKT+PIuk/j+Opf7Z5un+hLXE/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/zyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T/PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/rHO2P53rr7/PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+pMbS/3euvv48jKT+PIyl/jyMpP48jKT+PIyk/jyMpf48jKT+PIyk/jyMpf48jKT+PIyk/jyMpP48jKX+PIyk/jyMpP88jKX+PIyk/jyMpP48jKX+PIyk/jyMpP48jKT+PIyl/jyMpP48jKT+PIyl/jyMpP48jKT+PIyk/jyMpf48jKT+PIyk/jyMpf48jKT+PIyk/jyMpP48jKX+PIyk/jyMpP48jKX+PIyk/jyMpP48jKX+PIyk/jyMpP48jKT+PIyl/jyMpP48jKT+PIyl/jyMpP48jKT+PIyk/jyMpf48jKT+PIyk/jyMpf48jKT+PIyk/jyMpf48jKT+PIyk/jyMpP+jxtL+d66+/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/zyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T+PIuk/jyLpP48i6T/PIuk/qPG0v53rr7+PIuk/jyMpP48i6T+PIuk/jyLpP88jKT+PIuk/jyLpP48jKT+PIuk/jyLpP48i6T+PIyk/zyLpP48i6T/PIuk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyLpP88i6T/PIuk/zyMpP88i6T/PIuk/zyMpP88i6T/PIuk/zyLpP88jKT/PIuk/zyLpP88jKT/PIuk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyLpP88i6T/PIuk/zyMpP88i6T/PIuk/zyMpP88i6T/PIuk/zyLpP88jKT/PIuk/zyLpP88jKT/PIuk/zyLpP88jKT/PIuk/zyLpP88jKT/o8bS/3euvv88jKT/PIyk/zyLpP+DtMP/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/p7/D/6e/w/+nv8P/a5ur/j7vI/0KPp/88jKT/PIuk/zyLpP88jKT/PIyk/zyLpP88jKT/PIyk/zyLpP88jKT/PIyk/zyMpP88i6T/PIyk/zyMpP88i6T/PIyk/zyMpP88i6T/PIuk/zyMpP+jxtL/d62+/zyLpP88jKT/PIyk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/3+ns/4i3xf9Fkaj/PIuk/zyLpP88jKT/PIyk/zyLpP88jKT/PIuk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyMpP88i6T/PIyk/6PG0v93rr7/PIuk/zyLpP88i6T/i7jH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//Lz9P/b5+v/2eXp/9nl6f/Z5en/2eXp/9nl6f/Z5en/2eXp/9nl6f/Z5en/2eXp/9nl6f/Z5en/2eXp/9nl6f9hoLT/PIuk/zyLpP88i6T/o8bS/3euvv88jKT/PIyk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyMpP+jxtL/d62+/zyMpP88jKX/PIyk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyMpP88jKT/PIyk/6PG0v93rr7/PIuk/zyLpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88i6T/o8bS/3euvv88i6T/PIyk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyMpP+jxtL/d66+/zyMpP88jKT/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIyk/6PG0v93rb7/PIuk/zyMpP88jKT/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIyk/zyLpP88jKT/o8bS/3euvv88i6T/PIuk/zyLpP+LuMf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyLpP+jxtL/d66+/zyMpP88jKT/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIyk/6PG0v93rb7/PIuk/zyLpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88i6T/o8bS/3euvv88i6T/PIuk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/x8/T/4+vu//P19f/29vb/9vb2//b29v/29vb/5u3v/+/y8//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/p7/H/6+/x//b29v/29vb/9vb2//b29v/v8vP/5uzv//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyLpP+jxtL/d66+/zyLpP88jKT/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/2Obp/16gs/9Cj6b/Y6G2/93o7P/29vb/9fX1/3+ywv9EkKj/T5at/7vV3P/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/msHN/0mTqv9Ikqn/nMLO//b29v/29vb/0N/l/1WasP9Bj6b/cKm7/+zw8v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIyk/6PG0v93rr7/PIyk/zyMpf88jKT/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v+JuMX/PIyl/zyMpP88jKT/WJyx/9Li5v+FtcT/PIyk/zyMpf88jKT/VZqv//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/+/y8/9Aj6b/PIyl/zyMpP88jKT/kr3K/8vd4/9Gkaj/PIyk/zyMpf88jKT/pcjS//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIyk/zyMpP88jKT/o8bS/3etvv88i6T/PIuk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/4m3xv88i6T/PIuk/zyLpP88i6T/Q5Cn/zyLpP88i6T/PIuk/zyLpP9Wmq//9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/7fHy/0COpv88i6T/PIuk/zyLpP88jKT/QI2m/zyLpP88i6T/PIuk/zyLpP+kyNP/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2ajt/88i6T/PIuk/zyLpP+jxtL/d66+/zyLpP88i6T/PIuk/4u4x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/2ubq/1OZrv88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/Q5Cn/67O1//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/mcHN/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/ZaO2/+Lr7v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIuk/6PG0v93rr7/PIyk/zyMpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/1ePn/1War/88jKT/PIyk/zyLpP88i6T/PIyk/0COpf+y0Nj/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/y8/T/lL3L/zyLpP88jKT/PIyk/zyLpP88i6T/PIyk/2GgtP/n7vD/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88jKT/o8bS/3etvv88i6T/PIuk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/09fX/cKm7/zyLpP88i6T/PIuk/zyLpP88i6T/Q4+n/+Xs7//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/I3OL/PY2l/zyLpP88i6T/PIuk/zyLpP88i6T/jLrH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyLpP+jxtL/d66+/zyLpP88i6T/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/6/Dy/4W1xP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/Vpuw/93o7P/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/y93j/0aRqP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/lr/M//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIuk/6PG0v93rr7/PIyk/zyMpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v+lx9L/PIuk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyLpP88i6T/c6u8//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//X19f9Tma7/PIyk/zyLpP88jKT/PIyk/zyLpP88i6T/PIyk/zyMpP89jaX/wNfe//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88jKT/o8bS/3euvv88jKT/PIyl/zyMpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/4O1xP88jKX/PIyk/zyMpP9Dj6j/jLnI/1OZrv88jKT/PIyl/zyMpP9Pl63/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/5+7w/zyMpP88jKX/PIyk/zyMpP9ZnLH/fLDA/zyMpP88jKT/PIyl/zyMpP+ew8//9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88jKT/PIyk/zyMpP+jxtL/d62+/zyLpP88i6T/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/tdDZ/0SQp/88i6T/QI2m/67N1v/19vb/0eDl/1GXrf88i6T/PIuk/4Gzwv/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/19vb/aKW4/zyLpP88i6T/YKC0/+ft7//y9PT/jLnI/zyLpP88i6T/RJCo/83e5P/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqO3/zyLpP88i6T/PIuk/6PG0v93rr7/PIuk/zyLpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/wNfe/5vCzv/C2N//9fb2//b29v/29vb/3Ofr/6DF0P+xz9f/7vLy//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/j7O3/qcrU/6nK1P/i6u3/9vb2//b29v/y9PT/t9Lb/5vCzv/N3uT/9fb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88i6T/o8bS/3euvv88jKT/PIyk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyMpP+jxtL/d62+/zyLpP88i6T/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIuk/6PG0v93rr7/PIuk/zyLpP88i6T/i7jH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIuk/zyLpP88i6T/o8bS/3euvv88jKT/PIyk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/1+Xp/97p7P/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/f6ez/1ePo//X19f/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyMpP+jxtL/d66+/zyMpP88jKX/PIyk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/8vT0/2+puv88jKX/QI6m/4S1xP/Y5en/9vb2//b29v/e6ez/pMfS/2GhtP9Jk6r/aqa4/7LP2P/r7/L/9vb2//Hz9P/J3eL/day9/z2Npf89jKT/irnG//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyMpP88jKT/PIyk/6PG0v93rb7/PIuk/zyLpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/E2eD/PIuk/zyLpP88i6T/PIuk/0qTq/+EtcP/lr/M/02VrP88i6T/PIuk/zyLpP88i6T/PIuk/1+gtP+exM//eK2//z2Mpf88i6T/PIuk/zyLpP8/jaX/5u3v//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mo7f/PIuk/zyLpP88i6T/o8bS/3euvv88i6T/PIuk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/8rd4v88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/0OQp//s8fL/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyLpP+jxtL/d66+/zyMpP88jKX/PIyk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/4i3xv9Ajqb/PIyk/zyMpP88jKX/PIyk/zyMpP88jKT/PIyl/zyMpP88jKT/PIyl/zyMpP88jKT/PIyk/zyMpf88jKT/PIyk/zyMpf9Hkaj/mcDN//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyMpP88jKT/PIyk/6PG0v93rb7/PIuk/zyLpP88i6T/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/87g5f92rL7/QI2l/zyLpP88i6T/PIuk/zyLpP88i6T/X6C0/4+7yP9Xm7D/PIuk/zyLpP88i6T/PIuk/zyLpP8/jaX/hrXE/+Hr7f/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mo7f/PIuk/zyLpP88i6T/o8bS/3euvv88i6T/PIuk/zyLpP+LuMf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/U4+f/gbPC/1mdsf9Vmq//b6m7/7fS2//29vb/9vb2//P19f+sy9X/aqW4/1OZrv9dn7P/jrvJ/93n6//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2akt/88i6T/PIuk/zyLpP+jxtL/d66+/zyMpP88jKT/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9PX2//T19f/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/8/T1//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIyk/6PG0v93rr7/PIuk/zyMpP88jKT/i7nH//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v9mpLf/PIyk/zyLpP88jKT/o8bS/3euvv88i6T/PIuk/zyLpP+Lucf/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2/2ajt/88i6T/PIuk/zyLpP+jxtL/d66+/zyLpP88i6T/PIuk/4u5x//29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/9vb2//b29v/29vb/ZqS3/zyLpP88i6T/PIuk/6PG0v+BtMP/PIyk/zyMpf88jKT/XZ6y/57Ez/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5/Fz/+fxc//n8XP/5zCz/9FkKj/PIyk/zyMpP88jKT/qcrU/7DO1/88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP/L3eP/6u/w/1SZr/88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/PIuk/zyLpP88i6T/a6e5//Hz9P/29vb/y93j/1WasP88i6T/PIuk/zyMpP88jKT/PIuk/zyMpP88jKT/PIuk/zyLpP88jKT/PIyk/zyLpP88jKT/PIuk/zyLpP88i6T/PIyk/zyLpP88i6T/PIyk/zyLpP88i6T/PIuk/zyMpP88i6T/PIyk/zyMpP88i6T/PIuk/zyMpP88jKT/PIuk/zyMpP88jKT/PIuk/zyLpP88jKT/PIyk/zyLpP88jKT/PIyk/zyLpP88i6T/PIyk/zyMpP88i6T/PIyk/zyMpP88i6T/PIuk/zyMpP88jKT/PIuk/zyMpP88jKT/PIuk/zyLpP88jKT/PIuk/1yds//e6Oz/9vb2/w==";
export {
  cloudflare_worker_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
