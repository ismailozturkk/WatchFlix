// services/userData/syncWorker.js
//
// Yazma günlüğünü (outbox) buluta boşaltan arka plan işçisi.
//
// ── SÖZLEŞME ─────────────────────────────────────────────────────────────────
//
//  • Ekran HİÇBİR ZAMAN ağı beklemez: değişiklik önce yerelde ve günlükte, bu
//    işçi sonra gelir.
//  • İşlemler belge başına BİRLEŞİR ve `writeBatch` ile toplu gider (bir batch
//    = en çok `batchLimit` işlem): 50 bölüm hatırlatıcısı eklemek 50 değil 1
//    ağ turu.
//  • Tüm işlemler İDEMPOTENT (tam belge `set` / `delete`): aynı işlemi iki kez
//    göndermek zararsız. Bu yüzden zaman aşımı sonrası yeniden gönderim, süreç
//    öldüğünde kalan günlüğün oynatılması ve "gitti mi gitmedi mi" belirsizliği
//    güvenli.
//  • Onay sırası: commit OK → `beforeAck` (yerel kontrol noktasını diske indir)
//    → günlükten sil. Sıra değişirse çökme anında onaylanmış ama yerelde
//    olmayan bir değişiklik kaybolabilirdi (bkz. outbox.js).
//
// ── HATA SINIFLAMASI ─────────────────────────────────────────────────────────
//
//   transient  ağ/sunucu/kota/zaman aşımı → günlükte kal, GERİ ÇEKİLMEYLE tekrar
//   hard       invalid-argument vb. → yeniden denemek işe yaramaz → ölü
//   soft       permission-denied/unauthenticated/bilinmeyen → oturum token'ı
//              henüz hazır olmayabilir: birkaç kez dene, sonra ölü
//
// Toplu yazma tek bir kötü belge yüzünden komple düşer ("zehirli işlem").
// Batch kalıcı bir hatayla düşerse işlemler TEK TEK denenir; kötü olan ölüye
// ayrılır, geri kalanı geçer — kuyruk tıkanmaz.
//
// Ölü işlem günlükte KALIR (yerel kopya onu içeriyor) ve `reviveDead` ile yeni
// oturumda bir kez daha denenir.

import * as defaultOutbox from "./outbox";

export const BACKOFF_MS = Object.freeze([2000, 5000, 15000, 45000, 120000, 300000]);
const SOFT_MAX_TRIES = 3;

const HARD = new Set([
  "invalid-argument",
  "failed-precondition",
  "out-of-range",
  "already-exists",
  "unimplemented",
  "data-loss",
]);
const TRANSIENT = new Set([
  "unavailable",
  "deadline-exceeded",
  "aborted",
  "internal",
  "cancelled",
  "resource-exhausted",
  "unknown",
]);
const SOFT = new Set(["permission-denied", "unauthenticated"]);
const NETWORK_HINT = /network|offline|timeout|timed out|failed to fetch|unavailable|connection/i;

/** @returns {"transient"|"hard"|"soft"} */
export function classifyError(error) {
  if (error?.timeout) return "transient";
  const code = String(error?.code || "").replace(/^firestore\//, "");
  if (HARD.has(code)) return "hard";
  if (TRANSIENT.has(code)) return "transient";
  if (SOFT.has(code)) return "soft";
  // Kodsuz hata: ağ mı kendi hatamız mı bilinmez. Ağ ipucu varsa geçici say,
  // yoksa "yumuşak" — birkaç denemeden sonra ölüye ayrılır, kuyruğu sonsuza dek
  // tıkamaz.
  return NETWORK_HINT.test(String(error?.message || "")) ? "transient" : "soft";
}

/**
 * @param {object} deps
 * @param {{commit:(ops:Array)=>Promise<void>}} deps.remote
 * @param {object} [deps.outbox]            test için enjekte edilebilir
 * @param {()=>boolean} [deps.isOnline]
 * @param {(uid:string)=>boolean} [deps.isAuthed]
 * @param {(uid:string)=>void} [deps.beforeAck]  yerel kontrol noktasını diske indir
 */
export function createSyncWorker({
  remote,
  outbox = defaultOutbox,
  isOnline = () => true,
  isAuthed = () => true,
  beforeAck = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
  commitTimeoutMs = 20000,
  batchLimit = 400,
  debounceMs = 350,
  backoff = BACKOFF_MS,
}) {
  const running = new Map(); // uid → Promise
  const rerun = new Set();
  const timers = new Map(); // uid → { handle, due }
  const attempts = new Map(); // uid → ardışık geçici hata sayısı
  const meta = new Map(); // uid → { syncing, lastSyncedAt, lastError, waiting }
  const cache = new Map(); // uid → durum nesnesi (referans kararlı)
  const dirty = new Set();
  const listeners = new Set();
  let activeUid = null;
  const revived = new Set();

  const metaOf = (uid) => {
    let m = meta.get(uid);
    if (!m) {
      m = { syncing: false, lastSyncedAt: null, lastError: null, waiting: null };
      meta.set(uid, m);
    }
    return m;
  };

  function touch(uid) {
    dirty.add(uid);
    for (const fn of Array.from(listeners)) {
      try {
        fn(uid);
      } catch {
        // dinleyici hatası işçiyi düşürmesin
      }
    }
  }

  function patch(uid, partial) {
    Object.assign(metaOf(uid), partial);
    touch(uid);
  }

  // Günlük değişince (yerel yazma, onay) durum da değişir.
  outbox.subscribe((uid) => touch(uid));

  /** Referans-kararlı durum: yalnız değiştiğinde yeni nesne (useSyncExternalStore). */
  function getStatus(uid) {
    if (!uid) return EMPTY_STATUS;
    if (!dirty.has(uid) && cache.has(uid)) return cache.get(uid);
    const { pending, dead } = outbox.counts(uid);
    const m = metaOf(uid);
    const next = Object.freeze({
      pending,
      dead,
      syncing: m.syncing,
      lastSyncedAt: m.lastSyncedAt,
      lastError: m.lastError,
      waiting: m.waiting,
    });
    const prev = cache.get(uid);
    dirty.delete(uid);
    if (prev && shallowEqual(prev, next)) return prev;
    cache.set(uid, next);
    return next;
  }

  function subscribeStatus(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function withTimeout(promise, ms) {
    let handle;
    const timeout = new Promise((_, reject) => {
      handle = setTimer(() => {
        const err = new Error("commit timeout");
        err.timeout = true;
        err.code = "deadline-exceeded";
        reject(err);
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimer(handle));
  }

  function schedule(uid, delay) {
    const due = now() + delay;
    const existing = timers.get(uid);
    if (existing && existing.due <= due) return;
    if (existing) clearTimer(existing.handle);
    const handle = setTimer(() => {
      timers.delete(uid);
      flush(uid);
    }, delay);
    timers.set(uid, { handle, due });
  }

  function scheduleRetry(uid, error) {
    const n = attempts.get(uid) || 0;
    attempts.set(uid, n + 1);
    const delay = backoff[Math.min(n, backoff.length - 1)];
    patch(uid, { lastError: String(error?.code || error?.message || "error").slice(0, 80) });
    schedule(uid, delay);
  }

  function resetBackoff(uid) {
    attempts.delete(uid);
  }

  /**
   * Tek işlemin kalıcı/yumuşak hatasını işler.
   * @returns {"dead"|"retry"}
   */
  function failOne(uid, op, error, kind) {
    const tries = (op.tries || 0) + 1;
    const dead = kind === "hard" || tries >= SOFT_MAX_TRIES;
    outbox.recordFailure(uid, [op.id], {
      dead: dead ? String(error?.code || error?.message || kind) : null,
    });
    if (dead) {
      reportDead(op, error);
      return "dead";
    }
    return "retry";
  }

  function reportDead(op, error) {
    try {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[userData] işlem ölüye ayrıldı:", op.path, error?.code || error?.message);
      }
      // eslint-disable-next-line global-require
      require("../crashReporting").addBreadcrumb?.("userData dead-letter", {
        path: op.path.replace(/\/[^/]+\//, "/*/"), // uid'yi sızdırma
        op: op.op,
        code: error?.code,
      });
    } catch {
      // raporlama yardımcı; asla işçiyi düşürmez
    }
  }

  /** Batch düştü: işlemleri tek tek dene, zehirli olanı ayır. */
  async function isolate(uid, ops) {
    let needsRetry = false;
    for (const op of ops) {
      try {
        await withTimeout(remote.commit([op]), commitTimeoutMs);
        beforeAck(uid);
        outbox.ack(uid, [op.id]);
      } catch (error) {
        const kind = classifyError(error);
        if (kind === "transient") {
          // Kalanlar (bu dahil) uçuştan çıkar, ağ gelince devam.
          const rest = ops.slice(ops.indexOf(op)).map((o) => o.id);
          outbox.releaseInflight(uid, rest);
          scheduleRetry(uid, error);
          return "stop";
        }
        if (failOne(uid, op, error, kind) === "retry") needsRetry = true;
      }
    }
    if (needsRetry) {
      scheduleRetry(uid, { code: "retry" });
      return "stop";
    }
    return "continue";
  }

  async function drain(uid) {
    for (;;) {
      if (!isOnline()) {
        patch(uid, { waiting: "offline" });
        return;
      }
      if (!isAuthed(uid)) {
        patch(uid, { waiting: "auth" });
        return;
      }
      const ops = outbox.peek(uid, batchLimit);
      if (ops.length === 0) {
        patch(uid, { waiting: null });
        return;
      }
      patch(uid, { waiting: null });
      const ids = ops.map((op) => op.id);
      outbox.markInflight(uid, ids);

      try {
        await withTimeout(remote.commit(ops), commitTimeoutMs);
        beforeAck(uid);
        outbox.ack(uid, ids);
        resetBackoff(uid);
        patch(uid, { lastSyncedAt: now(), lastError: null });
        continue;
      } catch (error) {
        const kind = classifyError(error);
        if (kind === "transient") {
          outbox.releaseInflight(uid, ids);
          scheduleRetry(uid, error);
          return;
        }
        if (ops.length === 1) {
          const sonuc = failOne(uid, ops[0], error, kind);
          if (sonuc === "retry") {
            scheduleRetry(uid, error);
            return;
          }
          continue;
        }
        const sonuc = await isolate(uid, ops);
        if (sonuc === "stop") return;
      }
    }
  }

  function flush(uid) {
    if (!uid) return Promise.resolve();
    if (running.has(uid)) {
      rerun.add(uid);
      return running.get(uid);
    }
    const promise = (async () => {
      patch(uid, { syncing: true });
      try {
        do {
          rerun.delete(uid);
          await drain(uid);
        } while (rerun.has(uid));
      } catch (error) {
        // drain içindeki beklenmeyen hata (ör. remote.commit senkron fırlattı):
        // işçi ölmesin, geri çekilmeyle tekrar dene.
        scheduleRetry(uid, error);
      } finally {
        running.delete(uid);
        patch(uid, { syncing: false });
      }
    })();
    running.set(uid, promise);
    return promise;
  }

  /** Yerel yazmadan sonra çağrılır: kısa bir birleştirme penceresi sonra boşalt. */
  function requestFlush(uid, { delay = debounceMs } = {}) {
    if (!uid) return;
    schedule(uid, delay);
  }

  /**
   * Çıkış gibi anlarda: günlüğü en çok `timeoutMs` bekleyerek boşaltmayı dene.
   * @returns {Promise<boolean>} günlük boşaldı mı
   */
  async function flushNow(uid, { timeoutMs = 4000 } = {}) {
    if (!uid) return true;
    const existing = timers.get(uid);
    if (existing) {
      clearTimer(existing.handle);
      timers.delete(uid);
    }
    let handle;
    const sleep = new Promise((resolve) => {
      handle = setTimer(resolve, timeoutMs);
    });
    await Promise.race([flush(uid), sleep]);
    clearTimer(handle);
    return outbox.counts(uid).pending === 0;
  }

  /** Oturum açıldı / uid değişti. */
  function start(uid) {
    activeUid = uid || null;
    if (!uid) return;
    if (!revived.has(uid)) {
      revived.add(uid);
      outbox.reviveDead(uid);
    }
    schedule(uid, 0);
  }

  function stop(uid) {
    if (activeUid === uid) activeUid = null;
    const existing = timers.get(uid);
    if (existing) {
      clearTimer(existing.handle);
      timers.delete(uid);
    }
    attempts.delete(uid);
  }

  /** Ağ geri geldi / uygulama öne geldi: bekleme süresini sıfırla ve hemen dene. */
  function nudge() {
    if (!activeUid) return;
    attempts.delete(activeUid);
    schedule(activeUid, 0);
  }

  return {
    start,
    stop,
    nudge,
    flush,
    flushNow,
    requestFlush,
    getStatus,
    subscribeStatus,
  };
}

const EMPTY_STATUS = Object.freeze({
  pending: 0,
  dead: 0,
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  waiting: null,
});

function shallowEqual(a, b) {
  for (const key of Object.keys(b)) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
