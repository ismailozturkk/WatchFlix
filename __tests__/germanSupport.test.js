// __tests__/germanSupport.test.js
//
// Almanca (de) için yüzeyler arası sağlama: kayıt, cihaz dili, tarih, takvim, tür adları, sunucu
// bildirimleri, onboarding dil düğmesi, rozet kataloğu ve kaynak dosyalarının dil listeleri.
// Yapısal denetimin büyük kısmı i18nKeys / copyTablesSpanish / appLanguages / widgetNativeLanguage
// testlerinde; burada onların kapsamadığı küçük birleşim noktaları var.
const fs = require("fs");
const path = require("path");
const { cihazDilindenSec } = require("../utils/deviceLanguage");
const { kanonikTur } = require("../utils/genreCanon");
const { getWrappedStrings } = require("../utils/wrappedStrings");
const { getAiCopy } = require("../utils/aiCopy");
const { getFavoritesCopy } = require("../utils/favoritesCopy");
const { getOnboardingCopy } = require("../screens/onboarding/onboardingCopy");
const { tmdbLanguageForApp } = require("../utils/tmdbTitleFallback");
const {
  APP_LANGUAGES,
  legalLanguageOf,
  intlLocaleOf,
  nextAppLanguage,
  copyLanguage,
} = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const oku = (yol) => fs.readFileSync(path.join(KOK, yol), "utf8").split(String.fromCharCode(13, 10)).join("\n");

describe("Almanca: cihaz dili ve TMDB bağları", () => {
  it("Almanca cihaz ilk açılışta Almanca açılır (de, de-AT, de-CH)", () => {
    expect(cihazDilindenSec([{ languageCode: "de" }])).toBe("de");
    expect(cihazDilindenSec([{ languageCode: "DE" }])).toBe("de");
    expect(cihazDilindenSec([{ languageCode: "fr" }])).toBe("en");
  });

  it("TMDB dili de-DE; Intl de-DE; yasal sayfa İngilizce (sayfa yazılana dek)", () => {
    expect(tmdbLanguageForApp("de")).toBe("de-DE");
    expect(tmdbLanguageForApp("de_AT")).toBe("de-DE");
    expect(intlLocaleOf("de")).toBe("de-DE");
    expect(legalLanguageOf("de")).toBe("en");
  });

  it("kayıtta Almanca bayrağı ve kendi adı var", () => {
    const de = APP_LANGUAGES.find((l) => l.code === "de");
    expect(de.nativeName).toBe("Deutsch");
    expect(de.flag).toBe("de");
  });
});

describe("Almanca: tarih ve takvim", () => {
  it("tarih seçici Almanca ay/gün adlarını ve '5. März 1998' biçimini kullanıyor", () => {
    // DatePickerModal React Native bileşenlerini içe aktardığı için jest'te doğrudan yüklenemez; kaynak denetlenir.
    const kaynak = oku("components/modals/DatePickerModal.js");
    expect(kaynak).toMatch(/de: MONTHS_DE/);
    expect(kaynak).toMatch(/de: WEEKDAYS_DE/);
    expect(kaynak).toMatch(/lang === "de"\) return `\$\{day\}\. \$\{month\} \$\{year\}`/);
    expect(kaynak).toMatch(/"Januar", "Februar", "März"/);
  });

  it("takvim ekranı de yerelini tanıyor ve haftayı PAZARTESİ başlatıyor", () => {
    const kaynak = oku("screens/calendar/CalendarScreen.js");
    expect(kaynak).toMatch(/LocaleConfig\.locales\.de\s*=/);
    // firstDay: yalnız en + pt Pazar (0) başlatır; Almanca bu listede OLMAMALI.
    expect(kaynak).toMatch(/firstDay=\{\["en", "pt"\]\.includes/);
  });
});

describe("Almanca: tür adları kanonik id'ye iner (yoksa 'other' kovasına düşer)", () => {
  it.each([
    ["Action", "action"],
    ["Action & Adventure", "action"],
    ["Abenteuer", "adventure"],
    ["Animation", "animation"],
    ["Komödie", "comedy"],
    ["Krimi", "crime"],
    ["Dokumentarfilm", "documentary"],
    ["Nachrichten", "documentary"],
    ["Drama", "drama"],
    ["Seifenoper", "drama"],
    ["Familie", "family"],
    ["Kinder", "family"],
    ["Fantasy", "fantasy"],
    ["Historie", "history"],
    ["Horror", "horror"],
    ["Musik", "music"],
    ["Mystery", "mystery"],
    ["Liebesfilm", "romance"],
    ["Science Fiction", "scifi"],
    ["Sci-Fi & Fantasy", "scifi"],
    ["Thriller", "thriller"],
    ["Kriegsfilm", "war"],
    ["War & Politics", "war"],
    ["Western", "western"],
    ["Reality", "reality"],
    ["Talk", "reality"],
    ["TV-Film", "tvmovie"],
  ])("%s → %s", (ad, id) => {
    expect(kanonikTur(ad)).toBe(id);
  });

  it("Almanca ve İngilizce ad aynı türe düşer (dil değiştirince tür çoğalmaz)", () => {
    expect(kanonikTur("Komödie")).toBe(kanonikTur("Comedy"));
    expect(kanonikTur("Kriegsfilm")).toBe(kanonikTur("War"));
  });
});

describe("Almanca kopya gerçekten Almanca", () => {
  it("Wrapped, yapay zeka ve favori metinleri kendi dilinde", () => {
    expect(getWrappedStrings("de").entryCta).toBe("Rückblick ansehen");
    expect(getAiCopy("de")).not.toBe(getAiCopy("en"));
    expect(getFavoritesCopy("de")).not.toBe(getFavoritesCopy("en"));
  });

  it("çeviri paketinde yinelenen anahtar ya da İngilizce kalıntı kritik yerlerde yok", () => {
    const de = JSON.parse(oku("translations/de.json"));
    const en = JSON.parse(oku("translations/en.json"));
    expect(de.settings).toBe("Einstellungen");
    expect(de.language).toBe("Sprache");
    expect(de.autoI18n.language_coming_soon).toBe("Demnächst");
    // Çevrilmemiş (İngilizceyle birebir aynı) uzun cümle kalmamalı. Yer tutucular ({{n}}) ve noktalama
    // atılınca ≥ 20 harf kalan metinler sayılır: "{{current}} / {{next}} XP", "CineSwipe ({{a}} & {{b}})"
    // gibi dilden bağımsız kalıplar Almancada da aynıdır.
    const duz = (o, p = "", out = {}) => {
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === "object" && !Array.isArray(v)) duz(v, `${p}${k}.`, out);
        else out[`${p}${k}`] = v;
      }
      return out;
    };
    const d = duz(de);
    const e = duz(en);
    const harfler = (m) => m.replace(/\{\{[^}]*\}\}/g, "").replace(/[^\p{L}]/gu, "");
    const ayni = Object.keys(e).filter(
      (k) => typeof e[k] === "string" && e[k] === d[k] && /\s/.test(e[k]) && harfler(e[k]).length >= 20,
    );
    expect(ayni).toEqual([]);
  });
});

describe("Almanca: onboarding dil düğmesi sıradaki dili gösterir", () => {
  it("her dilin düğme etiketi, döngüdeki SONRAKİ dilin kendi adıdır", () => {
    for (const { code } of APP_LANGUAGES) {
      const sonraki = APP_LANGUAGES.find((l) => l.code === nextAppLanguage(code));
      expect(getOnboardingCopy(code).language).toBe(sonraki.nativeName);
    }
  });

  it("Almanca özellik başlığındaki vurgu sözcüğü başlığın içinde geçiyor", () => {
    for (const ozellik of getOnboardingCopy("de").features) {
      expect(ozellik.title).toContain(ozellik.titleAccent);
    }
  });
});

describe("Almanca: rozet kataloğu", () => {
  it("her rozetin Almanca adı ve açıklaması var, sonraki hedef/mühür nesnelerinde de korunuyor", () => {
    const { WATCH_BADGES, badgeAd, badgeAciklama, gruplaAileler, evaluateWatchBadges } = require("../components/badges/watchBadgeCatalog");
    const eksik = WATCH_BADGES.filter((b) => !b.de || !b.descDe).map((b) => b.id);
    expect(eksik).toEqual([]);
    // ekEn olan her rozet ekDe de taşımalı (birim çipi)
    expect(WATCH_BADGES.filter((b) => b.ekEn && !b.ekDe).map((b) => b.id)).toEqual([]);
    expect(badgeAd(WATCH_BADGES[0], "de")).toBe(WATCH_BADGES[0].de);
    expect(badgeAciklama(WATCH_BADGES[0], "de")).toBe(WATCH_BADGES[0].descDe);

    // aile kartının sonrakiHedef'i dört dili de taşır (ES/PT/DE'de İngilizceye düşmesin)
    const kartlar = gruplaAileler(evaluateWatchBadges({}, []));
    const aile = kartlar.find((k) => k.sonrakiHedef);
    expect(aile.sonrakiHedef.de).toBeTruthy();
    expect(aile.sonrakiHedef.descDe).toBeTruthy();
    expect(aile.sonrakiHedef.es).toBeTruthy();
    expect(aile.sonrakiHedef.pt).toBeTruthy();
  });

  it("dönem mührü kartı ve kutlama aynı Almanca başlığı üretir", () => {
    const { muhurleriHesapla } = require("../components/badges/seasonSeals");
    const { odulAdi } = require("../components/badges/badgeMeta");
    const simdi = Date.UTC(2026, 9, 19, 12);
    const [muhur] = muhurleriHesapla(["2026-10-01"], { simdi });
    expect(muhur.de).toBe("Herbst 2026");
    expect(muhur.descDe).toMatch(/im Herbst 2026/);
    expect(muhur.es).toBe("Otoño 2026");
    expect(muhur.pt).toBe("Outono 2026");
    expect(odulAdi(muhur.id, "de")).toBe(muhur.de);
    expect(odulAdi(muhur.id, "es")).toBe(muhur.es);
  });
});

describe("Almanca: dil listeleri olan kaynak dosyaları", () => {
  it("sunucu bildirim dili listesi de'yi içeriyor ve metinleri var", () => {
    const sunucu = oku("functions/index.js");
    expect(sunucu).toMatch(/NOTIFICATION_LANGUAGES = \["tr", "en", "es", "pt", "de"\]/);
    expect(sunucu).toMatch(/\n {2}de: \{\n {4}someone: "Jemand"/);
    expect(sunucu).toMatch(/\n {2}de: \{\n {4}single: \(p\) =>/);
  });

  it("haftalık özetin Almanca metni ve yereli var", () => {
    const { DIGEST_STRINGS } = require("../functions/weeklyDigest");
    expect(DIGEST_STRINGS.de.locale).toBe("de-DE");
    expect(DIGEST_STRINGS.de.title(3)).toBe("Neu diese Woche (3)");
  });

  it("i18next fallback zincirinde de var; paket bağlı", () => {
    const indeks = oku("translations/index.js");
    expect(indeks).toMatch(/import de from "\.\/de\.json"/);
    expect(indeks).toMatch(/de: \{ translation: de \}/);
    expect(indeks).toMatch(/de: \["en", "tr"\]/);
  });

  it("keşif süzgecinde içerik dili olarak Almanca seçilebilir ve etiketi her dilde var", () => {
    const { LANGUAGES } = require("../utils/discoverFilters");
    const { DISCOVER_FILTERS_COPY } = require("../screens/shared/discoverFiltersCopy");
    expect(LANGUAGES).toContain("de");
    for (const dil of ["tr", "en", "es", "pt", "de"]) {
      expect(typeof DISCOVER_FILTERS_COPY[dil].languages.de).toBe("string");
    }
  });

  it("copyLanguage Almanca'yı kayıtlı dil olarak tanır", () => {
    expect(copyLanguage("de", ["tr", "en", "es", "pt", "de"])).toBe("de");
    expect(copyLanguage("de", ["tr", "en", "es", "pt"])).toBe("en");
  });
});

describe("Almanca: içe aktarma akışı ve düzeltilen denetim bulguları", () => {
  it("içe aktarma metinleri 5 dilde ve hata kodları çözülüyor", () => {
    const { getImportCopy, importErrorText, IMPORT_COPY } = require("../components/import/importCopy");
    const { ImportError } = require("../services/import/importErrors");
    expect(Object.keys(IMPORT_COPY).sort()).toEqual(["de", "en", "es", "pt", "tr"]);
    const de = getImportCopy("de");
    expect(importErrorText(new ImportError("noBundle"), de)).toBe(de.errors.noBundle);
    expect(importErrorText(new Error("ham"), de)).toBe(de.unexpected);
    expect(getImportCopy("fr")).toBe(IMPORT_COPY.en);
  });

  it("takvim etkinlik sayısı gerçek sayıyla çözümleniyor (autoI18n.n_etkinlik → {{n}})", () => {
    const i18next = require("i18next");
    for (const dil of ["tr", "en", "es", "pt", "de"]) {
      const paket = JSON.parse(oku(`translations/${dil}.json`));
      const metin = i18next.createInstance();
      metin.init({ lng: dil, resources: { [dil]: { translation: paket } }, interpolation: { escapeValue: false }, compatibilityJSON: "v3" });
      const sonuc = metin.t("autoI18n.n_etkinlik", { n: 5 });
      expect(sonuc).toContain("5");
      expect(sonuc).not.toContain("{{");
    }
    // CalendarScreen çağrısı artık `n` parametresiyle gönderiyor
    expect(oku("screens/calendar/CalendarScreen.js")).toMatch(/"autoI18n\.n_etkinlik", "\{\{n\}\} etkinlik", \{ n: monthCounts\.total \}/);
  });
});
