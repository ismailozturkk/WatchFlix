// hooks/useUpcomingReminder.js
//
// Bir posterin "hatırlatma kuruldu" (zil) rozeti için: bu film/dizi için süren bir
// hatırlatma var mı? Kural utils/reminderBadge.js'te.
//
// NEDEN useUserDataDomain DEĞİL:
//   • useUserDataDomain görünümün TAMAMINI döndürür; hatırlatıcılardan biri
//     değişince ekrandaki HER poster yeniden çizilirdi. Burada abonelik doğrudan
//     alan deposuna bağlı ve anlık görüntü bir boolean: React aynı değerde
//     yeniden çizmez, yani 60 posterli bir rafta bir hatırlatma eklemek yalnız
//     o posteri günceller.
//   • Poster başına `ensureHydrated` çağrısı da yok. Yerel kopyayı giriş
//     (startUserData) ve ProfileRemindersProvider zaten hazırlar; rozet yalnız okur.
//
// Okuma SENKRON ve yereldir (0 Firestore okuması, dinleyici yok).

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "../context/AuthContext";
import { getActiveUser } from "../services/storage";
import { remindersDomain } from "../services/userData";
import { hasUpcomingReminder } from "../utils/reminderBadge";

/**
 * @param {number|string|null|undefined} mediaId  TMDB kimliği
 * @param {"movie"|"tv"|string} mediaType
 * @param {boolean} [enabled=true]  Rozet kapalıysa (ayar / `hide`) abonelik hiç
 *        yeniden çizim tetiklemez; hook yine çağrılır (kural gereği) ama sabit false döner.
 * @returns {boolean}
 */
export default function useUpcomingReminder(mediaId, mediaType, enabled = true) {
  const { user } = useAuth() ?? {};
  // Oturum ASENKRON çözülür; ilk karede `user` null olabilir. Son aktif kullanıcı
  // depodan senkron okunur (useUserDataDomain ile aynı kural).
  const uid = user?.uid ?? getActiveUser();

  const getSnapshot = useCallback(
    () => enabled && hasUpcomingReminder(remindersDomain.getSnapshot(uid), mediaId, mediaType),
    [enabled, uid, mediaId, mediaType],
  );

  return useSyncExternalStore(remindersDomain.subscribe, getSnapshot, getSnapshot);
}
