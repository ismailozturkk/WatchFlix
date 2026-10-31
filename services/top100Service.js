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
// OY = tek toplu yazım, aç/kapa: Top100Hype/{key}/votes/{uid} → { hype: true } oluşturulur (+1) ya da silinir (−1);
// yapım sayacı ve kullanıcının hak sayacı (Top100HypeUsers/{uid}) AYNI yazımda. firestore.rules eşleşmeyi ve
// planın aktif oy hakkını (Free 0 · Premium 10 · Max 20) zorunlu kılar.
//
// Sayaçlar increment(±1) ile yazılır, transaction YOK (2026-10-31 denetimi): popüler yapımda oku-değiştir-yaz
// transaction'ı aynı belgeye yığılınca yeniden deneme bütçesini tüketip düşüyordu. Kural farkı (tam ±1) zaten
// sunucuda doğruladığı için okumaya gerek yok. Sayaç `count` sıralama sorgusunda kullanıldığından PARÇALANMAZ
// (DailyPolls'tan farkı); oylar yapımlara dağıldığı ve oy Premium olduğu için tek belgeye yük sınırlı.

import axios from "axios";
import { collection, doc, getDoc, getDocs, increment, limit, orderBy, query, writeBatch } from "firebase/firestore";
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

/** Yapım sayacı, bu kullanıcının oyu ve hak sayacı (tek seferde, transaction dışı). */
async function readHypeState(key, uid) {
  const [counterSnap, voteSnap, userSnap] = await Promise.all([
    getDoc(counterRef(key)),
    getDoc(voteRef(key, uid)),
    getDoc(userRef(uid)),
  ]);
  return {
    counter: counterSnap.exists() ? asCounter(counterSnap.data()) : { count: 0 },
    hasUser: userSnap.exists(),
    used: userSnap.exists() ? Math.max(0, Math.trunc(Number(userSnap.data()?.used)) || 0) : 0,
    was: voteSnap.exists(),
  };
}

/**
 * Oyu açar ya da kapatır; aynı yazımda yapım sayacı ve kullanıcının hak sayacı (Top100HypeUsers/{uid}
 * → { used, last }) ±1 oynar. Sunucudaki durum zaten istenen gibiyse hiçbir şey yazmaz.
 * Yeni oyda `used >= limit` ise yazmaz, TOP100_LIMIT_ERROR fırlatır (kural da aynı sınırı uygular).
 *
 * @param {{ uid: string, type: "movie"|"tv", id: number, hyped: boolean, limit: number }} p
 *   hyped: istenen SON durum; limit: planın aktif oy hakkı (utils/premiumFeatures "top100_vote")
 * @returns {Promise<{ counter: {count:number}, hyped: boolean, used: number }>}
 */
export async function setTop100Hype({ uid, type, id, hyped, limit = 0 }) {
  const key = mediaKeyOf(type, id);
  if (!uid) throw new Error("top100_no_user");
  if (!key) throw new Error("top100_bad_media");
  const want = !!hyped;
  const { counter, hasUser, used, was } = await readHypeState(key, uid);
  if (was === want) return { counter, hyped: was, used };

  if (want && used >= limit) {
    const error = new Error(TOP100_LIMIT_ERROR);
    error.code = TOP100_LIMIT_ERROR;
    error.used = used;
    throw error;
  }

  const batch = writeBatch(db);
  if (want) {
    batch.set(voteRef(key, uid), { hype: true });
    // type/id aynı değerle yeniden yazılır (kural: güncellemede yalnız `count` değişir); ilk oyda belge doğar.
    batch.set(counterRef(key), { type, id: Math.trunc(Number(id)), count: increment(1) }, { merge: true });
    batch.set(userRef(uid), { used: increment(1), last: key }, { merge: true });
  } else {
    batch.delete(voteRef(key, uid));
    batch.update(counterRef(key), { count: increment(-1) });
    // Hak sisteminden önce verilmiş oy (hak kaydı yok): kayda dokunmadan geri alınır.
    if (hasUser) batch.set(userRef(uid), { used: increment(-1), last: key }, { merge: true });
  }

  try {
    await batch.commit();
  } catch (error) {
    // Okuma ile yazım arasında başka cihaz aynı oyu değiştirdiyse kural reddeder: sunucu durumu istenen gibiyse
    // başarı say, hak dolduysa sınır hatasını ver, değilse hatayı ilet.
    const now = await readHypeState(key, uid).catch(() => null);
    if (now && now.was === want) return { counter: now.counter, hyped: now.was, used: now.used };
    if (now && want && now.used >= limit) {
      const limitError = new Error(TOP100_LIMIT_ERROR);
      limitError.code = TOP100_LIMIT_ERROR;
      limitError.used = now.used;
      throw limitError;
    }
    throw error;
  }

  if (want) return { counter: { count: counter.count + 1 }, hyped: true, used: used + 1 };
  return {
    counter: { count: Math.max(0, counter.count - 1) },
    hyped: false,
    used: hasUser ? Math.max(0, used - 1) : used,
  };
}
