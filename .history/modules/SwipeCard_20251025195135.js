import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Text,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

const { width } = Dimensions.get("window");
const SWIPE_LIMIT = width * 0.08;
const SWIPE_THRESHOLD = width * 0.1;

const SwipeCard = ({ children, leftButton, rightButton }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [hasTriggered, setHasTriggered] = useState(false);

  // Sol veya sağ yön kaydırma izinleri
  const allowLeft = leftButton && typeof leftButton.onPress === "function";
  const allowRight = rightButton && typeof rightButton.onPress === "function";

  // translateX değerini dinleyip yarıya ulaşınca otomatik tetikleme
  useEffect(() => {
    const listener = translateX.addListener(({ value }) => {
      if (!hasTriggered) {
        if (value > SWIPE_LIMIT && allowLeft) {
          leftButton.onPress();
          setHasTriggered(true);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else if (value < -SWIPE_LIMIT && allowRight) {
          rightButton.onPress();
          setHasTriggered(true);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      }
    });
    return () => translateX.removeListener(listener);
  }, [hasTriggered]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;

      if (translationX > 0 && !allowLeft) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }
      if (translationX < 0 && !allowRight) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }

      if (Math.abs(translationX) > SWIPE_THRESHOLD) {
        Animated.spring(translateX, {
          toValue: Math.sign(translationX) * SWIPE_LIMIT,
          useNativeDriver: true,
        }).start(() => setHasTriggered(false)); // reset
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setHasTriggered(false));
      }
    }
  };

  const scale = translateX.interpolate({
    inputRange: [-SWIPE_LIMIT, 0, SWIPE_LIMIT],
    outputRange: [0.9, 1, 0.9],
    extrapolate: "clamp",
  });

  const opacityLeft = translateX.interpolate({
    inputRange: [0, SWIPE_LIMIT],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const opacityRight = translateX.interpolate({
    inputRange: [-SWIPE_LIMIT, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {allowLeft && (
        <Animated.View
          style={[
            styles.action,
            {
              left: 0,
              backgroundColor: leftButton.color || "#4CAF50",
              opacity: opacityLeft,
              transform: [{ translateY }, { scale }],
            },
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
            {
              right: 0,
              backgroundColor: rightButton.color || "#F44336",
              opacity: opacityRight,
              transform: [{ translateY }, { scale }],
            },
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

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-10, 10]}
      >
        <Animated.View
          style={[styles.card, { transform: [{ translateX }, { scale }] }]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center", justifyContent: "center" },
  card: { flex: 1, width: "100%" },
  action: {
    position: "absolute",
    height: "80%",
    width: 70,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  actionText: { color: "#fff", fontWeight: "bold" },
  button: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SwipeCard;
