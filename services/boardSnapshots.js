// services/boardSnapshots.js
//
// Liderlik tablosu anlık görüntüsü (maliyet analizi Aşama 3; sunucu: functions/publicBoards.js).
// Bir tablonun ilk 50 girdisi tek belgede: BoardSnapshots/{boardId}. İstemci 50 belge yerine onu
// okur (1 okuma); belge yoksa ya da bayatsa getBoardSnapshot callable'ı yeniden kurar.
//
// ASLA FIRLATMAZ: kural/fonksiyon henüz yayında değilse ya da ağ hatasında null döner, çağıran
// eski sorguya (doğrudan tabloyu okumaya) düşer.

export const BOARD_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

/**
 * @param {string} boardId  "scene_guess" | "poster_classic_normal" | "quick_*" | "scene_daily_YYYY-MM-DD"
 * @returns {Promise<Array<{id: string, data: object}> | null>}
 */
export async function readBoardSnapshot(boardId, { now = Date.now } = {}) {
  if (!boardId) return null;
  try {
    // Lazy require: saf JS testlerinde firebase yüklenmesin (services/externalRatings.js kalıbı).
    // eslint-disable-next-line global-require
    const { db, fns } = require("../firebase");
    // eslint-disable-next-line global-require
    const { doc, getDoc } = require("firebase/firestore");
    const snap = await getDoc(doc(db, "BoardSnapshots", boardId));
    const data = snap.exists() ? snap.data() : null;
    const age = now() - Number(data?.builtAt);
    if (data && Array.isArray(data.entries) && age >= 0 && age < BOARD_SNAPSHOT_TTL_MS) {
      return data.entries;
    }
    // eslint-disable-next-line global-require
    const { httpsCallable } = require("firebase/functions");
    const res = await httpsCallable(fns, "getBoardSnapshot")({ boardId });
    return Array.isArray(res?.data?.entries) ? res.data.entries : null;
  } catch {
    return null;
  }
}
