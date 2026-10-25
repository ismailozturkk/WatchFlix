// Sohbette paylaşılan görünüm ayarları: MessageBubble yönlendirmesi, balon gövdesi
// (gelen/giden), uygulama sayfasının varsayılan seçimi (Zaten aynı / Premium), seç →
// uygula (sayfa KAPANDIKTAN sonra) → Geri Al akışı ve kilitli satırın yükseltmeye gitmesi.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    Pressable: passthrough("Pressable"),
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
    Platform: { OS: "ios" },
    UIManager: {},
    ScrollView: passthrough("ScrollView"),
    useWindowDimensions: () => mockWindow,
  };
});
let mockWindow = { width: 390, height: 844 };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), fallback),
}));

const mockTheme = {
  primary: "#111111",
  secondary: "#1b1b1b",
  between: "#222222",
  border: "#333333",
  tab: "#151515",
  accent: "#3388ff",
  bold: "#2266dd",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
  colors: { red: "#ff3333", blue: "#3388ff", purple: "#aa55ff", green: "#22cc66", orange: "#ff8800" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ t: {}, language: "tr" }) }));

// Sayfa kabuğu: görünürlük + kapanış sonrası (onDismissed) elle tetiklenir.
let mockDismissed = null;
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children, onDismissed }) => {
    mockDismissed = onDismissed;
    return visible ? children : null;
  },
}));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("../components/common/GlassPressable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, ...rest }) => React.createElement("Button", rest, children),
  };
});
jest.mock("../components/premium/PremiumPill", () => ({ __esModule: true, default: "PremiumPill" }));
jest.mock("../screens/tabs/settings/settingsUi", () => ({
  buildUiColors: (theme) => ({
    bg: theme.primary,
    card: theme.secondary,
    border: theme.border,
    borderMuted: theme.border,
    text: theme.text.primary,
    muted: theme.text.muted,
    accent: theme.accent,
    accentDim: "rgba(51,136,255,0.16)",
    handle: "#666666",
    closeBg: "#333333",
  }),
  // Ayar alt sayfası iskeleti: başlık + çocuklar (geri düğmesi/dekor sınanmıyor).
  SettingsSubScreen: ({ title, children }) => {
    const React = require("react");
    return React.createElement("SubScreen", { title }, children);
  },
  SectionLabel: ({ children }) => {
    const React = require("react");
    return React.createElement("Text", null, children);
  },
  ui: { card: {} },
}));
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...rest }) => React.createElement("GlassBox", rest, children) };
});

let mockPlan = "free";
jest.mock("../context/PremiumContext", () => ({ usePremium: () => ({ plan: mockPlan }) }));
jest.mock("../context/TypographyContext", () => ({ ensureCatalogFontsLoaded: jest.fn() }));
const mockUpsell = jest.fn();
jest.mock("../services/premiumUpsell", () => ({ showPremiumLimitAlert: (...args) => mockUpsell(...args) }));
const mockToast = { undo: jest.fn(), success: jest.fn(), error: jest.fn() };
jest.mock("../components/AppToast", () => ({ toast: mockToast }));

// Alıcının cihazı: afiş ayarları gelenle AYNI, liste sütunu farklı.
const mockUndo = jest.fn();
const mockApply = jest.fn((sections) => ({ applied: Object.keys(sections), failed: [], undo: mockUndo }));
const mockCurrent = { listsPosterRadius: 20, railPosterSize: "small", listsGridColumns: 3 };
jest.mock("../hooks/useSettingsShare", () => ({
  __esModule: true,
  default: () => ({
    read: (key) => {
      const { Keys } = jest.requireActual("../services/storage/registry");
      return key in mockCurrent ? mockCurrent[key] : Keys[key].default;
    },
    customThemes: [],
    apply: mockApply,
    buildMine: (...args) => mockBuildMine(...args),
  }),
}));
const mockBuildMine = jest.fn();
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ profile: { displayName: "Ada" } }) }));
jest.mock("../components/chat/ShareToChatSheet", () => ({ __esModule: true, default: "ShareToChat" }));

// MessageBubble'ın ağır komşuları.
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("@services/groupsService", () => ({ memberColor: () => "#44aa88" }));
jest.mock("../components/chat/BounceIn", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("../components/chat/SwipeReplyContainer", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("../components/chat/MessageReplyPreview", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/chat/SharedChallengeMessage", () => ({ __esModule: true, default: "ChallengeBody" }));
jest.mock("../components/chat/SharedDuelResultMessage", () => ({ __esModule: true, default: "DuelResultBody" }));

const MessageBubble = require("../components/chat/MessageBubble").default;
const ShareSettingsScreen = require("../screens/tabs/settings/ShareSettingsScreen").default;
const { buildShareMessage } = require("../utils/chatShare");
const { buildSettingsShare, SETTINGS_SHARE_KEYS } = require("../utils/settingsShare");
const { Keys } = require("../services/storage/registry");

const DEFAULTS = Object.fromEntries(SETTINGS_SHARE_KEYS.map((key) => [key, Keys[key].default]));
const SHARE = buildSettingsShare({
  read: (key) =>
    ({
      ...DEFAULTS,
      theme: "custom:ct_ocean",
      fontRoles: { heading: "oswald", body: "system", numeric: "system" },
      listsPosterRadius: 20,
      railPosterSize: "small",
      listsGridColumns: 4,
    })[key],
  customThemes: [{ id: "ct_ocean", name: "Okyanus", tokens: { primary: "#0B1320", accent: "#3AA0FF" } }],
  sections: ["theme", "fonts", "posters", "lists"],
  owner: "Ada",
});

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
const texts = (root) => root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));
const byTestId = (root, id) => root.findAll((node) => node.props.testID === id && node.type === "Button")[0];
const press = (node) => act(() => node.props.onPress());

const bubble = (senderId) =>
  render(
    <MessageBubble
      item={{ id: "m1", senderId, timestamp: null, ...buildShareMessage(SHARE) }}
      currentUser={{ uid: "me" }}
      theme={mockTheme}
      navigation={{ push: jest.fn() }}
      getTmdbUrl={(path) => path}
      onLongPress={() => {}}
      renderMessageText={(text) => text}
      onReply={() => {}}
      entrance={null}
    />,
  ).root;

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = "free";
});

test("gelen balon: tema önizlemesi, font satırı, çipler ve İncele ve uygula", () => {
  const root = bubble("them");
  const all = texts(root);
  expect(all).toContain("GÖRÜNÜM AYARLARI");
  expect(all).toContain("Paylaşan: Ada");
  expect(all).toContain("Okyanus · Orta"); // önizlemenin başlığı
  expect(all).toContain("Başlık Oswald · Yazı Sistem · Rakam Sistem");
  expect(all).toEqual(expect.arrayContaining(["Afiş ve köşeler", "Liste görünümü"]));
  expect(all).not.toContain("Tema"); // temanın kendi önizlemesi var, çip olarak tekrar edilmez
  expect(byTestId(root, "shared-settings-review")).toBeTruthy();
});

test("giden balonda uygulama düğmesi yok, not var", () => {
  const root = bubble("me");
  expect(byTestId(root, "shared-settings-review")).toBeUndefined();
  expect(texts(root)).toContain("Arkadaşın istediklerini seçip uygulayabilir");
});

test("sayfa: kilitli ve zaten aynı bölümler baştan seçilmez; uygulama sayfa kapanınca yapılır, Geri Al çalışır", () => {
  const root = bubble("them");
  press(byTestId(root, "shared-settings-review"));

  const row = (id) => byTestId(root, `settings-share-row-${id}`);
  expect(row("theme").props.accessibilityState).toEqual({ checked: false, disabled: true }); // Free + özel tema
  expect(row("fonts").props.accessibilityState.checked).toBe(true); // Oswald Free'de açık
  expect(row("posters").props.accessibilityState.checked).toBe(false); // zaten aynı
  expect(texts(root)).toContain("Zaten aynı");
  expect(row("lists").props.accessibilityState.checked).toBe(true);
  expect(texts(root)).toContain("Seçilenleri uygula (2)");

  press(row("fonts")); // seçimi kaldır
  expect(texts(root)).toContain("Seçilenleri uygula (1)");

  press(byTestId(root, "settings-share-apply"));
  // Sayfa kapandı ama henüz YAZILMADI: tema değişimi kapanan Modal'ın içinde olmasın.
  expect(byTestId(root, "settings-share-apply")).toBeUndefined();
  expect(mockApply).not.toHaveBeenCalled();
  act(() => mockDismissed());
  expect(mockApply).toHaveBeenCalledWith({ lists: SHARE.sections.lists });

  const [title, onUndo, opts] = mockToast.undo.mock.calls[0];
  expect(title).toBe("1 ayar grubu uygulandı");
  expect(opts).toEqual({ kind: "success" });
  act(() => onUndo());
  expect(mockUndo).toHaveBeenCalled();
  expect(mockToast.success).toHaveBeenCalledWith("Önceki ayarların geri yüklendi");
});

test("kilitli satır yükseltme sayfasını sayfa kapandıktan sonra açar", () => {
  const root = bubble("them");
  press(byTestId(root, "shared-settings-review"));
  press(byTestId(root, "settings-share-row-theme"));
  expect(mockUpsell).not.toHaveBeenCalled();
  act(() => mockDismissed());
  expect(mockUpsell).toHaveBeenCalledWith("custom_themes", "free");
  expect(mockApply).not.toHaveBeenCalled();
});

test("Premium'da tema seçilebilir; hiçbir şey uygulanamazsa hata toast'ı", () => {
  mockPlan = "premium";
  mockApply.mockReturnValueOnce({ applied: [], failed: ["theme"], undo: mockUndo });
  const root = bubble("them");
  press(byTestId(root, "shared-settings-review"));
  const theme = byTestId(root, "settings-share-row-theme");
  expect(theme.props.accessibilityState).toEqual({ checked: true, disabled: false });
  press(byTestId(root, "settings-share-apply"));
  act(() => mockDismissed());
  expect(mockToast.error).toHaveBeenCalledWith("Ayarlar uygulanamadı");
  expect(mockToast.undo).not.toHaveBeenCalled();
});

test("gönderme alt sayfası: kendi ayarlarından kurar, seçilmeyen bölüm gönderilmez, gönderen adı eklenir", () => {
  mockBuildMine.mockImplementation((sections, owner) => {
    const picked = Object.fromEntries(Object.entries(SHARE.sections).filter(([id]) => sections.includes(id)));
    return { ...SHARE, sections: picked, ...(owner ? { owner } : { owner: undefined }) };
  });
  const root = render(<ShareSettingsScreen />).root;
  expect(root.findByType("SubScreen").props.title).toBe("Görünümünü paylaş");
  expect(mockBuildMine).toHaveBeenCalledWith(["theme", "fonts", "effects", "posters", "lists", "home"]);
  // Gönderende kilit ve "Zaten aynı" yok: hepsi baştan seçili.
  for (const id of ["theme", "fonts", "posters", "lists"]) {
    expect(byTestId(root, `settings-share-row-${id}`).props.accessibilityState).toEqual({ checked: true, disabled: false });
  }
  expect(texts(root)).toContain("Sohbete gönder (4)");

  // Tema çıkarılınca önizleme YERİNDE kalır (sayfa zıplamaz), "gönderilmeyecek" der.
  press(byTestId(root, "settings-share-row-theme"));
  expect(root.findAll((node) => node.type === "GlassBox" && node.props.testID === "settings-share-preview")).toHaveLength(1);
  expect(texts(root)).toContain("Tema gönderilmeyecek");
  press(byTestId(root, "settings-share-row-theme"));

  press(byTestId(root, "settings-share-row-fonts"));
  expect(root.findByType("ShareToChat").props.visible).toBe(false);
  press(byTestId(root, "settings-share-send"));
  const picker = root.findByType("ShareToChat");
  expect(picker.props.visible).toBe(true);
  expect(Object.keys(picker.props.share.sections)).toEqual(["theme", "posters", "lists"]);
  expect(picker.props.share.owner).toBe("Ada");
});

test("gönderme alt sayfası: hiçbir şey seçili değilken gönder pasif; tümünü seç geri getirir", () => {
  mockBuildMine.mockReturnValue(SHARE);
  const root = render(<ShareSettingsScreen />).root;
  const toggleAll = root.findAll((node) => node.type === "Button" && texts(node).includes("Seçimi temizle"))[0];
  press(toggleAll);
  expect(byTestId(root, "settings-share-send").props.disabled).toBe(true);
  expect(texts(root)).toContain("Bir ayar seç");
  press(root.findAll((node) => node.type === "Button" && texts(node).includes("Tümünü seç"))[0]);
  expect(texts(root)).toContain("Sohbete gönder (4)");
});

test("tablette önizleme kartı ve gönder düğmesi 560 dp'de kalır", () => {
  mockWindow = { width: 820, height: 1180 };
  mockBuildMine.mockReturnValue(SHARE);
  const root = render(<ShareSettingsScreen />).root;
  const card = root.findAll((node) => node.type === "GlassBox" && node.props.testID === "settings-share-preview")[0];
  expect([].concat(card.props.style).find((st) => st && st.width).width).toBe(560);
  mockWindow = { width: 390, height: 844 };
});
