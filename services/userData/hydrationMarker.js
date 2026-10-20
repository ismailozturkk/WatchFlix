// services/userData/hydrationMarker.js
//
// "Bu alan bu cihazda buluttan TAM olarak doğrulandı" işareti.
//
// ── NEDEN ────────────────────────────────────────────────────────────────────
//
// Anlık görüntü dosyasının varlığı "indirildi" demek DEĞİL kanıtlamaz: eski
// sürüm (canlı dinleyici dönemi) dosyaları dinleyici geldikçe yazıyordu. Dizi
// başına bölüm dinleyicileri sırayla gelirken uygulama kapanırsa disk, bölümlerin
// YARISINI içeren bir kopyayla kalırdı. Yerel kopyayı kaynak yapan bir motor bunu
// "tam" sanıp bir daha çekmezdi.
//
// İşaret yalnız bu motorun KENDİ tam indirmesinden sonra konur. Güncellemeden
// gelen (işaretsiz) kopya anında gösterilir ama alan arka planda bir kez
// doğrulanır — kullanıcı için tek seferlik çekme, sonra hiç.
//
// `version` yükseltilirse (alanın veri modeli değişirse) herkes bir kez daha
// doğrulanır.
//
// MMKV `data` deposunda, kullanıcı kapsamlı, çıkışta silinir (yerel kopya da
// çıkışta silindiği için işaret onunla birlikte gitmeli).

import { Keys, get, set, remove } from "../storage";

const read = (uid) => {
  const value = get(Keys.userDataHydrated, { uid });
  return value && typeof value === "object" ? value : {};
};

/** @returns {number|null} son doğrulanan sürüm */
export function getMarker(uid, name) {
  if (!uid) return null;
  const version = read(uid)[name];
  return Number.isFinite(version) ? version : null;
}

export function setMarker(uid, name, version) {
  if (!uid) return;
  set(Keys.userDataHydrated, { ...read(uid), [name]: version }, { uid });
}

export function clearMarker(uid, name) {
  if (!uid) return;
  const current = read(uid);
  if (!(name in current)) return;
  const { [name]: _gone, ...rest } = current;
  if (Object.keys(rest).length === 0) remove(Keys.userDataHydrated, { uid });
  else set(Keys.userDataHydrated, rest, { uid });
}

export const marker = Object.freeze({
  get: getMarker,
  set: setMarker,
  clear: clearMarker,
});
