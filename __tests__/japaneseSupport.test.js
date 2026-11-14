// __tests__/japaneseSupport.test.js
//
// Japonca (ja) için yüzeyler arası sağlama: kayıt, cihaz dili, tarih, takvim, tür adları
// (CJK katlama dahil), rozet/Wrapped/seviye metinleri ve sunucu/yerel kaynak dosyalarının
// dil listeleri. Yapısal denetimin büyük kısmı i18nKeys / appLanguages / widgetNativeLanguage
// testlerinde.
const fs = require("fs");
const path = require("path");
const { cihazDilindenSec } = require("../utils/deviceLanguage");
const { kanonikTur, genreParts, foldGenreName } = require("../utils/genreCanon");
const { localizeGenreName } = require("../utils/genreDisplay");
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

describe("Japonca: kayıt ve cihaz dili", () => {
  it("ja desteklenir; Yakında listesinden çıktı", () => {
    expect(isSupportedAppLanguage("ja")).toBe(true);
    expect(COMING_SOON_LANGUAGES.map((l) => l.code)).not.toContain("ja");
  });

  it("Japonca cihaz ilk açılışta Japonca açılır", () => {
    expect(cihazDilindenSec([{ languageCode: "ja" }])).toBe("ja");
    expect(cihazDilindenSec([{ languageCode: "JA" }])).toBe("ja");
  });

  it("TMDB ja-JP, Intl ja-JP, yasal sayfa İngilizce", () => {
    expect(tmdbLanguageOf("ja")).toBe("ja-JP");
    expect(intlLocaleOf("ja")).toBe("ja-JP");
    expect(legalLanguageOf("ja")).toBe("en");
  });

  it("onboarding dil düğmesi döngüsü fr → ja → tr", () => {
    expect(nextAppLanguage("fr")).toBe("ja");
    expect(nextAppLanguage("ja")).toBe("tr");
  });
});

describe("Japonca: tarih, takvim ve tür adları", () => {
  it("rozet tarihi '2026年10月15日'", () => {
    expect(formatTarih("2026-10-15", "ja")).toBe("2026年10月15日");
  });

  it("tarih seçici ve takvim Japonca tabloları taşıyor", () => {
    const secici = oku("components/modals/DatePickerModal.js");
    expect(secici).toMatch(/ja: MONTHS_JA/);
    expect(secici).toMatch(/ja: WEEKDAYS_JA/);
    expect(secici).toMatch(/lang === "ja"/);
    expect(oku("screens/calendar/CalendarScreen.js")).toMatch(/LocaleConfig\.locales\.ja = \{/);
  });

  it("katlama Japonca karakterleri silmez (yoksa her ad boş string olur)", () => {
    expect(foldGenreName("ドラマ")).not.toBe("");
    expect(foldGenreName("Science Fiction")).toBe("science fiction");
    // Yarım genişlikli katakana ve tam genişlikli & aynı anahtara düşer.
    expect(foldGenreName("ﾄﾞﾗﾏ")).toBe(foldGenreName("ドラマ"));
  });

  it("Japonca TMDB tür adları kanonik kimliğe iner", () => {
    expect(kanonikTur("コメディ")).toBe("comedy");
    expect(kanonikTur("ドラマ")).toBe("drama");
    expect(kanonikTur("SF")).toBe("scifi");
    expect(kanonikTur("履歴")).toBe("history");
    expect(kanonikTur("謎")).toBe("mystery");
    expect(kanonikTur("西洋")).toBe("western");
    expect(kanonikTur("テレビ映画")).toBe("tvmovie");
    expect(kanonikTur("戦争 & 政治")).toBe("war");
    expect(kanonikTur("アクション＆アドベンチャー")).toBe("action");
    expect(genreParts("SF & ファンタジー")).toEqual(["scifi", "fantasy"]);
  });

  it("tür adı Japonca gösterilir", () => {
    expect(localizeGenreName("Comedy", "ja")).toBe("コメディ");
    expect(localizeGenreName("Kids", "ja")).toBe("キッズ");
  });
});

describe("Japonca: dizin dışı metinler", () => {
  it("Wrapped kişiliği Japonca", () => {
    const p = getPersonality("comedy", "ja");
    expect(p.title).toBe("笑いハンター");
    expect(p.desc).toMatch(/コメディ/);
  });

  it("perde adları Japonca, 20 kademe", () => {
    expect(perdeAdlariOf("ja")).toHaveLength(20);
    expect(perdeAdlariOf("ja")[0]).toBe("チケット所有者");
  });

  it("rozet kataloğunda her descIt'in yanında descJa var", () => {
    const katalog = oku("components/badges/watchBadgeCatalog.js");
    const it = (katalog.match(/\bdescIt:/g) || []).length;
    const ja = (katalog.match(/\bdescJa:/g) || []).length;
    expect(it).toBeGreaterThan(100);
    expect(ja).toBe(it);
  });
});

describe("Japonca: paket ve kaynak dosyaları", () => {
  it("i18next paketi ve fallback zinciri bağlı", () => {
    const indeks = oku("translations/index.js");
    expect(indeks).toMatch(/import ja from "\.\/ja\.json"/);
    expect(indeks).toMatch(/ja: \{ translation: ja \}/);
    expect(indeks).toMatch(/ja: \["en", "tr"\]/);
  });

  it("sunucu bildirimleri ve haftalık özet Japonca", () => {
    const sunucu = oku("functions/index.js");
    expect(sunucu).toMatch(/NOTIFICATION_LANGUAGES = \[[^\]]*"ja"/);
    expect(sunucu).toMatch(/\n  ja: \{\n    someone: "誰か"/);
    expect(oku("functions/weeklyDigest.js")).toMatch(/ja: \{ title:/);
  });

  it("izin metinleri, widget adları ve iOS dil listesi", () => {
    const app = JSON.parse(oku("app.json"));
    expect(app.expo.locales.ja).toBe("./native/locales/ja.json");
    expect(app.expo.ios.infoPlist.CFBundleLocalizations).toContain("ja");
    expect(JSON.parse(oku("native/locales/ja.json")).ios.NSCalendarsUsageDescription).toMatch(/カレンダー/);
    expect(oku("native/android-widgets/res/values-ja/widget_strings.xml")).toMatch(/Seelogd 近日公開/);
    expect(oku("targets/reminder-widget/ja.lproj/Localizable.strings")).toMatch(/"Seelogd Coming Up" = "Seelogd 近日公開";/);
  });

  it("yerel widget kodu Japoncayı tanıyor (Kotlin + Swift)", () => {
    expect(oku("native/android-widgets/java/com/smlztrk/seelogd/widget/WidgetLanguage.kt")).toMatch(/"ja" -> Locale\("ja", "JP"\)/);
    expect(oku("targets/reminder-widget/shared.swift")).toMatch(/case "ja": return ja/);
  });
});
