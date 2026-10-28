// services/dailyDuelService.js
//
// Günlük düello kartının iki tarafın skorunu okuduğu yer: günlük tablo (GameLeaderboards/…/entries)
// üzerinden TEK sorgu (benim + gönderenin uid'si). Yeni koleksiyon, kural ya da fonksiyon yok —
// Sonuç ekranındaki "Arkadaşların arasında" şeridi aynı veriyi zaten okuyor.
//
// Önbellek: sohbet listesi kaydırılırken aynı kart tekrar tekrar çizilir; her çizimde sorgu atılmasın diye
// kısa ömürlü bellek-içi kayıt tutulur ve eşzamanlı istekler tek sorguya birleşir. `force`, kullanıcı
// oyundan dönünce (skor yeni yazılmış olabilir) önbelleği atlar.

import { fetchDailyFriendRows } from "./sceneGameService";
import { scoresFromRows } from "../utils/dailyDuel";

const TTL_MS = 15000;
const cache = new Map(); // anahtar → { at, value } | { promise }

const keyOf = (dayKey, myUid, hostUid) => `${dayKey}|${myUid}|${hostUid || ""}`;

/**
 * @returns {Promise<{ mine: number|null, host: number|null }>} Satır yoksa ilgili skor null.
 * @throws ağ/izin hatasında (çağıran "doğrulanamadı" kabul eder, karttaki skora döner)
 */
export function loadDuelScores({ dayKey, myUid, hostUid, force = false, now = Date.now() }) {
  if (!dayKey || !myUid) return Promise.resolve({ mine: null, host: null });
  const key = keyOf(dayKey, myUid, hostUid);
  const hit = cache.get(key);
  if (hit?.promise) return hit.promise;
  if (!force && hit && now - hit.at < TTL_MS) return Promise.resolve(hit.value);

  const promise = fetchDailyFriendRows(dayKey, [myUid, hostUid])
    .then((rows) => {
      const value = scoresFromRows(rows, { myUid, hostUid });
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, { promise });
  return promise;
}

/** Yalnız testler / çıkış için. */
export const __resetDuelCache = () => cache.clear();

// Sohbete yeni bir düello SONUCU kartı düştüğünde (SharedDuelResultMessage) aynı günün meydan okuma kartları
// skorları yeniden okusun: meydan okuyan sohbet açıkken rakibin skoru kendi kartında da belirir.
const listeners = new Set();

/** @returns {() => void} aboneliği bırakır */
export function subscribeDuelScores(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyDuelScores(dayKey) {
  if (!dayKey) return;
  for (const [key] of cache) if (key.startsWith(`${dayKey}|`)) cache.delete(key);
  listeners.forEach((listener) => listener(dayKey));
}
