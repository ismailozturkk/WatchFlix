// services/storage/errors.js
//
// Depolama katmanının TEK hata çıkışı. Eski kodda her çağrı yeri kendi
// `.catch(() => {})` bloğunu yazıyordu; bozuk bir JSON ya da dolu disk hiçbir
// yerde görünmüyordu. Artık hepsi buradan geçiyor: geliştirmede konsola,
// üretimde Sentry'ye.
//
// crashReporting TEMBEL require ile alınıyor — depolama modülü Sentry/React
// Native'e bağımlı olmadan (saf jest ortamında) test edilebilsin diye.

let reporter;

function getReporter() {
  if (reporter === undefined) {
    try {
      // eslint-disable-next-line global-require
      reporter = require("../crashReporting");
    } catch {
      reporter = null;
    }
  }
  return reporter;
}

/**
 * Yutulan bir depolama hatasını bildirir. ASLA throw etmez.
 *
 * @param {string} operation  "read" | "write" | "migrate:selectedTheme" gibi
 * @param {unknown} error
 * @param {object} [context]  Sentry'ye extra olarak gider (anahtar, depo...)
 */
export function reportStorageError(operation, error, context) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(`[storage] ${operation}:`, error?.message || error, context || "");
  }
  try {
    getReporter()?.captureError?.(error, {
      tags: { label: `storage/${operation}`.slice(0, 200) },
      extra: context,
    });
  } catch {
    // raporlama hatası uygulamayı etkilemesin
  }
}
