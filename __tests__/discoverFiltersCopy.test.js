// __tests__/discoverFiltersCopy.test.js
//
// "Ne izlesem?" metinleri: çekirdekteki HER seçeneğin üç dilde etiketi var mı (ham kimlik ekranda
// görünmesin) ve yer tutucular tutarlı mı. Dil dengesi ayrıca copyTablesSpanish.test.js'te.

const {
  DISCOVER_FILTERS_COPY,
  describeCopyOf,
  fillCopy,
  getDiscoverFiltersCopy,
} = require("../screens/shared/discoverFiltersCopy");
const {
  ERAS,
  GENRES,
  LANGUAGES,
  QUICK_PRESETS,
  RATINGS,
  RUNTIMES,
  SORTS,
  describeFilters,
  normalizeFilters,
} = require("../utils/discoverFilters");

const DILLER = ["tr", "en", "es"];
const doluMetin = (v) => typeof v === "string" && v.trim().length > 0;

describe.each(DILLER)("%s", (dil) => {
  const copy = DISCOVER_FILTERS_COPY[dil];

  test("her tür kimliğinin (film + dizi) etiketi var", () => {
    const hepsi = new Set([...GENRES.movie, ...GENRES.tv]);
    for (const id of hepsi) expect(doluMetin(copy.genres[id])).toBe(true);
    // kopya tablosunda çekirdekte olmayan tür kalmamış
    for (const id of Object.keys(copy.genres)) expect(hepsi.has(Number(id))).toBe(true);
  });

  test("dönem, dil, sıralama etiketleri çekirdekle BİREBİR", () => {
    expect(Object.keys(copy.eras).sort()).toEqual([...ERAS].sort());
    expect(Object.keys(copy.languages).sort()).toEqual([...LANGUAGES].sort());
    expect(Object.keys(copy.sorts).sort()).toEqual([...SORTS].sort());
  });

  test("süre etiketleri film ve dizi için ayrı ve tüm bantları kapsar", () => {
    for (const type of ["movie", "tv"]) {
      expect(Object.keys(copy.runtimes[type]).sort()).toEqual([...RUNTIMES].sort());
    }
    // dizide bölüm süresi: aynı bant film etiketiyle AYNI olamaz
    for (const band of RUNTIMES.filter((b) => b !== "any")) {
      expect(copy.runtimes.tv[band]).not.toBe(copy.runtimes.movie[band]);
    }
  });

  test("her hazır süzgecin [ad, açıklama] çifti var", () => {
    expect(Object.keys(copy.presets).sort()).toEqual(QUICK_PRESETS.map((p) => p.id).sort());
    for (const preset of Object.values(copy.presets)) {
      expect(preset).toHaveLength(2);
      preset.forEach((metin) => expect(doluMetin(metin)).toBe(true));
    }
  });

  test("tüm arayüz metinleri dolu; yer tutucular çözülür", () => {
    for (const [anahtar, metin] of Object.entries(copy.ui)) expect([anahtar, doluMetin(metin)]).toEqual([anahtar, true]);
    expect(fillCopy(copy.ui.filtersCount, { n: 3 })).toContain("3");
    expect(fillCopy(copy.ui.filtersCount, { n: 3 })).not.toMatch(/\{/);
    expect(fillCopy(copy.ui.genreHint, { n: 4 })).toContain("4");
    expect(fillCopy(copy.ui.removeFilter, { name: "X" })).toContain("X");
    expect(fillCopy(copy.ui.ratingChip, { n: 7 })).toContain("7");
    expect(fillCopy(copy.ui.ratingOption, { n: 7 })).toContain("7");
  });

  test("describeFilters gerçek tabloyla çalışır: hiçbir çip ham kimlik göstermez", () => {
    const f = normalizeFilters(
      { genres: [35], era: "d2010", minRating: 7, runtime: "short", language: "ko", onMyPlatforms: true, hideWatched: true },
      "movie",
    );
    const chips = describeFilters(f, "movie", describeCopyOf(copy));
    expect(chips).toHaveLength(7);
    for (const chip of chips) {
      expect(doluMetin(chip.label)).toBe(true);
      expect(chip.label).not.toMatch(/^(d2010|short|ko|35)$/);
    }
    expect(chips.find((c) => c.key === "minRating").label).toContain("7");
  });
});

test("bilinmeyen dil İngilizceye düşer; bilinen diller kendi tablosunu alır", () => {
  expect(getDiscoverFiltersCopy("xx")).toBe(DISCOVER_FILTERS_COPY.en);
  for (const dil of DILLER) expect(getDiscoverFiltersCopy(dil)).toBe(DISCOVER_FILTERS_COPY[dil]);
});

test("puan seçenekleri: 0 = hepsi, kalanı 1..10 arası", () => {
  expect(RATINGS[0]).toBe(0);
  expect(RATINGS.slice(1).every((n) => n > 0 && n <= 10)).toBe(true);
});

test("fillCopy bilinmeyen yer tutucuyu olduğu gibi bırakır", () => {
  expect(fillCopy("a {n} b {x}", { n: 1 })).toBe("a 1 b {x}");
});
