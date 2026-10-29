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

import { posterKey, toStr, normMediaType, safeArr, clampBlock } from "./aiCineService";

const norm = (s) => toStr(s).toLowerCase().trim();

const PREDEFINED = new Set(["watchedTv", "favorites", "watchList", "watchedMovies"]);
const DEFAULT_CAP = 100;
const RECENT_WATCHED = 20;
const TOP_GENRES = 8;
// Özetin karakter bütçesi. Liste başına 100 öğe sınırı tek başına yetmez:
// izleme listesi + favoriler + birkaç dolu özel liste özeti 30 000 karakterin
// üstüne çıkarıp sunucunun sistem talimatı tavanını (24 000) deliyordu → her
// istek reddedilirdi. Sabit talimat ~4 000 karakter; bu bütçe kalanına rahat sığar
// ve istek başına giriş token'ını da sınırlar.
const DEFAULT_MAX_CHARS = 12000;
// Bütçeye sığdırırken liste başına inilebilecek en az öğe; altı kırpılır.
const MIN_CAP = 10;

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
 * @param {object} opts      { capPerList, maxChars, favoritesBlock }
 *   `favoritesBlock`: "dört favori" için hazır metin (utils/fourFavorites.buildFavoritesPrompt).
 *   Listelerden ÖNCE gelir — kullanıcının açıkça seçtiği en güçlü zevk işareti.
 *   `maxChars`: özetin üst sınırı. Aşılırsa liste başına öğe sayısı (en yeniler
 *   kalır) adım adım düşürülür; yine sığmazsa satır sınırında kırpılır.
 */
export function buildLibraryContext(allLists, options = {}, opts = {}) {
  if (!allLists || typeof allLists !== "object") return EMPTY;
  const maxChars = opts.maxChars || DEFAULT_MAX_CHARS;

  const watchedIndex = { movieIds: new Set(), tvIds: new Set(), names: new Set() };
  const head = [];
  if (typeof opts.favoritesBlock === "string" && opts.favoritesBlock.trim()) {
    head.push(opts.favoritesBlock.trim());
  }

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

  // Listeler bir kez sıralanır; bütçe döngüsü yalnız kesme noktasını değiştirir.
  const lists = [];
  const addList = (label, key) => {
    const sorted = safeArr(allLists[key]).slice().sort(byRecent);
    if (sorted.length) lists.push({ label, sorted });
  };
  if (options.watchList) addList("WATCHLIST (titles the user plans to watch)", "watchList");
  if (options.favorites) addList("FAVORITES", "favorites");
  if (options.custom) {
    Object.keys(allLists)
      .filter((k) => !PREDEFINED.has(k) && Array.isArray(allLists[k]))
      .forEach((k) => addList(`CUSTOM LIST "${k}"`, k));
  }

  const listBlocks = (cap) =>
    lists
      .map(({ label, sorted }) => {
        const capped = sorted.slice(0, cap);
        const trunc = sorted.length > capped.length ? ` [showing ${capped.length} of ${sorted.length}, most recent]` : "";
        const body = fmtItems(capped);
        return body ? `${label}${trunc}:\n${body}` : null;
      })
      .filter(Boolean);

  const tail = [];
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
    tail.push(lines.join("\n"));
  }

  // İzlenenler özeti listelerin ÜSTÜNE alınmaz (kaynak sırası korunur) ama
  // bütçeden önce hesaplanır: kırpma gerekirse kısa ve kritik olan o blok
  // ("bunları önerme") yerinde kalsın, listelerin sonu kısalsın.
  const render = (cap, withTail = true) => {
    const blocks = [...head, ...listBlocks(cap), ...(withTail ? tail : [])];
    return blocks.length
      ? `USER LIBRARY (the user's own lists — personalize with these. When the user says "my watchlist / favorites / my list", choose ONLY from the items listed here):\n\n${blocks.join("\n\n")}`
      : "";
  };

  let cap = opts.capPerList || DEFAULT_CAP;
  let librarySummary = render(cap);
  while (librarySummary.length > maxChars && cap > MIN_CAP) {
    cap = Math.max(MIN_CAP, Math.floor(cap * 0.6));
    librarySummary = render(cap);
  }
  if (librarySummary.length > maxChars) {
    // Çok sayıda özel liste: en az öğede bile sığmadı. İzlenenler bloğu sonda
    // olduğundan kırpmada kaybolmasın; yalnız listeler satır sınırında kısalır.
    const tailText = tail.length ? `\n\n${tail.join("\n\n")}` : "";
    librarySummary = `${clampBlock(render(cap, false), maxChars - tailText.length)}${tailText}`;
  }

  return { librarySummary, watchedIndex, hasAny: librarySummary.length > 0 };
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
