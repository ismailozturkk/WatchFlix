import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const SwipeCard = () => {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_LIMIT = 80; // ne kadar kayınca butonlar tamamen gözüksün

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0 && gesture.dx > -150) {
          translateX.setValue(gesture.dx);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_LIMIT) {
          // sola kaydırıldı → butonlar açık kalsın
          Animated.spring(translateX, {
            toValue: -SWIPE_LIMIT,
            useNativeDriver: true,
          }).start();
        } else {
          // yeterince kaymadı → geri dön
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Arkadaki butonlar */}
      <View style={styles.hiddenButtons}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#f44336" }]}
        >
          <Text style={styles.buttonText}>Sil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#2196F3" }]}
        >
          <Text style={styles.buttonText}>Arşivle</Text>
        </TouchableOpacity>
      </View>

      {/* Öndeki kart */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.card, { transform: [{ translateX }] }]}
      >
        <Text style={styles.text}>Bu bir mesaj kartı</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 70,
    marginVertical: 10,
  },
  hiddenButtons: {
    position: "absolute",
    right: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    width: 80,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  card: {
    position: "absolute",
    backgroundColor: "#fff",
    height: "100%",
    width: "100%",
    borderRadius: 10,
    justifyContent: "center",
    paddingLeft: 20,
    elevation: 3,
  },
  text: {
    fontSize: 16,
    color: "#333",
  },
});

export default SwipeCard;
