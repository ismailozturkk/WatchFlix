// services/top100Service.js
//
// "Seelogd Top 100"ün ağ tarafı. Sıralama kararı utils/top100.js'te (saf, testli).
//
// İKİ KAYNAK
//   • TMDB havuzu: en çok oylanan filmler + diziler (discover, vote_count.desc) ve en yüksek puanlılar (top_rated).
//     Yetişkin içerik süzgeci axios interceptor'ında (utils/tmdbAdultGuard) — burada include_adult YAZILMAZ.
//   • Topluluk sayaçları: Top100/{mediaKey} → { type, id, sum, count } (en çok oy alan TOP100_COUNTER_READ kadarı).
//     Havuzda olmayan oylu yapımların TMDB verisi detay ucundan tamamlanır (axios önbelleği tekrar istemez).
//
// OY = tek transaction: Top100/{key}/votes/{uid} → { score } ve sayaç BİRLİKTE yazılır. firestore.rules eşleşmeyi
// zorunlu kılar: yeni oyda count +1 ve sum +puan; oy değişiminde count aynı, sum (yeni − eski) kadar oynar.

import axios from "axios";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { tmdbLanguageOf } from "../utils/appLanguages";
import { asCounter, isValidScore, mediaKeyOf, parseMediaKey, toPoolItem } from "../utils/top100";

const TMDB = "https://api.themoviedb.org/3/";
export const TOP100_POOL_PAGES = 3;
export const TOP100_COUNTER_READ = 120;
const DETAIL_CONCURRENCY = 6;

const counterRef = (key) => doc(db, "Top100", key);
const voteRef = (key, uid) => doc(db, "Top100", key, "votes", uid);

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
    requests.push({ type, path: `${type}/top_rated`, params: { page: 1, language: lang } });
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

/** En çok Seelogd oyu alan yapımların sayaçları: { mediaKey: { sum, count } }. Hata fırlatır. */
export async function fetchTop100Counters() {
  const snap = await getDocs(query(collection(db, "Top100"), orderBy("count", "desc"), limit(TOP100_COUNTER_READ)));
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

/** Bu kullanıcının bir yapıma verdiği puan (başka cihazdan da olabilir) ya da null. */
export async function fetchMyTop100Vote(uid, key) {
  if (!uid || !parseMediaKey(key)) return null;
  const snap = await getDoc(voteRef(key, uid));
  const score = snap.exists() ? snap.data()?.score : null;
  return isValidScore(score) ? score : null;
}

/**
 * Oyu yazar ya da değiştirir. Aynı puan zaten kayıtlıysa hiçbir şey yazmaz.
 * @returns {Promise<{ counter: {sum:number,count:number}, previous: number|null, score: number }>}
 */
export function castTop100Vote({ uid, type, id, score }) {
  const key = mediaKeyOf(type, id);
  if (!uid) return Promise.reject(new Error("top100_no_user"));
  if (!key) return Promise.reject(new Error("top100_bad_media"));
  if (!isValidScore(score)) return Promise.reject(new Error("top100_bad_score"));
  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef(key));
    const voteSnap = await tx.get(voteRef(key, uid));
    const counter = counterSnap.exists() ? asCounter(counterSnap.data()) : { sum: 0, count: 0 };
    const previous = voteSnap.exists() && isValidScore(voteSnap.data()?.score) ? voteSnap.data().score : null;
    if (previous === score) return { counter, previous, score };

    const next =
      previous === null
        ? { sum: counter.sum + score, count: counter.count + 1 }
        : { sum: counter.sum - previous + score, count: counter.count };
    tx.set(voteRef(key, uid), { score });
    if (counterSnap.exists()) tx.update(counterRef(key), next);
    else tx.set(counterRef(key), { type, id: Math.trunc(Number(id)), ...next });
    return { counter: next, previous, score };
  });
}
