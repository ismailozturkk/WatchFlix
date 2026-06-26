import { Image } from "expo-image";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

export default function ListItemCard({ item, theme, onPress }) {
  const { getTmdbUrl } = useImageQualitySettings();
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, margin: 5 }}>
      <View>
        <Image
          source={{
            uri: getTmdbUrl(item.imagePath, 'poster', 200),
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
