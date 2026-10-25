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
  posterCount = DEFAULT_POSTER_COUNT,
  style,
}) {
  if (!theme) return null;
  const radius = Math.max(1, Math.round(posterRadius * RADIUS_SCALE * (large ? 1.25 : 1)));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.frame,
        large && styles.frameLarge,
        { backgroundColor: theme.primary, borderColor: alpha(theme.border, 0.9) },
        style,
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: theme.secondary, borderBottomColor: alpha(theme.border, 0.7) }]}>
        <View style={[styles.avatar, { backgroundColor: theme.between }]} />
        <View style={styles.topCopy}>
          {title ? (
            <Text numberOfLines={1} style={[styles.topTitle, { color: theme.text.primary }]}>
              {title}
            </Text>
          ) : (
            <View style={[styles.line, { width: "55%", backgroundColor: alpha(theme.text.primary, 0.8) }]} />
          )}
          <View style={[styles.line, styles.lineThin, { width: "35%", backgroundColor: alpha(theme.text.muted, 0.7) }]} />
        </View>
        <View style={[styles.topAction, { backgroundColor: theme.accent }]}>
          <Ionicons name="search" size={8} color={ON_ACCENT} />
        </View>
      </View>

      <View style={styles.body}>
        <LinearGradient
          colors={[theme.accent, theme.bold || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, large && styles.heroLarge]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.heroGlyph, large && styles.heroGlyphLarge, headingFamily ? { fontFamily: headingFamily } : null]}
          >
            Aa
          </Text>
          <View style={styles.heroLines}>
            <View style={[styles.line, { width: "80%", backgroundColor: alpha(ON_ACCENT, 0.85) }]} />
            <View style={[styles.line, styles.lineThin, { width: "55%", backgroundColor: alpha(ON_ACCENT, 0.55) }]} />
            <View style={[styles.heroPill, { backgroundColor: alpha(ON_ACCENT, 0.24) }]} />
          </View>
        </LinearGradient>

        <View style={styles.rail}>
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
        <View style={[styles.line, { width: "62%", backgroundColor: alpha(theme.text.primary, 0.75) }]} />
        <View style={[styles.line, styles.lineThin, { width: "40%", marginTop: 3, backgroundColor: alpha(theme.text.muted, 0.7) }]} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.tab, borderTopColor: alpha(theme.border, 0.7) }]}>
        {["home", "search", "albums", "person"].map((icon, index) => (
          <Ionicons
            key={icon}
            name={index === 0 ? icon : `${icon}-outline`}
            size={large ? 12 : 10}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 14, height: 14, borderRadius: 7 },
  topCopy: { flex: 1, minWidth: 0, gap: 3 },
  topTitle: { fontSize: 10, fontWeight: "800" },
  topAction: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 8, paddingTop: 7, paddingBottom: 8 },
  hero: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, paddingHorizontal: 10, height: 38 },
  heroLarge: { height: 46, borderRadius: 12 },
  heroGlyph: { color: ON_ACCENT, fontSize: 18, fontWeight: "800" },
  heroGlyphLarge: { fontSize: 22 },
  heroLines: { flex: 1, gap: 3 },
  heroPill: { width: 26, height: 7, borderRadius: 4, marginTop: 1 },
  rail: { flexDirection: "row", gap: 4, marginTop: 7, marginBottom: 7 },
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
});
