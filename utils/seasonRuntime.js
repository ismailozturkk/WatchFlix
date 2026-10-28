// utils/seasonRuntime.js
//
// Sezon detayındaki "toplam süre" rozeti (screens/tv/SeasonDetails): bölümlerin TMDB `runtime`
// alanlarının toplamı, dakika. Süresi bilinmeyen bölüm (çoğunlukla henüz yayınlanmamış) toplamı
// eksik bırakır → `partial` (rozet "452+ dakika" yazar). Saf; RN/ağ importu yok.

/**
 * @param {Array<{ runtime?: number|null }>} episodes  TMDB sezon yanıtındaki `episodes`
 * @returns {{ minutes: number, partial: boolean }}  süresi olan bölüm yoksa minutes = 0
 */
export function seasonRuntime(episodes) {
  let minutes = 0;
  let missing = 0;
  for (const episode of Array.isArray(episodes) ? episodes : []) {
    const value = Number(episode?.runtime);
    if (Number.isFinite(value) && value > 0) minutes += Math.round(value);
    else missing += 1;
  }
  return { minutes, partial: minutes > 0 && missing > 0 };
}
