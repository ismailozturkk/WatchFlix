// functions/appCheckPolicy.js
//
// Callable'lar için TEK App Check anahtarı. index.js'teki onCall sarmalayıcısı her callable'a
// `enforceAppCheck: APP_CHECK_ENFORCED` verir — fonksiyon fonksiyon anahtar unutulmasın.
//
// AÇMADAN ÖNCE (`npm run appcheck:status`, 16 Kas 2026 ölçümü):
//   • Android Play Integrity hiç GEÇERLİ jeton üretmiyor (tüm VALID iOS'tan). Play'den inen
//     kapalı test sürümü de INVALID → Play uygulama imzalama anahtarının SHA-256'sı Firebase'de
//     kayıtlı mı bakılmalı / Sentry "AppCheck/getToken" hata kodu okunmalı.
//   • Mağazadaki eski sürümler jeton göndermiyor (MISSING_OUTDATED_CLIENT) → zorunlu güncelleme.
//   • Eşik: her serviste VALID ≥ %95 (scripts/appcheck-status.cjs).
// Açıldığında jetonsuz/geçersiz jetonlu çağrı "unauthenticated" ile reddedilir.
const APP_CHECK_ENFORCED = false;

module.exports = { APP_CHECK_ENFORCED };
