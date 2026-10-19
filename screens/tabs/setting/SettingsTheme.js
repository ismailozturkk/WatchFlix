// Ayarlar → Görünüm: tema seçici.
//
// Tasarım dili:
//   • Yatay kaydırılan KOMPAKT kartlar (136 x 133 dp). "Tema Oluştur" kartı
//     listenin BAŞINDA; ardından (varsa) eski hazır tema, aileler (Varsayılan,
//     Mavi, Yeşil) ve kayıtlı özel temalar gelir.
//   • Kart üç katmandır: üstte temanın gerçek renkleriyle mini uygulama önizlemesi
//     (başlık çubuğu, vurgu bannerı, poster rayı), ortada ad, altta üç BÜYÜK ton
//     düğmesi (açık · orta · koyu). Düğme tonun gerçek zemin rengidir; seçili
//     olanda vurgu halkası + tikli nokta durur. Düğme 36 dp (+ hitSlop).
//   • Karta basmak aileyi hatırlanan tonuyla seçer; bir düğmeye basmak tonu belirler.
//   • Seçili kart vurgu halkası ve önizleme köşesinde tik rozeti taşır; basınca
//     yaylı küçülme, seçimde haptic tık. Liste açılışta seçili karta kayar;
//     uçlarda solma, devamı olduğunu söyler.
//   • Tüm kartların boyu SABİT (CARD_H): seçimle kenarlık kalınlığı değişmez, bu
//     yüzden seçerken liste zıplamaz.
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import {
  LEGACY_PRESET_THEME_KEYS,
  THEME_FAMILIES,
  alpha,
  buildCustomThemeFromEntry,
  customSelectionKey,
  familyOfTheme,
  parseCustomSelection,
  themes,
} from "../../../theme/colors";
import { i18nText } from "../../../utils/i18nText";
import { usePremiumGate } from "../../../hooks/usePremiumGate";

// Ton sırası: soldan sağa açık → orta → koyu.
const TONE_ORDER = ["light", "mid", "dark"];
const TONE_LABEL_KEYS = {
  light: "themeToneLight",
  mid: "themeToneMid",
  dark: "themeToneDark",
};
const TONE_FALLBACKS = { light: "Açık", mid: "Orta", dark: "Koyu" };

// Gece Moru / Kızıl Sinema artık listede yok (Tema Stüdyosu > Hazır temalar).
// Daha önce seçmiş olanlar için yalnız SEÇİLİYKEN tek kart olarak görünürler.
const LEGACY_LABEL_KEYS = { purple: "purpleTheme", amber: "amberTheme" };

const CARD_W = 136;
const CREATE_W = 108;
const GAP = 10;
const PAD_X = 12;
const PREVIEW_H = 44;
const TONE_BTN = 36;
const BORDER = 1.5;
const CARD_PAD = 8;
const TITLE_H = 18;
// padding x2 + önizleme + boşluk + ad + boşluk + ton düğmeleri + kenarlık x2
const CARD_H = CARD_PAD * 2 + PREVIEW_H + 8 + TITLE_H + 8 + TONE_BTN + BORDER * 2;
// Kenar solması genişliği ve "uçtayım" eşiği (px).
const FADE_W = 22;
const EDGE_EPS = 4;

/* ── Mini uygulama önizlemesi ───────────────────────────────────────────── */
// Temanın gerçek zemini, üst çubuğu, vurgu bannerı ve poster rayı: tema gerçek
// arayüzde nasıl duracaksa o his.
const Preview = ({ p }) => (
  <View style={[styles.preview, { backgroundColor: p.primary, borderColor: p.border }]}>
    <View style={[styles.previewBar, { backgroundColor: p.secondary }]}>
      <View style={[styles.previewDot, { backgroundColor: p.accent }]} />
      <View style={[styles.previewLine, { backgroundColor: p.border }]} />
    </View>
    <View style={styles.previewBody}>
      <LinearGradient
        colors={[p.accent, p.bold || p.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.previewHero}
      />
      <View style={styles.previewRail}>
        <View style={[styles.previewPoster, { backgroundColor: p.between }]} />
        <View style={[styles.previewPoster, { backgroundColor: p.secondary, borderColor: p.border, borderWidth: 1 }]} />
        <View style={[styles.previewPoster, { backgroundColor: p.between }]} />
        <View style={[styles.previewPoster, { backgroundColor: p.secondary, borderColor: p.border, borderWidth: 1 }]} />
      </View>
    </View>
  </View>
);

/* ── Ton düğmesi ────────────────────────────────────────────────────────── */
// Tonun GERÇEK zemin rengi; ortadaki nokta o tonun vurgusu. Seçili: vurgu
// halkası + büyük tikli nokta. Gösterilen ama seçili olmayan (aile başka bir
// tonda hatırlanıyor): yalnız halka.
const ToneButton = ({ palette, active, selected, ringColor, label, onPress }) => (
  <Pressable
    onPress={onPress}
    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
    style={({ pressed }) => [
      styles.toneBtn,
      {
        backgroundColor: palette.primary,
        borderColor: active ? ringColor : palette.border,
        borderWidth: active ? 2 : 1,
      },
      pressed && styles.pressed,
    ]}
  >
    {selected ? (
      <View style={[styles.toneCheck, { backgroundColor: palette.accent }]}>
        <Ionicons name="checkmark" size={11} color="#fff" />
      </View>
    ) : (
      <View style={[styles.toneDot, { backgroundColor: palette.accent }]} />
    )}
  </Pressable>
);

/* ── Basınca yaylı küçülen kart ─────────────────────────────────────────── */
// Pressable dış kabuk (dokunma + erişilebilirlik); görünür kart içindeki
// Animated.View — ölçek dokunma alanını değil yalnız görüntüyü küçültür.
const PressCard = ({ onPress, label, selected, children, style }) => {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { mass: 0.4, damping: 12, stiffness: 180 });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
};

/* ── Tema kartı ─────────────────────────────────────────────────────────── */
// `tones` verilirse kart üç tonludur (aile / özel tema); yoksa tek tema (eski
// hazır tema, yalnız seçiliyken görünür). `locked`: Premium'a özel (plan Free'ye
// düşmüş kullanıcının özel teması) — soluk çizilir, köşede elmas durur.
const ThemeCard = ({
  label,
  selected,
  tones,
  palette,
  displayTone = "mid",
  toneLabels,
  onPress,
  onTone,
  onEdit,
  editLabel,
  locked = false,
  theme,
}) => {
  const p = (tones && tones[displayTone]) || palette;
  return (
    <PressCard
      onPress={onPress}
      label={label}
      selected={selected}
      style={[
        styles.card,
        {
          backgroundColor: selected ? alpha(p.accent, 0.12) : alpha(theme.text.primary, 0.04),
          borderColor: selected ? p.accent : theme.border,
        },
        locked && styles.cardLocked,
      ]}
    >
      <View>
        <Preview p={p} />
        {selected ? (
          <View style={[styles.badge, styles.badgeRight, { backgroundColor: p.accent }]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        ) : null}
        {locked ? (
          <View style={[styles.badge, styles.badgeRight, { backgroundColor: p.accent }]}>
            <Ionicons name="diamond" size={9} color="#fff" />
          </View>
        ) : null}
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            onPress={onEdit}
            hitSlop={10}
            style={[styles.badge, styles.badgeLeft, { backgroundColor: p.secondary, borderColor: p.border, borderWidth: 1 }]}
          >
            <Ionicons name="create-outline" size={11} color={p.text.primary} />
          </Pressable>
        ) : null}
      </View>

      <Text allowFontScaling={false} numberOfLines={1} style={[styles.cardTitle, { color: theme.text.primary }]}>
        {label}
      </Text>

      {tones ? (
        <View style={styles.toneRow}>
          {TONE_ORDER.map((tone) => (
            <ToneButton
              key={tone}
              palette={tones[tone]}
              active={displayTone === tone}
              selected={selected && displayTone === tone}
              ringColor={p.accent}
              label={`${label} · ${toneLabels[tone]}`}
              onPress={() => onTone(tone)}
            />
          ))}
        </View>
      ) : null}
    </PressCard>
  );
};

/* ── Yeni tema oluştur kartı ────────────────────────────────────────────── */
// Kesik çizgili çerçeve "buraya yeni bir şey eklenir" der; listenin BAŞINDA durur.
const CreateCard = ({ theme, label, sub, onPress, locked }) => (
  <PressCard onPress={onPress} label={label} style={styles.createWrap}>
    <LinearGradient
      colors={[alpha(theme.accent, 0.18), alpha(theme.bold || theme.accent, 0.05)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.create, { borderColor: alpha(theme.accent, 0.55) }]}
    >
      <LinearGradient
        colors={[theme.accent, theme.bold || theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.createIcon}
      >
        <Ionicons name="color-wand" size={20} color="#fff" />
      </LinearGradient>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.createLabel, { color: theme.text.primary }]}>
        {label}
      </Text>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.createSub, { color: theme.text.muted }]}>
        {sub}
      </Text>
      {locked ? (
        <View style={[styles.badge, styles.badgeRight, { backgroundColor: theme.accent }]}>
          <Ionicons name="diamond" size={9} color="#fff" />
        </View>
      ) : null}
    </LinearGradient>
  </PressCard>
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

  // Aile başına hatırlanan ton: karta (düğmeye değil) basınca aile, kullanıcının
  // son baktığı tonla açılır; hiç bakılmadıysa orta ton.
  const [rememberedTones, setRememberedTones] = useState({});

  const toneLabels = useMemo(
    () => ({
      light: t[TONE_LABEL_KEYS.light] || TONE_FALLBACKS.light,
      mid: t[TONE_LABEL_KEYS.mid] || TONE_FALLBACKS.mid,
      dark: t[TONE_LABEL_KEYS.dark] || TONE_FALLBACKS.dark,
    }),
    [t],
  );
  const familyLabel = (family) => t[family.labelKey] || family.fallback;

  const appliedFamily = familyOfTheme(appliedTheme);
  const appliedCustom = parseCustomSelection(appliedTheme);
  const legacyApplied = LEGACY_PRESET_THEME_KEYS.includes(appliedTheme) ? appliedTheme : null;

  // Özel temaların üç tonu (kayıtlı üç ton ya da orta tondan türetilen açık/koyu).
  const customPalettes = useMemo(
    () =>
      Object.fromEntries(
        customThemes.map((ct) => [
          ct.id,
          {
            light: buildCustomThemeFromEntry(ct, "light"),
            mid: buildCustomThemeFromEntry(ct, "mid"),
            dark: buildCustomThemeFromEntry(ct, "dark"),
          },
        ]),
      ),
    [customThemes],
  );

  // Karta ya da bir ton düğmesine basılınca.
  const selectTone = (memoryId, tone, themeKey) => {
    setRememberedTones((prev) => (prev[memoryId] === tone ? prev : { ...prev, [memoryId]: tone }));
    handleSelect(themeKey);
  };

  const lockedCustomSelected =
    customLocked && typeof selectedTheme === "string" && selectedTheme.startsWith("custom");

  const editLabel = i18nText("autoI18n.duzenle", "Düzenle");
  const legacyLabel = legacyApplied ? t[LEGACY_LABEL_KEYS[legacyApplied]] || legacyApplied : "";

  /* ── Kaydırma: açılışta seçiliye git + uç solmaları ── */
  const scrollRef = useRef(null);
  const viewW = useRef(0);
  const contentW = useRef(0);
  const didInitialScroll = useRef(false);
  const [edge, setEdge] = useState({ start: true, end: false });

  // Kart sırası: oluştur, (varsa) eski hazır tema, aileler, özel temalar.
  const scrollToSelected = () => {
    if (didInitialScroll.current || !viewW.current || !contentW.current) return;
    let index = -1; // -1: oluştur kartında kal
    if (legacyApplied) index = 0;
    else if (appliedFamily) {
      index = THEME_FAMILIES.findIndex((f) => f.id === appliedFamily.family.id);
    } else if (appliedCustom?.id) {
      const at = customThemes.findIndex((c) => c.id === appliedCustom.id);
      // Seçili özel tema listede yoksa özel temalar henüz gelmemiş demektir;
      // içerik büyüyünce onContentSizeChange yeniden dener.
      if (at === -1) return;
      index = THEME_FAMILIES.length + at;
    }
    didInitialScroll.current = true;
    if (index < 0) return;
    // Eski hazır tema yalnız seçiliyken var ve o zaman aile/özel seçili olamaz: sıra çakışmaz.
    const offset = PAD_X + CREATE_W + GAP + index * (CARD_W + GAP);
    // Seçili kartın solunda bir parça önceki kart görünsün: bağlam kopmasın.
    const max = Math.max(0, contentW.current - viewW.current);
    const x = Math.min(max, Math.max(0, offset - 40));
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
      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
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
          {/* Yeni özel tema: listenin başında */}
          <CreateCard
            theme={theme}
            label={i18nText("autoI18n.ct_olustur", "Tema Oluştur")}
            sub={i18nText("autoI18n.ct_olustur_alt", "Kendi renklerin, üç tonuyla")}
            onPress={() => openEditor()}
            locked={customLocked}
          />

          {/* Eski hazır tema (Gece Moru / Kızıl Sinema) yalnız seçiliyken görünür */}
          {legacyApplied ? (
            <ThemeCard
              label={legacyLabel}
              selected
              palette={themes[legacyApplied]}
              onPress={() => {}}
              theme={theme}
            />
          ) : null}

          {/* Renk aileleri: her biri açık · orta · koyu */}
          {THEME_FAMILIES.map((family) => {
            const selected = appliedFamily?.family.id === family.id;
            const displayTone = selected ? appliedFamily.tone : rememberedTones[family.id] || "mid";
            return (
              <ThemeCard
                key={family.id}
                label={familyLabel(family)}
                selected={selected}
                tones={{
                  light: themes[family.tones.light],
                  mid: themes[family.tones.mid],
                  dark: themes[family.tones.dark],
                }}
                displayTone={displayTone}
                toneLabels={toneLabels}
                onPress={() => selectTone(family.id, displayTone, family.tones[displayTone])}
                onTone={(tone) => selectTone(family.id, tone, family.tones[tone])}
                theme={theme}
              />
            );
          })}

          {/* Kaydedilmiş özel temalar — her biri üç tonlu, seçilebilir + düzenlenebilir */}
          {customThemes.map((ct) => {
            const memoryId = `custom:${ct.id}`;
            const selected = appliedCustom?.id === ct.id;
            const displayTone = selected ? appliedCustom.tone : rememberedTones[memoryId] || "mid";
            return (
              <ThemeCard
                key={ct.id}
                label={ct.name || i18nText("autoI18n.ozel_tema", "Özel Tema")}
                selected={selected}
                tones={customPalettes[ct.id]}
                displayTone={displayTone}
                toneLabels={toneLabels}
                onPress={() => selectTone(memoryId, displayTone, customSelectionKey(ct.id, displayTone))}
                onTone={(tone) => selectTone(memoryId, tone, customSelectionKey(ct.id, tone))}
                onEdit={() => openEditor(ct.id)}
                editLabel={editLabel}
                locked={customLocked}
                theme={theme}
              />
            );
          })}
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
        <Text allowFontScaling={false} style={[styles.lockedNote, { color: theme.text.muted }]}>
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
  container: { paddingBottom: 2 },
  pressed: { opacity: 0.85 },

  scrollContent: {
    paddingHorizontal: PAD_X,
    paddingVertical: 12,
    gap: GAP,
  },

  /* Uç solmaları */
  fade: { position: "absolute", top: 0, bottom: 0, width: FADE_W },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },

  /* Kart */
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    borderWidth: BORDER,
    padding: CARD_PAD,
    gap: 8,
  },
  cardLocked: { opacity: 0.62 },
  cardTitle: { height: TITLE_H, paddingHorizontal: 2, fontSize: 13.5, lineHeight: TITLE_H, fontWeight: "800", letterSpacing: -0.2 },

  /* Mini önizleme */
  preview: {
    height: PREVIEW_H,
    borderRadius: 11,
    borderWidth: 1,
    overflow: "hidden",
  },
  previewBar: {
    height: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  previewDot: { width: 4, height: 4, borderRadius: 2 },
  previewLine: { flex: 1, height: 2, borderRadius: 1 },
  previewBody: { paddingHorizontal: 6, paddingTop: 4, gap: 4 },
  previewHero: { height: 12, borderRadius: 4 },
  previewRail: { flexDirection: "row", gap: 3 },
  previewPoster: { flex: 1, height: 8, borderRadius: 2 },

  /* Önizleme üstü rozetler */
  badge: {
    position: "absolute",
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRight: { right: 4 },
  badgeLeft: { left: 4 },

  /* Ton düğmeleri */
  toneRow: { flexDirection: "row", justifyContent: "space-between" },
  toneBtn: {
    width: TONE_BTN,
    height: TONE_BTN,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toneDot: { width: 10, height: 10, borderRadius: 5 },
  toneCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Oluştur kartı */
  createWrap: { width: CREATE_W, height: CARD_H },
  create: {
    width: CREATE_W,
    height: CARD_H,
    borderRadius: 18,
    borderWidth: 1.4,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  createIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  createLabel: { fontSize: 12.5, fontWeight: "800", textAlign: "center" },
  createSub: { fontSize: 10.5, fontWeight: "600", textAlign: "center", lineHeight: 13 },

  lockedNote: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
});
