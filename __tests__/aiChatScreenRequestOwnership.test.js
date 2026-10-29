import React from "react";
import { act, create } from "react-test-renderer";
import AIChatScreen from "../screens/chat/AIChatScreen";

// screens/chat/AIChatScreen.js — bekleyen AI isteği SOHBETİNE bağlıdır:
//   • cevap beklerken yeni sohbete/başka sohbete geçilirse geç gelen cevap
//     ekrandaki sohbeti ezmez, yalnız kendi kaydına yazılır;
//   • cevap beklerken silinen sohbet geç gelen cevapla geri yaratılmaz;
//   • aynı sohbette çift gönderim tek istek üretir;
//   • cevap beklerken açılan detay sorusu (initialPrompt) yeni sohbette gider.
// Proje jest'i RN çalıştırmaz (jest.config.js): ekranın import'ları taklit edilir,
// saf mantık modülleri (aiCineInsights, aiPrefs, aiCopy, aiCineService) gerçektir.

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  class Value {
    interpolate() {
      return this;
    }
    setValue() {}
  }
  return {
    View: host("View"),
    Text: host("Text"),
    TextInput: host("TextInput"),
    TouchableOpacity: host("TouchableOpacity"),
    ActivityIndicator: host("ActivityIndicator"),
    ScrollView: React.forwardRef(({ children, ...rest }, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToEnd() {}, scrollTo() {} }));
      return React.createElement("ScrollView", rest, children);
    }),
    Modal: ({ visible, children }) => (visible ? React.createElement("Modal", null, children) : null),
    Animated: { View: host("AnimatedView"), Value, timing: () => ({ start() {} }) },
    StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
    Platform: { OS: "ios", select: (o) => o.ios ?? o.default },
    Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/MaterialIcons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("lottie-react-native", () => ({ __esModule: true, default: "Lottie" }));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return { __esModule: true, default: { View: ({ children, ...rest }) => React.createElement("ReanimatedView", rest, children) } };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

// ── Bağlamlar ve hook'lar ──
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ t: {}, language: "tr" }) }));
jest.mock("../context/ThemeContext", () => {
  const theme = {
    primary: "#111",
    secondary: "#222",
    border: "#333",
    bold: "#fff",
    accent: "#0af",
    text: { primary: "#fff", secondary: "#ccc", between: "#bbb", muted: "#999" },
  };
  return { useTheme: () => ({ theme }) };
});
jest.mock("../context/AppSettingsContext", () => ({
  STREAMING_PROVIDERS: [],
  useAppSettings: () => ({ API_KEY: "tmdb", adultContent: false }),
  useImageQualitySettings: () => ({ getTmdbUrl: () => "" }),
}));
jest.mock("../context/ProfileStatsContext", () => ({ useProfileStats: () => ({}) }));
jest.mock("../context/ListStatusContext", () => {
  const value = { combinedLists: {} };
  return { useListStatusContext: () => value };
});
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ profile: null }) }));
jest.mock("../context/PremiumContext", () => ({ usePremium: () => ({ plan: "free" }) }));
jest.mock("../utils/fourFavorites", () => ({ buildFavoritesPrompt: () => "", readProfileFavorites: () => [] }));
jest.mock("../utils/premiumFeatures", () => ({ buildLimitCopy: () => null }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
jest.mock("../services/liquidGlass", () => ({ useLiquidGlass: () => false }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../hooks/useModalKeyboardLift", () => ({ __esModule: true, default: () => ({}) }));
jest.mock("../hooks/useAiQuota", () => ({ __esModule: true, default: () => null }));
jest.mock("../hooks/useAiPrefs", () => {
  const { DEFAULT_AI_PREFS } = jest.requireActual("../utils/aiPrefs");
  const value = { prefs: DEFAULT_AI_PREFS, updatePrefs: () => {} };
  return { __esModule: true, default: () => value };
});
jest.mock("../hooks/useAiConversations", () => {
  const store = {
    conversations: [],
    ready: true,
    hydrating: false,
    waiting: false,
    save: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
    refresh: jest.fn(async () => {}),
  };
  return { __esModule: true, default: () => store, mockStore: store };
});

// ── Ağ: AI isteği elle çözülür ──
jest.mock("../services/aiCineService", () => {
  const actual = jest.requireActual("../services/aiCineService");
  return { ...actual, askCineStructured: jest.fn() };
});
jest.mock("../services/tmdbLookup", () => ({ resolveCards: jest.fn(async () => []) }));

// ── Alt bileşenler: prop'larını taşıyan düz düğümler ──
jest.mock("../components/AICineCards", () => ({ __esModule: true, default: "ChatBubble" }));
jest.mock("../components/chat/ShareToChatSheet", () => ({ __esModule: true, default: "ShareToChatSheet" }));
jest.mock("../components/ai/AIThinking", () => ({ __esModule: true, default: "AIThinking" }));
jest.mock("../components/ai/AIWelcome", () => ({ __esModule: true, default: "AIWelcome" }));
jest.mock("../components/ai/AIHistory", () => ({ __esModule: true, default: "AIHistory" }));
jest.mock("../components/ai/AIQuotaMeter", () => ({ __esModule: true, default: "AIQuotaMeter" }));
jest.mock("../components/ai/AIPrefsPanel", () => ({ __esModule: true, default: "AIPrefsPanel", genreLabel: (g) => g?.key }));
jest.mock("../components/common/GlassIconButton", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...rest }) => React.createElement("GlassIconButton", rest, children) };
});
jest.mock("../components/AppAlert", () => ({ appAlert: jest.fn() }));
jest.mock("../components/toast/ModalToastHost", () => ({ __esModule: true, default: "ModalToastHost" }));
jest.mock("../components/chat/ComposerBlur", () => ({
  __esModule: true,
  default: "ComposerBlur",
  COMPOSER_GLASS_PILL_STYLE: {},
  ComposerBlurTarget: ({ children }) => children,
  useComposerBlurTarget: () => ({ attach: null, target: null }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { askCineStructured } = require("../services/aiCineService");
const { mockStore } = require("../hooks/useAiConversations");

/** askCineStructured'ın her çağrısı için elle çözülen bir söz. */
function deferredAsks() {
  const pending = [];
  askCineStructured.mockImplementation(
    (args) =>
      new Promise((resolve, reject) => {
        pending.push({ args, resolve, reject });
      }),
  );
  return pending;
}

const answer = (title) => ({ type: "recommendations", items: [{ title, mediaType: "movie", reason: "uyar" }] });

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

let renderer;
async function mount(props = {}) {
  await act(async () => {
    renderer = create(<AIChatScreen visible onClose={() => {}} {...props} />);
  });
  await flush();
  return renderer;
}

const root = () => renderer.root;
const bubbles = () => root().findAll((n) => n.type === "ChatBubble").map((n) => n.props.msg);
const thinking = () => root().findAll((n) => n.type === "AIThinking").length > 0;
const iconButton = (label) => root().find((n) => n.type === "GlassIconButton" && n.props.accessibilityLabel === label);

async function send(text) {
  const input = root().find((n) => n.type === "TextInput");
  await act(async () => input.props.onChangeText(text));
  const fresh = root().find((n) => n.type === "TextInput");
  await act(async () => fresh.props.onSubmitEditing());
}

/** save() çağrılarını sohbet kimliğine göre son hâl olarak döner. */
const savedById = () => {
  const out = {};
  mockStore.save.mock.calls.forEach(([conv]) => {
    out[conv.id] = conv;
  });
  return out;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.conversations = [];
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
});

test("cevap beklerken yeni sohbete geçilirse cevap ekrana değil kendi kaydına yazılır", async () => {
  const asks = deferredAsks();
  await mount();
  await send("bilim kurgu öner");
  expect(asks).toHaveLength(1);
  expect(thinking()).toBe(true);

  await act(async () => iconButton("Yeni Sohbet").props.onPress());
  expect(bubbles()).toHaveLength(0);
  expect(thinking()).toBe(false); // bekleme yeni sohbete taşınmaz

  await act(async () => asks[0].resolve(answer("Arrival")));
  await flush();

  expect(bubbles()).toHaveLength(0); // ekrandaki yeni sohbet ezilmedi
  const saved = Object.values(savedById());
  expect(saved).toHaveLength(1);
  expect(saved[0].messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(saved[0].messages[1].aiResponse.items[0].title).toBe("Arrival");
});

test("başka sohbete geçince o sohbetin kaydı geç gelen cevapla ezilmez", async () => {
  const asks = deferredAsks();
  const other = {
    id: "eski-sohbet",
    title: "Eski",
    messages: [
      { id: "o1", role: "user", text: "eski soru", display: "eski soru" },
      { id: "o2", role: "assistant", text: "eski cevap", aiResponse: answer("Heat"), posterMap: {} },
    ],
  };
  mockStore.conversations = [other];
  await mount();
  await send("komedi öner");

  await act(async () => iconButton("Geçmiş").props.onPress());
  const history = root().find((n) => n.type === "AIHistory");
  await act(async () => history.props.onOpen(other));
  expect(bubbles().map((m) => m.id)).toEqual(["o1", "o2"]);

  await act(async () => asks[0].resolve(answer("Superbad")));
  await flush();

  expect(bubbles().map((m) => m.id)).toEqual(["o1", "o2"]); // görünen sohbet aynı
  const saved = savedById();
  expect(saved["eski-sohbet"]).toBeUndefined();
  const [pendingConv] = Object.values(saved);
  expect(pendingConv.messages[1].aiResponse.items[0].title).toBe("Superbad");

  // Eski sohbette yazılan yeni mesaj eski sohbetin geçmişiyle gider ve onun kaydına yazılır.
  await send("devam et");
  expect(asks[1].args.history.map((h) => h.text)).toEqual(["eski soru", "recommendations: Heat"]);
  await act(async () => asks[1].resolve(answer("Ronin")));
  await flush();
  const after = savedById();
  expect(after["eski-sohbet"].messages.map((m) => m.id).slice(0, 2)).toEqual(["o1", "o2"]);
  expect(after["eski-sohbet"].messages[3].aiResponse.items[0].title).toBe("Ronin");
  expect(after[pendingConv.id].messages).toHaveLength(2); // bekleyen sohbet karışmadı
});

test("cevap beklerken silinen sohbet geç gelen cevapla geri yaratılmaz", async () => {
  const asks = deferredAsks();
  await mount();
  await send("gerilim öner");
  await act(async () => iconButton("Geçmiş").props.onPress());
  const history = root().find((n) => n.type === "AIHistory");
  const pendingId = history.props.activeId;
  expect(pendingId).toBeTruthy();

  await act(async () => history.props.onDelete(pendingId));
  await act(async () => asks[0].resolve(answer("Se7en")));
  await flush();

  expect(mockStore.remove).toHaveBeenCalledWith(pendingId);
  expect(savedById()[pendingId]).toBeUndefined();
});

test("tümünü sil: bekleyen sohbet de geri gelmez", async () => {
  const asks = deferredAsks();
  await mount();
  await send("dizi öner");
  await act(async () => iconButton("Geçmiş").props.onPress());
  await act(async () => root().find((n) => n.type === "AIHistory").props.onClearAll());
  await act(async () => asks[0].resolve(answer("Dark")));
  await flush();
  expect(mockStore.save).not.toHaveBeenCalled();
});

test("aynı sohbette çift gönderim tek istek üretir; cevap gelince ekranda görünür", async () => {
  const asks = deferredAsks();
  await mount();
  const input = root().find((n) => n.type === "TextInput");
  await act(async () => input.props.onChangeText("drama öner"));
  const fresh = root().find((n) => n.type === "TextInput");
  await act(async () => {
    fresh.props.onSubmitEditing();
    fresh.props.onSubmitEditing();
  });
  expect(asks).toHaveLength(1);

  await act(async () => asks[0].resolve(answer("Aftersun")));
  await flush();
  expect(bubbles().map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(thinking()).toBe(false);
});

test("hata cevabı da kendi sohbetine yazılır, ekrandaki sohbet temiz kalır", async () => {
  const asks = deferredAsks();
  await mount();
  await send("animasyon öner");
  await act(async () => iconButton("Yeni Sohbet").props.onPress());
  await act(async () => asks[0].reject(Object.assign(new Error("x"), { code: "NETWORK" })));
  await flush();
  expect(bubbles()).toHaveLength(0);
  const [saved] = Object.values(savedById());
  expect(saved.messages[1].status).toBe("error");
});

test("poster/süzgeç adımı patlasa da cevap gösterilir (hak boşa gitmez)", async () => {
  const { resolveCards } = require("../services/tmdbLookup");
  resolveCards.mockImplementationOnce(async () => {
    throw new Error("TMDB çöktü");
  });
  const asks = deferredAsks();
  await mount();
  await send("western öner");
  await act(async () => asks[0].resolve(answer("Unforgiven")));
  await flush();
  const [, ai] = bubbles();
  expect(ai.status).toBeUndefined();
  expect(ai.aiResponse.items[0].title).toBe("Unforgiven");
});

test("başka sohbet cevap beklerken açılan detay sorusu yeni sohbette gönderilir", async () => {
  const asks = deferredAsks();
  await mount();
  await send("korku öner");
  expect(asks).toHaveLength(1);

  jest.useFakeTimers();
  try {
    await act(async () => {
      renderer.update(<AIChatScreen visible onClose={() => {}} initialPrompt="Arrival hakkında bilgi ver" initialDisplay="Arrival" />);
    });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
  } finally {
    jest.useRealTimers();
  }
  expect(asks).toHaveLength(2);
  expect(asks[1].args.userMessage).toBe("Arrival hakkında bilgi ver");
  expect(asks[1].args.history).toEqual([]);
});
