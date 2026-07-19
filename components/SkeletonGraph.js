import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

const Skeleton = ({ width, height, style }) => {
  // useRef: her render'da yeni Animated.Value üretmek shimmer'ı ilk değerde
  // donduruyor ve mount'taki loop sahipsiz kalıp sızıntı yapıyordu.
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

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
