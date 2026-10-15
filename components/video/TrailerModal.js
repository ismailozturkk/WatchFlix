// components/video/TrailerModal.js
//
// Sohbette paylaşılan dizi/film için fragmanları dile göre liste hâlinde
// gösteren alt-sayfa modalı. İçerikte mevcut TrailerSection yeniden kullanılır
// (dil çipleri + fragman listesi + tam ekran oynatıcı).

import React from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import GlassCloseButton from "../common/GlassCloseButton";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import TrailerSection from "./TrailerSection";

export default function TrailerModal({ visible, mediaType, id, apiKey, originalLanguage, onClose }) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.primary, borderColor: theme.border },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.fragmanlar", "Fragmanlar")}
          </Text>
          <GlassCloseButton
            icon="chevron-down"
            size={34}
            fallbackRadius={12}
            iconSize={20}
            color={theme.text.primary}
            backgroundColor={theme.secondary}
            accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
            onPress={onClose}
          />
        </View>

        {visible && id ? (
          <TrailerSection
            mediaType={mediaType}
            id={id}
            apiKey={apiKey}
            originalLanguage={originalLanguage}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "72%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "800" },
});
