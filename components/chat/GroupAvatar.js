import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getIconBackgroundSource } from "@components/IconBacground";

const GroupAvatar = memo(function GroupAvatar({
  avatarIndex,
  color = "#6C63FF",
  size = 50,
  borderRadius = size / 2,
  iconSize = Math.round(size * 0.58),
  style,
}) {
  const source = getIconBackgroundSource(avatarIndex);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: "transparent",
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: iconSize, height: iconSize }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={String(avatarIndex)}
        />
      ) : (
        <Ionicons name="people" size={iconSize} color="#fff" />
      )}
    </View>
  );
});

export default GroupAvatar;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
