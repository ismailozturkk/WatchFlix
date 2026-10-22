// services/quickGamePool.js
//
// Hızlı oyunların ("Önce hangisi?", "Hangisi daha çok izlendi?", "Hangi on yıl?", "Film mi, dizi mi?",
// "Hangi tür?") ORTAK soru havuzu: Sahne Tahmin'in başlık havuzu (sceneGameService.fetchTitlePool), üç kaynaktan —
// en iyi filmler (eski klasikler yıl/dönem çeşitliliğini taşır), popüler filmler, popüler diziler.
//
// Bellek içi havuz oturumlar arasında paylaşılır (fetchTitlePool kendi içinde önbellekler); ikinci oyun ağ beklemez.
// Kullanılabilir öğe: yılı ve afişi olan (utils/olderGame.isUsable). Hiçbir kaynak gelmezse boş döner; çağıran
// "hata" durumuna geçer.

import { fetchTitlePool } from "./sceneGameService";
import { isUsable } from "../utils/olderGame";

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
