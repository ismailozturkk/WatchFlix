// Ayarlar → Görünüm: tema seçici.
//
// Tasarım dili:
//   • Üstte "aktif tema" özet satırı — seçili temanın adı, gradyan renk karosu
//     ve koyu/açık rozeti kaydırmadan görünür (durum görünürlüğü).
//   • Kartlar mini film-uygulaması önizlemesi taşır: başlık çubuğu, play
//     düğmeli öne çıkan banner, poster rayı ve alt tab bar — tema gerçek
//     arayüzde nasıl duracaksa o hissi verir.
//   • Footer'da tema adı + gerçek renk swatch üçlüsü; seçim accent halka,
//     yumuşak büyüme ve check rozetiyle vurgulanır. Basınca yaylı küçülme,
//     kart-kart snap kaydırma ve seçimde haptic tık.
//   • Liste açılışta seçili temaya kayar (8 hazır + özel temalarda seçili kart
//     ekran dışında kalmasın); uçlarda solma, devamı olduğunu söyler.
import { tmdbLanguageOf } from "../../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { usePremiumGate } from "../../../hooks/usePremiumGate";

const THEME_CONFIGS = [
  { key: "gray", icon: "contrast", labelKey: "grayTheme" },
  { key: "dark", icon: "moon", labelKey: "darkTheme" },
  { key: "light", icon: "sunny", labelKey: "lightTheme" },
  { key: "sky", icon: "cloud", labelKey: "skyTheme" },
  { key: "blue", icon: "water", labelKey: "blueTheme" },
  { key: "green", icon: "leaf", labelKey: "greenTheme" },
  { key: "purple", icon: "planet", labelKey: "purpleTheme" },
  { key: "amber", icon: "film", labelKey: "amberTheme" },
];

const CARD_W = 104;
const MOCK_H = 94;
const FOOTER_H = 30;
// halka padding (3×2) + wrapper padding (4×2) + kartlar arası gap (10)
const SNAP_INTERVAL = CARD_W + 6 + 8 + 10;
// Kenar solması genişliği ve "uçtayım" eşiği (px).
const FADE_W = 22;
const EDGE_EPS = 4;

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
// `locked`: Premium'a özel (plan Free'ye düşmüş kullanıcının özel teması).
// Kart görünür kalır — kullanıcı neyin geri geleceğini görsün — ama soluk
// çizilir ve köşesinde elmas rozeti durur.
const ThemeCard = ({ themeKey, isSelected, onPress, label, palette, onEdit, locked = false }) => {
  const p = palette || themes[themeKey] || themes.gray;

  const scale = useSharedValue(isSelected ? 1.05 : 1);
  const pressed = useSharedValue(1);
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
    transform: [{ scale: scale.value * pressed.value }],
    borderWidth: ringWidth.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkOpacity.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(0.95, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(1, { mass: 0.4, damping: 12, stiffness: 180 });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={styles.cardWrapper}
    >
      {/* Seçim halkası: karttan 3px açıkta duran accent çerçeve */}
      <Animated.View style={[styles.ring, { borderColor: p.accent }, ringStyle]}>
        <View
          style={[
            styles.card,
            { backgroundColor: p.secondary, borderColor: p.border },
            locked && styles.cardLocked,
          ]}
        >
          {/* Mini uygulama önizlemesi */}
          <View style={[styles.mockup, { backgroundColor: p.primary }]}>
            {/* Başlık çubuğu */}
            <View style={[styles.mockNav, { backgroundColor: p.secondary }]}>
              <View style={[styles.mockNavDot, { backgroundColor: p.accent }]} />
              <View style={[styles.mockNavLine, { backgroundColor: p.border }]} />
              <View style={[styles.mockAvatar, { backgroundColor: p.between }]} />
            </View>

            <View style={styles.mockBody}>
              {/* Öne çıkan banner: accent gradyanı + play düğmesi */}
              <LinearGradient
                colors={[p.accent, p.bold || p.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mockBanner}
              >
                <View style={styles.mockBannerCopy}>
                  <View style={[styles.mockBannerLine, { width: "78%" }]} />
                  <View style={[styles.mockBannerLine, styles.mockBannerLineThin, { width: "48%" }]} />
                </View>
                <View style={styles.mockPlay}>
                  <Ionicons name="play" size={7} color="#fff" />
                </View>
              </LinearGradient>

              {/* Poster rayı — film uygulaması hissi */}
              <View style={styles.mockRail}>
                <View style={[styles.mockPoster, { backgroundColor: alpha(p.accent, 0.85) }]} />
                <View style={[styles.mockPoster, { backgroundColor: p.between }]} />
                <View style={[styles.mockPoster, { backgroundColor: p.secondary, borderColor: p.border, borderWidth: 1 }]} />
                <View style={[styles.mockPoster, { backgroundColor: p.between }]} />
              </View>
            </View>

            {/* Alt tab bar: aktif sekme hap şeklinde */}
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
                    i === 1
                      ? { backgroundColor: p.accent, width: 15 }
                      : { backgroundColor: p.border },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Footer: tema adı + gerçek palet swatch'ları */}
          <View
            style={[
              styles.cardFooter,
              { backgroundColor: p.secondary, borderTopColor: p.border },
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardLabel, { color: p.text.primary }]}
            >
              {label}
            </Text>
            <View style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: p.primary, borderColor: p.border }]} />
              <View style={[styles.swatch, styles.swatchOverlap, { backgroundColor: p.accent, borderColor: p.secondary }]} />
              <View style={[styles.swatch, styles.swatchOverlap, { backgroundColor: p.bold || p.between, borderColor: p.secondary }]} />
            </View>
          </View>

          {/* Seçim rozeti */}
          <Animated.View
            style={[styles.checkBadge, { backgroundColor: p.accent }, checkStyle]}
          >
            <Ionicons name="checkmark" size={10} color="#fff" />
          </Animated.View>

          {locked ? (
            <View style={[styles.lockBadge, { backgroundColor: p.accent }]}>
              <Ionicons name="diamond" size={10} color="#fff" />
            </View>
          ) : null}

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
// Kesik çizgili çerçeve "buraya yeni bir şey eklenir" der; hazır temalardan
// bir bakışta ayrılır.
const AddThemeCard = ({ theme, label, onPress, locked = false }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={styles.cardWrapper}
  >
    <View style={styles.ringPlaceholder}>
      <LinearGradient
        colors={[alpha(theme.accent, 0.16), alpha(theme.bold || theme.accent, 0.04)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.addCard, { borderColor: alpha(theme.accent, 0.55) }]}
      >
        <View style={[styles.addIcon, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={20} color="#fff" />
        </View>
        {locked ? (
          <View style={[styles.lockBadge, styles.addLockBadge, { backgroundColor: theme.accent }]}>
            <Ionicons name="diamond" size={10} color="#fff" />
          </View>
        ) : null}
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
  const { t, language } = useLanguage();
  const {
    selectedTheme,
    appliedTheme = selectedTheme,
    customThemesAllowed = true,
    changeTheme,
    theme,
    customThemes = [],
  } = useTheme();
  const navigation = useNavigation();
  // Özel tema oluşturma/uygulama Premium'da (utils/premiumFeatures.js).
  const customThemesGate = usePremiumGate("custom_themes");
  const customLocked = !customThemesAllowed;

  const openEditor = (themeId) => {
    if (customLocked) {
      customThemesGate.showUpsell();
      return;
    }
    navigation.navigate("CustomThemeScreen", themeId ? { themeId } : undefined);
  };

  const handleSelect = (key) => {
    if (key.startsWith("custom") && customLocked) {
      customThemesGate.showUpsell();
      return;
    }
    if (key === selectedTheme) return;
    Haptics.selectionAsync().catch(() => {});
    changeTheme(key);
  };

  // ÇİZİLEN temanın görünen adı (özet satırı için). Kilitli özel tema
  // seçiliyken varsayılan hazır tema çizilir; özet onu söyler.
  const activeLabel = useMemo(() => {
    if (typeof appliedTheme === "string" && appliedTheme.startsWith("custom:")) {
      const id = appliedTheme.slice("custom:".length);
      const ct = customThemes.find((c) => c.id === id);
      return ct?.name || i18nText("autoI18n.ozel_tema", "Özel Tema");
    }
    const cfg = THEME_CONFIGS.find((c) => c.key === appliedTheme);
    return (cfg && (t[cfg.labelKey] || cfg.key)) || String(appliedTheme || "");
  }, [appliedTheme, customThemes, t]);
  const lockedCustomSelected =
    customLocked && typeof selectedTheme === "string" && selectedTheme.startsWith("custom");

  const lightActive = isLightPalette(theme);

  /* ── Kaydırma: açılışta seçiliye git + uç solmaları ── */
  const scrollRef = useRef(null);
  const viewW = useRef(0);
  const contentW = useRef(0);
  const didInitialScroll = useRef(false);
  const [edge, setEdge] = useState({ start: true, end: false });

  const scrollToSelected = () => {
    if (didInitialScroll.current || !viewW.current || !contentW.current) return;
    const keys = [
      ...THEME_CONFIGS.map((c) => c.key),
      ...customThemes.map((c) => `custom:${c.id}`),
    ];
    const found = keys.indexOf(appliedTheme);
    // Seçili özel tema listede yoksa özel temalar henüz gelmemiş demektir;
    // içerik büyüyünce onContentSizeChange yeniden dener.
    if (found === -1 && String(appliedTheme).startsWith("custom:")) return;
    didInitialScroll.current = true;
    const idx = Math.max(0, found);
    // Seçili kartı soldan ikinci sıraya getir: öncesinden bir kart görünür,
    // bağlam kopmaz. Hedef snap ızgarasının katı (hizalama bozulmaz).
    const max = Math.max(0, contentW.current - viewW.current);
    const x = Math.min(max, Math.max(0, (idx - 1) * SNAP_INTERVAL));
    if (x > 0) scrollRef.current?.scrollTo({ x, animated: false });
  };

  const updateEdges = (e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const start = contentOffset.x <= EDGE_EPS;
    const end = contentOffset.x + layoutMeasurement.width >= contentSize.width - EDGE_EPS;
    // Aynı değerde önceki nesneyi döndürmek yeniden çizimi atlar (scroll her karede çağırır).
    setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  };

  const fadeSolid = theme.secondary;
  const fadeClear = alpha(theme.secondary, 0);

  return (
    <View style={styles.container}>
      {/* Aktif tema özeti */}
      <View style={styles.summaryRow}>
        <LinearGradient
          colors={[theme.accent, theme.bold || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryTile}
        >
          <Ionicons name="color-palette" size={19} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            style={[styles.summaryKicker, { color: theme.text.muted }]}
          >
            {/* Yerelli büyütme: düz toUpperCase() "Aktif"i "AKTIF" yapıyor (noktalı İ kaybolur) */}
            {i18nText("autoI18n.aktif_tema", "Aktif tema").toLocaleUpperCase(
              tmdbLanguageOf(language),
            )}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.summaryName, { color: theme.text.primary }]}
          >
            {activeLabel}
          </Text>
        </View>
        <View style={[styles.modePill, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.22) }]}>
          <Ionicons
            name={lightActive ? "sunny" : "moon"}
            size={12}
            color={theme.accent}
          />
          <Text allowFontScaling={false} style={[styles.modePillText, { color: theme.accent }]}>
            {lightActive
              ? i18nText("autoI18n.acik", "Açık")
              : i18nText("autoI18n.koyu", "Koyu")}
          </Text>
        </View>
      </View>

      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          scrollEventThrottle={32}
          onScroll={updateEdges}
          onLayout={(e) => {
            viewW.current = e.nativeEvent.layout.width;
            scrollToSelected();
          }}
          onContentSizeChange={(w) => {
            contentW.current = w;
            scrollToSelected();
          }}
        >
          {THEME_CONFIGS.map((cfg) => (
            <ThemeCard
              key={cfg.key}
              themeKey={cfg.key}
              isSelected={appliedTheme === cfg.key}
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
              isSelected={appliedTheme === `custom:${ct.id}`}
              onPress={() => handleSelect(`custom:${ct.id}`)}
              onEdit={() => openEditor(ct.id)}
              label={ct.name || i18nText("autoI18n.ozel_tema", "Özel Tema")}
              locked={customLocked}
            />
          ))}

          {/* Yeni özel tema oluştur kartı */}
          <AddThemeCard
            theme={theme}
            label={i18nText("autoI18n.ct_olustur", "Tema Oluştur")}
            onPress={() => openEditor()}
            locked={customLocked}
          />
        </ScrollView>

        {/* Uç solmaları: listenin devam ettiğini söyler, dokunuşu engellemez */}
        {edge.start ? null : (
          <LinearGradient
            pointerEvents="none"
            colors={[fadeSolid, fadeClear]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fade, styles.fadeLeft]}
          />
        )}
        {edge.end ? null : (
          <LinearGradient
            pointerEvents="none"
            colors={[fadeClear, fadeSolid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fade, styles.fadeRight]}
          />
        )}
      </View>

      {lockedCustomSelected ? (
        <Text
          allowFontScaling={false}
          style={[styles.lockedNote, { color: theme.text.muted }]}
        >
          {language === "tr"
            ? "Özel temaların saklı; Premium ile geri gelir. Şimdilik varsayılan tema kullanılıyor."
            : "Your custom themes are saved and return with Premium. The default theme is in use for now."}
        </Text>
      ) : null}
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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },
  summaryTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 1,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    alignItems: "center",
  },

  /* Uç solmaları */
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: FADE_W,
  },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },

  /* Kart */
  cardWrapper: {
    padding: 4, // scale animasyonu için taşma payı
  },
  ring: {
    borderRadius: 18,
    padding: 3,
  },
  ringPlaceholder: {
    padding: 3,
  },
  card: {
    width: CARD_W,
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 3,
  },

  /* Mini uygulama önizlemesi */
  mockup: {
    height: MOCK_H,
    overflow: "hidden",
  },
  mockNav: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    gap: 4,
  },
  mockNavDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mockNavLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  mockAvatar: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockBody: {
    paddingHorizontal: 7,
    paddingTop: 6,
    gap: 5,
  },
  mockBanner: {
    height: 28,
    borderRadius: 7,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mockBannerCopy: {
    flex: 1,
    gap: 3,
  },
  mockBannerLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  mockBannerLineThin: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  mockPlay: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 1, // üçgenin optik ortası
  },
  mockRail: {
    flexDirection: "row",
    gap: 4,
  },
  mockPoster: {
    flex: 1,
    height: 20,
    borderRadius: 4,
  },
  mockTabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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

  /* Footer: ad + swatch üçlüsü */
  cardFooter: {
    height: FOOTER_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderTopWidth: 1,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
  },
  swatchOverlap: {
    marginLeft: -4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },

  /* Yeni tema kartı — yükseklik = mockup + footer + kart kenarlığı (2) */
  addCard: {
    width: CARD_W,
    height: MOCK_H + FOOTER_H + 2,
    borderRadius: 15,
    borderWidth: 1.4,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  /* Premium kilidi (Free'deki özel temalar ve "Tema Oluştur") */
  cardLocked: {
    opacity: 0.62,
  },
  lockBadge: {
    position: "absolute",
    bottom: FOOTER_H + 6,
    right: 6,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addLockBadge: {
    top: 8,
    right: 8,
    bottom: undefined,
  },
  lockedNote: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
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
    elevation: 3,
  },
});
