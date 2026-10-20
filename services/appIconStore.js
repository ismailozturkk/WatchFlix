// services/appIconStore.js
//
// SEÇİLİ UYGULAMA SİMGESİNİN uygulama içindeki tek kaynağı.
//
// Neden ayrı bir store: simgenin gerçeği işletim sisteminde (bkz.
// services/appIconService.js) ama giriş ekranı, splash, hakkında, paylaşım
// kartları gibi ONLARCA yer logoyu render sırasında SENKRON istiyor. Modül
// seviyesinde `require(...)` ile sabitlenmiş logo, kullanıcı simgeyi
// değiştirince uygulama yeniden başlatılana dek eski kalırdı. Burada seçim bir
// abonelik kaynağı: `useAppIconId()` ile okuyan bileşen simge değişince
// yeniden çizilir (aynı desen: services/effectSettings.js).
//
// Kalıcılık yalnız ÖNBELLEK: açılışta senkron okunur (ilk karede doğru logo),
// ardından appIconService.reconcileAppIconWithSystem() sistemin gerçek
// durumuyla eşitler (yeniden kurulum / sistem tarafı değişiklik).
//
// Saf modül: RN importu yok — yalnız react (hook için) ve MMKV deposu.

import { useSyncExternalStore } from "react";
import { DEFAULT_APP_ICON_ID, isKnownIconId } from "../utils/appIcons";
import { Keys, get, set, subscribe } from "./storage";

const readStored = () => {
  const stored = get(Keys.appIcon);
  return isKnownIconId(stored) ? stored : DEFAULT_APP_ICON_ID;
};

let current = readStored();
const listeners = new Set();

const publish = () => {
  for (const fn of listeners) fn();
};

// Depoya dışarıdan yazılırsa (ör. AsyncStorage → MMKV göçü anahtarı geç yazarsa)
// store onu yakalar; aksi halde ilk okuma boş depoya denk gelip oturum boyunca
// yanlış logo kalırdı. Aynı gerekçe: services/effectSettings.js.
const applyStored = () => {
  const next = readStored();
  if (next === current) return;
  current = next;
  publish();
};
subscribe(Keys.appIcon, applyStored);

/** Seçili simgenin katalog kimliği. React dışı çağıranlar için anlık değer. */
export const getAppIconId = () => current;

/**
 * Seçimi uygular ve kalıcılaştırır. Bilinmeyen kimlik YOK SAYILIR (false döner),
 * aynı değer tekrar verilirse hiçbir şey yayınlanmaz.
 * @returns {boolean} geçerli bir kimlik verildi mi
 */
export function setAppIconId(id) {
  if (!isKnownIconId(id)) return false;
  if (id !== current) {
    current = id;
    // Yazılamadıysa oturum içi seçim yine de geçerli; depolama katmanı hatayı
    // kendi raporlar.
    set(Keys.appIcon, id);
    publish();
  }
  return true;
}

/** Seçim değişimini dinler; abonelikten çıkaran fonksiyonu döner. */
export const subscribeAppIconId = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Seçili simge kimliği — değişince abone bileşen yeniden çizilir. */
export function useAppIconId() {
  return useSyncExternalStore(subscribeAppIconId, getAppIconId, getAppIconId);
}
