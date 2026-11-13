// services/tasteShadowLog.js
//
// Zevk eşleşmesi Faz 2 "gölge mod" günlüğü (docs/planlama/ZEVK_ESLESMESI_UYGULAMA_REHBERI.md §4).
// Arkadaş profili açıldığında eski "Zevk uyumu" yüzdesi ile yeni v3 skoru buraya yazılır; Geliştirici
// Laboratuvarı tabloyu gösterir. YALNIZ __DEV__: release'de kayıt yapılmaz, okuma boş döner.
//
// Bellekte tutulur, diske/buluta YAZILMAZ (services/devLab.js ile aynı ilke). Ham liste ya da yapım
// adı saklanmaz; yalnız arkadaşın görünen adı ve sayılar.
import { useSyncExternalStore } from "react";

export const SHADOW_LOG_MAX = 20;

const isDev = () => typeof __DEV__ !== "undefined" && __DEV__ === true;

let rows = Object.freeze([]);
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * @param {{ uid: string, name?: string, oldScore?: number|null, lanes: object }} entry
 */
export function recordTasteShadow(entry) {
  if (!isDev() || !entry?.uid || !entry.lanes) return;
  const row = Object.freeze({
    uid: entry.uid,
    name: entry.name || "",
    oldScore: typeof entry.oldScore === "number" ? entry.oldScore : null,
    lanes: entry.lanes,
    at: Date.now(),
  });
  rows = Object.freeze([row, ...rows.filter((r) => r.uid !== row.uid)].slice(0, SHADOW_LOG_MAX));
  emit();
}

export function getTasteShadowRows() {
  return isDev() ? rows : [];
}

export function clearTasteShadow() {
  if (!rows.length) return;
  rows = Object.freeze([]);
  emit();
}

export function useTasteShadowRows() {
  return useSyncExternalStore(subscribe, getTasteShadowRows, getTasteShadowRows);
}
