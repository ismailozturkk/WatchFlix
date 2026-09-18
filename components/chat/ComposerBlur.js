import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import { androidSupportsNativeBlur } from "../../utils/blurSupport";
import { surfaceBlurAppearance } from "../../utils/surfaceBlur";
import { alpha } from "../../theme/colors";

// Keep each chat's target local: stacked chats and AI modals can coexist.
export function useComposerBlurTarget() {
  const [node, attach] = useState(null);
  const target = useMemo(() => (node ? { current: node } : null), [node]);
  return { attach, target };
}

export function ComposerBlurTarget({ attach, backgroundColor, children, ...props }) {
  // The background must be INSIDE the native target: the target host's own
  // background is not part of the recorded message content on Android.
  const content = <View style={{ flexGrow: 1, flexShrink: 1, backgroundColor }}>{children}</View>;
  return Platform.OS === "android" && androidSupportsNativeBlur(Platform.Version)
    ? <BlurTargetView ref={attach} {...props}>{content}</BlurTargetView>
    : <View {...props}>{content}</View>;
}

export default function ComposerBlur({ target, theme, radius = 28 }) {
  const appearance = surfaceBlurAppearance(theme.secondary);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: "hidden" }]}>
      <AdaptiveBlurView
        blurTarget={target}
        intensity={appearance.intensity}
        tint={appearance.tint}
        fallbackColor={appearance.surface}
        fallbackAlpha={appearance.fallbackAlpha}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: alpha(appearance.surface, appearance.overlayAlpha) }]} />
    </View>
  );
}
