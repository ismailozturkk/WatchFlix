// utils/listShare.js
//
// Liste paylaşımının SAF çekirdeği — Firebase/React yok, jest ile test edilir.
//
// İki yönlü bir köprü:
//   profil listesi  →  paylaşım medyası   (kendi listemi paylaşırken)
//   paylaşım medyası →  profil listesi     (paylaşılan listeyi kaydederken)
//
// İki tarafın alan adları tarihsel olarak farklı: profil listesi öğesi
// `{ id, type, name, imagePath, genres[] }`, paylaşım medyası ise TMDB arama
// sonucundan gelen `{ id, media_type, title/name, poster_path, genre_ids[] }`
// şeklinde. Dönüşümü tek yerde toplamak, kaydedilen listenin elle eklenmiş bir
// listeden ayırt edilemez olmasını sağlıyor (aynı alanlar, aynı tipler).

// Kök dokümanda öntanımlı alanlarla çakışan adlar: aynı ada izin verilirse
// liste oluşur ama UI filtresi onu "öntanımlı" sayıp gizler (ListsViewScreen
// içindeki RESERVED_LIST_NAMES ile birebir aynı olmalı).
export const RESERVED_LIST_NAMES = [
  "watchedTv",
  "favorites",
  "watchList",
  "watchedMovies",
  "customLists",
  "listOrder",
];

export const MAX_LIST_NAME_LENGTH = 60;
// Tek bir paylaşımdan kopyalanabilecek öğe tavanı. Kök doküman alanına
// yazıldığı için (1 MiB sınırı) sınırsız kopyalama bir kullanıcının tüm
// listelerini taşıyan dokümanı şişirebilir.
export const MAX_SHARED_LIST_ITEMS = 100;

// Süre okuyan ekranlar tek modül import etsin diye yeniden ihraç.
export {
  describeMediaMeta,
  formatMinutes,
  mediaMinutes,
  sumListMinutes,
} from "./mediaFacts";

const TMDB_POSTER_PREFIX = "https://image.tmdb.org/t/p/";

/**
 * Tam poster URL'inden TMDB yolunu geri çıkarır:
 * "https://image.tmdb.org/t/p/w500/abc.jpg" → "/abc.jpg"
 *
 * Eski paylaşımlarda `poster_path` yok, yalnız tam URL saklanmış; profil
 * listesi ise ham yol tutuyor (boyut seçimi görüntüleme anında yapılıyor).
 */
export function tmdbPathFromPoster(poster) {
  if (typeof poster !== "string" || !poster) return null;
  if (poster.startsWith("/")) return poster;
  if (!poster.startsWith(TMDB_POSTER_PREFIX)) return null;
  const rest = poster.slice(TMDB_POSTER_PREFIX.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? null : rest.slice(slash) || null;
}

const mediaTypeOf = (value, fallback = "movie") => {
  if (value === "tv" || value === "movie") return value;
  return fallback === "tv" ? "tv" : "movie";
};

/**
 * Profil listesi öğesi → composer'ın beklediği medya şekli.
 *
 * `fallbackType`: göç sırasında üretilmiş bazı watchedTv dokümanlarında `type`
 * alanı yok (bkz. watchedTvService.dedupeWatchedTvEntries). Tip listenin
 * kendisinden biliniyorsa buradan verilir; yoksa dizi "film" sayılıp yanlış
 * detay ekranına götürürdü.
 */
export function listItemToMedia(item, { fallbackType = "movie" } = {}) {
  if (!item || item.id == null) return null;
  const type = mediaTypeOf(item.type, fallbackType);
  const title = item.name || item.title || "";
  return {
    id: item.id,
    media_type: type,
    type,
    // Composer bazı yerlerde `title`, bazı yerlerde `name` okuyor; ikisi de dolu.
    title,
    name: title,
    poster_path: item.imagePath || item.poster_path || null,
    // Profil listesi tür ADI tutar, TMDB araması ise id. Adlar korunur ki
    // paylaşımdan geri kaydedildiğinde tür bilgisi kaybolmasın.
    genres: Array.isArray(item.genres) ? item.genres.filter((g) => typeof g === "string") : [],
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    // Süre/bölüm olguları: listede varsa composer'a girerken KAYBOLMAMALI.
    // Hem tekrar TMDB isteği atılmasını önlüyor (needsFacts kısa devresi) hem
    // de aktarılan listenin süresi anında görünüyor.
    minutes: Number.isFinite(item.minutes) ? item.minutes : null,
    episodeMinutes: Number.isFinite(item.episodeMinutes) ? item.episodeMinutes : null,
    episodeCount: Number.isFinite(item.episodeCount) ? item.episodeCount : null,
    seasonCount: Number.isFinite(item.seasonCount) ? item.seasonCount : null,
    totalMinutes: Number.isFinite(item.totalMinutes) ? item.totalMinutes : null,
    factsAt: Number.isFinite(item.factsAt) ? item.factsAt : null,
  };
}

/**
 * Paylaşımdaki medya (veya composer seçimi) → profil listesi öğesi.
 *
 * Buradaki alan kuralı paylaşım dokümanınınkinin TERSİ: değer yoksa anahtar
 * HİÇ KONMAZ. listItemsService.normalizeItem `!= null` bakıyor ve Firestore
 * `undefined` kabul etmiyor.
 *
 * `genreMap` verilirse tür id'leri KAYDEDENİN dilinde ada çevrilir; böylece
 * paylaşanın dili alıcının listesine donmuş olarak geçmez.
 */
export function mediaToListItem(media, { dateAdded = null, genreMap = null } = {}) {
  if (!media || media.id == null) return null;
  const type = mediaTypeOf(media.media_type || media.type);

  const namedGenres = Array.isArray(media.genres)
    ? media.genres.filter((genre) => typeof genre === "string" && genre.trim())
    : [];
  const genres = namedGenres.length
    ? namedGenres
    : genreMap && Array.isArray(media.genre_ids)
      ? media.genre_ids.map((id) => genreMap[id]).filter(Boolean)
      : [];

  const item = {
    id: media.id,
    type,
    name: media.title || media.name || "",
    imagePath: media.poster_path || tmdbPathFromPoster(media.poster),
    dateAdded,
    genres,
  };

  if (type === "movie") {
    if (Number.isFinite(media.minutes)) item.minutes = media.minutes;
    return item;
  }

  if (Number.isFinite(media.episodeMinutes)) item.episodeMinutes = media.episodeMinutes;
  if (Number.isFinite(media.episodeCount)) item.episodeCount = media.episodeCount;
  if (Number.isFinite(media.seasonCount)) item.seasonCount = media.seasonCount;
  // `totalMinutes` YALNIZ profil listesi öğesinde ve TÜRETİLMİŞ: ListsScreen'in
  // süre rozeti ve sıralaması diziler için zaten bu alanı okuyor. Paylaşım
  // dokümanına yazılmaz — watchedTv modelinde "izlenen dakika" demek.
  const derived = Number.isFinite(media.totalMinutes)
    ? media.totalMinutes
    : Number.isFinite(media.episodeMinutes) && Number.isFinite(media.episodeCount)
      ? media.episodeMinutes * media.episodeCount
      : null;
  if (Number.isFinite(derived) && derived > 0) item.totalMinutes = derived;
  return item;
}

/**
 * Bir paylaşımın medya listesini profile yazılabilir öğe dizisine çevirir.
 * Aynı eser iki kez geçiyorsa tekilleştirir (kaynak paylaşım elle kurulmuş
 * olabilir) ve tavanı aşan kuyruğu atar.
 */
export function sharedListToItems(
  mediaList = [],
  { dateAdded = null, genreMap = null, limit = MAX_SHARED_LIST_ITEMS } = {},
) {
  const seen = new Set();
  const items = [];
  for (const media of mediaList || []) {
    const item = mediaToListItem(media, { dateAdded, genreMap });
    if (!item) continue;
    const key = `${item.type}_${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

/**
 * Çakışmayan bir liste adı üretir: "Ad" doluysa "Ad (2)", "Ad (3)"…
 * Rezerve adlar da dolu sayılır. Ad boşsa ya da 99 denemede boş yer
 * bulunamazsa null döner (çağıran tarafın hata göstermesi gerekir).
 */
export function resolveListName(name, existingNames = []) {
  const base = String(name ?? "").trim().slice(0, MAX_LIST_NAME_LENGTH).trim();
  if (!base) return null;

  const taken = new Set([
    ...(existingNames || []).map((value) => String(value)),
    ...RESERVED_LIST_NAMES,
  ]);
  if (!taken.has(base)) return base;

  for (let index = 2; index <= 99; index += 1) {
    const suffix = ` (${index})`;
    const candidate = `${base.slice(0, MAX_LIST_NAME_LENGTH - suffix.length).trim()}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Kaydetme sayfasının canlı durumu: kullanılacak ad ne olacak, kullanıcının
 * yazdığından farklı mı (uyarı gösterilecek mi), kaydedilebilir mi.
 */
export function describeSaveTarget(name, existingNames = [], itemCount = 0) {
  const typed = String(name ?? "").trim();
  const resolved = resolveListName(typed, existingNames);
  return {
    resolvedName: resolved,
    // Kullanıcı "Filmler" yazdı ama "Filmler (2)" olarak kaydedilecekse
    // bunu SÖYLEMEK gerekiyor; sessizce yeniden adlandırmak sürpriz olurdu.
    renamed: !!resolved && !!typed && resolved !== typed,
    canSave: !!resolved && itemCount > 0,
  };
}
