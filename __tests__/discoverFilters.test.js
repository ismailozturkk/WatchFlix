// __tests__/discoverFilters.test.js
//
// "Ne izlesem?" (Filtreli Keşif) saf çekirdeği: doğrulama, TMDB parametre üretimi, tür eşlemesi,
// "izlediklerimi gizle", otomatik doldurma kararı, hazır ve kayıtlı süzgeçler.
//
// Bekçi mantığı: her seçenek kümesinin HER üyesinin ya URL'e çıktığı ya da bilinçli olarak
// çıkmadığı burada kilitli — yeni seçenek eklenip sorguya bağlanmazsa test kırılır.

const {
  DEFAULT_FILTERS,
  ERAS,
  FILTER_KEYS,
  GENRES,
  LANGUAGES,
  MAX_AUTOFILL_PAGES,
  MAX_GENRES,
  MAX_PRESET_NAME,
  MAX_SAVED_PRESETS,
  MIN_VISIBLE_RESULTS,
  QUICK_PRESETS,
  RATINGS,
  RUNTIMES,
  RUNTIME_LIMITS,
  SORTS,
  activeFilterKeys,
  addPreset,
  applyHideWatched,
  buildDiscoverParams,
  buildDiscoverUrl,
  convertFiltersForType,
  countActiveFilters,
  describeFilters,
  discoverSignature,
  eraRange,
  filtersSignature,
  isCustomized,
  isoDate,
  makePresetId,
  mergePages,
  needsPlatformSetup,
  normalizeFilters,
  normalizeLastFilters,
  normalizePresets,
  pickSurprise,
  presetNameFor,
  removePreset,
  resolveInitialFilters,
  resolveQuickPreset,
  sameFilters,
  setFilter,
  shouldFetchMore,
  surprisePageLimit,
  toQueryString,
  toStoredLastFilters,
  toggleGenre,
} = require("../utils/discoverFilters");

const NOW = new Date(2026, 9, 17, 12, 0, 0); // 17 Ekim 2026 (yerel)
const base = { language: "tr-TR", region: "TR", now: NOW };
const params = (filters, mediaType = "movie", extra = {}) =>
  buildDiscoverParams({ mediaType, filters, ...base, ...extra });

describe("normalizeFilters", () => {
  test("bozuk girdi varsayılana düşer ve asla fırlatmaz", () => {
    for (const bad of [null, undefined, 5, "x", [], { genres: "28" }, { era: 3 }]) {
      expect(normalizeFilters(bad)).toEqual(DEFAULT_FILTERS);
    }
  });

  test("tür kimlikleri o medya türüne göre süzülür, tekilleşir, sıralanır, sınırlanır", () => {
    expect(normalizeFilters({ genres: [35, 28, 35, "18", 99999, "abc"] }, "movie").genres).toEqual([18, 28, 35]);
    // 28 Dizi'de yok (Dizi'de 10759 var)
    expect(normalizeFilters({ genres: [28, 35] }, "tv").genres).toEqual([35]);
    expect(normalizeFilters({ genres: [28, 12, 16, 35, 80, 99] }, "movie").genres).toHaveLength(MAX_GENRES);
  });

  test("geçersiz alan tek başına varsayılana döner, geçerli komşusu korunur", () => {
    const f = normalizeFilters({ era: "yok", minRating: 9, runtime: "short", language: "xx", sort: "rating" }, "movie");
    expect(f).toMatchObject({ era: "any", minRating: 0, runtime: "short", language: "any", sort: "rating" });
  });

  test("boolean alanlar yalnız gerçek true ile açılır", () => {
    expect(normalizeFilters({ onMyPlatforms: "true", hideWatched: 1 }).onMyPlatforms).toBe(false);
    expect(normalizeFilters({ onMyPlatforms: true, hideWatched: true })).toMatchObject({
      onMyPlatforms: true,
      hideWatched: true,
    });
  });

  test("aynı küme = aynı imza (sıra/tekrar fark etmez)", () => {
    expect(filtersSignature({ genres: [35, 18] }, "movie")).toBe(filtersSignature({ genres: [18, 35, 18] }, "movie"));
  });
});

describe("etkin süzgeç sayımı", () => {
  test("varsayılan: hiçbiri; sıralama sayılmaz ama 'özelleştirilmiş' sayılır", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, sort: "rating" })).toBe(0);
    expect(isCustomized(DEFAULT_FILTERS, "movie")).toBe(false);
    expect(isCustomized({ ...DEFAULT_FILTERS, sort: "rating" }, "movie")).toBe(true);
  });

  test("tür grubu çoklu seçimde de TEK sayılır; her alan ayrı sayılır", () => {
    const f = normalizeFilters(
      { genres: [35, 18], era: "d2010", minRating: 7, runtime: "short", language: "ko", onMyPlatforms: true, hideWatched: true },
      "movie",
    );
    expect(countActiveFilters(f)).toBe(FILTER_KEYS.length);
    expect(activeFilterKeys(f)).toEqual(FILTER_KEYS);
  });

  test("setFilter ve toggleGenre sonucu daima normalize; tür sınırı yeni seçimi reddeder", () => {
    expect(setFilter(DEFAULT_FILTERS, "minRating", 7, "movie").minRating).toBe(7);
    expect(setFilter(DEFAULT_FILTERS, "minRating", 99, "movie").minRating).toBe(0);
    let f = DEFAULT_FILTERS;
    for (const id of [28, 12, 16, 35]) f = toggleGenre(f, id, "movie");
    expect(f.genres).toHaveLength(MAX_GENRES);
    expect(toggleGenre(f, 80, "movie").genres).toEqual(f.genres); // 5. tür reddedilir
    expect(toggleGenre(f, 12, "movie").genres).not.toContain(12); // seçili olan kaldırılır
  });
});

describe("TMDB parametreleri", () => {
  test("varsayılan: yalnız dil, sayfa, popülerlik ve yayınlanmış-olma sınırı", () => {
    expect(params(DEFAULT_FILTERS)).toEqual({
      language: "tr-TR",
      page: 1,
      sort_by: "popularity.desc",
      "primary_release_date.lte": "2026-10-17",
    });
    expect(params(DEFAULT_FILTERS, "tv")).toEqual({
      language: "tr-TR",
      page: 1,
      sort_by: "popularity.desc",
      "first_air_date.lte": "2026-10-17",
    });
  });

  test("include_adult ASLA üretilmez (ayarı tek yerden tmdbAdultGuard uygular)", () => {
    const all = normalizeFilters(
      { genres: [35], era: "d2010", minRating: 7, runtime: "short", language: "ko", onMyPlatforms: true, hideWatched: true, sort: "rating" },
      "movie",
    );
    expect(Object.keys(params(all, "movie", { providerIds: [8] }))).not.toContain("include_adult");
  });

  test.each(SORTS)("sıralama %s Film ve Dizi için sort_by üretir", (sort) => {
    expect(params({ sort }, "movie").sort_by).toMatch(/\.desc$/);
    expect(params({ sort }, "tv").sort_by).toMatch(/\.desc$/);
  });

  test("'en yeni' sıralaması medya türüne uygun tarih alanını kullanır", () => {
    expect(params({ sort: "newest" }, "movie").sort_by).toBe("primary_release_date.desc");
    expect(params({ sort: "newest" }, "tv").sort_by).toBe("first_air_date.desc");
  });

  test("türler VE ile birleşir (virgül)", () => {
    expect(params({ genres: [35, 10749] }, "movie").with_genres).toBe("35,10749");
  });

  test.each(ERAS)("dönem %s: alt/üst sınır bugünü ASLA aşmaz", (era) => {
    const range = eraRange(era, NOW);
    expect(range.lte <= "2026-10-17").toBe(true);
    if (range.gte && range.lte) expect(range.gte <= range.lte).toBe(true);
  });

  test("dönem aralıkları: 90'lar iki sınırlı, klasik yalnız üst sınırlı, 2020'ler bugüne kırpılır", () => {
    expect(eraRange("d1990", NOW)).toEqual({ gte: "1990-01-01", lte: "1999-12-31" });
    expect(eraRange("classic", NOW)).toEqual({ lte: "1989-12-31" });
    expect(eraRange("d2020", NOW)).toEqual({ gte: "2020-01-01", lte: "2026-10-17" });
    expect(eraRange("last1", NOW)).toEqual({ gte: "2025-10-17", lte: "2026-10-17" });
    expect(eraRange("last5", NOW).gte).toBe("2021-10-17");
    expect(params({ era: "d2010" }, "tv")).toMatchObject({
      "first_air_date.gte": "2010-01-01",
      "first_air_date.lte": "2019-12-31",
    });
  });

  test("yerel gün: geceyarısına yakın saatte tarih UTC'ye kaymaz", () => {
    expect(isoDate(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
    expect(isoDate(new Date(2026, 11, 31, 23, 55))).toBe("2026-12-31");
  });

  test("puan süzgeci oy tabanı getirir; puana göre sıralama daha yüksek taban ister", () => {
    expect(params({ minRating: 7 }, "movie")).toMatchObject({ "vote_average.gte": 7, "vote_count.gte": 100 });
    expect(params({ minRating: 7 }, "tv")).toMatchObject({ "vote_average.gte": 7, "vote_count.gte": 50 });
    expect(params({ sort: "rating" }, "movie")["vote_count.gte"]).toBe(300);
    expect(params({ sort: "rating", minRating: 6 }, "tv")["vote_count.gte"]).toBe(150);
    expect(params({ sort: "newest" }, "movie")["vote_count.gte"]).toBe(10);
    expect(params(DEFAULT_FILTERS, "movie")["vote_count.gte"]).toBeUndefined();
  });

  test.each(RATINGS.filter((r) => r > 0))("puan %s vote_average.gte olarak çıkar", (rating) => {
    expect(params({ minRating: rating })["vote_average.gte"]).toBe(rating);
  });

  test.each(RUNTIMES.filter((r) => r !== "any"))("süre bandı %s film ve dizide FARKLI sınır üretir", (band) => {
    const movie = params({ runtime: band }, "movie");
    const tv = params({ runtime: band }, "tv");
    const key = band === "long" ? "with_runtime.gte" : "with_runtime.lte";
    expect(movie[key]).toBe(RUNTIME_LIMITS.movie[band][band === "long" ? "gte" : "lte"]);
    expect(tv[key]).toBe(RUNTIME_LIMITS.tv[band][band === "long" ? "gte" : "lte"]);
    expect(movie[key]).not.toBe(tv[key]);
  });

  test.each(LANGUAGES.filter((l) => l !== "any"))("dil %s with_original_language olur", (code) => {
    expect(params({ language: code }).with_original_language).toBe(code);
  });

  test("platform: yalnız süzgeç AÇIK ve platform VARKEN eklenir; yinelenen/bozuk kimlikler atılır", () => {
    const on = { onMyPlatforms: true };
    expect(params(on, "movie", { providerIds: [8, 337, 8, "x", -1, 0] })).toMatchObject({
      watch_region: "TR",
      with_watch_providers: "8|337",
      with_watch_monetization_types: "flatrate",
    });
    expect(params(on, "movie", { providerIds: [] }).with_watch_providers).toBeUndefined();
    expect(params({}, "movie", { providerIds: [8] }).with_watch_providers).toBeUndefined();
  });

  test("izlediklerimi gizle sorguyu DEĞİŞTİRMEZ (istemci tarafında süzülür)", () => {
    expect(params({ hideWatched: true })).toEqual(params({}));
  });

  test("sayfa 1'den küçük/bozuk gelirse 1'e çekilir", () => {
    expect(params({}, "movie", { page: 0 }).page).toBe(1);
    expect(params({}, "movie", { page: "abc" }).page).toBe(1);
    expect(params({}, "movie", { page: 3.9 }).page).toBe(3);
  });

  test("URL: doğru uç, kodlanmış değerler, boş değer yok", () => {
    const url = buildDiscoverUrl({
      mediaType: "tv",
      filters: { genres: [35], onMyPlatforms: true },
      providerIds: [8, 337],
      ...base,
    });
    expect(url.startsWith("https://api.themoviedb.org/3/discover/tv?")).toBe(true);
    expect(url).toContain("with_genres=35");
    expect(url).toContain("with_watch_providers=8%7C337");
    expect(toQueryString({ a: 1, b: "", c: null, d: undefined, e: "x y" })).toBe("a=1&e=x%20y");
  });

  test("istek imzası sayfadan bağımsız, süzgeçten bağımlı", () => {
    const a = discoverSignature({ mediaType: "movie", filters: { genres: [35] }, ...base, page: 1 });
    const b = discoverSignature({ mediaType: "movie", filters: { genres: [35] }, ...base, page: 4 });
    const c = discoverSignature({ mediaType: "movie", filters: { genres: [18] }, ...base, page: 1 });
    const d = discoverSignature({ mediaType: "tv", filters: { genres: [35] }, ...base, page: 1 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  test("needsPlatformSetup: açık ama platform yok", () => {
    expect(needsPlatformSetup({ onMyPlatforms: true }, [])).toBe(true);
    expect(needsPlatformSetup({ onMyPlatforms: true }, [8])).toBe(false);
    expect(needsPlatformSetup({ onMyPlatforms: false }, [])).toBe(false);
  });
});

describe("Film ↔ Dizi geçişi", () => {
  test("ortak türler taşınır, eşdeğerler eşlenir, eşi olmayan düşer", () => {
    const f = normalizeFilters({ genres: [35, 28, 878, 27], era: "d2010", minRating: 7, runtime: "short" }, "movie");
    const tv = convertFiltersForType(f, "movie", "tv");
    expect(tv.genres.sort((a, b) => a - b)).toEqual([35, 10759, 10765]); // korku (27) Dizi'de yok
    expect(tv).toMatchObject({ era: "d2010", minRating: 7, runtime: "short" });
    const back = convertFiltersForType(tv, "tv", "movie");
    expect(back.genres.sort((a, b) => a - b)).toEqual([28, 35, 878]);
  });

  test("aynı türe 'geçiş' süzgeci olduğu gibi (normalize) döner", () => {
    const f = normalizeFilters({ genres: [35] }, "movie");
    expect(convertFiltersForType(f, "movie", "movie")).toEqual(f);
  });

  test("dönüşüm sonrası her tür hedef türün geçerli kimliği", () => {
    for (const from of ["movie", "tv"]) {
      const to = from === "movie" ? "tv" : "movie";
      const all = normalizeFilters({ genres: GENRES[from].slice(0, MAX_GENRES) }, from);
      convertFiltersForType(all, from, to).genres.forEach((id) => expect(GENRES[to]).toContain(id));
    }
  });
});

describe("izlediklerimi gizle", () => {
  const index = { movie: { 1: { isWatched: true }, 2: { isWatched: false, inWatchList: true } }, tv: { 7: { isWatched: true } } };
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

  test("yalnız izlendi olanlar elenir; izleme listesindekiler kalır", () => {
    expect(applyHideWatched(items, index, "movie").map((i) => i.id)).toEqual([2, 3]);
  });

  test("tür kovası ayrı: Film kimliği Dizi'yi etkilemez", () => {
    expect(applyHideWatched([{ id: 1 }, { id: 7 }], index, "tv").map((i) => i.id)).toEqual([1]);
  });

  test("eleyecek bir şey yoksa AYNI dizi döner (kimlik korunur); dizin yoksa da", () => {
    const clean = [{ id: 2 }, { id: 3 }];
    expect(applyHideWatched(clean, index, "movie")).toBe(clean);
    expect(applyHideWatched(items, null, "movie")).toBe(items);
    expect(applyHideWatched(items, undefined, "movie")).toBe(items);
  });
});

describe("sayfa birleştirme ve otomatik doldurma", () => {
  test("mergePages tekrar eden / kimliksiz kayıtları atar; yeni yoksa AYNI diziyi döner", () => {
    const prev = [{ id: 1 }, { id: 2 }];
    expect(mergePages(prev, [{ id: 2 }, { id: 3 }, null, {}]).map((i) => i.id)).toEqual([1, 2, 3]);
    expect(mergePages(prev, [{ id: 1 }])).toBe(prev);
    expect(mergePages(undefined, [{ id: 9 }])).toEqual([{ id: 9 }]);
  });

  test("shouldFetchMore: hedef dolana, sayfa bitene ya da tavan aşılana dek", () => {
    const args = { visibleCount: 4, page: 1, totalPages: 10, pagesFetched: 1 };
    expect(shouldFetchMore(args)).toBe(true);
    expect(shouldFetchMore({ ...args, visibleCount: MIN_VISIBLE_RESULTS })).toBe(false);
    expect(shouldFetchMore({ ...args, page: 10 })).toBe(false);
    expect(shouldFetchMore({ ...args, pagesFetched: MAX_AUTOFILL_PAGES })).toBe(false);
  });

  test("sonsuz döngü yok: her tur pagesFetched artarken döngü tavanda biter", () => {
    let pagesFetched = 0;
    let page = 0;
    while (shouldFetchMore({ visibleCount: 0, page, totalPages: 500, pagesFetched })) {
      page += 1;
      pagesFetched += 1;
    }
    expect(pagesFetched).toBe(MAX_AUTOFILL_PAGES);
  });
});

describe("Şaşırt beni", () => {
  test("yalnız afişli adaylardan seçer; rastgele indeks sınır dışıysa ilkine düşer", () => {
    const items = [{ id: 1, poster_path: null }, { id: 2, poster_path: "/a" }, { id: 3, poster_path: "/b" }];
    expect(pickSurprise(items, () => 1).id).toBe(3);
    expect(pickSurprise(items, () => 99).id).toBe(2);
    expect(pickSurprise(items, () => NaN).id).toBe(2);
    expect(pickSurprise([{ id: 1 }], () => 0)).toBeNull();
    expect(pickSurprise(null, () => 0)).toBeNull();
  });

  test("puanı yeterli olanlar TERCİH edilir; hiçbiri yoksa tüm afişli havuz kullanılır", () => {
    const items = [
      { id: 1, poster_path: "/a", vote_average: 4.2 },
      { id: 2, poster_path: "/b", vote_average: 7.8 },
      { id: 3, poster_path: "/c", vote_average: 5.9 },
    ];
    // tercih edilen tek aday 2 numaralı: hangi rastgele indeks gelirse gelsin o seçilir
    for (let i = 0; i < 3; i += 1) expect(pickSurprise(items, () => i).id).toBe(2);
    const low = [{ id: 1, poster_path: "/a", vote_average: 3 }, { id: 2, poster_path: "/b" }];
    expect(pickSurprise(low, () => 1).id).toBe(2);
  });

  test("rastgele sayfa penceresi 1..8, toplam sayfayı aşmaz", () => {
    expect(surprisePageLimit(500)).toBe(8);
    expect(surprisePageLimit(3)).toBe(3);
    expect(surprisePageLimit(0)).toBe(1);
    expect(surprisePageLimit(undefined)).toBe(1);
  });
});

describe("hazır süzgeçler", () => {
  test.each(QUICK_PRESETS.map((p) => p.id))("%s her iki medya türünde geçerli ve özelleştirilmiş", (id) => {
    for (const type of ["movie", "tv"]) {
      const f = resolveQuickPreset(id, type, { hasProviders: true });
      expect(f).toEqual(normalizeFilters(f, type));
      expect(isCustomized(f, type)).toBe(true);
    }
  });

  test("platform yalnız 'usePlatforms' hazırında VE kullanıcının platformu varken açılır", () => {
    expect(resolveQuickPreset("tonight", "movie", { hasProviders: true }).onMyPlatforms).toBe(true);
    expect(resolveQuickPreset("tonight", "movie", { hasProviders: false }).onMyPlatforms).toBe(false);
    expect(resolveQuickPreset("topRated", "movie", { hasProviders: true }).onMyPlatforms).toBe(false);
  });

  test("bilinmeyen hazır kimliği null", () => {
    expect(resolveQuickPreset("yok", "movie")).toBeNull();
  });
});

describe("kayıtlı süzgeçler", () => {
  const mk = (id, over = {}) => ({
    id,
    name: `Ad ${id}`,
    mediaType: "movie",
    filters: { genres: [35], minRating: 7, ...over },
  });

  test("normalizePresets bozuk öğeleri, tekrar kimlikleri ve aynı süzgeçli kopyaları atar", () => {
    const out = normalizePresets([
      mk("a"),
      mk("a", { minRating: 8 }), // aynı kimlik
      mk("b"), // a ile aynı süzgeç
      { id: "", name: "x", mediaType: "movie" },
      { id: "c", name: "", mediaType: "movie" },
      { id: "d", name: "x", mediaType: "podcast" },
      null,
      "x",
      mk("e", { minRating: 6 }),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "e"]);
  });

  test("ham değer dizi değilse boş liste", () => {
    for (const bad of [null, undefined, {}, "x", 4]) expect(normalizePresets(bad)).toEqual([]);
  });

  test("ad kırpılır ve boşlukları sadeleşir; süzgeç medya türüne göre normalize", () => {
    const [p] = normalizePresets([{ id: "a", name: `  ${"x".repeat(80)}   y  `, mediaType: "tv", filters: { genres: [28, 35] } }]);
    expect(p.name.length).toBeLessThanOrEqual(MAX_PRESET_NAME);
    expect(p.filters.genres).toEqual([35]);
  });

  test("addPreset yeniyi başa ekler, aynı süzgeci kopyalamaz (taşır), sınırı uygular", () => {
    let list = [];
    for (let i = 0; i < MAX_SAVED_PRESETS + 3; i += 1) {
      list = addPreset(list, mk(`p${i}`, { minRating: RATINGS[1 + (i % 3)], era: ERAS[i % ERAS.length] }));
    }
    expect(list.length).toBeLessThanOrEqual(MAX_SAVED_PRESETS);
    const again = addPreset(list, { ...list[3], id: "yeni", name: "Yeni ad" });
    expect(again[0].id).toBe("yeni");
    expect(again.filter((p) => JSON.stringify(p.filters) === JSON.stringify(list[3].filters))).toHaveLength(1);
  });

  test("addPreset geçersiz girdiyi listeye eklemez; removePreset siler", () => {
    const list = addPreset([], mk("a"));
    expect(addPreset(list, { id: "", name: "", mediaType: "x" })).toEqual(list);
    expect(removePreset(list, "a")).toEqual([]);
    expect(removePreset(list, "yok")).toEqual(list);
  });

  test("makePresetId deterministik girdiyle kararlı ve benzersizleşir", () => {
    expect(makePresetId(1000, () => 0.5)).toBe(makePresetId(1000, () => 0.5));
    expect(makePresetId(1000, () => 0.5)).not.toBe(makePresetId(1001, () => 0.5));
    expect(makePresetId()).toMatch(/^p_[0-9a-z]+_[0-9a-z]+$/);
  });
});

describe("son kullanılan süzgeç", () => {
  test("her medya türü ayrı normalize edilir; bozuk kayıt varsayılan", () => {
    expect(normalizeLastFilters(null)).toEqual({ movie: DEFAULT_FILTERS, tv: DEFAULT_FILTERS });
    const last = normalizeLastFilters({ movie: { genres: [28] }, tv: { genres: [28] } });
    expect(last.movie.genres).toEqual([28]);
    expect(last.tv.genres).toEqual([]); // 28 Dizi'de geçersiz
  });

  test("hiçbiri özelleştirilmediyse depoya null yazılır; biri varsa nesne", () => {
    expect(toStoredLastFilters({ movie: DEFAULT_FILTERS, tv: DEFAULT_FILTERS })).toBeNull();
    expect(toStoredLastFilters({ movie: { minRating: 7 } })).not.toBeNull();
    expect(toStoredLastFilters({ tv: { sort: "rating" } })).not.toBeNull();
  });
});

describe("çip ve ad üretimi", () => {
  const copy = {
    genres: { 35: "Komedi", 10749: "Romantik" },
    eras: { d2010: "2010'lar" },
    runtimes: { movie: { short: "90 dk'ya kadar" }, tv: { short: "30 dk'ya kadar" } },
    languages: { ko: "Korece" },
    onMyPlatforms: "Platformlarımda",
    hideWatched: "İzlediklerimi gizle",
    ratingChip: (n) => `★ ${n}+`,
  };

  test("etkin her süzgeç bir çip; türler tek tek; sıra FILTER_KEYS", () => {
    const f = normalizeFilters(
      { genres: [35, 10749], era: "d2010", minRating: 7, runtime: "short", language: "ko", onMyPlatforms: true, hideWatched: true },
      "movie",
    );
    expect(describeFilters(f, "movie", copy).map((c) => c.label)).toEqual([
      "Komedi",
      "Romantik",
      "2010'lar",
      "★ 7+",
      "90 dk'ya kadar",
      "Korece",
      "Platformlarımda",
      "İzlediklerimi gizle",
    ]);
    expect(describeFilters(DEFAULT_FILTERS, "movie", copy)).toEqual([]);
  });

  test("süre etiketi medya türüne göre (dizide bölüm süresi)", () => {
    expect(describeFilters({ runtime: "short" }, "tv", copy)[0].label).toBe("30 dk'ya kadar");
  });

  test("eksik etiket ham değere düşer, fırlatmaz", () => {
    expect(describeFilters({ era: "d2010" }, "movie", { eras: {} })[0].label).toBe("d2010");
  });

  test("kayıtlı ad: ilk üç çip, sınırı aşarsa kısaltılır, süzgeç yoksa yedek metin", () => {
    const f = normalizeFilters({ genres: [35, 10749], era: "d2010", minRating: 7 }, "movie");
    expect(presetNameFor(f, "movie", copy)).toBe("Komedi · Romantik · 2010'lar");
    const long = { ...copy, genres: { 35: "A".repeat(30), 10749: "B".repeat(30) } };
    const name = presetNameFor(f, "movie", long);
    expect(name.length).toBeLessThanOrEqual(MAX_PRESET_NAME);
    expect(name.endsWith("…")).toBe(true);
    expect(presetNameFor(DEFAULT_FILTERS, "movie", copy, "Filtre")).toBe("Filtre");
  });
});

describe("eşitlik", () => {
  test("sameFilters sıralamayı da kapsar", () => {
    expect(sameFilters({ genres: [35] }, { genres: [35], sort: "popular" }, "movie")).toBe(true);
    expect(sameFilters({ genres: [35] }, { genres: [35], sort: "rating" }, "movie")).toBe(false);
  });
});

describe("filtre ekranının açılış süzgeci", () => {
  const saved = [
    { id: "s1", name: "Kayıt", mediaType: "movie", filters: normalizeFilters({ genres: [28, 878], minRating: 7 }, "movie") },
  ];
  const last = { genres: [35], era: "d2010" };

  test("öncelik: hazır → kayıtlı → rota süzgeci → son kullanılan", () => {
    const ctx = { presets: saved, hasProviders: true, last };
    expect(resolveInitialFilters({ presetId: "quick" }, "movie", ctx)).toEqual(resolveQuickPreset("quick", "movie"));
    expect(resolveInitialFilters({ savedId: "s1" }, "movie", ctx)).toEqual(saved[0].filters);
    expect(resolveInitialFilters({ filters: { minRating: 8 } }, "movie", ctx).minRating).toBe(8);
    expect(resolveInitialFilters({}, "movie", ctx).genres).toEqual([35]);
    expect(resolveInitialFilters(undefined, "movie", {})).toEqual(DEFAULT_FILTERS);
  });

  test("bilinmeyen hazır / kayıtlı kimlik bir sonraki kaynağa düşer, fırlatmaz", () => {
    const ctx = { presets: saved, last };
    expect(resolveInitialFilters({ presetId: "yok" }, "movie", ctx).genres).toEqual([35]);
    expect(resolveInitialFilters({ savedId: "yok" }, "movie", ctx).genres).toEqual([35]);
  });

  test("Film kaydı Dizi ekranında eşlenerek açılır", () => {
    const tv = resolveInitialFilters({ savedId: "s1" }, "tv", { presets: saved });
    expect(tv.genres.sort((a, b) => a - b)).toEqual([10759, 10765]);
    expect(tv.minRating).toBe(7);
  });

  test("son kullanılan süzgeç hedef medya türüne göre normalize edilir (Dizi için geçersiz tür düşer)", () => {
    expect(resolveInitialFilters({}, "tv", { last: { genres: [28, 35] } }).genres).toEqual([35]);
  });

  test("platform durumu hazır süzgece yansır", () => {
    expect(resolveInitialFilters({ presetId: "tonight" }, "movie", { hasProviders: true }).onMyPlatforms).toBe(true);
    expect(resolveInitialFilters({ presetId: "tonight" }, "movie", { hasProviders: false }).onMyPlatforms).toBe(false);
  });
});
