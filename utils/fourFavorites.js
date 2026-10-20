// utils/fourFavorites.js
//
// "Dört favori" özelliğinin SAF çekirdeği: kullanıcının profiline sabitlediği
// en fazla 4 film, 4 dizi ve 4 oyuncu. Hiçbir import yok (RN, Firebase, axios
// dahil) — jest yalnız saf modülleri çalıştırıyor, bkz. jest.config.js.
//
// NEDEN AYRI BİR ALAN: Lists/{uid}/favorites "kalp"le işaretlenmiş SINIRSIZ
// bir listedir (kütüphane). Burası tersi: küratörlü, sıralı, küçük bir vitrin.
// İkisi karışmasın diye alan adı `fourFavorites` ve kod tarafında hep
// "four favorites" denir; "favorites" tek başına liste demektir.
//
// SAKLAMA: Users/{uid}.fourFavorites = { movies: [], shows: [], people: [] }
// Her giriş { id, title, image, year? }. Başlık ve görsel yolu giriş anında
// kopyalanır (denormalize) — arkadaş profili bir TMDB isteği yapmadan çizilir.
// Poster yolu TMDB'de değişirse eski görsel yine çalışır; en kötü ihtimalle
// kullanıcı favoriyi yeniden seçer.
//
// SAYI: kategori başına 0–4. Boş bırakmak geçerli ve normal.

export const FAVORITE_KINDS = Object.freeze(["movies", "shows", "people"]);
export const MAX_FAVORITES = 4;

const MAX_TITLE_CHARS = 120;
// TMDB görsel yolları "/abc123.jpg" biçimindedir. Dışarıdan gelen (profil
// belgesi başkasının yazdığı bir şey de olabilir) hiçbir değer URL'e olduğu gibi
// girmesin diye sıkı doğrulanır.
const IMAGE_PATH = /^\/[A-Za-z0-9._-]{1,80}$/;

const isKind = (kind) => FAVORITE_KINDS.includes(kind);
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

export const emptyFavorites = () => ({ movies: [], shows: [], people: [] });

/** Tek giriş → temiz giriş, geçersizse null. */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  if (!isPositiveInt(id)) return null;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE_CHARS) : "";
  if (!title) return null;
  const image = typeof raw.image === "string" && IMAGE_PATH.test(raw.image) ? raw.image : null;
  const year = typeof raw.year === "string" && /^\d{4}$/.test(raw.year) ? raw.year : "";
  return year ? { id, title, image, year } : { id, title, image };
}

/**
 * Herhangi bir girdiyi (profil belgesi, yerel depo, bozuk veri) her zaman aynı
 * şekle indirir: üç dizi, tekrarsız, en fazla 4. Sıra korunur — ilk seçilen ilk.
 */
export function normalizeFavorites(raw) {
  const out = emptyFavorites();
  if (!raw || typeof raw !== "object") return out;
  for (const kind of FAVORITE_KINDS) {
    const seen = new Set();
    for (const item of Array.isArray(raw[kind]) ? raw[kind] : []) {
      const entry = normalizeEntry(item);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      out[kind].push(entry);
      if (out[kind].length >= MAX_FAVORITES) break;
    }
  }
  return out;
}

const yearOf = (date) => (/^\d{4}/.test(String(date || "")) ? String(date).slice(0, 4) : "");

/**
 * TMDB sonucu → giriş. Film `title`/`poster_path`, dizi `name`/`poster_path`,
 * kişi `name`/`profile_path` kullanır; kategoriye göre doğru alanlar okunur.
 */
export function toFavoriteEntry(kind, result) {
  if (!isKind(kind) || !result || typeof result !== "object") return null;
  if (kind === "movies") {
    return normalizeEntry({
      id: result.id,
      title: result.title || result.original_title,
      image: result.poster_path,
      year: yearOf(result.release_date),
    });
  }
  if (kind === "shows") {
    return normalizeEntry({
      id: result.id,
      title: result.name || result.original_name,
      image: result.poster_path,
      year: yearOf(result.first_air_date),
    });
  }
  return normalizeEntry({
    id: result.id,
    title: result.name || result.original_name,
    image: result.profile_path,
  });
}

/**
 * TMDB sonuç dizisi → seçici satırları. Kaynak sıralaması (alaka) korunur;
 * tekrar eden ve geçersiz kayıtlar elenir.
 *
 * Altyazı: film/dizide yıl, kişide "bilinen işleri" (TMDB `known_for`) — aynı
 * adı taşıyan iki oyuncuyu ayırt etmenin tek yolu bu.
 *
 * @returns {Array<{key:string, entry:object, subtitle:string}>}
 */
export function toPickerRows(kind, results, { limit = 30, exclude = [] } = {}) {
  if (!isKind(kind)) return [];
  const blocked = new Set([...exclude].map(String));
  const seen = new Set();
  const rows = [];
  for (const result of Array.isArray(results) ? results : []) {
    if (result?.adult === true) continue;
    const entry = toFavoriteEntry(kind, result);
    if (!entry || seen.has(entry.id) || blocked.has(String(entry.id))) continue;
    seen.add(entry.id);
    const subtitle =
      kind === "people"
        ? (Array.isArray(result.known_for) ? result.known_for : [])
            .map((work) => work?.title || work?.name)
            .filter(Boolean)
            .slice(0, 2)
            .join(" • ")
        : entry.year || "";
    rows.push({ key: `${kind}-${entry.id}`, entry, subtitle });
    if (rows.length >= limit) break;
  }
  return rows;
}

export const countFavorites = (favorites, kind) => {
  const safe = normalizeFavorites(favorites);
  return kind ? (safe[kind]?.length ?? 0) : FAVORITE_KINDS.reduce((sum, k) => sum + safe[k].length, 0);
};

export const hasAnyFavorites = (favorites) => countFavorites(favorites) > 0;

export const isFavorite = (favorites, kind, id) =>
  isKind(kind) && (favorites?.[kind] || []).some((item) => item?.id === Number(id));

export const isKindFull = (favorites, kind) =>
  isKind(kind) && (favorites?.[kind] || []).length >= MAX_FAVORITES;

/**
 * Ekler. Dolu, yinelenen ya da geçersizse AYNI referansı döner (React'te
 * gereksiz yeniden çizim olmasın, çağıran "değişti mi" diye `===` ile bakabilsin).
 */
export function addFavorite(favorites, kind, entry) {
  const base = normalizeFavorites(favorites);
  const clean = normalizeEntry(entry);
  if (!isKind(kind) || !clean) return favorites;
  if (base[kind].some((item) => item.id === clean.id)) return favorites;
  if (base[kind].length >= MAX_FAVORITES) return favorites;
  return { ...base, [kind]: [...base[kind], clean] };
}

/** Çıkarır. Yoksa aynı referans. */
export function removeFavorite(favorites, kind, id) {
  if (!isKind(kind) || !isFavorite(favorites, kind, id)) return favorites;
  const base = normalizeFavorites(favorites);
  return { ...base, [kind]: base[kind].filter((item) => item.id !== Number(id)) };
}

/** Seçiliyse çıkarır, değilse (yer varsa) ekler. */
export function toggleFavorite(favorites, kind, entry) {
  const id = Number(entry?.id);
  return isFavorite(favorites, kind, id)
    ? removeFavorite(favorites, kind, id)
    : addFavorite(favorites, kind, entry);
}

/** Sıra dahil eşitlik — "Kaydet" düğmesi buna bakar. */
export function favoritesEqual(a, b) {
  const left = normalizeFavorites(a);
  const right = normalizeFavorites(b);
  return FAVORITE_KINDS.every(
    (kind) =>
      left[kind].length === right[kind].length &&
      left[kind].every((item, i) => item.id === right[kind][i].id),
  );
}

/** Firestore'a yazılacak biçim (her zaman normalize, `undefined` içermez). */
export const toProfilePayload = (favorites) => normalizeFavorites(favorites);

/** Profil belgesinden okuma (alan yoksa boş). */
export const readProfileFavorites = (profile) => normalizeFavorites(profile?.fourFavorites);

/* ───────────────────────── Öneriler ───────────────────────── */

// Aynı anda çekilecek kaynak sayısı üst sınırı: 4 film + 4 oyuncu = 8 istek.
// Daha fazlası zaten olamaz ama sınır, ileride kategori eklenirse patlamayı önler.
const MAX_SOURCES = 8;

/**
 * Bu medya tipi için öneri kaynakları. Film rayı seçilen FİLMLERDEN ve
 * OYUNCULARDAN, dizi rayı seçilen DİZİLERDEN ve oyunculardan beslenir.
 * Çapraz tip (filmden dizi) yok: TMDB'nin öyle bir ucu yok, uydurma tür eşlemesi
 * de kötü öneri üretir.
 *
 * @returns {Array<{key:string, kind:"similar"|"credits", id:number, title:string, path:string}>}
 */
export function recommendationSources(favorites, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const base = normalizeFavorites(favorites);
  const own = type === "tv" ? base.shows : base.movies;
  const sources = [
    ...own.map((item) => ({
      key: `${type}-${item.id}`,
      kind: "similar",
      id: item.id,
      title: item.title,
      path: `/${type}/${item.id}/recommendations`,
    })),
    ...base.people.map((item) => ({
      key: `person-${item.id}`,
      kind: "credits",
      id: item.id,
      title: item.title,
      path: `/person/${item.id}/combined_credits`,
    })),
  ];
  return sources.slice(0, MAX_SOURCES);
}

/** Bu medya tipi için hiç kaynak var mı? Yoksa ray hiç eklenmez (boş yer tutmasın). */
export const hasRecommendationSignal = (favorites, mediaType) =>
  recommendationSources(favorites, mediaType).length > 0;

// Belgesel, haber, talk-show, reality: bir oyuncunun "kendisi olarak" çıktığı
// yapımlar. "Bu oyuncuyu seviyorum"dan "bu talk show'u öner" çıkmasın.
const NON_SCRIPTED_GENRES = new Set([99, 10763, 10764, 10767]);
const SELF_CREDIT = /\b(self|himself|herself|themselves|archive footage|uncredited)\b/i;
const MIN_CREDIT_VOTES = 150;

/**
 * Bir oyuncunun filmografisinden o medya tipindeki öneri adayları: kurgusal,
 * posterli, yeterince bilinen ve yetişkin işaretli olmayan yapımlar; en çok
 * oylanandan en aza.
 *
 * `adult` burada DAİMA elenir: ağ katmanındaki yetişkin süzgeci yalnız
 * `results` dizilerine bakar, `cast` dizisine bakmaz (utils/tmdbAdultGuard.js).
 */
export function creditsToCandidates(credits, mediaType, { limit = 15 } = {}) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const seen = new Set();
  const list = [];
  for (const item of Array.isArray(credits?.cast) ? credits.cast : []) {
    if (!item || item.media_type !== type || item.adult === true) continue;
    if (!isPositiveInt(Number(item.id)) || !item.poster_path) continue;
    if (SELF_CREDIT.test(String(item.character || ""))) continue;
    if ((item.genre_ids || []).some((id) => NON_SCRIPTED_GENRES.has(id))) continue;
    if (Number(item.vote_count || 0) < MIN_CREDIT_VOTES) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    list.push(item);
  }
  return list.sort((a, b) => Number(b.vote_count || 0) - Number(a.vote_count || 0)).slice(0, limit);
}

/**
 * Kaynak başına aday gruplarını TEK öneri listesinde birleştirir.
 *
 * Skor: bir kaynağın listesinde ne kadar üstteyse o kadar yüksek; aynı yapım
 * BİRDEN ÇOK favoriden çıkıyorsa skorlar toplanır — iki favorinin ortak önerisi
 * en üste çıkar. Her kaynağın 1. önerisi eşit skor aldığından tek bir favori
 * listeyi domine etmez (doğal dönüşümlü sıralama). Eşitlikte oy sayısı kıracı.
 *
 * @param {Array<{source:{key:string,title:string,kind:string}, items:Array}>} groups
 * @param {object} [options]
 * @param {Iterable<number|string>} [options.exclude] elenecek TMDB id'leri
 *   (favorilerin kendisi, izlenmişler...)
 * @returns {Array} TMDB nesneleri + `becauseOf: string[]` (hangi favorilerden geldi)
 */
export function rankRecommendations(groups, { exclude = [], limit = 30 } = {}) {
  const blocked = new Set([...exclude].map(String));
  const byId = new Map();
  for (const { source, items } of Array.isArray(groups) ? groups : []) {
    if (!source) continue;
    (Array.isArray(items) ? items : []).forEach((item, rank) => {
      if (!item || item.id == null || !item.poster_path) return;
      if (item.adult === true || blocked.has(String(item.id))) return;
      const key = String(item.id);
      const gain = 1 / (1 + rank * 0.12);
      const found = byId.get(key);
      if (!found) {
        byId.set(key, { item, score: gain, becauseOf: [source.title] });
        return;
      }
      found.score += gain;
      if (!found.becauseOf.includes(source.title)) found.becauseOf.push(source.title);
    });
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        b.score - a.score || Number(b.item.vote_count || 0) - Number(a.item.vote_count || 0),
    )
    .slice(0, limit)
    .map(({ item, becauseOf }) => ({ ...item, becauseOf }));
}

/** "Inception, Tom Hardy ve 2 diğeri" gibi altyazı için kısa özet. */
export function describeSources(sources, { limit = 2, more = (n) => `+${n}` } = {}) {
  const titles = [...new Set((sources || []).map((s) => s?.title).filter(Boolean))];
  if (titles.length <= limit) return titles.join(", ");
  return `${titles.slice(0, limit).join(", ")} ${more(titles.length - limit)}`;
}

/**
 * Yapay zekâ için bağlam bloğu. Favoriler kullanıcının AÇIKÇA söylediği en
 * güçlü zevk işaretidir; izleme geçmişinden (dolaylı) daha değerli olduğu için
 * modele ayrı ve başlıklı verilir. Boşsa "" döner.
 */
export function buildFavoritesPrompt(favorites) {
  const base = normalizeFavorites(favorites);
  const line = (label, items) =>
    items.length ? `${label}: ${items.map((item) => item.title).join(", ")}` : null;
  const lines = [
    line("Movies", base.movies),
    line("TV shows", base.shows),
    line("Actors", base.people),
  ].filter(Boolean);
  if (!lines.length) return "";
  return (
    "USER'S FOUR FAVORITES (hand-picked all-time favorites — the strongest taste signal. " +
    "Recommend things in the same spirit, but do NOT recommend these exact titles):\n" +
    lines.join("\n")
  );
}
