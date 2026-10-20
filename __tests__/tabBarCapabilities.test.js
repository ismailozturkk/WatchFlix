import { resolveTabBarMode } from "../utils/tabBarCapabilities";

describe("TabBarCapabilities - Mode Resolution Matrix", () => {
  const baseSupported = {
    platform: "android",
    apiLevel: 33,
    accessibilityReady: true,
    androidGlassAvailable: true,
    hasBlurTarget: true,
    effectMode: "full",
  };

  describe("iOS resolutions", () => {
    it("enables native-ios for iOS 18+ when nativeTabsAvailable is true", () => {
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "18.0", nativeTabsAvailable: true })).toBe("native-ios");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "18.3", nativeTabsAvailable: true })).toBe("native-ios");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: 18, nativeTabsAvailable: true })).toBe("native-ios");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "19.1", nativeTabsAvailable: true })).toBe("native-ios");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "26.0", nativeTabsAvailable: true })).toBe("native-ios");
    });

    it("falls back to legacy-blur for iOS < 18 or when nativeTabsAvailable is false", () => {
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "17.6", nativeTabsAvailable: true })).toBe("legacy-blur");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "16.1", nativeTabsAvailable: true })).toBe("legacy-blur");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "18.0", nativeTabsAvailable: false })).toBe("legacy-blur");
    });
  });

  describe("Android resolutions", () => {
    it("enables android-glass for Android API >= 33 when shader is available", () => {
      expect(resolveTabBarMode(baseSupported)).toBe("android-glass");
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 34 })).toBe("android-glass");
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 35 })).toBe("android-glass");
    });

    it("falls back to legacy-blur when shader is missing on API 33+", () => {
      expect(resolveTabBarMode({ ...baseSupported, androidGlassAvailable: false })).toBe("legacy-blur");
    });

    it("falls back to legacy-blur on API 31-32 with blur target", () => {
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 31 })).toBe("legacy-blur");
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 32 })).toBe("legacy-blur");
    });

    it("falls back to legacy-solid on API <= 30", () => {
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 30 })).toBe("legacy-solid");
      expect(resolveTabBarMode({ ...baseSupported, apiLevel: 28 })).toBe("legacy-solid");
    });
  });

  describe("Accessibility & failure fallbacks", () => {
    it("falls back to legacy-solid when reduceTransparency is enabled", () => {
      expect(resolveTabBarMode({ ...baseSupported, reduceTransparency: true })).toBe("legacy-solid");
      expect(resolveTabBarMode({ ...baseSupported, platform: "ios", apiLevel: "18.0", nativeTabsAvailable: true, reduceTransparency: true })).toBe("legacy-solid");
    });

    it("falls back to legacy-solid when highContrast is enabled", () => {
      expect(resolveTabBarMode({ ...baseSupported, highContrast: true })).toBe("legacy-solid");
    });

    it("falls back to legacy-solid when effectMode is off", () => {
      expect(resolveTabBarMode({ ...baseSupported, effectMode: "off" })).toBe("legacy-solid");
    });

    it("falls back to legacy-blur when effectMode is balanced", () => {
      expect(resolveTabBarMode({ ...baseSupported, effectMode: "balanced" })).toBe("legacy-blur");
    });

    it("falls back gracefully when rendererFailed is true", () => {
      expect(resolveTabBarMode({ ...baseSupported, rendererFailed: true })).toBe("legacy-blur");
      expect(resolveTabBarMode({ ...baseSupported, rendererFailed: true, hasBlurTarget: false })).toBe("legacy-solid");
    });
  });
});
