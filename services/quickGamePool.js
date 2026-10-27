// services/quickGamePool.js
//
// Hızlı oyunların ("Önce hangisi?", "Hangisi daha çok izlendi?", "Hangi on yıl?", "Film mi, dizi mi?",
// "Hangi tür?") ORTAK soru havuzu: Sahne Tahmin'in başlık havuzu (sceneGameService.fetchTitlePool), üç kaynaktan —
// en iyi filmler (eski klasikler yıl/dönem çeşitliliğini taşır), popüler filmler, popüler diziler.
//
// Bellek içi havuz oturumlar arasında paylaşılır (fetchTitlePool kendi içinde önbellekler); ikinci oyun ağ beklemez.
// Kullanılabilir öğe: yılı ve afişi olan (utils/olderGame.isUsable). Hiçbir kaynak gelmezse boş döner; çağıran
// "hata" durumuna geçer.

import { fetchTitlePool, getTextlessPoster } from "./sceneGameService";
import { isUsable, keyOfItem } from "../utils/olderGame";
import { buildQuickQuestion } from "../utils/quickGames";

export const QUICK_POOL_SOURCES = ["top_rated_movie", "popular_movie", "popular_tv"];
export const MIN_USABLE_POOL = 12;

/** @returns {Promise<Array>} kullanılabilir, tekilleştirilmiş havuz (boş olabilir) */
export async function loadQuickPool(apiKey, language) {
  const settled = await Promise.allSettled(
    QUICK_POOL_SOURCES.map((source) => fetchTitlePool(apiKey, language, source)),
  );
  const seen = new Set();
  const pool = [];
  settled.forEach((entry) => {
    if (entry.status !== "fulfilled" || !Array.isArray(entry.value)) return;
    entry.value.forEach((item) => {
      if (!isUsable(item) || seen.has(item.mediaKey)) return;
      seen.add(item.mediaKey);
      pool.push(item);
    });
  });
  return pool;
}

// ── Bulanık Afiş: yazısız afişli soru ────────────────────────────────────────
//
// Havuzun afişi (poster_path) çoğunlukla BAŞLIKLI: bulanıklık azalınca yazı okunur ve cevap bir bakışta belli olur.
// Bu yüzden Poster Bulmaca gibi TMDB'nin dilsiz afişi (`/images`, iso_639_1 = null) aranır; yoksa yapım bu oyunda
// sorulmaz (başlıklı afişe DÜŞÜLMEZ). Adaylar gruplar halinde paralel sorulur (bir ağ turu ≈ BLUR_PROBE_BATCH aday);
// /images yanıtı sceneGameService'te önbellekte, aynı yapım ikinci kez istenmez.

export const BLUR_PROBE_BATCH = 3;
export const BLUR_PROBE_MAX = 15;

/**
 * Doğru cevabının yazısız afişi olan bir Bulanık Afiş sorusu. Afişi olmayan adaylar `rejected`e eklenir (oturum
 * boyunca bir daha denenmez). Hiçbiri bulunamazsa (ya da ağ yoksa) null.
 *
 * @param {string} apiKey
 * @param {Array} pool
 * @param {{ streak?: number, recent?: Set<string>, rejected?: Set<string>, lookup?: Function }} [options]
 */
export async function buildTextlessBlurQuestion(
  apiKey,
  pool,
  { streak = 0, recent = new Set(), rejected = new Set(), lookup = getTextlessPoster } = {},
) {
  const tried = new Set(recent);
  let probed = 0;
  while (probed < BLUR_PROBE_MAX) {
    const usable = (Array.isArray(pool) ? pool : []).filter((item) => !rejected.has(keyOfItem(item)));
    const batch = [];
    while (batch.length < BLUR_PROBE_BATCH && probed + batch.length < BLUR_PROBE_MAX) {
      const question = buildQuickQuestion("blur", { pool: usable, streak, recent: tried });
      // Taze aday bitince çekirdek eski adaylara döner: aynısı gelirse bu tur bu kadar.
      if (!question || batch.some((q) => q.correctKey === question.correctKey)) break;
      tried.add(question.correctKey);
      batch.push(question);
    }
    if (batch.length === 0) return null;
    probed += batch.length;
    const paths = await Promise.all(
      batch.map((question) => Promise.resolve(lookup(apiKey, question.items[0])).catch(() => null)),
    );
    const index = paths.findIndex(Boolean);
    if (index >= 0) {
      const question = batch[index];
      return { ...question, items: [{ ...question.items[0], posterPath: paths[index] }] };
    }
    batch.forEach((question) => rejected.add(question.correctKey));
  }
  return null;
}
