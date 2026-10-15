// services/cineswipe/deckModel.js
//
// CineSwipe'ın SAF deste modeli: RN / Firebase / axios import ETMEZ. Kategori ve
// tür tanımları, TMDB isteğinin kurulması, kart normalizasyonu, sayfa birleştirme
// ve oda kodu ayıklama burada. Ağ katmanı (cineswipeService) ve ekran bu dosyanın
// çıktısını kullanır; mantık burada olduğu için jest ile doğrudan sınanır.
//
// NOT — `include_adult` bilerek YAZILMAZ: yetişkin içerik ayarı ve yaş kapısı
// utils/tmdbAdultGuard.js tarafından /discover isteklerine merkezden eklenir.

/** Film/dizi kimliği aynı sayı olabilir: oy ve sepet anahtarı tür ile ayrışır. */
export const cineMediaKey = (media) => `${media?.mediaType || "movie"}_${media?.id}`;

// `mediaType` yalnız o kaynağın TEK türü varsa dolu; `genres: false` tür
// filtresinin o kaynakta anlamsız olduğunu söyler (izleme listesi).
export const SWIPE_CATEGORIES = [
  { id: "trending", label: "Popüler & Trendler", icon: "flame-outline", genres: true },
  { id: "now_playing", label: "Vizyondaki Filmler", icon: "film-outline", mediaType: "movie", genres: true },
  { id: "upcoming", label: "Yakında Gelecekler", icon: "time-outline", mediaType: "movie", genres: true },
  { id: "top_rated_movie", label: "En İyi Filmler", icon: "trophy-outline", mediaType: "movie", genres: true },
  { id: "popular_tv", label: "Popüler Diziler", icon: "tv-outline", mediaType: "tv", genres: true },
  { id: "top_rated_tv", label: "Efsane Diziler", icon: "star-outline", mediaType: "tv", genres: true },
  { id: "watchlist", label: "Kendi İzleme Listem", icon: "bookmark-outline", genres: false },
];

// `tv`: aynı türün TMDB dizi karşılığı. Film ve dizi tür kimlikleri FARKLIDIR
// (ör. Aksiyon film=28, dizi=10759); null = dizide karşılığı yok.
export const GENRE_OPTIONS = [
  { id: null, label: "Tüm Türler", tv: null },
  { id: 28, label: "Aksiyon", tv: 10759 },
  { id: 35, label: "Komedi", tv: 35 },
  { id: 18, label: "Dram", tv: 18 },
  { id: 878, label: "Bilim Kurgu", tv: 10765 },
  { id: 27, label: "Korku", tv: null },
  { id: 10749, label: "Romantik", tv: null },
  { id: 16, label: "Animasyon", tv: 16 },
  { id: 53, label: "Gerilim", tv: 9648 },
  { id: 99, label: "Belgesel", tv: 99 },
  { id: 80, label: "Suç", tv: 80 },
];

export const MEDIA_TYPE_OPTIONS = [
  { id: "movie", icon: "film-outline" },
  { id: "tv", icon: "tv-outline" },
  { id: "all", icon: "shuffle-outline" },
];

export const CARD_COUNT_OPTIONS = [10, 20, 30, 50];

const MEDIA_TYPES = ["movie", "tv", "all"];

export const categoryOf = (id) =>
  SWIPE_CATEGORIES.find((category) => category.id === id) || SWIPE_CATEGORIES[0];

/** Seçili tür, seçili içerik türünde kullanılabilir mi? */
export function genreSupports(genreId, mediaType) {
  if (genreId == null) return true;
  const genre = GENRE_OPTIONS.find((option) => option.id === genreId);
  if (!genre) return false;
  return mediaType === "tv" ? genre.tv != null : true;
}

/**
 * Birbiriyle çelişen filtre kombinasyonlarını düzeltir:
 *  • tek türlü kaynak (ör. Popüler Diziler) içerik türünü zorlar,
 *  • tür filtresi desteklemeyen kaynakta (izleme listesi) temizlenir,
 *  • dizide karşılığı olmayan tür (Korku, Romantik) dizi modunda temizlenir.
 */
export function normalizeFilters({ category, mediaType, genreId } = {}) {
  const source = categoryOf(category);
  const type = source.mediaType || (MEDIA_TYPES.includes(mediaType) ? mediaType : "movie");
  let genre = source.genres === false ? null : genreId ?? null;
  if (genre != null && !genreSupports(genre, type)) genre = null;
  return { category: source.id, mediaType: type, genreId: genre };
}

export const DEFAULT_FILTERS = Object.freeze({ category: "trending", mediaType: "movie", genreId: null });

export const sameFilters = (a, b) =>
  !!a && !!b && a.category === b.category && a.mediaType === b.mediaType && (a.genreId ?? null) === (b.genreId ?? null);

// ── Dil ──────────────────────────────────────────────────────────────────────

const TMDB_LANGUAGES = { tr: "tr-TR", en: "en-US" };

/** Uygulama dil kodu ("tr" | "en") → TMDB `language` parametresi. */
export const tmdbLanguage = (language) =>
  TMDB_LANGUAGES[String(language || "").slice(0, 2).toLowerCase()] || "en-US";

// ── İstek kurulumu ───────────────────────────────────────────────────────────

const isoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const tvGenreId = (genreId) => GENRE_OPTIONS.find((option) => option.id === genreId)?.tv ?? null;

/**
 * Bir sayfa için gereken TMDB isteklerini döndürür. "Karışık" + tür seçiliyken
 * film ve dizi AYRI uçlardan gelir (tek uç iki türü birden keşfedemez), bu yüzden
 * dönen dizi 1 ya da 2 eleman içerir. İzleme listesi TMDB'den gelmez: [] döner.
 *
 * Tür seçiliyken "hazır" uçlar (now_playing, top_rated…) tür parametresini
 * yok sayar; bu yüzden aynı anlama gelen /discover sorgusuna geçilir.
 *
 * @returns {Array<{ endpoint: string, params: object, mediaType: "movie"|"tv"|null }>}
 */
export function buildDeckRequests({
  category = "trending",
  mediaType = "movie",
  genreId = null,
  page = 1,
  language = "tr-TR",
  now = new Date(),
} = {}) {
  const filters = normalizeFilters({ category, mediaType, genreId });
  if (filters.category === "watchlist") return [];

  const genre = filters.genreId;
  const base = { language, page };
  const requests = [];
  const plain = (endpoint, type) => requests.push({ endpoint, params: { ...base }, mediaType: type });
  const discover = (type, extra = {}) => {
    const params = { ...base, sort_by: "popularity.desc", ...extra };
    const id = type === "tv" ? tvGenreId(genre) : genre;
    if (genre != null && id != null) params.with_genres = id;
    requests.push({ endpoint: `/discover/${type}`, params, mediaType: type });
  };
  const hasGenre = genre != null;

  switch (filters.category) {
    case "now_playing":
      if (!hasGenre) plain("/movie/now_playing", "movie");
      else {
        discover("movie", {
          "primary_release_date.gte": isoDate(addDays(now, -45)),
          "primary_release_date.lte": isoDate(now),
        });
      }
      break;
    case "upcoming":
      if (!hasGenre) plain("/movie/upcoming", "movie");
      else {
        discover("movie", {
          "primary_release_date.gte": isoDate(addDays(now, 1)),
          "primary_release_date.lte": isoDate(addDays(now, 240)),
        });
      }
      break;
    case "top_rated_movie":
      if (!hasGenre) plain("/movie/top_rated", "movie");
      else discover("movie", { sort_by: "vote_average.desc", "vote_count.gte": 500 });
      break;
    case "popular_tv":
      if (!hasGenre) plain("/tv/popular", "tv");
      else discover("tv");
      break;
    case "top_rated_tv":
      if (!hasGenre) plain("/tv/top_rated", "tv");
      else discover("tv", { sort_by: "vote_average.desc", "vote_count.gte": 200 });
      break;
    default:
      if (hasGenre) {
        if (filters.mediaType !== "tv") discover("movie", { "vote_count.gte": 80 });
        if (filters.mediaType !== "movie" && tvGenreId(genre) != null) {
          discover("tv", { "vote_count.gte": 80 });
        }
      } else if (filters.mediaType === "tv") plain("/trending/tv/week", "tv");
      else if (filters.mediaType === "movie") plain("/trending/movie/week", "movie");
      else plain("/trending/all/week", null);
  }
  return requests;
}

// ── Kart normalizasyonu ──────────────────────────────────────────────────────

/** TMDB kaydını kart biçimine çevirir; afişsiz/başlıksız kayıt null döner. */
export function normalizeDeckItem(raw, forcedType = null) {
  if (!raw || raw.id == null) return null;
  const title = raw.title || raw.name;
  if (!raw.poster_path || !title) return null;
  const type =
    raw.media_type === "tv" || raw.media_type === "movie"
      ? raw.media_type
      : forcedType || (raw.title ? "movie" : "tv");
  return {
    id: raw.id,
    title,
    original_title: raw.original_title || raw.original_name || "",
    mediaType: type,
    poster_path: raw.poster_path,
    backdrop_path: raw.backdrop_path || "",
    release_date: raw.release_date || raw.first_air_date || "",
    vote_average: typeof raw.vote_average === "number" ? raw.vote_average : 0,
    overview: raw.overview || "",
    genre_ids: Array.isArray(raw.genre_ids) ? raw.genre_ids.slice(0, 3) : [],
  };
}

/** Kullanıcının izleme listesi belgesini kart biçimine çevirir. */
export function normalizeWatchlistItem(data, docId) {
  if (!data || !(data.name || data.title) || !data.imagePath) return null;
  const id = data.id ?? parseInt(String(docId).split("_").pop(), 10);
  if (id == null || Number.isNaN(id)) return null;
  const title = data.name || data.title;
  return {
    id,
    title,
    original_title: title,
    mediaType: data.type === "tv" ? "tv" : "movie",
    poster_path: data.imagePath,
    backdrop_path: data.imagePath,
    release_date: "",
    vote_average: 0,
    overview: data.overview || "",
    genre_ids: [],
  };
}

// ── Liste yardımcıları ───────────────────────────────────────────────────────

/**
 * `incoming` içinden, `existing`'de bulunmayan, bu oturumda görülmemiş (`seen`)
 * ve kendi içinde tekrarlanmayan kartları sırasıyla döndürür.
 */
export function mergeUniqueCards(existing = [], incoming = [], seen = {}) {
  const have = new Set(existing.map(cineMediaKey));
  const fresh = [];
  for (const item of incoming) {
    const key = cineMediaKey(item);
    if (have.has(key) || seen[key]) continue;
    have.add(key);
    fresh.push(item);
  }
  return fresh;
}

/** İki listeyi sırayla karıştırır: a0, b0, a1, b1… (film/dizi dengeli gelsin). */
export function interleaveCards(a = [], b = []) {
  const out = [];
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Fisher–Yates; `sort(() => Math.random() - 0.5)` dağılımı eşit değildir. */
export function shuffleCards(items = [], random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** TMDB afiş yolu → tam URL. İzleme listesi kayıtları bazen tam URL taşır. */
export function posterUrl(path, size = "w780") {
  if (!path || typeof path !== "string") return null;
  return /^https?:\/\//.test(path) ? path : `https://image.tmdb.org/t/p/${size}${path}`;
}

/** "{{n}} kart" + { n: 3 } → "3 kart". Eksik değişken boş metin olur. */
export const fillText = (template, vars = {}) =>
  String(template ?? "").replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));

// ── Tür adları ───────────────────────────────────────────────────────────────

/** Kartın en fazla `limit` tür adı (çeviri tablosundan); bilinmeyen kimlik atlanır. */
export function cardGenreNames(media, names = {}, limit = 2) {
  return (media?.genre_ids || [])
    .map((id) => names[id])
    .filter(Boolean)
    .slice(0, limit);
}

// ── Oda kodu ─────────────────────────────────────────────────────────────────

/** Kutuya yazılan/yapıştırılan değeri 6 haneli rakama indirger. */
export const sanitizeRoomCode = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 6);

/**
 * Bir mesajın içinden oda kodunu çıkarır ("Oda Kodum: 749 215" → "749215").
 * Aralarında boşluk olabilen 3+3 hane arar; 7+ haneli sayıların parçası sayılmaz.
 */
export function extractRoomCode(text) {
  const match = String(text ?? "").match(/(?:^|\D)(\d{3})\s?(\d{3})(?:\D|$)/);
  return match ? `${match[1]}${match[2]}` : "";
}

// ── Sepet / liste ────────────────────────────────────────────────────────────

/** "03.10.2026" — liste adında "/" kullanılmaz (alan yolu sorunu çıkarmasın). */
export function formatListDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export const basketListName = (date = new Date()) => `CineSwipe (${formatListDate(date)})`;

/** Kartı liste öğesi (Lists/{uid} ve ortak liste biçimi) olarak ifade eder. */
// YEREL gün (YYYY-MM-DD). `toISOString()` UTC günü verir: UTC+3'te 00:00-03:00 arası "dün" çıkar.
const localIsoDate = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function toListItem(media, dateAdded = localIsoDate()) {
  return {
    id: media.id,
    type: media.mediaType === "tv" ? "tv" : "movie",
    name: media.title || media.name || "",
    imagePath: media.poster_path || null,
    minutes: null,
    genres: [],
    dateAdded,
  };
}
