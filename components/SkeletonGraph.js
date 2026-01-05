import React, { useEffect } from "react";
import { Animated, StyleSheet } from "react-native";

const Skeleton = ({ width, height, style }) => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[styles.skeleton, { width, height, opacity }, style]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#333",
    borderRadius: 4,
  },
});

export default Skeleton;
