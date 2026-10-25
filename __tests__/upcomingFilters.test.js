// __tests__/upcomingFilters.test.js
//
// "Yaklaşan Filmler" süzgecinin saf çekirdeği (utils/upcomingFilters.js) ve metin tablosu
// (utils/upcomingFiltersCopy.js): doğrulama, tarih penceresi, TMDB parametreleri, etiketler.
import {
  CUSTOM_MAX_YEARS,
  DEFAULT_UPCOMING_FILTERS,
  MONTH_WINDOW,
  QUICK_RANGES,
  SCOPES,
  UPCOMING_GENRES,
  UPCOMING_LANGUAGES,
  UPCOMING_SORTS,
  buildUpcomingParams,
  buildUpcomingUrl,
  countActiveUpcomingFilters,
  isUpcomingCustomized,
  monthBounds,
  normalizeUpcomingFilters,
  parseIsoDay,
  setUpcomingCustomRange,
  setUpcomingFilter,
  setUpcomingMonth,
  setUpcomingRange,
  toStoredUpcomingFilters,
  toggleUpcomingGenre,
  upcomingBounds,
  upcomingDateRange,
  upcomingMonths,
  upcomingQuerySignature,
} from "../utils/upcomingFilters";
import {
  UPCOMING_FILTERS_COPY,
  formatUpcomingDay,
  formatUpcomingMonth,
  getUpcomingFiltersCopy,
  upcomingRangeLabel,
  upcomingSummary,
} from "../utils/upcomingFiltersCopy";

// 24 Ekim 2026, Cumartesi öğleden sonra (yerel saat).
const NOW = new Date(2026, 9, 24, 15, 30);
const norm = (raw) => normalizeUpcomingFilters(raw, NOW);
const params = (filters, extra = {}) =>
  buildUpcomingParams({ filters, language: "tr-TR", region: "TR", now: NOW, ...extra });

describe("normalizeUpcomingFilters", () => {
  test("bozuk / boş girdi varsayılana düşer", () => {
    [undefined, null, "x", 42, [], { range: "bogus", scope: 1, sort: "rating", language: "xx" }].forEach((raw) => {
      expect(norm(raw)).toEqual({ ...DEFAULT_UPCOMING_FILTERS, genres: [] });
    });
  });

  test("türler: yalnız film türleri, tekrar yok, artan sırada", () => {
    expect(norm({ genres: [878, "28", 28, 10759, 99.5, "x"] }).genres).toEqual([28, 878]);
  });

  test("'Tarihe göre' dünya genelinde geçersiz → Popüler", () => {
    expect(norm({ scope: "all", sort: "soonest" }).sort).toBe("popular");
    expect(norm({ scope: "cinema", sort: "soonest" }).sort).toBe("soonest");
    expect(norm({ scope: "digital", sort: "soonest" }).sort).toBe("soonest");
  });

  test("hazır aralıkta ay/özel alanlar temizlenir", () => {
    expect(norm({ range: "3m", month: "2026-12", from: "2026-11-01", to: "2026-12-01" })).toMatchObject({
      range: "3m",
      month: null,
      from: null,
      to: null,
    });
  });

  test("takvim ayı: pencere içindeyse kalır, geçmiş/uzak/bozuk ay varsayılana düşer", () => {
    expect(norm({ range: "calendarMonth", month: "2026-12" })).toMatchObject({ range: "calendarMonth", month: "2026-12" });
    expect(norm({ range: "calendarMonth", month: "2026-10" }).month).toBe("2026-10"); // bu ayın kalanı
    expect(norm({ range: "calendarMonth", month: "2026-09" }).range).toBe(DEFAULT_UPCOMING_FILTERS.range);
    expect(norm({ range: "calendarMonth", month: "2027-10" }).range).toBe(DEFAULT_UPCOMING_FILTERS.range);
    expect(norm({ range: "calendarMonth", month: "2026-13" }).range).toBe(DEFAULT_UPCOMING_FILTERS.range);
    expect(norm({ range: "calendarMonth" }).range).toBe(DEFAULT_UPCOMING_FILTERS.range);
  });

  test("özel aralık: geçmişe taşan başlangıç yarına, uzak bitiş sınıra kırpılır; ters uçlar yer değiştirir", () => {
    const { minIso, maxIso } = upcomingBounds(NOW);
    expect(minIso).toBe("2026-10-25");
    expect(maxIso).toBe(`${2026 + CUSTOM_MAX_YEARS}-10-24`);
    expect(norm({ range: "custom", from: "2026-01-01", to: "2026-11-30" })).toMatchObject({
      range: "custom",
      from: "2026-10-25",
      to: "2026-11-30",
    });
    expect(norm({ range: "custom", from: "2026-12-10", to: "2026-11-01" })).toMatchObject({
      from: "2026-11-01",
      to: "2026-12-10",
    });
    expect(norm({ range: "custom", from: "2026-11-01", to: "2099-01-01" }).to).toBe(maxIso);
    // Başlangıç yoksa yarın.
    expect(norm({ range: "custom", to: "2026-11-15" })).toMatchObject({ from: "2026-10-25", to: "2026-11-15" });
  });

  test("özel aralık: tamamen geçmişte / bitişsiz / bozuk tarih → varsayılan", () => {
    const fallback = DEFAULT_UPCOMING_FILTERS.range;
    expect(norm({ range: "custom", from: "2026-09-01", to: "2026-10-20" }).range).toBe(fallback);
    expect(norm({ range: "custom", from: "2026-11-01" }).range).toBe(fallback);
    expect(norm({ range: "custom", from: "2026-11-01", to: "2026-02-30" }).range).toBe(fallback);
  });

  test("gün değişince (yarın bugün olunca) geçmişte kalan ay düşer", () => {
    const stored = { range: "calendarMonth", month: "2026-10" };
    expect(normalizeUpcomingFilters(stored, NOW).range).toBe("calendarMonth");
    // 31 Ekim: "yaklaşan" 1 Kasım'da başlıyor, Ekim artık seçilemez.
    expect(normalizeUpcomingFilters(stored, new Date(2026, 9, 31, 10)).range).toBe(DEFAULT_UPCOMING_FILTERS.range);
  });
});

describe("takvim yardımcıları", () => {
  test("parseIsoDay geçersiz günü reddeder", () => {
    expect(parseIsoDay("2026-02-29")).toBeNull();
    expect(parseIsoDay("2028-02-29")).not.toBeNull();
    expect(parseIsoDay("2026-1-5")).toBeNull();
    expect(parseIsoDay(null)).toBeNull();
  });

  test("monthBounds ayın ilk ve son günü", () => {
    expect(monthBounds("2027-02")).toEqual({ first: "2027-02-01", last: "2027-02-28" });
    expect(monthBounds("2026-12")).toEqual({ first: "2026-12-01", last: "2026-12-31" });
    expect(monthBounds("2026-00")).toBeNull();
  });

  test("ay seçici yarının ayından başlar, MONTH_WINDOW ay sürer", () => {
    const months = upcomingMonths(NOW);
    expect(months).toHaveLength(MONTH_WINDOW);
    expect(months[0]).toBe("2026-10");
    expect(months[2]).toBe("2026-12");
    expect(months[3]).toBe("2027-01");
    expect(upcomingMonths(new Date(2026, 9, 31))[0]).toBe("2026-11");
    expect(upcomingMonths(new Date(2026, 11, 31))[0]).toBe("2027-01");
  });
});

describe("upcomingDateRange", () => {
  test.each([
    ["7d", "2026-11-01"],
    ["1m", "2026-11-25"],
    ["3m", "2027-01-25"],
    ["6m", "2027-04-25"],
    ["1y", "2027-10-25"],
  ])("%s yarından başlar → %s", (range, lte) => {
    expect(upcomingDateRange({ range }, NOW)).toEqual({ gte: "2026-10-25", lte });
  });

  test("Tümü: üst sınır yok", () => {
    expect(upcomingDateRange({ range: "all" }, NOW)).toEqual({ gte: "2026-10-25", lte: null });
  });

  test("takvim ayı: bu ay yarından, sonraki aylar baştan sona", () => {
    expect(upcomingDateRange({ range: "calendarMonth", month: "2026-10" }, NOW)).toEqual({
      gte: "2026-10-25",
      lte: "2026-10-31",
    });
    expect(upcomingDateRange({ range: "calendarMonth", month: "2027-02" }, NOW)).toEqual({
      gte: "2027-02-01",
      lte: "2027-02-28",
    });
  });

  test("özel aralık olduğu gibi", () => {
    expect(upcomingDateRange({ range: "custom", from: "2026-12-01", to: "2027-01-15" }, NOW)).toEqual({
      gte: "2026-12-01",
      lte: "2027-01-15",
    });
  });
});

describe("buildUpcomingParams", () => {
  test("varsayılan: dünya geneli, ilk çıkış tarihi penceresi, popülerlik; region YOK", () => {
    // region gönderilseydi kartın tarihi bölgesel olurdu, pencere ise ilk çıkış tarihine göre —
    // "Bu hafta"da 69 gün kaldı yazan kartlar (canlı TMDB ile doğrulandı, 24 Eki 2026).
    expect(params(DEFAULT_UPCOMING_FILTERS)).toEqual({
      include_video: "false",
      language: "tr-TR",
      page: 1,
      "primary_release_date.gte": "2026-10-25",
      "primary_release_date.lte": "2026-11-01",
      sort_by: "popularity.desc",
    });
  });

  test("include_adult ASLA yazılmaz (tmdbAdultGuard tek kaynak)", () => {
    const all = [
      DEFAULT_UPCOMING_FILTERS,
      { scope: "cinema", sort: "soonest", genres: [27], language: "ko", range: "all" },
      { scope: "digital", range: "custom", from: "2026-11-01", to: "2026-12-01" },
    ];
    all.forEach((f) => {
      expect(Object.keys(params(f))).not.toContain("include_adult");
      expect(buildUpcomingUrl({ filters: f, language: "tr-TR", region: "TR", now: NOW })).not.toMatch(/include_adult/);
    });
  });

  test("Sinemada: bölgesel çıkış tarihi + vizyon türleri + yeniden vizyon tabanı", () => {
    const p = params({ scope: "cinema", range: "1m" });
    expect(p["release_date.gte"]).toBe("2026-10-25");
    expect(p["release_date.lte"]).toBe("2026-11-25");
    expect(p.with_release_type).toBe("2|3");
    expect(p["primary_release_date.gte"]).toBe("2024-10-25");
    expect(p["primary_release_date.lte"]).toBeUndefined();
    expect(p.region).toBe("TR");
  });

  test("Dijitalde: çıkış türü 4", () => {
    expect(params({ scope: "digital" }).with_release_type).toBe("4");
  });

  test("Tarihe göre: bölgesel tarihe göre artan", () => {
    expect(params({ scope: "cinema", sort: "soonest" }).sort_by).toBe("release_date.asc");
    expect(params({ scope: "cinema", sort: "popular" }).sort_by).toBe("popularity.desc");
  });

  test("Tümü + bölgesel: üst sınır yazılmaz", () => {
    const p = params({ scope: "cinema", range: "all" });
    expect(p["release_date.lte"]).toBeUndefined();
    expect(p["release_date.gte"]).toBe("2026-10-25");
  });

  test("türler VEYA (|) ile, dil özgün dil süzgecine", () => {
    const p = params({ genres: [878, 27], language: "ko" });
    expect(p.with_genres).toBe("27|878");
    expect(p.with_original_language).toBe("ko");
    expect(params(DEFAULT_UPCOMING_FILTERS).with_genres).toBeUndefined();
  });

  test("bölge yoksa bölgesel gösterim dünya geneline ve popülere düşer", () => {
    const p = buildUpcomingParams({ filters: { scope: "cinema", sort: "soonest" }, language: "tr-TR", now: NOW });
    expect(p.with_release_type).toBeUndefined();
    expect(p["primary_release_date.gte"]).toBe("2026-10-25");
    expect(p.sort_by).toBe("popularity.desc");
  });

  test("her seçenek sorguyu değiştirir (imza sayfadan bağımsız)", () => {
    const base = { filters: DEFAULT_UPCOMING_FILTERS, language: "tr-TR", region: "TR", now: NOW };
    const sig = upcomingQuerySignature(base);
    expect(upcomingQuerySignature({ ...base, page: 7 })).toBe(sig);
    const seen = new Set([sig]);
    const variants = [
      ...QUICK_RANGES.filter((r) => r !== DEFAULT_UPCOMING_FILTERS.range).map((range) => ({ range })),
      { range: "calendarMonth", month: "2026-12" },
      { range: "custom", from: "2026-11-02", to: "2026-11-20" },
      ...SCOPES.filter((s) => s !== "all").map((scope) => ({ scope })),
      { scope: "cinema", sort: "soonest" },
      ...UPCOMING_GENRES.map((id) => ({ genres: [id] })),
      ...UPCOMING_LANGUAGES.filter((l) => l !== "any").map((language) => ({ language })),
    ];
    variants.forEach((filters) => {
      const next = upcomingQuerySignature({ ...base, filters });
      expect(seen.has(next)).toBe(false);
      seen.add(next);
    });
    expect(upcomingQuerySignature({ ...base, language: "en-US" })).not.toBe(sig);
    // Bölge yalnız bölgesel gösterimde sorguya girer.
    expect(upcomingQuerySignature({ ...base, region: "US" })).toBe(sig);
    const cinema = { ...base, filters: { scope: "cinema" } };
    expect(upcomingQuerySignature({ ...cinema, region: "US" })).not.toBe(upcomingQuerySignature(cinema));
  });

  test("URL TMDB discover/movie ucuna gider, parametreler kodlanır", () => {
    const url = buildUpcomingUrl({ filters: { scope: "cinema", genres: [27, 53] }, language: "tr-TR", region: "TR", now: NOW, page: 2 });
    expect(url.startsWith("https://api.themoviedb.org/3/discover/movie?")).toBe(true);
    expect(url).toContain("with_release_type=2%7C3");
    expect(url).toContain("with_genres=27%7C53");
    expect(url).toContain("page=2");
  });
});

describe("değişiklik yardımcıları", () => {
  test("'Tarihe göre' seçmek dünya genelinden Sinemada'ya geçirir; Tüm dünya'ya dönmek Popüler'e indirir", () => {
    const soon = setUpcomingFilter(DEFAULT_UPCOMING_FILTERS, "sort", "soonest", NOW);
    expect(soon).toMatchObject({ scope: "cinema", sort: "soonest" });
    const digital = setUpcomingFilter(soon, "scope", "digital", NOW);
    expect(digital).toMatchObject({ scope: "digital", sort: "soonest" });
    expect(setUpcomingFilter(digital, "scope", "all", NOW)).toMatchObject({ scope: "all", sort: "popular" });
  });

  test("aralık / ay / özel aralık birbirini temizler", () => {
    const month = setUpcomingMonth({ range: "custom", from: "2026-11-01", to: "2026-11-09" }, "2027-01", NOW);
    expect(month).toMatchObject({ range: "calendarMonth", month: "2027-01", from: null, to: null });
    const custom = setUpcomingCustomRange(month, { from: "2026-11-03", to: "2026-11-30" }, NOW);
    expect(custom).toMatchObject({ range: "custom", month: null, from: "2026-11-03", to: "2026-11-30" });
    expect(setUpcomingRange(custom, "6m", NOW)).toMatchObject({ range: "6m", month: null, from: null, to: null });
  });

  test("tür aç/kapat (sınır yok, VEYA)", () => {
    let f = DEFAULT_UPCOMING_FILTERS;
    UPCOMING_GENRES.forEach((id) => { f = toggleUpcomingGenre(f, id, NOW); });
    expect(f.genres).toHaveLength(UPCOMING_GENRES.length);
    f = toggleUpcomingGenre(f, 28, NOW);
    expect(f.genres).not.toContain(28);
  });

  test("rozet sayacı tarihi saymaz; Sıfırla tarihi de görür", () => {
    expect(countActiveUpcomingFilters(norm({ range: "1y" }))).toBe(0);
    expect(isUpcomingCustomized({ range: "1y" }, NOW)).toBe(true);
    expect(countActiveUpcomingFilters(norm({ scope: "cinema", genres: [27, 35], language: "ja", sort: "soonest" }))).toBe(4);
    expect(isUpcomingCustomized(DEFAULT_UPCOMING_FILTERS, NOW)).toBe(false);
  });

  test("depo biçimi: varsayılansa null, değilse normalize", () => {
    expect(toStoredUpcomingFilters(DEFAULT_UPCOMING_FILTERS, NOW)).toBeNull();
    expect(toStoredUpcomingFilters({ range: "bogus" }, NOW)).toBeNull();
    expect(toStoredUpcomingFilters({ genres: [35, 27] }, NOW)).toEqual({ ...DEFAULT_UPCOMING_FILTERS, genres: [27, 35] });
  });
});

describe("metin tablosu", () => {
  const LANGS = ["tr", "en", "es", "pt", "de"];

  test.each(LANGS)("%s: her seçeneğin boş olmayan etiketi var", (lang) => {
    const copy = UPCOMING_FILTERS_COPY[lang];
    QUICK_RANGES.forEach((id) => expect(copy.ranges[id]).toEqual(expect.stringMatching(/\S/)));
    SCOPES.forEach((id) => expect(copy.scopes[id]).toEqual(expect.stringMatching(/\S/)));
    UPCOMING_SORTS.forEach((id) => expect(copy.sorts[id]).toEqual(expect.stringMatching(/\S/)));
    ["TR", "US", "ES", "BR", "DE"].forEach((region) => expect(copy.regions[region]).toBeTruthy());
    expect(copy.months).toHaveLength(12);
    expect(copy.monthsShort).toHaveLength(12);
  });

  test("bilinmeyen dil İngilizceye düşer", () => {
    expect(getUpcomingFiltersCopy("xx")).toBe(UPCOMING_FILTERS_COPY.en);
  });

  test("gün ve ay biçimi: yıl farklıysa yıl eklenir, dil sırası korunur", () => {
    const tr = UPCOMING_FILTERS_COPY.tr;
    const en = UPCOMING_FILTERS_COPY.en;
    const de = UPCOMING_FILTERS_COPY.de;
    expect(formatUpcomingDay("2026-11-05", tr, NOW)).toBe("5 Kas");
    expect(formatUpcomingDay("2027-01-15", tr, NOW)).toBe("15 Oca 2027");
    expect(formatUpcomingDay("2026-11-05", en, NOW)).toBe("Nov 5");
    expect(formatUpcomingDay("2027-01-15", en, NOW)).toBe("Jan 15, 2027");
    expect(formatUpcomingDay("2026-11-05", de, NOW)).toBe("5. Nov.");
    expect(formatUpcomingDay("bozuk", tr, NOW)).toBe("");
    expect(formatUpcomingMonth("2026-12", tr, NOW)).toBe("Aralık");
    expect(formatUpcomingMonth("2027-01", tr, NOW)).toBe("Ocak 2027");
    expect(formatUpcomingMonth("2027-01", UPCOMING_FILTERS_COPY.es, NOW)).toBe("Enero de 2027");
  });

  test("çip etiketi: hazır aralık · ay · özel aralık", () => {
    const tr = UPCOMING_FILTERS_COPY.tr;
    expect(upcomingRangeLabel({ range: "3m" }, tr, NOW)).toBe("3 ay");
    expect(upcomingRangeLabel({ range: "calendarMonth", month: "2026-12" }, tr, NOW)).toBe("Aralık");
    expect(upcomingRangeLabel({ range: "custom", from: "2026-11-05", to: "2027-01-10" }, tr, NOW)).toBe(
      "5 Kas – 10 Oca 2027",
    );
  });

  test("özet: gösterim · türler (+N) · dil · tarih sıralaması; süzgeç yoksa boş", () => {
    expect(upcomingSummary(norm({}), "tr")).toBe("");
    expect(upcomingSummary(norm({ range: "1y" }), "tr")).toBe("");
    const summary = upcomingSummary(norm({ scope: "cinema", sort: "soonest", genres: [27, 35, 53], language: "ko" }), "tr");
    const parts = summary.split(" · ");
    expect(parts[0]).toBe("Sinemada");
    expect(parts[1]).toMatch(/\+1$/);
    expect(parts).toHaveLength(4);
    expect(parts[3]).toBe("Tarihe göre");
    expect(upcomingSummary(norm({ genres: [27] }), "en")).not.toMatch(/\d/);
  });
});
