// components/cineswipe/PressableScale.js
//
// Basınca yaylanarak küçülen Pressable. CineSwipe'taki tüm butonların ortak
// dokunuş geri bildirimi (eski TouchableOpacity yalnız solukluyordu).
// iOS 26+'da kendi dolgu/çerçeve/köşe stili Liquid Glass'a devredilir
// (useGlassChrome); küçülme `transform` olduğu için cam bozulmaz.
import React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import useGlassChrome from "../common/useGlassChrome";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 14, stiffness: 240 };

export default function PressableScale({
  style,
  scaleTo = 0.94,
  disabled = false,
  glass = true,
  onLayout,
  onPressIn,
  onPressOut,
  children,
  ...rest
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const chrome = useGlassChrome(style, {
    role: "button",
    enabled: glass,
    interactive: true,
    catchTouches: true,
    onLayout,
  });

  return (
    <AnimatedPressable
      {...rest}
      onLayout={chrome ? chrome.onLayout : onLayout}
      disabled={disabled}
      accessibilityState={{ disabled, ...(rest.accessibilityState || {}) }}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(event);
      }}
      style={[chrome ? chrome.style : style, animated]}
    >
      {chrome ? chrome.wrap(children) : children}
    </AnimatedPressable>
  );
}
