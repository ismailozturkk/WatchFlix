import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");
const SWIPE_LIMIT = width * 0.08; // Kart ne kadar kaydırılabilir
const SWIPE_THRESHOLD = width * 0.1; // Aksiyon alınma eşiği

const SwipeableCard = () => {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;

  // Jest olaylarını dinliyor
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  // Kartın geri dönmesi veya tamamen kayması
  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;

      if (Math.abs(translationX) > SWIPE_THRESHOLD) {
        Animated.spring(translateX, {
          toValue: Math.sign(translationX) * SWIPE_LIMIT,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Kart küçülmesi (kaydırma arttıkça)
  const scale = translateX.interpolate({
    inputRange: [-SWIPE_LIMIT, 0, SWIPE_LIMIT],
    outputRange: [0.88, 1, 0.85],
    extrapolate: "clamp",
  });

  // Sağ/sol arka buton görünürlüğü
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
      {/* Sol buton */}
      <Animated.View
        style={[
          styles.action,
          { left: 0, backgroundColor: "#4CAF50", opacity: opacityLeft },
        ]}
      >
        <TouchableOpacity>
          <Text style={styles.actionText}>Arşivle</Text>
        </TouchableOpacity>
      </Animated.View>
      {/* Sağ buton */}
      <TouchableOpacity
        style={[
          styles.action,
          { right: 0, backgroundColor: "#F44336", opacity: opacityRight },
        ]}
      >
        <Animated.View
          style={[
            styles.action,
            { right: 0, backgroundColor: "#F44336", opacity: opacityRight },
          ]}
        >
          <Text style={styles.actionText}>Sil</Text>
        </Animated.View>
      </TouchableOpacity>
      {/* Kart */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.secondary,
              transform: [{ translateX }, { scale }],
            },
          ]}
        >
          <Text style={[styles.text, { color: theme.text.primary }]}>
            Film Kartı 🎬
          </Text>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: width * 0.9,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
  },
  action: {
    position: "absolute",
    height: "90%",
    width: 90,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default SwipeableCard;
