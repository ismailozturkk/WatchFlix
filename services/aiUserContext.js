// services/aiUserContext.js
//
// CineMatch Pro — kullanıcının kendi listelerinden (ListStatusContext.allLists)
// AI için bağlam üretir. Token'ı düşük tutmak için:
//   - İzlenenler (watchedMovies/watchedTv): modele yalnızca ÖZET (sayı + top tür + son N).
//   - Aksiyon listeleri (watchList/favorites/custom): isim·tür·genres, en güncel CAP öğe.
//   - Tüm izlenen id'leri modele GİTMEZ; cevap sonrası yerel eleme için kullanılır.
//
// allLists öğe şekli (MovieDetail.updateMovieList'ten):
//   { id, name, type:"movie"|"tv", genres:[adlar], imagePath, dateAdded, minutes? }

import { posterKey, toStr, normMediaType, safeArr } from "./aiCineService";

const norm = (s) => toStr(s).toLowerCase().trim();

const PREDEFINED = new Set(["watchedTv", "favorites", "watchList", "watchedMovies"]);
const DEFAULT_CAP = 100;
const RECENT_WATCHED = 20;
const TOP_GENRES = 8;

const byRecent = (a, b) => new Date(b?.dateAdded || 0) - new Date(a?.dateAdded || 0);

const EMPTY = Object.freeze({
  librarySummary: "",
  watchedIndex: { movieIds: new Set(), tvIds: new Set(), names: new Set() },
  hasAny: false,
});

/**
 * Kullanıcı kütüphanesinden prompt bağlamı + yerel eleme indeksi üretir.
 * @param {object} allLists  ListStatusContext.allLists
 * @param {object} options   { watchList, favorites, custom, watched } booleans
 * @param {object} opts      { capPerList }
 */
export function buildLibraryContext(allLists, options = {}, opts = {}) {
  if (!allLists || typeof allLists !== "object") return EMPTY;
  const cap = opts.capPerList || DEFAULT_CAP;

  const watchedIndex = { movieIds: new Set(), tvIds: new Set(), names: new Set() };
  const blocks = [];

  const fmtItems = (arr) =>
    arr
      .map((it) => {
        const g = safeArr(it?.genres).map(toStr).filter(Boolean).join("/");
        const mt = normMediaType(it?.type) === "tv" ? "TV" : "Movie";
        const name = toStr(it?.name);
        return name ? `- ${name} (${mt}${g ? ", " + g : ""})` : null;
      })
      .filter(Boolean)
      .join("\n");

  const listBlock = (label, key) => {
    const full = safeArr(allLists[key]);
    if (!full.length) return;
    const capped = full.slice().sort(byRecent).slice(0, cap);
    const trunc = full.length > capped.length ? ` [showing ${capped.length} of ${full.length}, most recent]` : "";
    const body = fmtItems(capped);
    if (body) blocks.push(`${label}${trunc}:\n${body}`);
  };

  if (options.watchList) listBlock("WATCHLIST (titles the user plans to watch)", "watchList");
  if (options.favorites) listBlock("FAVORITES", "favorites");

  if (options.custom) {
    Object.keys(allLists)
      .filter((k) => !PREDEFINED.has(k) && Array.isArray(allLists[k]))
      .forEach((k) => listBlock(`CUSTOM LIST "${k}"`, k));
  }

  if (options.watched) {
    const movies = safeArr(allLists.watchedMovies);
    const tv = safeArr(allLists.watchedTv);

    // Yerel eleme indeksi — TAM küme (modele gitmez)
    [...movies, ...tv].forEach((it) => {
      if (!it) return;
      const mt = normMediaType(it.type);
      if (it.id != null) {
        (mt === "tv" ? watchedIndex.tvIds : watchedIndex.movieIds).add(String(it.id));
      }
      if (it.name) watchedIndex.names.add(norm(it.name));
    });

    // Modele yalnızca özet
    const tally = {};
    [...movies, ...tv].forEach((it) =>
      safeArr(it?.genres).forEach((g) => {
        const k = toStr(g);
        if (k) tally[k] = (tally[k] || 0) + 1;
      }),
    );
    const topGenres = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GENRES)
      .map(([g]) => g);
    const recent = [...movies, ...tv]
      .slice()
      .sort(byRecent)
      .slice(0, RECENT_WATCHED)
      .map((it) => toStr(it?.name))
      .filter(Boolean);

    const lines = [
      `WATCHED HISTORY (already seen — do NOT recommend these again): ${movies.length} movies, ${tv.length} TV shows.`,
    ];
    if (topGenres.length) lines.push(`Most-watched genres: ${topGenres.join(", ")}.`);
    if (recent.length) lines.push(`Recently watched: ${recent.join(", ")}.`);
    blocks.push(lines.join("\n"));
  }

  const hasAny = blocks.length > 0;
  const librarySummary = hasAny
    ? `USER LIBRARY (the user's own lists — personalize with these. When the user says "my watchlist / favorites / my list", choose ONLY from the items listed here):\n\n${blocks.join("\n\n")}`
    : "";

  return { librarySummary, watchedIndex, hasAny };
}

/**
 * "recommendations" cevabındaki izlenmiş başlıkları eler (TMDB id, yoksa isim).
 * Diğer tiplere (comparison/spotlight/watchlist/plan) dokunmaz — onlar kasıtlıdır.
 */
export function applyWatchedFilter(response, posterMap, watchedIndex) {
  if (!response || response.type !== "recommendations" || !watchedIndex) return response;
  const items = safeArr(response.items);
  if (!items.length) return response;

  const isWatched = (it) => {
    const mt = normMediaType(it?.mediaType);
    const pc = (posterMap || {})[posterKey(mt, it?.title)];
    if (pc?.found && pc.id != null) {
      const ids = mt === "tv" ? watchedIndex.tvIds : watchedIndex.movieIds;
      if (ids.has(String(pc.id))) return true;
    }
    return watchedIndex.names.has(norm(it?.title));
  };

  const filtered = items.filter((it) => !isWatched(it));
  // Hepsi elenirse boş kart göstermemek için orijinali koru
  if (!filtered.length) return response;
  if (filtered.length === items.length) return response;
  return { ...response, items: filtered };
}
