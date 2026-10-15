// __tests__/settingsBackupService.test.js
//
// Depolamaya bağlı yedek akışı: gerçek registry + bellek-içi MMKV üzerinde
//   dışa aktar → başka bir "cihaza" aktar → geri al.
// Çekirdek kurallar __tests__/settingsBackup.test.js'te.

jest.mock("../services/widgetPreferencesService", () => ({
  syncWidgetPreferences: jest.fn(() => Promise.resolve()),
}));

const { Keys, get, has, set } = require("../services/storage");
const { getStore } = require("../services/storage/instances");
const { syncWidgetPreferences } = require("../services/widgetPreferencesService");
const {
  applyImport,
  clearRestorePoint,
  collectCurrentBackup,
  getRestorePoint,
  previewImport,
  restoreFromRestorePoint,
} = require("../services/settingsBackupService");
const { parseBackup, serializeBackup } = require("../utils/settingsBackup");

const tema = (id, name = id) => ({ id, name, tokens: { primary: "#0B0D12", accent: "#3B82F6" } });

const temizle = () => {
  for (const ad of ["settings"]) getStore(ad).clearAll();
  jest.clearAllMocks();
};

beforeEach(temizle);

describe("collectCurrentBackup", () => {
  test("kayıtsız ayar null (kullanıcı hiç seçmedi), kayıtlı ayar değeriyle", () => {
    set(Keys.theme, "dark");
    set(Keys.haptics, false); // açıkça kapatılmış: null'dan AYRI bilgi
    const yedek = collectCurrentBackup();
    expect(yedek.settings.theme).toBe("dark");
    expect(yedek.settings.haptics).toBe(false);
    expect(yedek.settings.language).toBeNull();
    expect(yedek.settings.effectMode).toBeNull();
  });

  test("hesap/kimlik verisi sızmaz", () => {
    set(Keys.recentUsers, [{ email: "a@b.c" }]);
    set(Keys.premiumLastPlan, "unlimited");
    const metin = serializeBackup(collectCurrentBackup());
    expect(metin).not.toContain("a@b.c");
    expect(metin).not.toContain("unlimited");
  });

  test("meta bilgisi zarfa yazılır", () => {
    const yedek = collectCurrentBackup({ appVersion: "1.4.8", platform: "android" });
    expect(yedek.app).toEqual({ version: "1.4.8", platform: "android" });
  });
});

describe("içe aktarma", () => {
  function kaynakCihaz() {
    set(Keys.theme, "custom:a");
    set(Keys.customThemes, [tema("a", "Okyanus")]);
    set(Keys.language, "en");
    set(Keys.listsGridColumns, 4);
    set(Keys.haptics, true);
    set(Keys.widgetPreferences, { stats: { showDuration: true } });
    const metin = serializeBackup(collectCurrentBackup());
    temizle();
    return parseBackup(metin).backup;
  }

  test("başka cihaza aktarma: ayarlar ve özel tema gelir", async () => {
    const yedek = kaynakCihaz();
    // hedef cihazın kendi teması var
    set(Keys.customThemes, [tema("b", "Eski")]);

    const plan = previewImport(yedek);
    expect(plan.themes).toMatchObject({ incoming: 1, added: 1, kept: 1 });

    const sonuc = await applyImport(plan);
    expect(sonuc).toEqual({ applied: plan.writes.length, failed: 0 });
    expect(get(Keys.theme)).toBe("custom:a");
    expect(get(Keys.customThemes).map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(get(Keys.language)).toBe("en");
    expect(get(Keys.listsGridColumns)).toBe(4);
    expect(get(Keys.haptics)).toBe(true);
    expect(syncWidgetPreferences).toHaveBeenCalledTimes(1);
  });

  test("yedekteki null, hedefte AÇIKÇA yapılmış seçimi siler (varsayılana döner)", async () => {
    const yedek = kaynakCihaz(); // effectMode: null
    set(Keys.effectMode, "off");
    await applyImport(previewImport(yedek));
    expect(has(Keys.effectMode)).toBe(false);
    expect(get(Keys.effectMode)).toBeNull();
  });

  test("yedekte olmayan anahtara dokunulmaz", async () => {
    const yedek = { format: "seelogd-settings-backup", version: 1, settings: { haptics: true } };
    set(Keys.theme, "purple");
    await applyImport(previewImport(yedek));
    expect(get(Keys.theme)).toBe("purple");
    expect(get(Keys.haptics)).toBe(true);
  });

  test("widget ayarı yoksa widget senkronu çağrılmaz", async () => {
    const yedek = { format: "seelogd-settings-backup", version: 1, settings: { haptics: true } };
    await applyImport(previewImport(yedek));
    expect(syncWidgetPreferences).not.toHaveBeenCalled();
  });

  test("widget senkronu patlarsa içe aktarma yine başarılı sayılır", async () => {
    syncWidgetPreferences.mockImplementationOnce(() => Promise.reject(new Error("native yok")));
    const yedek = { format: "seelogd-settings-backup", version: 1, settings: { widgetPreferences: { a: 1 } } };
    const sonuc = await applyImport(previewImport(yedek));
    expect(sonuc.failed).toBe(0);
    expect(get(Keys.widgetPreferences)).toEqual({ a: 1 });
  });

  test("plan, geçersiz değeri diske İNDİRMEZ", async () => {
    const yedek = {
      format: "seelogd-settings-backup",
      version: 1,
      settings: { theme: "yok-boyle", listsGridColumns: 9, haptics: true },
    };
    set(Keys.listsGridColumns, 3);
    const plan = previewImport(yedek);
    await applyImport(plan);
    expect(get(Keys.listsGridColumns)).toBe(3);
    expect(has(Keys.theme)).toBe(false);
    expect(get(Keys.haptics)).toBe(true);
  });
});

describe("geri alma noktası", () => {
  const yedek = {
    format: "seelogd-settings-backup",
    version: 1,
    settings: { theme: "dark", customThemes: [tema("yeni")], haptics: false },
  };

  test("içe aktarma öncesi görüntü alınır ve özetlenir", async () => {
    set(Keys.theme, "purple");
    set(Keys.customThemes, [tema("eski")]);
    expect(getRestorePoint()).toBeNull();

    await applyImport(previewImport(yedek));
    const nokta = getRestorePoint();
    expect(nokta).not.toBeNull();
    expect(nokta.themeCount).toBe(1);
    expect(nokta.saved).toBe(2); // theme + customThemes (haptics henüz kayıtsızdı)
    expect(typeof nokta.createdAt).toBe("string");
  });

  test("geri al: ayarlar ve özel temalar BİREBİR önceki hale döner, nokta silinir", async () => {
    set(Keys.theme, "purple");
    set(Keys.customThemes, [tema("eski")]);
    set(Keys.language, "en");

    await applyImport(previewImport(yedek));
    expect(get(Keys.customThemes).map((t) => t.id).sort()).toEqual(["eski", "yeni"]);
    expect(get(Keys.haptics)).toBe(false);

    const sonuc = await restoreFromRestorePoint();
    expect(sonuc.ok).toBe(true);
    expect(sonuc.failed).toBe(0);
    expect(get(Keys.theme)).toBe("purple");
    expect(get(Keys.customThemes).map((t) => t.id)).toEqual(["eski"]); // "yeni" tema kalktı
    expect(get(Keys.language)).toBe("en");
    expect(has(Keys.haptics)).toBe(false); // içe aktarmayla gelen kayıt silindi
    expect(getRestorePoint()).toBeNull();
  });

  test("nokta yoksa geri alma ok:false döner ve hiçbir şeye dokunmaz", async () => {
    set(Keys.theme, "dark");
    expect(await restoreFromRestorePoint()).toEqual({ ok: false });
    expect(get(Keys.theme)).toBe("dark");
  });

  test("bozuk nokta güvenle yok sayılır", async () => {
    getStore("settings").set(Keys.settingsRestorePoint.key, JSON.stringify({ rastgele: 1 }));
    expect(getRestorePoint()).toBeNull();
    expect(await restoreFromRestorePoint()).toEqual({ ok: false });
  });

  test("ikinci içe aktarma noktayı GÜNCELLER (en son durumdan önceki)", async () => {
    set(Keys.theme, "purple");
    await applyImport(previewImport(yedek));
    set(Keys.theme, "gray"); // kullanıcı arada değiştirdi
    await applyImport(previewImport({ ...yedek, settings: { theme: "light" } }));
    await restoreFromRestorePoint();
    expect(get(Keys.theme)).toBe("gray");
  });

  test("skipRestorePoint: nokta alınmaz", async () => {
    await applyImport(previewImport(yedek), { skipRestorePoint: true });
    expect(getRestorePoint()).toBeNull();
  });

  test("clearRestorePoint", async () => {
    await applyImport(previewImport(yedek));
    clearRestorePoint();
    expect(getRestorePoint()).toBeNull();
  });

  test("geri alma noktası yedek DOSYASINA girmez", async () => {
    await applyImport(previewImport(yedek));
    expect(Object.keys(collectCurrentBackup().settings)).not.toContain("settingsRestorePoint");
  });
});
