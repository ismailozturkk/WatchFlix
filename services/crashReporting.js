// services/crashReporting.js
//
// Sentry sarmalayıcısı. Uygulamanın hiçbir yeri doğrudan Sentry'yi import
// ETMEZ — hepsi buradan geçer. Sebep:
//   1. DSN yoksa (yerel geliştirme, DSN'i olmayan katkıcı) her şey sessiz
//      no-op olmalı; her çağrı yerinde ayrı guard yazılmasın.
//   2. Sentry native modülü YENİ derleme gerektirir. Mevcut dev client'ta
//      modül yokken import patlarsa uygulama hiç açılmaz — bu yüzden yükleme
//      try/catch içinde ve tembel.
//   3. Sağlayıcı değişirse (Crashlytics vb.) tek dosya değişir.
//
// Kurulum: yayın DSN'i aşağıda sabit — DSN gizli bir değer değil, zaten uygulama
// paketine gömülü gidiyor. EXPO_PUBLIC_SENTRY_DSN tanımlıysa onu ezer (başka bir
// Sentry projesine yönlendirmek için). Değişkeni "" yaparsan raporlama tamamen
// kapanır. Sabit tutulmasının sebebi: EAS bulut build'i `.env` dosyalarını
// yüklemiyor, ortam değişkeni unutulduğunda raporlama sessizce ölüyordu.
//
// Native modül YENİ derleme gerektirir; mevcut dev client'ta modül yoksa yükleme
// aşağıdaki try/catch'e düşer ve uygulama normal çalışır, yalnız rapor gitmez.

const FALLBACK_DSN =
  "https://eb582bf4e968508f75825960d6b35df9@o4511802519388160.ingest.de.sentry.io/4511802537345104";

const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN === undefined
    ? FALLBACK_DSN
    : process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentry = null;      // yüklenmiş modül
let resolved = false;   // yükleme denendi mi
let initialized = false;
let navigationIntegration = null; // ekran geçiş izleme (React Navigation)

function loadSentry() {
  if (resolved) return sentry;
  resolved = true;
  try {
    // eslint-disable-next-line global-require
    sentry = require("@sentry/react-native");
  } catch (error) {
    sentry = null;
    if (__DEV__) {
      console.warn(
        "[crashReporting] Sentry modülü yüklenemedi (yeni build gerekli?):",
        error?.message || error,
      );
    }
  }
  return sentry;
}

/**
 * Uygulama açılışında BİR KEZ çağrılır (App.js modül seviyesinde).
 * DSN yoksa hiçbir şey yapmaz ve `false` döner.
 */
export function initCrashReporting() {
  if (initialized) return true;
  if (!DSN) {
    if (__DEV__) {
      console.info("[crashReporting] EXPO_PUBLIC_SENTRY_DSN yok — kapalı.");
    }
    return false;
  }

  const Sentry = loadSentry();
  if (!Sentry?.init) return false;

  try {
    // Ekran geçişlerini transaction'a çevirir; App.js, NavigationContainer
    // hazır olunca registerNavigationContainer ile container'ı kaydeder.
    // TTID: ekrana ilk kare çizim süresi (lazy getComponent maliyeti dahil).
    navigationIntegration = Sentry.reactNavigationIntegration
      ? Sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true })
      : null;

    Sentry.init({
      dsn: DSN,
      // Geliştirmede kendi hatalarımızı üretim panosuna karıştırmayalım.
      environment: __DEV__ ? "development" : "production",
      enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEV === "1",
      // Performans izleme: uygulama açılışı (app start), yavaş/donmuş kare ve
      // ekran geçiş süreleri. %15 örnekleme dağılımı görmeye yetiyor, kotayı
      // yakmıyor — açılış iyileştirmelerinin gerçek cihaz etkisi buradan
      // (Sentry > Insights > Mobile Vitals) izlenir. Ölçülen süreler PII değil;
      // sendDefaultPii kararı aynen geçerli.
      tracesSampleRate: 0.15,
      // Dizi biçimi varsayılan entegrasyonlara EKLER (değiştirmez).
      integrations: navigationIntegration ? [navigationIntegration] : [],
      // Kişisel veri gönderme (IP, kullanıcı adı vb.) — KVKK/GDPR beyanını
      // dar tutmak için kapalı. Kullanıcıyı yalnız uid ile etiketliyoruz.
      sendDefaultPii: false,
    });
    initialized = true;
    return true;
  } catch (error) {
    if (__DEV__) console.warn("[crashReporting] init:", error?.message || error);
    return false;
  }
}

/** Oturum açan kullanıcıyı etiketler; çıkışta `null` ile temizlenir. */
export function setCrashUser(uid) {
  if (!initialized) return;
  try {
    sentry?.setUser?.(uid ? { id: uid } : null);
  } catch {}
}

/**
 * Ölümcül olmayan hata bildirimi (yakalanmış ama sessizce yutulan hatalar).
 *
 * `tags`  → kısa, gruplanabilir etiketler ({ label: "Stats/watchedTv" }).
 *           Sentry etiket değerlerini 200 karakterle sınırlar; uzun metin
 *           koyma, arama/gruplama bozulur.
 * `extra` → uzun bağlam (component stack, payload özeti...).
 */
export function captureError(error, { tags, extra } = {}) {
  if (!initialized) return;
  try {
    sentry?.captureException?.(
      error instanceof Error ? error : new Error(String(error?.message || error)),
      tags || extra ? { tags, extra } : undefined,
    );
  } catch {}
}

/** Hata öncesi izi bırakır (hangi ekran, hangi aksiyon). */
export function addBreadcrumb(message, data) {
  if (!initialized) return;
  try {
    sentry?.addBreadcrumb?.({ message, data, level: "info" });
  } catch {}
}

/**
 * Kök bileşeni sarmalar (dokunma izleri, kök seviyesinde hata yakalama).
 * Sentry yüklenemediyse bileşeni olduğu gibi döndürür — App.js'in doğrudan
 * `@sentry/react-native` import etmesine gerek kalmasın diye burada.
 */
export function wrapRoot(Component) {
  try {
    return loadSentry()?.wrap?.(Component) || Component;
  } catch {
    return Component;
  }
}

/**
 * NavigationContainer hazır olunca çağrılır (App.js onReady). Ekran geçiş
 * transaction'ları ancak container kaydedilince akmaya başlar; Sentry
 * kapalıysa/yüklenemediyse sessiz no-op.
 */
export function registerNavigationContainer(ref) {
  if (!initialized) return;
  try {
    navigationIntegration?.registerNavigationContainer?.(ref);
  } catch {}
}

export function isCrashReportingActive() {
  return initialized;
}
