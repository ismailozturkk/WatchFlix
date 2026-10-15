// __tests__/settingsBackup.test.js
//
// Ayarları dışa/içe aktarma çekirdeği. Bozulursa belirti SESSİZDİR: yedek
// "başarılı" görünür ama bir ayar dönmez, ya da elle düzenlenmiş bir dosya
// uygulamayı açılışta bozuk temayla bırakır. Bu yüzden iki şey sabitlendi:
//   1) kapsam bekçisi — yeni bir `settings` anahtarı eklenip yedek kararı
//      verilmezse test kırılır,
//   2) güvenilmeyen girdi — bozuk/yabancı değerler diske inmeden elenir.

const { Keys } = require("../services/storage/registry");
const {
  BACKUP_ENTRIES,
  BACKUP_EXCLUDED,
  BACKUP_FORMAT,
  BACKUP_GROUPS,
  BACKUP_VERSION,
  MAX_BACKUP_CHARS,
  backupFileName,
  buildBackup,
  parseBackup,
  planImport,
  sanitizeCustomThemes,
  serializeBackup,
  summarizeBackupContents,
  valueProblem,
} = require("../utils/settingsBackup");

const tema = (id, extra = {}) => ({
  id,
  name: `Tema ${id}`,
  tokens: { primary: "#0B0D12", accent: "#3B82F6", textPrimary: "#FFFFFF", ...extra },
});

const yaz = (plan) => Object.fromEntries(plan.writes.map((w) => [w.id, w.value]));

const yedekOlustur = (settings) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: "2026-10-15T10:00:00.000Z",
  app: { version: "1.4.8", platform: "ios" },
  settings,
});

describe("kapsam bekçisi", () => {
  const settingsAnahtarlari = Object.values(Keys)
    .filter((d) => d.store === "settings")
    .map((d) => d.name);
  const girenler = BACKUP_ENTRIES.map((e) => e.key);
  const dislananlar = Object.keys(BACKUP_EXCLUDED);

  test("her `settings` anahtarı yedeğe girer YA DA gerekçesiyle dışlanır", () => {
    const kararsiz = settingsAnahtarlari.filter((ad) => !girenler.includes(ad) && !dislananlar.includes(ad));
    expect(kararsiz).toEqual([]);
  });

  test("bir anahtar hem girip hem dışlanamaz", () => {
    expect(girenler.filter((ad) => dislananlar.includes(ad))).toEqual([]);
  });

  test("yedeğe giren her anahtar registry'de ve `settings` deposunda", () => {
    const yanlis = girenler.filter((ad) => !Keys[ad] || Keys[ad].store !== "settings");
    expect(yanlis).toEqual([]);
  });

  test("dışlananlar gerçekten var olan anahtarlar (bayat kayıt yok)", () => {
    expect(dislananlar.filter((ad) => !Keys[ad])).toEqual([]);
  });

  test("yinelenen kimlik yok; her giren bir grupta", () => {
    expect(new Set(girenler).size).toBe(girenler.length);
    expect(BACKUP_GROUPS.flatMap((g) => g.keys).length).toBe(girenler.length);
  });

  test("dışlama gerekçeleri boş değil", () => {
    for (const neden of Object.values(BACKUP_EXCLUDED)) expect(neden.trim().length).toBeGreaterThan(10);
  });

  test("hesap/kimlik verisi yedeğe GİRMEZ", () => {
    for (const ad of ["recentUsers", "selectedAvatar", "premiumLastPlan", "cachedUserId"]) {
      expect(girenler).not.toContain(ad);
    }
  });

  test("her ayarın registry varsayılanı yedek doğrulamasından geçer (varsayılan durum geri yüklenebilir)", () => {
    const sorunlu = BACKUP_ENTRIES.filter((e) => valueProblem(e, Keys[e.key].default) !== null).map((e) => e.id);
    expect(sorunlu).toEqual([]);
  });
});

describe("buildBackup / serialize", () => {
  test("zarf alanları + her kimlik için bir giriş; kayıtsız olan null", () => {
    const yedek = buildBackup(() => undefined, { now: new Date("2026-10-15T10:00:00Z"), appVersion: "1.4.8", platform: "ios" });
    expect(yedek.format).toBe(BACKUP_FORMAT);
    expect(yedek.version).toBe(BACKUP_VERSION);
    expect(yedek.createdAt).toBe("2026-10-15T10:00:00.000Z");
    expect(yedek.app).toEqual({ version: "1.4.8", platform: "ios" });
    expect(Object.keys(yedek.settings).sort()).toEqual(BACKUP_ENTRIES.map((e) => e.id).sort());
    expect(Object.values(yedek.settings).every((v) => v === null)).toBe(true);
  });

  test("okunan değerler aynen girer; özel temalar temizlenir", () => {
    const okunan = {
      theme: "custom:a",
      customThemes: [tema("a"), { id: "bozuk" }, tema("a")],
      haptics: true,
      listsGridColumns: 4,
    };
    const yedek = buildBackup((ad) => okunan[ad]);
    expect(yedek.settings.theme).toBe("custom:a");
    expect(yedek.settings.haptics).toBe(true);
    expect(yedek.settings.listsGridColumns).toBe(4);
    expect(yedek.settings.customThemes).toHaveLength(1);
  });

  test("JSON'a yazılıp geri okunabilir ve dosya adı yerel tarihli", () => {
    const yedek = buildBackup(() => null);
    expect(JSON.parse(serializeBackup(yedek))).toEqual(yedek);
    expect(backupFileName(new Date(2026, 9, 5))).toBe("seelogd-ayarlar-2026-10-05.json");
  });
});

describe("parseBackup", () => {
  const gecerli = serializeBackup(buildBackup(() => null));

  test("geçerli dosya", () => {
    const sonuc = parseBackup(gecerli);
    expect(sonuc.ok).toBe(true);
    expect(sonuc.backup.format).toBe(BACKUP_FORMAT);
  });

  test("BOM ve baştaki/sondaki boşluk tolere edilir", () => {
    expect(parseBackup(`﻿  ${gecerli}\n`).ok).toBe(true);
  });

  test.each([
    ["boş", "", "empty"],
    ["yalnız boşluk", "   \n", "empty"],
    ["metin değil", null, "empty"],
    ["JSON değil", "{bozuk", "not-json"],
    ["başka JSON", JSON.stringify({ a: 1 }), "not-backup"],
    ["dizi", JSON.stringify([1, 2]), "not-backup"],
    ["yanlış biçim adı", JSON.stringify({ format: "x", version: 1, settings: {} }), "not-backup"],
    ["ayarlar nesne değil", JSON.stringify({ format: BACKUP_FORMAT, version: 1, settings: [] }), "not-backup"],
    ["sürüm yok", JSON.stringify({ format: BACKUP_FORMAT, settings: {} }), "not-backup"],
    ["sürüm 0", JSON.stringify({ format: BACKUP_FORMAT, version: 0, settings: {} }), "not-backup"],
  ])("%s → %s", (_ad, girdi, hata) => {
    expect(parseBackup(girdi)).toEqual({ ok: false, error: hata });
  });

  test("daha yeni sürüm reddedilir ve sürüm söylenir", () => {
    const sonuc = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, settings: {} }));
    expect(sonuc).toEqual({ ok: false, error: "too-new", version: BACKUP_VERSION + 1 });
  });

  test("aşırı büyük metin ayrıştırılmadan reddedilir", () => {
    expect(parseBackup("x".repeat(MAX_BACKUP_CHARS + 1))).toEqual({ ok: false, error: "too-large" });
  });
});

describe("planImport — değerler", () => {
  test("geçerli değerler yazılır; gruplar sayılır", () => {
    const plan = planImport(
      yedekOlustur({ theme: "dark", haptics: true, listsGridColumns: 4, language: "en", railPosterSize: "small" }),
    );
    expect(yaz(plan)).toEqual({ theme: "dark", haptics: true, listsGridColumns: 4, language: "en", railPosterSize: "small" });
    expect(plan.skipped).toEqual([]);
    expect(plan.groups.find((g) => g.id === "appearance").applied).toBe(1);
    expect(plan.groups.find((g) => g.id === "layout").applied).toBe(2);
    expect(plan.meta).toEqual({ createdAt: "2026-10-15T10:00:00.000Z", appVersion: "1.4.8", platform: "ios" });
  });

  test("null → anahtarı sil (varsayılana dön); yazım olarak planlanır", () => {
    const plan = planImport(yedekOlustur({ language: null, effectMode: null, theme: null }));
    expect(yaz(plan)).toEqual({ language: null, effectMode: null, theme: null });
  });

  test("YEDEKTE OLMAYAN ayara dokunulmaz", () => {
    const plan = planImport(yedekOlustur({ haptics: true }));
    expect(plan.writes.map((w) => w.id)).toEqual(["haptics"]);
  });

  test.each([
    ["theme", "yok-boyle-tema"],
    ["theme", "custom:"],
    ["theme", "custom:../../x"],
    ["theme", 5],
    ["language", "fr"],
    ["listsGridColumns", 7],
    ["listsGridColumns", "3"],
    ["listsPosterRadius", 11],
    ["haptics", "evet"],
    ["effectMode", "ultra"],
    ["iconBackgroundOpacity", 5],
    ["iconBackgroundOpacity", NaN],
    ["imageQualityLevel", "dev"],
    ["streamingProviderIds", [1, "2"]],
    ["streamingProviderIds", [-1]],
    ["petSize", 9999],
    ["petPosition", { x: "a", y: 1 }],
    ["notificationSettings", [1, 2]],
    ["notificationSettings", "x"],
    ["decorScopes", 5],
    ["fontRoles", ["a"]],
    ["reminderPreviewLimit", 6],
  ])("geçersiz %s = %j atlanır", (id, deger) => {
    const plan = planImport(yedekOlustur({ [id]: deger, allCornersRounded: true }));
    expect(plan.skipped).toEqual([{ id, reason: expect.any(String) }]);
    expect(plan.warnings).toContain("some-invalid");
    // geçerli komşu etkilenmez
    expect(yaz(plan)).toEqual({ allCornersRounded: true });
  });

  test("bilinmeyen kimlik (daha yeni sürümden) atlanır ve uyarı doğurmaz", () => {
    const plan = planImport(yedekOlustur({ gelecekAyar: 1, haptics: true }));
    expect(plan.skipped).toEqual([{ id: "gelecekAyar", reason: "unknown" }]);
    expect(plan.warnings).not.toContain("some-invalid");
    expect(yaz(plan)).toEqual({ haptics: true });
  });

  test("dışlanan anahtarlar dosyada olsa bile YAZILMAZ", () => {
    const plan = planImport(
      yedekOlustur({ recentUsers: [{ email: "a@b.c" }], premiumLastPlan: "unlimited", appIcon: "icon_glass", hasSeenOnboarding: true }),
    );
    expect(plan.writes).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["unknown", "unknown", "unknown", "unknown"]);
  });

  test("__proto__ ile kirletme denemesi etkisiz", () => {
    const hain = JSON.parse('{"format":"seelogd-settings-backup","version":1,"settings":{"__proto__":{"polluted":true},"haptics":true}}');
    const plan = planImport(hain);
    expect({}.polluted).toBeUndefined();
    expect(yaz(plan)).toEqual({ haptics: true });
  });

  test("normalize: decorScopes / fontRoles / dataCacheTypes kanonik hale gelir", () => {
    const plan = planImport(
      yedekOlustur({
        decorScopes: { snow: ["olmayan-grup"], icon: "x", ekstra: 1 },
        fontRoles: { heading: "yok-font", body: 1 },
        dataCacheTypes: { images: false, bilinmeyen: false },
      }),
    );
    const w = yaz(plan);
    expect(Object.keys(w.decorScopes).sort()).toEqual(["ambient", "icon", "snow"]);
    expect(w.decorScopes.snow).toEqual([]);
    expect(Object.keys(w.fontRoles).sort()).toEqual(["body", "heading", "numeric"]);
    expect(w.dataCacheTypes.images).toBe(false);
    expect(w.dataCacheTypes.profile).toBe(true);
    expect("bilinmeyen" in w.dataCacheTypes).toBe(false);
  });

  test("devasa/derin JSON reddedilir", () => {
    let derin = { a: 1 };
    for (let i = 0; i < 20; i += 1) derin = { n: derin };
    const plan = planImport(yedekOlustur({ widgetPreferences: derin, profileStoryCard: { s: "x".repeat(300000) } }));
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toHaveLength(2);
  });

  test("posterBadges eski tek boolean kaydını da kabul eder", () => {
    expect(yaz(planImport(yedekOlustur({ posterBadges: true })))).toEqual({ posterBadges: true });
  });
});

describe("özel temalar", () => {
  test("sanitize: geçersiz token, yinelenen id, kimliksiz tema, uzun ad", () => {
    const { themes, dropped } = sanitizeCustomThemes([
      tema("a", { accent: "#abc", primary: "kırmızı", bilinmeyenToken: "#FFFFFF" }),
      tema("a"),
      { name: "kimliksiz", tokens: { primary: "#000000" } },
      { id: "../hack", tokens: { primary: "#000000" } },
      { id: "bos", tokens: {} },
      { id: "x".repeat(65), tokens: { primary: "#000000" } },
      { id: "uzun", name: "N".repeat(200), tokens: { primary: "#000000" } },
      "metin",
      null,
    ]);
    expect(themes.map((t) => t.id)).toEqual(["a", "uzun"]);
    expect(dropped).toBe(7);
    const a = themes[0];
    expect(a.tokens.accent).toBe("#AABBCC"); // 3 haneli hex 6'ya genişler
    expect("primary" in a.tokens).toBe(false); // geçersiz renk atıldı
    expect("bilinmeyenToken" in a.tokens).toBe(false);
    expect(themes[1].name.length).toBe(64);
  });

  test("bağıl token korunur; kendine/bilinmeyene bağlı olan atılır", () => {
    const { themes } = sanitizeCustomThemes([
      {
        id: "r",
        name: "R",
        tokens: {
          primary: "#101010",
          bold: { from: "accent", l: -10, s: 4, zzz: 9 },
          accent: { from: "accent", l: 5 },
          border: { from: "yokToken", l: 5 },
          tab: { from: "primary", l: "x" },
        },
      },
    ]);
    expect(themes[0].tokens.bold).toEqual({ from: "accent", l: -10, s: 4 });
    expect("accent" in themes[0].tokens).toBe(false);
    expect("border" in themes[0].tokens).toBe(false);
    expect(themes[0].tokens.tab).toEqual({ from: "primary" });
  });

  test("sayı sınırı: 40'tan fazlası atılır", () => {
    const cok = Array.from({ length: 55 }, (_, i) => tema(`t${i}`));
    const { themes, dropped } = sanitizeCustomThemes(cok);
    expect(themes).toHaveLength(40);
    expect(dropped).toBe(15);
  });

  test("birleştir (varsayılan): mevcutlar KORUNUR, gelenler eklenir, aynı id ezilir", () => {
    const mevcut = [tema("a", { accent: "#111111" }), tema("b")];
    const plan = planImport(yedekOlustur({ customThemes: [tema("a", { accent: "#222222" }), tema("c")] }), {
      currentThemes: mevcut,
    });
    const liste = yaz(plan).customThemes;
    expect(liste.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
    expect(liste.find((t) => t.id === "a").tokens.accent).toBe("#222222");
    expect(plan.themes).toMatchObject({ incoming: 2, added: 1, updated: 1, kept: 1, dropped: 0 });
    expect(plan.themes.names).toEqual(["Tema a", "Tema c"]);
  });

  test("değiştir: liste yedektekiyle birebir (geri alma noktası için)", () => {
    const plan = planImport(yedekOlustur({ customThemes: [tema("c")] }), {
      currentThemes: [tema("a"), tema("b")],
      themeMode: "replace",
    });
    expect(yaz(plan).customThemes.map((t) => t.id)).toEqual(["c"]);
  });

  test("yedekte tema YOK (null): birleştirmede mevcutlara dokunulmaz, değiştirmede silinir", () => {
    const birlestir = planImport(yedekOlustur({ customThemes: null }), { currentThemes: [tema("a")] });
    expect(birlestir.writes).toEqual([]);
    const degistir = planImport(yedekOlustur({ customThemes: null }), { currentThemes: [tema("a")], themeMode: "replace" });
    expect(yaz(degistir)).toEqual({ customThemes: null });
  });

  test("tema listesi dizi değilse atlanır", () => {
    const plan = planImport(yedekOlustur({ customThemes: { a: 1 } }));
    expect(plan.skipped).toEqual([{ id: "customThemes", reason: "wrong-type" }]);
  });

  test("tüm özel temalar bozuksa yazılan liste BOŞ ama mevcutlar (birleştirmede) kalır", () => {
    const plan = planImport(yedekOlustur({ customThemes: [{ id: "x" }, 5] }), { currentThemes: [tema("a")] });
    expect(yaz(plan).customThemes.map((t) => t.id)).toEqual(["a"]);
    expect(plan.warnings).toContain("themes-dropped");
  });

  describe("seçili tema referansı", () => {
    test("gelen listede VARSA korunur", () => {
      const plan = planImport(yedekOlustur({ theme: "custom:c", customThemes: [tema("c")] }));
      expect(yaz(plan).theme).toBe("custom:c");
      expect(plan.warnings).not.toContain("theme-missing");
    });

    test("yalnız cihazdaki mevcut listede varsa (birleştirme) korunur", () => {
      const plan = planImport(yedekOlustur({ theme: "custom:a" }), { currentThemes: [tema("a")] });
      expect(yaz(plan).theme).toBe("custom:a");
    });

    test("hiçbir yerde yoksa varsayılana (null) düşer ve uyarı verir", () => {
      const plan = planImport(yedekOlustur({ theme: "custom:yok", customThemes: [tema("c")] }), { currentThemes: [tema("a")] });
      expect(yaz(plan).theme).toBeNull();
      expect(plan.warnings).toContain("theme-missing");
    });

    test("değiştirme kipinde mevcut temaya referans da düşer", () => {
      const plan = planImport(yedekOlustur({ theme: "custom:a", customThemes: [tema("c")] }), {
        currentThemes: [tema("a")],
        themeMode: "replace",
      });
      expect(yaz(plan).theme).toBeNull();
    });

    test("yerleşik tema adı her zaman geçerli", () => {
      expect(yaz(planImport(yedekOlustur({ theme: "purple" }))).theme).toBe("purple");
    });
  });
});

describe("uçtan uca gidiş-dönüş", () => {
  const durum = {
    theme: "custom:a",
    customThemes: [tema("a"), tema("b")],
    language: "en",
    fontRoles: { heading: "inter", body: "inter", numeric: "inter" },
    effectMode: "balanced",
    showSnow: true,
    iconBackgroundOpacity: 0.5,
    decorScopes: { snow: [], icon: [], ambient: [] },
    listsGridColumns: 4,
    posterBadges: { watchlist: false },
    streamingProviderIds: [8, 337],
    notificationSettings: { enabled: false },
    haptics: true,
    autoDataCache: true,
    dataCacheTypes: { images: false },
    widgetPreferences: { stats: { showDuration: true } },
    petEnabled: true,
    petSize: 150,
    petPosition: { x: 10, y: 20 },
  };

  test("dışa aktar → metin → içe aktar: değerler aynen döner", () => {
    const metin = serializeBackup(buildBackup((ad) => durum[ad]));
    const ayri = parseBackup(metin);
    expect(ayri.ok).toBe(true);
    const plan = planImport(ayri.backup, { currentThemes: [] });
    const w = yaz(plan);
    expect(plan.skipped).toEqual([]);
    expect(w.theme).toBe("custom:a");
    expect(w.customThemes.map((t) => t.id)).toEqual(["a", "b"]);
    expect(w.language).toBe("en");
    expect(w.fontRoles).toBeDefined();
    expect(w.effectMode).toBe("balanced");
    expect(w.showSnow).toBe(true);
    expect(w.iconBackgroundOpacity).toBe(0.5);
    expect(w.listsGridColumns).toBe(4);
    expect(w.posterBadges).toEqual({ watchlist: false });
    expect(w.streamingProviderIds).toEqual([8, 337]);
    expect(w.notificationSettings).toEqual({ enabled: false });
    expect(w.autoDataCache).toBe(true);
    expect(w.dataCacheTypes.images).toBe(false);
    expect(w.widgetPreferences).toEqual({ stats: { showDuration: true } });
    expect(w.petSize).toBe(150);
    expect(w.petPosition).toEqual({ x: 10, y: 20 });
  });

  test("boş cihazın yedeği bile geçerli: her giriş null, hepsi 'sil' olarak planlanır", () => {
    const ayri = parseBackup(serializeBackup(buildBackup(() => null)));
    const plan = planImport(ayri.backup, { themeMode: "replace" });
    expect(plan.skipped).toEqual([]);
    expect(plan.writes.every((w) => w.value === null)).toBe(true);
    expect(plan.writes).toHaveLength(BACKUP_ENTRIES.length);
  });
});

describe("summarizeBackupContents", () => {
  test("grup başına kayıtlı ayar sayısı ve tema sayısı", () => {
    const yedek = buildBackup((ad) => ({ theme: "dark", customThemes: [tema("a"), tema("b")], haptics: false }[ad]));
    const ozet = summarizeBackupContents(yedek);
    expect(ozet.themeCount).toBe(2);
    expect(ozet.groups.find((g) => g.id === "appearance").saved).toBe(2);
    expect(ozet.groups.find((g) => g.id === "notifications").saved).toBe(1);
    expect(ozet.groups.find((g) => g.id === "pet").saved).toBe(0);
  });

  test("bozuk girdide patlamaz", () => {
    expect(() => summarizeBackupContents(null)).not.toThrow();
    expect(summarizeBackupContents({}).themeCount).toBe(0);
  });
});
