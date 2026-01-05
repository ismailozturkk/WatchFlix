import React, { useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.25; // Kartın ne kadar kaydırılınca aksiyon alınacağı

const SwipeableCard = () => {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;

  // Kaydırma hareketini dinleyen event
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  // Kaydırma durumu değiştiğinde (başladı, bitti vs.)
  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Kaydırma bittiğinde
      const { translationX } = event.nativeEvent;

      if (Math.abs(translationX) > SWIPE_THRESHOLD) {
        // Eşiği geçtiyse kartı ekran dışına gönder
        Animated.timing(translateX, {
          toValue: Math.sign(translationX) * width,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        // Eşiği geçmediyse eski pozisyonuna geri dön
        Animated.spring(translateX, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // translateX değerine göre scaleX değerini hesapla
  const scaleX = translateX.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: [0.5, 1, 0.5], // Kenarlara yaklaştıkça %50 küçül
    extrapolate: "clamp", // Değerlerin aralık dışına çıkmasını engelle
  });

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            transform: [{ translateX }, { scaleX }],
          },
        ]}
      >
        <Text style={[styles.text, { color: theme.text.primary }]}>
          Film Kartı
        </Text>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e1e",
    padding: 20,
    borderRadius: 16,
    marginVertical: 10, // Dikeyde boşluk
    marginHorizontal: 10, // Yatayda boşluk
  },
  text: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
});

export default SwipeableCard;
