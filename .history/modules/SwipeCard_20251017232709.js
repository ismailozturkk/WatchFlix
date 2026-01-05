import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const SWIPE_LIMIT = width * 0.08;
const SWIPE_THRESHOLD = width * 0.1;

const SwipeCard = ({ children }) => {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

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

  const scale = translateX.interpolate({
    inputRange: [-SWIPE_LIMIT, 0, SWIPE_LIMIT],
    outputRange: [0.75, 1, 0.7],
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
  const DikeyMetin = ({ metin }) => {
    return (
      <View style={styles.containerYears}>
        {metin.split("").map((karakter, index) => (
          <Text key={index} style={styles.text}>
            {karakter}
          </Text>
        ))}
      </View>
    );
  };
  return (
    <View style={styles.container}>
      {/* Sol buton */}
      <Animated.View
        style={[
          styles.action,
          {
            left: 0,
            backgroundColor: "#4CAF50",
            opacity: opacityLeft,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => {
            Toast.show({
              type: "success",
              text1: "başarılı",
            });
          }}
        >
          <Animated.Text style={styles.actionText}>Arşivle</Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Sağ buton */}
      <Animated.View
        style={[
          styles.action,
          {
            right: 0,
            backgroundColor: "#F44336",
            opacity: opacityRight,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => {
            Toast.show({
              type: "error",
              text1: "silindi",
            });
          }}
        >
          <Animated.Text style={styles.actionText}>Sil</Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Ana kart */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]} // sadece yatayda kaydırma algılansın
        failOffsetY={[-10, 10]} // dikey kaydırmayı engelleme
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX }, { scale }],
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
    //marginVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    width: "100%",
    //borderRadius: 16,
    //padding: 20,
  },
  action: {
    position: "absolute",
    height: "60%",
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
