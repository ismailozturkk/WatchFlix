import React from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const SWIPE_LIMIT = width * 0.15; // Swipe limit gives a natural limit feeling
const ACTION_THRESHOLD = width * 0.25; // How far to swipe before triggering the action

const SwipeCard = ({ children, leftButton, rightButton }) => {
  const translateX = useSharedValue(0);

  // Check if interactions are allowed
  const allowLeft = leftButton && typeof leftButton.onPress === "function";
  const allowRight = rightButton && typeof rightButton.onPress === "function";

  // Actions wrapped in JS functions (must be ran via runOnJS out of UI thread)
  const triggerLeftAction = () => {
    if (allowLeft) leftButton.onPress();
  };

  const triggerRightAction = () => {
    if (allowRight) rightButton.onPress();
  };

  // Modern Gesture Detector
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Don't block vertical scrolling on Flatlists
    .onUpdate((event) => {
      // Block dragging if actions are not enabled in that direction
      if (event.translationX > 0 && !allowLeft) return;
      if (event.translationX < 0 && !allowRight) return;

      // Elastic bungee effect by dividing the translation
      translateX.value = event.translationX / 1.2;
    })
    .onEnd((event) => {
      // Swiped passed the threshold to right (left button exposed)
      if (event.translationX > ACTION_THRESHOLD && allowLeft) {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        runOnJS(triggerLeftAction)();
      }
      // Swiped passed the threshold to left (right button exposed)
      else if (event.translationX < -ACTION_THRESHOLD && allowRight) {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        runOnJS(triggerRightAction)();
      }
      // Released before the threshold, returning to 0 position
      else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  // Animated styles working 100% on the UI thread
  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [-SWIPE_LIMIT, 0, SWIPE_LIMIT],
      [0.97, 1, 0.97],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateX: translateX.value }, { scale }],
    };
  });

  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_LIMIT],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [0, SWIPE_LIMIT],
      [0.8, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_LIMIT, 0],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [-SWIPE_LIMIT, 0],
      [1, 0.8],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.container}>
      {allowLeft && (
        <Animated.View
          style={[
            styles.action,
            styles.actionLeft,
            { backgroundColor: leftButton.color || "#4CAF50" },
            leftActionStyle,
          ]}
        >
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={leftButton.onPress}
          >
            <Animated.Text style={styles.actionText}>
              {leftButton.label || "Sol"}
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {allowRight && (
        <Animated.View
          style={[
            styles.action,
            styles.actionRight,
            { backgroundColor: rightButton.color || "#F44336" },
            rightActionStyle,
          ]}
        >
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={rightButton.onPress}
          >
            <Animated.Text style={styles.actionText}>
              {rightButton.label || "Sağ"}
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    width: "100%",
    zIndex: 10, // Ensure card sits above the buttons
  },
  action: {
    position: "absolute",
    height: "80%",
    width: 70,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  actionLeft: {
    left: 10,
  },
  actionRight: {
    right: 10,
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  button: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SwipeCard;
