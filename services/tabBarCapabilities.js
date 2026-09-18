import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Platform, UIManager, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useEffectMode } from "./effectSettings";
import { resolveTabBarMode } from "../utils/tabBarCapabilities";

function inspectNativeSupport() {
  const result = { nativeTabsAvailable: false, iosGlassAvailable: false, androidGlassAvailable: false, AndroidBackdrop: View, AndroidGlass: null };
  try {
    if (Platform.OS === "ios") {
      const iosMajor = Number.parseInt(String(Platform.Version), 10) || 0;
      if (iosMajor >= 15) {
        const hasViewManager = Boolean(
          UIManager.getViewManagerConfig?.("RNSTabsHostIOS") ||
          UIManager.hasViewManagerConfig?.("RNSTabsHostIOS") ||
          global.__turboModuleProxy
        );
        result.nativeTabsAvailable = hasViewManager;
      }
      const glass = requireOptionalNativeModule("ExpoGlassEffect");
      result.iosGlassAvailable = Boolean(glass?.isLiquidGlassAvailable && glass?.isGlassEffectAPIAvailable);
    } else if (Platform.OS === "android" && Platform.Version >= 33) {
      const glass = requireOptionalNativeModule("ExpoLiquidGlass");
      const provider = requireOptionalNativeModule("ExpoLiquidGlassProvider");
      // This probe is supplied by our checked-in patch. Old binaries do not
      // import the view manager or attempt to draw an unverified shader.
      if (glass?.isShaderAvailable?.() && provider) {
        const kit = require("liquid-glass-kit");
        result.AndroidBackdrop = kit.LiquidGlassProvider;
        result.AndroidGlass = kit.LiquidGlassView;
        result.androidGlassAvailable = true;
      }
    }
  } catch {
    // Missing native modules are expected on development clients predating glass.
  }
  return Object.freeze(result);
}

// Component identities must not change when effects/accessibility change.
export const tabBarNativeSupport = inspectNativeSupport();

export function useTabBarCapabilities({ hasBlurTarget, rendererFailed = false }) {
  const effectMode = useEffectMode();
  const [accessibility, setAccessibility] = useState({ ready: false, reduceMotion: true, reduceTransparency: true, highContrast: false });
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const read = async () => {
      const version = ++generation;
      const values = await Promise.allSettled([
        AccessibilityInfo.isReduceMotionEnabled(),
        Platform.OS === "ios" ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false),
        Platform.OS === "ios" ? AccessibilityInfo.isDarkerSystemColorsEnabled() : AccessibilityInfo.isHighTextContrastEnabled?.() ?? Promise.resolve(false),
      ]);
      if (!alive || version !== generation) return;
      const value = (index, fallback) => values[index].status === "fulfilled" ? Boolean(values[index].value) : fallback;
      setAccessibility({ ready: true, reduceMotion: value(0, true), reduceTransparency: value(1, true), highContrast: value(2, true) });
    };
    const subscriptions = [
      AccessibilityInfo.addEventListener("reduceMotionChanged", read),
      AccessibilityInfo.addEventListener("reduceTransparencyChanged", read),
      AccessibilityInfo.addEventListener("darkerSystemColorsChanged", read),
      AccessibilityInfo.addEventListener("highTextContrastChanged", read),
      AppState.addEventListener("change", (state) => { if (state === "active") read(); }),
    ];
    read();
    return () => { alive = false; subscriptions.forEach((subscription) => subscription.remove()); };
  }, []);
  return {
    mode: resolveTabBarMode({ platform: Platform.OS, apiLevel: Platform.Version, effectMode, accessibilityReady: accessibility.ready, ...accessibility, ...tabBarNativeSupport, hasBlurTarget, rendererFailed }),
    reduceMotion: accessibility.reduceMotion,
  };
}
