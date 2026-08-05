// __tests__/colorUtils.test.js
//
// readableOn'un SOZLESMESI. Bu yardimci, anlam renklerinin (tip cipi, puan hapi,
// "eklendi" tiki) uygulamanin 7 temasinda ve kullanicinin kendi urettigi
// temalarda okunur kalmasini garanti ediyor. Bozulursa belirti SESSIZDIR:
// rozet kaybolmaz, sadece zemine karisir — bu yuzden esikler testle sabitlendi.

const {
  contrastRatio,
  hexToHsl,
  luminance,
  readableOn,
  toHex,
} = require("../utils/colorUtils");

// theme/colors.js'teki gercek yuzey degerleri
const YUZEYLER = {
  gray: "#2A2D33",
  dark: "#15171C",
  light: "#F7F9FC",
  green: "#D8E7E1",
  purple: "#211C2E",
  amber: "#282017",
};

// GlobalSearchResults'un kullandigi anlam renkleri
const ANLAM_RENKLERI = {
  "dizi cipi": "#64FF64", // notesColor.green — neon
  "film cipi": "#138DF0",
  "puan >=8": "#29b864",
  "puan >=6": "#f5c518",
  "puan >=4": "#ff6400",
  "puan <4": "#e33",
};

const AA = 4.5;

describe("contrastRatio", () => {
  test("siyah-beyaz azami orani verir", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  test("ayni renk 1 dondurur ve sira onemsizdir", () => {
    expect(contrastRatio("#2A2D33", "#2A2D33")).toBeCloseTo(1, 5);
    expect(contrastRatio("#64FF64", "#F7F9FC")).toBeCloseTo(
      contrastRatio("#F7F9FC", "#64FF64"),
      5,
    );
  });

  test("rgb/rgba girdisini de kabul eder", () => {
    expect(contrastRatio("rgb(0,0,0)", "#FFFFFF")).toBeCloseTo(21, 1);
  });
});

describe("readableOn — okunurluk garantisi", () => {
  test("TUM anlam rengi / tema yuzeyi ciftleri WCAG AA esigini gecer", () => {
    const basarisiz = [];
    for (const [renkAdi, renk] of Object.entries(ANLAM_RENKLERI)) {
      for (const [temaAdi, yuzey] of Object.entries(YUZEYLER)) {
        const oran = contrastRatio(readableOn(renk, yuzey), yuzey);
        if (oran < AA) {
          basarisiz.push(`${renkAdi} / ${temaAdi} = ${oran.toFixed(2)}`);
        }
      }
    }
    expect(basarisiz).toEqual([]);
  });

  test("duzeltme olmadan bazi ciftler gercekten okunmuyordu (testin anlamli oldugunun kaniti)", () => {
    // Neon yesil acik zeminlerde pratikte gorunmuyor.
    expect(contrastRatio("#64FF64", YUZEYLER.light)).toBeLessThan(2);
    expect(contrastRatio("#64FF64", YUZEYLER.green)).toBeLessThan(2);
    // readableOn sonrasi esigi geciyor.
    expect(
      contrastRatio(readableOn("#64FF64", YUZEYLER.light), YUZEYLER.light),
    ).toBeGreaterThanOrEqual(AA);
  });

  test("zaten yeterli kontrasti olan renge DOKUNMAZ", () => {
    // Beyaz, koyu gri zeminde zaten 12:1 — degistirilmemeli.
    expect(readableOn("#FFFFFF", YUZEYLER.gray)).toBe(toHex("#FFFFFF"));
  });

  test("tonu (hue) korur — renk kimligi bozulmaz", () => {
    const kaynak = "#64FF64"; // yesil
    const duzeltilmis = readableOn(kaynak, YUZEYLER.light);
    expect(Math.abs(hexToHsl(duzeltilmis).h - hexToHsl(kaynak).h)).toBeLessThanOrEqual(2);
  });

  test("acik zeminde KOYULASTIRIR, koyu zeminde ACAR", () => {
    const acikta = readableOn("#e33", YUZEYLER.light);
    const koyuda = readableOn("#e33", YUZEYLER.gray);
    expect(luminance(acikta)).toBeLessThan(luminance("#e33"));
    expect(luminance(koyuda)).toBeGreaterThan(luminance("#e33"));
  });

  test("hedef kontrast ayarlanabilir", () => {
    const gevsek = readableOn("#64FF64", YUZEYLER.light, { target: 3 });
    expect(contrastRatio(gevsek, YUZEYLER.light)).toBeGreaterThanOrEqual(3);
  });

  test("ayni girdi ayni ciktiyi verir (onbellek sonucu degistirmiyor)", () => {
    const a = readableOn("#f5c518", YUZEYLER.green);
    const b = readableOn("#f5c518", YUZEYLER.green);
    expect(a).toBe(b);
  });

  test("bozuk girdide patlamaz", () => {
    expect(() => readableOn(null, YUZEYLER.gray)).not.toThrow();
    expect(() => readableOn("#64FF64", undefined)).not.toThrow();
    expect(() => readableOn("bilinmeyen", "renk")).not.toThrow();
  });
});
