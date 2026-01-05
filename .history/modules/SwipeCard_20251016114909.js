import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Text,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const SWIPE_LIMIT = width * 0.08;
const SWIPE_THRESHOLD = width * 0.19;

const SwipeCard = ({ children }) => {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(1)).current; // 🔹 yükseklik kontrolü
  const [isOpen, setIsOpen] = useState(false);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;

      // Eğer kaydırma eşiği geçildiyse
      if (Math.abs(translationX) > SWIPE_THRESHOLD) {
        const direction = Math.sign(translationX);

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: direction * SWIPE_LIMIT,
            useNativeDriver: true,
          }),
          Animated.timing(heightAnim, {
            toValue: 0.8, // 🔹 %80 yüksekliğe küçül
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setIsOpen(true);
        });
      } else {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(heightAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setIsOpen(false);
        });
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
      {/* Sol buton */}
      <Animated.View
        style={[
          styles.action,
          { left: 0, backgroundColor: "#4CAF50", opacity: opacityLeft },
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => {
            Toast.show({
              type: "success",
              text1: "Arşivlendi",
            });
          }}
        >
          <Text style={styles.actionText}>Arşivle</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Sağ buton */}
      <Animated.View
        style={[
          styles.action,
          { right: 0, backgroundColor: "#F44336", opacity: opacityRight },
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => {
            Toast.show({
              type: "error",
              text1: "Silindi",
            });
          }}
        >
          <Text style={styles.actionText}>Sil</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Ana kart */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX }, { scale }],
              height: heightAnim.interpolate({
                inputRange: [0.8, 1],
                outputRange: [100, 170], // 🔹 Kartın gerçek yüksekliği arası
              }),
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  card: {
    width: "95%",
    borderRadius: 16,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
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
  button: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SwipeCard;
