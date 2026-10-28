// components/settingsShare/SettingsThemeMock.js
//
// Paylaşılan görünümün MİNİ UYGULAMA önizlemesi: verilen tema nesnesinin zemini,
// üst çubuğu, vurgu kartı, afiş rafı ve sekme çubuğu. Sohbet balonunda ve
// uygulama/gönderme sayfalarında aynı çizim kullanılır — alıcı "bu tema bende
// nasıl durur"u renk listesi yerine arayüz olarak görür.
//
// Afiş köşesi paylaşılan afiş ayarından (`posterRadius`, listelerdeki 2/10/20 dp),
// vurgu kartındaki "Aa" paylaşılan başlık fontuyla çizilir; ikisi yoksa varsayılan.
// Genişlik esnek: afişler flex + 2:3 oranla yerleşir. Geniş ekranda afiş BÜYÜMESİN
// diye çağıran `posterCount` verir (utils/settingsShareLayout.mockPosterCount):
// afiş ~50 dp kalır, sayısı artar → önizlemenin yüksekliği ekran genişliğinden bağımsız.
//
// Düğme yazısı BEYAZ (ThemePreviewCard ile aynı kural): vurgu üstü yazı uygulamada
// beyaz; önizleme gerçeği yansıtsın.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";

const ON_ACCENT = "#FFFFFF";
const DEFAULT_POSTER_COUNT = 5;
// Liste afişleri ~110 dp genişlikte; köşe değeri önizlemedeki küçük afişe oranlanır.
const RADIUS_SCALE = 0.32;

function SettingsThemeMock({
  theme,
  posterRadius = 10,
  headingFamily = null,
  title,
  large = false,
  compact = false,
  posterCount = DEFAULT_POSTER_COUNT,
  style,
}) {
  if (!theme) return null;
  const line = [styles.line, compact && styles.lineCompact];
  const lineThin = [styles.line, styles.lineThin, compact && styles.lineThinCompact];
  const radius = Math.max(1, Math.round(posterRadius * RADIUS_SCALE * (large ? 1.25 : compact ? 0.64 : 1)));
  return (
    <View
      testID={compact ? "settings-theme-mock-compact" : "settings-theme-mock"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.frame,
        large && styles.frameLarge,
        compact && styles.frameCompact,
        { backgroundColor: theme.primary, borderColor: alpha(theme.border, 0.9) },
        style,
      ]}
    >
      <View style={[styles.topBar, compact && styles.topBarCompact, { backgroundColor: theme.secondary, borderBottomColor: alpha(theme.border, 0.7) }]}>
        <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: theme.between }]} />
        <View style={[styles.topCopy, compact && styles.topCopyCompact]}>
          {title ? (
            <Text numberOfLines={1} style={[styles.topTitle, compact && styles.topTitleCompact, { color: theme.text.primary }]}>
              {title}
            </Text>
          ) : (
            <View style={[...line, { width: "55%", backgroundColor: alpha(theme.text.primary, 0.8) }]} />
          )}
          <View style={[...lineThin, { width: "35%", backgroundColor: alpha(theme.text.muted, 0.7) }]} />
        </View>
        <View style={[styles.topAction, compact && styles.topActionCompact, { backgroundColor: theme.accent }]}>
          <Ionicons name="search" size={compact ? 6 : 8} color={ON_ACCENT} />
        </View>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <LinearGradient
          colors={[theme.accent, theme.bold || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, large && styles.heroLarge, compact && styles.heroCompact]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.heroGlyph, large && styles.heroGlyphLarge, compact && styles.heroGlyphCompact, headingFamily ? { fontFamily: headingFamily } : null]}
          >
            Aa
          </Text>
          <View style={[styles.heroLines, compact && styles.heroLinesCompact]}>
            <View style={[...line, { width: "80%", backgroundColor: alpha(ON_ACCENT, 0.85) }]} />
            <View style={[...lineThin, { width: "55%", backgroundColor: alpha(ON_ACCENT, 0.55) }]} />
            <View style={[styles.heroPill, compact && styles.heroPillCompact, { backgroundColor: alpha(ON_ACCENT, 0.24) }]} />
          </View>
        </LinearGradient>

        <View style={[styles.rail, compact && styles.railCompact]}>
          {Array.from({ length: posterCount }, (_, index) => (
            <View
              key={index}
              style={[
                styles.poster,
                {
                  borderRadius: radius,
                  backgroundColor: index % 2 ? theme.between : alpha(theme.accent, 0.22),
                  borderColor: alpha(theme.text.primary, 0.1),
                },
              ]}
            />
          ))}
        </View>
        <View style={[...line, { width: "62%", backgroundColor: alpha(theme.text.primary, 0.75) }]} />
        <View style={[...lineThin, { width: "40%", marginTop: 3, backgroundColor: alpha(theme.text.muted, 0.7) }]} />
      </View>

      <View style={[styles.tabBar, compact && styles.tabBarCompact, { backgroundColor: theme.tab, borderTopColor: alpha(theme.border, 0.7) }]}>
        {["home", "search", "albums", "person"].map((icon, index) => (
          <Ionicons
            key={icon}
            name={index === 0 ? icon : `${icon}-outline`}
            size={large ? 12 : compact ? 8 : 10}
            color={index === 0 ? theme.accent : theme.text.muted}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(SettingsThemeMock);

// Ölçüler bilinçli olarak küçük (25 Eki: "aynı içerik, bir tık küçük"): önizleme
// sayfanın asıl işini — bölüm seçimini — ekranın altına itmesin.
const styles = StyleSheet.create({
  frame: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  frameLarge: { borderRadius: 17 },
  // Kompakt = sohbet balonu (27 Eki: "önizleme büyük, yalnız boyutu küçült"):
  // aynı içerik, ~%30 daha alçak.
  frameCompact: { borderRadius: 10 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarCompact: { gap: 4, paddingHorizontal: 6, paddingVertical: 3 },
  avatar: { width: 14, height: 14, borderRadius: 7 },
  avatarCompact: { width: 9, height: 9, borderRadius: 5 },
  topCopy: { flex: 1, minWidth: 0, gap: 3 },
  topCopyCompact: { gap: 2 },
  topTitle: { fontSize: 10, fontWeight: "800" },
  topTitleCompact: { fontSize: 8 },
  topAction: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  topActionCompact: { width: 12, height: 12, borderRadius: 6 },
  body: { paddingHorizontal: 8, paddingTop: 7, paddingBottom: 8 },
  bodyCompact: { paddingHorizontal: 6, paddingTop: 4, paddingBottom: 5 },
  hero: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, paddingHorizontal: 10, height: 38 },
  heroLarge: { height: 46, borderRadius: 12 },
  heroCompact: { height: 24, borderRadius: 7, paddingHorizontal: 7, gap: 6 },
  heroGlyph: { color: ON_ACCENT, fontSize: 18, fontWeight: "800" },
  heroGlyphLarge: { fontSize: 22 },
  heroGlyphCompact: { fontSize: 12 },
  heroLines: { flex: 1, gap: 3 },
  heroLinesCompact: { gap: 2 },
  heroPill: { width: 26, height: 7, borderRadius: 4, marginTop: 1 },
  heroPillCompact: { width: 20, height: 5, borderRadius: 3, marginTop: 0 },
  rail: { flexDirection: "row", gap: 4, marginTop: 7, marginBottom: 7 },
  railCompact: { gap: 3, marginTop: 4, marginBottom: 4 },
  poster: { flex: 1, aspectRatio: 2 / 3, borderWidth: StyleSheet.hairlineWidth },
  line: { height: 4, borderRadius: 2 },
  lineThin: { height: 3 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarCompact: { paddingVertical: 3 },
  lineCompact: { height: 3 },
  lineThinCompact: { height: 2 },
});
