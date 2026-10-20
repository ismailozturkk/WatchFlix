// __tests__/wrappedCard.test.js
//
// Wrapped paylaşım kartının saf mantığı: seçenek doğrulama, palet kimlikleri,
// poster seçimi, yıl ısı haritası, bilet numarası/barkodu ve yeni recap alanları
// (gün ısısı, haftanın günü, kişilik açıklaması).

import {
  DEFAULT_WRAPPED_CARD_OPTIONS,
  WRAPPED_CAPTION_MAX,
  WRAPPED_CARD_BACKGROUND_IDS,
  WRAPPED_CARD_LAYOUT_IDS,
  WRAPPED_CARD_THEME_IDS,
  WRAPPED_LAYOUT_MODULES,
  WRAPPED_PALETTES,
  WRAPPED_POSTER_COUNT,
  WRAPPED_SHARED_PALETTES,
  buildWrappedCardPosters,
  buildYearHeat,
  cleanWrappedCaption,
  heatLevel,
  layoutSupportsModule,
  persistableWrappedCardOptions,
  pickWrappedPosters,
  resolveWrappedPalette,
  sanitizeWrappedCardOptions,
  splitWatchTime,
  wrappedBarcode,
  wrappedModuleAvailability,
  wrappedSerial,
} from "../utils/wrappedCard";
import { STORY_THEME_IDS, WRAPPED_THEME_IDS } from "../utils/profileStoryCard";
import { buildYearlyRecap, daysInYear, getPersonality, weekdayName } from "../utils/wrapped";
import { getWrappedStrings } from "../utils/wrappedStrings";

const movie = (dateAdded, minutes = 100, extra = {}) => ({
  id: `m-${dateAdded}-${minutes}`,
  type: "movie",
  name: `Film ${dateAdded}`,
  imagePath: "/p.jpg",
  dateAdded,
  minutes,
  ...extra,
});
const ep = (episodeWatchTime, showId, episodeMinutes = 40, extra = {}) => ({
  id: `${showId}_${episodeWatchTime}_${episodeMinutes}`,
  showId,
  showName: `Dizi ${showId}`,
  showImage: `/s${showId}.jpg`,
  episodeWatchTime,
  episodeMinutes,
  ...extra,
});

describe("paletler", () => {
  test("ilk altısı profil hikâye kartıyla birebir aynı", () => {
    expect(WRAPPED_PALETTES.slice(0, 6).map((p) => p.id)).toEqual([...WRAPPED_THEME_IDS]);
    expect(WRAPPED_SHARED_PALETTES.map((p) => p.id)).toEqual([...WRAPPED_THEME_IDS]);
    expect(STORY_THEME_IDS.slice(0, 6)).toEqual(WRAPPED_CARD_THEME_IDS.slice(0, 6));
  });

  test("kimlikler tekil, her palet 4 renk ve yazı rengi taşır", () => {
    expect(new Set(WRAPPED_CARD_THEME_IDS).size).toBe(WRAPPED_PALETTES.length);
    for (const p of WRAPPED_PALETTES) {
      expect(p.colors).toHaveLength(4);
      expect(p.onAccent).toMatch(/^#[0-9A-F]{6}$/i);
      expect(["dark", "light"]).toContain(p.tone);
    }
  });

  test("tam bir açık palet var (kart yazı rengini ona göre seçer)", () => {
    expect(WRAPPED_PALETTES.filter((p) => p.tone === "light").map((p) => p.id)).toEqual(["paper"]);
  });

  test("signature kullanıcının vurgusunu alır, diğerleri sabit kalır", () => {
    expect(resolveWrappedPalette("signature", "#112233").accent).toBe("#112233");
    expect(resolveWrappedPalette("signature").accent).toBe("#A78BFA");
    expect(resolveWrappedPalette("sunset", "#112233").accent).toBe("#FF8A3D");
    expect(resolveWrappedPalette("yok", "#112233").id).toBe("signature");
  });

  test("palet etiket anahtarları TR/EN sözlükte var", () => {
    for (const lang of ["tr", "en"]) {
      const str = getWrappedStrings(lang);
      for (const p of WRAPPED_PALETTES) expect(typeof str[p.labelKey]).toBe("string");
    }
  });
});

describe("sanitizeWrappedCardOptions", () => {
  test("boş/bozuk girdi varsayılana döner", () => {
    for (const bad of [undefined, null, 5, "x", [], {}]) {
      expect(sanitizeWrappedCardOptions(bad)).toEqual(DEFAULT_WRAPPED_CARD_OPTIONS);
    }
  });

  test("geçersiz değerler varsayılana düşer, geçerliler korunur", () => {
    const out = sanitizeWrappedCardOptions({
      layout: "ticket",
      themeId: "yok",
      background: "poster",
      posterContent: "movies",
      showStats: false,
      showGenres: "evet",
      bilinmeyen: 1,
    });
    expect(out.layout).toBe("ticket");
    expect(out.themeId).toBe(DEFAULT_WRAPPED_CARD_OPTIONS.themeId);
    expect(out.background).toBe("poster");
    expect(out.posterContent).toBe("movies");
    expect(out.showStats).toBe(false);
    expect(out.showGenres).toBe(true);
    expect(out).not.toHaveProperty("bilinmeyen");
  });

  test("eski kayıtta olmayan anahtarlar varsayılanı (açık) alır", () => {
    const out = sanitizeWrappedCardOptions({ layout: "minimal" });
    expect(out.showActivity).toBe(true);
    expect(out.showPosters).toBe(true);
  });

  test("not: boşluklar sadeleşir, sınır uygulanır, emoji ortadan kesilmez", () => {
    expect(cleanWrappedCaption("  merhaba \n\n dünya  ")).toBe("merhaba dünya");
    expect(cleanWrappedCaption(42)).toBe("");
    const long = cleanWrappedCaption("a".repeat(200));
    expect(Array.from(long)).toHaveLength(WRAPPED_CAPTION_MAX);
    const emoji = cleanWrappedCaption("🎬".repeat(100));
    expect(Array.from(emoji)).toHaveLength(WRAPPED_CAPTION_MAX);
    expect(emoji).not.toMatch(/[\uD800-\uDBFF]$/); // yarım vekil çift yok
  });

  test("diske not yazılmaz (her paylaşıma özel)", () => {
    const stored = persistableWrappedCardOptions({ layout: "posters", caption: "gizli" });
    expect(stored).not.toHaveProperty("caption");
    expect(stored.layout).toBe("posters");
  });

  test("düzen/arka plan listeleri ve bölüm tablosu tutarlı", () => {
    expect(WRAPPED_CARD_LAYOUT_IDS).toEqual(["showcase", "posters", "ticket", "minimal"]);
    expect(WRAPPED_CARD_BACKGROUND_IDS).toEqual(["glow", "clean", "poster"]);
    for (const id of WRAPPED_CARD_LAYOUT_IDS) {
      expect(WRAPPED_LAYOUT_MODULES[id]).toBeDefined();
      expect(WRAPPED_POSTER_COUNT[id]).toBeGreaterThan(0);
    }
    expect(layoutSupportsModule("posters", "showActivity")).toBe(false);
    expect(layoutSupportsModule("showcase", "showActivity")).toBe(true);
    expect(layoutSupportsModule("bilinmiyor", "showStats")).toBe(true);
  });
});

describe("pickWrappedPosters", () => {
  const recap = {
    topShows: [
      { showId: 1, showName: "A", showImage: "/a.jpg", episodeCount: 12 },
      { showId: 2, showName: "B", showImage: null, episodeCount: 5 },
    ],
    moviePosters: [{ id: 9, name: "F", imagePath: "/f.jpg", minutes: 130 }],
  };

  test("istenen içerik varsa yalnız onu verir, eksik yuvayı doldurmaz", () => {
    const pick = pickWrappedPosters(recap, "shows", 3);
    expect(pick.source).toBe("shows");
    expect(pick.items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  test("istenen içerik boşsa diğerine düşer ve kaynağı bildirir", () => {
    expect(pickWrappedPosters({ moviePosters: recap.moviePosters }, "shows", 3).source).toBe("movies");
    expect(pickWrappedPosters({ topShows: recap.topShows }, "movies", 3).source).toBe("shows");
    expect(pickWrappedPosters({}, "shows", 3)).toEqual({ source: null, items: [] });
  });

  test("buildWrappedCardPosters: kapalıysa poster yok, arka plan posteri ayrı gelir", () => {
    const getUri = (path, kind) => `u:${kind}:${path}`;
    const on = buildWrappedCardPosters(recap, { ...DEFAULT_WRAPPED_CARD_OPTIONS, background: "poster" }, getUri);
    expect(on.items.map((i) => i.uri)).toEqual(["u:poster:/a.jpg", null]);
    expect(on.bgUri).toBe("u:backdrop:/a.jpg");
    expect(on.uris).toEqual(["u:poster:/a.jpg", "u:backdrop:/a.jpg"]);

    const off = buildWrappedCardPosters(recap, { ...DEFAULT_WRAPPED_CARD_OPTIONS, showPosters: false }, getUri);
    expect(off.items).toEqual([]);
    expect(off.bgUri).toBeNull();
    expect(off.uris).toEqual([]);
  });

  test("düzen poster sayısını sınırlar", () => {
    const many = {
      topShows: Array.from({ length: 5 }, (_, i) => ({ showId: i, showName: `S${i}`, showImage: `/s${i}`, episodeCount: 1 })),
    };
    const showcase = buildWrappedCardPosters(many, { ...DEFAULT_WRAPPED_CARD_OPTIONS, layout: "showcase" }, () => "u");
    const wall = buildWrappedCardPosters(many, { ...DEFAULT_WRAPPED_CARD_OPTIONS, layout: "posters" }, () => "u");
    expect(showcase.items).toHaveLength(WRAPPED_POSTER_COUNT.showcase);
    expect(wall.items).toHaveLength(WRAPPED_POSTER_COUNT.posters);
  });
});

describe("wrappedModuleAvailability", () => {
  test("verisi olmayan bölüm pasif görünür", () => {
    const a = wrappedModuleAvailability({ topGenres: [], personality: null, activeDays: 0 });
    expect(a.showGenres).toBe(false);
    expect(a.showPersonality).toBe(false);
    expect(a.showPosters).toBe(false);
    expect(a.showActivity).toBe(false);
    expect(a.showName).toBe(false);
  });

  test("eski arşivde ısı haritası verisi yoksa etkinlik bölümü pasif", () => {
    expect(wrappedModuleAvailability({ activeDays: 40 }).showActivity).toBe(false);
    expect(wrappedModuleAvailability({ activeDays: 40, dayHeat: [0, 1] }).showActivity).toBe(true);
    expect(wrappedModuleAvailability({}, { hasUserName: true }).showName).toBe(true);
  });
});

describe("yıl ısı haritası", () => {
  test("heatLevel: boş gün 0, en yoğun gün 4, tek tük de renk görür", () => {
    expect(heatLevel(0, 5)).toBe(0);
    expect(heatLevel(5, 5)).toBe(4);
    expect(heatLevel(1, 5)).toBe(1);
    expect(heatLevel(1, 1)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });

  test("buildYearHeat: Pazartesi başlangıçlı ızgara, sütun/satır doğru", () => {
    // 1 Ocak 2024 Pazartesi → ilk hücre (0,0)
    const heat = buildYearHeat(2024, new Array(366).fill(0));
    expect(heat.cells[0]).toMatchObject({ col: 0, row: 0 });
    expect(heat.cells[6]).toMatchObject({ col: 0, row: 6 });
    expect(heat.cells[7]).toMatchObject({ col: 1, row: 0 });
    expect(heat.cols).toBe(53);

    // 1 Ocak 2023 Pazar → satır 6
    const sunday = buildYearHeat(2023, new Array(365).fill(0));
    expect(sunday.cells[0]).toMatchObject({ col: 0, row: 6 });
    expect(sunday.cells[1]).toMatchObject({ col: 1, row: 0 });
  });

  test("ay başlangıç sütunları artan sırada ve ızgaranın içinde", () => {
    const heat = buildYearHeat(2025, new Array(365).fill(0));
    expect(heat.monthCols).toHaveLength(12);
    expect(heat.monthCols[0]).toBe(0);
    for (let i = 1; i < 12; i += 1) expect(heat.monthCols[i]).toBeGreaterThanOrEqual(heat.monthCols[i - 1]);
    expect(heat.monthCols[11]).toBeLessThan(heat.cols);
  });

  test("bozuk girdide patlamaz", () => {
    expect(buildYearHeat(2025, undefined).cells).toEqual([]);
    expect(buildYearHeat(2025, null).cols).toBe(1);
  });
});

describe("hero rakamları, bilet", () => {
  test("splitWatchTime gün/saat ayrımı", () => {
    expect(splitWatchTime(0)).toEqual({ minutes: 0, hours: 0, days: 0, remHours: 0 });
    expect(splitWatchTime(60 * 25 + 7)).toEqual({ minutes: 1507, hours: 25, days: 1, remHours: 1 });
    expect(splitWatchTime(-5).minutes).toBe(0);
    expect(splitWatchTime("abc").hours).toBe(0);
  });

  test("seri no ve barkod aynı özet için kararlı, farklı özet için farklı", () => {
    const a = { year: 2025, totalMinutes: 1234, totalMovies: 4, totalEpisodes: 9 };
    const b = { ...a, totalMinutes: 1235 };
    expect(wrappedSerial(a)).toBe(wrappedSerial({ ...a }));
    expect(wrappedSerial(a)).not.toBe(wrappedSerial(b));
    expect(wrappedSerial(a)).toMatch(/^\d{4}-\d{4}$/);
    expect(wrappedBarcode(a)).toEqual(wrappedBarcode({ ...a }));
    expect(wrappedBarcode(a, 20)).toHaveLength(20);
    expect(wrappedBarcode(a).every((w) => w >= 1 && w <= 3)).toBe(true);
  });
});

describe("buildYearlyRecap: yeni alanlar", () => {
  const recap = buildYearlyRecap({
    movies: [movie("2024-01-01", 100), movie("2024-12-31", 90)],
    episodes: [ep("2024-03-02", 1), ep("2024-03-02", 2), ep("2024-03-09", 1)],
    year: 2024,
    language: "tr",
  });

  test("dayHeat yılın gün sayısı kadar, toplamı öğe sayısı", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
    expect(recap.dayHeat).toHaveLength(366);
    expect(recap.dayHeat.reduce((a, b) => a + b, 0)).toBe(5);
    expect(recap.dayHeat[0]).toBe(1); // 1 Ocak
    expect(recap.dayHeat[365]).toBe(1); // 31 Aralık (artık yıl)
    expect(recap.dayHeat[31 + 29 + 1]).toBe(2); // 2 Mart
  });

  test("haftanın günü sayacı ve favori gün", () => {
    expect(recap.weekdayCounts).toHaveLength(7);
    expect(recap.weekdayCounts.reduce((a, b) => a + b, 0)).toBe(5);
    // 2024-03-02 ve 2024-03-09 Cumartesi (5)
    expect(recap.weekdayCounts[5]).toBe(3);
    expect(recap.favoriteWeekday).toBe(5);
    expect(weekdayName(5, "en")).toBe("Saturday");
    expect(weekdayName(0, "en")).toBe("Monday");
  });

  test("veri yoksa favori gün null, ısı haritası sıfır", () => {
    const empty = buildYearlyRecap({ year: 2025 });
    expect(empty.favoriteWeekday).toBeNull();
    expect(empty.dayHeat.every((v) => v === 0)).toBe(true);
  });

  test("ısı haritası aktif gün sayısıyla tutarlı", () => {
    expect(recap.dayHeat.filter((v) => v > 0).length).toBe(recap.activeDays);
  });

  test("kişilik açıklaması her dilde dolu", () => {
    for (const lang of ["tr", "en"]) {
      for (const genre of ["Komedi", "Korku", "Gerilim", "Aksiyon", "Bilim Kurgu", "Dram", "Romantik", "Animasyon", "Belgesel", "Suç", "xyz", ""]) {
        const p = getPersonality(genre, lang);
        expect(p.title).toBeTruthy();
        expect(p.desc).toBeTruthy();
        expect(p.emoji).toBeTruthy();
      }
    }
  });
});
