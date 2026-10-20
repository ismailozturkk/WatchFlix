// __tests__/sectionVisibilityCopy.test.js
//
// Ekran bölümleri ayar sayfasının metinleri. Dengeyi (tr/en/es aynı anahtarlar, aynı
// yer tutucular) copyTablesSpanish.test.js bekçiler; burada KAYITLA bağ sınanır:
// utils/sectionVisibility.js'teki her ekran ve bölümün üç dilde adı + açıklaması var
// (yoksa ayar sayfasında ham kimlik ya da çökme görünürdü), kopyada kayıtta olmayan
// fazlalık yok, İspanyolca/İngilizce kopya Türkçe harf taşımıyor.

const {
  SECTION_VISIBILITY_COPY,
  fillCopy,
  getSectionVisibilityCopy,
} = require("../screens/tabs/settings/sectionVisibilityCopy");
const { SECTION_SCREENS } = require("../utils/sectionVisibility");

const DILLER = ["tr", "en", "es", "pt"];
const doluMetin = (m) => typeof m === "string" && m.trim().length > 0;

describe("kayıt ↔ metin bağı", () => {
  test.each(DILLER)("%s: her ekranın adı ve açıklaması var", (dil) => {
    const kopya = SECTION_VISIBILITY_COPY[dil];
    expect(Object.keys(kopya.screens).sort()).toEqual(SECTION_SCREENS.map((s) => s.id).sort());
    for (const ekran of SECTION_SCREENS) {
      expect(doluMetin(kopya.screens[ekran.id].name)).toBe(true);
      expect(doluMetin(kopya.screens[ekran.id].hint)).toBe(true);
    }
  });

  test.each(DILLER)("%s: kayıttaki HER bölümün [ad, açıklama] çifti var, fazlası yok", (dil) => {
    const kopya = SECTION_VISIBILITY_COPY[dil];
    for (const ekran of SECTION_SCREENS) {
      const beklenen = ekran.sections.map((s) => s.id).sort();
      expect(Object.keys(kopya.sections[ekran.id]).sort()).toEqual(beklenen);
      for (const bolum of ekran.sections) {
        const cift = kopya.sections[ekran.id][bolum.id];
        expect(Array.isArray(cift)).toBe(true);
        expect(cift).toHaveLength(2);
        expect(cift.every(doluMetin)).toBe(true);
      }
    }
  });

  test.each(DILLER)("%s: arayüz metinlerinin hiçbiri boş değil", (dil) => {
    for (const [anahtar, deger] of Object.entries(SECTION_VISIBILITY_COPY[dil].ui)) {
      expect({ anahtar, dolu: doluMetin(deger) }).toEqual({ anahtar, dolu: true });
    }
  });

  test("aynı ekranda iki bölümün adı aynı değil (listede ayırt edilebilirler)", () => {
    for (const dil of DILLER) {
      for (const ekran of SECTION_SCREENS) {
        const adlar = ekran.sections.map((s) => SECTION_VISIBILITY_COPY[dil].sections[ekran.id][s.id][0]);
        expect(new Set(adlar).size).toBe(adlar.length);
      }
    }
  });

  test("dört ekranın adı birbirinden farklı", () => {
    for (const dil of DILLER) {
      const adlar = Object.values(SECTION_VISIBILITY_COPY[dil].screens).map((e) => e.name);
      expect(new Set(adlar).size).toBe(adlar.length);
    }
  });
});

describe("dil seçimi", () => {
  test("bilinen diller kendi tablosunu alır", () => {
    for (const dil of DILLER) {
      expect(getSectionVisibilityCopy(dil)).toBe(SECTION_VISIBILITY_COPY[dil]);
    }
  });

  test("bilinmeyen/boş dil İNGİLİZCEye düşer (Türkçeye değil)", () => {
    for (const dil of ["fr", "it", "", undefined, null, "zz"]) {
      expect(getSectionVisibilityCopy(dil)).toBe(SECTION_VISIBILITY_COPY.en);
    }
  });

  test("İngilizce ve İspanyolca kopya Türkçe harf taşımıyor", () => {
    const yapraklar = (nesne) =>
      Object.values(nesne).flatMap((d) => (d && typeof d === "object" ? yapraklar(d) : [d]));
    for (const dil of ["en", "es"]) {
      const turkce = yapraklar(SECTION_VISIBILITY_COPY[dil]).filter((m) => /[ğşıİ]/.test(String(m)));
      expect(turkce).toEqual([]);
    }
  });

  test("İspanyolca kopya Türkçeden gerçekten farklı", () => {
    expect(JSON.stringify(SECTION_VISIBILITY_COPY.es)).not.toBe(JSON.stringify(SECTION_VISIBILITY_COPY.tr));
    expect(JSON.stringify(SECTION_VISIBILITY_COPY.es)).not.toBe(JSON.stringify(SECTION_VISIBILITY_COPY.en));
  });
});

describe("fillCopy", () => {
  test("yer tutucuları doldurur, tekrarı da", () => {
    expect(fillCopy("{n} gizli", { n: 3 })).toBe("3 gizli");
    expect(fillCopy("{shown} / {total} ({shown})", { shown: 4, total: 9 })).toBe("4 / 9 (4)");
  });

  test("0 değeri de yazılır; verilmeyen yer tutucu olduğu gibi kalır", () => {
    expect(fillCopy("{n} gizli", { n: 0 })).toBe("0 gizli");
    expect(fillCopy("{n} gizli", {})).toBe("{n} gizli");
    expect(fillCopy("{n} gizli")).toBe("{n} gizli");
  });

  test("rozet ve sayaç metinleri üç dilde doğru dolar", () => {
    for (const dil of DILLER) {
      const { ui } = SECTION_VISIBILITY_COPY[dil];
      expect(fillCopy(ui.badgeHidden, { n: 2 })).toContain("2");
      const sayac = fillCopy(ui.visibleCount, { shown: 5, total: 13 });
      expect(sayac).toContain("5");
      expect(sayac).toContain("13");
      expect(sayac).not.toMatch(/\{/);
    }
  });
});
