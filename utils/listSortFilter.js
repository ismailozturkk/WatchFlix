// utils/listSortFilter.js
//
// Liste ekranlarındaki "Sırala & Filtrele" sayfasının SAF kararları (RN / i18n importu yok).
// Arayüz: components/lists/ListSortFilterSheet.js (ListsScreen + SharedListScreen ortak kullanır).
//
// Eski sayfa: sıralama seçilince yön ELDEKİ değerde kalırdı (ilk açılışta "azalan"), yani "İsim"e basınca
// Z→A gelirdi; yön metinleri ("Artan"/"Azalan") çevrilmemişti; tür çipleri (20+ olabilir) hiç daraltılmadan
// sayfayı uzatıyordu. Hepsi buradaki küçük kurallardan türer.

/** İlk seçildiğinde doğal yön: ada göre A→Z, tarih / süre / yenilik büyükten küçüğe. */
export const SORT_DEFAULT_DIR = Object.freeze({
  dateAdded: "desc",
  newest: "desc",
  name: "asc",
  minutes: "desc",
});

/**
 * Bir sıralama düğmesine basılınca yeni (anahtar, yön).
 *  • "default" (liste sırası): yön anlamsız, "desc"e sıfırlanır.
 *  • Seçili düğmeye yeniden basmak yönü çevirir.
 *  • Başka düğme: o anahtarın doğal yönüyle başlar.
 */
export function nextSort(current, pressed) {
  const key = current?.key ?? "default";
  const dir = current?.dir === "asc" ? "asc" : "desc";
  if (pressed === "default") return { key: "default", dir: "desc" };
  if (pressed === key) return { key, dir: dir === "asc" ? "desc" : "asc" };
  return { key: pressed, dir: SORT_DEFAULT_DIR[pressed] || "desc" };
}

/**
 * Çip listesini daralt: ilk `limit` çip + SEÇİLİ olanların hepsi görünür (seçili çip asla gizlenmez).
 * @param {string[]} options
 * @param {string[]} selected
 * @returns {{ visible: string[], hiddenCount: number }}
 */
export function collapseChips(options, selected = [], { limit = 8, expanded = false } = {}) {
  const all = Array.isArray(options) ? options : [];
  if (expanded || all.length <= limit) return { visible: all, hiddenCount: 0 };
  const chosen = new Set(selected);
  const visible = all.filter((option, index) => index < limit || chosen.has(option));
  return { visible, hiddenCount: all.length - visible.length };
}

/** Etkin süzgeç sayısı (yalnız SÜZGEÇLER; sıralama ayrıca `sortActive` ile sayılır). */
export function countActiveFilters({ typeFilter, dateRange, genres, platformOnly, memberFilter } = {}) {
  return (
    (typeFilter && typeFilter !== "all" ? 1 : 0) +
    (dateRange && dateRange !== "all" ? 1 : 0) +
    (Array.isArray(genres) && genres.length > 0 ? 1 : 0) +
    (platformOnly ? 1 : 0) +
    (memberFilter && memberFilter !== "all" ? 1 : 0)
  );
}

/** "3'lü · Normal" gibi görünüm özeti için köşe adı: yarıçap değerinden en yakın seçenek. */
export function radiusKeyOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return [2, 10, 20].reduce((best, key) => (Math.abs(key - n) < Math.abs(best - n) ? key : best), 10);
}
