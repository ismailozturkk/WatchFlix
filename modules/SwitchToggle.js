import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

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
  const { theme } = useTheme();

  // Reanimated shared value: represents 0 for off, 1 for on
  const progress = useSharedValue(value ? 1 : 0);

  // Sync state changes from parents to the shared value via Spring animation
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      mass: 0.5,
      damping: 12,
      stiffness: 150,
      overshootClamping: false, // Ensures the bouncy iOS feel
    });
  }, [value, progress]);

  const toggle = () => {
    if (!disabled) {
      onValueChange(!value);
    }
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
    };
  });

  // Switch Knob style (Translation)
  const knobAnimatedStyle = useAnimatedStyle(() => {
    // Determine bounds for knob translation based on given size
    const translateMax = size * 1.61 - size + 2; 

    return {
      transform: [
        {
          translateX: progress.value * (translateMax - 2) + 2,
        },
      ],
    };
  });

  return (
    <Pressable onPress={toggle} disabled={disabled}>
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

