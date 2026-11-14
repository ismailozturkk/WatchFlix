// Gizli evrenler — detay posterindeki easter egg (13 Kas; eski telefon kartının yerine).
//   • evren kilitli + yapım izlenmemiş → işaret YOK, poster olduğu gibi (evrenin varlığı sızmaz)
//   • evren kilitli + yapım izlendi    → köşede işaret; basınca poster döner, arkada "?" kapı
//   • kapıya dokun → soru; yanlış cevap açmaz, doğru cevap → solve + keşif toast'u
//   • evren açık → arkada poster boyutunda sahne; dokunuş durdur/oynat, çip atmosfere ekler,
//     çevir işareti postere döndürür
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const anim = (value, cfg) => ({
    start: (cb) => {
      if (value && cfg && typeof cfg.toValue === "number") value.setValue(cfg.toValue);
      cb?.({ finished: true });
    },
    stop: () => {},
  });
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
  return {
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    Pressable: "Pressable",
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
    Platform: { OS: "ios" },
    Easing: { inOut: () => 0, out: () => 0, in: () => 0, cubic: 0, quad: 0 },
    Animated: {
      Value,
      View: "AnimatedView",
      timing: anim,
      sequence: () => anim(),
      loop: () => ({ start: () => {}, stop: () => {} }),
      delay: () => anim(),
    },
  };
});
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "Touchable" }));
jest.mock("../components/common/GlassPressable", () => ({ __esModule: true, default: "Pressable" }));
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
  useSnowSettings: () => ({
    showSnow: mockAtmo.showSnow,
    snowAllowed: true,
    changeShowSnow: (v) => {
      mockAtmo.showSnow = v;
    },
  }),
}));
jest.mock("../hooks/useWeatherSettings", () => ({
  __esModule: true,
  default: () => ({
    choice: mockAtmo.choice,
    changeChoice: (v) => {
      mockAtmo.choice = v;
    },
  }),
}));
// Atmosfer ayarı (seçili evren + açık mı) — taklit kancalar bunu okuyup yazar.
const mockAtmo = { choice: "snow", showSnow: true };
jest.mock("../hooks/usePremiumGate", () => ({ usePremiumGate: () => ({ showUpsell: jest.fn() }) }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../hooks/useScreenFocused", () => ({ __esModule: true, default: () => true }));
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));
jest.mock("../utils/afterInteractions", () => ({ runAfterInteractions: (fn) => (fn(), { cancel() {} }) }));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({
  haptic: (...a) => mockHaptic(...a),
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

const UniversePosterFlip = require("../components/decor/UniversePosterFlip").default;
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
const label = (key, fb) => i18nText(`autoI18n.${key}`, fb);

function render() {
  let r;
  act(() => {
    r = create(
      <UniversePosterFlip titleType="tv" titleId={DARK_TV} theme={theme} width={110} height={165} radius={14}>
        <Poster />
      </UniversePosterFlip>,
    );
  });
  return r;
}
function Poster() {
  return null;
}
const texts = (r) => r.root.findAllByType("Text").map((t) => [].concat(t.props.children).join(""));
const pressable = (r, name) => r.root.find((n) => n.type === "Pressable" && n.props.accessibilityLabel?.startsWith(name));

beforeEach(() => {
  mockAtmo.choice = "snow";
  mockAtmo.showSnow = true;
  mockSolved = new Set();
  mockStatus = {};
  mockSolve.mockClear();
  mockToast.mockClear();
  mockHaptic.mockClear();
});

test("izlenmemiş yapımda işaret yok, poster olduğu gibi", () => {
  const r = render();
  expect(r.root.findAllByType(Poster)).toHaveLength(1);
  expect(r.root.findAllByType("Pressable")).toHaveLength(0);
  expect(r.root.findAllByType("AnimatedView")).toHaveLength(0);
});

test("izlendi: işaret → poster döner → kapı → yanlış cevap açmaz, doğru cevap açar → sahne", () => {
  mockStatus = { watchedTvMap: { [DARK_TV]: {} } };
  const r = render();
  expect(texts(r)).not.toContain("?");

  act(() => pressable(r, label("evren_gizli_baslik", "Gizli bir evren buldun")).props.onPress());
  expect(mockHaptic).toHaveBeenCalledWith("tap");
  expect(texts(r)).toContain("?");
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(0);
  expect(r.root.findAllByType("Sheet")).toHaveLength(0);

  const gate = r.root.find(
    (n) => n.type === "Pressable" && n.props.accessibilityLabel?.includes(label("evren_poster_kapi", "Kapıyı açmak için dokun")),
  );
  act(() => gate.props.onPress());
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

  // Çözülünce arka yüz kendiliğinden sahneye döner.
  act(() => r.update(
    <UniversePosterFlip titleType="tv" titleId={DARK_TV} theme={theme} width={110} height={165} radius={14}>
      <Poster />
    </UniversePosterFlip>,
  ));
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(1);
  expect(texts(r)).not.toContain("?");
});

test("açık evren: sahneye dokunmak arka planda etkinleştirir / kaldırır; çevir işareti aynı köşede", () => {
  mockSolved = new Set(["dark"]);
  const r = render();
  const rerender = () =>
    act(() =>
      r.update(
        <UniversePosterFlip titleType="tv" titleId={DARK_TV} theme={theme} width={110} height={165} radius={14}>
          <Poster />
        </UniversePosterFlip>,
      ),
    );
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(0);

  act(() => pressable(r, label("evren_poster_arkasi", "Posterin arkasına bak")).props.onPress());
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(1);
  expect(texts(r)).toContain("<dark>");
  expect(texts(r)).toContain(label("evren_atmosfere_ekle", "Atmosfere ekle"));

  const scene = () => r.root.find((n) => n.type === "Pressable" && n.props.accessibilityRole === "switch");
  expect(scene().props.accessibilityState).toEqual({ checked: false });
  act(() => scene().props.onPress());
  expect(mockAtmo).toEqual({ choice: "dark", showSnow: true });
  expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "success" }));
  rerender();
  expect(scene().props.accessibilityState).toEqual({ checked: true });
  expect(texts(r)).toContain(label("evren_atmosferde", "Atmosferinde"));

  // Kaldırınca önceki atmosfere (kar) döner.
  act(() => scene().props.onPress());
  expect(mockAtmo).toEqual({ choice: "snow", showSnow: true });
  expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: expect.stringContaining("<dark>") }));
  rerender();
  expect(scene().props.accessibilityState).toEqual({ checked: false });

  // Ön ve arka çevir işaretleri aynı köşede.
  const { flipBack } = require("../components/decor/UniversePosterFlip").__styles;
  expect(flipBack).toEqual(expect.objectContaining({ right: 4, bottom: 4 }));

  act(() => pressable(r, label("evren_poster_cevir", "Postere dön")).props.onPress());
  expect(r.root.findAllByType("WeatherLayer")).toHaveLength(0);
});

test("başka yerden seçilmiş evren kaldırılınca atmosfer kapanır", () => {
  mockSolved = new Set(["dark"]);
  mockAtmo.choice = "dark";
  const r = render();
  act(() => pressable(r, label("evren_poster_arkasi", "Posterin arkasına bak")).props.onPress());
  const scene = r.root.find((n) => n.type === "Pressable" && n.props.accessibilityRole === "switch");
  act(() => scene.props.onPress());
  expect(mockAtmo).toEqual({ choice: "dark", showSnow: false });
});
