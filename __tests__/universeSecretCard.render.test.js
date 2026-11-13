// Gizli evrenler — detay kartı + kapı sorusu sayfası (13 Kas).
//   • evren kilitli + yapım izlenmemiş → kart YOK (evrenin varlığı sızmaz)
//   • evren kilitli + yapım izlendi    → sahnesiz "?" kart; dokununca soru sayfası
//   • yanlış cevap → uyarı, evren açılmaz; doğru cevap → solve + keşif toast'u
//   • evren açık → sahne önizlemesi ("Atmosfere ekle")
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const anim = { start: (cb) => cb?.() };
  class Value {
    constructor(v) {
      this.v = v;
    }
    setValue(v) {
      this.v = v;
    }
  }
  return {
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
    Platform: { OS: "ios" },
    Animated: { Value, View: "AnimatedView", timing: () => anim, sequence: () => anim },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "Touchable" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassCloseButton" }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? require("react").createElement("Sheet", null, children) : null),
}));
jest.mock("../components/decor/WeatherLayer", () => ({ __esModule: true, default: "WeatherLayer" }));
jest.mock("../components/settings/AtmosphereControls", () => ({ effectLabel: (id) => `<${id}>` }));
const mockToast = jest.fn();
jest.mock("../components/AppToast", () => ({ showToast: (...a) => mockToast(...a) }));
jest.mock("../context/AppSettingsContext", () => ({
  useSnowSettings: () => ({ showSnow: true, snowAllowed: true, changeShowSnow: jest.fn() }),
}));
jest.mock("../hooks/useWeatherSettings", () => ({ __esModule: true, default: () => ({ choice: "snow", changeChoice: jest.fn() }) }));
jest.mock("../hooks/usePremiumGate", () => ({ usePremiumGate: () => ({ showUpsell: jest.fn() }) }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../hooks/useScreenFocused", () => ({ __esModule: true, default: () => true }));
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));
jest.mock("../utils/afterInteractions", () => ({ runAfterInteractions: (fn) => (fn(), { cancel() {} }) }));
jest.mock("../services/hapticsService", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: { Success: "s", Error: "e" },
}));
let mockSolved = new Set();
const mockSolve = jest.fn((id) => mockSolved.add(id));
jest.mock("../hooks/useUniverseUnlocks", () => ({
  __esModule: true,
  default: () => ({
    isUnlocked: (id) => mockSolved.has(id),
    isSolved: (id) => mockSolved.has(id),
    unlocked: mockSolved,
    today: new Set(),
    solve: (id) => mockSolve(id),
  }),
}));
let mockStatus = {};
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => mockStatus }));

const UniversePreviewCard = require("../components/decor/UniversePreviewCard").default;
const { riddleQuestion } = require("../utils/universeRiddles");
const { i18nText } = require("../utils/i18nText");

const theme = {
  primary: "#000",
  secondary: "#111",
  border: "#333",
  accent: "#6C63FF",
  text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
};
const DARK_TV = 70523;

function render() {
  let r;
  act(() => {
    r = create(<UniversePreviewCard titleType="tv" titleId={DARK_TV} theme={theme} />);
  });
  return r;
}
const texts = (r) => r.root.findAllByType("Text").map((t) => [].concat(t.props.children).join(""));

beforeEach(() => {
  mockSolved = new Set();
  mockStatus = {};
  mockSolve.mockClear();
  mockToast.mockClear();
});

test("izlenmemiş yapımda kart hiç çizilmez", () => {
  const r = render();
  expect(r.toJSON()).toBeNull();
});

test("izlendi: sahnesiz gizli kart, soru sayfası; yanlış cevap açmaz, doğru cevap açar", () => {
  mockStatus = { watchedTvMap: { [DARK_TV]: {} } };
  const r = render();
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(0);
  expect(texts(r)).toContain("?");
  expect(r.root.findAllByType("Sheet")).toHaveLength(0);

  act(() => r.root.findByType("Touchable").props.onPress());
  expect(r.root.findAllByType("Sheet")).toHaveLength(1);
  expect(texts(r)).toContain(riddleQuestion("dark"));

  const input = () => r.root.findByType("TextInput");
  act(() => input().props.onChangeText("Hawkins"));
  act(() => input().props.onSubmitEditing());
  expect(mockSolve).not.toHaveBeenCalled();
  expect(texts(r)).toContain(i18nText("autoI18n.evren_cevap_yanlis", "Olmadı. Kapı hâlâ kapalı."));

  act(() => input().props.onChangeText("  winden "));
  act(() => input().props.onSubmitEditing());
  expect(mockSolve).toHaveBeenCalledWith("dark");
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", title: expect.stringContaining("<dark>") }));
  expect(r.root.findAllByType("Sheet")).toHaveLength(0);
});

test("açılmış evren: izlenmese de sahne önizlemesi görünür", () => {
  mockSolved = new Set(["dark"]);
  const r = render();
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(1);
  expect(texts(r)).not.toContain("?");
});
