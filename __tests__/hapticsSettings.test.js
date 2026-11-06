// __tests__/hapticsSettings.test.js
//
// Ayarlar > Titreşim: (1) beş dilin metin tablosu aynı anahtarlara sahip ve
// katalogdaki her düzey/güç/kategori/örnek desenin her dilde adı var; (2) ana
// ekran satırının alt yazısı; (3) ekran GERÇEK depo + GERÇEK servisle: düzey/güç/
// kategori seçimi depoya yazar ve önizleme titreşimi çalar, sıfırlama varsayılana
// döner, ana anahtar kapalıyken ince ayarlar devre dışı.

import React from "react";
import { act, create } from "react-test-renderer";

const mockChangeEnabled = jest.fn();
let mockEnabled = true;
let mockLang = "tr";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
  StyleSheet: { create: (styles) => styles },
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/SwitchToggle", () => ({ __esModule: true, default: "Switch" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "Touch" }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));
jest.mock("../context/AppSettingsContext", () => ({
  useHapticsSettings: () => ({ hapticsEnabled: mockEnabled, changeHapticsEnabled: mockChangeEnabled }),
}));
jest.mock("../screens/tabs/settings/settingsUi", () => {
  const R = require("react");
  return {
    SettingsSubScreen: ({ children }) => R.createElement("Screen", null, children),
    SectionLabel: ({ children }) => R.createElement("Label", null, children),
    SettingRow: (props) => R.createElement("Row", props),
    buildUiColors: () => new Proxy({}, { get: () => "#336699" }),
  };
});

global.IS_REACT_ACT_ENVIRONMENT = true;

const hp = require("../utils/hapticPatterns");
const { HAPTICS_COPY, getHapticsCopy, hapticsRowSubtitle } = require("../screens/tabs/settings/hapticsCopy");

const keyPaths = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? keyPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe("metinler", () => {
  test("beş dil aynı anahtarlara sahip, boş değer yok", () => {
    const base = keyPaths(HAPTICS_COPY.tr).sort();
    for (const [lang, table] of Object.entries(HAPTICS_COPY)) {
      expect([lang, keyPaths(table).sort()]).toEqual([lang, base]);
      for (const path of base) {
        const value = path.split(".").reduce((o, k) => o[k], table);
        const parts = Array.isArray(value) ? value : [value];
        parts.forEach((part) => expect(String(part).trim().length).toBeGreaterThan(0));
      }
    }
  });

  test("katalogdaki her düzey, güç, kategori ve örnek desenin her dilde adı var", () => {
    for (const table of Object.values(HAPTICS_COPY)) {
      hp.HAPTIC_LEVELS.forEach((id) => expect(table.levels[id]).toHaveLength(2));
      hp.HAPTIC_INTENSITIES.forEach((id) => expect(table.intensities[id]).toBeTruthy());
      hp.HAPTIC_INTENSITIES.forEach((id) => expect(table.intensityHint[id]).toBeTruthy());
      hp.HAPTIC_CATEGORIES.forEach((id) => expect(table.categories[id]).toHaveLength(2));
      Object.values(hp.HAPTIC_SAMPLES)
        .flat()
        .forEach((name) => expect([name, table.patterns[name]]).toEqual([name, expect.any(String)]));
    }
  });

  test("ana ekran satırı: kapalıyken 'Kapalı', açıkken düzey · güç", () => {
    const tr = getHapticsCopy("tr");
    expect(hapticsRowSubtitle(tr, { enabled: false })).toBe("Kapalı");
    expect(hapticsRowSubtitle(tr, { enabled: true, level: "balanced", intensity: "strong" })).toBe("Dengeli · Güçlü");
    expect(hapticsRowSubtitle(getHapticsCopy("xx"), { enabled: true, level: "rich", intensity: "soft" })).toBe("Rich · Soft");
  });
});

describe("ekran", () => {
  // Modül kaydı SIFIRLANMAZ (iki React kopyası olurdu); oynatıcı durumu servisin
  // test kancasıyla, tercihler depodan temizlenir.
  const native = require("expo-haptics");
  const storage = require("../services/storage");
  const service = require("../services/hapticsService");
  const Screen = require("../screens/tabs/settings/HapticsSettingsScreen").default;

  beforeEach(() => {
    mockEnabled = true;
    mockLang = "tr";
    mockChangeEnabled.mockClear();
    Object.values(native).forEach((fn) => typeof fn?.mockClear === "function" && fn.mockClear());
    storage.set(storage.Keys.haptics, true);
    storage.remove(storage.Keys.hapticsLevel);
    storage.remove(storage.Keys.hapticsIntensity);
    storage.remove(storage.Keys.hapticsCategories);
    service.__resetHapticsForTests();
  });

  let renderer = null;
  afterEach(() => {
    if (renderer) act(() => {
      renderer.unmount();
    });
    renderer = null;
  });
  const render = () => {
    act(() => {
      renderer = create(<Screen />);
    });
    return renderer;
  };
  const rowTitled = (r, title) => r.root.findAll((n) => n.type === "Row" && n.props.title === title)[0];
  const touchLabelled = (r, label) =>
    r.root.findAll((n) => n.type === "Touch" && n.findAll((c) => c.type === "Text" && c.props.children === label).length)[0];

  test("düzey satırına dokunmak depoya yazar ve o düzeyin desenini çalar", () => {
    const r = render();
    act(() => {
      rowTitled(r, "Bol").props.onPress();
    });
    expect(storage.get(storage.Keys.hapticsLevel)).toBe("rich");
    expect(native.impactAsync).toHaveBeenCalledWith("light"); // "tap" önizlemesi
  });

  test("güç seçimi depoya yazar ve yeni güçle önizler", () => {
    const r = render();
    act(() => {
      touchLabelled(r, "Güçlü").props.onPress();
    });
    expect(storage.get(storage.Keys.hapticsIntensity)).toBe("strong");
    expect(native.impactAsync).toHaveBeenCalledWith("heavy"); // "added" → click(medium) güçlüde heavy
  });

  test("kategori anahtarı kapatılınca depoya yazılır; satıra dokunmak örnek çalar", () => {
    const r = render();
    const row = rowTitled(r, "Oyunlar");
    act(() => {
      row.props.right.props.onValueChange(false);
    });
    expect(storage.get(storage.Keys.hapticsCategories)).toMatchObject({ games: false });
    act(() => {
      rowTitled(r, "Oyunlar").props.onPress();
    });
    expect(native.impactAsync).toHaveBeenCalledWith("medium"); // "correct" ilk vuruşu
  });

  test("sıfırla yalnız özelleştirilmişken görünür ve varsayılana döner", () => {
    const r = render();
    expect(touchLabelled(r, "Varsayılana dön")).toBeUndefined();
    act(() => {
      rowTitled(r, "Az").props.onPress();
    });
    const reset = touchLabelled(r, "Varsayılana dön");
    expect(reset).toBeDefined();
    act(() => {
      reset.props.onPress();
    });
    expect(storage.get(storage.Keys.hapticsLevel)).toBe("balanced");
    expect(storage.get(storage.Keys.hapticsCategories)).toBeNull();
  });

  test("desen kitaplığındaki her çip kendi desenini çalar", () => {
    const r = render();
    act(() => {
      touchLabelled(r, "Yanlış").props.onPress();
    });
    expect(native.notificationAsync).toHaveBeenCalledWith("error");
  });

  test("ana anahtar kapalıyken ince ayarlar devre dışı ve ana anahtar bağlamdan yazılır", () => {
    mockEnabled = false;
    const r = render();
    const wrapper = r.root.findAll((n) => n.type === "View" && n.props.pointerEvents === "none");
    expect(wrapper.length).toBe(1);
    act(() => {
      rowTitled(r, "Titreşim").props.right.props.onValueChange(true);
    });
    expect(mockChangeEnabled).toHaveBeenCalledWith(true);
  });
});
