import { AI_ACTION, TAB_DEFINITIONS, TAB_NAMES, createTabState, getAiButtonCenter, getTabBarLayout, initialTabName, isTabName, tabStateReducer } from "../utils/tabBarModel";
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
    for (let i = 0; i < 50; i++) state = tabStateReducer(state, { type: "select", name: TAB_NAMES[i % TAB_NAMES.length] });
    expect(state.activeTab).toBe(TAB_NAMES[49 % TAB_NAMES.length]);
    expect([...state.mountedTabs].sort()).toEqual([...TAB_NAMES].sort());
  });
  it("ignores a stale native selection and invalid keys", () => {
    const state = { ...createTabState("profile"), provenance: 8 };
    expect(tabStateReducer(state, { type: "native", event: { selectedScreenKey: "share", provenance: 7, actionOrigin: "user" } })).toBe(state);
    expect(tabStateReducer(state, { type: "select", name: "unknown" })).toBe(state);
  });
  it("does not undo a newer request when the previous JS request is acknowledged", () => {
    const state = createTabState("profile");
    const ack = tabStateReducer(state, { type: "native", event: { selectedScreenKey: "share", provenance: 1, actionOrigin: "programmatic-js" } });
    expect(ack.activeTab).toBe("profile");
    expect(ack.provenance).toBe(1);
  });
  it("reconciles a rejected request to the actual native selection", () => {
    const state = tabStateReducer(createTabState("profile"), { type: "native", rejected: true, event: { selectedScreenKey: "share", provenance: 3 } });
    expect(state.activeTab).toBe("share");
    expect(state.mountedTabs.has("profile")).toBe(true);
  });
  it("handles repeated programmatic destinations after manual selection", () => {
    let state = createTabState("profile");
    state = tabStateReducer(state, { type: "select", name: "share" });
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
    }
  });
  it.each([320, 360, 390, 430, 768])("çubuk + yapay zeka düğmesi tek grup olarak %s px ekrana sığar", (width) => {
    const layout = getTabBarLayout({ width, bottomInset: 34, mode: "legacy-blur" });
    expect(layout.groupWidth).toBe(layout.width + layout.aiGap + layout.aiSize);
    // Yan boşluklar simetrik kalır ve grup ekranın kenarına dayanmaz.
    expect(layout.groupWidth).toBeLessThanOrEqual(width - 32);
    expect(layout.slotWidth).toBeGreaterThanOrEqual(44);
  });
  it("yapay zeka düğmesi çubukla AYNI yükseklikte bir daire (aynı yatay hiza)", () => {
    const layout = getTabBarLayout({ width: 390, bottomInset: 34, mode: "android-glass" });
    expect(layout.aiSize).toBe(layout.height);
    expect(layout.aiGap).toBeGreaterThan(0);
  });
  it("her sekmeye ve yeni genişliğe rağmen çubuk dört yuvaya bölünür", () => {
    expect(TAB_NAMES).toEqual(["discover", "share", "library", "profile"]);
    const layout = getTabBarLayout({ width: 390, bottomInset: 34, mode: "legacy-blur" });
    expect(layout.width).toBe(layout.slotWidth * TAB_NAMES.length + layout.padding * 2);
  });
});

describe("Film + Dizi tek sekme, yapay zeka sekme değil", () => {
  it("eski sekme adları artık geçerli değil ve açılış sekmesine düşer", () => {
    for (const eski of ["tvshows", "movies"]) {
      expect(isTabName(eski)).toBe(false);
      expect(initialTabName(eski)).toBe("discover");
    }
    expect(initialTabName(undefined)).toBe("discover");
    // Ayarlar artık sekme değil (Profil'in dişli düğmesinden açılır): eski adlar
    // ona düşmez, kalan sekmelere düşer.
    expect(isTabName("settings")).toBe(false);
    expect(initialTabName("settings")).toBe("discover");
    expect(initialTabName("debug")).toBe("profile");
  });
  it("Kütüphane sekme, Ayarlar değil; Hub'ın anahtarı korunur ama etiketi ve simgesi Eğlence", () => {
    expect(isTabName("library")).toBe(true);
    const share = TAB_DEFINITIONS.find((tab) => tab.name === "share");
    expect(share.labelKey).toBe("funTab");
    expect(share.icon).toBe("game-controller");
    expect(TAB_DEFINITIONS.find((tab) => tab.name === "library").labelKey).toBe("library");
  });
  it("yapay zeka anahtarı sekme adı değil: durum makinesi ona asla geçmez", () => {
    expect(isTabName(AI_ACTION.key)).toBe(false);
    const state = createTabState("profile");
    expect(tabStateReducer(state, { type: "select", name: AI_ACTION.key })).toBe(state);
    expect(tabStateReducer(state, { type: "native", event: { selectedScreenKey: AI_ACTION.key, provenance: 1, actionOrigin: "user" } })).toBe(state);
  });
  it("açılışta yalnız Film/Dizi sekmesi (ve istenen sekme) kurulur", () => {
    expect([...createTabState().mountedTabs]).toEqual(["discover"]);
  });
});

describe("yapay zeka düğmesinin ekran merkezi", () => {
  const base = { width: 390, height: 844, bottomInset: 34 };
  it("JS çubuğunda grubun sağ ucunda, çubukla aynı yatay hizada", () => {
    const layout = getTabBarLayout({ ...base, mode: "legacy-blur" });
    const { x, y } = getAiButtonCenter({ ...base, layout, mode: "legacy-blur" });
    const rightEdge = (base.width + layout.groupWidth) / 2;
    expect(x).toBe(rightEdge - layout.aiSize / 2);
    // Çubuğun dikey merkeziyle aynı yükseklik.
    expect(y).toBe(base.height - layout.bottom - layout.height / 2);
    expect(x).toBeGreaterThan(base.width / 2);
  });
  it("RTL'de sol uca yansır", () => {
    const layout = getTabBarLayout({ ...base, mode: "legacy-blur" });
    const ltr = getAiButtonCenter({ ...base, layout, mode: "legacy-blur" });
    const rtl = getAiButtonCenter({ ...base, layout, mode: "legacy-blur", rtl: true });
    expect(rtl.x).toBeCloseTo(base.width - ltr.x, 5);
    expect(rtl.y).toBe(ltr.y);
  });
  it("yerel iOS çubuğunda sağ alt köşeye yakın bir nokta verir (ekran dışına taşmaz)", () => {
    const layout = getTabBarLayout({ ...base, mode: "native-ios" });
    const { x, y } = getAiButtonCenter({ ...base, layout, mode: "native-ios" });
    expect(x).toBeGreaterThan(base.width / 2);
    expect(x).toBeLessThan(base.width);
    expect(y).toBeGreaterThan(base.height / 2);
    expect(y).toBeLessThan(base.height - base.bottomInset);
  });
});

describe("sekme çubuğu yerleşimi (devam)", () => {
  it("calculates harmonious concentric border radius between outer bar and indicator pill", () => {
    const layout = getTabBarLayout({ width: 390, bottomInset: 34, mode: "android-glass" });
    // Concentric corner radius law: R_inner = R_outer - padding
    expect(layout.barRadius).toBe(layout.height / 2);
    expect(layout.indicatorRadius).toBe(layout.barRadius - layout.padding);
    expect(layout.indicatorRadius).toBeGreaterThan(0);
  });
});
