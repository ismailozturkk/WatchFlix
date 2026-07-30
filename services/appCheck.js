// services/appCheck.js
//
// Firebase App Check sarmalayıcısı (Faz 0 güvenlik maddesi). İki katman var:
//
//   1. NATIVE (@react-native-firebase/app-check): Play Integrity'den gerçek
//      cihaz/uygulama doğrulama token'ı üretir. Yayın build'inde provider
//      "playIntegrity", geliştirmede "debug"dur (debug token'ı Firebase
//      Console → App Check'e kaydedilmeli, logcat'te basılır).
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

let nativeAppCheck = null; // RNFB app-check modül nesnesi
let resolved = false;
let initialized = false;

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
    const { firebase } = rnfb;
    const provider = firebase.appCheck().newReactNativeFirebaseAppCheckProvider();
    const dev = typeof __DEV__ !== "undefined" && __DEV__;
    provider.configure({
      android: {
        // Play Integrity yalnız imzalı/dağıtılmış build'lerde anlamlı;
        // geliştirmede debug token kullanılır (Console'a kaydedilecek).
        provider: dev ? "debug" : "playIntegrity",
      },
      apple: {
        // iOS build'i henüz yok; App Attest Faz 3'te ele alınacak.
        provider: dev ? "debug" : "appAttestWithDeviceCheckFallback",
      },
    });
    firebase.appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    // Web SDK köprüsü: Firestore/Functions'ın token'ı native'den gelsin.
    // eslint-disable-next-line global-require
    const { initializeAppCheck, CustomProvider } = require("firebase/app-check");
    initializeAppCheck(webApp, {
      provider: new CustomProvider({
        getToken: async () => {
          const result = await firebase.appCheck().getToken(false);
          return {
            token: result.token,
            // RNFB süre bilgisini vermez; native SDK kendi önbelleğini
            // yönettiği için kısa tutmak güvenli ve ucuzdur.
            expireTimeMillis: Date.now() + 30 * 60 * 1000,
          };
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
