// Ambiyans + ikon arka planı ayarları 9 Kas'ta Kişiselleştirme'den Ayarlar >
// Atmosfer'e taşındı. Bu dosya:
//   • kartların açık/kapalı/Free hâllerini render edip ayar yazıcılarını sürer
//     (anahtarlar ve kaydedilen değerler DEĞİŞMEDİ);
//   • Kişiselleştirme'de ikinci kopya kalmadığını, Atmosfer önizlemesinin iki
//     katmanı da (ambiyans → desen → atmosfer sırasıyla) çizdiğini kaynaktan
//     denetler.
import React from "react";
import fs from "fs";
import path from "path";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;
const mockOrigError = console.error;
jest.spyOn(console, "error").mockImplementation((msg, ...rest) => {
  if (String(msg).includes("react-test-renderer is deprecated")) return;
  mockOrigError(msg, ...rest);
});

const mockAmbient = {};
const mockIcon = {};
const mockUpsell = jest.fn();
const mockNavigate = jest.fn();
let mockDecorHidden = null;
const mockReshuffle = jest.fn();

function resetSettings() {
  Object.assign(mockAmbient, {
    showAmbientBackground: false,
    ambientAllowed: true,
    changeShowAmbientBackground: jest.fn(),
    ambientDensity: "auto",
    changeAmbientDensity: jest.fn(),
    ambientOpacity: 0.8,
    changeAmbientOpacity: jest.fn(),
  });
  Object.assign(mockIcon, {
    showIconBackground: false,
    iconBackgroundAllowed: true,
    changeShowIconBackground: jest.fn(),
    iconBackgroundMode: "shared",
    changeIconBackgroundMode: jest.fn(),
    iconBackgroundOpacity: 1,
    changeIconBackgroundOpacity: jest.fn(),
    iconBackgroundDensity: "auto",
    changeIconBackgroundDensity: jest.fn(),
  });
}

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => {
    const C = ({ children, ...p }) => React.createElement(name, p, children);
    C.displayName = name;
    return C;
  };
  class Value {
    constructor(v) {
      this.v = v;
    }
    setValue(v) {
      this.v = v;
    }
    interpolate() {
      return this;
    }
  }
  const anim = { start: () => {}, stop: () => {} };
  return {
    View: host("View"),
    Text: host("Text"),
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {} },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Animated: { View: host("AnimatedView"), Value, spring: () => anim, timing: () => anim },
  };
});
jest.mock("../components/typography/AppText", () => {
  const React = require("react");
  const T = ({ children, ...p }) => React.createElement("Text", p, children);
  return { __esModule: true, default: T, AppText: T, AppTextInput: T, AnimatedAppText: T, ReanimatedAppText: T };
});
jest.mock("../components/AppIcon", () => () => null);
jest.mock("../components/SwitchToggle", () => {
  const React = require("react");
  return (p) => React.createElement("Switch", p);
});
jest.mock("../components/premium/PremiumPill", () => {
  const React = require("react");
  return () => React.createElement("PremiumPill");
});
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return ({ children }) => React.createElement("GlassBox", null, children);
});
jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return ({ children, ...p }) => React.createElement("Touchable", p, children);
});
jest.mock("../components/settings/AtmosphereControls", () => {
  const React = require("react");
  return { DensitySegment: (p) => React.createElement("DensitySegment", p) };
});
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ showUpsell: mockUpsell }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "tr",
    t: new Proxy({}, { get: (_, k) => String(k) }),
  }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useAmbientBackgroundSettings: () => mockAmbient,
  useIconBackgroundSettings: () => mockIcon,
  useDecorScopeSettings: () => ({ decorHidden: mockDecorHidden }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("../services/effectSettings", () => ({
  useEffectPreset: () => require("../utils/deviceTier").getEffectPreset("full"),
}));
jest.mock("../services/decorSeed", () => ({ reshuffleDecorSeed: () => mockReshuffle() }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: () => {} }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_k, fb) => fb,
  percentText: (n) => `%${n}`,
}));

const {
  AmbientLayerCard,
  IconLayerCard,
  RegenerateBackgroundCard,
  DecorScopesCard,
} = require("../components/settings/BackgroundLayerCards");

const colors = new Proxy({}, { get: () => "#000" });

function render(el) {
  let tree;
  act(() => {
    tree = create(el);
  });
  return tree;
}
const all = (tree, type) => tree.root.findAll((n) => n.type === type);
const texts = (tree) =>
  all(tree, "Text")
    .map((n) => [].concat(n.props.children).join(""))
    .join(" | ");

beforeEach(() => {
  resetSettings();
  mockUpsell.mockClear();
  mockReshuffle.mockClear();
});

describe("Ambiyans kartı", () => {
  test("kapalıyken yalnız başlık + anahtar; anahtar mevcut yazıcıyı çağırır", () => {
    const tree = render(<AmbientLayerCard colors={colors} />);
    expect(all(tree, "DensitySegment")).toHaveLength(0);
    const [sw] = all(tree, "Switch");
    expect(sw.props.value).toBe(false);
    expect(sw.props.locked).toBe(false);
    act(() => sw.props.onValueChange(true));
    expect(mockAmbient.changeShowAmbientBackground).toHaveBeenCalledWith(true);
  });

  test("açıkken yoğunluk + saydamlık; değerler eski anahtarlara yazılır", () => {
    mockAmbient.showAmbientBackground = true;
    const tree = render(<AmbientLayerCard colors={colors} />);
    const [seg] = all(tree, "DensitySegment");
    act(() => seg.props.onChange("high"));
    expect(mockAmbient.changeAmbientDensity).toHaveBeenCalledWith("high");
    expect(texts(tree)).toContain("%80");
  });

  test("Free: anahtar kilitli, Premium hap, karta basmak yükseltme açar", () => {
    mockAmbient.ambientAllowed = false;
    const tree = render(<AmbientLayerCard colors={colors} />);
    expect(all(tree, "Switch")[0].props.locked).toBe(true);
    expect(all(tree, "PremiumPill")).toHaveLength(1);
    const card = all(tree, "Touchable")[0];
    expect(card.props.disabled).toBe(false);
    act(() => card.props.onPress());
    expect(mockUpsell).toHaveBeenCalled();
  });
});

describe("İkon kartı", () => {
  test("açıkken saydamlık + yoğunluk + düzen; düzen yazıcısı çağrılır", () => {
    mockIcon.showIconBackground = true;
    const tree = render(<IconLayerCard colors={colors} />);
    expect(all(tree, "DensitySegment")).toHaveLength(1);
    const random = all(tree, "Touchable").find((n) => n.props.accessibilityRole === "radio" && !n.props.accessibilityState.checked);
    act(() => random.props.onPress());
    expect(mockIcon.changeIconBackgroundMode).toHaveBeenCalledWith("random");
    expect(texts(tree)).toContain("28 ikon");
  });
});

describe("Yeniden oluştur", () => {
  test("iki katman da kapalıyken görünmez, biri açıkken tohumu yeniler", () => {
    expect(render(<RegenerateBackgroundCard colors={colors} />).toJSON()).toBeNull();
    mockIcon.showIconBackground = true;
    const tree = render(<RegenerateBackgroundCard colors={colors} />);
    act(() => all(tree, "Touchable")[0].props.onPress());
    expect(mockReshuffle).toHaveBeenCalledTimes(1);
  });
});

describe("DecorScopesCard (Ekran bazında ayarla)", () => {
  test("rozet durumu gösterir, dokununca DecorScopesScreen açılır", () => {
    mockDecorHidden = null;
    let tree = render(<DecorScopesCard colors={colors} />);
    expect(texts(tree)).toContain("Her yerde");
    act(() => all(tree, "Touchable")[0].props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("DecorScopesScreen");
    mockDecorHidden = { snow: ["home"] };
    tree = render(<DecorScopesCard colors={colors} />);
    expect(texts(tree)).toContain("Özel");
  });

  test("Kişiselleştirme'de kopyası yok, Atmosfer'de var", () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
    expect(read("screens/tabs/settings/PersonalizationScreen.js")).not.toContain('navigate("DecorScopesScreen")');
    expect(read("screens/tabs/settings/AtmosphereScreen.js")).toContain("<DecorScopesCard");
  });
});

describe("Taşıma bekçisi", () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

  test("Kişiselleştirme'de ambiyans/ikon ayarı kopyası kalmadı", () => {
    const src = read("screens/tabs/settings/PersonalizationScreen.js");
    for (const yasak of [
      "changeShowAmbientBackground",
      "changeShowIconBackground",
      "changeAmbientOpacity",
      "changeIconBackgroundMode",
      "reshuffleDecorSeed",
    ]) {
      expect(src).not.toContain(yasak);
    }
  });

  test("Atmosfer ekranı kartları ve önizleme katmanlarını sırayla çiziyor", () => {
    const src = read("screens/tabs/settings/AtmosphereScreen.js");
    for (const kart of ["<AmbientLayerCard", "<IconLayerCard", "<RegenerateBackgroundCard"]) {
      expect(src).toContain(kart);
    }
    const a = src.indexOf("<AmbientLayer />");
    const i = src.indexOf("<IconPattern ");
    const w = src.indexOf("<WeatherLayer ");
    const m = src.indexOf("<MockScreen ");
    expect(a).toBeGreaterThan(-1);
    expect(a < i && i < w && w < m).toBe(true);
  });
});
