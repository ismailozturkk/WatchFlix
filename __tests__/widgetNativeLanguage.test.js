// __tests__/widgetNativeLanguage.test.js
//
// Native widget'ların (Kotlin / Swift) dil listesi, JS'teki dil kaydıyla AYNI kalmalı.
//
// NEDEN: widget metinleri JS'te değil native kodda; yeni dil kayda eklenince widget
// sessizce İngilizceye düşer ve hiçbir JS testi bunu görmez. Burada kayıttaki her dilin
// (yedek dil İngilizce hariç) iki native tarafta da tanımlı olduğu ve eski
// "isTurkish" ikili kalıbının geri gelmediği doğrulanır.
const fs = require("fs");
const path = require("path");
const { SUPPORTED_LANGUAGE_CODES, FALLBACK_LANGUAGE } = require("../utils/appLanguages");

const KOK = path.join(__dirname, "..");
const oku = (...parcalar) => fs.readFileSync(path.join(KOK, ...parcalar), "utf8");

const ANDROID_DIZIN = path.join("native", "android-widgets", "java", "com", "smlztrk", "seelogd", "widget");
const SWIFT_DIZIN = path.join("targets", "reminder-widget");

// Yedek dil (en) listede yazılmaz: kayıtsız her şey zaten ona düşer.
const beklenen = SUPPORTED_LANGUAGE_CODES.filter((kod) => kod !== FALLBACK_LANGUAGE).sort();

const kodlar = (govde) => [...govde.matchAll(/"([a-z]{2})"/g)].map((e) => e[1]).sort();

describe("native widget dil listesi", () => {
  it("Android WidgetLanguage.SUPPORTED kayıtla aynı", () => {
    const kaynak = oku(ANDROID_DIZIN, "WidgetLanguage.kt");
    const govde = kaynak.match(/SUPPORTED\s*=\s*setOf\(([^)]*)\)/);
    expect(govde).not.toBeNull();
    expect(kodlar(govde[1])).toEqual(beklenen);
  });

  it("iOS widgetSupportedLanguages kayıtla aynı", () => {
    const kaynak = oku(SWIFT_DIZIN, "shared.swift");
    const govde = kaynak.match(/widgetSupportedLanguages:\s*Set<String>\s*=\s*\[([^\]]*)\]/);
    expect(govde).not.toBeNull();
    expect(kodlar(govde[1])).toEqual(beklenen);
  });

  it("Android pick() her kayıtlı dilin kolunu taşır", () => {
    const kaynak = oku(ANDROID_DIZIN, "WidgetLanguage.kt");
    for (const kod of beklenen) expect(kaynak).toMatch(new RegExp(`"${kod}"\\s*->`));
  });

  it("iOS widgetPick() her kayıtlı dilin kolunu taşır", () => {
    const kaynak = oku(SWIFT_DIZIN, "shared.swift");
    for (const kod of beklenen) expect(kaynak).toMatch(new RegExp(`case "${kod}":`));
  });

  it("eski ikili 'isTurkish' kalıbı native koda geri girmemiş", () => {
    const dosyalar = [
      ...fs.readdirSync(path.join(KOK, ANDROID_DIZIN)).filter((d) => d.endsWith(".kt")).map((d) => path.join(ANDROID_DIZIN, d)),
      ...fs.readdirSync(path.join(KOK, SWIFT_DIZIN)).filter((d) => d.endsWith(".swift")).map((d) => path.join(SWIFT_DIZIN, d)),
    ];
    expect(dosyalar.length).toBeGreaterThan(8);
    const sizan = dosyalar.filter((d) => /isTurkish\b|isTurkishLanguage|hasPrefix\("tr"\)|startsWith\("tr"\)/.test(oku(d)));
    expect(sizan).toEqual([]);
  });

  it("Android config eklentisi java klasörünü bütün olarak kopyalıyor (yeni .kt dosyası ayrıca eklenmez)", () => {
    const eklenti = oku("plugins", "withAndroidWidgets.js");
    expect(eklenti).toMatch(/cpSync\(\s*path\.join\(SRC_DIR,\s*"java"\)/);
  });
});
