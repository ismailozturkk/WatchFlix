import { TAB_NAMES, createTabState, getTabBarLayout, tabStateReducer } from "../utils/tabBarModel";
import { resolveTabBarMode } from "../utils/tabBarCapabilities";

const supported = { platform: "android", apiLevel: 33, accessibilityReady: true, androidGlassAvailable: true, hasBlurTarget: true };
describe("tab surface capabilities", () => {
  it("requires a native shader probe, not just a new Android version", () => {
    expect(resolveTabBarMode(supported)).toBe("android-glass");
    expect(resolveTabBarMode({ ...supported, androidGlassAvailable: false })).toBe("legacy-blur");
    expect(resolveTabBarMode({ ...supported, rendererFailed: true })).toBe("legacy-blur");
  });
  it.each([31, 32])("keeps existing blur on API %s", (apiLevel) => {
    expect(resolveTabBarMode({ ...supported, apiLevel })).toBe("legacy-blur");
  });
  it.each([30, null, "33", undefined])("does not assume unsupported/unknown Android API %s supports blur", (apiLevel) => {
    expect(resolveTabBarMode({ ...supported, apiLevel })).toBe("legacy-solid");
  });
  it("needs a blur target when the shader fails", () => {
    expect(resolveTabBarMode({ ...supported, rendererFailed: true, hasBlurTarget: false })).toBe("legacy-solid");
  });
  it.each([{ effectMode: "off" }, { accessibilityReady: false }, { reduceTransparency: true }, { highContrast: true }])("respects preference/accessibility %j", (restriction) => {
    expect(resolveTabBarMode({ ...supported, ...restriction })).toBe("legacy-solid");
  });
  it("balanced keeps blur without the expensive shader", () => {
    expect(resolveTabBarMode({ ...supported, effectMode: "balanced" })).toBe("legacy-blur");
  });
  it("resolves native-ios for iOS 18+ with native tabs available", () => {
    const ios = { ...supported, platform: "ios", apiLevel: "18.2", nativeTabsAvailable: true };
    expect(resolveTabBarMode(ios)).toBe("native-ios");
    expect(resolveTabBarMode({ ...ios, apiLevel: "26.0" })).toBe("native-ios");
    for (const missing of [{ nativeTabsAvailable: false }, { apiLevel: "17.5" }, { apiLevel: "16.0" }]) {
      expect(resolveTabBarMode({ ...ios, ...missing })).toBe("legacy-blur");
    }
  });
  it("unknown platforms stay safe", () => expect(resolveTabBarMode({ ...supported, platform: "web" })).toBe("legacy-solid"));
});

describe("tab state across native/JS interaction", () => {
  it.each(TAB_NAMES)("mounts the requested %s immediately", (name) => {
    const state = createTabState(name);
    expect(state.activeTab).toBe(name);
    expect(state.mountedTabs.has(name)).toBe(true);
  });
  it("retains every visited scene through 50 rapid changes", () => {
    let state = createTabState();
    for (let i = 0; i < 50; i++) state = tabStateReducer(state, { type: "select", name: TAB_NAMES[i % 5] });
    expect(state.activeTab).toBe("profile");
    expect([...state.mountedTabs].sort()).toEqual([...TAB_NAMES].sort());
  });
  it("ignores a stale native selection and invalid keys", () => {
    const state = { ...createTabState("profile"), provenance: 8 };
    expect(tabStateReducer(state, { type: "native", event: { selectedScreenKey: "movies", provenance: 7, actionOrigin: "user" } })).toBe(state);
    expect(tabStateReducer(state, { type: "select", name: "unknown" })).toBe(state);
  });
  it("does not undo a newer request when the previous JS request is acknowledged", () => {
    const state = createTabState("profile");
    const ack = tabStateReducer(state, { type: "native", event: { selectedScreenKey: "movies", provenance: 1, actionOrigin: "programmatic-js" } });
    expect(ack.activeTab).toBe("profile");
    expect(ack.provenance).toBe(1);
  });
  it("reconciles a rejected request to the actual native selection", () => {
    const state = tabStateReducer(createTabState("profile"), { type: "native", rejected: true, event: { selectedScreenKey: "movies", provenance: 3 } });
    expect(state.activeTab).toBe("movies");
    expect(state.mountedTabs.has("profile")).toBe(true);
  });
  it("handles repeated programmatic destinations after manual selection", () => {
    let state = createTabState("profile");
    state = tabStateReducer(state, { type: "select", name: "movies" });
    state = tabStateReducer(state, { type: "select", name: "profile" });
    expect(state.activeTab).toBe("profile");
    expect(tabStateReducer(state, { type: "select", name: "profile" })).toBe(state);
  });
  it.each(["legacy-blur", "legacy-solid", "android-glass", "native-ios"])("reserves reachable bottom content for %s", (mode) => {
    for (const width of [320, 390, 768]) {
      const layout = getTabBarLayout({ width, bottomInset: 34, mode });
      expect(layout.width).toBeLessThanOrEqual(width - 32);
      expect(layout.slotWidth).toBeGreaterThanOrEqual(44);
      expect(layout.contentBottom).toBeGreaterThan(layout.height + layout.bottom);
      expect(layout.fabRight).toBeGreaterThanOrEqual(4);
    }
  });
  it("calculates harmonious concentric border radius between outer bar and indicator pill", () => {
    const layout = getTabBarLayout({ width: 390, bottomInset: 34, mode: "android-glass" });
    // Concentric corner radius law: R_inner = R_outer - padding
    expect(layout.barRadius).toBe(layout.height / 2);
    expect(layout.indicatorRadius).toBe(layout.barRadius - layout.padding);
    expect(layout.indicatorRadius).toBeGreaterThan(0);
  });
});
