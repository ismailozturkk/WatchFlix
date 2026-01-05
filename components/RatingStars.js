import React from "react";
import { View, Image, StyleSheet } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useTheme } from "@react-navigation/native";
export default function RatingStars({ rating }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const { theme } = useTheme();
  return (
    <View style={styles.ratingContainer}>
      <AntDesign name="star" size={14} color="orange" />
    </View>
  );
}

const styles = StyleSheet.create({
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starImage: {
    width: 12,
    height: 12,
    marginRight: 1,
  },
});
