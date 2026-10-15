// components/cineswipe/PressableScale.js
//
// Basınca yaylanarak küçülen Pressable. CineSwipe'taki tüm butonların ortak
// dokunuş geri bildirimi (eski TouchableOpacity yalnız solukluyordu).
import React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 14, stiffness: 240 };

export default function PressableScale({
  style,
  scaleTo = 0.94,
  disabled = false,
  onPressIn,
  onPressOut,
  children,
  ...rest
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
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
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
