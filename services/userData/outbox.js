// services/userData/outbox.js
//
// BULUTA HENÜZ YAZILMAMIŞ DEĞİŞİKLİKLERİN KALICI GÜNLÜĞÜ.
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────────
//
// Yerel-öncelikli modelde buluttan artık veri çekmiyoruz; yerel kopya KAYNAK.
// Bu yüzden "yazdım ama buluta ulaşmadı" durumu görünmez bir veri kaybına
// dönüşür. Firebase JS SDK'sında React Native için kalıcı yazma kuyruğu yok
// (IndexedDB yok): çevrimdışıyken `setDoc` bellekte bekler, uygulama kapanırsa
// kaybolur. Bu günlük o boşluğu doldurur.
//
// ── GÜVENLİK MODELİ (kurtarma üçgeni) ────────────────────────────────────────
//
//   bulut     = yedek (onaylanmış her şey orada)
//   anlık     = yerel kontrol noktası (snapshotCache, ertelenmiş yazılır)
//   günlük    = bu dosya: kontrol noktasından SONRAKİ onaysız değişiklikler
//
// Kontrol noktası kaybolsa/bozulsa da: bulut + günlüğün tekrar oynatılması
// doğru durumu verir. Tek kural: bir işlem YALNIZ kontrol noktası diske
// indikten sonra günlükten silinir (bkz. syncWorker `beforeAck`).
//
// ── DEPOLAMA ─────────────────────────────────────────────────────────────────
//
// MMKV (`Keys.syncOutbox`, kullanıcı kapsamlı, çıkışta SİLİNMEZ): senkron ve
// süreç öldürülse bile korunur. Büyük belgeler burada değil dosyada (anlık)
// durur; günlük yalnız onaysız işlemleri tutar, yani küçüktür.
//
// ── BİRLEŞTİRME ──────────────────────────────────────────────────────────────
//
// Aynı belge yolu için ardışık işlemler tek işleme iner (son durum kazanır):
// bir notu 20 kez düzenlemek buluta 1 yazma demek. Yalnız UÇUŞTA olmayan işlem
// ezilir; uçuştaki zaten SDK'ya verilmiştir, yenisi onun ARKASINA eklenir.

import { Keys, get, set, remove as removeKey } from "../storage";

const VERSION = 1;

/** uid → { v, seq, ops } — MMKV'nin bellek aynası. */
const states = new Map();
/** uid → Set<id> — şu an buluta gönderilmekte olan işlemler (bellekte). */
const inflight = new Map();
const listeners = new Set();

const blank = () => ({ v: VERSION, seq: 0, ops: [] });

function emit(uid) {
  for (const fn of Array.from(listeners)) {
    try {
      fn(uid);
    } catch {
      // dinleyici hatası diğerlerini düşürmesin
    }
  }
}

function load(uid) {
  if (states.has(uid)) return states.get(uid);
  let state = blank();
  try {
    const raw = get(Keys.syncOutbox, { uid });
    if (raw && raw.v === VERSION && Array.isArray(raw.ops)) {
      state = {
        v: VERSION,
        seq: Number.isFinite(raw.seq) ? raw.seq : raw.ops.length,
        ops: raw.ops.filter((op) => op && typeof op.path === "string" && op.op),
      };
    }
  } catch {
    // bozuk kayıt: boş günlükle devam (store.get zaten kendini onarıyor)
  }
  states.set(uid, state);
  return state;
}

function persist(uid) {
  const state = states.get(uid);
  if (!state) return;
  if (state.ops.length === 0) {
    // Boş günlük anahtar tutmasın.
    removeKey(Keys.syncOutbox, { uid });
    return;
  }
  set(Keys.syncOutbox, state, { uid });
}

const inflightSet = (uid) => {
  let s = inflight.get(uid);
  if (!s) {
    s = new Set();
    inflight.set(uid, s);
  }
  return s;
};

/**
 * İşlem(ler)i ekler. Eklemeden ÖNCE kalıcı yazar (yazma-öncesi günlük): çağıran
 * dönmeden işlem diskte. Dönen dizi atanmış kimliklerle işlemlerdir.
 *
 * @param {string} uid
 * @param {Array<{path:string, op:"set"|"delete", data?:object,
 *   domain?:string, kind?:string, key?:string}>} ops
 */
export function enqueue(uid, ops) {
  if (!uid || !Array.isArray(ops) || ops.length === 0) return [];
  const state = load(uid);
  const flying = inflightSet(uid);
  const out = [];

  for (const input of ops) {
    if (!input?.path || (input.op !== "set" && input.op !== "delete")) continue;
    // Aynı yola bekleyen (uçuşta olmayan) işlem varsa o ezilir.
    state.ops = state.ops.filter((op) => op.path !== input.path || flying.has(op.id));
    state.seq += 1;
    const record = {
      id: String(state.seq),
      path: input.path,
      op: input.op,
      t: Date.now(),
      tries: 0,
    };
    if (input.op === "set") record.data = input.data;
    if (input.domain) {
      record.domain = input.domain;
      record.kind = input.kind;
      record.key = input.key;
    }
    state.ops.push(record);
    out.push(record);
  }

  persist(uid);
  emit(uid);
  return out;
}

/** Gönderilmeye hazır işlemler (ölü ve uçuştakiler hariç), kimlik sırasıyla. */
export function peek(uid, limit = 400) {
  if (!uid) return [];
  const flying = inflightSet(uid);
  return load(uid)
    .ops.filter((op) => !op.dead && !flying.has(op.id))
    .slice(0, limit);
}

export function markInflight(uid, ids) {
  const flying = inflightSet(uid);
  for (const id of ids) flying.add(id);
}

export function releaseInflight(uid, ids) {
  const flying = inflightSet(uid);
  for (const id of ids) flying.delete(id);
}

/** Onaylanan işlemleri günlükten siler. */
export function ack(uid, ids) {
  if (!uid || !ids?.length) return;
  const state = load(uid);
  const gone = new Set(ids);
  state.ops = state.ops.filter((op) => !gone.has(op.id));
  releaseInflight(uid, ids);
  persist(uid);
  emit(uid);
}

/**
 * Başarısız denemeyi kaydeder. `dead` verilirse işlem GÖNDERİLMEZ ama günlükte
 * KALIR: yerel kopya onu içeriyor, silersek bir sonraki kurtarmada kaybolurdu.
 */
export function recordFailure(uid, ids, { dead = null } = {}) {
  if (!uid || !ids?.length) return;
  const state = load(uid);
  const target = new Set(ids);
  for (const op of state.ops) {
    if (!target.has(op.id)) continue;
    op.tries = (op.tries || 0) + 1;
    if (dead) op.dead = String(dead).slice(0, 120);
  }
  releaseInflight(uid, ids);
  persist(uid);
  emit(uid);
}

/** Ölü işlemleri yeniden denenebilir yapar (yeni oturum / kural düzeltmesi). */
export function reviveDead(uid) {
  if (!uid) return 0;
  const state = load(uid);
  let n = 0;
  for (const op of state.ops) {
    if (op.dead) {
      delete op.dead;
      op.tries = 0;
      n += 1;
    }
  }
  if (n > 0) {
    persist(uid);
    emit(uid);
  }
  return n;
}

/**
 * Yerel kopyaya bindirilecek işlemler (ölüler DAHİL, uçuştakiler DAHİL):
 * hepsi yerel durumun parçası. Yalnız `domain` ile etiketli olanlar.
 */
export function overlayOps(uid, domain) {
  if (!uid) return [];
  return load(uid).ops.filter((op) => op.domain === domain && op.kind);
}

/** { pending, dead } — ölüler `pending`e dahil değil. */
export function counts(uid) {
  if (!uid) return { pending: 0, dead: 0 };
  let pending = 0;
  let dead = 0;
  for (const op of load(uid).ops) {
    if (op.dead) dead += 1;
    else pending += 1;
  }
  return { pending, dead };
}

/** Günlüğü tamamen siler (hesap silme). */
export function clear(uid) {
  if (!uid) return;
  states.delete(uid);
  inflight.delete(uid);
  removeKey(Keys.syncOutbox, { uid });
  emit(uid);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Yalnız test: bellek aynasını düşürür (MMKV'ye dokunmaz). */
export function __resetMemory() {
  states.clear();
  inflight.clear();
  listeners.clear();
}
