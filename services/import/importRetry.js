// services/import/importRetry.js
//
// Uzun süren içe aktarımın dayanıklılık yardımcıları: durdurma sinyali, iptal edilebilir
// bekleme, geri çekilmeli (backoff) yeniden deneme ve hata sınıflandırması.
//
// Sınıflandırma neden önemli: eskiden TMDB'ye ulaşılamayan her öğe "eşleşmedi" sayılıp
// sessizce atlanıyordu; bağlantı bir dakika kopsa yüzlerce film kaybolurdu. Artık geçici
// hata (ağ, 429, 5xx, Firestore "unavailable") yeniden denenir, kalıcı olursa iş durur ve
// kullanıcı kaldığı yerden devam eder.

import { ImportError } from "./importErrors";

/** Aktarımı durdurmak için paylaşılan sinyal. `cancel()` bir sonraki öğe sınırında etkili olur. */
export function createImportSignal() {
  const listeners = new Set();
  const signal = {
    cancelled: false,
    cancel() {
      if (signal.cancelled) return;
      signal.cancelled = true;
      listeners.forEach((listener) => listener());
      listeners.clear();
    },
    onCancel(listener) {
      if (signal.cancelled) {
        listener();
        return () => {};
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return signal;
}

export function throwIfCancelled(signal) {
  if (signal?.cancelled) throw new ImportError("cancelled", "Import cancelled by the user.");
}

/** İptal edilebilir bekleme: sinyal gelirse beklemeyi bırakıp `cancelled` fırlatır. */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.cancelled) {
      reject(new ImportError("cancelled"));
      return;
    }
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, Math.max(0, ms));
    if (signal?.onCancel) {
      unsubscribe = signal.onCancel(() => {
        clearTimeout(timer);
        reject(new ImportError("cancelled"));
      });
    }
  });
}

export const backoffDelay = (attempt, baseMs = 500, maxMs = 6000) => {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  // ±%20 sarsıntı: eşzamanlı işçiler aynı anda yeniden denemesin.
  return Math.round(exp * (0.8 + Math.random() * 0.4));
};

/**
 * `fn`'i geçici hatalarda geri çekilerek yeniden dener.
 * @param {(attempt:number)=>Promise<any>} fn
 * @param {{ retries?: number, baseMs?: number, maxMs?: number, signal?: object,
 *   isRetryable?: (error:any)=>boolean, delayFor?: (error:any, attempt:number)=>number|null }} options
 */
export async function withRetry(fn, {
  retries = 3,
  baseMs = 500,
  maxMs = 6000,
  signal,
  isRetryable = () => false,
  delayFor,
} = {}) {
  let attempt = 0;
  for (;;) {
    throwIfCancelled(signal);
    try {
      return await fn(attempt);
    } catch (error) {
      if (error instanceof ImportError && error.code === "cancelled") throw error;
      if (attempt >= retries || !isRetryable(error)) throw error;
      const custom = delayFor ? delayFor(error, attempt) : null;
      await sleep(custom ?? backoffDelay(attempt, baseMs, maxMs), signal);
      attempt += 1;
    }
  }
}

// ---- HTTP (axios) -----------------------------------------------------------

/** "transient" → yeniden dene; "notFound" → eşleşme yok; "auth" → anahtar/erişim sorunu, iş durmalı. */
export function classifyHttpError(error) {
  const status = error?.response?.status;
  if (status == null) return "transient"; // ağ hatası, zaman aşımı, DNS
  if (status === 429 || status >= 500) return "transient";
  if (status === 401 || status === 403) return "auth";
  return "notFound";
}

/** 429 cevabındaki Retry-After (saniye) başlığı; yoksa null. */
export function retryAfterMs(error) {
  const header = error?.response?.headers?.["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(10000, seconds * 1000) : null;
}

// ---- Firestore -------------------------------------------------------------

const firestoreCode = (error) => String(error?.code || "").replace(/^firestore\//, "");

// Çekişme/aşırı yük: aynı öğeyi biraz sonra yeniden yazmak çoğu zaman tutar.
const TRANSIENT_FIRESTORE = new Set(["aborted", "unavailable", "deadline-exceeded", "resource-exhausted", "internal"]);

export const isTransientFirestoreError = (error) => TRANSIENT_FIRESTORE.has(firestoreCode(error));

/** Bağlantı yok: sıradaki öğeleri denemenin anlamı yok, iş durmalı. */
export const isOfflineFirestoreError = (error) => {
  const code = firestoreCode(error);
  return code === "unavailable" || /offline/i.test(String(error?.message || ""));
};
