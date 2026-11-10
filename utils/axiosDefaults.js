// utils/axiosDefaults.js
//
// Global axios zaman aşımı. axios'un varsayılanı 0 = SINIRSIZ: zayıf bağlantıda
// (metro, asansör) istek asılı kalıyor, iskelet ekran sonsuza dek dönüyor ve
// çağrı yerindeki catch/"tekrar dene" hiç çalışmıyordu. `axios.get` kullanan
// 35 dosyanın 28'i süre vermiyordu (yayın denetimi 9 Kas, N-1).
//
// Kendi `timeout`'unu veren çağrılar (cineswipe 8 sn, top100 12 sn, hesap
// silme…) ETKİLENMEZ: istek düzeyindeki ayar varsayılanı ezer.
//
// 15 sn: TMDB'nin `append_to_response`'lu detay cevabı yavaş 3G'de birkaç
// saniye sürebiliyor; daha kısa süre çalışan isteği de keserdi.
import axios from "axios";

export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

let installed = false;

export function installAxiosDefaults() {
  if (installed) return;
  installed = true;
  axios.defaults.timeout = DEFAULT_REQUEST_TIMEOUT_MS;
}
