// __tests__/frenchSupport.test.js
//
// Fransızca (fr) için yüzeyler arası sağlama: kayıt, cihaz dili, tarih, takvim, tür adları,
// rozet/Wrapped/seviye metinleri ve sunucu/yerel kaynak dosyalarının dil listeleri. Yapısal
// denetimin büyük kısmı i18nKeys / appLanguages / widgetNativeLanguage testlerinde.
const fs = require("fs");
const path = require("path");
const { cihazDilindenSec } = require("../utils/deviceLanguage");
const { kanonikTur } = require("../utils/genreCanon");
const { getPersonality } = require("../utils/wrapped");
const { perdeAdlariOf } = require("../utils/watchScoring");
const { formatTarih } = require("../components/badges/badgeFormat");
const {
  legalLanguageOf,
  intlLocaleOf,
  tmdbLanguageOf,
  nextAppLanguage,
  isSupportedAppLanguage,
  COMING_SOON_LANGUAGES,
} = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const oku = (yol) => fs.readFileSync(path.join(KOK, yol), "utf8").split(String.fromCharCode(13, 10)).join("\n");

describe("Fransızca: kayıt ve cihaz dili", () => {
  it("fr desteklenir; Yakında listesinden çıktı", () => {
    expect(isSupportedAppLanguage("fr")).toBe(true);
    expect(COMING_SOON_LANGUAGES.map((l) => l.code)).not.toContain("fr");
  });

  it("Fransızca cihaz ilk açılışta Fransızca açılır (fr, fr-CA)", () => {
    expect(cihazDilindenSec([{ languageCode: "fr" }])).toBe("fr");
    expect(cihazDilindenSec([{ languageCode: "FR" }])).toBe("fr");
  });

  it("TMDB fr-FR, Intl fr-FR, yasal sayfa İngilizce", () => {
    expect(tmdbLanguageOf("fr")).toBe("fr-FR");
    expect(intlLocaleOf("fr")).toBe("fr-FR");
    expect(legalLanguageOf("fr")).toBe("fr");
  });

  it("onboarding dil düğmesi döngüsü it → fr → ja", () => {
    expect(nextAppLanguage("it")).toBe("fr");
    expect(nextAppLanguage("fr")).toBe("ja");
  });
});

describe("Fransızca: tarih, takvim ve tür adları", () => {
  it("rozet tarihi '15 octobre 2026', ayın ilk günü '1er'", () => {
    expect(formatTarih("2026-10-15", "fr")).toBe("15 octobre 2026");
    expect(formatTarih("2026-01-01", "fr")).toBe("1er janvier 2026");
  });

  it("tarih seçici ve takvim Fransızca tabloları taşıyor", () => {
    const secici = oku("components/modals/DatePickerModal.js");
    expect(secici).toMatch(/fr: MONTHS_FR/);
    expect(secici).toMatch(/fr: WEEKDAYS_FR/);
    expect(secici).toMatch(/lang === "fr"/);
    expect(oku("screens/calendar/CalendarScreen.js")).toMatch(/LocaleConfig\.locales\.fr = \{/);
  });

  it("Fransızca TMDB tür adları kanonik kimliğe iner", () => {
    expect(kanonikTur("Comédie")).toBe("comedy");
    expect(kanonikTur("Drame")).toBe("drama");
    expect(kanonikTur("Science-Fiction")).toBe("scifi");
    expect(kanonikTur("Science-Fiction & Fantastique")).toBe("scifi");
    expect(kanonikTur("Guerre & Politique")).toBe("war");
    expect(kanonikTur("Téléfilm")).toBe("tvmovie");
  });
});

describe("Fransızca: dizin dışı metinler", () => {
  it("Wrapped kişiliği ve açıklaması Fransızca", () => {
    const p = getPersonality("comedy", "fr");
    expect(p.title).toBe("Chasseur de rires");
    expect(p.desc).toBe("Une bonne comédie répare n'importe quelle mauvaise journée.");
  });

  it("perde adları Fransızca, 20 kademe", () => {
    expect(perdeAdlariOf("fr")).toHaveLength(20);
    expect(perdeAdlariOf("fr")[0]).toBe("Billet en main");
  });

  it("rozet kataloğunda her descIt'in yanında descFr var", () => {
    const katalog = oku("components/badges/watchBadgeCatalog.js");
    const it = (katalog.match(/\bdescIt:/g) || []).length;
    const fr = (katalog.match(/\bdescFr:/g) || []).length;
    expect(it).toBeGreaterThan(100);
    expect(fr).toBe(it);
  });
});

describe("Fransızca: paket ve kaynak dosyaları", () => {
  it("i18next paketi ve fallback zinciri bağlı", () => {
    const indeks = oku("translations/index.js");
    expect(indeks).toMatch(/import fr from "\.\/fr\.json"/);
    expect(indeks).toMatch(/fr: \{ translation: fr \}/);
    expect(indeks).toMatch(/fr: \["en", "tr"\]/);
  });

  it("sunucu bildirimleri ve haftalık özet Fransızca", () => {
    const sunucu = oku("functions/index.js");
    expect(sunucu).toMatch(/NOTIFICATION_LANGUAGES = \[[^\]]*"fr"/);
    expect(sunucu).toMatch(/\n  fr: \{\n    someone: "Quelqu'un"/);
    expect(oku("functions/weeklyDigest.js")).toMatch(/fr: \{ title:/);
  });

  it("izin metinleri, widget adları ve iOS dil listesi", () => {
    const app = JSON.parse(oku("app.json"));
    expect(app.expo.locales.fr).toBe("./native/locales/fr.json");
    expect(app.expo.ios.infoPlist.CFBundleLocalizations).toContain("fr");
    expect(JSON.parse(oku("native/locales/fr.json")).ios.NSCalendarsUsageDescription).toMatch(/calendrier/);
    expect(oku("native/android-widgets/res/values-fr/widget_strings.xml")).toMatch(/Seelogd À venir/);
    expect(oku("targets/reminder-widget/fr.lproj/Localizable.strings")).toMatch(/"Seelogd Coming Up" = "Seelogd À venir";/);
  });
});
