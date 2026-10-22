import React from "react";
import { act, create } from "react-test-renderer";
import AdaptiveTabShell from "../components/navigation/AdaptiveTabShell";
import { TAB_DEFINITIONS } from "../utils/tabBarModel";
import { TabBarLayoutContext } from "../context/TabBarLayoutContext";

let mockMode = "native-ios";
const mockKeyboardListeners = new Map();
jest.mock("react-native", () => ({
  View: "View", ActivityIndicator: "Spinner", I18nManager: { isRTL: false },
  Platform: { OS: "ios", Version: "18.2" },
  StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" } },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  InteractionManager: { runAfterInteractions: () => ({ cancel: jest.fn() }) },
  Keyboard: { addListener: (name, fn) => { mockKeyboardListeners.set(name, fn); return { remove: () => mockKeyboardListeners.delete(name) }; } },
}));
jest.mock("react-native-screens", () => ({ Screen: "Scene", ScreenContainer: "Scenes", Tabs: { Host: "NativeTabs", Screen: "NativeScene" } }));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  useSharedValue: (val) => ({ value: val }),
  withTiming: (val) => val,
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock("../components/common/BlurTarget", () => ({ BlurTargetSurface: "BlurTarget", BLUR_SCOPES: { screen: "screen" }, useBlurTargetRef: () => ({ current: {} }) }));
jest.mock("../services/tabBarCapabilities", () => ({ tabBarNativeSupport: { AndroidBackdrop: "Backdrop", nativeTabsAvailable: true }, useTabBarCapabilities: () => ({ mode: mockMode, reduceMotion: false }) }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: { TAB_VIEWED: "tab_viewed" }, trackEvent: jest.fn() }));
const { trackEvent: mockTrackEvent } = require("../services/analytics");
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));
jest.mock("../components/navigation/TabBar", () => ({ __esModule: true, default: "OverlayBar" }));
// iOS 26 yerel ölçekleme: modül varlığı testte elle belirlenir; sürücü bileşen
// ana makine öğesi olarak taklit edilir (kendi testi nativeTabBarScale.test.js).
let mockNativeScale = false;
jest.mock("../services/tabBarScale", () => ({ get nativeTabBarScaleAvailable() { return mockNativeScale; } }));
jest.mock("../components/navigation/NativeTabBarScale", () => ({ __esModule: true, default: "NativeScale" }));

global.IS_REACT_ACT_ENVIRONMENT = true;
const theme = { primary: "#111111", accent: "#3388ff", text: { secondary: "#aaaaaa" } };
const mounts = {};
function Fixture({ name }) {
  const [draft, setDraft] = React.useState("");
  React.useEffect(() => { mounts[name] = (mounts[name] || 0) + 1; }, [name]);
  return <input name={name} value={draft} onChange={setDraft} />;
}
let renderer;
let props;
let warn;
beforeEach(() => {
  mockMode = "native-ios";
  mockNativeScale = false;
  Object.keys(mounts).forEach((key) => delete mounts[key]);
  mockTrackEvent.mockClear();
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
  props = {
    navigation: { setParams: jest.fn(), navigate: jest.fn() }, route: { params: { initialTab: "profile" } },
    tabs: TAB_DEFINITIONS.map((tab) => ({ ...tab, label: tab.name })),
    screens: Object.fromEntries(TAB_DEFINITIONS.map(({ name }) => [name, <Fixture key={name} name={name} />])), theme,
    renderCompanion: () => <button name="companion" />,
  };
});
afterEach(async () => { if (renderer) await act(() => renderer.unmount()); renderer = null; warn.mockRestore(); });
async function render() { await act(() => { renderer = create(<AdaptiveTabShell {...props} />); }); }
async function update() { await act(() => renderer.update(<AdaptiveTabShell {...props} />)); }

it("changes only the bar across full/blur/off, retaining the same native host and local draft", async () => {
  await render();
  const host = renderer.root.findByType("NativeTabs");
  await act(() => renderer.root.find((node) => node.type === "input" && node.props.name === "profile").props.onChange("unsaved note"));
  for (const mode of ["legacy-blur", "legacy-solid", "native-ios"]) {
    mockMode = mode;
    await update();
    expect(renderer.root.findByType("NativeTabs")).toBe(host);
    expect(host.props.tabBarHidden).toBe(mode !== "native-ios");
    expect(renderer.root.find((node) => node.type === "input" && node.props.name === "profile").props.value).toBe("unsaved note");
  }
  expect(mounts.profile).toBe(1);
});

it("native selection and legacy bar presses share one state without losing visited scenes", async () => {
  await render();
  await act(() => renderer.root.findByType("NativeTabs").props.onTabSelected({ nativeEvent: { selectedScreenKey: "share", provenance: 1, actionOrigin: "user" } }));
  expect(mounts.share).toBe(1);
  mockMode = "legacy-blur";
  await update();
  expect(renderer.root.findByType("OverlayBar").props.activeTab).toBe("share");
  await act(() => renderer.root.findByType("OverlayBar").props.onSelect("profile"));
  expect(renderer.root.findByType("NativeTabs").props.navStateRequest.selectedScreenKey).toBe("profile");
  expect(mounts.profile).toBe(1);
  expect(mounts.share).toBe(1);
});

it("her sekme geçişinde (ilk sekme dahil) tab_viewed bir kez gönderilir; aynı sekmeye yeniden basmak saymaz", async () => {
  await render();
  expect(mockTrackEvent.mock.calls).toEqual([["tab_viewed", { tab: "profile" }]]);
  mockMode = "legacy-blur";
  await update();
  await act(() => renderer.root.findByType("OverlayBar").props.onSelect("library"));
  expect(mockTrackEvent).toHaveBeenLastCalledWith("tab_viewed", { tab: "library" });
  await act(() => renderer.root.findByType("OverlayBar").props.onSelect("library"));
  expect(mockTrackEvent).toHaveBeenCalledTimes(2);
});

it("consumes repeated initialTab navigation and preserves the current destination", async () => {
  await render();
  expect(props.navigation.setParams).toHaveBeenCalledWith({ initialTab: undefined });
  props = { ...props, route: { params: {} } };
  await update();
  await act(() => renderer.root.findByType("NativeTabs").props.onTabSelected({ nativeEvent: { selectedScreenKey: "share", provenance: 1, actionOrigin: "user" } }));
  props = { ...props, route: { params: { initialTab: "profile" } } };
  await update();
  expect(renderer.root.findByType("NativeTabs").props.navStateRequest.selectedScreenKey).toBe("profile");
  expect(props.navigation.setParams).toHaveBeenCalledTimes(2);
});

it("hides controls for the keyboard and restores them without remounting screens", async () => {
  mockMode = "legacy-blur";
  await render();
  await act(() => mockKeyboardListeners.get("keyboardDidShow")());
  expect(renderer.root.findAllByType("OverlayBar")).toHaveLength(0);
  expect(renderer.root.findAllByProps({ name: "companion" })).toHaveLength(1);
  expect(renderer.root.findByProps({ pointerEvents: "none" }).props.style).toEqual([{ zIndex: 30 }, { opacity: 0 }]);
  await act(() => mockKeyboardListeners.get("keyboardDidHide")());
  expect(renderer.root.findAllByType("OverlayBar")).toHaveLength(1);
  expect(mounts.profile).toBe(1);
});

describe("iOS 26 native bar scaling", () => {
  const minimize = () => renderer.root.findByType("NativeTabs").props.ios.tabBarMinimizeBehavior;

  it("keeps the system minimize exactly as before when the module is not in the binary", async () => {
    await render();
    expect(minimize()).toBe("onScrollDown");
    expect(renderer.root.findAllByType("NativeScale")).toHaveLength(0);
  });

  it("scales the real bar from the shared scroll progress, and turns the system minimize off so the two don't stack", async () => {
    mockNativeScale = true;
    await render();
    expect(minimize()).toBe("never");
    const driver = renderer.root.findByType("NativeScale");
    expect(driver.props.progress.value).toBe(0);
  });

  it("feeds the driver the SAME progress value the screens write (and the JS bar reads)", async () => {
    mockNativeScale = true;
    let layoutContext;
    const Probe = () => { layoutContext = React.useContext(TabBarLayoutContext); return null; };
    props = { ...props, renderCompanion: () => <Probe /> };
    await render();
    expect(renderer.root.findByType("NativeScale").props.progress).toBe(layoutContext.tabBarCollapse);
  });

  it("does nothing on the JS-bar modes — there the JS bar shrinks itself", async () => {
    mockNativeScale = true;
    mockMode = "legacy-blur";
    await render();
    expect(renderer.root.findAllByType("NativeScale")).toHaveLength(0);
    expect(minimize()).toBe("onScrollDown");
    expect(renderer.root.findAllByType("OverlayBar")).toHaveLength(1);
  });

  it("drops the driver (which puts the real bar back to full size) when the mode leaves native-ios", async () => {
    mockNativeScale = true;
    await render();
    expect(renderer.root.findAllByType("NativeScale")).toHaveLength(1);
    mockMode = "legacy-solid";
    await update();
    expect(renderer.root.findAllByType("NativeScale")).toHaveLength(0);
    mockMode = "native-ios";
    await update();
    expect(renderer.root.findAllByType("NativeScale")).toHaveLength(1);
  });

  it("keeps the same native host and screen state through all of it", async () => {
    mockNativeScale = true;
    await render();
    const host = renderer.root.findByType("NativeTabs");
    mockMode = "legacy-blur";
    await update();
    mockMode = "native-ios";
    await update();
    expect(renderer.root.findByType("NativeTabs")).toBe(host);
    expect(mounts.profile).toBe(1);
  });
});

it("registers exactly four native scenes and disables native reselect side effects", async () => {
  await render();
  const scenes = renderer.root.findAllByType("NativeScene");
  expect(scenes.map((scene) => scene.props.screenKey)).toEqual(["discover", "share", "library", "profile"]);
  scenes.forEach((scene) => {
    expect(scene.props.specialEffects.repeatedTabSelection).toEqual({ popToRoot: false, scrollToTop: false });
    expect(scene.props.ios.overrideScrollViewContentInsetAdjustmentBehavior).toBe(false);
    expect(scene.props.preventNativeSelection).toBeFalsy();
  });
});

describe("yapay zeka düğmesi", () => {
  const aiScene = () => renderer.root.findAllByType("NativeScene").find((scene) => scene.props.screenKey === "ai");

  it("onAiPress yoksa ne yerel öğe ne JS düğmesi vardır", async () => {
    await render();
    expect(aiScene()).toBeUndefined();
    mockMode = "legacy-blur";
    await update();
    expect(renderer.root.findByType("OverlayBar").props.aiAction).toBeNull();
  });

  it("iOS'ta son yerel öğe: iOS 26'da ayrık yuvarlak cam düğme, asla seçilmez", async () => {
    props = { ...props, onAiPress: jest.fn(), aiLabel: "CineMatch" };
    await render();
    const scenes = renderer.root.findAllByType("NativeScene");
    expect(scenes).toHaveLength(5);
    expect(scenes[scenes.length - 1].props.screenKey).toBe("ai");
    const ai = aiScene();
    expect(ai.props.preventNativeSelection).toBe(true);
    expect(ai.props.title).toBe("CineMatch");
    expect(ai.props.tabBarItemAccessibilityLabel).toBe("CineMatch");
    expect(ai.props.ios.systemItem).toBe("search");
    expect(ai.props.ios.icon).toEqual({ type: "sfSymbol", name: "sparkles" });
    expect(ai.props.specialEffects.repeatedTabSelection).toEqual({ popToRoot: false, scrollToTop: false });
  });

  it("yerel öğeye dokunuş (seçim engellendi olayı) sohbeti merkezle açar, sekmeyi DEĞİŞTİRMEZ", async () => {
    const onAiPress = jest.fn();
    props = { ...props, onAiPress, route: { params: { initialTab: "share" } } };
    await render();
    await act(() => renderer.root.findByType("NativeTabs").props.onTabSelectionPrevented({
      nativeEvent: { selectedScreenKey: "share", provenance: 0, preventedScreenKey: "ai" },
    }));
    expect(onAiPress).toHaveBeenCalledTimes(1);
    const origin = onAiPress.mock.calls[0][0];
    expect(origin.x).toBeGreaterThan(390 / 2);
    expect(origin.y).toBeGreaterThan(844 / 2);
    expect(renderer.root.findByType("NativeTabs").props.navStateRequest.selectedScreenKey).toBe("share");
  });

  it("başka bir ekranın engellenen seçimi sohbeti açmaz", async () => {
    const onAiPress = jest.fn();
    props = { ...props, onAiPress };
    await render();
    await act(() => renderer.root.findByType("NativeTabs").props.onTabSelectionPrevented({
      nativeEvent: { selectedScreenKey: "profile", provenance: 0, preventedScreenKey: "settings" },
    }));
    expect(onAiPress).not.toHaveBeenCalled();
  });

  it("JS çubuğunda aynı eylem çubuğa verilir ve aynı işleve gelir", async () => {
    const onAiPress = jest.fn();
    props = { ...props, onAiPress, aiLabel: "CineMatch" };
    mockMode = "legacy-blur";
    await render();
    const { aiAction } = renderer.root.findByType("OverlayBar").props;
    expect(aiAction.label).toBe("CineMatch");
    await act(() => aiAction.onPress());
    expect(onAiPress).toHaveBeenCalledTimes(1);
    // Çubuktaki sekme durumuna dokunulmadı.
    expect(renderer.root.findByType("OverlayBar").props.activeTab).toBe("profile");
  });

  it("etiket verilmezse marka adı kullanılır", async () => {
    props = { ...props, onAiPress: jest.fn() };
    mockMode = "legacy-blur";
    await render();
    expect(renderer.root.findByType("OverlayBar").props.aiAction.label).toBe("CineMatch");
  });
});
