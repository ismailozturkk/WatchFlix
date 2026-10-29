// Yüzen bildirim katmanı (components/floatingNotice/*) — davranış.
//
// Gerçek hareket (küçülüp kenara süzülme, simgeden büyüme, sürükleme) cihazda doğrulanır; burada
// kilitlenen AKIŞ:
//   • yeni davet üstte toast kartı olarak açılır; süresi dolunca kart kalkar, kenarda simge kalır
//   • simgeye dokununca kart yeniden açılır; küçült düğmesi / yukarı kaydırma simgeye döndürür
//   • davette kapatma yok: Kabul (oyuna/odaya gider) ya da Reddet kaldırır; hata kartı açık tutar
//   • daha önce toast olmuş davet yeniden toast olmaz (doğrudan simge)
//   • gizli rotada (sohbet, oyun) katman hiçbir şey çizmez ve duyurmaz
//   • turnuva anı: "Tamam" kapatır ve kaydı yazar; "Aç" turnuvaya götürür
//   • bildirime dokunma isteği (push) ilgili kartı açar
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;
// Düğüm ortamında kare yok; sahte zamanlayıcıyla bir "kare" sonra çalışır.
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

let mockInbox;
let mockRoute = "TabScreen";
let mockTournamentVisible = false;
const mockNavigate = jest.fn();
const mockTheme = {
  primary: "#000000",
  secondary: "#15171C",
  border: "#262A31",
  text: { primary: "#F5F6F8", secondary: "#C9CDD4", muted: "#8A8F98" },
};

jest.mock("react-native", () => {
  const React = require("react");
  const resolve = (style, state) => (typeof style === "function" ? style(state) : style);
  return {
    View: "View",
    Text: "Text",
    ActivityIndicator: "Spinner",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: resolve(style, { pressed: false }) }, children),
    StyleSheet: {
      create: (styles) => styles,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const AnimatedView = React.forwardRef(({ children, ...rest }, ref) =>
    React.createElement("AnimatedView", { ...rest, ref }, children),
  );
  const chain = () => {
    const builder = { duration: () => builder };
    return builder;
  };
  const timing = (value, _config, callback) => {
    if (typeof callback === "function") callback(true);
    return value;
  };
  return {
    __esModule: true,
    default: { View: AnimatedView },
    Easing: { linear: "linear", quad: "quad", cubic: "cubic", in: (e) => e, out: (e) => e, inOut: (e) => e, back: () => "back" },
    FadeIn: chain(),
    FadeOut: chain(),
    useAnimatedStyle: (updater) => updater(),
    useSharedValue: (value) => ({ value }),
    withTiming: timing,
    withSpring: (value) => value,
    withDelay: (_delay, value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: jest.fn(),
    runOnJS: (fn) => fn,
  };
});
// Tutamaçlar kayıtlı: test, Pan/Tap geri çağrılarını doğrudan çağırır.
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const builder = (kind) => {
    const g = { kind, handlers: {} };
    ["activeOffsetX", "activeOffsetY", "minDistance", "maxDistance"].forEach((name) => {
      g[name] = () => g;
    });
    ["onBegin", "onUpdate", "onEnd", "onFinalize"].forEach((name) => {
      g[name] = (fn) => {
        g.handlers[name] = fn;
        return g;
      };
    });
    return g;
  };
  return {
    Gesture: { Pan: () => builder("pan"), Tap: () => builder("tap"), Race: (...gestures) => ({ kind: "race", gestures }) },
    GestureDetector: ({ gesture, children }) => React.createElement("Detector", { gesture }, children),
  };
});
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/AppIcon", () => "Icon");
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../context/ScreenInsetsContext", () => ({
  useWindowSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr", t: { someone: "Biri" } }) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/NotificationsContext", () => ({ useNotifications: () => mockInbox }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../hooks/useSectionVisibility", () => ({
  __esModule: true,
  default: () => ({ isVisible: () => mockTournamentVisible }),
}));
jest.mock("../services/storage", () => {
  const React = require("react");
  const store = new Map();
  const listeners = new Set();
  const get = (descriptor) => (store.has(descriptor.key) ? store.get(descriptor.key) : descriptor.default);
  return {
    Keys: { floatingNotices: { key: "notices", default: {} }, floatingNoticeDock: { key: "dock", default: null } },
    get,
    has: (descriptor) => store.has(descriptor.key),
    set: (descriptor, value) => {
      store.set(descriptor.key, value);
      listeners.forEach((listener) => listener());
      return true;
    },
    useStored: (descriptor) =>
      React.useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => get(descriptor),
      ),
    __store: store,
  };
});
jest.mock("../services/rootNavigation", () => ({
  rootNavigationRef: {
    isReady: () => true,
    getCurrentRoute: () => ({ name: mockRoute }),
    addListener: () => () => {},
  },
  navigateRoot: (...args) => mockNavigate(...args),
}));

const storage = require("../services/storage");
const bus = require("../services/floatingNoticeBus");
const { NOTICE_IDLE_MS, NOTICE_TOAST_MS } = require("../utils/floatingNotices");
const { dayKeyOf } = require("../utils/dailyChallenge");
const FloatingNoticeHost = require("../components/floatingNotice/FloatingNoticeHost").default;

// Ekim 2026'nın 10'u: turnuvada Son 16 (duyurulmayan ara tur) — yalnız davetler görünür.
const NOW = new Date(2026, 9, 10, 12, 0, 0).getTime();
const room = { id: "room", type: "cineswipe_invite", inviteCode: "123456", fromUid: "ada", fromName: "Ada", createdAt: NOW - 60_000 };
const duel = () => ({ id: "duel", type: "game_challenge", dayKey: dayKeyOf(Date.now()), fromUid: "can", fromName: "Can", createdAt: NOW - 1_000 });

let tree;
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    realConsoleError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  mockNavigate.mockClear();
  mockRoute = "TabScreen";
  mockTournamentVisible = false;
  storage.__store.clear();
  bus.clearFloatingNoticeFocus();
  mockInbox = { items: [room], loading: false, respond: jest.fn().mockResolvedValue(true) };
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  jest.useRealTimers();
});

const render = () => act(() => {
  tree = create(<FloatingNoticeHost />);
});
const rerender = () => act(() => tree.update(<FloatingNoticeHost />));
const byId = (id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === "string");
const card = () => byId("floating-notice-card")[0] || null;
const bubble = () => byId("floating-notice-bubble")[0] || null;
const press = async (id) => {
  await act(async () => {
    await byId(id)[0].props.onPress();
  });
};
const texts = () => tree.root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const openBubble = () => act(() => bubble().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));

test("yeni davet toast kartı olarak açılır, süresi dolunca kenarda simgeye küçülür", () => {
  render();
  expect(card()).toBeTruthy();
  expect(bubble()).toBeNull();
  expect(texts()).toContain("Ada seni CineSwipe odasına davet etti");
  expect(storage.__store.get("notices").announced["invite:room"]).toBe(NOW);

  advance(NOTICE_TOAST_MS.invite + 10);
  expect(card()).toBeNull();
  expect(bubble()).toBeTruthy();
  expect(bubble().props.accessibilityLabel).toContain("Bekleyen 1 bildirim");
});

test("simgeye dokununca kart yeniden açılır; küçült düğmesi simgeye döndürür; açık kart beklerken küçülür", async () => {
  render();
  advance(NOTICE_TOAST_MS.invite + 10);
  openBubble();
  expect(card()).toBeTruthy();
  expect(bubble()).toBeNull();

  await press("floating-notice-minimize");
  expect(card()).toBeNull();
  expect(bubble()).toBeTruthy();

  openBubble();
  advance(NOTICE_IDLE_MS + 10);
  expect(card()).toBeNull();
  expect(bubble()).toBeTruthy();
});

test("yukarı kaydırmak kartı kapatmaz, simgeye küçültür (davette seçim zorunlu)", () => {
  render();
  const detector = tree.root.findAll((node) => node.type === "Detector")[0];
  act(() => detector.props.gesture.handlers.onEnd({ translationX: 0, translationY: -60, velocityX: 0, velocityY: 0 }));
  expect(card()).toBeNull();
  expect(bubble()).toBeTruthy();
  expect(mockInbox.respond).not.toHaveBeenCalled();
});

test("kabul: yanıt kaydedilir, CineSwipe odasına gidilir, kart kalkar", async () => {
  render();
  await press("floating-notice-accept");
  act(() => jest.runOnlyPendingTimers()); // kaldırma bir kare sonra (çıkış türü önce çizilir)
  expect(mockInbox.respond).toHaveBeenCalledWith("room", "accepted");
  expect(mockNavigate).toHaveBeenCalledWith("CineSwipeScreen", expect.objectContaining({ inviteCode: "123456", autoJoin: true }));
  expect(card()).toBeNull();
  expect(bubble()).toBeNull();
});

test("reddet hatası kartı açık tutar ve hatayı gösterir", async () => {
  mockInbox.respond.mockRejectedValueOnce(new Error("offline"));
  render();
  await press("floating-notice-decline");
  expect(mockInbox.respond).toHaveBeenCalledWith("room", "declined");
  expect(card()).toBeTruthy();
  expect(texts()).toContain("Davet yanıtı kaydedilemedi. Tekrar dene.");
});

test("birden çok davet: en yenisi açılır, sayfalanır; yanıtlanınca sıradaki gösterilir", async () => {
  mockInbox.items = [room, duel()];
  render();
  expect(texts()).toContain("Can seni günlük düelloya davet etti");
  expect(texts().some((text) => text.includes("1/2"))).toBe(true);

  await press("floating-notice-next");
  expect(texts()).toContain("Ada seni CineSwipe odasına davet etti");

  await press("floating-notice-decline");
  expect(mockInbox.respond).toHaveBeenCalledWith("room", "declined");
  expect(card()).toBeTruthy();
  expect(texts()).toContain("Can seni günlük düelloya davet etti");
  expect(texts().some((text) => text.includes("1/2"))).toBe(false);
});

test("daha önce toast olmuş davet yeniden toast olmaz: doğrudan simge", () => {
  storage.set(storage.Keys.floatingNotices, { announced: { "invite:room": NOW - 1000 }, dismissed: {} });
  render();
  expect(card()).toBeNull();
  expect(bubble()).toBeTruthy();
});

test("bildirim kutusu yüklenirken duyurulmaz", () => {
  mockInbox.loading = true;
  render();
  expect(card()).toBeNull();
  expect(storage.__store.get("notices")).toBeUndefined();
});

test("gizli rotada hiçbir şey çizilmez ve duyurulmaz; dönünce toast olur", () => {
  mockRoute = "ChatScreen";
  render();
  expect(card()).toBeNull();
  expect(bubble()).toBeNull();
  expect(bus.floatingNoticesPresenting()).toBe(false);

  mockRoute = "TabScreen";
  // Rota dinleyicisi taklitte çalışmaz: yeni rota yeniden kurulumla okunur.
  act(() => tree.unmount());
  render();
  expect(card()).toBeTruthy();
  expect(bus.floatingNoticesPresenting()).toBe(true);
});

describe("turnuva anı", () => {
  const SELECTION = new Date(2026, 10, 2, 12, 0, 0).getTime(); // Kasım'ın 2'si: aday belirleme

  beforeEach(() => {
    jest.setSystemTime(SELECTION);
    mockTournamentVisible = true;
    mockInbox.items = [];
  });

  test("toast olur, kısa süre sonra simgeye küçülür", () => {
    render();
    expect(texts()).toContain("Yeni turnuva başladı");
    advance(NOTICE_TOAST_MS.event + 10);
    expect(card()).toBeNull();
    expect(bubble()).toBeTruthy();
  });

  test("Tamam kapatır ve kaydı yazar; geri gelmez", async () => {
    render();
    await press("floating-notice-done");
    act(() => jest.runOnlyPendingTimers());
    expect(storage.__store.get("notices").dismissed["event:tournament:2026-11:selection"]).toBe(SELECTION);
    expect(card()).toBeNull();
    expect(bubble()).toBeNull();
    rerender();
    expect(bubble()).toBeNull();
  });

  test("Aç turnuva ekranına götürür", async () => {
    render();
    await press("floating-notice-open");
    expect(mockNavigate).toHaveBeenCalledWith("TournamentScreen", undefined);
  });

  test("Eğlence'de turnuva bölümü gizliyse duyurulmaz", () => {
    mockTournamentVisible = false;
    render();
    expect(card()).toBeNull();
    expect(bubble()).toBeNull();
  });

  test("davet her zaman önce gelir", () => {
    mockInbox.items = [{ ...room, createdAt: SELECTION - 1000 }];
    render();
    expect(texts()).toContain("Ada seni CineSwipe odasına davet etti");
    expect(bubble()).toBeNull();
  });
});

test("bildirime dokunma isteği (push) ilgili davetin kartını açar", () => {
  storage.set(storage.Keys.floatingNotices, { announced: { "invite:room": NOW - 1000 }, dismissed: {} });
  render();
  expect(card()).toBeNull();
  act(() => bus.requestFloatingNoticeFocus("invite:room"));
  expect(card()).toBeTruthy();
  expect(bus.pendingFloatingNoticeFocus()).toBeNull();
});

test("katman kurulmadan gelen istek (soğuk açılış) kurulunca alınır", () => {
  storage.set(storage.Keys.floatingNotices, { announced: { "invite:room": NOW - 1000 }, dismissed: {} });
  bus.requestFloatingNoticeFocus("invite:room");
  render();
  expect(card()).toBeTruthy();
});
