// __tests__/discoverFiltersBackup.test.js
//
// "Ne izlesem?" ayarlarının yedekle/geri yükle davranışı + KAPSAM BEKÇİSİ.
//   • kayıtlı süzgeçler ('discoverPresets') yedeğe girer ve içe aktarmada normalize edilir
//   • son kullanılan süzgeç ('discoverFilters') BİLEREK girmez (gezinme durumu)
//   • kayıttaki her seçenek filtre ekranında/sayfasında ve metin tablosunda bağlı (statik tarama)

const fs = require("fs");
const path = require("path");
const {
  BACKUP_ENTRIES,
  BACKUP_EXCLUDED,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  planImport,
  valueProblem,
} = require("../utils/settingsBackup");
const { MAX_SAVED_PRESETS, normalizeFilters } = require("../utils/discoverFilters");

const yedek = (settings) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: "2026-10-17T10:00:00.000Z",
  app: { version: "1.4.8", platform: "ios" },
  settings,
});

describe("yedek kapsamı", () => {
  test("kayıtlı süzgeçler 'Düzen' grubunda yedeğe girer", () => {
    const giris = BACKUP_ENTRIES.find((e) => e.key === "discoverPresets");
    expect(giris).toBeDefined();
    expect(giris.group).toBe("layout");
  });

  test("son kullanılan süzgeç yedeğe GİRMEZ ve nedeni yazılı", () => {
    expect(BACKUP_ENTRIES.find((e) => e.key === "discoverFilters")).toBeUndefined();
    expect(String(BACKUP_EXCLUDED.discoverFilters)).toMatch(/\S{10,}/);
  });
});

describe("içe aktarma", () => {
  const preset = (id, over = {}) => ({
    id,
    name: `Ad ${id}`,
    mediaType: "movie",
    filters: { genres: [35], minRating: 7, ...over },
  });

  test("geçerli liste kanonik hale gelir: bozuk öğeler ve kopyalar elenir, süzgeç normalize edilir", () => {
    const plan = planImport(
      yedek({
        discoverPresets: [
          preset("a", { genres: [35, 35, 28], era: "yok" }),
          preset("b", { minRating: 8 }),
          { id: "", name: "x", mediaType: "movie" },
          null,
          preset("c", { genres: [28, 35], minRating: 7 }), // a ile normalize sonrası aynı süzgeç → elenir
        ],
      }),
    );
    expect(plan.skipped).toEqual([]);
    const yazilan = plan.writes.find((w) => w.id === "discoverPresets").value;
    expect(yazilan.map((p) => p.id)).toEqual(["a", "b"]);
    expect(yazilan[0].filters).toEqual(normalizeFilters({ genres: [28, 35], era: "any", minRating: 7 }, "movie"));
  });

  test(`sınır ${MAX_SAVED_PRESETS} aşılırsa fazlası kesilir`, () => {
    const cok = Array.from({ length: MAX_SAVED_PRESETS + 5 }, (_, i) =>
      preset(`p${i}`, { genres: [], minRating: [6, 7, 8][i % 3], language: ["tr", "en", "es", "fr", "de", "it", "ko", "ja", "hi"][i % 9] }),
    );
    const plan = planImport(yedek({ discoverPresets: cok }));
    expect(plan.writes.find((w) => w.id === "discoverPresets").value.length).toBeLessThanOrEqual(MAX_SAVED_PRESETS);
  });

  test("boş liste geçerli (kayıtlı süzgeçleri temizler)", () => {
    const plan = planImport(yedek({ discoverPresets: [] }));
    expect(plan.skipped).toEqual([]);
    expect(plan.writes.find((w) => w.id === "discoverPresets").value).toEqual([]);
  });

  test("null silme isteği olarak kabul edilir", () => {
    const plan = planImport(yedek({ discoverPresets: null }));
    expect(plan.skipped).toEqual([]);
    expect(plan.writes.find((w) => w.id === "discoverPresets").value).toBeNull();
  });

  test.each([["x"], [5], [{ id: "a" }]])("dizi olmayan değer %j atlanır", (deger) => {
    const plan = planImport(yedek({ discoverPresets: deger }));
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toEqual([{ id: "discoverPresets", reason: expect.any(String) }]);
  });

  test("valueProblem diziyi kabul eder", () => {
    const giris = BACKUP_ENTRIES.find((e) => e.key === "discoverPresets");
    expect(valueProblem(giris, [preset("a")])).toBeNull();
    expect(valueProblem(giris, [])).toBeNull();
  });
});

describe("kapsam bekçisi: ekran ↔ sayfa ↔ metin", () => {
  const oku = (...parcalar) => fs.readFileSync(path.join(__dirname, "..", ...parcalar), "utf8");

  test("filtre sayfası çekirdekteki her seçenek kümesini çiziyor", () => {
    const sayfa = oku("components", "home", "DiscoverFilterSheet.js");
    // her küme sayfada import edilip döngüyle çiziliyor; yeni küme eklenip sayfaya bağlanmazsa kırılır
    for (const ad of ["ERAS", "RATINGS", "RUNTIMES", "LANGUAGES", "SORTS", "GENRES"]) {
      expect([ad, new RegExp(`\\b${ad}\\b`).test(sayfa)]).toEqual([ad, true]);
    }
    // iki anahtar: Platformlarımda ve İzlediklerimi gizle
    expect(sayfa).toContain("onMyPlatforms");
    expect(sayfa).toContain("hideWatched");
  });

  test("giriş: ana ekranın üst satırındaki keşfet düğmesi; liste bölümü (kart) KALMADI ve rota App.js'te kayıtlı", () => {
    const ana = oku("screens", "tabs", "DiscoverScreen.js");
    expect(ana).toMatch(/<DiscoverExploreAction /);
    // Sıra: keşfet, anahtar, arama (simetrik)
    expect(ana.indexOf("<DiscoverExploreAction")).toBeLessThan(ana.indexOf("<MediaTypeSwitch"));
    expect(ana.indexOf("<MediaTypeSwitch")).toBeLessThan(ana.indexOf("<DiscoverSearchAction"));
    // "Ne izlesem?" kartı ve gizlenebilir 'picker' bölümü silindi (çok yer kaplıyordu)
    for (const dosya of [["screens", "tabs", "TvShowScreen.js"], ["screens", "tabs", "MovieScreen.js"], ["utils", "sectionVisibility.js"]]) {
      expect(oku(...dosya)).not.toMatch(/DiscoverPickerCard|["']picker["']/);
    }
    expect(fs.existsSync(path.join(__dirname, "..", "components", "home", "DiscoverPickerCard.js"))).toBe(false);
    expect(oku("App.js")).toMatch(/name="DiscoverFilters"[\s\S]{0,200}DiscoverFiltersScreen/);
  });

  test("filtre ekranı ızgarayı SeeAllScreen'den alır (yinelenmiş ızgara yok)", () => {
    const ekran = oku("screens", "shared", "DiscoverFiltersScreen.js");
    expect(ekran).toMatch(/import \{ SeeAllGrid \} from "\.\/SeeAllScreen"/);
    expect(oku("screens", "shared", "SeeAllScreen.js")).toMatch(/export function SeeAllGrid/);
  });

  test("ağ katmanı include_adult yazmıyor (ayarı tmdbAdultGuard uyguluyor)", () => {
    for (const dosya of [
      ["services", "discoverQuery.js"],
      ["utils", "discoverFilters.js"],
      ["hooks", "useFilteredDiscover.js"],
    ]) {
      // satır VE blok yorumları çıkarılır: yasağı anlatan yorum testi kırmasın, gerçek kod kırsın
      const kaynak = oku(...dosya).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect([dosya.join("/"), /include_adult/.test(kaynak)]).toEqual([dosya.join("/"), false]);
    }
  });
});
