// services/posterChoicesService.js
//
// BAŞKA bir kullanıcının özel afiş ve arka plan seçimlerini okur (arkadaş profili ve onun
// listeleri). Kendi seçimlerin bu dosyadan GEÇMEZ: onlar yerel-öncelikli alanda
// (services/userData posterChoicesDomain), okuma maliyeti sıfır.
//
// Maliyet: profil başına TEK `getDoc` (PosterChoices/{uid} tek belge). Aynı profile
// kısa sürede dönülünce (profil → liste → geri) yeniden okunmasın diye bellekte
// FRIEND_CACHE_MS tutulur. Kural reddederse (listeleri gizli / arkadaşlık tek
// tarafta kalmış) sessizce boş harita döner — afişler varsayılana düşer.

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreRead } from "./usageTrackerService";
import { choiceSetFromDoc, EMPTY_CHOICE_SET } from "../utils/posterChoices";

export const FRIEND_CACHE_MS = 5 * 60 * 1000;

/** uid → { at, choices } | { at, promise } */
const cache = new Map();

/**
 * @param {string} uid
 * @param {{ force?: boolean, now?: number }} [options]
 * @returns {Promise<{posters: object, backdrops: object}>} donmuş seçim kümesi (boş olabilir)
 */
export function fetchUserPosterChoices(uid, { force = false, now = Date.now() } = {}) {
  if (!uid) return Promise.resolve(EMPTY_CHOICE_SET);
  const hit = cache.get(uid);
  if (!force && hit && now - hit.at < FRIEND_CACHE_MS) {
    return hit.promise || Promise.resolve(hit.choices);
  }
  const promise = getDoc(doc(db, "PosterChoices", uid))
    .then((snap) => {
      trackFirestoreRead("PosterChoices", 1);
      const choices = snap.exists() ? choiceSetFromDoc(snap.data()) : EMPTY_CHOICE_SET;
      cache.set(uid, { at: now, choices });
      return choices;
    })
    .catch((err) => {
      if (__DEV__) console.warn("PosterChoices okunamadı:", err?.message);
      // Ret de önbelleğe girer: aynı profilde her render yeniden denemesin.
      cache.set(uid, { at: now, choices: EMPTY_CHOICE_SET });
      return EMPTY_CHOICE_SET;
    });
  cache.set(uid, { at: now, promise });
  return promise;
}

/** Yalnız test. */
export function __resetPosterChoicesCache() {
  cache.clear();
}
