// utils/reminderQuickDelete.js
//
// Profil > Hatırlatıcılar: "Yayınlandı" yazan karttaki çöp düğmesi. Yayınlanmış bir
// hatırlatıcının işi bitmiştir; bu düğme onu detay sayfasına gitmeden tek dokunuşla
// kaldırır. Onay sorulmaz (kısa yol olması bunun için) — bunun yerine toast'ta
// "Geri Al" çıkar ve silineni AYNI belgeyle yeniden yazar.
//
// Yazma yolu hatırlatıcı çanının kullandığı ile aynı (remindersActions): yerel kopya +
// kalıcı günlük anında, bulut arka planda; ana ekran widget'ı ve Takvim yerel kopyadan
// kendiliğinden tazelenir.

import Toast from "@components/AppToast";
import { remindersActions } from "../services/userData";
import { i18nText } from "./i18nText";

// Varsayılan 3 sn "Geri Al" düğmesini bulup basmaya yetmez.
const UNDO_TOAST_MS = 6000;

function announceRemoved(undo) {
  Toast.show({
    type: "info",
    text1: i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı"),
    visibilityTime: UNDO_TOAST_MS,
    props: {
      action: { label: i18nText("autoI18n.geri_al", "Geri Al"), icon: "arrow-undo", onPress: undo },
    },
  });
}

/** Yayınlanmış film hatırlatıcısını kaldırır. @returns {boolean} kaldırıldı mı */
export function removeMovieReminderWithUndo(uid, reminder) {
  if (!uid || reminder?.movieId == null) return false;
  if (!remindersActions.removeMovie(uid, reminder.movieId)) return false;
  announceRemoved(() => {
    remindersActions.setMovie(uid, reminder);
  });
  return true;
}

/**
 * Yayınlanmış bölüm hatırlatıcısını kaldırır. Dizinin son bölümüyse dizi belgesi de
 * silinir; geri alma `setEpisode` ile dizi belgesini de yeniden yazar.
 * @returns {boolean} kaldırıldı mı
 */
export function removeEpisodeReminderWithUndo(uid, episode) {
  if (!uid || episode?.showId == null || episode?.episodeId == null) return false;
  if (!remindersActions.removeEpisode(uid, episode.showId, episode.episodeId)) return false;
  announceRemoved(() => {
    remindersActions.setEpisode(uid, episode);
  });
  return true;
}
