// Ayarlar'daki "Seelogd Premium" alanının abone hâli: Premium / Premium Max planında büyük
// vitrin yerine küçük "Aboneliği yönet" çubuğu (components/settings/PremiumMemberBar.js), çubuk
// Kullanım ve haklar ekranını açar. Gerçek çizim (degrade, ışık süpürmesi, gölge) cihazda
// doğrulanır; burada kurallar kilitlenir: kime gösterilir, nereye gider, plana göre kimlik, ve
// ekranlar arası bağlar (Ayarlar'daki yinelenen satır, hedef ekrandaki yönetme düğmesi).
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockPlan = "premium";
const mockNavigate = jest.fn();
const mockTheme = {
  primary: "#101010",
  secondary: "#202020",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
  colors: { purple: "#A855F7", green: "#22C55E", orange: "#F97316" },
};

jest.mock("react-native", () => {
  const value = () => ({ interpolate: () => 0, setValue: () => {} });
  const anim = () => ({ start: () => {}, stop: () => {} });
  return {
    Animated: {
      View: "AnimatedView",
      Value: function Value() {
        return value();
      },
      loop: anim,
      sequence: anim,
      delay: anim,
      timing: anim,
      spring: anim,
    },
    Easing: { inOut: () => () => 0, quad: () => 0 },
    Pressable: "Pressable",
    Text: "Text",
    View: "View",
    StyleSheet: { create: (s) => s, absoluteFill: {} },
  };
});
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));
jest.mock("@hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/PremiumContext", () => ({ usePremium: () => ({ plan: mockPlan }) }));

const {
  MAX_GOLD,
  MAX_ROSE,
  MEMBER_BAR_ROUTE,
  memberBarAccessibilityLabel,
  memberBarLook,
  memberBarTitle,
  shouldShowMemberBar,
} = require("../utils/premiumMemberBar");
const PremiumMemberBar = require("../components/settings/PremiumMemberBar").default;

const read = (...parts) => fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

let warn;
beforeEach(() => {
  mockPlan = "premium";
  mockNavigate.mockClear();
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => warn.mockRestore());

const texts = (tree) =>
  tree.root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));

describe("shouldShowMemberBar", () => {
  it("yalnız ücretli planda çubuk; Free büyük vitrini görür", () => {
    expect(shouldShowMemberBar("premium")).toBe(true);
    expect(shouldShowMemberBar("unlimited")).toBe(true);
    expect(shouldShowMemberBar("free")).toBe(false);
    expect(shouldShowMemberBar(undefined)).toBe(false);
    expect(shouldShowMemberBar(null)).toBe(false);
    expect(shouldShowMemberBar("nonsense")).toBe(false);
  });

  it("çubuk Kullanım ve haklar ekranına gider", () => {
    expect(MEMBER_BAR_ROUTE).toBe("PremiumUsageScreen");
  });
});

describe("memberBarLook — plana göre kimlik", () => {
  it("Premium: elmas, 'Premium', tema vurgusu → mor", () => {
    const look = memberBarLook("premium", mockTheme);
    expect(look).toMatchObject({
      max: false,
      icon: "diamond",
      planName: "Premium",
      from: mockTheme.accent,
      to: mockTheme.colors.purple,
      ink: mockTheme.accent,
    });
  });

  it("Max: sonsuzluk, 'Premium Max', altın → gül; Premium'dan bir bakışta ayrışır", () => {
    const max = memberBarLook("unlimited", mockTheme);
    const premium = memberBarLook("premium", mockTheme);
    expect(max).toMatchObject({ max: true, icon: "infinite", planName: "Premium Max", from: MAX_GOLD, to: MAX_ROSE });
    expect(max.icon).not.toBe(premium.icon);
    expect(max.from).not.toBe(premium.from);
    expect(max.to).not.toBe(premium.to);
  });

  it("Max metin rengi altın değil TEMA turuncusu (açık temada koyulaşır, okunur kalır)", () => {
    expect(memberBarLook("unlimited", mockTheme).ink).toBe(mockTheme.colors.orange);
    // Tema turuncusu yoksa altına düşer; tema hiç yoksa da patlamaz.
    expect(memberBarLook("unlimited", { accent: "#123456" }).ink).toBe(MAX_GOLD);
    expect(() => memberBarLook("premium", undefined)).not.toThrow();
  });
});

describe("metinler", () => {
  it("başlık tr/en/es; bilinmeyen dil İngilizce", () => {
    expect(memberBarTitle("tr")).toBe("Aboneliği yönet");
    expect(memberBarTitle("en")).toBe("Manage subscription");
    expect(memberBarTitle("es")).toBe("Gestionar suscripción");
    expect(memberBarTitle("xx")).toBe("Manage subscription");
  });

  it("erişilebilirlik etiketi plan + eylem + hedefi söyler", () => {
    expect(memberBarAccessibilityLabel("unlimited", "en")).toBe(
      "Premium Max, Manage subscription, plan, usage and limits",
    );
    expect(memberBarAccessibilityLabel("premium", "tr")).toBe(
      "Premium, Aboneliği yönet, plan, kullanım ve limitler",
    );
  });
});

describe("PremiumMemberBar — çizim ve davranış", () => {
  it("Premium: plan adı, AKTİF ve 'Aboneliği yönet' yazar", () => {
    const tree = render(<PremiumMemberBar />);
    const all = texts(tree);
    expect(all).toContain("PREMIUM");
    expect(all).toContain("Aboneliği yönet");
    expect(all.some((t) => /AKT/i.test(t) || /ACTIVE/i.test(t))).toBe(true);
  });

  it("Max: 'PREMIUM MAX' yazar ve sonsuzluk simgesi çizer", () => {
    mockPlan = "unlimited";
    const tree = render(<PremiumMemberBar />);
    expect(texts(tree)).toContain("PREMIUM MAX");
    const icons = tree.root.findAllByType("AppIcon").map((node) => node.props.name);
    expect(icons).toContain("infinite");
    expect(icons).not.toContain("diamond");
  });

  it("dokununca Kullanım ve haklar ekranına gider; etiketi okunur", () => {
    const tree = render(<PremiumMemberBar />);
    const press = tree.root.findByProps({ testID: "premium-member-bar" });
    expect(press.props.accessibilityRole).toBe("button");
    expect(press.props.accessibilityLabel).toContain("Aboneliği yönet");
    act(() => {
      press.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("PremiumUsageScreen");
  });
});

describe("ekranlar arası bağlar (kaynak bekçisi)", () => {
  it("PremiumSettingsCard: ücretli planda çubuk, Free'de vitrin; vitrin abone dallarını taşımaz", () => {
    const src = read("components", "settings", "PremiumSettingsCard.js");
    expect(src).toMatch(/shouldShowMemberBar\(plan\) \? <PremiumMemberBar \/> : <PremiumShowcase \/>/);
    expect(src).not.toMatch(/isPremium|isUnlimited/);
  });

  it("hedef ekran gerçekten kayıtlı", () => {
    expect(read("App.js")).toMatch(/name="PremiumUsageScreen"/);
  });

  it("Ayarlar: çubuk varken aynı ekrana giden ikinci 'Kullanım ve haklar' satırı çizilmez", () => {
    const src = read("screens", "tabs", "SettingsScreen.js");
    expect(src).toContain("const hasMemberBar = shouldShowMemberBar(premiumPlan);");
    expect(src).toMatch(/\{hasMemberBar \? null : \(\s*<View[\s\S]*?navigate\("PremiumUsageScreen"\)/);
  });

  it("Kullanım ve haklar: yönetme düğmesi yalnız MAĞAZA aboneliği olan planda", () => {
    const src = read("screens", "tabs", "settings", "PremiumUsageScreen.js");
    expect(src).toContain("const canManage = storePlan !== PREMIUM_PLAN.FREE;");
    expect(src).toMatch(/\{canManage \? \(\s*(\/\/[^\n]*\n\s*)*<Pressable\s+testID="premium-usage-manage"/);
    expect(src).toContain("openCustomerCenter()");
  });
});
