// utils/mediaFacts.js
//
// Paylaşım medyasının "olguları" (süre, bölüm/sezon sayısı, tür adları) —
// SAF çekirdek. Hiçbir import yok: RN, Firebase, axios, i18nText dahil.
//
// NEDEN VAR: composer'daki TMDB ARAMA sonucu hafiftir (id, title, poster_path,
// genre_ids, release_date) — süre YOKTUR. Profil listesi öğesi ise `minutes`
// bekler ve bu alan gerçekten okunur (ListsScreen süre rozeti + liste toplamı,
// FriendProfileScreen toplam dakika). Bu yüzden paylaşılan bir liste profile
// kaydedilince öğeler süresiz gidiyordu. Detayı TMDB'den çekmek gerekiyor ve
// "hangi öğe için istek gerekli", "gelen detaydan ne çıkarılır", "eldeki değer
// nasıl korunur" kararlarının TAMAMI burada — başka hiçbir dosyada `minutes`
// üzerinde aritmetik ya da koşul yok.
//
// ALAN SÖZLEŞMESİ (iki farklı kural, karıştırmayın):
//   • Paylaşım dokümanı (Posts.mediaList[]): alan HER ZAMAN yazılır, değer
//     yoksa `null`. Firestore `undefined` kabul etmez.
//   • Profil listesi öğesi: değer yoksa ANAHTAR HİÇ KONMAZ (normalizeItem
//     `!= null` sözleşmesiyle çalışıyor).
//
// `minutes` YALNIZ filmde anlamlıdır. Diziye asla yazılmaz: toplam izleme
// süresi hesapları `movies.reduce((a, m) => a + (m.minutes || 0), 0)` deseniyle
// çalışıyor, diziye minutes sızdırmak o toplamları ve rank rengini şişirirdi.

export const FACT_KEYS = [
  "minutes",
  "episodeMinutes",
  "episodeCount",
  "seasonCount",
  "factsAt",
];

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const typeOf = (media) => {
  const raw = media?.media_type || media?.type;
  return raw === "tv" ? "tv" : "movie";
};

export function langOf(language) {
  return language === "tr" || language === "tr-TR" ? "tr-TR" : "en-US";
}

/** Olgu haritalarının anahtarı. Aynı TMDB id'li film ve dizi AYRI kayıttır. */
export function factsKey(idOrMedia, type) {
  if (idOrMedia && typeof idOrMedia === "object") {
    return `${typeOf(idOrMedia)}:${idOrMedia.id}`;
  }
  return `${type === "tv" ? "tv" : "movie"}:${idOrMedia}`;
}

/**
 * Detay isteğinin URL'i. `append_to_response` BİLİNÇLİ OLARAK YOK: yalnız
 * runtime/tür/bölüm sayısı gerekiyor, credits+videos+images eklemek gövdeyi
 * 20-50 kat şişirirdi ve bu istek 100 öğe için atılabiliyor.
 */
export function factsUrl({ id, mediaType, language }) {
  const type = mediaType === "tv" ? "tv" : "movie";
  return `https://api.themoviedb.org/3/${type}/${id}?language=${langOf(language)}`;
}

/** TMDB detay gövdesinden olguları çıkarır. Bozuk girdide null döner. */
export function extractMediaFacts(details, mediaType) {
  if (!details || typeof details !== "object" || details.id == null) return null;
  const type = mediaType === "tv" ? "tv" : "movie";

  // Dizide bölüm süresi iki yerde olabiliyor: episode_run_time çoğu zaman dolu,
  // yeni/az bölümlü dizilerde boş kalıp yalnız son bölümde bulunuyor.
  const episodeMinutes =
    type === "tv"
      ? (Array.isArray(details.episode_run_time)
          ? details.episode_run_time.map(num).find((value) => value != null)
          : null) ?? num(details.last_episode_to_air?.runtime)
      : null;

  return {
    id: details.id,
    type,
    title: details.title || details.name || "",
    year: String(details.release_date || details.first_air_date || "").slice(0, 4),
    // Ham yayın tarihi + TMDB durumu: `year` izleme kapısına yetmiyor (aynı yıl
    // içinde ileri tarihli olabilir) — bkz. utils/watchState.js.
    releaseDate: details.release_date || details.first_air_date || "",
    status: typeof details.status === "string" ? details.status : "",
    genres: (Array.isArray(details.genres) ? details.genres : [])
      .map((genre) => genre?.name)
      .filter((name) => typeof name === "string" && name.trim()),
    minutes: type === "movie" ? num(details.runtime) : null,
    episodeMinutes: episodeMinutes ?? null,
    episodeCount: type === "tv" ? num(details.number_of_episodes) : null,
    seasonCount: type === "tv" ? num(details.number_of_seasons) : null,
  };
}

/**
 * Bu öğe için detay isteği gerekli mi?
 * Profilden aktarılan film (minutes + genres dolu) istek DOĞURMAZ.
 */
export function needsFacts(media) {
  if (!media || media.id == null) return false;
  // Bir kez çözüldüyse tekrar sorma: TMDB'de gerçekten süresi olmayan öğe
  // her açılışta yeniden istek üretmesin.
  if (Number.isFinite(media.factsAt)) return false;

  const runtimeMissing =
    typeOf(media) === "movie"
      ? !Number.isFinite(media.minutes)
      : !Number.isFinite(media.episodeMinutes) && !Number.isFinite(media.episodeCount);
  const genreMissing =
    !(media.genres?.length > 0) && !(media.genre_ids?.length > 0);

  return runtimeMissing || genreMissing;
}

/** Detay çekilecek öğelerin tekilleştirilmiş listesi. */
export function pickFactTargets(list, { limit = 100 } = {}) {
  const seen = new Set();
  const targets = [];
  for (const media of Array.isArray(list) ? list : []) {
    if (!needsFacts(media)) continue;
    const key = factsKey(media);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ id: media.id, type: typeOf(media) });
    if (targets.length >= limit) break;
  }
  return targets;
}

/**
 * Olguları bir medya nesnesine işler.
 * MEVCUT DOLU DEĞERİ ASLA null ile EZMEZ (profilden gelen süre korunur).
 * Hiçbir alan değişmediyse AYNI referansı döndürür — bu, hidrasyon effect'inin
 * kendi yazdığını tetiklemesini yapısal olarak imkânsız kılıyor.
 */
export function applyFacts(media, facts, { now } = {}) {
  if (!media || !facts) return media;

  const keep = (next, current) => (Number.isFinite(next) ? next : Number.isFinite(current) ? current : null);
  const incoming = facts.genres?.length
    ? facts.genres
    : Array.isArray(media.genres)
      ? media.genres
      : [];
  // Aynı türler yeni bir dizi nesnesiyle gelirse referans değişir ve öğe
  // "değişti" sayılırdı; içerik aynıysa ESKİ referans korunur (referans
  // kararlılığı hidrasyon effect'inin kendini tetiklemesini engelliyor).
  const sameGenres =
    Array.isArray(media.genres) &&
    media.genres.length === incoming.length &&
    incoming.every((name, index) => name === media.genres[index]);
  const genres = sameGenres ? media.genres : incoming;

  const merged = {
    ...media,
    genres,
    minutes: keep(facts.minutes, media.minutes),
    episodeMinutes: keep(facts.episodeMinutes, media.episodeMinutes),
    episodeCount: keep(facts.episodeCount, media.episodeCount),
    seasonCount: keep(facts.seasonCount, media.seasonCount),
    factsAt: Number.isFinite(facts.resolvedAt) ? facts.resolvedAt : (now ?? Date.now()),
  };

  const changed =
    merged.minutes !== (media.minutes ?? null) ||
    merged.episodeMinutes !== (media.episodeMinutes ?? null) ||
    merged.episodeCount !== (media.episodeCount ?? null) ||
    merged.seasonCount !== (media.seasonCount ?? null) ||
    merged.factsAt !== media.factsAt ||
    merged.genres !== media.genres;

  return changed ? merged : media;
}

/**
 * Olgu haritasını/dizisini listeye işler. Listenin O ANKİ hali esas alınır:
 * hidrasyon sürerken kullanıcı bir öğeyi sildiyse o öğe DİRİLMEZ, sıralama
 * korunur. Hiçbir öğe değişmediyse AYNI dizi referansı döner.
 */
export function mergeFactsIntoList(list, factsMapOrArray, { now } = {}) {
  const source = Array.isArray(list) ? list : [];
  if (!factsMapOrArray) return source;

  const byKey = new Map();
  const entries =
    typeof factsMapOrArray.forEach === "function" && !Array.isArray(factsMapOrArray)
      ? [...factsMapOrArray.values()]
      : Array.isArray(factsMapOrArray)
        ? factsMapOrArray
        : [factsMapOrArray];
  entries.forEach((facts) => {
    if (facts && facts.id != null) byKey.set(factsKey(facts), facts);
  });
  if (byKey.size === 0) return source;

  let changed = false;
  const next = source.map((media) => {
    const facts = byKey.get(factsKey(media));
    if (!facts) return media;
    const applied = applyFacts(media, facts, { now });
    if (applied !== media) changed = true;
    return applied;
  });

  return changed ? next : source;
}

/**
 * Bir öğenin toplam süresi (dk) — bilinmiyorsa null (0 DEĞİL).
 * null dönmesi "0 dk" yazdırmayı imkânsız kılıyor: 0 dk yanlış bilgidir.
 */
export function mediaMinutes(media) {
  if (!media) return null;
  if (typeOf(media) === "movie") {
    return Number.isFinite(media.minutes) ? media.minutes : null;
  }
  if (Number.isFinite(media.totalMinutes)) return media.totalMinutes;
  return Number.isFinite(media.episodeMinutes) && Number.isFinite(media.episodeCount)
    ? media.episodeMinutes * media.episodeCount
    : null;
}

/** Liste toplamı + kaç öğenin süresinin bilindiği. Hiçbir girdide NaN üretmez. */
export function sumListMinutes(list) {
  let total = 0;
  let known = 0;
  let unknown = 0;
  (Array.isArray(list) ? list : []).forEach((media) => {
    const minutes = mediaMinutes(media);
    if (Number.isFinite(minutes) && minutes > 0) {
      total += minutes;
      known += 1;
    } else {
      unknown += 1;
    }
  });
  return { total, known, unknown };
}

/**
 * "45 dk" / "1 sa" / "2 sa 8 dk". Etiketler PARAMETRE: bu modül i18nText
 * import etmiyor (saf kalmalı, jest yalnız saf modülleri çalıştırabiliyor).
 * Değer yoksa null → bileşen hiç render etmesin.
 */
export function formatMinutes(minutes, { hourLabel = "sa", minuteLabel = "dk" } = {}) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} ${minuteLabel}`;
  if (mins === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} ${mins} ${minuteLabel}`;
}

/**
 * Poster üstü kısa bilgi: film "128 dk", dizi "5 sezon · 62 bölüm"
 * (sayı yoksa "45 dk/bölüm"). Hiçbir veri yoksa null.
 */
export function describeMediaMeta(media, labels = {}) {
  if (!media) return null;
  const {
    hourLabel = "sa",
    minuteLabel = "dk",
    seasonLabel = "sezon",
    episodeLabel = "bölüm",
    perEpisodeLabel = "dk/bölüm",
  } = labels;

  if (typeOf(media) === "movie") {
    return formatMinutes(media.minutes, { hourLabel, minuteLabel });
  }

  const parts = [];
  if (Number.isFinite(media.seasonCount) && media.seasonCount > 0) {
    parts.push(`${media.seasonCount} ${seasonLabel}`);
  }
  if (Number.isFinite(media.episodeCount) && media.episodeCount > 0) {
    parts.push(`${media.episodeCount} ${episodeLabel}`);
  }
  if (parts.length > 0) return parts.join(" · ");
  return Number.isFinite(media.episodeMinutes) && media.episodeMinutes > 0
    ? `${media.episodeMinutes} ${perEpisodeLabel}`
    : null;
}

/**
 * Listenin KİMLİK imzası — olgulardan bağımsız. Taslak karşılaştırması ve
 * effect bağımlılığı bunu kullanır; aksi halde asenkron zenginleşme taslağı
 * "değişmiş" gösterir ve effect kendini yeniden tetikler.
 */
export function mediaSignature(list) {
  return (Array.isArray(list) ? list : [])
    .map((media) => `${typeOf(media)}:${media?.id}`)
    .join(",");
}

/** Yerel "YYYY-MM-DD" — liste öğesinin dateAdded biçimi. */
export function todayListDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
