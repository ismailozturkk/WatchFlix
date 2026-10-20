// __tests__/portugueseSupport.test.js
//
// Portekizce (pt, Brezilya) için yüzeyler arası sağlama: kayıt, cihaz dili, tarih, takvim,
// tür adları, yedek dosyası ve sunucu/yerel kaynak dosyalarının dil listeleri. Yapısal denetimin
// büyük kısmı i18nKeys / copyTablesSpanish / appLanguages / widgetNativeLanguage testlerinde;
// burada onların kapsamadığı küçük birleşim noktaları var.
const fs = require("fs");
const path = require("path");
const { cihazDilindenSec } = require("../utils/deviceLanguage");
const { kanonikTur } = require("../utils/genreCanon");
const { getWrappedStrings } = require("../utils/wrappedStrings");
const { getAiCopy } = require("../utils/aiCopy");
const { tmdbLanguageForApp } = require("../utils/tmdbTitleFallback");
const { legalLanguageOf, intlLocaleOf } = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const oku = (yol) => fs.readFileSync(path.join(KOK, yol), "utf8").split(String.fromCharCode(13, 10)).join("\n");

describe("Portekizce: cihaz dili ve TMDB bağları", () => {
  it("Portekizce cihaz ilk açılışta Portekizce açılır (pt, pt-BR, pt-PT)", () => {
    expect(cihazDilindenSec([{ languageCode: "pt" }])).toBe("pt");
    expect(cihazDilindenSec([{ languageCode: "PT" }])).toBe("pt");
    expect(cihazDilindenSec([{ languageCode: "fr" }])).toBe("en");
  });

  it("TMDB dili pt-BR; Intl pt-BR; yasal sayfa İngilizce (sayfa yazılana dek)", () => {
    expect(tmdbLanguageForApp("pt")).toBe("pt-BR");
    expect(tmdbLanguageForApp("pt_BR")).toBe("pt-BR");
    expect(intlLocaleOf("pt")).toBe("pt-BR");
    expect(legalLanguageOf("pt")).toBe("en");
  });
});

describe("Portekizce: tarih ve takvim", () => {
  it("tarih seçici Portekizce ay/gün adlarını ve '5 de março de 1998' biçimini kullanıyor", () => {
    // DatePickerModal React Native bileşenlerini içe aktardığı için jest'te doğrudan yüklenemez; kaynak denetlenir.
    const kaynak = oku("components/modals/DatePickerModal.js");
    expect(kaynak).toMatch(/pt: MONTHS_PT/);
    expect(kaynak).toMatch(/pt: WEEKDAYS_PT/);
    expect(kaynak).toMatch(/lang === "es" || lang === "pt"/);
    expect(kaynak).toMatch(/"Janeiro", "Fevereiro", "Março"/);
  });

  it("takvim ekranı pt yerelini tanıyor ve Pazar başlangıcı kullanıyor", () => {
    const kaynak = oku("screens/calendar/CalendarScreen.js");
    expect(kaynak).toMatch(/LocaleConfig\.locales\.pt\s*=/);
    expect(kaynak).toMatch(/firstDay=\{\["en", "pt"\]\.includes/);
  });
});

describe("Portekizce: tür adları kanonik id'ye iner (yoksa 'other' kovasına düşer)", () => {
  it.each([
    ["Ação", "action"],
    ["Ação e Aventura", "action"],
    ["Aventura", "adventure"],
    ["Animação", "animation"],
    ["Comédia", "comedy"],
    ["Documentário", "documentary"],
    ["Família", "family"],
    ["Ficção científica", "scifi"],
    ["Ficção científica e Fantasia", "scifi"],
    ["Terror", "horror"],
    ["Mistério", "mystery"],
    ["Guerra", "war"],
    ["Faroeste", "western"],
    ["Cinema TV", "tvmovie"],
    ["Novela", "drama"],
  ])("%s → %s", (ad, id) => {
    expect(kanonikTur(ad)).toBe(id);
  });

  it("Portekizce ve İngilizce ad aynı türe düşer (dil değiştirince tür çoğalmaz)", () => {
    expect(kanonikTur("Ficção científica")).toBe(kanonikTur("Science Fiction"));
    expect(kanonikTur("Faroeste")).toBe(kanonikTur("Western"));
  });
});

describe("Portekizce kopya gerçekten Portekizce", () => {
  it("Wrapped ve yapay zeka metinleri kendi dilinde", () => {
    expect(getWrappedStrings("pt").entryCta).toBe("Ver seu resumo");
    expect(getAiCopy("pt").vibe.cta).toBe("Sugira algo");
    expect(getAiCopy("pt")).not.toBe(getAiCopy("en"));
  });
});

describe("Portekizce: dil listeleri olan kaynak dosyaları", () => {
  it("sunucu bildirim dili listesi pt'yi içeriyor ve metinleri var", () => {
    const sunucu = oku("functions/index.js");
    expect(sunucu).toMatch(/NOTIFICATION_LANGUAGES = \["tr", "en", "es", "pt", "de"\]/);
    expect(sunucu).toMatch(/\n  pt: \{\n    someone: "Alguém"/);
    expect(sunucu).toMatch(/\n  pt: \{\n    single: \(p\) =>/);
  });

  it("i18next fallback zincirinde pt var; paket bağlı", () => {
    const indeks = oku("translations/index.js");
    expect(indeks).toMatch(/import pt from "\.\/pt\.json"/);
    expect(indeks).toMatch(/pt: \{ translation: pt \}/);
    expect(indeks).toMatch(/pt: \["en", "tr"\]/);
  });

  it("keşif süzgecinde içerik dili olarak Portekizce seçilebilir ve etiketi her dilde var", () => {
    const { LANGUAGES } = require("../utils/discoverFilters");
    const { DISCOVER_FILTERS_COPY } = require("../screens/shared/discoverFiltersCopy");
    expect(LANGUAGES).toContain("pt");
    for (const dil of ["tr", "en", "es", "pt"]) {
      expect(typeof DISCOVER_FILTERS_COPY[dil].languages.pt).toBe("string");
    }
  });
});
