// components/theme/ThemePreviewCard.js
//
// Özel tema oluşturucu için canlı önizleme. Verilen tam tema nesnesinden mini bir
// uygulama mockup'ı (üst bar, kartlar, vurgu butonu, alt sekme çubuğu) çizer;
// böylece kullanıcı seçtiği renklerin gerçek arayüzde nasıl görüneceğini görür.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { readableTextOn } from "@utils/colorUtils";

const ThemePreviewCard = memo(function ThemePreviewCard({ theme, isEn = false }) {
  const t = (trText, enText) => (isEn ? enText : trText);
  const onAccent = readableTextOn(theme.accent);

  return (
    <View style={[styles.frame, { backgroundColor: theme.primary, borderColor: theme.border, shadowColor: theme.shadow }]}>
      {/* Üst bar */}
      <View style={[styles.topBar, { backgroundColor: theme.secondary, borderBottomColor: theme.border }]}>
        <View style={styles.topCopy}>
          <Text style={[styles.topTitle, { color: theme.text.primary }]} numberOfLines={1}>{t("Önizleme", "Preview")}</Text>
          <Text style={[styles.topSub, { color: theme.text.muted }]} numberOfLines={1}>{t("Temanın görünümü", "Your theme in action")}</Text>
        </View>
        <View style={[styles.topAction, { backgroundColor: theme.accent }]}>
          <AppIcon family="Ionicons" name="search" size={15} color={onAccent} />
        </View>
      </View>

      <View style={styles.body}>
        {/* Hero kart */}
        <View style={[styles.heroCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.poster, { backgroundColor: theme.between }]}>
            <AppIcon family="Ionicons" name="film-outline" size={20} color={theme.text.muted} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.text.primary }]} numberOfLines={1}>{t("Başlık metni", "Title text")}</Text>
            <Text style={[styles.heroLine, { color: theme.text.secondary }]} numberOfLines={1}>{t("İkincil açıklama satırı", "Secondary description line")}</Text>
            <Text style={[styles.heroLine, { color: theme.text.muted }]} numberOfLines={1}>{t("Soluk yardımcı metin", "Muted helper text")}</Text>
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: `${theme.accent}26`, borderColor: theme.accent }]}>
                <Text style={[styles.chipText, { color: theme.accent }]}>{t("Vurgu", "Accent")}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: theme.between, borderColor: theme.border }]}>
                <Text style={[styles.chipText, { color: theme.text.between }]}>{t("Ara", "Between")}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* İstatistik şeridi */}
        <View style={styles.statRow}>
          {[{ v: "1.2K", k: t("Skor", "Score") }, { v: "87%", k: t("Doğruluk", "Accuracy") }, { v: "12", k: t("Seri", "Streak") }].map((item) => (
            <View key={item.k} style={[styles.statCell, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Text style={[styles.statValue, { color: theme.accent }]}>{item.v}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{item.k}</Text>
            </View>
          ))}
        </View>

        {/* Vurgu butonu */}
        <View style={[styles.primaryBtn, { backgroundColor: theme.accent }]}>
          <AppIcon family="Ionicons" name="play" size={15} color={onAccent} />
          <Text style={[styles.primaryBtnText, { color: onAccent }]}>{t("Oyna", "Play")}</Text>
        </View>
      </View>

      {/* Alt sekme çubuğu */}
      <View style={[styles.tabBar, { backgroundColor: theme.tab, borderTopColor: theme.border }]}>
        {["home", "search", "heart", "person"].map((icon, i) => (
          <AppIcon key={icon} family="Ionicons" name={i === 0 ? icon : `${icon}-outline`} size={18} color={i === 0 ? theme.accent : theme.text.muted} />
        ))}
      </View>
    </View>
  );
});

export default ThemePreviewCard;

const styles = StyleSheet.create({
  frame: { borderRadius: 22, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  topBar: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, borderBottomWidth: 1 },
  topCopy: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: "900" },
  topSub: { fontSize: 10, fontWeight: "650", marginTop: 2 },
  topAction: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body: { padding: 13, gap: 11 },
  heroCard: { flexDirection: "row", borderRadius: 15, borderWidth: 1, padding: 11, gap: 11 },
  poster: { width: 52, height: 74, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, justifyContent: "center" },
  heroTitle: { fontSize: 14, fontWeight: "850" },
  heroLine: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  chipRow: { flexDirection: "row", gap: 7, marginTop: 9 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 10, fontWeight: "800" },
  statRow: { flexDirection: "row", gap: 9 },
  statCell: { flex: 1, borderRadius: 13, borderWidth: 1, paddingVertical: 11, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "700", marginTop: 3 },
  primaryBtn: { minHeight: 44, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { fontSize: 14, fontWeight: "900" },
  tabBar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1 },
});
