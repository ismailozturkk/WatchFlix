import React from "react";
import { act, create } from "react-test-renderer";
import AdaptiveTabShell from "../components/navigation/AdaptiveTabShell";
import { TAB_DEFINITIONS } from "../utils/tabBarModel";

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
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));
jest.mock("../components/navigation/TabBar", () => ({ __esModule: true, default: "OverlayBar" }));

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
  Object.keys(mounts).forEach((key) => delete mounts[key]);
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
  await act(() => renderer.root.findByType("NativeTabs").props.onTabSelected({ nativeEvent: { selectedScreenKey: "movies", provenance: 1, actionOrigin: "user" } }));
  expect(mounts.movies).toBe(1);
  mockMode = "legacy-blur";
  await update();
  expect(renderer.root.findByType("OverlayBar").props.activeTab).toBe("movies");
  await act(() => renderer.root.findByType("OverlayBar").props.onSelect("profile"));
  expect(renderer.root.findByType("NativeTabs").props.navStateRequest.selectedScreenKey).toBe("profile");
  expect(mounts.profile).toBe(1);
  expect(mounts.movies).toBe(1);
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

it("registers exactly five native scenes and disables native reselect side effects", async () => {
  await render();
  const scenes = renderer.root.findAllByType("NativeScene");
  expect(scenes).toHaveLength(5);
  scenes.forEach((scene) => {
    expect(scene.props.specialEffects.repeatedTabSelection).toEqual({ popToRoot: false, scrollToTop: false });
    expect(scene.props.ios.overrideScrollViewContentInsetAdjustmentBehavior).toBe(false);
  });
});
