// utils/statsFilters.js
//
// Film / Dizi istatistik ekranlarındaki filtre penceresinin saf mantığı.
//
// NEDEN: Filtre eskiden her izleme GÜNÜ için ayrı bir çip basıyordu. Yıllarca
// kullanılan bir hesapta yüzlerce çip, tek bir kaydırma bulutu olarak çıkıyordu;
// aranan günü bulmak imkânsızdı. Artık tarih seçimi bir AĞAÇ: yıl → ay → gün.
//
// SEÇİM BİÇİMİ: `selectedDate` (ProfileStatsContext) opak bir dizgedir ve üç
// ayrıntı düzeyinden birini taşır:
//   null          → tüm tarihler
//   "2025"        → o yılın tamamı
//   "2025-03"     → o ayın tamamı
//   "2025-03-14"  → tek gün (eski davranışla birebir aynı)
// Bölüm başlıkları (`section.title`) hep "YYYY-AA-GG" olduğu için eşleştirme bir
// önek karşılaştırmasıdır — bkz. matchesDateFilter.

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Bölüm başlığı seçili tarih aralığına giriyor mu? (null = hepsi) */
export function matchesDateFilter(title, selected) {
  if (selected == null || selected === "") return true;
  if (typeof title !== "string" || !title) return false;
  return title === selected || title.startsWith(`${selected}-`);
}

/** Bir üst ayrıntı düzeyi: gün → ay → yıl → null. */
export function dateFilterParent(selected) {
  if (typeof selected !== "string") return null;
  if (selected.length > 7) return selected.slice(0, 7);
  if (selected.length > 4) return selected.slice(0, 4);
  return null;
}

/** groupedData → { "2025-03-14": öğe sayısı }. Filtre penceresindeki sayaçlar. */
export function countByDate(groupedData = []) {
  const counts = {};
  (groupedData || []).forEach((section) => {
    const title = section?.title;
    if (!title) return;
    counts[title] = (counts[title] || 0) + (section?.data?.length || 0);
  });
  return counts;
}

/**
 * Tek günlük tarih listesini yıl → ay → gün ağacına çevirir.
 *
 * @param {string[]} dates   "YYYY-AA-GG" dizgeleri (tekrar ve geçersiz değerler elenir)
 * @param {Record<string, number>} [counts]  gün → öğe sayısı; yoksa her gün 1 sayılır
 * @returns {{ key: string, count: number, months: { key: string, month: number,
 *            count: number, days: { key: string, day: number, count: number }[] }[] }[]}
 *          Yıllar yeniden eskiye; aylar ve günler artan sırada.
 */
export function buildDateTree(dates = [], counts = {}) {
  const years = new Map();
  const seen = new Set();

  for (const raw of dates || []) {
    if (typeof raw !== "string" || seen.has(raw)) continue;
    const match = raw.match(DAY_RE);
    if (!match) continue;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    seen.add(raw);

    const count = Number.isFinite(counts?.[raw]) ? counts[raw] : 1;
    const yearKey = match[1];
    const monthKey = `${match[1]}-${match[2]}`;

    let year = years.get(yearKey);
    if (!year) {
      year = { key: yearKey, count: 0, months: new Map() };
      years.set(yearKey, year);
    }
    let monthNode = year.months.get(monthKey);
    if (!monthNode) {
      monthNode = { key: monthKey, month, count: 0, days: [] };
      year.months.set(monthKey, monthNode);
    }
    monthNode.days.push({ key: raw, day, count });
    monthNode.count += count;
    year.count += count;
  }

  return [...years.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((year) => ({
      key: year.key,
      count: year.count,
      months: [...year.months.values()]
        .sort((a, b) => a.month - b.month)
        .map((monthNode) => ({
          ...monthNode,
          days: monthNode.days.sort((a, b) => a.day - b.day),
        })),
    }));
}

const upperFirst = (text, locale) => {
  if (!text) return text;
  try {
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  } catch {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
};

/**
 * 12 ay adı (indeks 0 = Ocak). Kısa adlarda ("ene.", "jan.") sondaki nokta
 * atılır ve ilk harf büyütülür; çip içinde kısa ve düzgün durur.
 */
export function monthNames(locale, style = "short") {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" });
  } catch {
    formatter = null;
  }
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(2000, index, 1, 12));
    const text = formatter ? formatter.format(date) : String(index + 1);
    return upperFirst(text.replace(/\.$/, ""), locale);
  });
}

/**
 * Seçili tarih aralığının kısa gösterimi (filtre çubuğundaki hap ve pencere
 * başlığı için). Seçim yoksa boş döner; çağıran "Tüm Tarihler" yazar.
 *
 * @param {string|null} selected
 * @param {{ locale?: string, formatDay?: (day: string) => string }} [options]
 */
export function describeDateFilter(selected, { locale, formatDay } = {}) {
  if (selected == null || selected === "") return "";
  if (YEAR_RE.test(selected)) return selected;
  const month = selected.match(MONTH_RE);
  if (month) {
    try {
      const text = new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1, 12)));
      return upperFirst(text, locale);
    } catch {
      return selected;
    }
  }
  return formatDay?.(selected) || selected;
}

/** Tür listesini {name, count}'a indirger (düz ad dizisi de kabul edilir). */
export function normalizeGenres(genres = []) {
  return (genres || [])
    .map((genre) =>
      typeof genre === "string"
        ? { name: genre, count: null }
        : { name: genre?.name, count: Number.isFinite(genre?.count) ? genre.count : null },
    )
    .filter((genre) => genre.name);
}

/**
 * Tür çiplerinin hangilerinin görüneceğini seçer. Liste sayıya göre azalan
 * gelir; kapalıyken ilk `limit` tür görünür ve seçili tür sıra dışı olsa bile
 * ekranda kalır (yoksa seçimi göremezsin).
 *
 * @returns {{ visible: {name:string,count:number|null}[], hiddenCount: number, canCollapse: boolean }}
 */
export function planGenreChips(genres, selected, expanded, limit = 8) {
  const list = normalizeGenres(genres);
  if (list.length <= limit) return { visible: list, hiddenCount: 0, canCollapse: false };
  if (expanded) return { visible: list, hiddenCount: 0, canCollapse: true };

  const visible = list.slice(0, limit);
  if (selected != null && !visible.some((genre) => genre.name === selected)) {
    const picked = list.find((genre) => genre.name === selected);
    if (picked) visible.push(picked);
  }
  return { visible, hiddenCount: list.length - visible.length, canCollapse: false };
}
