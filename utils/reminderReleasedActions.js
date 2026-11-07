// utils/reminderReleasedActions.js
//
// Profil > Hatırlatıcılar: "Yayınlandı" kartındaki çöp düğmesi bir seçim sayfası açar.
// Yayınlanmış hatırlatıcının işi bitti; kullanıcı onu üç yoldan kapatabilir:
//
//   delete     → yalnız kaldır (toast'ta "Geri Al"; utils/reminderQuickDelete)
//   watchlist  → filmi / diziyi İzleme Listesi'ne ekle, sonra hatırlatıcıyı kaldır
//   watched    → filmi / bölümü BUGÜN izlendi işaretle, sonra hatırlatıcıyı kaldır
//
// Yazma yolu tek kapı: services/libraryActions (sıra, iyimser durum, günlük süre
// sınırı, yayın kapısı). Hatırlatıcı ANCAK liste/izleme yazımı başarılı olursa
// kaldırılır: düşen bir yazımda kullanıcı hatırlatıcıyı kaybetmesin.
//
// Hatırlatıcı belgesi hafif (ad, afiş, tarih, süre); tür/bölüm sayısı gibi olgular için
// TMDB detayı çekilir (tmdbFacts ile AYNI URL + cache). Detay gelmezse (çevrimdışı)
// hatırlatıcının kendi verisiyle yazılır — süresiz/türsüz bir kayıt, hiç yazılmamış
// bir kayıttan iyidir (bkz. libraryCore.listSourceOrCard).

import Toast from "@components/AppToast";
import { markEpisodeWatched, markMovieWatched, setListMembership } from "../services/libraryActions";
import { remindersActions } from "../services/userData";
import { cachedTmdb } from "./cachedRead";
import { i18nText } from "./i18nText";
import { showLibraryError } from "./libraryErrorText";
import {
  listItemFromDetails,
  listSourceOrCard,
  movieWatchItemFromDetails,
  showMetaFromDetails,
} from "./libraryCore";
import { factsUrl, todayListDate } from "./mediaFacts";
import { removeEpisodeReminderWithUndo, removeMovieReminderWithUndo } from "./reminderQuickDelete";

export const RELEASED_REMINDER_ACTIONS = Object.freeze(["delete", "watchlist", "watched"]);

const DETAILS_TTL = 7 * 24 * 60 * 60 * 1000; // tmdbFacts ile aynı

/** TMDB detay gövdesi; hata/anahtar yoksa null (ASLA throw etmez). */
async function fetchDetails({ apiKey, id, mediaType, language }) {
  if (!apiKey || id == null) return null;
  try {
    const { data } = await cachedTmdb(
      factsUrl({ id, mediaType, language }),
      { headers: { accept: "application/json", Authorization: apiKey } },
      { maxAge: DETAILS_TTL, category: mediaType === "tv" ? "tvContent" : "movieContent" },
    );
    return data && data.id != null ? data : null;
  } catch {
    return null;
  }
}

/** Film hatırlatıcısı → TMDB detay benzeri gövde (detay yoksa yedek). */
export function movieSourceFromReminder(reminder, details = null) {
  if (details && details.id != null) return details;
  return {
    id: reminder.movieId,
    title: reminder.movieName || "",
    poster_path: reminder.posterPath || null,
    release_date: reminder.releaseDate || null,
    runtime: Number(reminder.movieMinutes) || null,
  };
}

/** Bölüm hatırlatıcısı → markEpisodeWatched parametreleri (dizi detayı varsa olgularla). */
export function episodeWatchParams(episode, showDetails = null) {
  const fallback = { name: episode.showName || "", imagePath: episode.showPosterPath || null };
  const showMeta = showMetaFromDetails(showDetails, fallback) || {
    id: episode.showId,
    ...fallback,
    showEpisodeCount: 0,
    showSeasonCount: 0,
    genres: [],
  };
  const season = (Array.isArray(showDetails?.seasons) ? showDetails.seasons : []).find(
    (entry) => Number(entry?.season_number) === Number(episode.seasonNumber),
  );
  return {
    showMeta,
    seasonMeta: {
      seasonNumber: Number(episode.seasonNumber) || 0,
      seasonPosterPath: episode.seasonPosterPath || season?.poster_path || null,
      seasonEpisodes: Number(season?.episode_count) || 0,
    },
    episode: {
      episodeNumber: Number(episode.episodeNumber) || 0,
      episodePosterPath: episode.stillPath || null,
      episodeName: episode.episodeName || "Unknown",
      episodeRatings: 0,
      episodeMinutes: Number(episode.episodeMinutes) || 0,
      releaseDate: episode.airDate || null,
    },
  };
}

const removeQuietly = (uid, kind, reminder) =>
  kind === "tv"
    ? remindersActions.removeEpisode(uid, reminder.showId, reminder.episodeId)
    : remindersActions.removeMovie(uid, reminder.movieId);

function announce(text) {
  Toast.show({
    type: "success",
    text1: text,
    text2: i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı"),
  });
}

async function addToWatchlist({ uid, kind, reminder, apiKey, language }) {
  const id = kind === "tv" ? reminder.showId : reminder.movieId;
  const details = await fetchDetails({ apiKey, id, mediaType: kind, language });
  const source =
    kind === "tv"
      ? listSourceOrCard(details, { id, title: reminder.showName, posterPath: reminder.showPosterPath })
      : movieSourceFromReminder(reminder, details);
  await setListMembership({
    uid,
    listKey: "watchList",
    item: listItemFromDetails(source, kind, { dateAdded: todayListDate() }),
    desired: true,
  });
  return i18nText("autoI18n.izleme_listesine_eklendi", "İzleme listesine eklendi");
}

async function markWatchedToday({ uid, kind, reminder, apiKey, language }) {
  const watchDate = todayListDate();
  if (kind === "tv") {
    const details = await fetchDetails({ apiKey, id: reminder.showId, mediaType: "tv", language });
    const result = await markEpisodeWatched({
      uid,
      ...episodeWatchParams(reminder, details),
      watchDate,
      source: "reminders",
    });
    if (result?.status !== "added") return null;
    return i18nText("autoI18n.bolum_izlendi_olarak_isaretlendi", "Bölüm izlendi olarak işaretlendi");
  }
  const details = await fetchDetails({ apiKey, id: reminder.movieId, mediaType: "movie", language });
  await markMovieWatched({
    uid,
    movie: movieWatchItemFromDetails(movieSourceFromReminder(reminder, details), { dateAdded: watchDate }),
    watchDate,
  });
  return i18nText("autoI18n.film_izlendi_eklendi", "Film izlendi olarak eklendi.");
}

/**
 * Yayınlanmış hatırlatıcıyı seçilen yoldan kapatır.
 * @param {object} p
 * @param {"delete"|"watchlist"|"watched"} p.action
 * @param {"movie"|"tv"} p.kind
 * @param {object} p.reminder  film hatırlatıcısı ya da bölüm belgesi
 * @returns {Promise<boolean>} hatırlatıcı kaldırıldı mı
 */
export async function finishReleasedReminder({ action, uid, kind, reminder, apiKey, language }) {
  if (!uid || !reminder) return false;
  if (action === "delete") {
    return kind === "tv"
      ? removeEpisodeReminderWithUndo(uid, reminder)
      : removeMovieReminderWithUndo(uid, reminder);
  }
  if (action !== "watchlist" && action !== "watched") return false;

  let text;
  try {
    text =
      action === "watchlist"
        ? await addToWatchlist({ uid, kind, reminder, apiKey, language })
        : await markWatchedToday({ uid, kind, reminder, apiKey, language });
  } catch (error) {
    showLibraryError(error, { source: `reminders_${action}` });
    return false;
  }
  if (!text) {
    // Bölüm yazılmadı (TMDB'ye göre henüz yayınlanmamış / tarih yok): hatırlatıcı kalsın.
    Toast.show({
      type: "warning",
      text1: i18nText("autoI18n.bolum_izlendi_isaretlenemedi", "Bölüm izlendi olarak işaretlenemedi"),
    });
    return false;
  }
  removeQuietly(uid, kind, reminder);
  announce(text);
  return true;
}
