// __tests__/worldTour.test.js
//
// "Dünya Turu" rafının saf mantığı (utils/worldTour): çip listesi, dil çözümü, /discover parametreleri.
// Raf bileşeninin davranışı (çip → yeniden yükleme, eski sonucun ezilmemesi) discoveryRailSettings.test.js'te.

const {
  WORLD_TOUR_DEFAULT,
  WORLD_TOUR_LANGUAGES,
  isWorldTourLanguage,
  normalizeWorldTourLanguage,
  worldTourChipLabel,
  worldTourDiscoverParams,
  worldTourEmptyText,
  worldTourName,
  worldTourSeeAllTitle,
  worldTourTitle,
} = require("../utils/worldTour");
const { APP_LANGUAGES } = require("../utils/appLanguages");
const { HOME_SECTIONS, getSectionMeta } = require("../utils/homeSectionCopy");

const DILLER = APP_LANGUAGES.map((entry) => entry.code);

describe("çip listesi", () => {
  test("kodlar benzersiz, iki harfli ve bayrak emojisi dolu", () => {
    const kodlar = WORLD_TOUR_LANGUAGES.map((entry) => entry.code);
    expect(new Set(kodlar).size).toBe(kodlar.length);
    for (const entry of WORLD_TOUR_LANGUAGES) {
      expect(entry.code).toMatch(/^[a-z]{2}$/);
      expect(entry.flag.length).toBeGreaterThan(0);
    }
  });

  test("ana liste dili (İngilizce) çiplerde YOK", () => {
    expect(isWorldTourLanguage("en")).toBe(false);
  });

  test("her çip, uygulamanın desteklediği HER dilde adlandırılmış", () => {
    for (const entry of WORLD_TOUR_LANGUAGES) {
      for (const dil of DILLER) {
        const ad = worldTourName(entry.code, dil);
        expect(typeof ad).toBe("string");
        expect(ad.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("ilk giriş varsayılan ve listede", () => {
    expect(WORLD_TOUR_DEFAULT).toBe(WORLD_TOUR_LANGUAGES[0].code);
    expect(isWorldTourLanguage(WORLD_TOUR_DEFAULT)).toBe(true);
  });

  test("liste dondurulmuş (ekran yanlışlıkla değiştiremez)", () => {
    expect(Object.isFrozen(WORLD_TOUR_LANGUAGES)).toBe(true);
  });
});

describe("dil çözümü", () => {
  test("bilinmeyen/boş/null kod varsayılana düşer (ağa çıplak gitmesin)", () => {
    for (const girdi of ["xx", "", null, undefined, "KO", "ko-KR", 5]) {
      expect(normalizeWorldTourLanguage(girdi)).toBe(WORLD_TOUR_DEFAULT);
    }
    expect(normalizeWorldTourLanguage("ja")).toBe("ja");
  });

  test("çip etiketi bayrak + uygulama diline göre ad", () => {
    expect(worldTourChipLabel("ko", "tr")).toBe("🇰🇷 Korece");
    expect(worldTourChipLabel("ko", "en")).toBe("🇰🇷 Korean");
    expect(worldTourChipLabel("de", "de")).toBe("🇩🇪 Deutsch");
    expect(worldTourChipLabel("ja", "es")).toBe("🇯🇵 Japonés");
    expect(worldTourChipLabel("fr", "pt")).toBe("🇫🇷 Francês");
  });

  test("bilinmeyen uygulama dili İngilizceye düşer", () => {
    expect(worldTourName("ko", "fr")).toBe("Korean");
    expect(worldTourTitle("fr")).toBe("World Tour");
  });

  test("başlık ve boş durum metni her dilde dolu; Tümü başlığı dil adını taşır", () => {
    for (const dil of DILLER) {
      expect(worldTourTitle(dil).trim().length).toBeGreaterThan(0);
      expect(worldTourEmptyText(dil).trim().length).toBeGreaterThan(0);
    }
    expect(worldTourSeeAllTitle("ja", "tr")).toBe("Dünya Turu · Japonca");
    expect(worldTourSeeAllTitle("ja", "de")).toBe("Weltreise · Japanisch");
  });
});

describe("/discover parametreleri", () => {
  test("özgün dil, popülerlik sırası ve iki eşik", () => {
    expect(worldTourDiscoverParams("ja")).toEqual({
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "vote_count.gte": 150,
      "vote_average.gte": 6.5,
    });
  });

  test("bilinmeyen kod varsayılan dile çevrilir", () => {
    expect(worldTourDiscoverParams("zz").with_original_language).toBe(WORLD_TOUR_DEFAULT);
  });
});

describe("raf kimliği (homeSectionCopy)", () => {
  test("worldTour tabloda; eski gizli cevher kimliği kalmadı", () => {
    expect(HOME_SECTIONS.worldTour).toBeDefined();
    expect(HOME_SECTIONS.hiddenGems).toBeUndefined();
  });

  test("alt başlık türe göre farklı: film / dizi", () => {
    const film = getSectionMeta("worldTour", "tr", "movie").subtitle;
    const dizi = getSectionMeta("worldTour", "tr", "tv").subtitle;
    expect(film).toContain("filmler");
    expect(dizi).toContain("diziler");
    expect(film).not.toBe(dizi);
  });
});
