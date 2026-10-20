// services/storage/codec.js
//
// Tip dönüşümü + doğrulama. İki ayrı yol var, karıştırma:
//
//   read/write  → MMKV'nin NATIVE tipleriyle çalışır (bool/number/string).
//                 JSON.parse maliyeti yalnız gerçekten nesne olan alanlarda.
//   coerceLegacy→ AsyncStorage'dan gelen HER ŞEY string'di ve kodlama tutarsızdı
//                 ("true", "1", "\"dark\"", "2"). Göç sırasında bu tolerans
//                 katmanı gerekiyor; normal okuma yolunda kullanılmaz.
//
// Bozuk değerde davranış her yerde aynı: `undefined` dön (çağıran varsayılana
// düşer) ve hatayı bildir. Eski kodda bozuk bir JSON `JSON.parse` içinde
// patlıyor, en yakın try/catch'e göre ya ekranı boşaltıyor ya da sessizce
// yutuluyordu.

import { reportStorageError } from "./errors";

export const TYPES = {
  string: "string",
  number: "number",
  boolean: "boolean",
  json: "json",
};

/** MMKV'den ham değeri tipine göre okur. Yoksa/uyumsuzsa `undefined`. */
export function readTyped(store, physicalKey, type) {
  switch (type) {
    case TYPES.boolean:
      return store.getBoolean(physicalKey);
    case TYPES.number:
      return store.getNumber(physicalKey);
    case TYPES.string:
      return store.getString(physicalKey);
    case TYPES.json: {
      const raw = store.getString(physicalKey);
      if (raw === undefined || raw === null || raw === "") return undefined;
      try {
        return JSON.parse(raw);
      } catch (error) {
        reportStorageError("decode", error, { key: physicalKey, type });
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** Değeri tipine göre MMKV'ye yazar. Uyumsuz tipte `false` döner, yazmaz. */
export function writeTyped(store, physicalKey, type, value) {
  switch (type) {
    case TYPES.boolean:
      if (typeof value !== "boolean") return false;
      store.set(physicalKey, value);
      return true;
    case TYPES.number:
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      store.set(physicalKey, value);
      return true;
    case TYPES.string:
      if (typeof value !== "string") return false;
      store.set(physicalKey, value);
      return true;
    case TYPES.json:
      try {
        store.set(physicalKey, JSON.stringify(value));
        return true;
      } catch (error) {
        // döngüsel referans / serileştirilemeyen değer
        reportStorageError("encode", error, { key: physicalKey, type });
        return false;
      }
    default:
      return false;
  }
}

/**
 * AsyncStorage'dan gelen string'i hedef tipe çevirir.
 *
 * Tolerans listesi gerçek verideki kodlamalardan çıkarıldı:
 *   boolean → "true"/"false" (JSON.stringify), "1"/"0"
 *   number  → "3" (String(n)), "3.5"
 *   string  → "dark" (düz) ya da "\"dark\"" (JSON.stringify edilmiş)
 *   json    → "{...}" / "[...]"
 *
 * @returns {{ok: true, value: any} | {ok: false}}
 */
export function coerceLegacy(raw, type) {
  if (raw === null || raw === undefined) return { ok: false };

  switch (type) {
    case TYPES.boolean: {
      if (raw === "true" || raw === "1") return { ok: true, value: true };
      if (raw === "false" || raw === "0") return { ok: true, value: false };
      return { ok: false };
    }
    case TYPES.number: {
      const n = Number(raw);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    case TYPES.string: {
      // JSON.stringify ile yazılmış string'lerin tırnaklarını soy.
      if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === "string") return { ok: true, value: parsed };
        } catch {
          // düz string'miş gibi devam et
        }
      }
      return { ok: true, value: raw };
    }
    case TYPES.json: {
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch {
        return { ok: false };
      }
    }
    default:
      return { ok: false };
  }
}

/* ------------------------------------------------------------------ */
/* Doğrulayıcılar — registry girdilerinde `validate` alanında kullanılır */
/* ------------------------------------------------------------------ */

/** Değer verilen kümeden biri olmalı. */
export const oneOf =
  (...allowed) =>
  (value) =>
    allowed.includes(value);

/** Sayı [min, max] aralığında olmalı. */
export const range = (min, max) => (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Dizi olmalı; `item` verilirse her eleman da doğrulanır. */
export const arrayOf = (item) => (value) =>
  Array.isArray(value) && (!item || value.every(item));

/** Düz nesne olmalı (dizi ve null hariç). */
export const plainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Birden çok doğrulayıcıyı VE ile bağlar. */
export const all =
  (...validators) =>
  (value) =>
    validators.every((fn) => fn(value));
