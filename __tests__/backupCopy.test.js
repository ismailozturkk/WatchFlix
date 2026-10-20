// __tests__/backupCopy.test.js
//
// Yedek ekranı metinleri: iki dil aynı anahtar kümesinde, boş değer yok, her
// yedek grubu ve her hizmet hata kodu için metin var (yoksa kullanıcı ham
// kimliği / yanlış hatayı görür).

const { BACKUP_COPY, count, errorMessage, fill, getBackupCopy, groupSub, groupTitle, platformName } =
  require("../screens/tabs/settings/backupCopy");
const { BACKUP_GROUPS } = require("../utils/settingsBackup");

describe("backupCopy", () => {
  test("tr ve en aynı anahtar kümesine sahip, değerler boş değil", () => {
    expect(Object.keys(BACKUP_COPY.en).sort()).toEqual(Object.keys(BACKUP_COPY.tr).sort());
    for (const lang of ["tr", "en"]) {
      const bos = Object.entries(BACKUP_COPY[lang]).filter(([, v]) => typeof v !== "string" || !v.trim());
      expect(bos).toEqual([]);
    }
  });

  test("yer tutucular iki dilde de aynı", () => {
    const yerTutucu = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    for (const key of Object.keys(BACKUP_COPY.tr)) {
      expect(yerTutucu(BACKUP_COPY.en[key])).toBe(yerTutucu(BACKUP_COPY.tr[key]));
    }
  });

  test("her yedek grubunun başlığı ve açıklaması var", () => {
    for (const isEn of [false, true]) {
      const copy = getBackupCopy(isEn);
      for (const group of BACKUP_GROUPS) {
        expect(groupTitle(copy, group.id)).not.toBe(group.id);
        expect(groupSub(copy, group.id).length).toBeGreaterThan(5);
      }
    }
  });

  test("hizmetin döndürebileceği her hata kodunun metni var ve birbirinden farklı anlamlar ayrılır", () => {
    const kodlar = ["empty", "not-json", "not-backup", "too-new", "too-large", "read-failed", "write-failed", "sharing-unavailable", "clipboard-failed"];
    for (const isEn of [false, true]) {
      const copy = getBackupCopy(isEn);
      const metinler = kodlar.map((k) => errorMessage(copy, k));
      expect(metinler.every((m) => typeof m === "string" && m.length > 5)).toBe(true);
      // not-json ve not-backup kullanıcıya aynı şeyi söyler; diğerleri ayrı
      expect(errorMessage(copy, "not-json")).toBe(errorMessage(copy, "not-backup"));
      expect(new Set(metinler).size).toBe(kodlar.length - 1);
    }
  });

  test("bilinmeyen hata kodu okunamadı mesajına düşer", () => {
    expect(errorMessage(getBackupCopy(false), "garip")).toBe(BACKUP_COPY.tr.errReadFailed);
  });

  test("tekil/çoğul: 1 için *One anahtarı, diğerleri için ana anahtar", () => {
    const en = getBackupCopy(true);
    expect(count(en, "themeCount", 1)).toBe("1 custom theme");
    expect(count(en, "themeCount", 3)).toBe("3 custom themes");
    expect(count(en, "themeCount", 0)).toBe("0 custom themes");
    expect(count(getBackupCopy(false), "themeCount", 1)).toBe("1 özel tema");
    expect(count(getBackupCopy(false), "themeCount", 4)).toBe("4 özel tema");
    // *One anahtarı olmayan metin n=1'de de ana anahtarı doldurur
    expect(count(en, "customized", 1)).toBe("1 customized");
  });

  test("her *One anahtarının çoğul karşılığı var ve yer tutucu İÇERMEZ", () => {
    for (const lang of ["tr", "en"]) {
      for (const key of Object.keys(BACKUP_COPY[lang]).filter((k) => k.endsWith("One"))) {
        expect(BACKUP_COPY[lang][key.slice(0, -3)]).toBeDefined();
        expect(BACKUP_COPY[lang][key]).not.toMatch(/\{\w+\}/);
      }
    }
  });

  test("fill ve platformName", () => {
    expect(fill("{n} ayar", { n: 4 })).toBe("4 ayar");
    expect(fill("{n} {x}", { n: 1 })).toBe("1 {x}");
    expect(platformName(getBackupCopy(true), "ios")).toBe("iOS");
    expect(platformName(getBackupCopy(true), "web")).toBe("");
  });
});
