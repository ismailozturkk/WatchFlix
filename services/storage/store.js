// services/storage/store.js
//
// Registry üstündeki tipli, SENKRON erişim katmanı. Uygulamanın tamamı bu üç
// fonksiyonu kullanır: get / set / remove.
//
// AsyncStorage'a göre üç davranış farkı, hepsi kasıtlı:
//
//  1. SENKRON. `await` yok. AppSettingsContext açılışta multiGet beklemek yerine
//     useState başlangıç değerini doğrudan diskten okuyor → tema/dil flash'ı bitti.
//  2. ASLA THROW ETMEZ, ASLA undefined SIZDIRMAZ. Kayıt yoksa, JSON bozuksa ya da
//     doğrulama başarısızsa registry'deki `default` döner ve bozuk kayıt SİLİNİR
//     (kendini onarma). Eskiden bozuk bir JSON en yakın try/catch'e göre ya ekranı
//     boşaltıyor ya sessizce yutuluyordu.
//  3. ABONE OLUNABİLİR. `subscribe` / `useStored` ile değişiklik dinlenir; iki
//     modülün aynı anahtarı ayrı ayrı hidrate etme ihtiyacı ortadan kalkar.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getStore } from "./instances";
import { readTyped, writeTyped } from "./codec";
import { Keys, physicalKey } from "./registry";
import { reportStorageError } from "./errors";

/* ------------------------------------------------------------------ */
/* Aktif kullanıcı                                                     */
/* ------------------------------------------------------------------ */
//
// scope:"user" anahtarlarda `uid` verilmezse buradaki aktif kullanıcı kullanılır.
// Böylece taslak/sohbet gibi servisler imzalarına uid parametresi eklemeden
// kullanıcı kapsamlı hale geldi.
//
// İlk değer `cachedUserId`den SENKRON türetilir: Firebase oturumu çözmesi bir
// tur sürüyor ve o tur içinde açılan bir ekran aksi halde `guest` kapsamını
// okurdu (yani kullanıcı kendi taslaklarını bir an boş görürdü).

let activeUid;

function activeUser() {
  if (activeUid === undefined) {
    try {
      activeUid = readTyped(getStore(Keys.cachedUserId.store), Keys.cachedUserId.key, "string") || null;
    } catch {
      activeUid = null;
    }
  }
  return activeUid;
}

/** Oturum durumu değiştiğinde AuthContext çağırır. */
export function setActiveUser(uid) {
  activeUid = uid || null;
}

export function getActiveUser() {
  return activeUser();
}

/**
 * Tembel önbelleği düşürür; sonraki okuma `cachedUserId`yi diskten tazeler.
 *
 * Göç bittiğinde ÇAĞRILMALI: göçten önce kullanıcı kapsamlı bir okuma olduysa
 * `activeUid` o an boş olan depodan `null` diye önbelleklenir ve göç
 * `cachedUserId`yi yazdıktan sonra bile null kalırdı — kullanıcı kendi
 * taslaklarını/sohbetlerini `guest` kapsamında arardı.
 */
export function resetActiveUser() {
  activeUid = undefined;
}

/** Anahtar kullanıcı kapsamlıysa etkin uid'i çözer. */
function resolveUid(descriptor, options) {
  if (descriptor.scope !== "user") return undefined;
  return options && "uid" in options ? options.uid : activeUser();
}

/* ------------------------------------------------------------------ */
/* Abonelik + snapshot önbelleği                                       */
/* ------------------------------------------------------------------ */

// `${storeName}:${physicalKey}` → Set<callback>
const subscribers = new Map();
// `${storeName}:${physicalKey}` → çözülmüş değer. useSyncExternalStore'un
// referans kararlılığı için şart: json okumaları her çağrıda yeni nesne üretir,
// önbelleklenmezse sonsuz yeniden render olur.
const snapshots = new Map();
// Dinleyicisi kurulmuş depolar
const wired = new Set();

const slot = (storeName, key) => `${storeName}:${key}`;

function wire(storeName) {
  if (wired.has(storeName)) return;
  wired.add(storeName);
  try {
    getStore(storeName).addOnValueChangedListener((key) => {
      const id = slot(storeName, key);
      snapshots.delete(id);
      const set = subscribers.get(id);
      if (!set) return;
      for (const fn of set) {
        try {
          fn();
        } catch (error) {
          reportStorageError("notify", error, { key });
        }
      }
    });
  } catch (error) {
    reportStorageError("wire", error, { store: storeName });
  }
}

/* ------------------------------------------------------------------ */
/* Okuma / yazma                                                       */
/* ------------------------------------------------------------------ */

/**
 * Anahtarın değerini döner. Kayıt yok / bozuk / doğrulama başarısızsa
 * registry'deki `default`.
 *
 * @param {object} descriptor Keys.* girdisi
 * @param {{uid?: string}} [options] scope:"user" anahtarlar için
 */
export function get(descriptor, options) {
  const key = physicalKey(descriptor, resolveUid(descriptor, options));
  try {
    const store = getStore(descriptor.store);
    const raw = readTyped(store, key, descriptor.type);
    if (raw === undefined) return descriptor.default;

    if (descriptor.validate && !descriptor.validate(raw)) {
      // Bozuk/eski biçimli kayıt: sessizce varsayılana düşmek yerine temizle ki
      // bir daha doğrulama maliyeti ödenmesin ve durum gözlemlenebilir olsun.
      reportStorageError("validate", new Error("değer doğrulamayı geçemedi"), {
        key,
        type: descriptor.type,
      });
      store.remove(key);
      return descriptor.default;
    }
    return raw;
  } catch (error) {
    reportStorageError("read", error, { key, store: descriptor.store });
    return descriptor.default;
  }
}

/**
 * Değeri yazar. Tip uyuşmazsa ya da doğrulama başarısızsa YAZMAZ ve `false` döner
 * — bozuk veriyi diske indirmemek okumayı da güvenli kılar.
 *
 * `null`/`undefined` yazmak = anahtarı silmek (registry varsayılanına dönüş).
 */
export function set(descriptor, value, options) {
  const key = physicalKey(descriptor, resolveUid(descriptor, options));

  if (value === null || value === undefined) {
    return remove(descriptor, options);
  }
  if (descriptor.validate && !descriptor.validate(value)) {
    reportStorageError("validate:write", new Error("değer doğrulamayı geçemedi"), {
      key,
      type: descriptor.type,
    });
    return false;
  }

  try {
    const store = getStore(descriptor.store);
    wire(descriptor.store);
    const ok = writeTyped(store, key, descriptor.type, value);
    if (!ok) {
      reportStorageError("write:type", new Error(`tip uyuşmazlığı`), {
        key,
        expected: descriptor.type,
        got: typeof value,
      });
    }
    return ok;
  } catch (error) {
    reportStorageError("write", error, { key, store: descriptor.store });
    return false;
  }
}

/** Anahtarı siler. Sonraki okuma registry varsayılanını döner. */
export function remove(descriptor, options) {
  const key = physicalKey(descriptor, resolveUid(descriptor, options));
  try {
    const store = getStore(descriptor.store);
    wire(descriptor.store);
    store.remove(key);
    return true;
  } catch (error) {
    reportStorageError("remove", error, { key, store: descriptor.store });
    return false;
  }
}

/** Kayıt fiziksel olarak var mı? (varsayılandan ayırt etmek için) */
export function has(descriptor, options) {
  const key = physicalKey(descriptor, resolveUid(descriptor, options));
  try {
    return getStore(descriptor.store).contains(key);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Abonelik                                                            */
/* ------------------------------------------------------------------ */

/**
 * Anahtar her değiştiğinde `callback` çağrılır. Abonelikten çıkaran fonksiyon
 * döner. Değeri callback'e geçmez — dinleyici `get()` ile taze okur.
 */
export function subscribe(descriptor, callback, options) {
  const storeName = descriptor.store;
  wire(storeName);
  const id = slot(storeName, physicalKey(descriptor, resolveUid(descriptor, options)));
  let set_ = subscribers.get(id);
  if (!set_) {
    set_ = new Set();
    subscribers.set(id, set_);
  }
  set_.add(callback);
  return () => {
    set_.delete(callback);
    if (set_.size === 0) subscribers.delete(id);
  };
}

// DİKKAT: snapshot anahtarı ile değer AYNI `options`tan türetilmeli. Bir ara
// anahtar `options` yokken aktif kullanıcıya, değer ise `{ uid: undefined }`
// üzerinden `guest` kapsamına çözülüyordu; kullanıcı kapsamlı bir anahtarı
// `useStored(Keys.postDrafts)` ile okuyan bileşen yanlış kovayı önbelleklerdi.
function readSnapshot(descriptor, options) {
  const id = slot(descriptor.store, physicalKey(descriptor, resolveUid(descriptor, options)));
  if (snapshots.has(id)) return snapshots.get(id);
  const value = get(descriptor, options);
  snapshots.set(id, value);
  return value;
}

/**
 * Depolanan değeri React'e bağlar. Değer başka bir ekrandan/servisten
 * değiştiğinde bileşen yeniden çizilir.
 *
 * @example const theme = useStored(Keys.theme);
 */
export function useStored(descriptor, options) {
  // `options` her render'da yeni bir nesne olabilir; useCallback bağımlılığı
  // olarak nesneyi DEĞİL, içinden çıkan tek anlamlı alanı kullanıyoruz. Aksi
  // halde abonelik her render'da kurulup bozulurdu.
  const hasUid = options ? "uid" in options : false;
  const uid = options?.uid;
  const scoped = useMemo(
    () => (hasUid ? { uid } : undefined),
    [hasUid, uid],
  );

  const sub = useCallback(
    (onChange) => subscribe(descriptor, onChange, scoped),
    [descriptor, scoped],
  );
  const snap = useCallback(() => readSnapshot(descriptor, scoped), [descriptor, scoped]);
  return useSyncExternalStore(sub, snap, snap);
}

/** Testlerde snapshot/abonelik durumunu sıfırlar. */
export function __resetStoreCaches() {
  activeUid = undefined;
  subscribers.clear();
  snapshots.clear();
  wired.clear();
}
