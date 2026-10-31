// services/appCheck.js
//
// Firebase App Check sarmalayıcısı (Faz 0 güvenlik maddesi). İki katman var:
//
//   1. NATIVE (@react-native-firebase/app-check): Play Integrity / App Attest'ten
//      gerçek cihaz/uygulama doğrulama token'ı üretir. Yayın build'inde provider
//      Android "playIntegrity", iOS "appAttestWithDeviceCheckFallback". Geliştirme
//      build'inde App Check KAPALI; EXPO_PUBLIC_APPCHECK_DEBUG=1 ile "debug"
//      sağlayıcısıyla açılır (debug token'ı Firebase Console → App Check'e
//      kaydedilmeli, logcat / Xcode konsolunda basılır).
//
//   2. WEB SDK KÖPRÜSÜ: Uygulamanın Firestore/Functions çağrıları web SDK'dan
//      (firebase paketi) çıkıyor; web SDK'nın kendi provider'ları (ReCaptcha)
//      React Native'de çalışmaz. CustomProvider ile web SDK'nın token ihtiyacı
//      native katmana yönlendirilir — böylece callGemini ve Firestore istekleri
//      Play Integrity token'ı taşır.
//
// Sarmalayıcı, projedeki diğerleri gibi (analytics/crashReporting) SESSİZ
// NO-OP kuralına uyar: native modül yoksa (eski dev client, Expo Go) hiçbir
// şey başlatılmaz ve uygulama normal çalışır — istekler token'sız gider,
// sunucu tarafı enforcement açılana kadar bu sorun değildir.
//
// ⚠️ SIRALAMA: Sunucuda enforcement (functions/index.js `enforceAppCheck` ve
// Console'daki Firestore/RTDB enforce anahtarları) ANCAK tüm aktif build'ler
// bu modülü içerdikten sonra açılmalı; yoksa eski build'lerdeki istekler
// reddedilir.
//
// 2026-10-31 ölçümü: 28 günde Firestore'a 0 GEÇERLİ jeton geldi (yayın
// build'lerinde yerel jeton alınamıyor, geliştirme build'leri App Check'i
// atlıyor). Zorunluluk bu düzelmeden AÇILMAMALI — durumu ölçmek için:
// `npm run appcheck:status` (docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md M-3).

// Geliştirme build'inde App Check'i debug sağlayıcısıyla AÇAR (varsayılan kapalı).
// Zorunluluk açılınca jetonsuz geliştirme build'leri reddedileceği için gerekir:
// native SDK cihazın debug jetonunu logcat / Xcode konsoluna basar; o jeton
// Firebase Console → App Check → uygulama → "Debug jetonlarını yönet"e
// kaydedilmeli. Yayın build'ini ETKİLEMEZ (orada her zaman gerçek sağlayıcı).
const DEV_DEBUG_PROVIDER = process.env.EXPO_PUBLIC_APPCHECK_DEBUG === "1";

let nativeAppCheck = null; // RNFB app-check modül nesnesi
let resolved = false;
let initialized = false;

// Yerel jeton alınamadığında sebebi Sentry'ye düşer (Play Integrity / App Attest
// reddi, ağ). Web SDK jetonu her istekte yeniden isteyebildiği için aynı hata
// oturum başına BİR KEZ bildirilir.
const reportedTokenErrors = new Set();
function reportTokenError(error) {
  const message = String(error?.message || error || "unknown").slice(0, 200);
  const code = String(error?.code || "").slice(0, 60);
  const key = `${code}|${message}`;
  if (reportedTokenErrors.has(key)) return;
  reportedTokenErrors.add(key);
  try {
    // eslint-disable-next-line global-require
    const { captureError } = require("./crashReporting");
    captureError(new Error(`[appCheck] token alınamadı: ${message}`), {
      tags: { label: "AppCheck/getToken", appCheckCode: code || "none" },
    });
  } catch {}
}

function loadNative() {
  if (resolved) return nativeAppCheck;
  resolved = true;
  try {
    // eslint-disable-next-line global-require
    nativeAppCheck = require("@react-native-firebase/app-check");
  } catch (error) {
    nativeAppCheck = null;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[appCheck] Native modül yüklenemedi (yeni build gerekli?):",
        error?.message || error,
      );
    }
  }
  return nativeAppCheck;
}

/**
 * firebase.js'ten, web SDK app nesnesi oluşturulduktan hemen sonra BİR KEZ
 * çağrılır. Native App Check'i başlatır ve web SDK'ya CustomProvider köprüsü
 * kurar. Native modül yoksa sessizce `false` döner.
 *
 * @param {import("firebase/app").FirebaseApp} webApp - web SDK app nesnesi
 * @returns {boolean} başlatıldı mı
 */
export function initAppCheck(webApp) {
  if (initialized) return true;
  const rnfb = loadNative();
  if (!rnfb || !webApp) return false;

  try {
    // RNFB 26 kırıcı değişikliği: paket artık namespaced `firebase` nesnesini
    // dışa aktarmıyor (`firebase.appCheck()` yok). Provider, başlatma ve token
    // alma modular API'den geliyor. Eski kod burada TypeError atıp aşağıdaki
    // catch'e düşerdi — uygulama çalışmaya devam eder ama App Check SESSİZCE
    // kapalı kalırdı, yani istekler Play Integrity token'ı taşımazdı.
    //
    // `initializeAppCheck` de v26'da firebase-js-sdk ile hizalanıp senkron
    // olarak AppCheck örneği döndürüyor (native kurulum arka planda sürüyor).
    // İlk argüman app; `undefined` verilince varsayılan uygulama kullanılır.
    const {
      initializeAppCheck: initNativeAppCheck,
      getToken: getNativeAppCheckToken,
      ReactNativeFirebaseAppCheckProvider,
    } = rnfb;
    const provider = new ReactNativeFirebaseAppCheckProvider();
    const dev = typeof __DEV__ !== "undefined" && __DEV__;

    // Geliştirmede (__DEV__) debug token Firebase Console'a kaydedilmediğinde
    // Realtime Database "Provided AppCheck credentials are invalid" uyarısı basar.
    // Geliştirme ortamında bu uyarıyı engellemek ve gereksiz ağ trafiği oluşturmamak
    // için web SDK App Check köprüsü yalnız yayın (release) build'lerinde bağlanır —
    // EXPO_PUBLIC_APPCHECK_DEBUG=1 verilmedikçe (yukarıda DEV_DEBUG_PROVIDER).
    if (dev && !DEV_DEBUG_PROVIDER) {
      initialized = true;
      return true;
    }

    provider.configure({
      android: {
        provider: dev ? "debug" : "playIntegrity",
      },
      apple: {
        // App Attest, app.json'daki com.apple.developer.devicecheck.appattest-environment
        // yetkisi olmadan jeton üretemez; DeviceCheck yedeği Firebase'e .p8 anahtarı ister.
        provider: dev ? "debug" : "appAttestWithDeviceCheckFallback",
      },
    });
    const nativeInstance = initNativeAppCheck(undefined, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    // Web SDK köprüsü: Firestore/Functions'ın token'ı native'den gelsin.
    // eslint-disable-next-line global-require
    const { initializeAppCheck, CustomProvider } = require("firebase/app-check");
    initializeAppCheck(webApp, {
      provider: new CustomProvider({
        getToken: async (forceRefresh) => {
          try {
            const result = await getNativeAppCheckToken(nativeInstance, Boolean(forceRefresh));
            if (result?.token && typeof result.token === "string" && result.token.trim().length > 0) {
              return {
                token: result.token,
                expireTimeMillis: Date.now() + 30 * 60 * 1000,
              };
            }
            reportTokenError(new Error("empty token"));
          } catch (err) {
            reportTokenError(err);
          }
          // Hata fırlatınca web SDK isteğe kendi "hata jetonunu" ekler: zorunluluk
          // kapalıyken istek yine geçer (App Check metriklerinde INVALID görünür),
          // açıkken reddedilir. Boş/sahte jeton BİZ göndermeyiz.
          throw new Error("AppCheck token unavailable");
        },
      }),
      isTokenAutoRefreshEnabled: true,
    });

    initialized = true;
    return true;
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[appCheck] Başlatılamadı:", error?.message || error);
    }
    return false;
  }
}
