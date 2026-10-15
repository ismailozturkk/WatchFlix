// __tests__/storyCanvasLayout.test.js
// Story tasarım ekranının ölçü matematiği: küçük/büyük telefonda tuval alt
// çubuğa taşmaz, içerik üst üste binmez, sayfa ve klavye yerleşimi tutarlı.

const {
  STORY_REF_W,
  fitStoryCanvas,
  storyScale,
  planStorySheet,
  liftSheetForKeyboard,
  stackBlocksVertically,
  storyTitleSize,
  planStoryActionBar,
  storyDraftGrid,
} = require("../utils/storyCanvasLayout");

// Gerçekçi cihaz profilleri: [ad, pencere genişliği, alan (header-alt çubuk arası) yüksekliği]
const DEVICES = [
  ["küçük Android 360x640", 360, 640 - 82 - 137],
  ["iPhone SE 375x667", 375, 667 - 70 - 99],
  ["iPhone 15 393x852", 393, 852 - 125 - 123],
  ["Pixel büyük 412x915", 412, 915 - 82 - 137],
  ["Max 430x932", 430, 932 - 125 - 123],
  ["Katlanır/tablet 768x1024", 768, 1024 - 100 - 99],
];

describe("fitStoryCanvas", () => {
  test.each(DEVICES)("%s: 9:16 oranı korunur ve alana sığar", (_n, w, areaH) => {
    const c = fitStoryCanvas(w, areaH);
    expect(Math.abs(c.h / c.w - 16 / 9)).toBeLessThan(0.02);
    expect(c.w).toBeLessThanOrEqual(w - 32);
    // topGap 16 + bottomGap 12 payı içinde kalır → alt çubuğa taşmaz
    expect(c.h).toBeLessThanOrEqual(areaH - 16 - 12);
  });

  test("geniş-kısa alanda yükseklik kısıtlar, dar-uzun alanda genişlik", () => {
    const tall = fitStoryCanvas(360, 2000);
    expect(tall.w).toBe(360 - 32);
    const short = fitStoryCanvas(900, 600);
    expect(short.h).toBeLessThanOrEqual(600 - 28);
    expect(short.w).toBeLessThan(900 - 32);
  });

  test("bozuk/sıfır alanda bile çökmez, en az minW döner", () => {
    const c = fitStoryCanvas(0, 0);
    expect(c.w).toBe(120);
    expect(c.h).toBeGreaterThan(0);
  });
});

describe("storyScale", () => {
  test("referans genişlikte 1, uçlarda sınırlanır", () => {
    expect(storyScale(STORY_REF_W)).toBe(1);
    expect(storyScale(10)).toBe(0.6);
    expect(storyScale(5000)).toBe(1.5);
  });

  test("küçük telefon < 1 < büyük telefon", () => {
    expect(storyScale(250)).toBeLessThan(1);
    expect(storyScale(400)).toBeGreaterThan(1);
  });
});

describe("planStorySheet", () => {
  test("uzun ekranda tercih edilen 0.5 oranı korunur", () => {
    const canvasH = 640;
    const p = planStorySheet({ areaY: 125, topGap: 16, canvasH, containerH: 852 });
    expect(p.shrink).toBe(0.5);
    expect(p.sheetH).toBeGreaterThanOrEqual(320);
    expect(p.sheetTop + p.sheetH).toBe(852);
  });

  test("kısa ekranda tuval daha çok küçülür, sayfa en az 320px kalır", () => {
    const { h: canvasH } = fitStoryCanvas(360, 640 - 82 - 137);
    const p = planStorySheet({ areaY: 82, topGap: 16, canvasH, containerH: 640 });
    expect(p.sheetH).toBeGreaterThanOrEqual(320);
    // canvas küçülmesi alt sınırın (0.3) altına inmez
    expect(p.shrink).toBeGreaterThanOrEqual(0.3);
  });

  test("küçülen tuval sayfanın altına girmez (sayfa üstü ≥ küçük tuval altı)", () => {
    for (const [, w, areaH] of DEVICES) {
      const { h: canvasH } = fitStoryCanvas(w, areaH);
      const containerH = areaH + 82 + 137;
      const p = planStorySheet({ areaY: 82, topGap: 16, canvasH, containerH });
      const canvasBottom = 82 + 16 + canvasH * p.shrink;
      expect(p.sheetTop).toBeGreaterThanOrEqual(canvasBottom);
    }
  });
});

describe("liftSheetForKeyboard", () => {
  test("klavye yokken (görünür = tüm yükseklik) sayfa yerinde kalır", () => {
    const r = liftSheetForKeyboard({ sheetTop: 330, containerH: 852, visibleH: 852 });
    expect(r).toEqual({ top: 330, bottom: 0 });
  });

  test("klavye sayfayı örtecekse sayfa yukarı çıkar, altı klavyeye dayanır", () => {
    // 852 yüksek ekran, klavye 336px → görünür 516; sayfa üstü 330 → 186px kalır
    const r = liftSheetForKeyboard({ sheetTop: 330, containerH: 852, visibleH: 516 });
    expect(r.bottom).toBe(336);
    expect(516 - r.top).toBeGreaterThanOrEqual(300);
    expect(r.top).toBeLessThan(330);
  });

  test("zaten yeterli yer varsa sayfa aşağıdaki konumunu korur", () => {
    const r = liftSheetForKeyboard({ sheetTop: 200, containerH: 852, visibleH: 600 });
    expect(r.top).toBe(200);
  });

  test("sayfa hiçbir zaman minTop'un üstüne çıkmaz", () => {
    const r = liftSheetForKeyboard({
      sheetTop: 330,
      containerH: 600,
      visibleH: 250,
      minTop: 100,
    });
    expect(r.top).toBeGreaterThanOrEqual(100);
  });
});

describe("stackBlocksVertically", () => {
  const gap = 10;
  const overlaps = (items, tops, resized = {}) => {
    for (let i = 0; i < items.length - 1; i++) {
      const bottom = tops[items[i].id] + (resized[items[i].id] ?? items[i].h);
      if (bottom > tops[items[i + 1].id] + 0.001) return true;
    }
    return false;
  };

  test("bloklar üst üste binmez ve boşluk bırakılır", () => {
    const items = [
      { id: "poster", h: 230, flex: true },
      { id: "title", h: 70 },
      { id: "sub", h: 22 },
      { id: "rate", h: 28 },
    ];
    const { tops } = stackBlocksVertically(items, 640, {
      gap,
      marginTop: 45,
      marginBottom: 60,
    });
    expect(overlaps(items, tops)).toBe(false);
    expect(tops.title - (tops.poster + 230)).toBeCloseTo(gap, 5);
  });

  test("yığın dikeyde ortalanır; bias 0.4 → ortadan biraz yukarıda", () => {
    const items = [{ id: "a", h: 100 }];
    const { tops } = stackBlocksVertically(items, 500, {
      gap,
      marginTop: 50,
      marginBottom: 50,
      bias: 0.4,
    });
    // avail 400, total 100 → spare 300 → 50 + 300*0.4
    expect(tops.a).toBeCloseTo(170, 5);
  });

  test("sığmayınca yalnız flex (poster) küçülür, diğerleri korunur", () => {
    const items = [
      { id: "poster", h: 300, flex: true },
      { id: "title", h: 120 },
      { id: "sub", h: 40 },
    ];
    const { tops, resized, total } = stackBlocksVertically(items, 400, {
      gap,
      marginTop: 20,
      marginBottom: 20,
      minFlexH: 60,
    });
    expect(resized.poster).toBeLessThan(300);
    expect(resized.poster).toBeGreaterThanOrEqual(60);
    expect(resized.title).toBeUndefined();
    expect(overlaps(items, tops, resized)).toBe(false);
    // yeniden hesaplanan toplam kullanılabilir alanı aşmaz
    expect(total).toBeLessThanOrEqual(400 - 40 + 0.001);
  });

  test("poster yoksa yalnız yazılar dizilir", () => {
    const items = [
      { id: "title", h: 60 },
      { id: "sub", h: 20 },
    ];
    const { tops, resized } = stackBlocksVertically(items, 500, {
      gap,
      marginTop: 30,
      marginBottom: 60,
    });
    expect(resized).toEqual({});
    expect(overlaps(items, tops)).toBe(false);
  });

  test("küçük ve büyük tuvalde aynı oranlı yerleşim (yüksekliklerle ölçeklenir)", () => {
    // Her şey k ile ölçeklenince y oranları aynı kalmalı (cihazdan bağımsız).
    const build = (k) => {
      const items = [
        { id: "poster", h: 230 * k, flex: true },
        { id: "title", h: 70 * k },
        { id: "sub", h: 22 * k },
      ];
      const H = 640 * k;
      const { tops } = stackBlocksVertically(items, H, {
        gap: 10 * k,
        marginTop: 45 * k,
        marginBottom: 60 * k,
      });
      return Object.fromEntries(Object.entries(tops).map(([id, t]) => [id, t / H]));
    };
    const small = build(0.7);
    const large = build(1.1);
    for (const id of Object.keys(small)) {
      expect(small[id]).toBeCloseTo(large[id], 5);
    }
  });
});

describe("storyTitleSize", () => {
  test("uzun başlık küçük, kısa başlık varsayılan boyutta", () => {
    expect(storyTitleSize("Up")).toBe(26);
    expect(storyTitleSize("Everything Everywhere All at Once")).toBeLessThan(26);
    expect(storyTitleSize("x".repeat(60))).toBe(18);
  });

  test("boş/undefined güvenli", () => {
    expect(storyTitleSize(undefined)).toBe(26);
    expect(storyTitleSize("")).toBe(26);
  });
});

describe("planStoryActionBar", () => {
  const TR = { titles: ["Tasarımı Paylaş", "Paylaş"], sub: "PNG olarak dışa aktar" };
  const EN = { titles: ["Share Design", "Share"], sub: "Export as PNG" };
  const WIDTHS = [320, 340, 360, 375, 390, 393, 402, 412, 414, 428, 430, 440, 480, 600, 768, 1024];

  // Kırpılmama sözleşmesi: seçilen başlık, hesaplanan metin alanına sığar
  // (harf genişliği tahmini planStoryActionBar'ın kullandığıyla aynı).
  const estimate = (text, size, em) => text.length * size * em;

  test.each(WIDTHS)("%i dp: başlık metin alanına sığar (TR ve EN)", (w) => {
    for (const set of [TR, EN]) {
      const p = planStoryActionBar(w, set);
      expect(estimate(p.title, p.titleSize, 0.6)).toBeLessThanOrEqual(p.copyW);
      if (p.showSub) expect(estimate(set.sub, 11, 0.55)).toBeLessThanOrEqual(p.copyW);
    }
  });

  test.each(WIDTHS)("%i dp: satır genişliği pencereye sığar", (w) => {
    const p = planStoryActionBar(w, TR);
    const used = 32 + p.shareW + p.secondaryW * 3 + p.gap * 3;
    expect(used).toBeLessThanOrEqual(Math.max(240, w));
    expect(p.shareW).toBeGreaterThan(0);
    expect(p.secondaryW).toBeGreaterThanOrEqual(46);
    expect(p.secondaryW).toBeLessThanOrEqual(56);
  });

  test("eski kırılma bölgesi (400–440 dp) artık kırpılmıyor", () => {
    for (const w of [402, 412, 414, 428, 430, 440]) {
      const p = planStoryActionBar(w, TR);
      expect(estimate(p.title, p.titleSize, 0.6)).toBeLessThanOrEqual(p.copyW);
    }
  });

  test("dar telefonda kısa etiket, geniş ekranda uzun etiket + alt satır", () => {
    expect(planStoryActionBar(320, TR).title).toBe("Paylaş");
    expect(planStoryActionBar(320, TR).showSub).toBe(false);
    const wide = planStoryActionBar(768, TR);
    expect(wide.title).toBe("Tasarımı Paylaş");
    expect(wide.showSub).toBe(true);
  });

  test("daha kısa dil (EN) aynı genişlikte uzun etikete daha erken geçer", () => {
    const tr = planStoryActionBar(412, TR);
    const en = planStoryActionBar(412, EN);
    expect(en.title).toBe("Share Design");
    expect(tr.title.length).toBeGreaterThan(0);
  });

  test("rowH = simge + iki dikey dolgu; başlık verilmese de çökmez", () => {
    for (const w of WIDTHS) {
      const p = planStoryActionBar(w);
      expect(p.rowH).toBe(p.icon + p.pad.y * 2);
      expect(p.title).toBe("");
      expect(p.showSub).toBe(false);
    }
  });

  test("bozuk genişlik (0/NaN) güvenli", () => {
    expect(planStoryActionBar(0, TR).shareW).toBeGreaterThan(0);
    expect(planStoryActionBar(NaN, TR).title).toBe("Paylaş");
  });

  test.each(WIDTHS)(
    "%i dp: meşgulken başlık değişse de çubuk boyutu sıçramaz",
    (w) => {
      // Paylaş'a basınca "Görsel hazırlanıyor" gelir; düzen (ve rowH) aynı
      // kalmalı, yoksa alt çubuk yükseklik değiştirip tuvali oynatır.
      const idle = planStoryActionBar(w, { ...TR, variantTitle: TR.titles[0] });
      const busy = planStoryActionBar(w, {
        titles: ["Görsel hazırlanıyor", "Paylaş"],
        variantTitle: TR.titles[0],
        sub: TR.sub,
      });
      expect(busy.rowH).toBe(idle.rowH);
      expect(busy.icon).toBe(idle.icon);
      expect(busy.secondaryW).toBe(idle.secondaryW);
      // meşgul başlık da alana sığar (kısa etikete düşebilir)
      expect(estimate(busy.title, busy.titleSize, 0.6)).toBeLessThanOrEqual(busy.copyW);
      // alt satır yalnız boştaki uzun başlıkla birlikte görünür
      expect(busy.showSub).toBe(false);
    }
  );
});

describe("storyDraftGrid", () => {
  test.each([[320], [360], [412], [430], [600], [768], [1024]])(
    "%i dp: kartlar satıra sığar, 9:16 oranı",
    (w) => {
      const g = storyDraftGrid(w);
      expect(g.cols * g.itemW + (g.cols - 1) * 10 + 24).toBeLessThanOrEqual(w);
      expect(Math.abs(g.itemH / g.itemW - 16 / 9)).toBeLessThan(0.02);
      expect(g.itemW).toBeGreaterThan(60);
    }
  );

  test("telefonda 3, tablette daha çok sütun", () => {
    expect(storyDraftGrid(390).cols).toBe(3);
    expect(storyDraftGrid(600).cols).toBe(4);
    expect(storyDraftGrid(768).cols).toBe(5);
    expect(storyDraftGrid(1024).cols).toBe(6);
  });

  test("sıfır genişlik çökmez", () => {
    expect(storyDraftGrid(0).cols).toBe(3);
  });
});
