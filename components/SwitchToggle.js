import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";

const TOGGLE_SPRING = {
  mass: 0.5,
  damping: 12,
  stiffness: 180,
  overshootClamping: false,
};

const PRESS_SPRING = {
  mass: 0.35,
  damping: 10,
  stiffness: 280,
  overshootClamping: false,
};

export default function SwitchToggle({
  value = false,
  onValueChange = () => {},
  size = 36,
  onColor = "#93ffaae0",
  offColor = "#cacacaad",
  knobColor = "#FFF",
  disabledColor = "#757575ad",
  disabled = false,
}) {
  // Reanimated shared value: represents 0 for off, 1 for on
  const progress = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);

  // Sync state changes from parents to the shared value via Spring animation
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, TOGGLE_SPRING);
  }, [value, progress]);

  const toggle = () => {
    if (!disabled) {
      const nextValue = !value;
      // Anında (optimistic) animasyonu başlat
      progress.value = withSpring(nextValue ? 1 : 0, TOGGLE_SPRING);
      // Daha sonra state'i güncelle (gecikmeyi önler)
      onValueChange(nextValue);
    }
  };

  const handlePressIn = () => {
    if (!disabled) pressed.value = withSpring(1, PRESS_SPRING);
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, PRESS_SPRING);
  };

  // Switch Track style (Background color animation)
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [offColor, onColor]
    );

    return {
      backgroundColor: disabled ? disabledColor : backgroundColor,
      opacity: disabled ? 0.72 : 1,
      transform: [{ scale: 1 - pressed.value * 0.035 }],
    };
  });

  // iOS anahtarı gibi knob hareket sırasında hafifçe uzar; basışta da büyür.
  const knobAnimatedStyle = useAnimatedStyle(() => {
    const translateMax = size * 0.61;
    const clampedProgress = Math.max(0, Math.min(1, progress.value));
    const travelStretch =
      1 + (1 - Math.abs(clampedProgress * 2 - 1)) * 0.13;
    const pressScale = 1 + pressed.value * 0.07;

    return {
      transform: [
        {
          translateX: progress.value * translateMax + 2,
        },
        { scaleX: travelStretch * pressScale },
        { scaleY: pressScale },
      ],
    };
  });

  return (
    <Pressable
      onPress={toggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: size * 1.61,
            height: size,
            borderRadius: size / 2,
          },
          trackAnimatedStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              backgroundColor: knobColor,
            },
            knobAnimatedStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
    padding: 0,
  },
  knob: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2.5,
    elevation: 3,
  },
});

