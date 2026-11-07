// components/tierList/TierListShareSheet.js
//
// Paylaşım seçenekleri: akışta paylaş · görsel olarak paylaş · galeriye kaydet · sohbete gönder. Seçim YALNIZ kaydedilir; işi
// çağıran sayfa tamamen kapandıktan sonra (`onDismissed(choice)`) yapar — sistem paylaşım penceresi, izin
// penceresi ve sohbet alıcı sayfası açık bir Modal'ın üstüne iOS'ta sunulamaz.

import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import { TierSheet } from "./tierSheetKit";

const OPTIONS = [
  { id: "feed", icon: "newspaper", title: "shareFeed", sub: "shareFeedSub", color: "#FFBF7F" },
  { id: "image", icon: "share-social", title: "shareImage", sub: "shareImageSub", color: "#7F7FFF" },
  { id: "gallery", icon: "download", title: "saveImage", sub: "saveImageSub", color: "#7FBFFF" },
  { id: "chat", icon: "paper-plane", title: "shareChat", sub: "shareChatSub", color: "#FF7F7F" },
];

export default function TierListShareSheet({ visible, copy, theme, onClose, onDismissed }) {
  const choice = useRef(null);
  const pick = (id) => {
    choice.current = id;
    onClose();
  };
  return (
    <TierSheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        const picked = choice.current;
        choice.current = null;
        onDismissed?.(picked);
      }}
      theme={theme}
      title={copy.shareTitle}
    >
      <View style={[styles.list, { backgroundColor: theme.between, borderColor: theme.border }]}>
        {OPTIONS.map((option, index) => (
          <GlassTouchable
            key={option.id}
            glass={false}
            activeOpacity={0.7}
            onPress={() => pick(option.id)}
            accessibilityRole="button"
            accessibilityLabel={copy[option.title]}
            testID={`tier-share-${option.id}`}
            style={[styles.row, index < OPTIONS.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={[styles.icon, { backgroundColor: option.color }]}>
              <AppIcon family="Ionicons" name={option.icon} size={18} color="#1A1A1A" />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
                {copy[option.title]}
              </Text>
              <Text style={[styles.sub, { color: theme.text.muted }]} numberOfLines={2}>
                {copy[option.sub]}
              </Text>
            </View>
            <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} />
          </GlassTouchable>
        ))}
      </View>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "800" },
  sub: { fontSize: 12, fontWeight: "600", marginTop: 2, lineHeight: 16 },
});
