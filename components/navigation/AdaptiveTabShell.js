import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { ActivityIndicator, I18nManager, InteractionManager, Keyboard, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Screen, ScreenContainer, Tabs } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { BlurTargetSurface, BLUR_SCOPES, useBlurTargetRef } from "../common/BlurTarget";
import { TabBarLayoutContext } from "../../context/TabBarLayoutContext";
import { tabBarNativeSupport, useTabBarCapabilities } from "../../services/tabBarCapabilities";
import { AI_ACTION, TAB_NAMES, createTabState, getAiButtonCenter, getTabBarLayout, isTabName, tabStateReducer } from "../../utils/tabBarModel";
import { isLightSurface } from "../../utils/colorUtils";
import { selectionAsync } from "../../services/hapticsService";
import { TAB_BAR_SCROLL_UNSET, advanceTabBarCollapse } from "../../utils/tabBarCollapse";
import { nativeTabBarScaleAvailable } from "../../services/tabBarScale";
import useAppActive from "../../hooks/useAppActive";
import NativeTabBarScale from "./NativeTabBarScale";
import TabBar from "./TabBar";

const AndroidBackdrop = tabBarNativeSupport.AndroidBackdrop;
const NO_RESELECT_EFFECTS = { repeatedTabSelection: { popToRoot: false, scrollToTop: false } };

class NativeHostBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Yerel iOS çubuğundaki yapay zeka öğesinin içeriği: öğe asla seçilmez
// (`preventNativeSelection`), bu yüzden sahne hiç görünmez; boş bir görünüm yeter.
const AI_SCENE = <View />;

// The scene container stays fixed. Only the native bar visibility and overlay
// change; effect/accessibility preferences never remount screen state.
//
// `onAiPress` (isteğe bağlı): çubuğun yanındaki AYRIK yuvarlak yapay zeka düğmesi.
// Bir sekme değildir — dokununca `onAiPress(origin)` çağrılır (origin: sohbetin
// büyüyerek açılacağı ekran noktası), hiçbir sekme seçilmez. Verilmezse düğme yoktur.
//   • iOS yerel çubuk: `systemItem: "search"` sekmesi iOS 26'da sistemin kendi AYRIK
//     yuvarlak cam düğmesi olarak çizilir (çubukla aynı hizada). iOS 18–25'te sıradan
//     bir son öğe gibi görünür ama yine seçilmez, yalnız sohbeti açar.
//   • JS çubuğu (Android cam / bulanıklık / düz): TabBarAiButton, çubukla aynı levha.
export default function AdaptiveTabShell({ navigation, route, tabs, screens, theme, renderCompanion, onAiPress, aiLabel }) {
  const [state, dispatch] = useReducer(tabStateReducer, route?.params?.initialTab, createTabState);
  const [rendererFailed, setRendererFailed] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const appActive = useAppActive();
  const blurTarget = useBlurTargetRef(BLUR_SCOPES.screen);
  const { mode, reduceMotion } = useTabBarCapabilities({ hasBlurTarget: Boolean(blurTarget), rendererFailed });
  const layout = useMemo(() => getTabBarLayout({ width, bottomInset: insets.bottom, mode }), [width, insets.bottom, mode]);

  // Continuous 0..1 progress instead of a minimized/expanded flag — the bar
  // keeps resizing for as long as the scroll gesture continues, in whatever
  // direction it's going, rather than snapping between two fixed sizes once
  // a threshold is crossed. Every tab screen feeds its offset through the
  // same function (directly via onScroll, or from usePullToRefresh's
  // worklet with zero bridge hops), so the behavior is identical everywhere.
  const tabBarCollapse = useSharedValue(0);
  const lastScrollY = useSharedValue(TAB_BAR_SCROLL_UNSET);
  const onTabBarScroll = useCallback((offsetY) => {
    advanceTabBarCollapse(tabBarCollapse, lastScrollY, offsetY);
  }, []);

  const layoutContextValue = useMemo(() => ({
    ...layout,
    tabBarCollapse,
    // Exposed alongside the JS-callable onTabBarScroll so a worklet-driven
    // scroll handler (usePullToRefresh) can call advanceTabBarCollapse
    // directly on the UI thread — no runOnJS/bridge hop needed.
    tabBarLastScrollY: lastScrollY,
    onTabBarScroll,
  }), [layout, onTabBarScroll]);

  // Each tab screen tracks its own scroll position independently; switching
  // tabs must not carry over the previous screen's offset into the delta
  // calculation (that would read as a huge, spurious scroll and could
  // instantly re-collapse a freshly opened tab). Always land expanded.
  //
  // The reset uses the "unset" sentinel, not a real 0 — a frozen (not
  // unmounted) screen keeps its actual native scroll position, so if it was
  // scrolled deep down, the true next offset could be far from 0. The
  // sentinel tells advanceTabBarCollapse to just record that real position
  // as the new baseline on the next scroll event, instead of computing a
  // delta against a false "0" and instantly slamming the bar shut.
  useEffect(() => {
    lastScrollY.value = TAB_BAR_SCROLL_UNSET;
    tabBarCollapse.value = reduceMotion ? 0 : withTiming(0, { duration: 200 });
  }, [state.activeTab, reduceMotion]);

  useEffect(() => {
    const show = () => setKeyboardVisible(true);
    const hide = () => setKeyboardVisible(false);
    const subs = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", hide),
    ];
    if (Platform?.OS === "ios") {
      subs.push(
        Keyboard.addListener("keyboardWillShow", show),
        Keyboard.addListener("keyboardWillHide", hide)
      );
    }
    return () => { subs.forEach((s) => s.remove?.()); };
  }, []);
  useEffect(() => {
    const requested = route?.params?.initialTab;
    if (requested === "debug") {
      navigation.setParams({ initialTab: undefined });
      navigation.navigate("UsageDebugScreen");
    } else if (isTabName(requested)) {
      dispatch({ type: "select", name: requested });
      navigation.setParams({ initialTab: undefined });
    }
  }, [route?.params?.initialTab, navigation]);
  useEffect(() => {
    const timers = [];
    const task = InteractionManager.runAfterInteractions(() => {
      TAB_NAMES.filter((name) => name !== "discover").forEach((name, index) => {
        timers.push(setTimeout(() => dispatch({ type: "warm", name }), 6000 + 1200 * index));
      });
    });
    return () => { task.cancel?.(); timers.forEach(clearTimeout); };
  }, []);

  const onSelect = useCallback((name) => {
    if (!isTabName(name)) return;
    selectionAsync().catch(() => {});
    dispatch({ type: "select", name });
  }, []);
  const onNativeSelect = useCallback(({ nativeEvent }) => dispatch({ type: "native", event: nativeEvent }), []);
  const onNativeRejected = useCallback(({ nativeEvent }) => dispatch({ type: "native", event: nativeEvent, rejected: true }), []);
  const onGlassFailure = useCallback(() => setRendererFailed(true), []);
  const nativeBarVisible = mode === "native-ios" && !keyboardVisible;

  // Yapay zeka düğmesi: iki yoldan (JS düğmesi / yerel öğenin "seçimi engellendi"
  // olayı) AYNI işleve gelir. Sekme durumuna dokunmaz.
  const aiCenter = useMemo(
    () => getAiButtonCenter({ width, height, layout, mode, bottomInset: insets.bottom, rtl: I18nManager.isRTL }),
    [width, height, layout, mode, insets.bottom],
  );
  const openAi = useCallback(() => {
    selectionAsync().catch(() => {});
    onAiPress?.(aiCenter);
  }, [onAiPress, aiCenter]);
  const onNativePrevented = useCallback(({ nativeEvent }) => {
    if (nativeEvent?.preventedScreenKey === AI_ACTION.key) openAi();
  }, [openAi]);
  const aiAction = useMemo(
    () => (onAiPress ? { label: aiLabel || "CineMatch", onPress: openAi } : null),
    [onAiPress, aiLabel, openAi],
  );
  // iOS 26+ with the tab-bar-scale module in the binary: the real UIKit bar is
  // scaled 20% by the shared scroll progress (NativeTabBarScale), so the
  // system's own minimize is switched off — two shrink effects would stack.
  // Without the module (older build, Expo Go, iOS < 26) nothing changes:
  // the system minimize stays on exactly as before.
  const nativeScaleActive = mode === "native-ios" && nativeTabBarScaleAvailable;
  const useNativeScenes = tabBarNativeSupport.nativeTabsAvailable && !rendererFailed;
  const dark = !isLightSurface(theme.primary);
  const idleColor = theme.text?.secondary || "#888888";
  const itemAppearance = {
    normal: { tabBarItemIconColor: idleColor, tabBarItemTitleFontColor: idleColor },
    selected: { tabBarItemIconColor: theme.accent, tabBarItemTitleFontColor: theme.accent },
  };
  const appearance = { stacked: itemAppearance, inline: itemAppearance, compactInline: itemAppearance };
  // `scrollEdgeAppearance` DA aynı verilir: sekme ekranlarının kaydırma görünümü
  // TabScrollMarker ile UIKit'e tanıtılınca çubuk, içerik kenara dayandığında bu
  // görünüme geçer. Verilmezse sistem varsayılanı (şeffaf arka plan + sistem
  // renkleri) devreye girer ve liste sonunda vurgu/pasif simge renkleri kaybolur.

  const fallbackScenes = (
    <ScreenContainer style={styles.fill} hasTwoStates>
      {tabs.map((tab) => state.mountedTabs.has(tab.name) ? (
        <Screen key={tab.name} activityState={state.activeTab === tab.name ? 2 : 0} freezeOnBlur shouldFreeze={state.activeTab !== tab.name} style={styles.scene}>
          {screens[tab.name]}
        </Screen>
      ) : null)}
    </ScreenContainer>
  );

  return (
    <TabBarLayoutContext.Provider value={layoutContextValue}>
      <View testID="adaptive-tab-shell" style={[styles.fill, { backgroundColor: theme.primary }]}>
        <AndroidBackdrop providerId="seelogd-tabs" recordingEnabled={mode === "android-glass" && appActive && !keyboardVisible} style={styles.fill}>
          <BlurTargetSurface name={BLUR_SCOPES.screen} style={styles.fill} collapsable={false}>
            {useNativeScenes ? (
              <NativeHostBoundary fallback={fallbackScenes} onFailure={onGlassFailure}>
                <Tabs.Host navStateRequest={{ selectedScreenKey: state.activeTab, baseProvenance: state.provenance }}
                  rejectStaleNavStateUpdates onTabSelected={onNativeSelect} onTabSelectionRejected={onNativeRejected}
                  onTabSelectionPrevented={onNativePrevented}
                  tabBarHidden={!nativeBarVisible} colorScheme={dark ? "dark" : "light"}
                  direction={I18nManager.isRTL ? "rtl" : "ltr"} nativeContainerStyle={{ backgroundColor: theme.primary }}
                  ios={{ tabBarTintColor: theme.accent, tabBarMinimizeBehavior: nativeScaleActive ? "never" : "onScrollDown", tabBarControllerMode: "tabBar" }}>
                  {tabs.map((tab) => (
                    <Tabs.Screen key={tab.name} screenKey={tab.name} title={tab.label} tabBarItemAccessibilityLabel={tab.label}
                      tabBarItemTestID={`tab-${tab.name}`} specialEffects={NO_RESELECT_EFFECTS}
                      nativeContainerStyle={{ backgroundColor: theme.primary }}
                      ios={{ icon: { type: "sfSymbol", name: tab.sf }, selectedIcon: { type: "sfSymbol", name: tab.selectedSf }, standardAppearance: appearance, scrollEdgeAppearance: appearance, overrideScrollViewContentInsetAdjustmentBehavior: false }}>
                      {state.mountedTabs.has(tab.name) ? screens[tab.name] : <View style={styles.loading}><ActivityIndicator color={theme.accent} /></View>}
                    </Tabs.Screen>
                  ))}
                  {/* Yapay zeka: SON öğe (iOS 26'da sistemin ayrık yuvarlak cam düğmesi).
                      `preventNativeSelection` ile hiçbir zaman seçilmez; dokunuş
                      `onTabSelectionPrevented` olarak gelir ve sohbeti açar. */}
                  {aiAction ? (
                    <Tabs.Screen key={AI_ACTION.key} screenKey={AI_ACTION.key} title={aiAction.label}
                      tabBarItemAccessibilityLabel={aiAction.label} tabBarItemTestID={`tab-${AI_ACTION.key}`}
                      preventNativeSelection specialEffects={NO_RESELECT_EFFECTS}
                      nativeContainerStyle={{ backgroundColor: theme.primary }}
                      ios={{ systemItem: "search", icon: { type: "sfSymbol", name: AI_ACTION.sf }, standardAppearance: appearance, scrollEdgeAppearance: appearance, overrideScrollViewContentInsetAdjustmentBehavior: false }}>
                      {AI_SCENE}
                    </Tabs.Screen>
                  ) : null}
                </Tabs.Host>
              </NativeHostBoundary>
            ) : (
              fallbackScenes
            )}
          </BlurTargetSurface>
        </AndroidBackdrop>
        <View
          pointerEvents={keyboardVisible ? "none" : "box-none"}
          style={[styles.companionLayer, keyboardVisible && styles.hiddenCompanion]}
        >
          {renderCompanion?.(layout)}
        </View>
        {nativeScaleActive && <NativeTabBarScale progress={tabBarCollapse} />}
        {!nativeBarVisible && !keyboardVisible && (
          <TabBar
            tabs={tabs}
            activeTab={state.activeTab}
            onSelect={onSelect}
            aiAction={aiAction}
            mode={mode}
            layout={layout}
            theme={theme}
            blurTarget={blurTarget}
            reduceMotion={reduceMotion}
            onGlassFailure={onGlassFailure}
          />
        )}
      </View>
    </TabBarLayoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, scene: { ...StyleSheet.absoluteFill },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  companionLayer: { zIndex: 30 },
  hiddenCompanion: { opacity: 0 },
});
