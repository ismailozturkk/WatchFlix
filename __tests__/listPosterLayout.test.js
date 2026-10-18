// __tests__/listPosterLayout.test.js
// Liste poster ızgarasının ölçü kararları (utils/listPosterLayout): poster genişliği, basamaklar, rozet ölçeği,
// satır yüksekliği (getItemLayout), TMDB görsel boyutu, süre / ilerleme metinleri.

// tmdbImageUtils PixelRatio'yu react-native'den alır (cihaz piksel oranı 3 varsay).
jest.mock("react-native", () => ({ PixelRatio: { get: () => 3 } }));

const {
  POSTER_ASPECT,
  GRID_ROW_GAP,
  badgePlanOf,
  badgeScaleFor,
  durationBadgeText,
  imageWidthFor,
  initialRowsFor,
  posterHeightFor,
  posterKeyOf,
  posterWidthFor,
  rowHeightFor,
  tierOf,
  titleMetricsFor,
  watchProgressOf,
} = require("../utils/listPosterLayout");
const { getOptimalTmdbSize } = require("../utils/tmdbImageUtils");

describe("poster genişliği", () => {
  it("pencere genişliği ve sütun sayısından türer (kenar boşluğu + sabit boşluk)", () => {
    // 390 dp, 3 sütun: (390 - 24 - 16) / 3
    expect(posterWidthFor({ windowWidth: 390, columns: 3 })).toBeCloseTo(116.67, 1);
    expect(posterWidthFor({ windowWidth: 390, columns: 4 })).toBeCloseTo(85.5, 1);
  });

  it("dönünce / geniş ekranda yeniden hesaplanır; satır tam genişliği doldurur", () => {
    for (const windowWidth of [320, 390, 430, 768, 1024]) {
      for (const columns of [2, 3, 4, 5]) {
        const w = posterWidthFor({ windowWidth, columns });
        expect(w * columns + 8 * (columns - 1) + 24).toBeCloseTo(windowWidth, 5);
      }
    }
  });

  it("bozuk sütun / dar pencere güvenli", () => {
    expect(posterWidthFor({ windowWidth: 390, columns: "x" })).toBeCloseTo(116.67, 1); // 3'e düşer
    expect(posterWidthFor({ windowWidth: 390, columns: 99 })).toBeGreaterThanOrEqual(40);
    expect(posterWidthFor({ windowWidth: 0, columns: 3 })).toBe(40);
  });

  it("yükseklik 2:3 oranından", () => {
    expect(POSTER_ASPECT).toBe(1.5);
    expect(posterHeightFor(100)).toBe(150);
  });
});

describe("basamak, ölçek, başlık", () => {
  it("basamak sınırları", () => {
    expect(tierOf(60)).toBe("xs");
    expect(tierOf(75.9)).toBe("xs");
    expect(tierOf(76)).toBe("s");
    expect(tierOf(99.9)).toBe("s");
    expect(tierOf(100)).toBe("m");
    expect(tierOf(139.9)).toBe("m");
    expect(tierOf(140)).toBe("l");
  });

  it("rozet ölçeği PosterInfoBadges ile aynı: 110 dp = 1, [0.6, 1.1]", () => {
    expect(badgeScaleFor(110)).toBe(1);
    expect(badgeScaleFor(40)).toBe(0.6);
    expect(badgeScaleFor(400)).toBe(1.1);
    expect(badgeScaleFor(88)).toBeCloseTo(0.8, 5);
  });

  it("başlık puntosu poster büyüdükçe artar, satır yüksekliği puntodan büyük", () => {
    let last = 0;
    for (const w of [60, 90, 120, 170]) {
      const m = titleMetricsFor(w);
      expect(m.fontSize).toBeGreaterThan(last - 1);
      expect(m.lineHeight).toBeGreaterThan(m.fontSize);
      last = m.fontSize;
    }
  });
});

describe("satır yüksekliği / ilk çizim", () => {
  it("başlık açıkken poster + başlık bloğu + satır boşluğu", () => {
    const w = 100;
    const title = titleMetricsFor(w);
    expect(rowHeightFor({ posterWidth: w, showTitle: true })).toBeCloseTo(150 + title.marginTop + title.lineHeight + GRID_ROW_GAP, 5);
    expect(rowHeightFor({ posterWidth: w, showTitle: false })).toBeCloseTo(150 + GRID_ROW_GAP, 5);
  });

  it("ilk çizilecek satır sayısı ekrana göre, sınırlı", () => {
    expect(initialRowsFor({ windowHeight: 800, rowHeight: 200 })).toBe(6);
    expect(initialRowsFor({ windowHeight: 100, rowHeight: 300 })).toBe(4); // alt sınır
    expect(initialRowsFor({ windowHeight: 5000, rowHeight: 100 })).toBe(14); // üst sınır
    expect(initialRowsFor({ windowHeight: 0, rowHeight: 0 })).toBe(6);
  });
});

describe("TMDB görsel boyutu", () => {
  it("gerçek poster genişliği, eski sabit 200'den belirgin küçük bir boyut seçtirir", () => {
    // Cihaz piksel oranı 3 ("good"): 3'lü ızgarada 116 dp → 350 px hedef.
    const real = getOptimalTmdbSize("poster", imageWidthFor(116.67), "medium");
    const old = getOptimalTmdbSize("poster", 200, "medium");
    const order = ["w92", "w154", "w185", "w342", "w500", "w780", "original"];
    expect(order.indexOf(real)).toBeLessThanOrEqual(order.indexOf(old));
    // 4'lü ızgara daha küçük ya da eşit boyut ister.
    const four = getOptimalTmdbSize("poster", imageWidthFor(85.5), "medium");
    expect(order.indexOf(four)).toBeLessThanOrEqual(order.indexOf(real));
  });

  it("tam sayıya yuvarlar", () => {
    expect(imageWidthFor(116.67)).toBe(117);
  });
});

describe("süre ve ilerleme metinleri", () => {
  it("kısa, sabit biçim", () => {
    expect(durationBadgeText(45, "movie")).toBe("45 dk");
    expect(durationBadgeText(112, "movie")).toBe("1:52");
    expect(durationBadgeText(120, "movie")).toBe("2:00");
    expect(durationBadgeText(540, "tv")).toBe("9:00");
    expect(durationBadgeText(85 * 60 + 20, "tv")).toBe("85 sa");
    expect(durationBadgeText(0, "movie")).toBeNull();
    expect(durationBadgeText("x", "tv")).toBeNull();
    expect(durationBadgeText(90, "movie", { hour: "h", minute: "min" })).toBe("1:30");
    expect(durationBadgeText(30, "movie", { hour: "h", minute: "min" })).toBe("30 min");
  });

  it("dizi ilerlemesi: oran, bitti, metin; toplam bilinmiyorsa yok", () => {
    expect(watchProgressOf(12, 24)).toEqual({ ratio: 0.5, complete: false, label: "12/24" });
    expect(watchProgressOf(24, 24)).toEqual({ ratio: 1, complete: true, label: "24/24" });
    expect(watchProgressOf(30, 24)).toEqual({ ratio: 1, complete: true, label: "24/24" }); // fazla kayıt taşırmaz
    expect(watchProgressOf(0, 10).ratio).toBe(0);
    expect(watchProgressOf(5, 0)).toBeNull();
    expect(watchProgressOf(5, undefined)).toBeNull();
  });
});

describe("rozet planı", () => {
  const info = { mediaType: true, duration: true };
  it("küçük posterde tür yalnız simge, büyükte yazı da; ilerleme yazısı m ve l'de", () => {
    const small = badgePlanOf({ info, posterWidth: 70, type: "movie", durationMinutes: 112 });
    expect(small).toMatchObject({ tier: "xs", showType: true, typeLabel: false, durationText: "1:52", progressText: false });
    const big = badgePlanOf({ info, posterWidth: 120, type: "tv", durationMinutes: 600, progress: watchProgressOf(3, 6) });
    expect(big).toMatchObject({ tier: "m", typeLabel: true, showProgress: true, progressText: true });
  });

  it("ayar kapalı / süre yok → rozet yok", () => {
    expect(badgePlanOf({ info: { mediaType: false, duration: false }, posterWidth: 120, type: "movie", durationMinutes: 90 })).toMatchObject({
      showType: false,
      durationText: null,
    });
    expect(badgePlanOf({ info, posterWidth: 120, type: "movie", durationMinutes: 0 }).durationText).toBeNull();
    expect(badgePlanOf({ posterWidth: 120, type: "movie" }).showProgress).toBe(false);
  });

  it("film ve dizi AYNI id'yi paylaşsa da anahtarlar farklı", () => {
    expect(posterKeyOf({ id: 5, type: "movie" })).not.toBe(posterKeyOf({ id: 5, type: "tv" }));
  });
});
