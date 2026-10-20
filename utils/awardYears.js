// utils/awardYears.js
//
// Oscar / Emmy "yıl seç" sayfasının saf veri yardımcıları (React yok, testlenebilir).
//
// Eskiden iki ekran da 1970–2027'yi elle döngüyle üretiyordu: yeni bir yıl eklemek için
// sürüm çıkmak gerekiyordu ve yapılandırmada OLMAYAN bir yıl seçilirse servis sessizce
// `items[0]`a düşüp YANLIŞ yılın afişlerini gösteriyordu. Artık liste, ödül
// yapılandırmasının (AppConfig/oscar|emmy) yıllarından gelir; açıklanmamış yıllar
// (`isConfirmed` false) ayrıca işaretlenir.

/** 2026 → 2020 */
export const decadeOf = (year) => Math.floor(Number(year) / 10) * 10;

/**
 * Yapılandırma öğelerinden yıl listesi.
 * @param {Array<{year:number,isConfirmed?:boolean}>} items
 * @returns {{ years: number[], pending: Set<number> }} years: yeniden eskiye, tekrarsız.
 */
export function buildAwardYears(items) {
  const seen = new Set();
  const confirmed = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const year = Number(item?.year);
    if (!Number.isInteger(year) || year <= 0) continue;
    seen.add(year);
    if (item.isConfirmed) confirmed.add(year);
  }
  const years = [...seen].sort((a, b) => b - a);
  const pending = new Set(years.filter((year) => !confirmed.has(year)));
  return { years, pending };
}

/**
 * Yılları on yıllara böler; on yıllar yeniden eskiye, her on yılın içi de yeniden eskiye.
 * @param {number[]} years
 * @returns {Array<{ decade:number, years:number[], min:number, max:number }>}
 */
export function groupYearsByDecade(years) {
  const sorted = [...(Array.isArray(years) ? years : [])]
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a);
  const groups = [];
  for (const year of sorted) {
    const decade = decadeOf(year);
    const last = groups[groups.length - 1];
    if (last && last.decade === decade) {
      if (!last.years.includes(year)) last.years.push(year);
    } else {
      groups.push({ decade, years: [year], min: year, max: year });
    }
  }
  for (const group of groups) {
    group.max = group.years[0];
    group.min = group.years[group.years.length - 1];
  }
  return groups;
}

/** [a,b,c,d,e] → [[a,b,c,d],[e]] */
export function chunkYears(list, size) {
  const rows = [];
  const step = Math.max(1, Math.floor(size) || 1);
  for (let i = 0; i < list.length; i += step) rows.push(list.slice(i, i + step));
  return rows;
}
