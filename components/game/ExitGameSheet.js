// components/game/ExitGameSheet.js
//
// Aktif oyunda cikis onay bottom sheet'i (Part 12.5 / Part 19): Oyuna devam
// et, Oturumu bitir, Ana ekrana don. Saf gosterim; aksiyonlar prop ile gelir.

import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export default function ExitGameSheet({
  theme,
  visible,
  onResume,
  onEndSession,
  onQuitToHome,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onResume}>
      <View style={styles.exitSheetRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
        />
        <SafeAreaView edges={["bottom"]} style={[styles.exitSheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.exitHandle, { backgroundColor: theme.border }]} />
          <Text style={[styles.exitTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.oyundan_cik_baslik", "Oyundan çıkmak istiyor musun?")}
          </Text>
          <Text style={[styles.exitSubtitle, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.oyundan_cik_aciklama",
              "Devam edebilir, oturumu bitirip sonucu görebilir veya ana ekrana dönebilirsin.",
            )}
          </Text>
          <TouchableOpacity
            style={[styles.exitPrimaryBtn, { backgroundColor: theme.accent }]}
            onPress={onResume}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <AppIcon family="Ionicons" name="play" size={18} color="#fff" />
            <Text style={styles.exitPrimaryText}>{i18nText("autoI18n.oyuna_devam_et", "Oyuna Devam Et")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exitSecondaryBtn, { borderColor: theme.border }]}
            onPress={onEndSession}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <AppIcon family="Ionicons" name="flag-outline" size={17} color={theme.text.primary} />
            <Text style={[styles.exitSecondaryText, { color: theme.text.primary }]}>
              {i18nText("autoI18n.oturumu_bitir", "Oturumu Bitir")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exitTextBtn} onPress={onQuitToHome} activeOpacity={0.7} accessibilityRole="button">
            <Text style={[styles.exitTextBtnText, { color: theme.text.muted }]}>
              {i18nText("autoI18n.ana_ekrana_don", "Ana Ekrana Dön")}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  exitSheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "flex-end" },
  exitSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  exitHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  exitTitle: { fontSize: 18, fontWeight: "900" },
  exitSubtitle: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 6, marginBottom: 16 },
  exitPrimaryBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, marginBottom: 10 },
  exitPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  exitSecondaryBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, borderWidth: 1, marginBottom: 6 },
  exitSecondaryText: { fontSize: 14, fontWeight: "800" },
  exitTextBtn: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  exitTextBtnText: { fontSize: 13, fontWeight: "700" },
});
