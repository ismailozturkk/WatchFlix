// components/game/GameLoadingState.js
//
// Soru hazirlanirken gosterilen tam ekran yukleme durumu (Part 19).

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { i18nText } from "@utils/i18nText";

export default function GameLoadingState({ theme }) {
  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.soru_hazirlaniyor", "Soru hazırlanıyor...")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { fontSize: 14, fontWeight: "600" },
});
