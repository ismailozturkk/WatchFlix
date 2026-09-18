import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { I18nManager, StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import { tabBarNativeSupport } from "../../services/tabBarCapabilities";
import { selectionAsync } from "../../services/hapticsService";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { surfaceBlurAppearance } from "../../utils/surfaceBlur";
import { TAB_NAMES } from "../../utils/tabBarModel";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";

const SPRING = { mass: 0.6, damping: 18, stiffness: 220 };
const DRAG_SNAP = { mass: 0.5, damping: 20, stiffness: 260 };
// Pill grow, while the finger is down: quick and slightly lively so it
// reads as an immediate reaction to the touch, not a delayed catch-up.
const DRAG_GROW = { damping: 16, stiffness: 260 };
// Pill shrink, on release: a visible bounce ("sekerek") back to its resting
// size — lower damping than DRAG_GROW so it overshoots slightly on the way
// down instead of just easing to a stop.
const DRAG_RELEASE_BOUNCE = { mass: 0.7, damping: 11, stiffness: 210 };
// Target scale while dragging — X is intentionally allowed to overshoot the
// slot's own width (grows past its edges into the neighboring slots), which
// already reads as "fully filling" the bar horizontally. Y now grows by the
// same proportion so the pill fills just as fully top-to-bottom, using the
// bar's padding as headroom without touching its outer rounded edge.
const DRAG_SCALE_X = 1.24;
const DRAG_SCALE_Y = 1.22;
// How much the bar shrinks/rises at full scroll-collapse (progress = 1).
const COLLAPSE_SCALE_DELTA = 0.15;
const COLLAPSE_TRANSLATE_Y = 8;

class GlassBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function AndroidGlassSurface({ theme, onFailure, cornerRadius = 32 }) {
  const [ready, setReady] = useState(false);
  const Glass = tabBarNativeSupport.AndroidGlass;
  const blur = surfaceBlurAppearance(theme.tab || theme.secondary);
  if (!Glass) return null;
  return (
    <GlassBoundary onFailure={onFailure}>
      <Glass
        testID="tab-glass-surface"
        providerId="seelogd-tabs"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        cornerRadius={cornerRadius}
        tint={alpha(blur.surface, blur.tint === "light" ? 0.26 : 0.32)}
        blurRadius={12}
        refractionHeight={8}
        refractionAmount={5}
        saturation={1.15}
        chromaticAberration={0.025}
        noiseAlpha={0.008}
        highlightAlpha={blur.tint === "light" ? 0.5 : 0.32}
        highlightWidth={0.75}
        onRenderStatus={({ nativeEvent }) => {
          if (nativeEvent.status === "failed") onFailure();
          else if (nativeEvent.status === "ready") setReady(true);
        }}
      />
      {!ready && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, 0.9) }]}
        />
      )}
    </GlassBoundary>
  );
}

const TabButton = memo(function TabButton({ tab, selected, onPress, onReleasePill, theme, modern, reduceMotion, isLight }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const activeColor = theme.accent || (isLight ? "#007AFF" : "#0A84FF");
  const idleColor = theme.text?.secondary || theme.textSecondary || (isLight ? "#636366" : "#8E8E93");

  return (
    <TouchableOpacity
      testID={`tab-${tab.name}`}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected }}
      activeOpacity={1}
      style={styles.tab}
      onPress={() => onPress(tab.name)}
      onPressIn={() => { scale.value = reduceMotion ? 1 : withSpring(0.90, SPRING); }}
      onPressOut={() => {
        scale.value = reduceMotion ? 1 : withSpring(1, SPRING);
        onReleasePill(tab.name);
      }}
    >
      <Animated.View
        style={[styles.tabContent, style]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.iconWrap}>
          <AppIcon
            family={tab.family}
            name={selected ? tab.icon : (tab.iconOutline || tab.icon)}
            size={25}
            color={selected ? activeColor : idleColor}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function TabBar({
  tabs,
  activeTab,
  onSelect,
  mode,
  layout,
  theme,
  blurTarget,
  reduceMotion,
  onGlassFailure,
}) {
  const modern = mode === "android-glass";
  const isLight = isLightSurface(theme.primary);
  const blur = surfaceBlurAppearance(theme.tab || theme.secondary);
  const { tabBarCollapse } = useTabBarLayout();
  const index = TAB_NAMES.indexOf(activeTab);
  const visualIndex = I18nManager.isRTL ? TAB_NAMES.length - 1 - index : index;
  const targetX = visualIndex * layout.slotWidth;
  const offset = useSharedValue(targetX);
  const pillScaleX = useSharedValue(1);
  const pillScaleY = useSharedValue(1);
  const previousWidth = useRef(layout.width);
  const isDragging = useRef(false);
  // Set by the gesture the instant ANY touch lands on the bar (tap or drag
  // alike — see onBegin below); consumed by the very next "position & fluid
  // expansion" effect run (see there for why this exists — it's not just
  // isDragging.current racing the commit).
  const suppressNextPulse = useRef(false);
  // True after the first commit — skips the pulse/position animation on the
  // very first render, so nothing animates unprompted on app launch.
  const hasMounted = useRef(false);
  const hoverIndex = useSharedValue(visualIndex);
  const dragActive = useSharedValue(false);

  const setDraggingFlag = useCallback((value) => {
    isDragging.current = value;
  }, []);

  // Light haptic tick while the finger crosses into a new tab's slot during
  // the drag — purely tactile feedback. The actual screen switch is
  // deliberately deferred to release (see the gesture's onEnd below): if it
  // fired on every crossed slot, a fast swipe across all 5 tabs would mount
  // and tear down 5 screens in a fraction of a second, which is both wasted
  // work and the real reason the drag used to feel unstable.
  const pulseHaptic = useCallback(() => {
    selectionAsync().catch(() => {});
  }, []);

  // Suppression is set HERE — at the moment a switch actually commits, and
  // only when the target genuinely differs from the current tab — not back
  // in onBegin for every touch. It used to be unconditional in onBegin,
  // which seemed simpler, but broke exactly the cases where the touch never
  // changes the tab (pressing the already-active tab, or dragging back to
  // where you started): the reducer no-ops the dispatch, `activeTab` never
  // changes, so the "position & pulse" effect below never re-runs to
  // consume the flag — it stayed stuck true until some LATER, unrelated
  // programmatic tab change (e.g. a deep link), and that legitimate change
  // would then have its `offset` spring skipped entirely, leaving the pill
  // stranded at the old position while the icons/labels already showed the
  // new tab selected.
  const commitDragSelection = useCallback((visualIdx) => {
    const idx = I18nManager.isRTL ? TAB_NAMES.length - 1 - visualIdx : visualIdx;
    const targetTab = TAB_NAMES[idx];
    if (!targetTab) return;
    if (targetTab !== activeTab) {
      suppressNextPulse.current = true;
    }
    onSelect(targetTab);
  }, [onSelect, activeTab]);

  // Reliable safety net for the pill shrink-back on a plain tap. The
  // gesture's own onBegin already grows it reliably on touch-down, but once
  // the underlying TouchableOpacity claims a stationary tap, the gesture's
  // onEnd/onFinalize don't consistently fire afterward — which is exactly
  // why the pill was getting stuck grown. A TabButton's onPressOut, by
  // contrast, ALWAYS fires on release (that's what it's for) and fires
  // BEFORE onPress, so it's used here as both the guaranteed path back to
  // resting size AND (see commitDragSelection above for why) the correctly
  // conditioned place to suppress the tap-driven pulse effect.
  const releasePill = useCallback((tabName) => {
    if (isDragging.current) return; // an active drag already owns the pill.
    const idx = TAB_NAMES.indexOf(tabName);
    if (idx < 0) return;
    const visualIdx = I18nManager.isRTL ? TAB_NAMES.length - 1 - idx : idx;
    const slotWidth = layout.slotWidth || 1;
    if (tabName !== activeTab) {
      suppressNextPulse.current = true;
    }
    offset.value = withSpring(visualIdx * slotWidth, DRAG_SNAP);
    pillScaleX.value = withSpring(1, DRAG_RELEASE_BOUNCE);
    pillScaleY.value = withSpring(1, DRAG_RELEASE_BOUNCE);
  }, [layout.slotWidth, activeTab]);

  // Scroll-driven grow/shrink — continuous, derived straight from the
  // shared collapse-progress value written by whichever screen is scrolling
  // (see AdaptiveTabShell/usePullToRefresh/useTabBarScrollSync). Because
  // it's read every frame off a shared value instead of an effect toggling
  // between two fixed states, the bar keeps resizing for exactly as long as
  // the scroll gesture continues, in either direction.
  const collapseAnimatedStyle = useAnimatedStyle(() => {
    const progress = tabBarCollapse?.value ?? 0;
    const scale = 1 - progress * COLLAPSE_SCALE_DELTA;
    const translateY = progress * COLLAPSE_TRANSLATE_Y;
    return { transform: [{ scale }, { translateY }] };
  });

  // Tab position & fluid expansion animation — the fallback path for
  // whatever changes `activeTab` WITHOUT any touch on this bar at all (deep
  // links, programmatic navigation, an accessibility "activate" from
  // VoiceOver/TalkBack). A touch-driven change that lands on a DIFFERENT tab
  // — tap or drag alike — sets suppressNextPulse right when it commits (see
  // commitDragSelection and releasePill above) precisely so it does NOT also
  // land here:
  //
  // A drag/tap release changes `activeTab`, which re-runs this same effect
  // — but by then the gesture/button has already sprung `offset`/
  // `pillScaleX`/`pillScaleY` to exactly where they need to be. Without the
  // suppress flag, this effect would fire on top of that: `isDragging.current`
  // is already false by the time React gets around to running it (cleared by
  // onFinalize's runOnJS, processed before this effect is even scheduled),
  // so its own guard can't catch this case. The result was two springs
  // fighting over the same shared values — pillScaleX and pillScaleY landing
  // at different points depending on which spring's callback happened to
  // run last, and a chain of restarted springs that could take several
  // seconds to finally settle.
  //
  // The suppress flag is set ONLY when the touch actually lands on a
  // different tab — not unconditionally on every touch — because pressing
  // the already-active tab (or dragging back to where you started) makes
  // the reducer no-op the dispatch: `activeTab` never changes, this effect
  // never re-runs, and an unconditional flag would then sit stuck true
  // until some LATER, unrelated external tab change silently ate its
  // animation (the pill would snap to the new tab's position with no
  // spring, or even not move at all if that change also skipped the
  // isDragging branch — see the git history if this regresses again).
  //
  // The very first run (app launch) is also skipped outright: nothing was
  // touched, so nothing should animate — it should just render at rest.
  useEffect(() => {
    const resized = previousWidth.current !== layout.width;
    previousWidth.current = layout.width;
    const suppressPulse = suppressNextPulse.current;
    suppressNextPulse.current = false;
    const firstRun = !hasMounted.current;
    hasMounted.current = true;
    if (firstRun) return;
    if (!isDragging.current && !suppressPulse) {
      offset.value = reduceMotion || resized ? targetX : withSpring(targetX, SPRING);
    }
    if (!reduceMotion && !resized && !isDragging.current && !suppressPulse) {
      pillScaleX.value = withSpring(1.20, { damping: 12, stiffness: 240 }, () => {
        pillScaleX.value = withSpring(1, SPRING);
      });
      pillScaleY.value = withSpring(1.08, { damping: 12, stiffness: 240 }, () => {
        pillScaleY.value = withSpring(1, SPRING);
      });
    }
  }, [targetX, layout.width, reduceMotion]);

  // Press, drag and release — a single gesture, a single state machine, so
  // a plain tap and a full drag-across-tabs produce the exact same motion
  // instead of two separately-tuned systems that could fight each other.
  //
  // Built entirely on the UI thread with Gesture Handler + Reanimated
  // worklets, so the pill tracks the finger with zero bridge hops.
  //
  // Key design points:
  //  1. `event.x` is the touch position, but the pill is a slotWidth-wide
  //     box positioned by its LEFT edge — using the raw touch x as that left
  //     edge put the pill's visual center half a slot to the right of the
  //     finger. Subtracting half a slot width centers the pill exactly under
  //     the touch point instead.
  //  2. onBegin fires for EVERY touch on the bar — tap or drag, before
  //     either is distinguished — and immediately grows the pill onto
  //     whichever slot was touched. It stays grown for as long as contact
  //     is held (a plain tap and a long-press both look identical while the
  //     finger is down). This is also why the tab-switch itself no longer
  //     happens mid-drag: every slot the finger used to cross dispatched a
  //     real tab change, so a fast swipe across all 5 tabs mounted/tore
  //     down 5 screens in a fraction of a second — that work competing with
  //     the gesture is what actually made dragging feel janky. Now onUpdate
  //     only ever repositions the (already-grown) pill preview.
  //  3. onEnd always bounces the pill back to its resting size and snaps it
  //     to wherever the finger ended up — for both a tap and a drag alike.
  //     It only actually COMMITS the tab switch itself when a real drag
  //     happened (dragActive, set in onStart, which only fires once the
  //     touch has moved); for a plain tap, the tab button's own onPress
  //     already commits the switch (and remains the only path an
  //     accessibility "activate" from VoiceOver/TalkBack goes through,
  //     since that never generates a real touch for this gesture to see).
  const dragSlotWidth = layout.slotWidth || 1;
  const dragPadding = layout.padding || 5;
  const dragMaxOffset = (TAB_NAMES.length - 1) * dragSlotWidth;
  const dragCenterOffset = dragPadding + dragSlotWidth / 2;

  const panGesture = Gesture.Pan()
    // Only claims the RESPONDER past a 6px horizontal move, so plain taps
    // still reach the tab button's own TouchableOpacity underneath — this
    // gate is unrelated to onBegin below, which fires on touch-down either
    // way and doesn't require the gesture to have activated.
    .activeOffsetX([-6, 6])
    .onBegin((event) => {
      const clampedX = Math.max(0, Math.min(dragMaxOffset, event.x - dragCenterOffset));
      const rawIndex = Math.round(clampedX / dragSlotWidth);
      const clampedIndex = Math.max(0, Math.min(TAB_NAMES.length - 1, rawIndex));
      hoverIndex.value = clampedIndex;
      // Position uses DRAG_SNAP (well-damped, no visible overshoot), not
      // DRAG_GROW — DRAG_GROW is deliberately underdamped for a lively
      // scale-up, but the same looseness on the X position read as an
      // excessive horizontal back-and-forth wobble.
      offset.value = withSpring(clampedIndex * dragSlotWidth, DRAG_SNAP);
      if (!reduceMotion) {
        pillScaleX.value = withSpring(DRAG_SCALE_X, DRAG_GROW);
        pillScaleY.value = withSpring(DRAG_SCALE_Y, DRAG_GROW);
      }
    })
    .onStart(() => {
      // Only reached once the touch has actually moved — a real drag, not
      // a stationary press. onBegin above already did the growing.
      dragActive.value = true;
      runOnJS(setDraggingFlag)(true);
    })
    .onUpdate((event) => {
      const clampedX = Math.max(0, Math.min(dragMaxOffset, event.x - dragCenterOffset));
      offset.value = clampedX;

      const rawIndex = Math.round(clampedX / dragSlotWidth);
      const clampedIndex = Math.max(0, Math.min(TAB_NAMES.length - 1, rawIndex));
      if (clampedIndex !== hoverIndex.value) {
        hoverIndex.value = clampedIndex;
        runOnJS(pulseHaptic)();
      }
    })
    .onEnd(() => {
      // Always bounce back to resting size and snap to wherever the finger
      // ended up, whether this was a tap or a drag.
      offset.value = withSpring(hoverIndex.value * dragSlotWidth, DRAG_SNAP);
      pillScaleX.value = withSpring(1, DRAG_RELEASE_BOUNCE);
      pillScaleY.value = withSpring(1, DRAG_RELEASE_BOUNCE);
      // Only the gesture itself commits the switch for a genuine drag — a
      // plain tap's commit comes from the tab button's own onPress instead,
      // so this must not fire twice for the same touch.
      if (dragActive.value) {
        runOnJS(commitDragSelection)(hoverIndex.value);
      }
    })
    .onFinalize(() => {
      dragActive.value = false;
      runOnJS(setDraggingFlag)(false);
    });

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { scaleX: pillScaleX.value },
      { scaleY: pillScaleY.value },
    ],
  }));

  const barRadius = layout.barRadius || (layout.height / 2);
  const gap = layout.padding ?? 5;
  const indicatorWidth = layout.indicatorWidth || Math.max(36, layout.slotWidth - 4);
  const indicatorHeight = layout.indicatorHeight || (layout.height - gap * 2);
  // Concentric nested border-radius: R_inner = R_outer - spacing
  const indicatorRadius = layout.indicatorRadius !== undefined ? layout.indicatorRadius : Math.max(0, barRadius - gap);

  // Active pill indicator colors (subtle translucent highlight as seen in modern Liquid Glass)
  const pillBg = isLight ? "rgba(0, 0, 0, 0.06)" : alpha(theme.accent, 0.20);
  const pillBorder = isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.14)";
  const pillGradients = isLight
    ? [alpha("#ffffff", 0.75), alpha("#e5e5ea", 0.45)]
    : [alpha(theme.accent, 0.26), alpha(theme.accent, 0.10)];

  return (
    <View pointerEvents="box-none" testID={`tab-bar-${mode}`} style={[styles.position, { bottom: layout.bottom }]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.shadow,
            {
              width: layout.width,
              height: layout.height,
              borderRadius: barRadius,
              shadowColor: theme.shadow || "#000000",
              shadowOpacity: isLight ? 0.12 : 0.35,
            },
            collapseAnimatedStyle,
          ]}
        >
          <View
            style={[
              styles.glassContainer,
              {
                height: layout.height,
                borderRadius: barRadius,
                borderColor: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.16)",
              },
            ]}
          >
            {modern ? (
              <AndroidGlassSurface theme={theme} onFailure={onGlassFailure} cornerRadius={barRadius} />
            ) : mode === "legacy-solid" ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, blur.fallbackAlpha) }]}
              />
            ) : (
              <AdaptiveBlurView
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                tint={blur.tint}
                intensity={blur.intensity}
                blurTarget={blurTarget}
                fallbackColor={blur.surface}
                fallbackAlpha={blur.fallbackAlpha}
              >
                <View
                  style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, blur.overlayAlpha) }]}
                />
              </AdaptiveBlurView>
            )}

            {/* Specular top highlight reflection */}
            <LinearGradient
              pointerEvents="none"
              colors={[alpha("#ffffff", isLight ? 0.32 : 0.12), alpha("#ffffff", 0)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 0.55 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Sliding active pill indicator */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  left: layout.padding,
                  top: layout.padding,
                  width: layout.slotWidth,
                  height: indicatorHeight,
                },
                indicatorStyle,
              ]}
            >
              <View
                style={[
                  styles.indicatorPill,
                  {
                    width: indicatorWidth,
                    height: indicatorHeight,
                    borderRadius: indicatorRadius,
                    backgroundColor: pillBg,
                    borderColor: pillBorder,
                  },
                ]}
              >
                <LinearGradient
                  colors={pillGradients}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </Animated.View>

            {/* Tab items */}
            <View style={[styles.items, { padding: layout.padding }]}>
              {tabs.map((tab) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  selected={activeTab === tab.name}
                  onPress={onSelect}
                  onReleasePill={releasePill}
                  theme={theme}
                  modern={modern}
                  reduceMotion={reduceMotion}
                  isLight={isLight}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 10,
  },
  glassContainer: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  items: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  tab: { flex: 1, height: "100%", justifyContent: "center", alignItems: "center" },
  tabContent: { alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  indicator: { position: "absolute", alignItems: "center", justifyContent: "center" },
  indicatorPill: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});
