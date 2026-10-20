import { resolveBlurPlan } from "./blurSupport";

export function resolveTabBarMode({
  platform, apiLevel, effectMode = "full", accessibilityReady = false,
  reduceTransparency = false, highContrast = false, nativeTabsAvailable = false,
  iosGlassAvailable = false, androidGlassAvailable = false, rendererFailed = false,
  hasBlurTarget = false,
} = {}) {
  const solid = effectMode === "off" || reduceTransparency || highContrast || !accessibilityReady;
  if (!solid && !rendererFailed && effectMode === "full") {
    const iosVersion = Number.parseInt(String(apiLevel), 10) || 0;
    if (platform === "ios" && iosVersion >= 18 && nativeTabsAvailable) return "native-ios";
    if (platform === "android" && typeof apiLevel === "number" && apiLevel >= 33 && androidGlassAvailable) return "android-glass";
  }
  const blur = resolveBlurPlan({ platform, apiLevel, blurEnabled: !solid, hasTarget: hasBlurTarget });
  return blur.native ? "legacy-blur" : "legacy-solid";
}
