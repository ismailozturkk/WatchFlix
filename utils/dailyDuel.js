// utils/dailyDuel.js
//
// "Arkadaşa meydan oku" (günlük düello) kararlarının SAF çekirdeği. RN/Firebase importu YOK.
//
// MODEL: Günlük Meydan Okuma'nın 10 sahnesi herkeste AYNI (utils/dailyChallenge, tohumlu set) ve günde tek
// deneme. Düello bunun üstüne kurulur: oynayan kişi sonucunu sohbete bir "düello kartı" olarak yollar; alıcı
// AYNI günün setini oynar ve iki skor yan yana çıkar. Oyun motoruna dokunulmaz, yeni sunucu mantığı yoktur.
//
// KARTTAKİ SKOR GÜVENİLMEZ, TABLO GÜVENİLİR: kart gönderenin cihazında yazılır; alıcı karşılaştırmayı iki
// tarafın skorunu günlük tablodan (GameLeaderboards/…/entries) okuyarak yapar. Tablo yoksa (okunamadı ya da
// gönderen o gün tabloya yazılamamış) karttaki skor yedek olarak kullanılır.
//
// FAZLAR (alıcı için):
//   "open"    : bugünün meydan okuması ve alıcı henüz oynamadı → "kabul et"
//   "played"  : alıcı o günü oynamış → karşılaştırma (geçmiş günler için de gösterilir)
//   "expired" : gün geçti (ya da henüz gelmedi) ve alıcı oynamadı → yalnız gönderenin skoru

/** "YYYY-AA-GG" iki gün anahtarını karşılaştırır (metin sırası = takvim sırası). */
export const compareDayKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @param {object} p
 * @param {string} p.dayKey      Düellonun günü (kartta)
 * @param {string} p.today       Bugünün gün anahtarı (utils/dailyChallenge.dayKeyOf)
 * @param {number|null} p.mine   Alıcının o günkü skoru (oynamadıysa null)
 * @param {number|null} p.host   Gönderenin o günkü skoru (doğrulanmış ya da karttaki)
 * @returns {{ phase: "open"|"played"|"expired", verdict: "win"|"lose"|"tie"|null, diff: number }}
 */
export function duelOutcome({ dayKey, today, mine, host }) {
  const played = Number.isFinite(mine);
  if (!played) {
    return { phase: dayKey === today ? "open" : "expired", verdict: null, diff: 0 };
  }
  if (!Number.isFinite(host)) return { phase: "played", verdict: null, diff: 0 };
  const diff = Math.abs(mine - host);
  return { phase: "played", verdict: mine > host ? "win" : mine < host ? "lose" : "tie", diff };
}

/** Skor biçimi: binlik ayracı olmadan (Oyun ekranlarının hepsi ham sayı gösteriyor). */
export const formatDuelScore = (value) => String(Math.max(0, Math.round(Number(value) || 0)));

/**
 * Tablo satırlarından iki tarafın skoru. `rows`: fetchDailyFriendRows çıktısı ({uid, bestScore}).
 * Satır yoksa null (oynamadı ya da tabloya yazılmadı).
 */
export function scoresFromRows(rows, { myUid, hostUid }) {
  const byUid = new Map((Array.isArray(rows) ? rows : []).map((row) => [row?.uid, row]));
  const scoreOf = (uid) => {
    const row = uid ? byUid.get(uid) : null;
    return row && Number.isFinite(Number(row.bestScore)) ? Number(row.bestScore) : null;
  };
  return { mine: scoreOf(myUid), host: scoreOf(hostUid) };
}

/** Sonuç ekranındaki/Hub'daki "meydan oku" düğmesi için kart gövdesi; sonuç yoksa null. */
export function duelPayloadFromResult(result, { dayKey, host } = {}) {
  if (!result || !dayKey) return null;
  const score = Number(result.score);
  if (!Number.isFinite(score) || score < 0) return null;
  return {
    dayKey,
    score,
    correct: Number(result.correct ?? result.totalCorrect) || 0,
    total: Number(result.total) || (Number(result.totalCorrect) || 0) + (Number(result.totalWrong) || 0) || 10,
    host,
  };
}

/**
 * Düello SONUCU kartının izleyiciye göre düzeni (mesaj kind: "duelResultShare"). `guest` = kabul eden
 * (mesajın göndereni), `host` = meydan okuyan. İzleyici kendi tarafını SOLDA görür; grupta üçüncü kişi
 * için sol kabul eden, sağ meydan okuyandır.
 *
 * @returns {{
 *   role: "guest"|"host"|"other",
 *   left: { side: "guest"|"host", score: number|null },
 *   right: { side: "guest"|"host", score: number|null },
 *   verdict: "win"|"lose"|"tie"|"decided"|null,   // "decided": üçüncü kişi için kazanan belli
 *   winner: "guest"|"host"|null,
 *   diff: number,
 * }}
 */
export function duelResultView({ viewerUid, guestUid, hostUid, guestScore, hostScore }) {
  const role = viewerUid && viewerUid === guestUid ? "guest" : viewerUid && viewerUid === hostUid ? "host" : "other";
  const guest = { side: "guest", score: Number.isFinite(guestScore) ? guestScore : null };
  const host = { side: "host", score: Number.isFinite(hostScore) ? hostScore : null };
  const [left, right] = role === "host" ? [host, guest] : [guest, host];
  if (guest.score === null || host.score === null) {
    return { role, left, right, verdict: null, winner: null, diff: 0 };
  }
  const winner = guest.score > host.score ? "guest" : guest.score < host.score ? "host" : null;
  const verdict = winner === null ? "tie" : role === "other" ? "decided" : winner === role ? "win" : "lose";
  return { role, left, right, verdict, winner, diff: Math.abs(guest.score - host.score) };
}
