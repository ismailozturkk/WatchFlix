// __tests__/sectionVisibility.test.js
//
// "Hangi ekranda hangi bölüm görünsün" kararı: saf mantık + kalıcı kayıt + yedek +
// KAPSAM BEKÇİSİ.
//
// Bekçinin sebebi: listeye bölüm ekleyip ekrana bağlamayı (ya da tersini) unutmak
// SESSİZ bir hatadır — ayar ekranı bir anahtar gösterir, anahtar hiçbir şeyi
// değiştirmez (ya da ekranda gizlenemeyen bir raf kalır). Bu test o sınıfı build
// zamanına çeker: kayıttaki her bölüm kendi ekranının kaynağında kullanılmak ZORUNDA
// ve ekrandaki her bölüm kayıtta olmak zorunda.

const fs = require("fs");
const path = require("path");

const {
  SECTION_SCREENS,
  SECTION_SCREEN_IDS,
  countHiddenSections,
  filterVisibleSections,
  getSection,
  isSectionScreen,
  isSectionVisibilityCustomized,
  isSectionVisible,
  normalizeSectionVisibility,
  sectionsOf,
  setScreenSectionsVisible,
  setSectionVisible,
  storedSectionsOf,
  summarizeScreen,
  toStoredSectionVisibility,
} = require("../utils/sectionVisibility");

const KOK = path.join(__dirname, "..");
const oku = (...parcalar) => fs.readFileSync(path.join(KOK, ...parcalar), "utf8");
const bos = () => ({ tv: [], movie: [], hub: [], profile: [] });

describe("normalizeSectionVisibility", () => {
  test.each([null, undefined, "x", 5, true, [], ["tv"], () => 1])("bozuk girdi %p → boş harita, hata yok", (girdi) => {
    expect(normalizeSectionVisibility(girdi)).toEqual(bos());
  });

  test("dört ekranın hepsi her zaman var", () => {
    expect(Object.keys(normalizeSectionVisibility({})).sort()).toEqual(["hub", "movie", "profile", "tv"]);
  });

  test("bilinmeyen ekran ve bölüm kimlikleri atılır", () => {
    const n = normalizeSectionVisibility({
      tv: ["worldTour", "yok-bolum"],
      sinema: ["worldTour"],
      profile: ["notes", 5, null, { notes: 1 }],
    });
    expect(n).toEqual({ ...bos(), tv: ["worldTour"], profile: ["notes"] });
    expect("sinema" in n).toBe(false);
  });

  test("bir ekranın bölümü başka ekrana sızmaz (aynı ad, ayrı kayıt)", () => {
    // "trends" hem tv hem movie'de var; hub'da yok.
    const n = normalizeSectionVisibility({ tv: ["trends"], hub: ["trends"] });
    expect(n.tv).toEqual(["trends"]);
    expect(n.movie).toEqual([]);
    expect(n.hub).toEqual([]);
  });

  test("eski tek anahtarlı bölüm (ongoing) burada SAKLANMAZ", () => {
    expect(normalizeSectionVisibility({ tv: ["ongoing", "worldTour"] }).tv).toEqual(["worldTour"]);
  });

  test("tekrarlar silinir, sıra kanonik; aynı küme = aynı JSON", () => {
    const a = normalizeSectionVisibility({ profile: ["notes", "stats", "notes", "badges"] });
    const b = normalizeSectionVisibility({ profile: ["badges", "stats", "notes"] });
    expect(a.profile).toEqual(["badges", "stats", "notes"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("dizi olmayan ekran değeri yok sayılır", () => {
    expect(normalizeSectionVisibility({ tv: "worldTour", movie: { worldTour: true } })).toEqual(bos());
  });

  test("girdiyi değiştirmez", () => {
    const girdi = { tv: ["worldTour", "worldTour"] };
    const kopya = JSON.parse(JSON.stringify(girdi));
    normalizeSectionVisibility(girdi);
    expect(girdi).toEqual(kopya);
  });
});

describe("isSectionVisible", () => {
  test("varsayılan: her şey görünür (kayıt boş/null/bozuk)", () => {
    for (const hidden of [null, undefined, {}, bos(), "x"]) {
      expect(isSectionVisible(hidden, "profile", "notes")).toBe(true);
    }
  });

  test("gizli listedeki bölüm görünmez, ötekiler görünür", () => {
    const hidden = { ...bos(), profile: ["notes"] };
    expect(isSectionVisible(hidden, "profile", "notes")).toBe(false);
    expect(isSectionVisible(hidden, "profile", "stats")).toBe(true);
    expect(isSectionVisible(hidden, "hub", "notes")).toBe(true);
  });

  test("bilinmeyen ekran/bölüm görünür sayılır (kayıtta olmayanı gizleme yetkisi yok)", () => {
    const hidden = { ...bos(), tv: ["worldTour"] };
    expect(isSectionVisible(hidden, "yok", "worldTour")).toBe(true);
    expect(isSectionVisible(hidden, "tv", "yok")).toBe(true);
  });
});

describe("filterVisibleSections", () => {
  const raflar = [{ key: "trends" }, { key: "worldTour" }, { key: "genres" }];

  test("hiçbir şey gizli değilse AYNI diziyi döner (gereksiz yeniden çizim yok)", () => {
    expect(filterVisibleSections(bos(), "tv", raflar)).toBe(raflar);
    expect(filterVisibleSections(null, "tv", raflar)).toBe(raflar);
    expect(filterVisibleSections({ ...bos(), movie: ["worldTour"] }, "tv", raflar)).toBe(raflar);
  });

  test("gizli rafı eler, sırayı korur", () => {
    const sonuc = filterVisibleSections({ ...bos(), tv: ["worldTour"] }, "tv", raflar);
    expect(sonuc.map((r) => r.key)).toEqual(["trends", "genres"]);
    expect(raflar).toHaveLength(3);
  });

  test("gizli liste ekranda olmayan rafı adlandırıyorsa (koşullu raf) AYNI diziyi döner", () => {
    const sonuc = filterVisibleSections({ ...bos(), tv: ["subscriptions"] }, "tv", raflar);
    expect(sonuc).toBe(raflar);
  });

  test("hepsi gizliyse boş dizi", () => {
    expect(filterVisibleSections({ ...bos(), tv: ["trends", "worldTour", "genres"] }, "tv", raflar)).toEqual([]);
  });

  test("özel kimlik çıkarıcı", () => {
    const sonuc = filterVisibleSections({ ...bos(), hub: ["games"] }, "hub", [{ id: "feed" }, { id: "games" }], (x) => x.id);
    expect(sonuc).toEqual([{ id: "feed" }]);
  });
});

describe("setSectionVisible / setScreenSectionsVisible", () => {
  test("gizle → göster gidiş-dönüşü boş haritaya döner", () => {
    const gizli = setSectionVisible(null, "profile", "notes", false);
    expect(gizli.profile).toEqual(["notes"]);
    expect(setSectionVisible(gizli, "profile", "notes", true)).toEqual(bos());
  });

  test("aynı işlemi tekrarlamak değeri değiştirmez (idempotent)", () => {
    const bir = setSectionVisible(null, "tv", "worldTour", false);
    const iki = setSectionVisible(bir, "tv", "worldTour", false);
    expect(iki).toEqual(bir);
    expect(setSectionVisible(bos(), "tv", "worldTour", true)).toEqual(bos());
  });

  test("diğer ekranlar ve bölümler etkilenmez", () => {
    let h = setSectionVisible(null, "tv", "worldTour", false);
    h = setSectionVisible(h, "movie", "worldTour", false);
    h = setSectionVisible(h, "tv", "genres", false);
    h = setSectionVisible(h, "tv", "worldTour", true);
    expect(h).toEqual({ ...bos(), tv: ["genres"], movie: ["worldTour"] });
  });

  test("girdiyi değiştirmez", () => {
    const girdi = { ...bos(), tv: ["genres"] };
    const kopya = JSON.parse(JSON.stringify(girdi));
    setSectionVisible(girdi, "tv", "trends", false);
    setScreenSectionsVisible(girdi, "tv", false);
    expect(girdi).toEqual(kopya);
  });

  test("bilinmeyen ekran/bölüm ve eski tek anahtarlı bölüm yok sayılır", () => {
    expect(setSectionVisible(null, "yok", "notes", false)).toEqual(bos());
    expect(setSectionVisible(null, "profile", "yok", false)).toEqual(bos());
    expect(setSectionVisible(null, "tv", "ongoing", false)).toEqual(bos());
  });

  test("ekranın tüm bölümlerini gizler/gösterir; eski tek anahtarlı bölüm kayda girmez", () => {
    const hepsi = setScreenSectionsVisible(null, "tv", false);
    expect(hepsi.tv).toEqual(storedSectionsOf("tv").map((s) => s.id));
    expect(hepsi.tv).not.toContain("ongoing");
    expect(hepsi.movie).toEqual([]);
    expect(setScreenSectionsVisible(hepsi, "tv", true)).toEqual(bos());
    expect(setScreenSectionsVisible(null, "yok", false)).toEqual(bos());
  });
});

describe("sayım ve özelleştirme", () => {
  test("countHiddenSections ekran bazında ve toplamda", () => {
    const h = { ...bos(), tv: ["worldTour", "genres"], profile: ["notes"] };
    expect(countHiddenSections(h, "tv")).toBe(2);
    expect(countHiddenSections(h, "movie")).toBe(0);
    expect(countHiddenSections(h)).toBe(3);
    expect(countHiddenSections(null)).toBe(0);
  });

  test("isSectionVisibilityCustomized yalnız gizli bölüm varken true", () => {
    expect(isSectionVisibilityCustomized(null)).toBe(false);
    expect(isSectionVisibilityCustomized(bos())).toBe(false);
    expect(isSectionVisibilityCustomized({ ...bos(), hub: ["games"] })).toBe(true);
  });

  test("toStoredSectionVisibility: hiçbir şey gizli değilse null (anahtar silinir)", () => {
    expect(toStoredSectionVisibility(null)).toBeNull();
    expect(toStoredSectionVisibility(bos())).toBeNull();
    expect(toStoredSectionVisibility({ tv: ["ongoing"] })).toBeNull();
    expect(toStoredSectionVisibility({ hub: ["games", "yok"] })).toEqual({ ...bos(), hub: ["games"] });
  });

  test("summarizeScreen: toplam eski tek anahtarlıyı da sayar; görünür sayı onun ayarına bakar", () => {
    const toplam = sectionsOf("tv").length;
    expect(summarizeScreen(null, "tv")).toEqual({ total: toplam, shown: toplam, hidden: 0 });
    expect(summarizeScreen(null, "tv", { showOngoingTvShows: false })).toEqual({ total: toplam, shown: toplam - 1, hidden: 1 });
    expect(summarizeScreen({ ...bos(), tv: ["genres"] }, "tv", { showOngoingTvShows: false }).hidden).toBe(2);
    expect(summarizeScreen(null, "yok")).toEqual({ total: 0, shown: 0, hidden: 0 });
  });
});

describe("kayıt bütünlüğü", () => {
  const ionicons = JSON.parse(
    fs.readFileSync(
      path.join(KOK, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"),
      "utf8",
    ),
  );
  const TINTS = ["blue", "purple", "green", "amber", "teal"];

  test("dört ekran: tv, movie, hub, profile", () => {
    expect(SECTION_SCREEN_IDS).toEqual(["tv", "movie", "hub", "profile"]);
    expect(isSectionScreen("tv")).toBe(true);
    expect(isSectionScreen("settings")).toBe(false);
  });

  test("her ekranda bölüm var, kimlikler ekran içinde benzersiz", () => {
    for (const screen of SECTION_SCREENS) {
      const ids = screen.sections.map((s) => s.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("her ekran ve bölüm gerçek bir Ionicons simgesi ve geçerli bir renk taşır", () => {
    for (const screen of SECTION_SCREENS) {
      expect(ionicons[screen.icon]).toBeDefined();
      for (const item of screen.sections) {
        expect(ionicons[item.icon]).toBeDefined();
        expect(TINTS).toContain(item.tint);
      }
    }
  });

  test("kayıt donmuş (çalışma anında değiştirilemez)", () => {
    expect(Object.isFrozen(SECTION_SCREENS)).toBe(true);
    expect(Object.isFrozen(SECTION_SCREENS[0])).toBe(true);
    expect(Object.isFrozen(SECTION_SCREENS[0].sections)).toBe(true);
    expect(Object.isFrozen(SECTION_SCREENS[0].sections[0])).toBe(true);
  });

  test("eski tek anahtarlı bölümün anahtarı registry'de gerçek bir boolean ayar", () => {
    const { Keys } = require("../services/storage/registry");
    const eskiler = SECTION_SCREENS.flatMap((s) => s.sections.filter((x) => x.legacy));
    expect(eskiler.map((x) => x.id)).toEqual(["ongoing"]);
    for (const item of eskiler) {
      expect(Keys[item.legacy]).toBeDefined();
      expect(Keys[item.legacy].type).toBe("boolean");
      expect(Keys[item.legacy].default).toBe(true);
    }
  });

  test("onay isteyen tek bölüm: profildeki arkadaş çubuğu (başka giriş yok)", () => {
    const onaylilar = SECTION_SCREENS.flatMap((s) => s.sections.filter((x) => x.confirmHide).map((x) => `${s.id}.${x.id}`));
    expect(onaylilar).toEqual(["profile.friends"]);
  });

  test("getSection bilinen bölümü döner, bilinmeyene null", () => {
    expect(getSection("movie", "worldTour").icon).toBe("earth-outline");
    expect(getSection("movie", "yok")).toBeNull();
    expect(getSection("yok", "worldTour")).toBeNull();
  });
});

describe("kalıcı kayıt (Keys.sectionVisibility)", () => {
  // MMKV taklidi kök __mocks__ klasöründen otomatik gelir (bkz. storage.test.js).
  const { __resetAllMMKV } = require("react-native-mmkv");
  const { Keys, get, set, remove } = require("../services/storage");
  const { __resetStoreCaches } = require("../services/storage/store");
  const { __resetStores } = require("../services/storage/instances");

  beforeEach(() => {
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
  });

  test("kayıt yoksa normalize sonucu 'hepsi görünür'", () => {
    expect(get(Keys.sectionVisibility)).toBeNull();
    expect(normalizeSectionVisibility(get(Keys.sectionVisibility))).toEqual(bos());
  });

  test("yazılan tercih gidiş-dönüşte aynen gelir", () => {
    let h = setSectionVisible(null, "profile", "notes", false);
    h = setSectionVisible(h, "movie", "worldTour", false);
    expect(set(Keys.sectionVisibility, h)).toBe(true);
    expect(normalizeSectionVisibility(get(Keys.sectionVisibility))).toEqual(h);
  });

  test("düz nesne olmayan değer reddedilir (dizi/dizge depoya girmez)", () => {
    expect(set(Keys.sectionVisibility, ["notes"])).toBe(false);
    expect(set(Keys.sectionVisibility, "notes")).toBe(false);
    expect(isSectionVisibilityCustomized(get(Keys.sectionVisibility))).toBe(false);
  });

  test("anahtarı silmek varsayılana döndürür", () => {
    set(Keys.sectionVisibility, setSectionVisible(null, "hub", "games", false));
    expect(remove(Keys.sectionVisibility)).toBe(true);
    expect(get(Keys.sectionVisibility)).toBeNull();
  });
});

describe("yedek (settingsBackup)", () => {
  const {
    BACKUP_ENTRIES,
    BACKUP_FORMAT,
    BACKUP_VERSION,
    planImport,
    valueProblem,
  } = require("../utils/settingsBackup");

  const yedek = (settings) => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: "2026-10-17T10:00:00.000Z",
    app: { version: "1.4.9", platform: "ios" },
    settings,
  });

  test("ekran bölümleri yedeğe girer ('Düzen' grubunda)", () => {
    const giris = BACKUP_ENTRIES.find((e) => e.key === "sectionVisibility");
    expect(giris).toBeDefined();
    expect(giris.group).toBe("layout");
  });

  test("içe aktarılan değer kanonik hale gelir; bilinmeyenler elenir", () => {
    const plan = planImport(
      yedek({ sectionVisibility: { tv: ["worldTour", "ongoing", "yok"], sinema: ["x"], profile: ["notes", "notes"] } }),
    );
    expect(plan.skipped).toEqual([]);
    const yazilan = plan.writes.find((w) => w.id === "sectionVisibility").value;
    expect(yazilan).toEqual({ ...bos(), tv: ["worldTour"], profile: ["notes"] });
  });

  test.each([["x"], [5], [["notes"]]])("geçersiz değer %j atlanır", (deger) => {
    const plan = planImport(yedek({ sectionVisibility: deger }));
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toEqual([{ id: "sectionVisibility", reason: expect.any(String) }]);
  });

  test("valueProblem düz nesneyi kabul eder", () => {
    const giris = BACKUP_ENTRIES.find((e) => e.key === "sectionVisibility");
    expect(valueProblem(giris, bos())).toBeNull();
  });
});

// ── Kapsam bekçisi: kayıt ↔ ekran kaynağı ────────────────────────────────────

describe("kapsam bekçisi: kayıttaki her bölüm ekranında bağlı, ekrandaki her bölüm kayıtta", () => {
  const kimlikler = (kaynak, desen) => [...kaynak.matchAll(desen)].map((m) => m[1]);
  const esit = (a, b) => expect([...new Set(a)].sort()).toEqual([...new Set(b)].sort());
  const kayit = (ekran) => sectionsOf(ekran).map((s) => s.id);

  test("Diziler: ekrandaki raf anahtarları = kayıt (ve gizleme süzgeci bağlı)", () => {
    const kaynak = oku("screens", "tabs", "TvShowScreen.js");
    esit(kimlikler(kaynak, /\bkey:\s*"(\w+)"/g), kayit("tv"));
    expect(kaynak).toContain('useScreenSections("tv")');
    expect(kaynak).toMatch(/filterHiddenSections\(items\.filter\(Boolean\)\)/);
    expect(kaynak).toContain("ListEmptyComponent");
  });

  test("Filmler: ekrandaki raf anahtarları = kayıt (ve gizleme süzgeci bağlı)", () => {
    const kaynak = oku("screens", "tabs", "MovieScreen.js");
    esit(kimlikler(kaynak, /\bkey:\s*"(\w+)"/g), kayit("movie"));
    expect(kaynak).toContain('useScreenSections("movie")');
    expect(kaynak).toMatch(/filterHiddenSections\(\[/);
    expect(kaynak).toContain("ListEmptyComponent");
  });

  test("Hub: show(\"…\") çağrıları = kayıt", () => {
    const kaynak = oku("screens", "tabs", "HubScreen.js");
    esit(kimlikler(kaynak, /\bshow\("(\w+)"\)/g), kayit("hub"));
    expect(kaynak).toContain('useScreenSections("hub")');
  });

  test("Profil: showSection(\"…\") çağrıları = kayıt", () => {
    const kaynak = oku("screens", "tabs", "ProfileScreen.js");
    esit(kimlikler(kaynak, /\bshowSection\("(\w+)"\)/g), kayit("profile"));
    expect(kaynak).toContain('useScreenSections("profile")');
  });

  test("Tüm bölümler gizlenince Hub ve Profil boş kalmaz (bildirim kartı bağlı)", () => {
    for (const [dosya, ekran] of [["HubScreen.js", "hub"], ["ProfileScreen.js", "profile"]]) {
      const kaynak = oku("screens", "tabs", dosya);
      expect(kaynak).toContain("SectionsHiddenNotice");
      expect(kaynak).toContain(`screen="${ekran}"`);
    }
  });

  test("ayar sayfası rotası kayıtlı ve Kişiselleştirme'den açılıyor", () => {
    expect(oku("App.js")).toMatch(/name="SectionVisibilityScreen"[\s\S]{0,200}SectionVisibilityScreen"\)\.default/);
    expect(oku("screens", "tabs", "settings", "PersonalizationScreen.js")).toContain(
      'navigate("SectionVisibilityScreen")',
    );
  });

  test("Devam Edenler kendi ayarını (showOngoingTvShows) kullanmaya devam eder", () => {
    expect(oku("screens", "tabs", "TvShowScreen.js")).toContain("showOngoingTvShows");
  });
});
