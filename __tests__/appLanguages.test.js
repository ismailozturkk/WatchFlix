// __tests__/appLanguages.test.js
//
// Dil kaydı (utils/appLanguages.js) sözleşmesi. Bu dosya "yeni dil eklemek" için
// bir sağlama listesidir: kayda yeni bir satır eklenince burası, o dilin TMDB /
// Intl / çeviri paketi / cihaz dili bağlarının tamam olduğunu zorlar.
//
// ASIL KURAL: bilinmeyen dil → İNGİLİZCE; Türkçe'ye YALNIZ "tr" düşer. Eski
// `lang === "en" ? en : tr` kalıbı yabancı dili Türkçe'ye atıyordu.
const fs = require("fs");
const path = require("path");
const {
  APP_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  FALLBACK_LANGUAGE,
  normalizeAppLanguage,
  nextAppLanguage,
  legacyFlagToLanguage,
  isSupportedAppLanguage,
  intlLocaleOf,
  tmdbLanguageOf,
  tmdbRegionOf,
  tmdbImageLanguageOrderOf,
  legalLanguageOf,
  aiPromptLanguageOf,
  copyLanguage,
  pickByLanguage,
} = require("../utils/appLanguages");
const { DESTEKLENEN_DILLER } = require("../utils/deviceLanguage");

const KOK = path.join(__dirname, "..");

describe("dil kaydı yapısı", () => {
  it("her dil gerekli alanları taşır ve kodlar benzersiz", () => {
    const kodlar = new Set();
    for (const dil of APP_LANGUAGES) {
      expect(dil.code).toMatch(/^[a-z]{2}$/);
      expect(kodlar.has(dil.code)).toBe(false);
      kodlar.add(dil.code);
      for (const alan of ["name", "nativeName", "flag", "intlLocale", "tmdbLanguage", "tmdbRegion", "legalLang", "aiPromptName"]) {
        expect(typeof dil[alan]).toBe("string");
        expect(dil[alan].length).toBeGreaterThan(0);
      }
      expect(Array.isArray(dil.tmdbImageLanguages)).toBe(true);
      expect(dil.tmdbImageLanguages[0]).toBe(dil.code); // önce kendi dilinin görseli
    }
  });

  it("yedek dil kayıtlı ve İngilizce", () => {
    expect(FALLBACK_LANGUAGE).toBe("en");
    expect(SUPPORTED_LANGUAGE_CODES).toContain(FALLBACK_LANGUAGE);
  });

  it("yasal sayfa dili yalnız sitede var olan dillerden biri", () => {
    // website/ yalnız tr ve en yasal sayfalarını yayımlıyor; yeni dil için sayfa
    // yazılana kadar legalLang "en" kalır (docs/mimari/DIL_DESTEGI_REHBERI.md).
    for (const dil of APP_LANGUAGES) expect(["tr", "en"]).toContain(dil.legalLang);
  });

  it("her dilin çeviri paketi var ve index.js'e bağlı", () => {
    const indeks = fs.readFileSync(path.join(KOK, "translations", "index.js"), "utf8");
    for (const kod of SUPPORTED_LANGUAGE_CODES) {
      expect(fs.existsSync(path.join(KOK, "translations", `${kod}.json`))).toBe(true);
      expect(indeks).toContain(`${kod}.json`);
    }
  });

  it("cihaz dili listesi kayıtla aynı", () => {
    expect([...DESTEKLENEN_DILLER].sort()).toEqual([...SUPPORTED_LANGUAGE_CODES].sort());
  });
});

describe("normalizeAppLanguage", () => {
  it("desteklenen kodları ve bölgeli etiketleri çözer", () => {
    expect(normalizeAppLanguage("tr")).toBe("tr");
    expect(normalizeAppLanguage("es")).toBe("es");
    expect(normalizeAppLanguage("es-MX")).toBe("es");
    expect(normalizeAppLanguage("ES_ar")).toBe("es");
    expect(normalizeAppLanguage("pt")).toBe("pt");
    expect(normalizeAppLanguage("pt-BR")).toBe("pt");
    expect(normalizeAppLanguage("PT_pt")).toBe("pt");
    expect(normalizeAppLanguage("en-GB")).toBe("en");
  });

  it("bilinmeyen / bozuk değer İngilizceye düşer, Türkçeye DEĞİL", () => {
    for (const girdi of ["de", "fr", "zz", "", null, undefined, 42, {}]) {
      expect(normalizeAppLanguage(girdi)).toBe("en");
    }
  });
});

describe("copyLanguage / pickByLanguage", () => {
  it("tabloda olan dili seçer", () => {
    expect(copyLanguage("es", ["tr", "en", "es"])).toBe("es");
    expect(copyLanguage("pt", ["tr", "en", "es", "pt"])).toBe("pt");
    expect(copyLanguage("tr", ["tr", "en"])).toBe("tr");
  });

  it("tabloda olmayan dil İngilizceye düşer (Türkçe'ye değil)", () => {
    expect(copyLanguage("es", ["tr", "en"])).toBe("en");
    expect(copyLanguage("pt", ["tr", "en", "es"])).toBe("en");
    expect(copyLanguage("de", ["tr", "en", "es"])).toBe("en");
    expect(copyLanguage(undefined, ["tr", "en", "es"])).toBe("en");
  });

  it("İngilizce de yoksa tablonun ilk dili", () => {
    expect(copyLanguage("es", ["tr", "es"])).toBe("es");
    expect(copyLanguage("de", ["tr", "es"])).toBe("tr");
  });

  it("pickByLanguage metni döndürür", () => {
    const tablo = { tr: "Merhaba", en: "Hello", es: "Hola" };
    expect(pickByLanguage("es", tablo)).toBe("Hola");
    expect(pickByLanguage("tr", tablo)).toBe("Merhaba");
    expect(pickByLanguage("fr", tablo)).toBe("Hello");
    expect(pickByLanguage("es", { tr: "Merhaba", en: "Hello" })).toBe("Hello");
    expect(pickByLanguage("pt", { tr: "Merhaba", en: "Hello", es: "Hola", pt: "Olá" })).toBe("Olá");
    expect(pickByLanguage("pt", { tr: "Merhaba", en: "Hello", es: "Hola" })).toBe("Hello");
  });
});

describe("dil bağlı sabitler", () => {
  it("İspanyolca: TMDB, Intl ve yapay zeka bağları", () => {
    expect(tmdbLanguageOf("es")).toBe("es-ES");
    expect(tmdbRegionOf("es")).toBe("ES");
    expect(intlLocaleOf("es")).toBe("es-ES");
    expect(aiPromptLanguageOf("es")).toBe("Spanish (es)");
    expect(legalLanguageOf("es")).toBe("en");
    expect(tmdbImageLanguageOrderOf("es")).toBe("es,en,null");
  });

  it("Portekizce (Brezilya): TMDB, Intl ve yapay zeka bağları", () => {
    expect(tmdbLanguageOf("pt")).toBe("pt-BR");
    expect(tmdbRegionOf("pt")).toBe("BR");
    expect(intlLocaleOf("pt")).toBe("pt-BR");
    expect(aiPromptLanguageOf("pt")).toBe("Portuguese (pt-BR)");
    expect(legalLanguageOf("pt")).toBe("en");
    expect(tmdbImageLanguageOrderOf("pt")).toBe("pt,en,null");
  });

  it("Türkçe ve İngilizce bağları değişmedi", () => {
    expect(tmdbLanguageOf("tr")).toBe("tr-TR");
    expect(tmdbRegionOf("tr")).toBe("TR");
    expect(tmdbLanguageOf("en")).toBe("en-US");
    expect(tmdbRegionOf("en")).toBe("US");
    expect(legalLanguageOf("tr")).toBe("tr");
  });

  it("bilinmeyen dilde İngilizce bağları döner", () => {
    expect(tmdbLanguageOf("de")).toBe("en-US");
    expect(intlLocaleOf("zz")).toBe("en-US");
  });
});

describe("dil döngüsü ve eski bayrak göçü", () => {
  it("nextAppLanguage kayıt sırasıyla döner ve başa sarar", () => {
    let dil = SUPPORTED_LANGUAGE_CODES[0];
    const gezilen = [];
    for (let i = 0; i < SUPPORTED_LANGUAGE_CODES.length; i++) {
      gezilen.push(dil);
      dil = nextAppLanguage(dil);
    }
    expect(gezilen).toEqual(SUPPORTED_LANGUAGE_CODES);
    expect(dil).toBe(SUPPORTED_LANGUAGE_CODES[0]);
  });

  it("eski boolean bayrak (true = Türkçe) dile çevrilir", () => {
    expect(legacyFlagToLanguage(true)).toBe("tr");
    expect(legacyFlagToLanguage(false)).toBe("en");
    expect(legacyFlagToLanguage("es")).toBe("es");
    expect(legacyFlagToLanguage("pt")).toBe("pt");
    expect(legacyFlagToLanguage("xx")).toBe("en");
  });

  it("isSupportedAppLanguage yalnız kayıtlı kodlara true", () => {
    expect(isSupportedAppLanguage("es")).toBe(true);
    expect(isSupportedAppLanguage("pt")).toBe(true);
    expect(isSupportedAppLanguage("de")).toBe(false);
  });
});
