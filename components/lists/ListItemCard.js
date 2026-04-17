import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";

export default function ListItemCard({ item, imageQuality, theme, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, margin: 5 }}>
      <View>
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.imagePath}`,
          }}
          style={{
            width: "100%",
            height: 180,
            borderRadius: 12,
          }}
        />

        <Text
          style={{
            color: theme.text.primary,
            fontSize: 12,
            marginTop: 5,
          }}
        >
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
