// "Görünümümü paylaş" çekirdeği: gövde kurma/temizleme, kapsam bekçisi, Premium
// kilidi, "Zaten aynı" ve uygulama planı; sohbet şemasına (chatShare) bağlanması.
import {
  SETTINGS_SHARE_KEYS,
  SETTINGS_SHARE_SECTION_IDS,
  buildSettingsShare,
  planSettingsApply,
  sanitizeSettingsShare,
  sectionLock,
  sectionMatchesCurrent,
  settingsShareSectionIds,
  sharedThemeColors,
} from "../utils/settingsShare";
import { BACKUP_ENTRIES, BACKUP_EXCLUDED, BACKUP_GROUPS } from "../utils/settingsBackup";
import { buildShareMessage, readShare, shareThumb, shareRoute, SHARE_KIND } from "../utils/chatShare";
import { replyGlyph, replyKind } from "../utils/chatReply";
import { Keys } from "../services/storage/registry";

const CUSTOM = {
  id: "ct_ocean",
  name: "Okyanus",
  tokens: { primary: "#0b1320", secondary: "#14223a", accent: "#3aa0ff", textPrimary: "#ffffff" },
  tones: { light: { primary: "#eef4fb", accent: "#1f7ae0" } },
  base: "#0b1320",
};

const DEFAULTS = Object.fromEntries(SETTINGS_SHARE_KEYS.map((key) => [key, Keys[key].default]));

function reader(overrides = {}) {
  const values = { ...DEFAULTS, ...overrides };
  return (key) => values[key];
}

const FULL = {
  theme: "custom:ct_ocean:light",
  fontRoles: { heading: "bebasNeue", body: "system", numeric: "system" },
  showSnow: true,
  showAmbientBackground: false,
  showIconBackground: false,
  iconBackgroundMode: "random",
  iconBackgroundOpacity: 0.4,
  decorScopes: null,
  allCornersRounded: true,
  listsPosterRadius: 20,
  railPosterSize: "small",
  listsGridColumns: 4,
  seeAllGridColumns: 3,
  sectionVisibility: { movie: ["trends"] },
};

describe("kapsam", () => {
  test("paylaşılan her anahtar ayar yedeğinin kapsamında (aynı doğrulayıcıdan geçer)", () => {
    const backupKeys = new Set(BACKUP_ENTRIES.map((entry) => entry.id));
    expect(SETTINGS_SHARE_KEYS.filter((key) => !backupKeys.has(key))).toEqual([]);
    expect(SETTINGS_SHARE_KEYS.filter((key) => key in BACKUP_EXCLUDED)).toEqual([]);
  });

  test("kişiye/cihaza özel ayarlar ASLA paylaşılmaz", () => {
    const personal = [
      ...BACKUP_GROUPS.filter((g) => ["content", "notifications", "data", "widgets"].includes(g.id)).flatMap((g) => g.keys),
      "customThemes",
      "effectMode",
    ];
    expect(SETTINGS_SHARE_KEYS.filter((key) => personal.includes(key))).toEqual([]);
    const share = buildSettingsShare({ read: () => "tr" });
    expect(JSON.stringify(share || {})).not.toMatch(/language|adultContent|streamingProviderIds|notificationSettings/);
  });

  test("bölüm sırası sabit", () => {
    expect(SETTINGS_SHARE_SECTION_IDS).toEqual(["theme", "fonts", "effects", "posters", "lists", "home"]);
  });
});

describe("gövde", () => {
  test("özel tema token setiyle birlikte gömülür; sohbet mesajına dönüşüp geri okunur", () => {
    const share = buildSettingsShare({ read: reader(FULL), customThemes: [CUSTOM, { id: "other", tokens: { primary: "#000000" } }], owner: "  Ada   Lovelace " });
    expect(share.owner).toBe("Ada Lovelace");
    expect(share.sections.theme).toEqual({ theme: "custom:ct_ocean:light", custom: expect.objectContaining({ id: "ct_ocean", name: "Okyanus" }) });
    expect(share.sections.theme.custom.tones.light.primary).toBe("#EEF4FB");
    expect(settingsShareSectionIds(share)).toEqual(SETTINGS_SHARE_SECTION_IDS);

    const message = buildShareMessage(share);
    expect(message.kind).toBe(SHARE_KIND.SETTINGS);
    expect(message.text.startsWith("🎨")).toBe(true);
    expect(readShare({ ...message, senderId: "u" })).toEqual(share);
    expect(readShare({ ...message, kind: "listShare" })).toBeNull();
    expect(shareThumb(share)).toBeNull();
    expect(shareRoute(share)).toBeNull();
    expect(replyKind(message)).toBe("settings");
    expect(replyGlyph("settings")).toBe("color-palette");
  });

  test("seçilen bölümler dışında hiçbir şey gönderilmez", () => {
    const share = buildSettingsShare({ read: reader(FULL), customThemes: [CUSTOM], sections: ["fonts", "home"] });
    expect(Object.keys(share.sections)).toEqual(["fonts", "home"]);
    expect(buildSettingsShare({ read: reader(FULL), sections: [] })).toBeNull();
  });

  test("token seti olmayan özel tema uygulanamaz → tema bölümü atılır", () => {
    const share = buildSettingsShare({ read: reader(FULL), customThemes: [], sections: ["theme", "fonts"] });
    expect(Object.keys(share.sections)).toEqual(["fonts"]);
    const forged = sanitizeSettingsShare({
      type: "settings",
      sections: { theme: { theme: "custom:ct_ocean", custom: { ...CUSTOM, id: "başka" } } },
    });
    expect(forged).toBeNull();
  });

  test("bozuk değerler, bilinmeyen anahtar ve bölümler atlanır; hiç geçerli bölüm yoksa null", () => {
    const share = sanitizeSettingsShare({
      type: "settings",
      owner: 42,
      sections: {
        posters: { listsPosterRadius: 999, railPosterSize: "small", language: "en" },
        lists: { listsGridColumns: "4" },
        weather: { sunny: true },
        effects: { showSnow: "yes" },
      },
    });
    expect(share).toEqual({ v: 1, type: "settings", sections: { posters: { railPosterSize: "small" } } });
    expect(sanitizeSettingsShare({ type: "settings", sections: { theme: { theme: "rainbow" } } })).toBeNull();
    expect(sanitizeSettingsShare({ type: "list", sections: { home: { sectionVisibility: null } } })).toBeNull();
    expect(sanitizeSettingsShare(null)).toBeNull();
  });

  test("yerleşik tema düz kimlikle gider; alıcıda renk nesnesine çözülür", () => {
    const share = buildSettingsShare({ read: reader({ theme: "greenDeep" }), sections: ["theme"] });
    expect(share.sections.theme).toEqual({ theme: "greenDeep" });
    expect(sharedThemeColors(share).primary).toMatch(/^#/);
    const custom = buildSettingsShare({ read: reader(FULL), customThemes: [CUSTOM], sections: ["theme"] });
    // Açık ton seçilmiş: açık tonun zemini çizilir.
    expect(sharedThemeColors(custom).primary).toBe("#EEF4FB");
  });
});

describe("Premium kilidi", () => {
  const share = buildSettingsShare({ read: reader(FULL), customThemes: [CUSTOM] });

  test("Free: özel tema, katalog fontu ve açık gelen premium efekt kilitli; düzen serbest", () => {
    expect(sectionLock(share, "theme", "free")).toBe("custom_themes");
    expect(sectionLock(share, "fonts", "free")).toBe("font_catalog");
    expect(sectionLock(share, "effects", "free")).toBe("snow_effect");
    expect(sectionLock(share, "posters", "free")).toBeNull();
    expect(sectionLock(share, "lists", "free")).toBeNull();
    expect(sectionLock(share, "home", "free")).toBeNull();
  });

  test("Premium'da hiçbiri kilitli değil", () => {
    for (const id of SETTINGS_SHARE_SECTION_IDS) expect(sectionLock(share, id, "premium")).toBeNull();
  });

  test("aile temaları, ücretsiz fontlar ve KAPALI efektler Free'de de uygulanır", () => {
    const free = buildSettingsShare({
      read: reader({ theme: "sky", fontRoles: { heading: "oswald", body: "system", numeric: "system" }, showSnow: false }),
    });
    expect(sectionLock(free, "theme", "free")).toBeNull();
    expect(sectionLock(free, "fonts", "free")).toBeNull();
    expect(sectionLock(free, "effects", "free")).toBeNull();
    const legacy = buildSettingsShare({ read: reader({ theme: "purple" }), sections: ["theme"] });
    expect(sectionLock(legacy, "theme", "free")).toBe("custom_themes");
  });

  test("uygulama planı kilitli ve gövdede olmayan bölümleri atlar", () => {
    const plan = planSettingsApply(share, ["theme", "posters", "home", "nope"], { plan: "free" });
    expect(Object.keys(plan.sections)).toEqual(["posters", "home"]);
    expect(plan.locked).toEqual([{ id: "theme", feature: "custom_themes" }]);
    const partial = buildSettingsShare({ read: reader(FULL), sections: ["lists"] });
    expect(planSettingsApply(partial, ["lists", "fonts"], { plan: "premium" }).missing).toEqual(["fonts"]);
  });
});

describe("Zaten aynı", () => {
  const share = buildSettingsShare({ read: reader(FULL), customThemes: [CUSTOM] });

  test("aynı değerler (anahtar sırası farklı da olsa) aynı sayılır", () => {
    const sameOrder = { ...FULL, sectionVisibility: { movie: ["trends"], tv: [] } };
    expect(sectionMatchesCurrent(share, "posters", { read: reader(FULL) })).toBe(true);
    expect(sectionMatchesCurrent(share, "home", { read: reader(sameOrder) })).toBe(true);
    expect(sectionMatchesCurrent(share, "home", { read: reader({ ...FULL, sectionVisibility: null }) })).toBe(false);
    expect(sectionMatchesCurrent(share, "lists", { read: reader({ ...FULL, listsGridColumns: 3 }) })).toBe(false);
  });

  test("aynı kimlikli özel tema ama farklı renkler → uygulanacak bir şey var", () => {
    const mine = { ...CUSTOM, tokens: { ...CUSTOM.tokens, accent: "#ff0000" } };
    expect(sectionMatchesCurrent(share, "theme", { read: reader(FULL), customThemes: [CUSTOM] })).toBe(true);
    expect(sectionMatchesCurrent(share, "theme", { read: reader(FULL), customThemes: [mine] })).toBe(false);
    expect(sectionMatchesCurrent(share, "theme", { read: reader({ theme: "blue" }), customThemes: [CUSTOM] })).toBe(false);
  });
});
