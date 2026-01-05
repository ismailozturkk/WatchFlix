import React, { useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";

const SwipeableCard = () => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Kaydırma başlarken küçült
  const handleSwipeStart = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.6, // %90 boyuta indir
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Kaydırma bitince eski haline dön
  const handleSwipeEnd = () => {
    Animated.timing(scaleAnim, {
      toValue: 1, // Eski boyutuna dön
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Sol tarafa buton
  const renderLeftActions = () => (
    <View style={[styles.actionContainer, { backgroundColor: "#4CAF50" }]}>
      <Text style={styles.actionText}>Arşivle</Text>
    </View>
  );

  // Sağ tarafa buton
  const renderRightActions = () => (
    <View style={[styles.actionContainer, { backgroundColor: "#F44336" }]}>
      <Text style={styles.actionText}>Sil</Text>
    </View>
  );

  return (
    <Swipeable
      onSwipeableWillOpen={handleSwipeStart}
      onSwipeableWillClose={handleSwipeEnd}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            transform: [{ scaleX: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.text}>Film Kartı</Text>
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e1e",
    padding: 20,
    borderRadius: 16,
    marginVertical: 10,
  },
  text: {
    color: "#fff",
    fontSize: 18,
  },
  actionContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    marginVertical: 10,
    borderRadius: 16,
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default SwipeableCard;
