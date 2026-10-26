// utils/libraryCore.js
//
// "Listeye ekle / izlendi işaretle" altyapısının SAF çekirdeği — Firebase,
// React, axios yok; jest ile doğrudan test edilir. Yazma servisleri
// (listItemsService / watchedTvService) ve orkestrasyon katmanı
// (services/libraryActions) bunun üstüne kurulur.
//
// NEDEN VAR: ekleme/izlendi yazan ekran sayısı 12'yi geçmişti ve her biri aynı
// dört şeyi kendi başına yapıyordu: (1) TMDB detayından liste öğesi kurmak,
// (2) hatayı kullanıcıya göstermek, (3) çift dokunuşu/yarışı önlemek,
// (4) diziyi işaretlemek için sezonları çekmek. Kopyalar birbirinden sapmıştı
// (ör. dizi detayından eklenen öğede bölüm süresi yok, hızlı eklemede var; özel
// listeye yazan iki ekran hâlâ kilitsiz oku-değiştir-yaz yapıyordu). Karar
// verilen her şey burada TEK yerde.

import { applyFacts, extractMediaFacts } from "./mediaFacts";
import { mediaToListItem, RESERVED_LIST_NAMES } from "./listShare";
import { WATCH_BLOCKED } from "./watchState";

// ── Anahtarlar ───────────────────────────────────────────────────────────────

export const normalizeMediaType = (type) => (type === "tv" ? "tv" : "movie");

/** Belge kimliği şeması: `${type}_${id}` — TÜM liste koleksiyonlarında aynı. */
export const mediaKey = (type, id) => `${normalizeMediaType(type)}_${id}`;

/**
 * Öntanımlı "üyelik" listeleri: öğe başına belge, ekle/çıkar basit bir bayrak.
 * İzlenen film/dizi BURADA DEĞİL — onlar üyelik değil izleme olayı yazar.
 */
export const MEMBERSHIP_LISTS = Object.freeze(["favorites", "watchList"]);

export const isMembershipList = (listName) => MEMBERSHIP_LISTS.includes(listName);

export const MEMBERSHIP_FLAG = Object.freeze({
  favorites: "inFavorites",
  watchList: "inWatchList",
});

/** Özel liste adı olarak kullanılabilir mi? (kök dokümandaki öntanımlı alanlar hariç) */
export const isCustomListName = (name) =>
  typeof name === "string" &&
  name.trim().length > 0 &&
  !RESERVED_LIST_NAMES.includes(name);

/** Kök dokümandaki dizi girdisi bu eser mi? (id string/number karışımına dayanıklı) */
export const isSameMedia = (entry, id, type) =>
  !!entry &&
  String(entry.id) === String(id) &&
  normalizeMediaType(entry.type) === normalizeMediaType(type);

/** Özel listede (kök dizi modeli) eser var mı? */
export const customListHas = (allLists, listName, id, type) => {
  const items = allLists?.[listName];
  return Array.isArray(items) && items.some((entry) => isSameMedia(entry, id, type));
};

// ── Hata sınıflaması ─────────────────────────────────────────────────────────

export const LIBRARY_ERROR = Object.freeze({
  OFFLINE: "offline",
  PERMISSION: "permission",
  CONFLICT: "conflict",
  QUOTA: "quota",
  UNRELEASED: WATCH_BLOCKED.UNRELEASED,
  UNKNOWN_RELEASE: WATCH_BLOCKED.UNKNOWN_DATE,
  SEASONS_INCOMPLETE: "seasons-incomplete",
  LIST_RESERVED: "list-name-reserved",
  LIST_CONFLICT: "list-name-conflict",
  INVALID: "invalid-request",
  // Günlük 1440 dk izleme sınırı (utils/dailyWatchLimit). `error.details`: { reason, day, used, remaining, requested }.
  DAILY_LIMIT: "daily-watch-limit",
  UNKNOWN: "unknown",
});

const KNOWN_CODES = new Set(Object.values(LIBRARY_ERROR));

// Kullanıcı tekrar denediğinde işe yarayabilecek hatalar.
const RETRYABLE = new Set([
  LIBRARY_ERROR.OFFLINE,
  LIBRARY_ERROR.CONFLICT,
  LIBRARY_ERROR.SEASONS_INCOMPLETE,
  LIBRARY_ERROR.UNKNOWN,
]);

const OFFLINE_FIRESTORE_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "cancelled",
]);
const OFFLINE_NETWORK_CODES = new Set([
  "ERR_NETWORK",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNRESET",
]);

/**
 * Herhangi bir hatayı kararlı bir koda indirger. Firestore, axios ve bu
 * katmanın kendi hataları tek sözlükte: ekran `error.message`'a (ham, çoğu
 * zaman İngilizce SDK metni) değil koda bakıp yerelleştirilmiş metin seçer.
 *
 * @returns {{ code: string, retryable: boolean }}
 */
export function classifyLibraryError(error) {
  const raw = String(error?.code ?? "").replace(/^firestore\//, "");
  const message = String(error?.message ?? "");

  let code = LIBRARY_ERROR.UNKNOWN;
  if (KNOWN_CODES.has(raw)) {
    code = raw;
  } else if (
    OFFLINE_FIRESTORE_CODES.has(raw) ||
    OFFLINE_NETWORK_CODES.has(raw) ||
    /client is offline|network error|network request failed|timeout of \d+ms/i.test(message)
  ) {
    code = LIBRARY_ERROR.OFFLINE;
  } else if (raw === "permission-denied" || raw === "unauthenticated") {
    code = LIBRARY_ERROR.PERMISSION;
  } else if (raw === "aborted" || raw === "failed-precondition") {
    code = LIBRARY_ERROR.CONFLICT;
  } else if (raw === "resource-exhausted") {
    code = LIBRARY_ERROR.QUOTA;
  } else if (raw === "invalid-argument") {
    code = LIBRARY_ERROR.INVALID;
  }
  return { code, retryable: RETRYABLE.has(code) };
}

/** Katmanın dışına çıkan her hata bu sınıftır; `code` ekranların sözleşmesi. */
export class LibraryError extends Error {
  constructor(code, message, { cause, retryable, details } = {}) {
    super(message || code);
    this.name = "LibraryError";
    this.code = code;
    this.retryable = retryable ?? RETRYABLE.has(code);
    if (cause !== undefined) this.cause = cause;
    if (details !== undefined) this.details = details;
  }
}

/** Zaten LibraryError ise aynen döner; değilse sınıflayıp sarar (idempotent). */
export function toLibraryError(error) {
  // `name` yedeği: Error'ı genişleten sınıflarda `instanceof` derleyici ayarına
  // göre kırılabiliyor; ad kontrolü her derleme hedefinde çalışır.
  if (error instanceof LibraryError || error?.name === "LibraryError") return error;
  const { code, retryable } = classifyLibraryError(error);
  return new LibraryError(code, error?.message, { cause: error, retryable });
}

// ── Sıra kuyruğu ─────────────────────────────────────────────────────────────

/**
 * Anahtar başına SIRALI çalıştırıcı. Aynı anahtardaki işler art arda, farklı
 * anahtarlar paralel çalışır; bir işin hatası sonrakini engellemez.
 *
 * NEDEN: kalp/izleme listesi düğmesine hızlı iki kez basmak (ekle→çıkar) iki
 * transaction'ı AYNI belgeye aynı anda gönderiyordu; sunucu hangisini son
 * işlediyse o kalıyor, yerel önbellek ise hangisi son BİTTİYSE onu gösteriyordu.
 * İkisi ayrışınca ekran gerçeği göstermiyordu. Aynı dizinin iki bölümünü
 * art arda işaretlemek de aynı belgede gereksiz transaction çatışması üretiyordu.
 */
export function createKeyedQueue() {
  const tails = new Map();
  return {
    run(key, task) {
      const previous = tails.get(key) || Promise.resolve();
      const result = previous.then(() => task());
      const tail = result.then(
        () => undefined,
        () => undefined,
      );
      tails.set(key, tail);
      tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key);
      });
      return result;
    },
    isBusy: (key) => tails.has(key),
    get size() {
      return tails.size;
    },
  };
}

/**
 * Sınırlı eşzamanlılıkla haritalar; İLK hatada reddeder (kısmi sonuç yok).
 * `mapWithConcurrency` (upNextService) hatayı null'a çevirir — "yarım sezon
 * listesiyle diziyi izlendi yazmak" için o davranış yanlış (bkz. fetchShowSeasons).
 */
export async function mapConcurrentStrict(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let cursor = 0;
  let failure = null;
  const worker = async () => {
    while (cursor < list.length && failure === null) {
      const index = cursor++;
      try {
        results[index] = await mapper(list[index], index);
      } catch (error) {
        failure = failure || { error };
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), list.length) }, worker),
  );
  if (failure) throw failure.error;
  return results;
}

// ── Kanonik öğe / meta kurucuları ────────────────────────────────────────────

const genreNames = (details) =>
  (Array.isArray(details?.genres) ? details.genres : [])
    .map((genre) => genre?.name)
    .filter((name) => typeof name === "string" && name.trim());

/**
 * TMDB DETAY gövdesinden profil listesi öğesi. Hızlı eklemeyle (listQuickAdd)
 * AYNI alan sözleşmesi: film `minutes`, dizi `episodeMinutes/episodeCount/
 * seasonCount/totalMinutes` — süre rozeti ve profil toplamı bunları okuyor.
 * Eskiden detay ekranları diziye yalnız ad/poster/tür yazıyordu, yani aynı dizi
 * hangi kapıdan eklendiğine göre süreli ya da süresiz görünüyordu.
 */
export function listItemFromDetails(details, type, { dateAdded = null } = {}) {
  if (!details || details.id == null) return null;
  const kind = normalizeMediaType(type);
  const media = {
    id: details.id,
    type: kind,
    media_type: kind,
    title: details.title || details.name || "",
    poster_path: details.poster_path || null,
    genres: genreNames(details),
  };
  const facts = extractMediaFacts(details, kind);
  return mediaToListItem(facts ? applyFacts(media, facts) : media, { dateAdded });
}

/**
 * Liste yazımının kaynağı: TMDB detay gövdesi, yoksa elde olan kart verisi.
 *
 * Hızlı eylem sayfası detayı ağdan çeker; çevrimdışıyken detay hiç gelmiyor ve
 * izleme listesi / favori yazımı sessizce atlanıyordu, düğme ise "eklendi"
 * görünüyordu (T3 B14). Kartta id + ad + afiş var; süre/tür olguları sonradan
 * ilk detay açılışında tamamlanabilir, liste üyeliği için bunlar yeter.
 */
export function listSourceOrCard(details, { id, title, posterPath } = {}) {
  if (details && details.id != null) return details;
  if (id == null) return null;
  return { id, title: title || "", name: title || "", poster_path: posterPath || null };
}

/**
 * İzlenen film yazımı için öğe: liste öğesi + yayın kapısı alanları
 * (`releaseDate`/`status` Firestore'a YAZILMAZ — normalizeItem beyaz liste).
 */
export function movieWatchItemFromDetails(details, { dateAdded = null } = {}) {
  const item = listItemFromDetails(details, "movie", { dateAdded });
  if (!item) return null;
  return {
    ...item,
    releaseDate: details.release_date || null,
    status: details.status || null,
  };
}

/** Dizi işaretleme meta'sı (watchedTvService.markShow/markEpisodes `showMeta`). */
export function showMetaFromDetails(details, fallback = {}) {
  if (!details || details.id == null) return null;
  return {
    id: details.id,
    name: details.name || fallback.name || "",
    showEpisodeCount: details.number_of_episodes || 0,
    showSeasonCount: details.number_of_seasons || 0,
    imagePath: details.poster_path || fallback.imagePath || null,
    genres: genreNames(details),
    // Yayın kapısı için — belgeye yazılmaz (buildShowMeta beyaz liste).
    firstAirDate: details.first_air_date,
    status: details.status,
  };
}

/** TMDB bölüm gövdesi → servisin beklediği bölüm şekli. */
export function episodeFromTmdb(episode) {
  return {
    episodeNumber: episode.episode_number,
    episodePosterPath: episode.still_path || null,
    episodeName: episode.name || "Unknown",
    episodeRatings: parseFloat(Number(episode.vote_average || 0).toFixed(1)) || 0,
    episodeMinutes: episode.runtime || 0,
    // Alan BİLİNÇLİ olarak her zaman var (null olsa da): filterWatchableEpisodes
    // alanın yokluğunu "eski çağıran, kapı yok" sayar; TMDB tarihi bilmiyorsa
    // kapı kapalı kalmalı.
    releaseDate: episode.air_date || null,
  };
}

/** Dizi detayındaki sezonlardan işaretlenebilir olanlar (özel bölümler/boş sezonlar hariç). */
export const watchableSeasonsOf = (details) =>
  (Array.isArray(details?.seasons) ? details.seasons : []).filter(
    (season) => season?.season_number && season?.episode_count > 0,
  );
