import React, { memo } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useTheme } from "../../../context/ThemeContext";

const MovieVideoItem = memo(({ item, onPress }) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity style={styles.videoItem} onPress={() => onPress(item.key)} activeOpacity={0.88}>
      <View style={styles.videoThumbnail}>
        <Image
          source={{ uri: `https://img.youtube.com/vi/${item.key}/hqdefault.jpg` }}
          style={styles.videoImage}
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.playIconContainer}>
          <LottieView
            style={{ width: 56, height: 56 }}
            source={require("@lottie/play")}
            opacity={0.9}
            autoPlay
            loop
          />
        </View>
        <View style={styles.videoTypeBadge}>
          <Text allowFontScaling={false} style={styles.videoTypeBadgeText}>
            {item.type}
          </Text>
        </View>
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.videoTitle, { color: theme.text.primary }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
});

export default MovieVideoItem;

const styles = StyleSheet.create({
  videoItem:        { width: 220, marginRight: 12 },
  videoThumbnail:   { width: 220, height: 124, borderRadius: 12, overflow: "hidden", marginBottom: 8, position: "relative" },
  videoImage:       { width: "100%", height: "100%", resizeMode: "cover" },
  playIconContainer: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" },
  videoTypeBadge:   { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  videoTypeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  videoTitle:       { fontSize: 12, lineHeight: 16 },
});
