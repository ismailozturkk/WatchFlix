// Seelogd — Cloud Functions callable yük testi (k6)
// DURUM: HENÜZ ÇALIŞTIRILMADI. Yalnız staging/emülatör. Prod YASAK.
//
// Çalıştırma (örnek, staging):
//   BASE_URL=https://us-central1-<STAGING>.cloudfunctions.net \
//   ID_TOKEN=<staging test kullanıcı jetonu> \
//   STAGE=smoke \
//   k6 run load-test/k6-callables.js
//
// Not: Bu senaryo callable uçlarını HTTP olarak çağırır (firebase callable
// protokolü: POST { "data": {...} }). Fonksiyonlar FUNCTIONS_TEST=1 ile
// deploy edilmiş, yani Gemini/OMDb/TMDB/RevenueCat çağrıları stub olmalı.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "";
const ID_TOKEN = __ENV.ID_TOKEN || "";
const STAGE = __ENV.STAGE || "smoke";

// ── Guard: prod'a karşı çalışmayı reddet ─────────────────────────────────
if (BASE_URL.includes("movieandtv-2832a")) {
  throw new Error("PROD HEDEFI YASAK: BASE_URL prod projeyi (movieandtv-2832a) gösteriyor.");
}
if (!BASE_URL || !ID_TOKEN) {
  throw new Error("BASE_URL ve ID_TOKEN zorunlu (staging). Bkz. load-test/README.md");
}

// 100 → 1k → 5k → 10k kademeleri. STAGE env ile seç.
const STAGES = {
  smoke: [{ duration: "30s", target: 5 }],
  s100: [{ duration: "2m", target: 100 }, { duration: "5m", target: 100 }, { duration: "1m", target: 0 }],
  s1k: [{ duration: "2m", target: 1000 }, { duration: "5m", target: 1000 }, { duration: "1m", target: 0 }],
  s5k: [{ duration: "3m", target: 5000 }, { duration: "5m", target: 5000 }, { duration: "2m", target: 0 }],
  s10k: [{ duration: "4m", target: 10000 }, { duration: "5m", target: 10000 }, { duration: "2m", target: 0 }],
};

export const options = {
  stages: STAGES[STAGE] || STAGES.smoke,
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true }], // hata >%5 → iptal
    http_req_duration: ["p(95)<3000"], // p95 < 3s hedef (callable + stub upstream)
  },
};

function callable(name, data) {
  return http.post(
    `${BASE_URL}/${name}`,
    JSON.stringify({ data }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${ID_TOKEN}` } },
  );
}

export default function () {
  // Okuma-ağırlıklı: davet özeti (upstream'siz, Firestore okur).
  const overview = callable("getReferralOverview", {});
  check(overview, { "overview 2xx": (r) => r.status >= 200 && r.status < 300 });

  sleep(Math.random() * 3 + 1); // think time 1-4s

  // AI yolu (Gemini STUB olmalı): kota/kimlik/maxInstances davranışı.
  const ai = callable("callGemini", { mode: "chat", userMessage: "yük testi stub mesajı" });
  check(ai, { "ai cevap döndü (2xx|429 kota)": (r) => r.status === 200 || r.status === 429 });

  sleep(Math.random() * 3 + 2);
}
