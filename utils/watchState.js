// utils/watchState.js
//
// Dizi/sezon/bölüm "izlenme durumu" için TEK kaynak — saf (Firestore'dan bağımsız)
// durum makinesi. show / sezon / bölüm butonları aynı 4 durumu paylaşır:
//   unaired → yayınlanmadı (🔔 Hatırlat)
//   none    → hiç izlenmedi (İzle)
//   partial → kısmen izlendi (İzleniyor)   [bölümde kullanılmaz]
//   full    → tamamı izlendi (İzlendi)

export const WATCH_STATE = {
  UNAIRED: "unaired",
  NONE: "none",
  PARTIAL: "partial",
  FULL: "full",
};

// Bir yayın tarihi geçmiş mi? Tarih yoksa/geçersizse "henüz yayınlanmadı" sayılır.
export function isAired(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
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
