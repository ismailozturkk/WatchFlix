// __tests__/tabBarIcons.test.js
//
// Sekme çubuğu simge adı bekçisi.
//
// NEDEN: yanlış bir SF Symbol adı iOS'ta HİÇBİR HATA vermeden BOŞ bir sekme
// simgesi çizer; yanlış bir Ionicons adı ise kırmızı uyarı simgesi çizer.
// İkisi de yalnız cihazda, çıplak gözle fark edilir. Simgeleri değiştirirken
// elle uydurulmuş ad bu testte kırmızıya döner.
//
// KAYNAKLAR: Ionicons için @expo/vector-icons'un gerçek glyph haritası; SF
// Symbols için `sf-symbols-typescript` (native-stack ve expo-image'ın bağımlılığı)
// — her ad, hangi iOS sürümünde var olduğunu da taşıyor. Yerel sekme modu iOS 18+
// ister (utils/tabBarCapabilities.js), bu yüzden 18'e kadar gelen her sembol güvenli.

const fs = require("fs");
const path = require("path");
const { AI_ACTION, TAB_DEFINITIONS } = require("../utils/tabBarModel");

const KOK = path.join(__dirname, "..");
const ENAZ_YEREL_IOS = 18;

const ionicons = JSON.parse(
  fs.readFileSync(
    path.join(KOK, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"),
    "utf8",
  ),
);

// "@name SF Symbols X.Y" ile başlayan her blok: ilk "iOS vN+" gereksinimdir,
// `export type` sonrası tırnaklı her şey bir sembol adıdır.
function sfSembolleri() {
  const metin = fs.readFileSync(path.join(KOK, "node_modules/sf-symbols-typescript/dist/index.d.ts"), "utf8");
  const parcalar = metin.split(/@name (SF Symbols [\d.]+)/).slice(1);
  const harita = new Map();
  for (let i = 0; i < parcalar.length; i += 2) {
    const ios = Number.parseFloat((parcalar[i + 1].match(/iOS v([\d.]+)\+/) || [])[1]);
    const govde = parcalar[i + 1];
    for (const eslesme of govde.slice(govde.indexOf("export type")).matchAll(/'([a-z0-9.]+)'/g)) {
      if (!harita.has(eslesme[1])) harita.set(eslesme[1], ios);
    }
  }
  return harita;
}

const sf = sfSembolleri();

describe("sekme çubuğu simgeleri", () => {
  it("bekçi gerçekten çalışıyor (ayrıştırma bozulursa test sessizce yeşile dönmesin)", () => {
    expect(Object.keys(ionicons).length).toBeGreaterThan(1000);
    expect(sf.size).toBeGreaterThan(5000);
    // Bilinen iki uç: var olan ve olmayan ad.
    expect(sf.has("gearshape.fill")).toBe(true);
    expect(sf.has("bu.sembol.yok")).toBe(false);
    expect(ionicons["settings-outline"]).toBeDefined();
    expect(ionicons["bu-simge-yok"]).toBeUndefined();
  });

  it("dört sekmenin hepsi tam tanımlı ve Ionicons ailesinde", () => {
    expect(TAB_DEFINITIONS).toHaveLength(4);
    for (const tab of TAB_DEFINITIONS) {
      expect(tab.family).toBe("Ionicons");
      for (const alan of ["icon", "iconOutline", "sf", "selectedSf"]) {
        expect(typeof tab[alan]).toBe("string");
        expect(tab[alan].length).toBeGreaterThan(0);
      }
    }
  });

  it.each(TAB_DEFINITIONS.map((tab) => [tab.name, tab]))(
    "%s: Ionicons adları (dolu + çerçeve) gerçekten var",
    (_ad, tab) => {
      expect(ionicons[tab.icon]).toBeDefined();
      expect(ionicons[tab.iconOutline]).toBeDefined();
    },
  );

  it.each(TAB_DEFINITIONS.map((tab) => [tab.name, tab]))(
    "%s: SF Symbol adları (normal + seçili) var ve yerel modun ilk iOS sürümünde mevcut",
    (_ad, tab) => {
      for (const ad of [tab.sf, tab.selectedSf]) {
        expect(sf.has(ad)).toBe(true);
        expect(sf.get(ad)).toBeLessThanOrEqual(ENAZ_YEREL_IOS);
      }
    },
  );

  it("her sekmede seçili ve pasif durum birbirinden ayırt edilebilir", () => {
    for (const tab of TAB_DEFINITIONS) {
      expect(tab.icon).not.toBe(tab.iconOutline);
      expect(tab.selectedSf).not.toBe(tab.sf);
    }
  });

  it("iki sekme aynı simgeyi paylaşmıyor", () => {
    // Ionicons ve SF Symbols AYRI ad alanları ("tv" ikisinde de var): ayrı say.
    for (const alan of ["icon", "iconOutline", "sf", "selectedSf"]) {
      const adlar = TAB_DEFINITIONS.map((tab) => tab[alan]);
      expect(new Set(adlar).size).toBe(adlar.length);
    }
  });

  // Yapay zeka sekme DEĞİL ama aynı çubukta durur: yanlış ad iOS'ta boş yuvarlak
  // düğme (SF), Android'de kırmızı uyarı simgesi (Ionicons) çizer.
  describe("yapay zeka düğmesi", () => {
    it("Ionicons adı gerçekten var, SF Symbol adı var ve yerel modun ilk iOS sürümünde mevcut", () => {
      expect(AI_ACTION.family).toBe("Ionicons");
      expect(ionicons[AI_ACTION.icon]).toBeDefined();
      expect(sf.has(AI_ACTION.sf)).toBe(true);
      expect(sf.get(AI_ACTION.sf)).toBeLessThanOrEqual(ENAZ_YEREL_IOS);
    });

    it("hiçbir sekmenin simgesiyle karışmıyor", () => {
      for (const tab of TAB_DEFINITIONS) {
        expect([tab.icon, tab.iconOutline]).not.toContain(AI_ACTION.icon);
        expect([tab.sf, tab.selectedSf]).not.toContain(AI_ACTION.sf);
      }
    });
  });
});
