// utils/tmdbKeyHealth.js
//
// TMDB anahtarının sağlık izlemesi (maliyet/güvenlik analizi M-1, seçilen yol "a").
//
// TMDB v4 okuma jetonu uygulama paketinde duruyor ve çıkarılabilir; kabul edilen risk, çünkü
// jeton salt-okunur. Riskin karşılığı şu: jeton sızarsa başkasının kullanımı bizim kotamızı
// yer. Bunun TEK belirtisi isteklerin 401 (jeton iptal/geçersiz) ya da 429 (hız sınırı) dönmeye
// başlaması; şimdiye kadar bu sessizce yutuluyordu ve ancak kullanıcı şikâyetiyle fark edilirdi.
//
// Burası yalnız SAYAR ve Sentry'ye bildirir: kullanıcıya bir şey göstermez, isteği değiştirmez.
// Döndürme adımları: docs/guvenlik/TMDB_JETON_YONETIMI.md.

import axios from "axios";
import { captureError } from "../services/crashReporting";

const isTmdb = (url) => typeof url === "string" && url.includes("api.themoviedb.org");

// Aynı sorun için oturum başına tek bildirim: ağ koptuğunda ya da kota dolduğunda
// yüzlerce istek birden düşer, Sentry'ye yüzlerce olay göndermenin bilgi değeri yok.
const reported = new Set();

// Tek tük 429 normaldir (ray açılışında paralel istek demeti). Ard arda bu kadar
// gelirse gerçekten sınırdayız demektir.
export const RATE_LIMIT_STREAK = 5;

const state = { rateLimitStreak: 0 };

/** Testler için. */
export function __resetTmdbKeyHealth() {
  reported.clear();
  state.rateLimitStreak = 0;
}

/**
 * Bir TMDB yanıtının durumunu değerlendirir.
 * @returns {null | { reason: "unauthorized"|"rate_limited", streak: number }} bildirilecek olay
 */
export function classifyTmdbStatus(status) {
  if (status === 401 || status === 403) {
    state.rateLimitStreak = 0;
    return { reason: "unauthorized", streak: 0 };
  }
  if (status === 429) {
    state.rateLimitStreak += 1;
    return state.rateLimitStreak >= RATE_LIMIT_STREAK
      ? { reason: "rate_limited", streak: state.rateLimitStreak }
      : null;
  }
  // Başarılı (ya da alakasız) bir yanıt seriyi sıfırlar.
  if (typeof status === "number" && status < 400) state.rateLimitStreak = 0;
  return null;
}

function report(event) {
  if (!event || reported.has(event.reason)) return;
  reported.add(event.reason);
  captureError(new Error(`TMDB ${event.reason}`), {
    tags: { label: "TMDB/keyHealth", tmdbReason: event.reason },
    extra: { streak: event.streak },
  });
}

export function installTmdbKeyHealth() {
  axios.interceptors.response.use(
    (response) => {
      if (isTmdb(response?.config?.url)) report(classifyTmdbStatus(response?.status));
      return response;
    },
    (error) => {
      if (isTmdb(error?.config?.url)) report(classifyTmdbStatus(error?.response?.status));
      return Promise.reject(error);
    },
  );
}
