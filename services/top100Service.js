// services/top100Service.js
//
// "Seelogd Top 100"ün ağ tarafı. Sıralama kararı utils/top100.js'te (saf, testli).
//
// İKİ KAYNAK
//   • TMDB havuzu: en çok DEĞERLENDİRİLEN filmler ve diziler (discover, vote_count.desc, her türden
//     TOP100_POOL_PAGES sayfa = 100'er yapım). İki türün ilk 100'ü birleşince karışık ilk 100 kesinleşir.
//     Yetişkin içerik süzgeci axios interceptor'ında (utils/tmdbAdultGuard) — burada include_adult YAZILMAZ.
//   • Topluluk sayaçları: Top100Hype/{mediaKey} → { type, id, count } (en çok oy alan TOP100_COUNTER_READ kadarı).
//     Havuzda olmayan oylu yapımların TMDB verisi detay ucundan tamamlanır (axios önbelleği tekrar istemez).
//
// OY = tek transaction, aç/kapa: Top100Hype/{key}/votes/{uid} → { hype: true } oluşturulur (+1) ya da silinir (−1);
// yapım sayacı ve kullanıcının hak sayacı (Top100HypeUsers/{uid}) AYNI yazımda. firestore.rules eşleşmeyi ve
// planın aktif oy hakkını (Free 0 · Premium 10 · Max 20) zorunlu kılar.

import axios from "axios";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { tmdbLanguageOf } from "../utils/appLanguages";
import { asCounter, mediaKeyOf, parseMediaKey, toPoolItem } from "../utils/top100";

const TMDB = "https://api.themoviedb.org/3/";
export const TOP100_COLLECTION = "Top100Hype";
export const TOP100_POOL_PAGES = 5;
export const TOP100_COUNTER_READ = 120;
const DETAIL_CONCURRENCY = 6;

const counterRef = (key) => doc(db, TOP100_COLLECTION, key);
const voteRef = (key, uid) => doc(db, TOP100_COLLECTION, key, "votes", uid);
export const TOP100_USERS_COLLECTION = "Top100HypeUsers";
const userRef = (uid) => doc(db, TOP100_USERS_COLLECTION, uid);

async function tmdbGet(apiKey, path, params = {}) {
  const response = await axios.get(TMDB + path, {
    params,
    headers: { Authorization: apiKey },
    timeout: 12000,
  });
  return response.data;
}

/**
 * TMDB havuzu (tekilleştirilmiş). Tek tek düşen sayfalar yutulur; HİÇBİRİ gelmezse hata fırlatır.
 * @returns {Promise<object[]>} toPoolItem çıktıları
 */
export async function fetchTop100Pool(apiKey, language) {
  const lang = tmdbLanguageOf(language);
  const requests = [];
  ["movie", "tv"].forEach((type) => {
    for (let page = 1; page <= TOP100_POOL_PAGES; page += 1) {
      requests.push({ type, path: `discover/${type}`, params: { sort_by: "vote_count.desc", page, language: lang } });
    }
  });
  const settled = await Promise.allSettled(requests.map((r) => tmdbGet(apiKey, r.path, r.params)));
  if (settled.every((entry) => entry.status !== "fulfilled")) throw new Error("top100_pool_failed");

  const seen = new Set();
  const pool = [];
  settled.forEach((entry, index) => {
    if (entry.status !== "fulfilled") return;
    (entry.value?.results || []).forEach((raw) => {
      const item = toPoolItem(raw, requests[index].type);
      if (!item || item.adult || seen.has(item.key)) return;
      seen.add(item.key);
      pool.push(item);
    });
  });
  return pool;
}

/** En çok Seelogd oyu alan yapımların sayaçları: { mediaKey: { count } }. Hata fırlatır. */
export async function fetchTop100Counters() {
  const snap = await getDocs(
    query(collection(db, TOP100_COLLECTION), orderBy("count", "desc"), limit(TOP100_COUNTER_READ)),
  );
  const out = {};
  snap.forEach((entry) => {
    if (parseMediaKey(entry.id)) out[entry.id] = asCounter(entry.data());
  });
  return out;
}

/** Havuzda olmayan oylu yapımların TMDB detayı → havuz öğeleri (düşenler atlanır). */
export async function fetchTop100Details(apiKey, language, keys) {
  const lang = tmdbLanguageOf(language);
  const targets = (keys || []).map(parseMediaKey).filter(Boolean);
  const out = [];
  for (let i = 0; i < targets.length; i += DETAIL_CONCURRENCY) {
    const batch = targets.slice(i, i + DETAIL_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ type, id }) => tmdbGet(apiKey, `${type}/${id}`, { language: lang })),
    );
    settled.forEach((entry, index) => {
      if (entry.status !== "fulfilled") return;
      const item = toPoolItem(entry.value, batch[index].type);
      if (item && !item.adult) out.push(item);
    });
  }
  return out;
}

/** Film + dizi araması (kişiler elenir). */
export async function searchTop100(apiKey, language, text) {
  const q = String(text || "").trim();
  if (!q) return [];
  const data = await tmdbGet(apiKey, "search/multi", { query: q, page: 1, language: tmdbLanguageOf(language) });
  const seen = new Set();
  const out = [];
  (data?.results || []).forEach((raw) => {
    const item = toPoolItem(raw);
    if (!item || item.adult || seen.has(item.key)) return;
    seen.add(item.key);
    out.push(item);
  });
  return out;
}

/** Bu kullanıcı bu yapıma oy vermiş mi (başka cihazdan da olabilir)? Okunamazsa null. */
export async function fetchMyTop100Hype(uid, key) {
  if (!uid || !parseMediaKey(key)) return null;
  const snap = await getDoc(voteRef(key, uid));
  return snap.exists();
}

/** Kullanıcının kullandığı aktif oy hakkı (Top100HypeUsers/{uid}.used); kayıt yoksa 0. Hata fırlatır. */
export async function fetchMyTop100Usage(uid) {
  if (!uid) return 0;
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? Math.max(0, Math.trunc(Number(snap.data()?.used)) || 0) : 0;
}

/** Hak doluyken oy denendi: `error.code === TOP100_LIMIT_ERROR`, `error.used` sunucudaki sayı. */
export const TOP100_LIMIT_ERROR = "top100_limit";

/**
 * Oyu açar ya da kapatır; aynı yazımda yapım sayacı ve kullanıcının hak sayacı (Top100HypeUsers/{uid}
 * → { used, last }) ±1 oynar. Sunucudaki durum zaten istenen gibiyse hiçbir şey yazmaz.
 * Yeni oyda `used >= limit` ise yazmaz, TOP100_LIMIT_ERROR fırlatır (kural da aynı sınırı uygular).
 *
 * @param {{ uid: string, type: "movie"|"tv", id: number, hyped: boolean, limit: number }} p
 *   hyped: istenen SON durum; limit: planın aktif oy hakkı (utils/premiumFeatures "top100_vote")
 * @returns {Promise<{ counter: {count:number}, hyped: boolean, used: number }>}
 */
export function setTop100Hype({ uid, type, id, hyped, limit = 0 }) {
  const key = mediaKeyOf(type, id);
  if (!uid) return Promise.reject(new Error("top100_no_user"));
  if (!key) return Promise.reject(new Error("top100_bad_media"));
  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef(key));
    const voteSnap = await tx.get(voteRef(key, uid));
    const userSnap = await tx.get(userRef(uid));
    const counter = counterSnap.exists() ? asCounter(counterSnap.data()) : { count: 0 };
    const used = userSnap.exists() ? Math.max(0, Math.trunc(Number(userSnap.data()?.used)) || 0) : 0;
    const was = voteSnap.exists();
    if (was === !!hyped) return { counter, hyped: was, used };

    if (hyped) {
      if (used >= limit) {
        const error = new Error(TOP100_LIMIT_ERROR);
        error.code = TOP100_LIMIT_ERROR;
        error.used = used;
        throw error;
      }
      const next = { count: counter.count + 1 };
      tx.set(voteRef(key, uid), { hype: true });
      if (counterSnap.exists()) tx.update(counterRef(key), next);
      else tx.set(counterRef(key), { type, id: Math.trunc(Number(id)), ...next });
      tx.set(userRef(uid), { used: used + 1, last: key });
      return { counter: next, hyped: true, used: used + 1 };
    }
    const next = { count: Math.max(0, counter.count - 1) };
    tx.delete(voteRef(key, uid));
    tx.update(counterRef(key), next);
    // Hak sisteminden önce verilmiş oy (hak kaydı yok): kayda dokunmadan geri alınır.
    if (userSnap.exists()) tx.set(userRef(uid), { used: Math.max(0, used - 1), last: key });
    return { counter: next, hyped: false, used: userSnap.exists() ? Math.max(0, used - 1) : used };
  });
}
