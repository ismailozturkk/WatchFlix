// DeleteProgress (components/profile/EditProfileKit.js): silme sürerken gösterilen
// aşama listesi. Sağlayıcı olmadan, yalnız verilen tema/metinle çizilir.

jest.mock("react-native", () => {
  class Value {
    constructor(v) { this.v = v; }
    interpolate(config) { return { interpolated: config }; }
  }
  return {
    View: "View",
    Text: "Text",
    ActivityIndicator: "ActivityIndicator",
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {} },
    Easing: { out: () => () => 0, cubic: () => 0 },
    Animated: {
      Value,
      View: "AnimatedView",
      timing: (value, config) => ({ start: () => { value.v = config.toValue; } }),
    },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("../components/common/BottomSheetModal", () => ({ __esModule: true, default: "Sheet" }));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "Avatar" }));
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIconButton" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/auth/AuthKit", () => ({
  AuthEyeToggle: "Eye",
  AuthField: "Field",
  AuthPressable: "Pressable",
}));
jest.mock("../components/profile/HoldToConfirmButton", () => ({ __esModule: true, default: "HoldToConfirm" }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));

const React = require("react");
const { create, act } = require("react-test-renderer");
const { DeleteProgress } = require("../components/profile/EditProfileKit");
const { DELETE_ACCOUNT_COPY } = require("../screens/tabs/profile/deleteAccountCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  colors: { red: "#e53935", green: "#2e7d32" },
  between: "#222",
  border: "#333",
  text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
};
const STAGES = ["verify", "local", "social", "profile", "account"];

const render = (stage, stages = STAGES, copy = DELETE_ACCOUNT_COPY.tr) => {
  let renderer;
  act(() => {
    renderer = create(
      React.createElement(DeleteProgress, { theme, progress: { stage, stages }, copy }),
    );
  });
  return renderer;
};
const icons = (r) => r.root.findAllByType("Icon").map((n) => n.props.name);

describe("DeleteProgress", () => {
  it("biten aşamalar tik, süren dönen halka, bekleyenler boş daire", () => {
    const r = render("social");
    expect(icons(r)).toEqual(["checkmark-circle", "checkmark-circle", "ellipse-outline", "ellipse-outline"]);
    expect(r.root.findAllByType("ActivityIndicator")).toHaveLength(1);
  });

  it("her aşamanın etiketi ekranda, ham kimlik değil", () => {
    const r = render("local");
    const texts = r.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    for (const id of STAGES) expect(texts).toContain(DELETE_ACCOUNT_COPY.tr.stages[id]);
    expect(texts).not.toContain("social");
  });

  it("adım metni sıra/toplamı gösterir", () => {
    const r = render("profile");
    const texts = r.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(texts).toContain("Adım 4 / 5");
  });

  it("ilerleme çubuğu erişilebilirlik değeri taşır", () => {
    const r = render("profile");
    const bar = r.root.findByProps({ accessibilityRole: "progressbar" });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 3 });
  });

  it("çubuk dolgusu tek bir animasyonlu görünümdür", () => {
    const r = render("social");
    // (2 biten + 0,5) / 5 = 0,5
    const fill = r.root.findAllByType("AnimatedView").pop();
    expect(fill).toBeDefined();
    expect(r.root.findAllByType("AnimatedView")).toHaveLength(1);
  });

  it("yedek aşaması araya girince listede görünür", () => {
    const r = render("fallback", ["verify", "local", "social", "fallback", "account"]);
    const texts = r.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(texts).toContain(DELETE_ACCOUNT_COPY.tr.stages.fallback);
    expect(icons(r).filter((n) => n === "checkmark-circle")).toHaveLength(3);
  });

  it("bilinmeyen aşama kimliği çökertmez (kimliği gösterir)", () => {
    const r = render("x", ["x", "account"]);
    expect(r.root.findAllByType("Text").length).toBeGreaterThan(0);
  });

  it("boş ilerleme listesiyle de çökmez", () => {
    const r = render(undefined, []);
    expect(r.root.findAllByType("ActivityIndicator")).toHaveLength(0);
  });
});
