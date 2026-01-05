import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Animated,
  Pressable,
  StyleSheet,
  Easing,
  TouchableOpacity,
} from "react-native";

export default function SwitchToggle({
  value = false,
  onValueChange = () => {},
  size = 30,
  onColor = "#34C759",
  offColor = "#E5E5EA",
  knobColor = "#FFF",
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.circle),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const toggle = () => onValueChange(!value);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [offColor, onColor],
  });

  const knobTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, size * 0.8],
  });

  return (
    <TouchableOpacity onPress={toggle}>
      <Animated.View
        style={[
          styles.track,
          {
            width: size * 2,
            height: size,
            borderRadius: size / 2,
            backgroundColor: trackColor,
          },
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
              transform: [{ translateX: knobTranslate }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
    padding: 2,
  },
  knob: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1.5,
    elevation: 2,
  },
});
