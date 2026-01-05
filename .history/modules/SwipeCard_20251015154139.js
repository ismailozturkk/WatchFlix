import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

const SwipeCard = () => {
  const renderRightActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: "#2196F3" }]}
      >
        <Text style={styles.actionText}>Arşivle</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: "#f44336" }]}
      >
        <Text style={styles.actionText}>Sil</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View style={styles.card}>
        <Text style={styles.text}>📩 Telegram tarzı mesaj kartı</Text>
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    height: 70,
    justifyContent: "center",
    paddingHorizontal: 20,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: 16,
    color: "#333",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    height: "100%",
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default SwipeCard;
