// utils/datePickerCalendar.js
//
// Tarih seçicinin (components/modals/DatePickerModal.js) SAF takvim hesabı:
// ay ızgarası, sınır (min/max) kararları, ay/yıl adımları. RN'siz test edilir
// (__tests__/datePickerCalendar.test.js).
//
// NEDEN AYRI: eski seçici üç kaydırma çarkıydı ve seçimi kaydırma ofsetinden
// türetiyordu. Kayarken bildirilen ara değerler diğer sütunların listesini
// yeniden kuruyor, programatik hizalama parmakla çatışıp seçimi "geri
// sektiriyordu". Yeni seçici dokunuşla çalışır; hangi günün seçilebileceği,
// hangi ayın kapalı olduğu burada, ekrandan bağımsız karar verilir.
//
// Tarihler her yerde yerel "YYYY-MM-DD" dizgesidir; sözlük sırası takvim
// sırasıyla aynı olduğu için karşılaştırma düz `<` / `>` ile yapılır.

export const pad2 = (n) => String(n).padStart(2, "0");

/** month: 0-11 */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** {y, m(0-11), d(1-31)} → "YYYY-MM-DD" */
export const partsToIso = ({ y, m, d }) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** "YYYY-MM-DD" → {y, m(0-11), d(1-31)} */
export function isoToParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** Date | "YYYY-MM-DD[T…]" → yerel "YYYY-MM-DD"; geçersizse null. */
export function normalizeDate(d) {
  if (!d) return null;
  if (typeof d === "string") {
    const iso = d.split("T")[0];
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsed.getFullYear() !== Number(year) ||
      parsed.getMonth() !== Number(month) - 1 ||
      parsed.getDate() !== Number(day)
    ) return null;
    return iso;
  }
  // Date: saat dilimi kaymasın diye yerel takvim günü alınır.
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return partsToIso({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
}

export const todayIso = () => normalizeDate(new Date());

/** "2024-01-31", 1 → "2024-02-01" */
export function shiftIso(iso, deltaDays) {
  const { y, m, d } = isoToParts(iso);
  return normalizeDate(new Date(y, m, d + deltaDays));
}

// Sınır verilmediğinde açılan yıl penceresi: izleme tarihleri onlarca yıl
// geriye, hatırlatıcılar birkaç yıl ileriye kurulabilsin.
export const YEARS_BACK = 100;
export const YEARS_FORWARD = 10;

/** Seçilebilir yıllar (artan). Sınır varsa tam ona uyar. */
export function buildYears(minIso, maxIso, nowYear = new Date().getFullYear()) {
  let lo = minIso ? Number(minIso.slice(0, 4)) : null;
  let hi = maxIso ? Number(maxIso.slice(0, 4)) : null;

  if (lo === null && hi === null) {
    lo = nowYear - YEARS_BACK;
    hi = nowYear + YEARS_FORWARD;
  } else if (lo === null) {
    lo = Math.min(hi, nowYear) - YEARS_BACK;
  } else if (hi === null) {
    hi = Math.max(lo, nowYear) + YEARS_FORWARD;
  }
  if (hi < lo) hi = lo;

  const out = [];
  for (let y = lo; y <= hi; y += 1) out.push(y);
  return out;
}

/** "min" | "max" | null — tarih hangi sınırın dışında. */
export function boundViolation(iso, minIso, maxIso) {
  if (minIso && iso < minIso) return "min";
  if (maxIso && iso > maxIso) return "max";
  return null;
}

/**
 * Her girdiyi gösterilebilir ve sınır içi bir tarihe çeker. Ay kısalınca gün
 * düşer (31 → 28), sınır dışı tarih en yakın sınıra oturur ve `hint` hangi
 * sınıra çarpıldığını söyler. Bozuk aralıkta (min > max) bile sonuç yıl
 * listesinin içinde kalır.
 */
export function clampParts(input, { minIso, maxIso, years }) {
  const m = Math.min(Math.max(input.m, 0), 11);
  const d = Math.min(Math.max(input.d, 1), daysInMonth(input.y, m));

  // Önce tarih sınıra çekilir (2030 → bugün, "1 Ocak 2026" değil), yıl penceresi
  // ancak sonra: yalnız sınırı OLMAYAN uçta ya da bozuk aralıkta devreye girer.
  let iso = partsToIso({ y: input.y, m, d });
  let hint = null;
  if (minIso && iso < minIso) {
    iso = minIso;
    hint = "min";
  }
  if (maxIso && iso > maxIso) {
    iso = maxIso;
    if (!hint) hint = "max";
  }

  const out = isoToParts(iso);
  out.y = Math.min(Math.max(out.y, years[0]), years[years.length - 1]);
  out.d = Math.min(out.d, daysInMonth(out.y, out.m));
  return { parts: out, hint };
}

export const sameParts = (a, b) => a?.y === b?.y && a?.m === b?.m && a?.d === b?.d;

/** Ayın TAMAMI sınır dışındaysa hangi sınır ("min" | "max"); en az bir günü açıksa null. */
export function monthBound(year, month, minIso, maxIso) {
  const first = partsToIso({ y: year, m: month, d: 1 });
  const last = partsToIso({ y: year, m: month, d: daysInMonth(year, month) });
  if (minIso && last < minIso) return "min";
  if (maxIso && first > maxIso) return "max";
  return null;
}

export function yearBound(year, minIso, maxIso) {
  if (minIso && `${year}-12-31` < minIso) return "min";
  if (maxIso && `${year}-01-01` > maxIso) return "max";
  return null;
}

export const monthHasEnabledDay = (year, month, minIso, maxIso) =>
  !monthBound(year, month, minIso, maxIso);

export const yearHasEnabledDay = (year, minIso, maxIso) => !yearBound(year, minIso, maxIso);

/** {y, m} + delta ay → {y, m} */
export function addMonths({ y, m }, delta) {
  const total = y * 12 + m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

/** Ay sayfası delta kadar ilerleyebilir mi: hedef ay yıl listesinde ve en az bir günü açık. */
export function canStepMonth(view, delta, { minIso, maxIso, years }) {
  const next = addMonths(view, delta);
  if (next.y < years[0] || next.y > years[years.length - 1]) return false;
  return monthHasEnabledDay(next.y, next.m, minIso, maxIso);
}

/** Ay ızgarasında yıl delta kadar ilerleyebilir mi. */
export function canStepYear(year, delta, { minIso, maxIso, years }) {
  const next = year + delta;
  if (next < years[0] || next > years[years.length - 1]) return false;
  return yearHasEnabledDay(next, minIso, maxIso);
}

/**
 * Haftanın ilk günü: 0 = Pazar, 1 = Pazartesi. Takvim ekranıyla aynı kural
 * (screens/calendar/CalendarScreen.js): yalnız İngilizce ve Portekizce Pazar.
 */
export const firstDayOfWeekFor = (lang) => (lang === "en" || lang === "pt" ? 0 : 1);

/** Başlık satırının gün sırası (Date#getDay indeksleri). */
export const weekdayOrder = (firstDay) =>
  Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);

export const GRID_WEEKS = 6;

/**
 * Ay ızgarası: HER ZAMAN 6 hafta × 7 gün = 42 hücre — ay değişince takvimin
 * yüksekliği oynamasın. Ay dışındaki hücreler `null` (boş bırakılır).
 * Hücre: { day, iso, disabled, bound: "min"|"max"|null, today, weekday }
 */
export function buildMonthGrid({ year, month, firstDay, minIso, maxIso, today }) {
  const lead = (new Date(year, month, 1).getDay() - firstDay + 7) % 7;
  const count = daysInMonth(year, month);
  const cells = new Array(GRID_WEEKS * 7).fill(null);
  for (let day = 1; day <= count; day += 1) {
    const iso = partsToIso({ y: year, m: month, d: day });
    const bound = boundViolation(iso, minIso, maxIso);
    cells[lead + day - 1] = {
      day,
      iso,
      bound,
      disabled: !!bound,
      today: iso === today,
      weekday: (lead + day - 1 + firstDay) % 7,
    };
  }
  return cells;
}

/** Diziyi `size`lık satırlara böler (yıl ızgarası). */
export function chunk(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}
