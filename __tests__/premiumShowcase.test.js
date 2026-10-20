// Ayarlar'daki Free vitrini (components/settings/PremiumSettingsCard.js → PremiumShowcase) ve
// onun saf içerik modeli (utils/premiumShowcase.js). Vitrin "Free'de şu → Premium'da şu"
// diye SOMUT sayı söyler; bu sayıların kayıttan (utils/premiumFeatures.js) geldiği ve fiyatın
// uydurma olmadığı burada kilitlenir. Gerçek çizim (degrade, gölge, ışık süpürmesi) cihazda
// doğrulanır.
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockPlan = "free";
let mockPackages = [];
let mockIntroEligible = [];
let mockTestStore = false;
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
    ActivityIndicator: "ActivityIndicator",
    Easing: { inOut: () => () => 0, quad: () => 0, sin: () => 0 },
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
jest.mock("@services/hapticsService", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));
jest.mock("@hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/PremiumContext", () => ({
  usePremium: () => ({
    plan: mockPlan,
    loading: false,
    packages: mockPackages,
    introEligibleIds: mockIntroEligible,
    usingTestStore: mockTestStore,
  }),
}));
// Üyelik çubuğu bu dosyanın konusu değil; ayrı testte (premiumMemberBar.test.js).
jest.mock("../components/settings/PremiumMemberBar", () => ({ __esModule: true, default: "MemberBar" }));

const {
  buildShowcaseHighlights,
  buildShowcasePerks,
  buildShowcasePricing,
  showcaseCtaSubtitle,
  showcaseOfferBadge,
  showcaseOfferText,
} = require("../utils/premiumShowcase");
const { formatFeatureValue, getFeatureLimit } = require("../utils/premiumFeatures");
const PremiumSettingsCard = require("../components/settings/PremiumSettingsCard").default;

// ── Sahte mağaza paketleri (RevenueCat biçimi) ──
const phase = (amount, formatted, extra = {}) => ({
  price: { amountMicros: amount * 1000000, formatted, currencyCode: "TRY" },
  ...extra,
});
const monthlyPackage = ({ offer = false, id = "premium_monthly" } = {}) => ({
  identifier: "$rc_monthly",
  packageType: "MONTHLY",
  product: {
    identifier: id,
    price: 59.99,
    priceString: "₺59,99",
    currencyCode: "TRY",
    subscriptionPeriod: "P1M",
    defaultOption: {
      isBasePlan: !offer,
      fullPricePhase: phase(59.99, "₺59,99"),
      ...(offer
        ? { introPhase: phase(29.99, "₺29,99", { billingCycleCount: 3, billingPeriod: { unit: "MONTH", value: 1 } }) }
        : {}),
    },
  },
});
const annualPackage = () => ({
  identifier: "$rc_annual",
  packageType: "ANNUAL",
  product: {
    identifier: "premium_yearly",
    price: 449.99,
    priceString: "₺449,99",
    currencyCode: "TRY",
    subscriptionPeriod: "P1Y",
  },
});

describe("buildShowcaseHighlights — rakamlar kayıttan", () => {
  it("üç karo: AI mesajı, arkadaş, özel liste", () => {
    expect(buildShowcaseHighlights("tr").map((item) => item.id)).toEqual(["ai_messages", "friends", "custom_lists"]);
  });

  it("Free ve Premium değerleri kayıttaki limitlerle BİREBİR (AI'da günlük tavan)", () => {
    const [ai, friends, lists] = buildShowcaseHighlights("tr");
    expect(ai).toMatchObject({
      from: String(getFeatureLimit("ai_messages", "free").daily),
      to: String(getFeatureLimit("ai_messages", "premium").daily),
    });
    expect(friends).toMatchObject({
      from: String(getFeatureLimit("friends", "free")),
      to: String(getFeatureLimit("friends", "premium")),
    });
    expect(lists).toMatchObject({
      from: String(getFeatureLimit("custom_lists", "free")),
      to: String(getFeatureLimit("custom_lists", "premium")),
    });
  });

  it("her karoda Premium değeri Free'den GERÇEKTEN yüksek (aksi halde 'yükselt' yalan olur)", () => {
    for (const item of buildShowcaseHighlights("en")) {
      expect(Number(item.to)).toBeGreaterThan(Number(item.from));
    }
  });

  it("etiketler tr/en/es; bilinmeyen dil İngilizce", () => {
    const labels = (lang) => buildShowcaseHighlights(lang).map((item) => item.label);
    expect(labels("tr")).toEqual(["AI mesajı / gün", "Arkadaş", "Özel liste"]);
    expect(labels("en")).toEqual(["AI chats / day", "Friends", "Custom lists"]);
    expect(labels("es")).toEqual(["Chats IA/día", "Amigos", "Mis listas"]);
    expect(labels("xx")).toEqual(labels("en"));
  });
});

describe("buildShowcasePerks — Free'de kapalı olanlar", () => {
  it("oyun/CineSwipe, rozet ve yazı tipi çipleri; metinler kayıt biçimleyicisinden", () => {
    const perks = buildShowcasePerks("tr");
    expect(perks.map((perk) => perk.id)).toEqual(["play", "badge", "fonts"]);
    expect(perks.find((p) => p.id === "badge").label).toBe(formatFeatureValue("identity_badge", "premium", "tr"));
    expect(perks.find((p) => p.id === "fonts").label).toBe(formatFeatureValue("font_catalog", "premium", "tr"));
    expect(perks.find((p) => p.id === "play").label).toBe("Oyun ve CineSwipe");
  });

  it("İngilizce ve İspanyolca çip metinleri", () => {
    expect(buildShowcasePerks("en").map((p) => p.label)).toEqual(["Games & CineSwipe", "Epic badge", "56 fonts"]);
    expect(buildShowcasePerks("es")[0].label).toBe("Juegos y CineSwipe");
  });
});

describe("buildShowcasePricing — yalnız gerçek mağaza fiyatı", () => {
  it("paket yok / geçersiz → null (uydurma fiyat yazılmaz)", () => {
    expect(buildShowcasePricing({ packages: [] })).toBeNull();
    expect(buildShowcasePricing({ packages: undefined })).toBeNull();
    expect(buildShowcasePricing({ packages: null })).toBeNull();
    expect(buildShowcasePricing()).toBeNull();
  });

  it("yalnız Max paketleri varsa Premium fiyatı yok → null", () => {
    const max = monthlyPackage({ id: "max_monthly" });
    expect(buildShowcasePricing({ packages: [max], language: "tr" })).toBeNull();
  });

  it("aylık paketin NORMAL fiyatı, teklifsiz", () => {
    expect(buildShowcasePricing({ packages: [monthlyPackage()], language: "tr" })).toEqual({
      price: "₺59,99",
      period: "/ ay",
      offer: null,
    });
  });

  it("aylık varken yıllığa değil aylığa bakar; yalnız yıllık varsa yıllık", () => {
    const both = buildShowcasePricing({ packages: [annualPackage(), monthlyPackage()], language: "en" });
    expect(both).toMatchObject({ price: "₺59,99", period: "/ month" });
    const annualOnly = buildShowcasePricing({ packages: [annualPackage()], language: "es" });
    expect(annualOnly).toMatchObject({ price: "₺449,99", period: "/ año" });
  });

  it("Play lansman teklifi: yüzde ve süre mağazadan; fiyat NORMAL fiyat kalır", () => {
    const pricing = buildShowcasePricing({ packages: [monthlyPackage({ offer: true })], language: "tr" });
    expect(pricing.price).toBe("₺59,99");
    expect(pricing.offer).toEqual({ free: false, percent: 50, duration: "İlk 3 ay" });
  });

  it("iOS giriş teklifi uygunluğu yoksa teklif gösterilmez", () => {
    const ios = {
      identifier: "$rc_monthly",
      packageType: "MONTHLY",
      product: {
        identifier: "premium_monthly",
        price: 59.99,
        priceString: "₺59,99",
        currencyCode: "TRY",
        subscriptionPeriod: "P1M",
        introPrice: { price: 29.99, priceString: "₺29,99", cycles: 3, periodUnit: "MONTH", periodNumberOfUnits: 1 },
      },
    };
    expect(buildShowcasePricing({ packages: [ios], introEligibleIds: [], language: "tr" }).offer).toBeNull();
    expect(
      buildShowcasePricing({ packages: [ios], introEligibleIds: ["premium_monthly"], language: "tr" }).offer,
    ).toMatchObject({ percent: 50, free: false });
  });

  it("Test Store'da hedef lansman fiyatı gösterilir (ödeme ekranıyla aynı kural)", () => {
    const fake = monthlyPackage();
    fake.product.price = 0;
    fake.product.priceString = "$0.00";
    fake.product.defaultOption = undefined;
    const pricing = buildShowcasePricing({ packages: [fake], usingTestStore: true, language: "tr" });
    expect(pricing.price).toMatch(/59,99/);
  });
});

describe("metinler", () => {
  const offer = { free: false, percent: 50, duration: "İlk 3 ay" };

  it("düğmenin ikinci satırı: fiyat varsa fiyat · iptal, yoksa genel metin", () => {
    const pricing = { price: "₺59,99", period: "/ ay", offer: null };
    expect(showcaseCtaSubtitle(pricing, "tr")).toBe("₺59,99 / ay · İstediğin an iptal");
    expect(showcaseCtaSubtitle(pricing, "en")).toBe("₺59,99 / ay · Cancel anytime");
    expect(showcaseCtaSubtitle(null, "tr")).toBe("Doğrudan fiyatlandırma · Dilediğin an iptal");
    expect(showcaseCtaSubtitle(null, "es")).toBe("Precios claros · Cancela cuando quieras");
    expect(showcaseCtaSubtitle(null, "pt")).toBe("Preços claros · Cancele quando quiser");
  });

  it("dar ekranda teklif ikinci satırın içine yazılır ve 'iptal' cümlesi düşer", () => {
    const pricing = { price: "₺59,99", period: "/ ay", offer };
    expect(showcaseCtaSubtitle(pricing, "tr", { inlineOffer: true })).toBe("₺59,99 / ay · İlk 3 ay %50 indirim");
    expect(showcaseCtaSubtitle(pricing, "tr")).toBe("₺59,99 / ay · İstediğin an iptal");
    // Teklif yoksa inlineOffer bir şey değiştirmez.
    expect(showcaseCtaSubtitle({ ...pricing, offer: null }, "tr", { inlineOffer: true })).toBe("₺59,99 / ay · İstediğin an iptal");
  });

  it("teklif metni ve rozeti: indirimli / ücretsiz, üç dil", () => {
    expect(showcaseOfferText(offer, "en")).toBe("İlk 3 ay 50% off");
    expect(showcaseOfferText(offer, "es")).toBe("İlk 3 ay -50 %");
    expect(showcaseOfferText(offer, "pt")).toBe("İlk 3 ay -50%");
    expect(showcaseOfferText({ free: true, duration: "First month" }, "en")).toBe("First month free");
    expect(showcaseOfferText(null, "tr")).toBe("");
    expect(showcaseOfferBadge(offer, "tr")).toEqual({ big: "%50", small: "İlk 3 ay" });
    expect(showcaseOfferBadge(offer, "en")).toEqual({ big: "50% off", small: "İlk 3 ay" });
    expect(showcaseOfferBadge({ free: true, duration: "x" }, "tr")).toEqual({ big: "Ücretsiz", small: "x" });
    expect(showcaseOfferBadge(null, "tr")).toBeNull();
  });
});

// ── Kartın kendisi ──
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

let warn;
beforeEach(() => {
  mockPlan = "free";
  mockPackages = [];
  mockIntroEligible = [];
  mockTestStore = false;
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
const layoutCta = (tree, width) => {
  const cta = tree.root.findAll(
    (node) => node.type === "View" && typeof node.props.onLayout === "function",
  )[0];
  act(() => {
    cta.props.onLayout({ nativeEvent: { layout: { width } } });
  });
};

describe("PremiumSettingsCard — Free vitrini", () => {
  it("Free'de vitrin, abonede üyelik çubuğu", () => {
    expect(render(<PremiumSettingsCard />).root.findAllByProps({ testID: "premium-showcase" }).length).toBeGreaterThan(0);
    mockPlan = "premium";
    expect(render(<PremiumSettingsCard />).root.findAllByType("MemberBar")).toHaveLength(1);
    mockPlan = "unlimited";
    expect(render(<PremiumSettingsCard />).root.findAllByType("MemberBar")).toHaveLength(1);
  });

  it("karolarda 3 → 20, 2 → 150, 1 → 25 ve etiketleri; çipler; düğme başlığı", () => {
    const all = texts(render(<PremiumSettingsCard />));
    for (const expected of ["3", "20", "AI mesajı / gün", "2", "150", "Arkadaş", "1", "25", "Özel liste"]) {
      expect(all).toContain(expected);
    }
    expect(all).toContain("Oyun ve CineSwipe");
    expect(all).toContain("Epik rozet");
    expect(all).toContain("56 yazı tipi");
    expect(all).toContain("Planları Gör");
    expect(all).toContain("Sinemanın Sınırlarını Kaldır");
  });

  it("karoların erişilebilirlik etiketi Free ve Premium değerini söyler", () => {
    const tree = render(<PremiumSettingsCard />);
    const labels = tree.root
      .findAll((node) => node.type === "View" && node.props.accessible)
      .map((node) => node.props.accessibilityLabel);
    expect(labels).toContain("AI mesajı / gün: Free 3, Premium 20");
    expect(labels).toContain("Arkadaş: Free 2, Premium 150");
  });

  it("mağaza cevap vermediyse genel metin, fiyat ve rozet yok", () => {
    const tree = render(<PremiumSettingsCard />);
    expect(texts(tree)).toContain("Doğrudan fiyatlandırma · Dilediğin an iptal");
    expect(tree.root.findAllByProps({ testID: "premium-showcase-offer" })).toHaveLength(0);
  });

  it("gerçek fiyat: ikinci satırda mağaza fiyatı; teklif yoksa rozet yok", () => {
    mockPackages = [monthlyPackage()];
    const tree = render(<PremiumSettingsCard />);
    expect(texts(tree)).toContain("₺59,99 / ay · İstediğin an iptal");
    expect(tree.root.findAllByProps({ testID: "premium-showcase-offer" })).toHaveLength(0);
  });

  it("teklif varken geniş düğmede rozet, dar düğmede satır içi metin", () => {
    mockPackages = [monthlyPackage({ offer: true })];
    const tree = render(<PremiumSettingsCard />);
    layoutCta(tree, 326);
    expect(tree.root.findAllByProps({ testID: "premium-showcase-offer" }).length).toBeGreaterThan(0);
    expect(texts(tree)).toContain("%50");
    expect(texts(tree)).toContain("₺59,99 / ay · İstediğin an iptal");

    layoutCta(tree, 296);
    expect(tree.root.findAllByProps({ testID: "premium-showcase-offer" })).toHaveLength(0);
    expect(texts(tree)).toContain("₺59,99 / ay · İlk 3 ay %50 indirim");
  });

  it("dokununca ödeme ekranı 'settings' kaynağıyla açılır", () => {
    const tree = render(<PremiumSettingsCard />);
    const press = tree.root.findByProps({ testID: "premium-showcase" });
    expect(press.props.accessibilityRole).toBe("button");
    expect(press.props.accessibilityLabel).toContain("Planları Gör");
    act(() => {
      press.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("PremiumScreen", { source: "settings" });
  });
});
