// Davet ekranı + "Kod gir" sayfası: GERÇEK bileşenler, sahte veri/servis.
// Cihaz görüntüsü yerine çalışma anı kanıtı: dolu veriyle çizilir mi, düğmeler doğru servisi doğru
// parametreyle çağırıyor mu, red gerekçeleri kullanıcı metnine çevriliyor mu.
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockOverview = { current: null };
const mockReload = jest.fn();
const mockClaim = jest.fn();
const mockRedeem = jest.fn();
const mockShare = jest.fn(() => Promise.resolve({}));
const mockCopy = jest.fn(() => Promise.resolve());
const mockToast = { success: jest.fn(), error: jest.fn(), show: jest.fn() };
const mockTrack = jest.fn();

const theme = {
  primary: "#101010",
  secondary: "#202020",
  between: "#262626",
  border: "#333333",
  accent: "#3388ff",
  bold: "#2266dd",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
  colors: { purple: "#A855F7", green: "#22C55E", orange: "#F97316", red: "#EF4444", blue: "#3B82F6" },
};

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  Share: { share: (...args) => mockShare(...args) },
  StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {} },
}));
// Derleme eklentisi (scripts/babel-transform-app-text.js) Text/TextInput'u AppText/AppTextInput'a çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("expo-clipboard", () => ({ setStringAsync: (...args) => mockCopy(...args) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("@components/AppToast", () => ({ __esModule: true, default: mockToast }));
jest.mock("@components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("@components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme }) }));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@services/analytics", () => ({
  ANALYTICS_EVENTS: { REFERRAL_ACTION: "referral_action", CODE_REDEEM: "code_redeem" },
  trackEvent: (...args) => mockTrack(...args),
}));
jest.mock("@services/referralService", () => ({
  claimReferralReward: (...args) => mockClaim(...args),
  redeemCode: (...args) => mockRedeem(...args),
  referralErrorReason: (error) => error?.details?.reason || null,
}));
jest.mock("@hooks/useReferralOverview", () => ({
  __esModule: true,
  default: () => ({ data: mockOverview.current, loading: false, error: null, reload: mockReload }),
}));
jest.mock("../screens/tabs/settings/settingsUi", () => ({
  SettingsSubScreen: ({ children }) => children,
  buildUiColors: (t) => ({
    card: t.secondary,
    border: t.border,
    borderMuted: t.border,
    text: t.text.primary,
    muted: t.text.muted,
    accent: t.accent,
    purple: t.colors.purple,
    green: t.colors.green,
    white: "#FFFFFF",
    iconPurple: "#a855f722",
  }),
}));

const ReferralScreen = require("../screens/tabs/settings/ReferralScreen").default;

function overview(extra = {}) {
  return {
    code: "ABCDEFGH",
    displayCode: "ABCD-EFGH",
    creditMonths: 0,
    earnedMonths: 0,
    maxMonths: 12,
    rewardDays: 30,
    promoUntilMs: null,
    storeSubscribed: false,
    invitees: [],
    counts: { registered: 0, subscribed: 0, rewarded: 0 },
    invitedBy: null,
    limits: { discountPercent: 30, offerId: "referral-30-1m", windowDays: 14 },
    ...extra,
  };
}

const flush = () => act(async () => {});
const render = async () => {
  let tree;
  await act(async () => {
    tree = create(<ReferralScreen />);
  });
  return tree;
};
const allText = (tree) =>
  tree.root
    .findAll((node) => node.type === "Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join(" | ");
const pressByText = async (tree, text) => {
  const target = tree.root.findAll(
    (node) => node.type === "Pressable" && allText({ root: node }).includes(text),
  )[0];
  expect(target).toBeTruthy();
  await act(async () => {
    await target.props.onPress();
  });
};

let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  mockOverview.current = overview();
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => errorSpy.mockRestore());

describe("ReferralScreen", () => {
  it("kod, nasıl çalışır ve boş liste çizilir", async () => {
    const text = allText(await render());
    expect(text).toContain("ABCD-EFGH");
    expect(text).toContain("Getir, 1 ay Premium kazan");
    expect(text).toContain("Henüz kimse kodunu girmedi");
    expect(text).toContain("Henüz ücretsiz ay kazanmadın");
    expect(text).toContain("0 / 12 ay");
  });

  it("davet edilenler durumlarıyla listelenir: Kayıt oldu / Abone oldu / ödül", async () => {
    mockOverview.current = overview({
      invitees: [
        { uid: "a", name: "Ayşe", username: "ayse", avatarIndex: 1, photoURL: null, status: "registered" },
        { uid: "b", name: "Mehmet", username: "mehmet", avatarIndex: 2, photoURL: null, status: "subscribed" },
        { uid: "c", name: "Zeynep", username: "zeynep", avatarIndex: 3, photoURL: null, status: "rewarded" },
      ],
      counts: { registered: 3, subscribed: 2, rewarded: 1 },
    });
    const text = allText(await render());
    expect(text).toContain("Ayşe");
    expect(text).toContain("Kayıt oldu");
    expect(text).toContain("Mehmet");
    expect(text).toContain("Abone oldu");
    expect(text).toContain("Abone oldu · ücretsiz ay kazandın");
    expect(text).toContain("3 kişi kodunu girdi · 2 kişi abone oldu");
  });

  it("Kopyala: biçimli kodu panoya yazar; Davet gönder: kodu ve oranı paylaşır", async () => {
    const tree = await render();
    await pressByText(tree, "Kopyala");
    expect(mockCopy).toHaveBeenCalledWith("ABCD-EFGH");
    expect(mockToast.success).toHaveBeenCalledWith("Kod kopyalandı");

    await pressByText(tree, "Davet gönder");
    const message = mockShare.mock.calls[0][0].message;
    expect(message).toContain("ABCD-EFGH");
    expect(message).toContain("%30");
    expect(mockTrack).toHaveBeenCalledWith("referral_action", { action: "share" });
  });

  it("birikmiş ay varsa 'Ücretsiz ayı başlat' çalışır ve ekranı yeniler", async () => {
    mockOverview.current = overview({ creditMonths: 2, earnedMonths: 2 });
    mockClaim.mockResolvedValue({ untilMs: Date.UTC(2026, 10, 19) });
    const tree = await render();
    expect(allText(tree)).toContain("2 ücretsiz ay seni bekliyor");
    await pressByText(tree, "Ücretsiz ayı başlat");
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalled();
  });

  it("mağaza aboneliği sürerken ay bekler ve başlat düğmesi yok", async () => {
    mockOverview.current = overview({ creditMonths: 1, storeSubscribed: true });
    const text = allText(await render());
    expect(text).toContain("Mağaza aboneliğin sürerken ücretsiz ay bekler");
    expect(text).not.toContain("Ücretsiz ayı başlat");
  });

  it("başlatma reddedilirse hata metni gösterilir", async () => {
    mockOverview.current = overview({ creditMonths: 1 });
    mockClaim.mockRejectedValue({ details: { reason: "store-subscription-active" } });
    const tree = await render();
    await pressByText(tree, "Ücretsiz ayı başlat");
    expect(mockToast.error).toHaveBeenCalledWith("Aboneliğin sürerken bu kod kullanılamaz.");
  });

  it("davetle gelen kullanıcı indirim bandını görür; indirim kullanıldıysa 'kullandın'", async () => {
    mockOverview.current = overview({
      invitedBy: { name: "Can", discount: { percent: 30, offerId: "referral-30-1m" } },
    });
    let text = allText(await render());
    expect(text).toContain("Can seni davet etti");
    expect(text).toContain("%30 indirim");

    mockOverview.current = overview({ invitedBy: { name: "Can", discount: null } });
    text = allText(await render());
    expect(text).toContain("Davet indirimini kullandın");
  });
});

describe("Kod gir sayfası", () => {
  const openSheet = async () => {
    const tree = await render();
    await pressByText(tree, "Kodun var mı?");
    return tree;
  };
  const type = async (tree, value) => {
    const input = tree.root.findByType("TextInput");
    await act(async () => {
      input.props.onChangeText(value);
    });
  };

  it("promosyon kodu: servise gider, başarı toast'ı ve yenileme", async () => {
    mockRedeem.mockResolvedValue({ kind: "promo", days: 30, untilMs: Date.UTC(2026, 10, 19) });
    const tree = await openSheet();
    await type(tree, "free-mnth");
    expect(tree.root.findByType("TextInput").props.value).toBe("FREE-MNTH");
    await pressByText(tree, "Kodu kullan");
    expect(mockRedeem).toHaveBeenCalledWith("FREE-MNTH");
    expect(mockToast.success.mock.calls[0][0]).toContain("30 gün ücretsiz Premium açıldı");
    expect(mockReload).toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith("code_redeem", { outcome: "promo" });
  });

  it("davet kodu: indirim cümlesi gösterilir", async () => {
    mockRedeem.mockResolvedValue({ kind: "referral", inviterName: "Can", discount: { percent: 30 } });
    const tree = await openSheet();
    await type(tree, "ABCD-EFGH");
    await pressByText(tree, "Kodu kullan");
    expect(mockToast.success.mock.calls[0][0]).toContain("Can adlı kişinin davetini kabul ettin");
    expect(mockToast.success.mock.calls[0][0]).toContain("%30");
  });

  it("reddedilen kod satır içi hata gösterir ve sayfa açık kalır", async () => {
    mockRedeem.mockRejectedValue({ details: { reason: "code-exhausted" } });
    const tree = await openSheet();
    await type(tree, "ABCD-EFGH");
    await pressByText(tree, "Kodu kullan");
    expect(allText(tree)).toContain("Bu kodun kullanım hakkı doldu.");
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith("code_redeem", { outcome: "code-exhausted" });
    // Yeni karakter yazınca hata kalkar.
    await type(tree, "ABCD-EFGJ");
    expect(allText(tree)).not.toContain("Bu kodun kullanım hakkı doldu.");
  });

  it("çok kısa kodla düğme pasif; servis çağrılmaz", async () => {
    const tree = await openSheet();
    await type(tree, "AB");
    await pressByText(tree, "Kodu kullan");
    expect(mockRedeem).not.toHaveBeenCalled();
  });

  it("ağ hatası genel mesaja düşer", async () => {
    mockRedeem.mockRejectedValue(new Error("Network request failed"));
    const tree = await openSheet();
    await type(tree, "ABCD-EFGH");
    await pressByText(tree, "Kodu kullan");
    expect(allText(tree)).toContain("İşlem tamamlanamadı");
  });
});
