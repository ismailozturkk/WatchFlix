// utils/listSearch.js
//
// Liste ekranındaki ARAMANIN saf çekirdeği. Hiçbir import yok (RN, Firebase,
// axios, i18nText dahil) — jest yalnız saf modülleri çalıştırıyor, bkz.
// jest.config.js.
//
// NEDEN VAR: ListsScreen'de arama çubuğu eskiden "öğe sayısı > 12" ise
// gösteriliyordu; 12'nin altındaki listelerde ne arama ne de sıralama/filtre
// düğmesi vardı ve BOŞ listeye ekran içinden içerik eklemenin hiçbir yolu
// yoktu. Yeni yapıda arama HER ZAMAN açık ve İKİ KİPLİ:
//
//   • "list"   → ekrandaki listeyi süzer (eski davranış, eşiksiz)
//   • "global" → TMDB'de arar; seçilen sonuç LİSTEYE EKLENİR
//
// Kip seçimi kullanıcıya ait olduğundan (segment düğmesi) sorgu metni ORTAKTIR:
// "inter" yazıp global'e geçince aynı metin TMDB'de aranır.
//
// Buradaki her şey saf karar: hangi listeye hangi tip eklenebilir, ekleme bir
// izleme kaydı mı (tarih sorulmalı mı), TMDB sonucu nasıl tek biçime iner ve
// film+dizi aramaları tek sıralamada nasıl birleşir.

export const LIST_SEARCH_MODE = Object.freeze({
  IN_LIST: "list",
  GLOBAL: "global",
});

// TMDB araması için en az bu kadar karakter gerekir (SearchAll/MovieSearch ile
// aynı eşik — 1 harflik sorgu hem alakasız hem pahalı).
export const GLOBAL_SEARCH_MIN_CHARS = 2;

const MOVIE_ONLY = Object.freeze(["movie"]);
const TV_ONLY = Object.freeze(["tv"]);
const MOVIE_AND_TV = Object.freeze(["movie", "tv"]);

const mediaTypeOf = (value, fallback = "movie") => {
  if (value === "tv" || value === "movie") return value;
  return fallback === "tv" ? "tv" : "movie";
};

/**
 * Bu listeye hangi medya tipleri EKLENEBİLİR?
 * `watchedMovies` yalnız film, `watchedTv` yalnız dizi tutar (iki ayrı veri
 * modeli); favoriler/izlenecekler ve özel listeler karışıktır.
 */
export function listAcceptedTypes(listName) {
  if (listName === "watchedMovies") return MOVIE_ONLY;
  if (listName === "watchedTv") return TV_ONLY;
  return MOVIE_AND_TV;
}

/**
 * Bu listeye ekleme bir İZLEME kaydı mı?
 * İzlenenler listelerinde `dateAdded` istatistik/rozet hesaplarına giren gerçek
 * izleme tarihidir — "bugün" varsayılamaz, kullanıcıya sorulur. Diğer
 * listelerde alan yalnız "ne zaman eklendi" demek.
 */
export function listRequiresWatchDate(listName) {
  return listName === "watchedMovies" || listName === "watchedTv";
}

/**
 * Karşılaştırma için metni katlar: büyük/küçük harf, Türkçe ı/İ ve aksan
 * farkları silinir ("Genç" ↔ "genc", "İyi" ↔ "iyi").
 *
 * services/fuzzyMediaSearch.normalizeSearchText ile aynı işi yapar; oraya
 * bağlanmıyoruz çünkü o modül axios import ediyor ve bu dosyanın saf kalması
 * gerekiyor (10 satırlık kopya, bilinçli).
 */
export function foldText(value) {
  return String(value ?? "")
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Liste içi arama eşleşmesi. Boş sorgu HER öğeye uyar (süzme yok). */
export function matchesListQuery(item, query) {
  const needle = foldText(query);
  if (!needle) return true;
  return foldText(item?.name || item?.title || "").includes(needle);
}

/** Aynı TMDB id'li film ve dizi AYRI eserdir; anahtar tipi de taşır. */
export const mediaKey = (type, id) => `${mediaTypeOf(type)}_${id}`;

/**
 * Listedeki öğelerin anahtar kümesi — global sonuçta "zaten listede" rozetini
 * bu belirler.
 *
 * `fallbackType`: göç sırasında üretilmiş bazı watchedTv dokümanlarında `type`
 * alanı yok (bkz. watchedTvService.dedupeWatchedTvEntries); tip liste
 * anahtarından biliniyorsa buradan verilir.
 */
export function buildListKeySet(items, { fallbackType = "movie" } = {}) {
  const set = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || item.id == null) return;
    set.add(mediaKey(item.type ?? fallbackType, item.id));
  });
  return set;
}

/**
 * TMDB sonucunu (search/movie, search/tv, search/multi, movie|tv/popular)
 * ekranın kullandığı tek biçime indirger.
 *
 * TMDB ALAN ADLARI BİLİNÇLİ OLARAK KORUNUR (`media_type`, `poster_path`,
 * `genre_ids`): bu nesne olduğu gibi utils/listShare.mediaToListItem'a ve
 * utils/mediaFacts.applyFacts'e giriyor. Yeniden adlandırmak, ekleme yolunda
 * ikinci bir dönüşüm katmanı doğururdu.
 */
export function toCandidate(raw, { fallbackType = "movie" } = {}) {
  if (!raw || raw.id == null) return null;
  // Tipi BİLİNEN ama desteklenmeyen sonuç (search/multi'nin `person` kayıtları)
  // ELENİR — fallback'e düşseydi kişi, listeye film olarak eklenirdi. Tip hiç
  // yoksa (search/movie ve */popular yanıtları taşımıyor) çağıran bilir.
  const rawType = raw.media_type ?? raw.type;
  if (rawType != null && rawType !== "movie" && rawType !== "tv") return null;
  const type = mediaTypeOf(rawType, fallbackType);
  const title = raw.title || raw.name || "";
  const date = String(raw.release_date || raw.first_air_date || "");
  const rating = Number(raw.vote_average);
  const voteCount = Number(raw.vote_count);
  const popularity = Number(raw.popularity);

  return {
    id: raw.id,
    key: mediaKey(type, raw.id),
    media_type: type,
    type,
    // Composer'daki gibi hem `title` hem `name` dolu: tüketiciler ikisini de okuyor.
    title,
    name: title,
    poster_path: raw.poster_path || null,
    backdrop_path: raw.backdrop_path || null,
    genre_ids: Array.isArray(raw.genre_ids) ? raw.genre_ids : [],
    overview: typeof raw.overview === "string" ? raw.overview : "",
    year: /^\d{4}/.test(date) ? date.slice(0, 4) : "",
    rating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : 0,
    voteCount: Number.isFinite(voteCount) ? voteCount : 0,
    popularity: Number.isFinite(popularity) ? popularity : 0,
  };
}

/**
 * Ham sonuç dizisi → aday listesi. Listeye eklenemeyecek tipler (ör. kişi
 * sonuçları ya da film listesine düşen dizi) ELENİR; aynı eser iki kez gelirse
 * tekilleşir. Kaynak sıralaması KORUNUR (TMDB'nin alaka sırası).
 */
export function toCandidates(
  rawList,
  { fallbackType = "movie", acceptedTypes = MOVIE_AND_TV, limit = 40 } = {},
) {
  const allowed = new Set(acceptedTypes);
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(rawList) ? rawList : []) {
    const candidate = toCandidate(raw, { fallbackType });
    if (!candidate || !allowed.has(candidate.type)) continue;
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    out.push(candidate);
    if (out.length >= limit) break;
  }
  return out;
}

// Popülerlik ağırlığı — rankFuzzyCandidates ile aynı formül (oy sayısı 100'e
// bölünerek popülerliğe eklenir), sıralamalar arasında tutarlılık için.
const weightOf = (candidate) =>
  (candidate?.popularity || 0) + (candidate?.voteCount || 0) / 100;

/**
 * Film ve dizi aramalarının sonuçlarını TEK sıralamada birleştirir.
 *
 * Karışık listelerde iki ayrı uç noktaya (search/movie + search/tv) gidiliyor
 * ve her biri kendi içinde alakaya göre sıralı geliyor. Skorları doğrudan
 * kıyaslanamaz (popülerlik dizilerde tabandan farklı ölçekte), bu yüzden
 * SIRA numarası esas alınır: her grubun 1.'si, sonra her grubun 2.'si...
 * Eşitlik popülerlikle bozulur. Böylece tek tip sonuçları listenin başını
 * kaplamaz ve her grubun kendi alaka sırası bozulmaz.
 */
export function mergeRankedGroups(groups, { limit = 40 } = {}) {
  const scored = [];
  (Array.isArray(groups) ? groups : []).forEach((group) => {
    (Array.isArray(group) ? group : []).forEach((candidate, rank) => {
      if (candidate) scored.push({ candidate, rank });
    });
  });

  scored.sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : weightOf(b.candidate) - weightOf(a.candidate),
  );

  const seen = new Set();
  const out = [];
  for (const { candidate } of scored) {
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    out.push(candidate);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Listede EN ÇOK geçen tür adları (varsayılan ilk 3).
 *
 * Sorgu yokken gösterilen "ÖNERİLER" bloğu bununla kişiselleşir: liste bir
 * korku listesiyse öneri de korku gelsin, genel popülerler değil. Tür bilgisi
 * yoksa boş döner ve çağıran popülere düşer (bkz.
 * services/listQuickAdd.fetchSuggestionsForList).
 *
 * Liste öğeleri türü TMDB id'si olarak DEĞİL, yerelleştirilmiş AD olarak tutuyor
 * (bkz. utils/listShare.mediaToListItem) — bu yüzden burada ad sayılır, id'ye
 * çevirme işi servis katmanında TMDB tür tablosuyla yapılır.
 *
 * Aynı öğede tekrar eden tür bir kez sayılır; sıralama eşitliğinde ad'a göre
 * deterministik kırılır (aksi halde her açılışta farklı öneri gelirdi).
 */
export function topListGenres(items, { limit = 3 } = {}) {
  const counts = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const genres = Array.isArray(item?.genres) ? item.genres : [];
    const seenInItem = new Set();
    genres.forEach((raw) => {
      const name = String(raw ?? "").trim();
      // "-" bazı göç kayıtlarında "tür yok" anlamında yazılmış.
      if (!name || name === "-" || seenInItem.has(name)) return;
      seenInItem.add(name);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, Math.max(0, limit))
    .map(([name]) => name);
}

/**
 * Global aramaya çıkılmalı mı? (kip + sorgu uzunluğu)
 * Kısa sorguda ağa çıkmak yerine ekran "öneriler"i gösterir.
 */
export function shouldQueryGlobal(mode, query) {
  return (
    mode === LIST_SEARCH_MODE.GLOBAL &&
    String(query || "").trim().length >= GLOBAL_SEARCH_MIN_CHARS
  );
}
