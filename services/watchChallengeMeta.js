// services/watchChallengeMeta.js
//
// Meydan Okumalar'ın film ayrıntısı okuması: "Her on yıldan bir film" / "Klasik dönem" yapım YILINI, ülke görevleri
// birincil ÜLKEYİ, "Saklı cevherler" TMDB PUANINI ve OY SAYISINI ister; hiçbiri izleme kaydında yok (bkz.
// utils/watchChallenges.js başlığı). `/movie/{id}` okunur.
//
// ÖNBELLEK: diskte services/favoriteRecommendations.readTmdb (URL başına; 30 gün taze — yıl ve ülke değişmez),
// bellekte modül düzeyi harita: Eğlence kartı, ekran ve profil satırı aynı anda istese de film bir kez okunur.
// Okunamayan film (ağ yok) haritaya yazılmaz; bir sonraki istekte yeniden denenir.
//
// Ayrıca kişi (yönetmen / oyuncu) filmografisinin seçili dildeki BAŞLIKLARI (veri dosyasında İngilizce):
// `fetchPersonTitles`.

import { readTmdb } from "./favoriteRecommendations";

const TTL = 30 * 24 * 60 * 60 * 1000;
const CONCURRENCY = 4;

const memory = new Map(); // "<id>" → { year, country, rating, votes }
const inflight = new Map(); // "<id>" → Promise

/** TMDB film ayrıntısından görevlerin istediği alanlar. Saf (test edilir). */
export function challengeMetaOf(details) {
  const year = Number(String(details?.release_date || "").slice(0, 4)) || null;
  const country =
    (Array.isArray(details?.origin_country) && details.origin_country[0]) ||
    details?.production_countries?.[0]?.iso_3166_1 ||
    null;
  const rating = Number.isFinite(details?.vote_average) ? details.vote_average : null;
  const votes = Number.isFinite(details?.vote_count) ? details.vote_count : null;
  return { year, country, rating, votes };
}

/**
 * Kişi filmografisinin seçili dildeki başlıkları (`/person/{id}/movie_credits`, filmografiyle aynı önbellek).
 * Yönetmende `crew` (iş = Director), oyuncuda `cast` okunur.
 * TMDB'de o dilde çeviri yoksa `title` ÖZGÜN adı döner (Kurosawa'da Japonca yazı); o zaman veri dosyasındaki İngilizce
 * başlık kalır. Film zaten o dilde çekildiyse (Ceylan → Türkçe) özgün ad doğru başlıktır. Saf (test edilir).
 *
 * @returns {Object<string,string>} film kimliği → yerel başlık (yalnız kullanılabilir olanlar)
 */
export function localizedPersonTitles(credits, language, role = "director") {
  const base = String(language || "").slice(0, 2).toLowerCase();
  const out = {};
  const list = role === "actor" ? credits?.cast : credits?.crew;
  for (const credit of list || []) {
    if (!credit?.title || (role !== "actor" && credit.job !== "Director")) continue;
    const translated = credit.title !== credit.original_title;
    if (translated || credit.original_language === base) out[String(credit.id)] = credit.title;
  }
  return out;
}

/** @returns {Promise<Object<string,string>>} boş = İngilizce kalsın (ya da okunamadı) */
export async function fetchPersonTitles({ personId, role = "director", apiKey, language }) {
  if (!apiKey || !personId || String(language || "en").startsWith("en")) return {};
  try {
    const data = await readTmdb(`/person/${personId}/movie_credits`, { apiKey, language, type: "movie", maxAge: TTL });
    return localizedPersonTitles(data, language, role);
  } catch {
    return {};
  }
}

/** Bellekte olanlar (ağsız). */
export function cachedChallengeMeta(ids) {
  const out = {};
  for (const id of ids) {
    const hit = memory.get(String(id));
    if (hit) out[String(id)] = hit;
  }
  return out;
}

function readOne({ id, apiKey, language }) {
  const key = String(id);
  if (memory.has(key)) return Promise.resolve(memory.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const promise = readTmdb(`/movie/${key}`, { apiKey, language, type: "movie", maxAge: TTL })
    .then((details) => {
      const meta = challengeMetaOf(details);
      memory.set(key, meta);
      return meta;
    })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Eksik filmlerin ayrıntısını okur (en çok CONCURRENCY paralel).
 * @returns {Promise<Object<string,{year:number|null,country:string|null,rating:number|null,votes:number|null}>>}
 */
export async function fetchChallengeMeta({ ids, apiKey, language }) {
  const queue = [...new Set(ids.map(String))];
  const out = {};
  if (!apiKey) return out;
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      const meta = await readOne({ id, apiKey, language });
      if (meta) out[id] = meta;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return out;
}
