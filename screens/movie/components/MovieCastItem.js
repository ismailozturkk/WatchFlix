import React, { memo } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";

const MovieCastItem = memo(({ item, navigation }) => {
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("ActorViewScreen", { personId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.castItem}>
        <Image
          source={
            item.profile_path
              ? { uri: getTmdbUrl(item.profile_path, 'poster', 200) }
              : require("../../../assets/image/user.png")
          }
          style={[styles.castImage, { borderColor: theme.border }]}
        />
        <Text
          allowFontScaling={false}
          style={[styles.castName, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.castCharacter, { color: theme.text.muted }]}
          numberOfLines={1}
        >
          {item.character}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default MovieCastItem;

const styles = StyleSheet.create({
  castItem:      { width: 85, marginRight: 12, alignItems: "center" },
  castImage:     { width: 70, height: 70, borderRadius: 35, borderWidth: 1, marginBottom: 6 },
  castName:      { fontSize: 11, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  castCharacter: { fontSize: 10, textAlign: "center" },
});
