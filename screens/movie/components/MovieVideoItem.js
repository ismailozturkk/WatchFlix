import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";

// Oynat simgesi STATİK: eskiden her küçük resimde sonsuz döngülü bir Lottie
// vardı — fragman şeridinde aynı anda 5-10 animasyon, ekran açık kaldıkça her
// karede çizim. Küçük resim expo-image ile disk önbelleğinden gelir (RN Image
// önbelleksizdi; şerit her açılışta yeniden indiriyordu).
const MovieVideoItem = memo(({ item, onPress }) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity style={styles.videoItem} onPress={() => onPress(item)} activeOpacity={0.88}>
      <View style={styles.videoThumbnail}>
        <Image
          source={{ uri: `https://img.youtube.com/vi/${item.key}/hqdefault.jpg` }}
          style={styles.videoImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.key}
          transition={150}
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.playIconContainer} pointerEvents="none">
          <View style={styles.playCircle}>
            <Ionicons name="play" size={22} color="#fff" style={styles.playGlyph} />
          </View>
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
  videoImage:       { width: "100%", height: "100%" },
  playIconContainer: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" },
  playCircle:       {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  // "play" glifi optik olarak sola kayık durur; ortalamak için hafif sağa.
  playGlyph:        { marginLeft: 3 },
  videoTypeBadge:   { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  videoTypeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  videoTitle:       { fontSize: 12, lineHeight: 16 },
});
