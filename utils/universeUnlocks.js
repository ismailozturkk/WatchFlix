// utils/universeUnlocks.js
//
// Gizli evrenler: atmosfer seçicisindeki evren sahneleri (Star Wars, GoT, One Piece…) kullanıcı
// onları KENDİSİ bulunca açılır — seçicide hiçbir ipucu yok (kilitliler adsız "?" kutucuk).
//
//   1. Evrenden bir yapım izlendi işaretlenir → o yapımın detay sayfasında gizli bir kart belirir.
//   2. Karta dokununca evrenden, izleyenin kesin bileceği bir soru sorulur (utils/universeRiddles.js).
//   3. Doğru cevap evreni kalıcı olarak açar: `solved` = { [evrenId]: açıldığı an (ms) }.
//      Kayıt yerel-öncelikli tek belge: Users/{uid}/private/universes (services/userData
//      universeUnlocksDomain) — cihaz başına bir okuma, evren başına bir yazma.
//
// İzlendi işaretlemek tek başına açmaz (izlemeden işaretleyip geçmek mümkün): soru, gerçekten
// izleyeni ya da cevabı kendi araştırıp bulanı ödüllendirir.
//
// Saf modül (React / depo yok): kanca hooks/useUniverseUnlocks.js.

import { UNIVERSE_IDS } from "./weatherUniverses";

const UNIVERSE_SET = new Set(UNIVERSE_IDS);

/** Seçici kimliği bir evren mi (mevsim/gökyüzü efektleri kilitlenmez). */
export const isUniverseId = (id) => UNIVERSE_SET.has(id);

/**
 * Detay sayfasındaki yapım izlendi mi (gizli kartın görünmesi için).
 * Film: izlendi işareti. Dizi: izlendi işareti ya da en az bir bölüm kaydı.
 */
export function isTitleWatched(src, type, id) {
  if (id == null) return false;
  const { statusIndex, watchedTvMap } = src || {};
  if (type === "tv") return !!statusIndex?.tv?.[id]?.isWatched || !!watchedTvMap?.[String(id)];
  return !!statusIndex?.movie?.[id]?.isWatched;
}

/** Açık evren kimlikleri (Set) — `solved` kaydından, tanınmayan kimlikler atlanır. */
export function unlockedUniverses(solved) {
  const out = new Set();
  if (!solved || typeof solved !== "object") return out;
  for (const id of Object.keys(solved)) if (solved[id] && isUniverseId(id)) out.add(id);
  return out;
}

export const UNIVERSE_DOC_KEY = "all";

/** Belgeden temiz `solved` haritası: yalnız bilinen evrenler, pozitif sayı damgalar. */
export function solvedFromDoc(doc) {
  const raw = doc?.solved;
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of Object.keys(raw)) {
    const ts = raw[id];
    if (isUniverseId(id) && typeof ts === "number" && ts > 0) out[id] = ts;
  }
  return out;
}

/** Yazılacak tek belge. */
export function buildUniverseDoc(solved, now = Date.now()) {
  return { id: UNIVERSE_DOC_KEY, solved: { ...(solved || {}) }, updatedAt: now };
}

/** Evren açılmış kaydına eklenmiş yeni kayıt (değişmezse aynı nesne). */
export function withSolved(solved, id, now = Date.now()) {
  if (!isUniverseId(id)) return solved || {};
  if (solved?.[id]) return solved;
  return { ...(solved || {}), [id]: now };
}

// ── Evren günleri ───────────────────────────────────────────────────────────
// Hayranların kutladığı SABİT tarihlerde evren o gün için HERKESE açık (seçilebilir, türe göre
// modda çizilir). Kalıcı açılış değildir: sayaçlara girmez, kapı sorusu yine sorulur.
// Tarih [ay (0-11), gün], cihazın yerel takvimi.
export const UNIVERSE_DAYS = Object.freeze([
  Object.freeze({ id: "starWars", dates: [[4, 4]] }), // "May the 4th"
  Object.freeze({ id: "backToTheFuture", dates: [[9, 21]] }), // 21 Ekim 2015, Marty'nin geldiği gün
  Object.freeze({ id: "harryPotter", dates: [[6, 31], [8, 1]] }), // Harry'nin doğum günü, Hogwarts Ekspresi
  Object.freeze({ id: "lotr", dates: [[2, 25], [8, 22]] }), // Yüzük'ün yok edilişi, Bilbo & Frodo doğum günü
  Object.freeze({ id: "strangerThings", dates: [[10, 6]] }), // Will'in kaybolduğu gün (1983)
  Object.freeze({ id: "titanic", dates: [[3, 15]] }), // batış (1912)
  Object.freeze({ id: "spiderMan", dates: [[7, 1]] }), // Spider-Man günü
  Object.freeze({ id: "breakingBad", dates: [[8, 7]] }), // Walter White'ın doğum günü
  Object.freeze({ id: "onePiece", dates: [[4, 5]] }), // Luffy'nin doğum günü
  Object.freeze({ id: "naruto", dates: [[9, 10]] }), // Naruto'nun doğum günü
  Object.freeze({ id: "dark", dates: [[5, 27]] }), // kıyamet günü (27 Haziran 2020)
]);

/** O gün evren günü olan evrenler (Set). */
export function universeDayUniverses(date = new Date()) {
  const out = new Set();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return out;
  const m = date.getMonth();
  const d = date.getDate();
  for (const u of UNIVERSE_DAYS) {
    if (isUniverseId(u.id) && u.dates.some(([um, ud]) => um === m && ud === d)) out.add(u.id);
  }
  return out;
}

/** Bir gruptaki (films/series/anime) açık / toplam evren sayısı. */
export function groupUnlockCount(groupEffects, unlocked) {
  const ids = (groupEffects || []).filter(isUniverseId);
  return { open: ids.filter((id) => unlocked?.has(id)).length, total: ids.length };
}
