// Tarih seçicinin saf takvim hesabı (utils/datePickerCalendar.js).
//
// Eski seçici kaydırma çarkıydı ve seçimi ofsetten türettiği için "geri
// sekiyordu"; yenisi dokunuşla çalışır ve bütün sınır/ızgara kararları burada.
import {
  addMonths,
  boundViolation,
  buildMonthGrid,
  buildYears,
  canStepMonth,
  canStepYear,
  chunk,
  clampParts,
  daysInMonth,
  firstDayOfWeekFor,
  isoToParts,
  monthBound,
  normalizeDate,
  partsToIso,
  shiftIso,
  weekdayOrder,
  yearBound,
  GRID_WEEKS,
} from "../utils/datePickerCalendar";

describe("tarih dönüşümleri", () => {
  test("ISO ↔ parçalar (ay 0 tabanlı)", () => {
    expect(isoToParts("2024-02-29")).toEqual({ y: 2024, m: 1, d: 29 });
    expect(partsToIso({ y: 2024, m: 1, d: 9 })).toBe("2024-02-09");
  });

  test("normalizeDate: geçerli dizge, Date ve saat içeren dizge; olmayan gün null", () => {
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDate("2024-03-05T22:10:00Z")).toBe("2024-03-05");
    expect(normalizeDate(new Date(2024, 0, 31, 23, 59))).toBe("2024-01-31");
    expect(normalizeDate("2023-02-29")).toBeNull();
    expect(normalizeDate("05.03.2024")).toBeNull();
    expect(normalizeDate(new Date("x"))).toBeNull();
    expect(normalizeDate("")).toBeNull();
  });

  test("gün kaydırma ay ve yıl sınırını aşar", () => {
    expect(shiftIso("2024-01-31", 1)).toBe("2024-02-01");
    expect(shiftIso("2025-01-01", -1)).toBe("2024-12-31");
  });

  test("ayın gün sayısı artık yılı bilir", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2026, 9)).toBe(31);
  });
});

describe("yıl listesi", () => {
  test("sınır yoksa 100 yıl geri, 10 yıl ileri", () => {
    const years = buildYears(null, null, 2026);
    expect(years[0]).toBe(1926);
    expect(years[years.length - 1]).toBe(2036);
  });

  test("sınırlara tam uyar", () => {
    expect(buildYears("1990-06-01", "1992-01-01", 2026)).toEqual([1990, 1991, 1992]);
  });

  test("yalnız üst sınır (izleme tarihi): bugünden 100 yıl geri", () => {
    const years = buildYears(null, "2026-10-23", 2026);
    expect(years[0]).toBe(1926);
    expect(years[years.length - 1]).toBe(2026);
  });

  test("yalnız alt sınır (hatırlatıcı): 10 yıl ileri", () => {
    const years = buildYears("2026-10-23", null, 2026);
    expect(years).toEqual(Array.from({ length: 11 }, (_, i) => 2026 + i));
  });

  test("bozuk aralık (min > max) boş liste üretmez", () => {
    expect(buildYears("2027-01-01", "2025-01-01", 2026)).toEqual([2027]);
  });
});

describe("clampParts — ay/yıl seçilince gün korunur, sınıra çarpınca uyarı", () => {
  const bounds = (minIso, maxIso) => ({ minIso, maxIso, years: buildYears(minIso, maxIso, 2026) });

  test("31 Ocak'tan Şubat'a geçince gün ayın son gününe düşer (uyarı yok)", () => {
    expect(clampParts({ y: 2025, m: 1, d: 31 }, bounds(null, null))).toEqual({
      parts: { y: 2025, m: 1, d: 28 },
      hint: null,
    });
  });

  test("gelecek tarih üst sınıra çekilir ve 'max' uyarısı verir", () => {
    // 15 Aralık 2025 seçiliyken yıl 2026 yapıldı; bugün 23 Ekim 2026.
    expect(clampParts({ y: 2026, m: 11, d: 15 }, bounds(null, "2026-10-23"))).toEqual({
      parts: { y: 2026, m: 9, d: 23 },
      hint: "max",
    });
  });

  test("yayın tarihinden önceki seçim alt sınıra çekilir ve 'min' uyarısı verir", () => {
    expect(clampParts({ y: 2024, m: 2, d: 1 }, bounds("2024-03-15", "2026-10-23"))).toEqual({
      parts: { y: 2024, m: 2, d: 15 },
      hint: "min",
    });
  });

  test("aralık dışı uzak tarih yıl başına değil SINIRA çekilir", () => {
    expect(clampParts({ y: 2030, m: 0, d: 1 }, bounds(null, "2026-10-23")).parts).toEqual({
      y: 2026,
      m: 9,
      d: 23,
    });
    expect(clampParts({ y: 1800, m: 5, d: 1 }, bounds("1906-01-01", null)).parts).toEqual({
      y: 1906,
      m: 0,
      d: 1,
    });
  });

  test("sınırsız uçta yıl penceresine oturur", () => {
    // 2050 artık yıl değil: 29 Şubat önce 28'e düşer, sonra pencereye (2036) oturur.
    expect(clampParts({ y: 2050, m: 1, d: 29 }, bounds(null, null))).toEqual({
      parts: { y: 2036, m: 1, d: 28 },
      hint: null,
    });
  });

  test("bozuk aralıkta bile sonuç yıl listesinin içinde kalır", () => {
    const b = bounds("2027-01-01", "2025-01-01");
    const { parts } = clampParts({ y: 2026, m: 5, d: 10 }, b);
    expect(b.years).toContain(parts.y);
  });
});

describe("sınır kararları", () => {
  test("gün", () => {
    expect(boundViolation("2026-10-24", null, "2026-10-23")).toBe("max");
    expect(boundViolation("2024-03-14", "2024-03-15", null)).toBe("min");
    expect(boundViolation("2024-03-15", "2024-03-15", "2024-03-15")).toBeNull();
  });

  test("ay ancak TAMAMI dışarıdaysa kapalı", () => {
    expect(monthBound(2026, 9, null, "2026-10-23")).toBeNull(); // Ekim'in yarısı açık
    expect(monthBound(2026, 10, null, "2026-10-23")).toBe("max");
    expect(monthBound(2024, 2, "2024-03-31", null)).toBeNull(); // yalnız 31'i açık
    expect(monthBound(2024, 1, "2024-03-31", null)).toBe("min");
  });

  test("yıl ancak TAMAMI dışarıdaysa kapalı", () => {
    expect(yearBound(2026, null, "2026-01-01")).toBeNull();
    expect(yearBound(2027, null, "2026-12-31")).toBe("max");
    expect(yearBound(1905, "1906-01-01", null)).toBe("min");
  });
});

describe("sayfa adımları", () => {
  const b = { minIso: "2025-11-20", maxIso: "2026-10-23", years: [2025, 2026] };

  test("ay ekleme yıl sınırını geçer", () => {
    expect(addMonths({ y: 2025, m: 11 }, 1)).toEqual({ y: 2026, m: 0 });
    expect(addMonths({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(addMonths({ y: 2026, m: 5 }, -18)).toEqual({ y: 2024, m: 11 });
  });

  test("tamamen kapalı aya geçilmez", () => {
    expect(canStepMonth({ y: 2026, m: 9 }, 1, b)).toBe(false); // Kasım 2026 kapalı
    expect(canStepMonth({ y: 2026, m: 8 }, 1, b)).toBe(true); // Ekim 2026'nın yarısı açık
    expect(canStepMonth({ y: 2025, m: 10 }, -1, b)).toBe(false); // Ekim 2025 kapalı
    expect(canStepMonth({ y: 2025, m: 11 }, -1, b)).toBe(true); // Kasım 2025'in 20'si sonrası açık
  });

  test("yıl adımı listede kalır", () => {
    expect(canStepYear(2026, 1, b)).toBe(false);
    expect(canStepYear(2026, -1, b)).toBe(true);
    expect(canStepYear(2025, -1, b)).toBe(false);
  });
});

describe("ay ızgarası", () => {
  test("hafta başlangıcı takvim ekranıyla aynı: en/pt Pazar, diğerleri Pazartesi", () => {
    expect(firstDayOfWeekFor("en")).toBe(0);
    expect(firstDayOfWeekFor("pt")).toBe(0);
    expect(firstDayOfWeekFor("tr")).toBe(1);
    expect(firstDayOfWeekFor("de")).toBe(1);
    expect(firstDayOfWeekFor("es")).toBe(1);
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("her ay 6 hafta × 7 gün — yükseklik ay değişince oynamaz", () => {
    for (let m = 0; m < 12; m += 1) {
      const cells = buildMonthGrid({ year: 2026, month: m, firstDay: 1 });
      expect(cells).toHaveLength(GRID_WEEKS * 7);
      expect(cells.filter(Boolean)).toHaveLength(daysInMonth(2026, m));
    }
  });

  test("ilk gün doğru sütunda: 1 Ekim 2026 Perşembe", () => {
    const monday = buildMonthGrid({ year: 2026, month: 9, firstDay: 1 });
    expect(monday.slice(0, 3)).toEqual([null, null, null]);
    expect(monday[3]).toMatchObject({ day: 1, iso: "2026-10-01", weekday: 4 });

    const sunday = buildMonthGrid({ year: 2026, month: 9, firstDay: 0 });
    expect(sunday[4]).toMatchObject({ day: 1, weekday: 4 });
  });

  test("en uzun ay da 6 haftaya sığar (Pazar'la başlayan 31 günlük ay, Pazartesi düzeni)", () => {
    // 1 Mart 2026 Pazar → Pazartesi düzeninde 7. sütun; 31 Mart 6. haftada.
    const cells = buildMonthGrid({ year: 2026, month: 2, firstDay: 1 });
    expect(cells[6]).toMatchObject({ day: 1 });
    expect(cells[36]).toMatchObject({ day: 31 });
  });

  test("sınır dışı günler kapalı ve hangi sınır olduğu belli; bugün işaretli", () => {
    const cells = buildMonthGrid({
      year: 2026,
      month: 9,
      firstDay: 1,
      minIso: "2026-10-05",
      maxIso: "2026-10-23",
      today: "2026-10-23",
    }).filter(Boolean);
    expect(cells[3]).toMatchObject({ day: 4, disabled: true, bound: "min" });
    expect(cells[4]).toMatchObject({ day: 5, disabled: false, bound: null });
    expect(cells[22]).toMatchObject({ day: 23, disabled: false, today: true });
    expect(cells[23]).toMatchObject({ day: 24, disabled: true, bound: "max", today: false });
  });

  test("yıl ızgarası satırları", () => {
    expect(chunk([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
  });
});
