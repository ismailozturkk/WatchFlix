// Ayarlar → Görünüm: tema seçici.
//
// Tasarım dili:
//   • Üstte "aktif tema" özet satırı — seçili temanın adı, accent renk küresi
//     ve koyu/açık rozeti kaydırmadan görünür (durum görünürlüğü).
//   • Kartlar mini film-uygulaması önizlemesi taşır: başlık çubuğu, poster
//     rayı, metin satırları ve alt tab bar — tema gerçek arayüzde nasıl
//     duracaksa o hissi verir.
//   • Footer'da temanın gerçek renk swatch üçlüsü + ad; seçim accent halka,
//     yumuşak büyüme ve check rozetiyle vurgulanır. Kart-kart snap kaydırma
//     ve seçimde haptic tık.
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { buildCustomTheme, themes, alpha } from "../../../theme/colors";
import { i18nText } from "../../../utils/i18nText";

const THEME_CONFIGS = [
  { key: "gray", icon: "contrast", labelKey: "grayTheme" },
  { key: "blue", icon: "water", labelKey: "blueTheme" },
  { key: "green", icon: "leaf", labelKey: "greenTheme" },
  { key: "dark", icon: "moon", labelKey: "darkTheme" },
  { key: "light", icon: "sunny", labelKey: "lightTheme" },
  { key: "purple", icon: "planet", labelKey: "purpleTheme" },
  { key: "amber", icon: "film", labelKey: "amberTheme" },
];

const CARD_W = 96;
// halka padding (3×2) + wrapper padding (4×2) + kartlar arası gap (10)
const SNAP_INTERVAL = CARD_W + 6 + 8 + 10;

// Palet açık mı? primary zemininin algısal parlaklığından türetilir
// (tema tanımlarında ayrı bir mode alanı yok).
const isLightPalette = (p) => {
  const hex =
    typeof p?.primary === "string" && p.primary.startsWith("#")
      ? p.primary.replace("#", "")
      : null;
  if (!hex || hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
};

/* ── Tek tema kartı ─────────────────────────────────────────────────────── */
const ThemeCard = ({ themeKey, isSelected, onPress, label, palette, onEdit }) => {
  const p = palette || themes[themeKey] || themes.gray;

  const scale = useSharedValue(isSelected ? 1.05 : 1);
  const ringWidth = useSharedValue(isSelected ? 2 : 0);
  const checkOpacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.04 : 1, {
      mass: 0.4,
      damping: 13,
      stiffness: 150,
    });
    ringWidth.value = withTiming(isSelected ? 2 : 0, { duration: 200 });
    checkOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 180 });
  }, [isSelected]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: ringWidth.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkOpacity.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={styles.cardWrapper}
    >
      {/* Seçim halkası: karttan 3px açıkta duran accent çerçeve */}
      <Animated.View style={[styles.ring, { borderColor: p.accent }, ringStyle]}>
        <View style={[styles.card, { backgroundColor: p.secondary, borderColor: p.border }]}>
          {/* Üst accent şeridi */}
          <LinearGradient
            colors={[p.accent, p.bold || p.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topStrip}
          />

          {/* Mini uygulama önizlemesi */}
          <View style={[styles.mockup, { backgroundColor: p.primary }]}>
            {/* Başlık çubuğu */}
            <View style={[styles.mockNav, { backgroundColor: p.secondary }]}>
              <View style={[styles.mockNavDot, { backgroundColor: p.accent }]} />
              <View style={[styles.mockNavLine, { backgroundColor: p.border }]} />
              <View style={[styles.mockAvatar, { backgroundColor: p.between }]} />
            </View>

            {/* Poster rayı — film uygulaması hissi */}
            <View style={styles.mockRail}>
              <View style={[styles.mockPoster, { backgroundColor: alpha(p.accent, 0.85) }]} />
              <View style={[styles.mockPoster, { backgroundColor: p.between }]} />
              <View style={[styles.mockPoster, { backgroundColor: p.secondary }]} />
            </View>

            {/* Metin satırı */}
            <View style={styles.mockLines}>
              <View style={[styles.mockLine, { backgroundColor: p.between, width: "72%" }]} />
            </View>

            {/* Alt tab bar */}
            <View
              style={[
                styles.mockTabBar,
                { backgroundColor: p.secondary, borderTopColor: p.border },
              ]}
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.mockTabDot,
                    { backgroundColor: i === 1 ? p.accent : p.border },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Footer: gerçek palet swatch'ları + tema adı */}
          <View style={[styles.cardFooter, { backgroundColor: p.secondary }]}>
            <View style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: p.primary, borderColor: p.border }]} />
              <View style={[styles.swatch, styles.swatchOverlap, { backgroundColor: p.accent, borderColor: p.secondary }]} />
              <View style={[styles.swatch, styles.swatchOverlap, { backgroundColor: p.bold || p.between, borderColor: p.secondary }]} />
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardLabel, { color: p.text.primary }]}
            >
              {label}
            </Text>
          </View>

          {/* Seçim rozeti */}
          <Animated.View
            style={[styles.checkBadge, { backgroundColor: p.accent }, checkStyle]}
          >
            <Ionicons name="checkmark" size={10} color="#fff" />
          </Animated.View>

          {/* Düzenleme rozeti (yalnızca özel temalar) */}
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.duzenle", "Düzenle")}
              onPress={onEdit}
              hitSlop={10}
              style={[styles.editBadge, { backgroundColor: p.secondary, borderColor: p.border }]}
            >
              <Ionicons name="create-outline" size={11} color={p.text.primary} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
};

/* ── Yeni tema oluştur kartı ────────────────────────────────────────────── */
const AddThemeCard = ({ theme, label, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={styles.cardWrapper}
  >
    <View style={styles.ringPlaceholder}>
      <LinearGradient
        colors={[alpha(theme.accent, 0.18), alpha(theme.bold || theme.accent, 0.06)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.addCard, { borderColor: alpha(theme.accent, 0.5) }]}
      >
        <View style={[styles.addIcon, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={20} color="#fff" />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[styles.addLabel, { color: theme.text.primary }]}
        >
          {label}
        </Text>
      </LinearGradient>
    </View>
  </Pressable>
);

export default function SettingsTheme() {
  const { t } = useLanguage();
  const { selectedTheme, changeTheme, theme, customThemes = [] } = useTheme();
  const navigation = useNavigation();

  const openEditor = (themeId) =>
    navigation.navigate("CustomThemeScreen", themeId ? { themeId } : undefined);

  const handleSelect = (key) => {
    if (key === selectedTheme) return;
    Haptics.selectionAsync().catch(() => {});
    changeTheme(key);
  };

  // Aktif temanın görünen adı (özet satırı için).
  const activeLabel = useMemo(() => {
    if (typeof selectedTheme === "string" && selectedTheme.startsWith("custom:")) {
      const id = selectedTheme.slice("custom:".length);
      const ct = customThemes.find((c) => c.id === id);
      return ct?.name || i18nText("autoI18n.ozel_tema", "Özel Tema");
    }
    const cfg = THEME_CONFIGS.find((c) => c.key === selectedTheme);
    return (cfg && (t[cfg.labelKey] || cfg.key)) || String(selectedTheme || "");
  }, [selectedTheme, customThemes, t]);

  const lightActive = isLightPalette(theme);

  return (
    <View style={styles.container}>
      {/* Aktif tema özeti */}
      <View style={styles.summaryRow}>
        <LinearGradient
          colors={[theme.accent, theme.bold || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryOrb}
        >
          <Ionicons name="color-palette" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            style={[styles.summaryKicker, { color: theme.text.muted }]}
          >
            {i18nText("autoI18n.aktif_tema", "Aktif tema").toUpperCase()}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.summaryName, { color: theme.text.primary }]}
          >
            {activeLabel}
          </Text>
        </View>
        <View style={[styles.modePill, { backgroundColor: alpha(theme.accent, 0.12) }]}>
          <Ionicons
            name={lightActive ? "sunny" : "moon"}
            size={11}
            color={theme.accent}
          />
          <Text allowFontScaling={false} style={[styles.modePillText, { color: theme.accent }]}>
            {lightActive
              ? i18nText("autoI18n.acik", "Açık")
              : i18nText("autoI18n.koyu", "Koyu")}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
      >
        {THEME_CONFIGS.map((cfg) => (
          <ThemeCard
            key={cfg.key}
            themeKey={cfg.key}
            isSelected={selectedTheme === cfg.key}
            onPress={() => handleSelect(cfg.key)}
            label={t[cfg.labelKey] || cfg.key}
          />
        ))}

        {/* Kaydedilmiş özel temalar — her biri seçilebilir + düzenlenebilir */}
        {customThemes.map((ct) => (
          <ThemeCard
            key={ct.id}
            themeKey={`custom:${ct.id}`}
            palette={buildCustomTheme(ct.tokens)}
            isSelected={selectedTheme === `custom:${ct.id}`}
            onPress={() => handleSelect(`custom:${ct.id}`)}
            onEdit={() => openEditor(ct.id)}
            label={ct.name || i18nText("autoI18n.ozel_tema", "Özel Tema")}
          />
        ))}

        {/* Yeni özel tema oluştur kartı */}
        <AddThemeCard
          theme={theme}
          label={i18nText("autoI18n.ct_olustur", "Tema Oluştur")}
          onPress={() => openEditor()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dış çerçeveyi SettingsScreen'in kartı sağlıyor — burada ikinci bir
  // kenarlık/gölge katmanı (kart-içinde-kart) bilinçli olarak yok.
  container: {
    paddingBottom: 4,
  },

  /* Aktif tema özeti */
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
  },
  summaryOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summaryName: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modePillText: {
    fontSize: 10.5,
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    alignItems: "center",
  },

  /* Kart */
  cardWrapper: {
    padding: 4, // scale animasyonu için taşma payı
  },
  ring: {
    borderRadius: 16,
    padding: 3,
  },
  ringPlaceholder: {
    padding: 3,
  },
  card: {
    width: CARD_W,
    borderRadius: 13,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },

  /* Üst accent şeridi */
  topStrip: {
    height: 3,
    width: "100%",
  },

  /* Mini uygulama önizlemesi */
  mockup: {
    height: 86,
    overflow: "hidden",
  },
  mockNav: {
    height: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    gap: 4,
  },
  mockNavDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  mockNavLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  mockAvatar: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mockRail: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingTop: 6,
  },
  mockPoster: {
    width: 22,
    height: 30,
    borderRadius: 4,
  },
  mockLines: {
    flex: 1,
    paddingHorizontal: 7,
    paddingTop: 6,
  },
  mockLine: {
    height: 5,
    borderRadius: 3,
  },
  mockTabBar: {
    height: 17,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    borderTopWidth: 1,
  },
  mockTabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  /* Footer: swatch üçlüsü + ad */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  swatchOverlap: {
    marginLeft: -3,
  },
  cardLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    flex: 1,
  },

  /* Yeni tema kartı — yükseklik = şerit 3 + mockup 86 + footer ~22 */
  addCard: {
    width: CARD_W,
    height: 111,
    borderRadius: 13,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 8,
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 3,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  /* Düzenleme rozeti (özel temalar) */
  editBadge: {
    position: "absolute",
    top: 7,
    left: 6,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Seçim rozeti */
  checkBadge: {
    position: "absolute",
    top: 7,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});
