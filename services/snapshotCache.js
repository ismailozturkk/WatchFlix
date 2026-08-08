// services/snapshotCache.js
//
// "Son oturumda gördüğün ekranı, bu oturumda beklemeden gör."
//
// ── PROBLEM ──────────────────────────────────────────────────────────────────
//
// Firestore'un JS SDK'sında React Native için yerel kalıcılık yok (kalıcı
// önbellek IndexedDB'ye dayanıyor, RN'de IndexedDB yok). Bu yüzden proje
// çekilen veriyi kendisi diske yazıyor: `utils/cacheStore.js`.
//
// Ama yazılan veri AÇILIŞTA hâlâ geç kullanılıyordu. Beş context de aynı
// deseni elle kuruyordu ve hepsi okumayı bir `useEffect` içinde yapıyordu —
// yani önbellek DOLU olsa bile ilk kare "yükleniyor" olarak çiziliyordu.
//
// ── BU MODÜL NE EKLİYOR ──────────────────────────────────────────────────────
//
// Yeni bir depo DEĞİL: `cacheStore` + `cacheKeys` üstünde ince bir katman.
// Aynı dosyalar, aynı anahtarlar — "Verileri indir" (services/dataDownloader)
// tam olarak bunları dolduruyor, o bağ korunmalı. Eklenenler:
//
//   • `seed()`  — SENKRON okuma + süreç içi bellek; `useState` başlangıç
//                 değeri olarak kullanılmak üzere (asıl kazanç bu).
//   • `publish()` — değişmediyse YAZMAZ, art arda gelen güncellemelerde
//                 yalnız son hâli yazar.
//   • `flushSnapshotWrites()` — uygulama arka plana geçerken bekleyeni kurtarır.
//
// ── "VERİLERİ İNDİR" AYARIYLA İLİŞKİSİ ───────────────────────────────────────
//
// Bu katman o ayara BİLEREK tabi değil. Ayar TMDB içeriğini indirmekle ilgili
// (bkz. utils/dataCacheSettings.js); buradaki veri kullanıcının kendi profili
// ve listeleri. Tutmamak veri tasarrufu sağlamıyor, yalnızca her açılışı
// yavaşlatıyordu.
import * as cacheStore from "../utils/cacheStore";
import { sameJson } from "../utils/sameData";

/**
 * Art arda gelen güncellemelerde tek yazım. `ListStatusContext`'te dört
 * listener neredeyse aynı anda tetikleniyor.
 */
const DEBOUNCE_MS = 300;

const EMPTY = Object.freeze({ data: null, ts: 0, age: Infinity, hasCache: false });

/** `ns::key` → okunan değer. Dosya okumasını oturumda bir kez yapmak için. */
const memory = new Map();
/** `ns::key` → bekleyen yazım */
const pending = new Map();
/** `ns::key` → en son DİSKE yazılan değer */
const lastWritten = new Map();

const slotId = ([ns, key]) => `${ns}::${key}`;

/**
 * Kayıtlı anlık görüntüyü SENKRON okur.
 *
 * `useState` başlangıç değeri olarak kullanılmak üzere tasarlandı: efekt
 * beklemeden ilk karede doğru veriyi çizmek bu katmanın tüm amacı.
 *
 * @param {[string, string]} anahtar `cacheKeys.*(uid)` sonucu
 * @returns {{data: any, ts: number, age: number, hasCache: boolean}}
 */
export function seed(anahtar) {
  const id = slotId(anahtar);
  if (memory.has(id)) return memory.get(id);

  const [ns, key] = anahtar;
  const data = cacheStore.getJSON(ns, key);
  if (data === null || data === undefined) {
    memory.set(id, EMPTY);
    return EMPTY;
  }
  const age = cacheStore.getAge(ns, key);
  const sonuc = Object.freeze({
    data,
    ts: age === null ? 0 : Date.now() - age,
    age: age === null ? Infinity : age,
    hasCache: true,
  });
  memory.set(id, sonuc);
  return sonuc;
}

/**
 * Anlık görüntüyü kaydeder.
 *
 * @param {[string, string]} anahtar
 * @param {any} data
 * @param {{immediate?: boolean}} [options]
 */
export function publish(anahtar, data, { immediate = false } = {}) {
  const id = slotId(anahtar);

  // Aynı veri tekrar geldiyse diske dokunma. Listener'lar aynı snapshot'ı
  // tekrar tekrar yayınlayabiliyor.
  if (lastWritten.has(id) && sameJson(lastWritten.get(id), data)) return;

  const mevcut = pending.get(id);
  if (mevcut) clearTimeout(mevcut.timer);

  const yaz = () => {
    pending.delete(id);
    const [ns, key] = anahtar;
    cacheStore.setJSON(ns, key, data);
    lastWritten.set(id, data);
    // Bellek katmanı da tazelensin; aynı oturumda tekrar `seed()` çağıran
    // bir bileşen eski değeri görmesin.
    memory.set(
      id,
      Object.freeze({ data, ts: Date.now(), age: 0, hasCache: true }),
    );
  };

  if (immediate) {
    yaz();
    return;
  }
  pending.set(id, { timer: setTimeout(yaz, DEBOUNCE_MS), yaz });
}

/**
 * Bekleyen tüm yazımları hemen diske indirir.
 *
 * App.js'te uygulama arka plana geçerken çağrılır: erteleme penceresi
 * içindeyken süreç dondurulursa son güncelleme kaybolur ve kullanıcı bir
 * sonraki açılışta bir önceki hâli görürdü.
 */
export function flushSnapshotWrites() {
  for (const { timer, yaz } of Array.from(pending.values())) {
    clearTimeout(timer);
    yaz();
  }
}

/** Tek bir kaydı siler. */
export function dropSnapshot(anahtar) {
  const id = slotId(anahtar);
  const bekleyen = pending.get(id);
  if (bekleyen) {
    clearTimeout(bekleyen.timer);
    pending.delete(id);
  }
  lastWritten.delete(id);
  memory.delete(id);
  cacheStore.remove(anahtar[0], anahtar[1]);
}

/**
 * Süreç içi durumu sıfırlar. Çıkışta çağrılır.
 *
 * NEDEN GEREKLİ: çıkışta diskteki kayıtlar siliniyor ama bu modülün "en son
 * şunu yazmıştım" belleği süreçte kalıyor. Sıfırlanmazsa aynı oturumda geri
 * giren kullanıcının İLK snapshot'ı "zaten yazılmış" sanılıp diske hiç inmez,
 * ayrıca `memory` önceki kullanıcının verisini döndürürdü.
 */
export function resetSnapshotCache() {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  lastWritten.clear();
  memory.clear();
}
