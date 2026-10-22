import React from "react";
import { act, create } from "react-test-renderer";
import TabBar from "../components/navigation/TabBar";
import { TAB_BAR_COLLAPSE_SCALE_DELTA } from "../utils/tabBarCollapse";
import { TabBarLayoutContext } from "../context/TabBarLayoutContext";
import { TAB_DEFINITIONS, getTabBarLayout } from "../utils/tabBarModel";
import { withSpring } from "react-native-reanimated";

let latestGestureHandlers = null;

jest.mock("react-native", () => ({
  I18nManager: { isRTL: false },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  TouchableOpacity: ({ children, onPress, onPressIn, onPressOut, testID, accessibilityRole, accessibilityLabel, accessibilityState }) => (
    <button
      data-testid={testID}
      onClick={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-selected={accessibilityState?.selected}
    >
      {children}
    </button>
  ),
  Text: ({ children, style }) => <span style={style}>{children}</span>,
  View: ({ children, style, testID, pointerEvents, ...rest }) => (
    <div data-testid={testID} data-pointer-events={pointerEvents} style={style} {...rest}>
      {children}
    </div>
  ),
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  },
}));

// Minimal chainable-builder mock of the Gesture.Pan() API so TabBar's drag
// logic (built on react-native-gesture-handler) can be driven directly from
// tests without a real native gesture runtime.
jest.mock("react-native-gesture-handler", () => {
  const buildPanGesture = () => {
    const handlers = {};
    const chain = { __handlers: handlers };
    ["activeOffsetX", "failOffsetY", "enabled", "shouldCancelWhenOutside"].forEach((method) => {
      chain[method] = () => chain;
    });
    ["onBegin", "onStart", "onUpdate", "onChange", "onEnd", "onFinalize"].forEach((method) => {
      chain[method] = (fn) => {
        handlers[method] = fn;
        return chain;
      };
    });
    latestGestureHandlers = handlers;
    return chain;
  };
  return {
    __esModule: true,
    Gesture: { Pan: buildPanGesture },
    GestureDetector: ({ children }) => children,
  };
});

jest.mock("../services/hapticsService", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("../components/typography/AppText", () => ({
  __esModule: true,
  AppText: ({ children, style }) => <span style={style}>{children}</span>,
  useFontResolver: () => () => ({}),
  useFontFamilyForRole: () => "Inter",
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: {
      View: ({ children, style, testID }) => <div data-testid={testID} style={style}>{children}</div>,
    },
    useSharedValue: (val) => ({ value: val }),
    useAnimatedStyle: (fn) => fn(),
    withSpring: jest.fn((val) => val),
    withTiming: (val) => val,
    runOnJS: (fn) => fn,
    Easing: {
      out: (fn) => fn,
      cubic: (t) => t,
    },
  };
});

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, style }) => <div data-testid="linear-gradient" style={style}>{children}</div>,
}));

jest.mock("../components/AppIcon", () => ({
  __esModule: true,
  default: ({ family, name, size, color }) => (
    <i data-family={family} data-icon={name} data-size={size} data-color={color} />
  ),
}));

jest.mock("../components/common/AdaptiveBlurView", () => ({
  __esModule: true,
  default: ({ children, tint, intensity, testID }) => (
    <div data-testid={testID || "adaptive-blur-view"} data-tint={tint} data-intensity={intensity}>
      {children}
    </div>
  ),
}));

let mockAndroidGlass = null;
jest.mock("../services/tabBarCapabilities", () => ({
  tabBarNativeSupport: {
    get AndroidGlass() {
      return mockAndroidGlass;
    },
    AndroidBackdrop: "AndroidBackdrop",
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("TabBar Liquid Glass & Component Interaction", () => {
  let warnSpy;
  beforeAll(() => {
    const original = console.error;
    warnSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).includes("react-test-renderer is deprecated")) return;
      original(message, ...args);
    });
  });
  afterAll(() => {
    warnSpy?.mockRestore();
  });
  const darkTheme = {
    primary: "#111111",
    secondary: "#222222",
    accent: "#3388ff",
    text: { primary: "#ffffff", secondary: "#888888" },
    shadow: "#000000",
  };
  const lightTheme = {
    primary: "#f8f9fa",
    secondary: "#ffffff",
    accent: "#0066cc",
    text: { primary: "#1a1a1a", secondary: "#666666" },
    shadow: "#000000",
  };

  const tabs = TAB_DEFINITIONS.map((tab) => ({
    ...tab,
    label: tab.name.toUpperCase(),
  }));

  const defaultLayout = getTabBarLayout({ width: 390, bottomInset: 34, mode: "legacy-blur" });

  it("renders 4 tabs as icon-only capsule buttons with accessible labels (no AI button unless asked)", () => {
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const buttons = renderer.root.findAllByType("button");
    expect(buttons).toHaveLength(4);

    tabs.forEach((tab) => {
      const button = renderer.root.find((node) => node.props["data-testid"] === `tab-${tab.name}`);
      expect(button).toBeDefined();
      expect(button.props["aria-label"]).toBe(tab.label);

      // Verify label text is NOT rendered inside (icon-only capsule pill design)
      const labelNodes = button.findAll((node) => node.type === "span" && node.props.children === tab.label);
      expect(labelNodes).toHaveLength(0);

      // Verify icon is rendered inside — filled when selected, outline
      // otherwise (only "discover" is active here).
      const expectedIcon = tab.name === "discover" ? tab.icon : (tab.iconOutline || tab.icon);
      const iconNode = button.find((node) => node.type === "i" && node.props["data-icon"] === expectedIcon);
      expect(iconNode).toBeDefined();
    });
  });

  it("highlights the active tab with accent color and aria-selected=true", () => {
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="share"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const activeBtn = renderer.root.find((node) => node.props["data-testid"] === "tab-share");
    expect(activeBtn.props["aria-selected"]).toBe(true);

    const activeIcon = activeBtn.find((node) => node.type === "i");
    expect(activeIcon.props["data-color"]).toBe(darkTheme.accent);

    const inactiveBtn = renderer.root.find((node) => node.props["data-testid"] === "tab-discover");
    expect(inactiveBtn.props["aria-selected"]).toBe(false);

    const inactiveIcon = inactiveBtn.find((node) => node.type === "i");
    expect(inactiveIcon.props["data-color"]).toBe(darkTheme.text.secondary);
  });

  it("fires onSelect when a tab button is clicked", () => {
    const onSelect = jest.fn();
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const libraryBtn = renderer.root.find((node) => node.props["data-testid"] === "tab-library");
    act(() => {
      libraryBtn.props.onClick();
    });

    expect(onSelect).toHaveBeenCalledWith("library");
  });

  it("renders AdaptiveBlurView in legacy-blur mode", () => {
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const blurView = renderer.root.find((node) => node.props["data-testid"] === "adaptive-blur-view");
    expect(blurView).toBeDefined();
  });

  it("renders AndroidGlassSurface in android-glass mode when Glass is available", () => {
    mockAndroidGlass = function MockGlass({ testID, onRenderStatus }) {
      return <div data-testid={testID} />;
    };

    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={jest.fn()}
          mode="android-glass"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const glassSurface = renderer.root.find((node) => node.props["data-testid"] === "tab-glass-surface");
    expect(glassSurface).toBeDefined();
    mockAndroidGlass = null;
  });

  it("adapts colors for light theme vs dark theme", () => {
    let darkRenderer;
    let lightRenderer;
    act(() => {
      darkRenderer = create(
        <TabBar
          tabs={tabs}
          activeTab="profile"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
      lightRenderer = create(
        <TabBar
          tabs={tabs}
          activeTab="profile"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={lightTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    const darkActiveIcon = darkRenderer.root.find((node) => node.props["data-testid"] === "tab-profile").find((node) => node.type === "i");
    const lightActiveIcon = lightRenderer.root.find((node) => node.props["data-testid"] === "tab-profile").find((node) => node.type === "i");

    expect(darkActiveIcon.props["data-color"]).toBe(darkTheme.accent);
    expect(lightActiveIcon.props["data-color"]).toBe(lightTheme.accent);
  });

  it("renders in android-glass mode and attaches the drag gesture", () => {
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={jest.fn()}
          mode="android-glass"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });
    const root = renderer.root.find((node) => node.props["data-testid"] === "tab-bar-android-glass");
    expect(root).toBeDefined();
  });

  describe("scroll-driven shrink", () => {
    // The outer capsule is the only animated view carrying a translateY (the
    // pill uses translateX, the buttons only a scale).
    const hasTranslateY = (style) => Boolean(style?.transform?.some?.((t) => "translateY" in t));
    function capsuleTransform(progress) {
      let renderer;
      act(() => {
        renderer = create(
          <TabBarLayoutContext.Provider value={{ contentBottom: 110, tabBarCollapse: { value: progress }, tabBarLastScrollY: { value: -1 }, onTabBarScroll: () => {} }}>
            <TabBar tabs={tabs} activeTab="discover" onSelect={jest.fn()} mode="legacy-blur" layout={defaultLayout}
              theme={darkTheme} blurTarget={{ current: {} }} reduceMotion={false} onGlassFailure={jest.fn()} />
          </TabBarLayoutContext.Provider>
        );
      });
      const capsule = renderer.root.find((node) => node.type === "div" && Array.isArray(node.props.style) && node.props.style.some(hasTranslateY));
      const { transform } = capsule.props.style.find(hasTranslateY);
      return { scale: transform.find((t) => "scale" in t).scale, translateY: transform.find((t) => "translateY" in t).translateY };
    }

    it("is full size when nothing has been scrolled", () => {
      expect(capsuleTransform(0)).toEqual({ scale: 1, translateY: 0 });
    });

    it("shrinks by exactly 20% at full collapse", () => {
      expect(capsuleTransform(1).scale).toBeCloseTo(0.8, 5);
      expect(TAB_BAR_COLLAPSE_SCALE_DELTA).toBe(0.2);
    });

    it("shrinks and grows continuously with scroll progress", () => {
      const scales = [0, 0.25, 0.5, 0.75, 1].map((p) => capsuleTransform(p).scale);
      for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeLessThan(scales[i - 1]);
      expect(capsuleTransform(0.5).scale).toBeCloseTo(0.9, 5);
    });

    it("keeps the bottom edge essentially planted (within 1px) instead of floating up", () => {
      const { scale, translateY } = capsuleTransform(1);
      // Centred scale lifts the bottom edge by (1 - scale) * height / 2; translateY
      // comes after the scale in the list, so it is itself scaled.
      const lift = ((1 - scale) * defaultLayout.height) / 2;
      expect(Math.abs(translateY * scale - lift)).toBeLessThan(1);
    });
  });

  it("previews the drag live but only commits the tab switch on release, snapped to the nearest slot", () => {
    const onSelect = jest.fn();
    act(() => {
      create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    expect(latestGestureHandlers).toBeDefined();
    expect(typeof latestGestureHandlers.onUpdate).toBe("function");

    // event.x is relative to the bar view itself, and the pill is centered
    // under the touch point (not left-edge-aligned to it): dragCenterOffset =
    // padding + slotWidth / 2. x = dragCenterOffset + slotWidth puts the
    // pill's center exactly on slot 1's rest position -> round(slot / slot) = 1.
    const dragX = defaultLayout.padding + defaultLayout.slotWidth / 2 + defaultLayout.slotWidth;
    latestGestureHandlers.onBegin({ x: dragX });
    latestGestureHandlers.onStart();
    latestGestureHandlers.onUpdate({ x: dragX });
    // Mid-drag must NOT switch the screen — only preview/haptic.
    expect(onSelect).not.toHaveBeenCalled();

    latestGestureHandlers.onEnd();
    // Release commits the nearest tab.
    expect(onSelect).toHaveBeenCalledWith("share");

    latestGestureHandlers.onFinalize();
  });

  it("grows the pill on touch-down and bounces it back on release for a plain tap, without the gesture itself double-committing the switch", () => {
    const onSelect = jest.fn();
    act(() => {
      create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    // A stationary tap: onBegin fires (grow), the touch never moves enough
    // to activate (no onStart/onUpdate), then it's released. The gesture
    // must not call onSelect itself here — the tab button's own onPress is
    // the sole commit path for a plain tap.
    expect(() => {
      latestGestureHandlers.onBegin({ x: 0 });
      latestGestureHandlers.onEnd();
      latestGestureHandlers.onFinalize();
    }).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shrinks the pill back via the button's own onPressOut, independent of whether the gesture's onEnd/onFinalize fire", () => {
    // On-device, once the underlying TouchableOpacity claims a stationary
    // tap, the Pan gesture's onEnd/onFinalize don't reliably fire — which is
    // exactly why the pill used to get stuck grown. TabButton's onPressOut
    // is the guaranteed fallback and must not depend on the gesture at all.
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={jest.fn()}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    // Simulate the grow (onBegin, as a real touch-down would do) WITHOUT
    // ever invoking the gesture's onEnd/onFinalize — this is the exact
    // "stuck" scenario reported on-device.
    act(() => {
      latestGestureHandlers.onBegin({ x: 0 });
    });

    const callsBeforeRelease = withSpring.mock.calls.length;
    const libraryButton = renderer.root.find((node) => node.props["data-testid"] === "tab-library");
    expect(() => {
      act(() => { libraryButton.props.onPressOut(); });
    }).not.toThrow();

    // onPressOut must have driven the shrink-back springs itself, without
    // any help from the (never-called) gesture onEnd/onFinalize.
    expect(withSpring.mock.calls.length).toBeGreaterThan(callsBeforeRelease);
  });

  it("does not leave the pulse suppressed after a same-tab tap, so a later external tab change still animates", () => {
    // Regression test: suppressNextPulse used to be set unconditionally on
    // every touch (in onBegin). Pressing the already-active tab — or
    // dragging back to where you started — makes the real onSelect a
    // reducer no-op: activeTab never changes, so the "position & pulse"
    // effect never re-runs to consume the flag. It stayed stuck true until
    // some LATER, unrelated external tab change (e.g. a deep link) silently
    // lost its own position animation. The flag must only be set when the
    // touch actually lands on a different tab.
    const onSelect = jest.fn();
    let renderer;
    act(() => {
      renderer = create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    // Tap the ALREADY-active tab: grow (onBegin) then release (onPressOut).
    // A real onSelect("discover") here would be a no-op — activeTab doesn't
    // actually change in response, which the test mirrors by not updating
    // the prop below.
    act(() => {
      latestGestureHandlers.onBegin({ x: 0 });
      const discoverButton = renderer.root.find((node) => node.props["data-testid"] === "tab-discover");
      discoverButton.props.onPressOut();
    });

    const callsBeforeExternalChange = withSpring.mock.calls.length;

    // Now an EXTERNAL/programmatic change — nothing touched the bar for
    // this one — must still animate normally (offset + both pill scales).
    act(() => {
      renderer.update(
        <TabBar
          tabs={tabs}
          activeTab="profile"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    expect(withSpring.mock.calls.length).toBeGreaterThan(callsBeforeExternalChange);
  });

  it("ignores a plain tap that never crosses the drag activation threshold", () => {
    const onSelect = jest.fn();
    act(() => {
      create(
        <TabBar
          tabs={tabs}
          activeTab="discover"
          onSelect={onSelect}
          mode="legacy-blur"
          layout={defaultLayout}
          theme={darkTheme}
          blurTarget={{ current: {} }}
          reduceMotion={false}
          onGlassFailure={jest.fn()}
        />
      );
    });

    // A tap never calls onStart/onUpdate — only onEnd/onFinalize fire, and
    // they must be safe no-ops (no phantom tab switch, no crash).
    expect(() => {
      latestGestureHandlers.onEnd();
      latestGestureHandlers.onFinalize();
    }).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("ayrık yuvarlak yapay zeka düğmesi", () => {
    function renderBar({ aiAction, mode = "legacy-blur", onSelect = jest.fn(), theme = darkTheme } = {}) {
      let renderer;
      act(() => {
        renderer = create(
          <TabBar
            tabs={tabs}
            activeTab="discover"
            onSelect={onSelect}
            aiAction={aiAction}
            mode={mode}
            layout={defaultLayout}
            theme={theme}
            blurTarget={{ current: {} }}
            reduceMotion={false}
            onGlassFailure={jest.fn()}
          />
        );
      });
      return renderer;
    }
    const findAi = (renderer) => renderer.root.find((node) => node.props["data-testid"] === "tab-ai");

    it("eylem verilince dördüncü sekmenin yanında BEŞİNCİ bir düğme olarak çizilir, sekme değildir", () => {
      const renderer = renderBar({ aiAction: { label: "CineMatch", onPress: jest.fn() } });
      expect(renderer.root.findAllByType("button")).toHaveLength(5);
      const ai = findAi(renderer);
      expect(ai.props.role).toBe("button");
      expect(ai.props["aria-label"]).toBe("CineMatch");
      // Seçili durumu yoktur: sekme değil, eylem.
      expect(ai.props["aria-selected"]).toBeUndefined();
    });

    it("eylem verilmezse düğme hiç çizilmez", () => {
      const renderer = renderBar({ aiAction: null });
      expect(renderer.root.findAll((node) => node.props["data-testid"] === "tab-ai")).toHaveLength(0);
    });

    it("dokununca eylemi çağırır ve hiçbir sekmeyi seçmez", () => {
      const onPress = jest.fn();
      const onSelect = jest.fn();
      const renderer = renderBar({ aiAction: { label: "CineMatch", onPress }, onSelect });
      act(() => { findAi(renderer).props.onClick(); });
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("simgesi vurgu renginde ve çubuk yüksekliğinde bir daire içinde durur", () => {
      const renderer = renderBar({ aiAction: { label: "CineMatch", onPress: jest.fn() } });
      const icon = findAi(renderer).find((node) => node.type === "i");
      expect(icon.props["data-icon"]).toBe("sparkles");
      expect(icon.props["data-color"]).toBe(darkTheme.accent);
      const shadow = renderer.root.find((node) => node.props["data-testid"] === "tab-bar-ai-shadow");
      expect(shadow.props.style[1]).toMatchObject({
        width: defaultLayout.height,
        height: defaultLayout.height,
        borderRadius: defaultLayout.height / 2,
      });
    });

    it("çubukla AYNI cam levhayı kullanır (android-glass'ta iki cam yüzey)", () => {
      mockAndroidGlass = function MockGlass({ testID }) {
        return <div data-testid={testID} />;
      };
      const renderer = renderBar({ aiAction: { label: "CineMatch", onPress: jest.fn() }, mode: "android-glass" });
      expect(renderer.root.findAll((node) => node.props["data-testid"] === "tab-glass-surface")).toHaveLength(2);
      mockAndroidGlass = null;
    });

    it("bulanıklık kipinde de çubuk ve düğme ikisi de bulanık levha çizer", () => {
      const renderer = renderBar({ aiAction: { label: "CineMatch", onPress: jest.fn() } });
      expect(renderer.root.findAll((node) => node.props["data-testid"] === "adaptive-blur-view")).toHaveLength(2);
    });

    it("kaydırınca çubuk ve düğme TEK grup olarak birlikte küçülür", () => {
      const hasTranslateY = (style) => Boolean(style?.transform?.some?.((t) => "translateY" in t));
      let renderer;
      act(() => {
        renderer = create(
          <TabBarLayoutContext.Provider value={{ contentBottom: 110, tabBarCollapse: { value: 1 }, tabBarLastScrollY: { value: -1 }, onTabBarScroll: () => {} }}>
            <TabBar tabs={tabs} activeTab="discover" onSelect={jest.fn()} aiAction={{ label: "CineMatch", onPress: jest.fn() }}
              mode="legacy-blur" layout={defaultLayout} theme={darkTheme} blurTarget={{ current: {} }} reduceMotion={false} onGlassFailure={jest.fn()} />
          </TabBarLayoutContext.Provider>
        );
      });
      // Dönüşümü taşıyan TEK görünüm var ve hem çubuğu hem düğmeyi kapsıyor.
      const scaled = renderer.root.findAll((node) => node.type === "div" && Array.isArray(node.props.style) && node.props.style.some(hasTranslateY));
      expect(scaled).toHaveLength(1);
      expect(scaled[0].findAll((node) => node.props["data-testid"] === "tab-ai").length).toBeGreaterThan(0);
      expect(scaled[0].findAll((node) => node.props["data-testid"] === "tab-discover").length).toBeGreaterThan(0);
    });
  });
});

