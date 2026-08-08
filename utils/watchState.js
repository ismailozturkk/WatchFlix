// utils/watchState.js
//
// Dizi/sezon/bölüm "izlenme durumu" için TEK kaynak — saf (Firestore'dan bağımsız)
// durum makinesi. show / sezon / bölüm butonları aynı 4 durumu paylaşır:
//   unaired → yayınlanmadı (🔔 Hatırlat)
//   none    → hiç izlenmedi (İzle)
//   partial → kısmen izlendi (İzleniyor)   [bölümde kullanılmaz]
//   full    → tamamı izlendi (İzlendi)

import { parseAirDate } from "./airDate";

export const WATCH_STATE = {
  UNAIRED: "unaired",
  NONE: "none",
  PARTIAL: "partial",
  FULL: "full",
};

// NOT: Tarih ayrıştırması parseAirDate'e devredildi. Düz `new Date("2026-07-26")`
// tarih-only değeri UTC gece yarısı çözüyor; UTC+3'te bölüm yayın gününde saat
// 03:00'a kadar "yayınlanmadı", UTC-5'te ise bir gün erken "yayınlandı"
// görünüyordu — "İzle/Hatırlat" butonu ve puanlama kilidi yanlış anda değişiyordu.

// Bir yayın tarihi geçmiş mi? Tarih yoksa/geçersizse "henüz yayınlanmadı" sayılır.
export function isAired(dateStr) {
  const d = parseAirDate(dateStr);
  if (!d) return false;
  return d.getTime() <= Date.now();
}

// Yayın tarihi GELECEKTE mi? (puanlama kilidi vb. için) — sadece NET biçimde
// ileri tarihli içerik kilitlenir. isAired'in tersi DEĞİLDİR: tarih yok/geçersizse
// isAired false (unaired) döner ama burada false (kilitsiz) döneriz; böylece
// yayın tarihi bilinmeyen eski içerikler yanlışlıkla kilitlenmez.
export function isUnreleased(dateStr) {
  const d = parseAirDate(dateStr);
  if (!d) return false;
  return d.getTime() > Date.now();
}

/* ── "İzlendi" işaretlenebilir mi? ──────────────────────────────────────────
 *
 * İzleme kaydı yazan TÜM yolların (film detayı, dizi detayı, listeye hızlı
 * ekleme, servis katmanı) paylaştığı tek karar noktası. Üç durum var:
 *
 *   released  → tarih geçmiş  → izlendi işaretlenebilir
 *   scheduled → tarih İLERİDE → izlendi kapalı, yerine hatırlatma
 *   unknown   → tarih YOK ya da geçersiz → izlendi de kapalı
 *
 * `unknown` neden ayrı: boş tarih eskiden hiçbir yerde "ileri tarih" sayılmıyor,
 * sessizce "sorun yok" tarafına düşüyordu. TMDB'de tarihi henüz girilmemiş
 * yapımların çoğu duyurulmuş ama takvime girmemiş işlerdir; bunlar izlendi
 * olarak eklenince izleme süresi, rozetler ve Wrapped hesapları bozuluyordu.
 *
 * Tarihi TMDB'ye hiç girilmemiş ESKİ yapımlar mağdur olmasın diye `status`
 * alanına ikinci bir şans veriliyor: "Released"/"Ended"/"Returning Series"
 * tarih olmadan da yayınlandı sayılır. "Canceled" BİLEREK dışarıda — hiç
 * yayınlanmadan iptal edilen yapımlar da o değeri alıyor.
 */
export const RELEASE_STATE = {
  RELEASED: "released",
  SCHEDULED: "scheduled",
  UNKNOWN: "unknown",
};

const RELEASED_STATUSES = new Set(["released", "ended", "returning series"]);

/**
 * @param {any} date   release_date / first_air_date / air_date
 * @param {string} [status] TMDB `status` alanı (varsa)
 * @returns {"released"|"scheduled"|"unknown"}
 */
export function getReleaseState(date, status) {
  const parsed = parseAirDate(date);
  if (parsed) {
    return parsed.getTime() > Date.now()
      ? RELEASE_STATE.SCHEDULED
      : RELEASE_STATE.RELEASED;
  }
  return RELEASED_STATUSES.has(String(status || "").trim().toLowerCase())
    ? RELEASE_STATE.RELEASED
    : RELEASE_STATE.UNKNOWN;
}

/** Kısayol: yalnız `released` iken izleme kaydı yazılabilir. */
export function canMarkWatched(date, status) {
  return getReleaseState(date, status) === RELEASE_STATE.RELEASED;
}

/** Engel gerekçesi — çağıran taraf metni kendi diliyle seçebilsin diye. */
export const WATCH_BLOCKED = {
  UNRELEASED: "unreleased",       // yayın tarihi ileride
  UNKNOWN_DATE: "unknown-release", // yayın tarihi yok/geçersiz
};

/**
 * Servis katmanı kapısı: izleme kaydı yazmadan önce çağrılır, uygun değilse
 * `error.code` (WATCH_BLOCKED) taşıyan bir Error fırlatır.
 *
 * Bu dosya BİLEREK i18n'siz: saf bir yardımcı olarak kalsın diye mesaj Türkçe
 * öntanımlı; kullanıcıya gösteren ekranlar `error.code` üzerinden kendi çevirili
 * metnini seçiyor (bkz. screens/lists/ListsScreen.js).
 */
export function assertWatchable(date, status) {
  const state = getReleaseState(date, status);
  if (state === RELEASE_STATE.RELEASED) return;
  const scheduled = state === RELEASE_STATE.SCHEDULED;
  const error = new Error(
    scheduled
      ? "Bu içerik henüz yayınlanmadı."
      : "Bu içeriğin yayın tarihi bilinmiyor.",
  );
  error.code = scheduled ? WATCH_BLOCKED.UNRELEASED : WATCH_BLOCKED.UNKNOWN_DATE;
  throw error;
}

/**
 * @param {{ aired:boolean, watched:number, total:number, allowPartial?:boolean }} p
 * @returns {"unaired"|"none"|"partial"|"full"}
 */
export function getWatchState({ aired, watched, total, allowPartial = true }) {
  if (!aired) return WATCH_STATE.UNAIRED;
  const w = watched || 0;
  if (w <= 0) return WATCH_STATE.NONE;
  if (allowPartial && total > 0 && w < total) return WATCH_STATE.PARTIAL;
  return WATCH_STATE.FULL;
}

// Durum → i18n etiket anahtarı (t[...] ile çözülür).
export const WATCH_STATE_LABEL_KEY = {
  [WATCH_STATE.UNAIRED]: "remind",
  [WATCH_STATE.NONE]: "watch",
  [WATCH_STATE.PARTIAL]: "watching",
  [WATCH_STATE.FULL]: "watched",
};

// Durum → tema renk seçici. theme verilir, renk döner.
export function watchStateColor(state, theme) {
  switch (state) {
    case WATCH_STATE.FULL:
      return theme.colors.green;
    case WATCH_STATE.PARTIAL:
      return theme.colors.orange;
    case WATCH_STATE.UNAIRED:
      return theme.colors.orange;
    default:
      return theme.text.secondary;
  }
}

// watchedTv show dokümanındaki gömülü sezonlardan güvenli bölüm toplamı üretir.
// Yeni model bu değeri `watchedEpisodeCount` olarak hazır tuttuğu için önce özeti
// kullanır; migration sırasında özet henüz yoksa sezonlara geri düşer.
export function getWatchedEpisodeCount(show) {
  const aggregate = Number(show?.watchedEpisodeCount);
  if (Number.isFinite(aggregate) && aggregate >= 0) return aggregate;

  return (show?.seasons || []).reduce(
    (total, season) => total + (season?.episodes?.length || 0),
    0,
  );
}

export function getWatchedShowProgress(show) {
  const watched = getWatchedEpisodeCount(show);
  const total = Number(show?.showEpisodeCount) || 0;
  return {
    watched,
    total,
    progress: total > 0 ? Math.min(watched / total, 1) : 0,
    isCompleted: total > 0 && watched >= total,
  };
}

const dateToMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

// Son izlenen bölüm, bölüm numarasına göre değil gerçek izleme zamanına göre
// seçilir. Eski kayıtlarda tarih yoksa en ileri sezon/bölüm deterministik fallback'tir.
export function getLastWatchedEpisode(show) {
  let latest = null;

  (show?.seasons || []).forEach((season) => {
    (season?.episodes || []).forEach((episode) => {
      const watchedAt = dateToMillis(
        episode?.episodeWatchTime ||
          season?.addedSeasonDate ||
          show?.addedShowDate,
      );
      const order =
        (Number(season?.seasonNumber) || 0) * 100000 +
        (Number(episode?.episodeNumber) || 0);

      if (
        !latest ||
        watchedAt > latest.watchedAt ||
        (watchedAt === latest.watchedAt && order > latest.order)
      ) {
        latest = { season, episode, watchedAt, order };
      }
    });
  });

  return latest;
}

export function getWatchedShowActivityTime(show) {
  return (
    getLastWatchedEpisode(show)?.watchedAt ||
    dateToMillis(show?.addedShowDate || show?.dateAdded)
  );
}
