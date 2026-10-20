// hooks/useDiscoverFilterStore.js
//
// "Ne izlesem?" (Filtreli Keşif) kalıcı durumu: kayıtlı süzgeçler ve her medya türünün en son
// kullanılan süzgeci. Karar mantığı utils/discoverFilters.js'te (saf, testli); burada yalnız depoya
// bağlama — hooks/useSectionVisibility.js ile aynı kalıp.
//
// YAZMA SON KAYITTAN OKUR (kapanıştaki state'ten değil): arka arkaya iki hızlı kaydet/sil, ilk
// yazımın sonucunu ezmesin. Depo senkron olduğu için okuma-değiştir-yaz tek turda biter.
import { useMemo } from "react";
import { Keys, get, remove, set, useStored } from "../services/storage";
import {
  addPreset,
  makePresetId,
  normalizeFilters,
  normalizeLastFilters,
  normalizePresets,
  removePreset,
  toStoredLastFilters,
} from "../utils/discoverFilters";

/** Normalize edilmiş kayıtlı süzgeçler. Ham kayıt değişmedikçe AYNI dizi döner. */
export function useDiscoverPresets() {
  const raw = useStored(Keys.discoverPresets);
  return useMemo(() => normalizePresets(raw), [raw]);
}

/** Boş liste anahtarı SİLER (diskte ve yedekte boş dizi dolaşmasın). */
function writePresets(list) {
  return list.length === 0 ? remove(Keys.discoverPresets) : set(Keys.discoverPresets, list);
}

/**
 * Süzgeci kaydeder (aynı süzgeç zaten kayıtlıysa başa taşınır).
 * @returns {{ id: string, ok: boolean }}
 */
export function saveDiscoverPreset({ name, mediaType, filters }, now = Date.now(), random = Math.random) {
  const id = makePresetId(now, random);
  const next = addPreset(get(Keys.discoverPresets), { id, name, mediaType, filters });
  // Kimlik: aynı süzgeç zaten varsa onun (yeni) kaydı başa gelir; eklenen kayıt listede mi?
  const saved = next.some((item) => item.id === id);
  return { id, ok: saved && writePresets(next) !== false };
}

export function deleteDiscoverPreset(id) {
  return writePresets(removePreset(get(Keys.discoverPresets), id)) !== false;
}

/** Bir medya türünün en son kullanılan süzgeci (kayıt yoksa varsayılan). */
export const readLastDiscoverFilters = (mediaType) => normalizeLastFilters(get(Keys.discoverFilters))[mediaType];

/** Son kullanılan süzgeci yazar; hiçbir şey özelleştirilmediyse anahtar silinir. */
export function writeLastDiscoverFilters(mediaType, filters) {
  const last = normalizeLastFilters(get(Keys.discoverFilters));
  last[mediaType] = normalizeFilters(filters, mediaType);
  const stored = toStoredLastFilters(last);
  return stored === null ? remove(Keys.discoverFilters) : set(Keys.discoverFilters, stored);
}
