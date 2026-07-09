import React from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const REPLY_THRESHOLD = 62;
const MAX_DRAG = 82;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

export default function SwipeReplyContainer({ children, onReply, disabled = false }) {
  const translateX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.max(0, Math.min(MAX_DRAG, event.translationX));
    })
    .onEnd(() => {
      if (translateX.value >= REPLY_THRESHOLD) runOnJS(onReply)();
      translateX.value = withSpring(0, SPRING);
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, SPRING);
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, translateX.value / REPLY_THRESHOLD),
    transform: [{ scale: 0.72 + Math.min(0.28, translateX.value / 220) }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <Reanimated.View pointerEvents="none" style={[styles.icon, iconStyle]}>
          <Ionicons name="arrow-undo" size={18} color="#fff" />
        </Reanimated.View>
        <Reanimated.View style={contentStyle}>{children}</Reanimated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", position: "relative" },
  icon: {
    position: "absolute",
    left: 7,
    top: "50%",
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108,99,255,0.92)",
  },
});
