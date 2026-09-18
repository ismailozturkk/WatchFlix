// services/refreshShowMeta.js
//
// İzlenen bir dizinin Firestore'daki showEpisodeCount ve showSeasonCount
// değerlerini TMDB'deki güncel değerlerle sessizce günceller.
// TvShowsDetails ekranı açıldığında çağrılır — TMDB verisini zaten
// çektiği için ek istek maliyeti YOKTUR.
//
// Güncelleme yalnızca değer ARTTIĞINDA yapılır (Math.max); dil farkından
// kaynaklanan düşük TMDB tutarsızlıkları eski değeri ezemez.

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreWrite } from "./usageTrackerService";
import { updateLocalItem } from "./listSyncService";

/**
 * @param {string}  uid          - Kullanıcı ID'si
 * @param {number}  showId       - TMDB dizi ID'si
 * @param {object}  tmdbDetails  - TMDB /tv/{id} yanıtı (number_of_episodes, number_of_seasons)
 * @param {object}  currentDoc   - Firestore'daki mevcut watchedTv dokümanı
 */
export async function refreshShowMeta(uid, showId, tmdbDetails, currentDoc) {
  if (!uid || showId == null || !tmdbDetails || !currentDoc) return;

  const newEpCount = tmdbDetails.number_of_episodes || 0;
  const newSeasonCount = tmdbDetails.number_of_seasons || 0;
  const oldEpCount = currentDoc.showEpisodeCount || 0;
  const oldSeasonCount = currentDoc.showSeasonCount || 0;

  // Değişiklik yoksa yazma yapma
  if (newEpCount <= oldEpCount && newSeasonCount <= oldSeasonCount) return;

  const updates = {};
  if (newEpCount > oldEpCount) updates.showEpisodeCount = newEpCount;
  if (newSeasonCount > oldSeasonCount) updates.showSeasonCount = newSeasonCount;

  const docKey = `tv_${showId}`;
  const ref = doc(db, "Lists", uid, "watchedTv", docKey);
  try {
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
    trackFirestoreWrite("watchedTv", 1);
    updateLocalItem(uid, "watchedTv", docKey, {
      ...currentDoc,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    // Sessiz hata — dizi izlenmemişse doküman yoktur, sorun değil.
    if (__DEV__) console.log("[refreshShowMeta] silent update failed:", e?.message);
  }
}
