// components/game/GameErrorState.js
//
// Oyun baslatma/havuz hatasi tam ekran durumu (Part 2.6 / Part 19). Hata
// icerigi (icon/title/message/retryable) cagiran ekran tarafindan hesaplanip
// prop olarak verilir; bu bilesen sadece gosterir.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export default function GameErrorState({ theme, content, onRetry, onDismiss }) {
  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <SafeAreaView style={styles.errorStateRoot}>
        <View style={[styles.errorStateIcon, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name={content.icon} size={34} color={theme.accent} />
        </View>
        <Text style={[styles.errorStateTitle, { color: theme.text.primary }]}>{content.title}</Text>
        <Text style={[styles.errorStateMessage, { color: theme.text.secondary }]}>{content.message}</Text>
        {content.retryable && (
          <TouchableOpacity
            style={[styles.errorPrimaryBtn, { backgroundColor: theme.accent }]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <AppIcon family="Ionicons" name="refresh" size={18} color="#fff" />
            <Text style={styles.errorPrimaryText}>{i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.errorSecondaryBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={[styles.errorSecondaryText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.kaynaklara_don", "Kaynaklara Dön")}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorStateRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  errorStateIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 20 },
  errorStateTitle: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  errorStateMessage: { fontSize: 14, fontWeight: "500", lineHeight: 21, textAlign: "center", marginBottom: 24 },
  errorPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 12, marginBottom: 8 },
  errorPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  errorSecondaryBtn: { paddingHorizontal: 18, paddingVertical: 10 },
  errorSecondaryText: { fontSize: 13, fontWeight: "700" },
});
