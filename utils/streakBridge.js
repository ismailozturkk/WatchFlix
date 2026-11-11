// utils/streakBridge.js
//
// Seri sisteminin DIŞ DÜNYA köprüsü: sunucu saati, bulut eşitlemesi ve hatırlatma
// bildirimi. Varsayılanlar ETKİSİZ (cihaz saati, bulut yok, bildirim yok); gerçek
// uygulamalar services/streakRuntime.js tarafından App açılışında kaydedilir.
//
// NEDEN KÖPRÜ: defter (utils/watchBadgeLedger.js) ve kanca (hooks/useWatchProgress.js)
// jest'te saf olarak test ediliyor; Firebase / expo-notifications import etselerdi
// testler yüklenemezdi (jest.config.js başı). Testler köprüyü hiç kaydetmez ya da
// sahte bir uygulama kaydeder.
//
// SAF MODÜL: React, Firebase, depolama importu YOKTUR.

const varsayilan = Object.freeze({
  /** Sunucu saatine göre şimdi (ms). */
  simdi: () => Date.now(),
  /** Saat bu oturumda sunucuyla doğrulandı mı. */
  dogrulandi: () => false,
  /** Saat eşitlemesi denendiyse (başarılı/başarısız) çözülen söz. */
  hazir: () => Promise.resolve(),
  /** Buluttaki seri belgesini getirir (yoksa null). */
  bulutOku: async () => null,
  /** Seri belgesini buluta yazar. */
  bulutYaz: async () => {},
  /** Buluttaki seri belgesini siler (hesabı sıfırla). */
  bulutSil: async () => {},
  /** Hatırlatma planını uygular: plan null → iptal. */
  hatirlatmaPlanla: async () => {},
});

let aktif = { ...varsayilan };

/** Gerçek uygulamaları kaydeder (kısmi olabilir). Önceki kaydı döndürür (testler için). */
export function streakBridgeKaydet(uygulama = {}) {
  const onceki = aktif;
  aktif = { ...varsayilan, ...uygulama };
  return onceki;
}

/** Varsayılana döner (testler). */
export function streakBridgeSifirla() {
  aktif = { ...varsayilan };
}

export const streakBridge = {
  simdi: () => {
    const n = Number(aktif.simdi());
    return Number.isFinite(n) ? n : Date.now();
  },
  dogrulandi: () => Boolean(aktif.dogrulandi()),
  hazir: (ms = 3000) => Promise.race([
    Promise.resolve().then(() => aktif.hazir()).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]),
  bulutOku: (uid) => Promise.resolve().then(() => aktif.bulutOku(uid)).catch(() => null),
  bulutYaz: (uid, veri) => Promise.resolve().then(() => aktif.bulutYaz(uid, veri)).catch(() => {}),
  bulutSil: (uid) => Promise.resolve().then(() => aktif.bulutSil(uid)).catch(() => {}),
  hatirlatmaPlanla: (plan) => Promise.resolve().then(() => aktif.hatirlatmaPlanla(plan)).catch(() => {}),
};
