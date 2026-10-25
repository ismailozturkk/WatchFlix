// "Görünümümü paylaş" metinleri: beş dil aynı anahtarları taşır, özetler değerden okunur.
import { SETTINGS_SHARE_COPY, getSettingsShareCopy, sectionSummary, themeLabel } from "../utils/settingsShareCopy";
import { SETTINGS_SHARE_SECTION_IDS, buildSettingsShare, SETTINGS_SHARE_KEYS } from "../utils/settingsShare";
import { Keys } from "../services/storage/registry";
import { APP_LANGUAGES } from "../utils/appLanguages";

const shape = (value) => {
  if (typeof value === "function") return `fn${value.length}`;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  return typeof value;
};

const DEFAULTS = Object.fromEntries(SETTINGS_SHARE_KEYS.map((key) => [key, Keys[key].default]));
const reader = (overrides = {}) => (key) => ({ ...DEFAULTS, ...overrides })[key];
const t = { themeFamilyGreen: "Yeşil", themeToneDark: "Koyu", themeToneLight: "Açık", purpleTheme: "Gece Moru" };

test("uygulamanın her dili için tablo var ve hepsi aynı anahtar/işlev şeklinde", () => {
  const languages = APP_LANGUAGES.map((lang) => lang.code || lang.id || lang);
  for (const code of languages) expect(Object.keys(SETTINGS_SHARE_COPY)).toContain(code);
  const reference = shape(SETTINGS_SHARE_COPY.tr);
  for (const [code, table] of Object.entries(SETTINGS_SHARE_COPY)) {
    expect([code, shape(table)]).toEqual([code, reference]);
    for (const id of SETTINGS_SHARE_SECTION_IDS) {
      expect(table.sections[id]).toBeTruthy();
      expect(table.descriptions[id]).toBeTruthy();
    }
  }
  expect(getSettingsShareCopy("xx")).toBeTruthy();
});

test("tema adı alıcının dilinde; özel tema kendi adıyla ve tonuyla", () => {
  const builtin = buildSettingsShare({ read: reader({ theme: "greenDeep" }), sections: ["theme"] });
  expect(themeLabel(builtin, { language: "tr", t })).toBe("Yeşil · Koyu");
  const legacy = buildSettingsShare({ read: reader({ theme: "purple" }), sections: ["theme"] });
  expect(themeLabel(legacy, { language: "tr", t })).toBe("Gece Moru");
  const custom = buildSettingsShare({
    read: reader({ theme: "custom:ct_x:light" }),
    customThemes: [{ id: "ct_x", name: "Gün Batımı", tokens: { primary: "#221100" } }],
    sections: ["theme"],
  });
  expect(themeLabel(custom, { language: "tr", t })).toBe("Gün Batımı · Açık");
});

test("bölüm özetleri değerden okunur", () => {
  const share = buildSettingsShare({
    read: reader({
      fontRoles: { heading: "bebasNeue", body: "system", numeric: "system" },
      showSnow: true,
      showAmbientBackground: true,
      listsPosterRadius: 20,
      allCornersRounded: true,
      railPosterSize: "small",
      listsGridColumns: 4,
      seeAllGridColumns: 3,
      posterBadges: { shared: true, reminder: false, rated: true },
      sectionVisibility: { movie: ["trends"] },
    }),
  });
  const tr = (id) => sectionSummary(share, id, { language: "tr", t });
  expect(tr("fonts")).toBe("Başlık Bebas Neue · Yazı Sistem · Rakam Sistem");
  expect(tr("effects")).toBe("Kar, Ambiyans");
  expect(tr("posters")).toBe("Yuvarlak köşeler · Tüm kartlar yuvarlak · Küçük afişler");
  expect(tr("lists")).toBe("Listeler 4 sütun · Tümü 3 sütun · 2 afiş rozeti");
  expect(tr("home")).toBe("1 bölüm gizli");
  expect(sectionSummary(share, "effects", { language: "en", t })).toBe("Snow, Ambient");

  const plain = buildSettingsShare({ read: reader({ fontRoles: { heading: "oswald", body: "oswald", numeric: "oswald" } }) });
  expect(sectionSummary(plain, "fonts", { language: "tr", t })).toBe("Oswald");
  expect(sectionSummary(plain, "effects", { language: "tr", t })).toBe("Tüm efektler kapalı");
  // Bölüm gövdede yoksa açıklamaya düşer.
  expect(sectionSummary({ sections: {} }, "home", { language: "tr", t })).toBe("Gizlenen ve gösterilen raflar");
});
