// Part 23.1: screens/game/gameConfig.js icin birim testler.
// Bu modul saf veri/lookup fonksiyonlaridir (RN/Firebase importu yok),
// jest "node" ortaminda dogrudan calistirilabilir.
const {
  SCENE_GAME_MODES,
  SCENE_GAME_DIFFICULTIES,
  SCENE_GAME_SOURCES,
  getModeConfig,
  getDifficultyConfig,
  getSourceConfig,
  isPersonalSource,
  getLocalizedGameLabel,
  MODE_CLASSIC,
} = require("../screens/game/gameConfig");

describe("getModeConfig / getDifficultyConfig / getSourceConfig (Part 8/9/22.1)", () => {
  test("var olan bir mod id'si dogru konfigurasyonu dondurur", () => {
    expect(getModeConfig("survival").id).toBe("survival");
  });

  test("gecersiz mod id'sinde ilk moda (Klasik) fallback yapar", () => {
    expect(getModeConfig("not_a_mode").id).toBe(MODE_CLASSIC);
    expect(getModeConfig(undefined).id).toBe(MODE_CLASSIC);
  });

  test("gecersiz zorluk id'sinde Normal'e fallback yapar", () => {
    expect(getDifficultyConfig("not_a_difficulty").id).toBe("normal");
  });

  test("gecersiz kaynak id'sinde ilk kaynaga fallback yapar", () => {
    expect(getSourceConfig("not_a_source").id).toBe(SCENE_GAME_SOURCES[0].id);
  });
});

describe("isPersonalSource", () => {
  test("kisisel kaynaklar (watchlist, favorites...) true doner", () => {
    expect(isPersonalSource("watchlist")).toBe(true);
    expect(isPersonalSource("favorites")).toBe(true);
  });

  test("kesfet kaynaklari (popular, top_rated_movie...) false doner", () => {
    expect(isPersonalSource("popular")).toBe(false);
    expect(isPersonalSource("top_rated_movie")).toBe(false);
  });
});

describe("Mod/zorluk adlari key tabanli (Part 22.1)", () => {
  test("her oyun modunun titleKey alani vardir (sabit metin degil)", () => {
    SCENE_GAME_MODES.forEach((mode) => {
      expect(typeof mode.titleKey).toBe("string");
      expect(mode.titleKey.startsWith("autoI18n.")).toBe(true);
    });
  });

  test("her zorlugun titleKey alani vardir (sabit metin degil)", () => {
    SCENE_GAME_DIFFICULTIES.forEach((difficulty) => {
      expect(typeof difficulty.titleKey).toBe("string");
      expect(difficulty.titleKey.startsWith("autoI18n.")).toBe(true);
    });
  });
});

describe("getLocalizedGameLabel", () => {
  test("dil 'en' ise en alanini, degilse tr alanini dondurur", () => {
    const item = { tr: "Klasik Mod", en: "Classic Mode" };
    expect(getLocalizedGameLabel(item, "en")).toBe("Classic Mode");
    expect(getLocalizedGameLabel(item, "tr")).toBe("Klasik Mod");
  });
});
