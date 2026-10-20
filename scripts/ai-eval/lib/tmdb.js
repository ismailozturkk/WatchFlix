// scripts/ai-eval/lib/tmdb.js
//
// Başlık doğrulama. Durumlar:
//   exact / close  → TMDB'de aranan türde (film/dizi) aynı adlı yapım var
//   wrong_type     → başlık VAR ama öbür türde (model "movie" demiş, aslında dizi)
//   loose          → arama sonuç döndürdü ama hiçbiri aynı ad değil: uygulama yine de
//                    kart gösterir (en popüler sonuç) — büyük olasılıkla uydurma/yanlış
//   none           → arama boş
// Uygulamanın gördüğü "found" = exact | close | loose (claimed türde sonuç varlığı).

import { matchTitle } from "./titleMatch.js";

const TOP = 5;
const nameFields = (r) => [r?.title, r?.name, r?.original_title, r?.original_name];

export function createTmdbVerifier({ token, fetchImpl = fetch, cache = new Map(), concurrency = 5 }) {
  if (!token) throw new Error("TMDB_TOKEN tanımlı değil");
  const auth = /^Bearer /i.test(token) ? token : `Bearer ${token}`;
  let active = 0;
  const waiting = [];
  const acquire = () =>
    active < concurrency
      ? (active++, Promise.resolve())
      : new Promise((resolve) => waiting.push(resolve));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  async function search(mediaType, query, language) {
    await acquire();
    try {
      const url =
        `https://api.themoviedb.org/3/search/${mediaType}?query=${encodeURIComponent(query)}` +
        `&include_adult=false&language=${language}&page=1`;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetchImpl(url, { headers: { Authorization: auth } });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data?.results) ? data.results : []).slice(0, TOP);
      }
      throw new Error("TMDB HTTP 429");
    } finally {
      release();
    }
  }

  async function verify({ title, mediaType, language }) {
    const type = mediaType === "tv" ? "tv" : "movie";
    const key = `${type}|${language}|${String(title).toLowerCase().trim()}`;
    if (cache.has(key)) return cache.get(key);

    const claimed = await search(type, title, language);
    let out;
    const strict = claimed.map((r) => matchTitle(title, nameFields(r))).find(Boolean);
    if (strict) {
      out = { status: strict, appFound: true };
    } else {
      const other = type === "movie" ? "tv" : "movie";
      const otherResults = await search(other, title, language);
      const otherStrict = otherResults.map((r) => matchTitle(title, nameFields(r))).find(Boolean);
      if (otherStrict) out = { status: "wrong_type", appFound: claimed.length > 0 };
      else out = { status: claimed.length ? "loose" : "none", appFound: claimed.length > 0 };
    }
    cache.set(key, out);
    return out;
  }

  return { verify, cache };
}
