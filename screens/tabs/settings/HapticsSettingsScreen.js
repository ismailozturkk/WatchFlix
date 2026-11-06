// screens/tabs/settings/HapticsSettingsScreen.js
//
// Ayarlar > Görünüm > Titreşim. Ana anahtar + üç ince ayar ekseni:
//   NE ZAMAN  (düzey)     Az · Dengeli · Bol
//   GÜÇ       (şiddet)    Hafif · Normal · Güçlü
//   NEREDE    (kategori)  6 alan, ayrı ayrı açılıp kapanır
// ve "desen kitaplığı": her örnek desene dokunup hissetme.
//
// Tercihler hapticsService'in (tek sahip) setter'larıyla yazılır; ana anahtar
// AppSettingsContext.changeHapticsEnabled'dan geçer (açınca önizleme titreşimi).
// Katalog ve platform eşlemesi: utils/hapticPatterns.js.

import React, { useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useHapticsSettings } from "@context/AppSettingsContext";
import { alpha } from "@theme/colors";
import useHapticPrefs from "../../../hooks/useHapticPrefs";
import {
  HAPTIC_CATEGORIES,
  HAPTIC_INTENSITIES,
  HAPTIC_LEVELS,
  HAPTIC_SAMPLES,
  previewPattern,
  setHapticCategory,
  setHapticIntensity,
  setHapticLevel,
} from "../../../services/hapticsService";
import { DEFAULT_HAPTIC_INTENSITY, DEFAULT_HAPTIC_LEVEL } from "../../../utils/hapticPatterns";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import { SettingsSubScreen, SettingRow, SectionLabel, buildUiColors } from "./settingsUi";
import { getHapticsCopy } from "./hapticsCopy";

const LEVEL_ICONS = {
  minimal: "water-outline",
  balanced: "options-outline",
  rich: "sparkles-outline",
};
// Düzey seçilince o düzeyin "karakterini" gösteren desen.
const LEVEL_PREVIEW = { minimal: "success", balanced: "toggleOn", rich: "tap" };

const INTENSITY_ICONS = {
  soft: "radio-button-off-outline",
  normal: "radio-button-on-outline",
  strong: "flash-outline",
};

const CATEGORY_UI = {
  navigation: { icon: "compass-outline", color: "blue", bg: "iconBlue" },
  gestures: { icon: "hand-left-outline", color: "purple", bg: "iconPurple" },
  feedback: { icon: "checkmark-done-outline", color: "green", bg: "iconGreen" },
  games: { icon: "game-controller-outline", color: "amber", bg: "iconAmber" },
  social: { icon: "chatbubbles-outline", color: "teal", bg: "iconTeal" },
  celebrations: { icon: "trophy-outline", color: "amber", bg: "iconAmber" },
};

export default function HapticsSettingsScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = useMemo(() => getHapticsCopy(language), [language]);
  const { hapticsEnabled, changeHapticsEnabled } = useHapticsSettings();
  const prefs = useHapticPrefs();
  const enabled = !!hapticsEnabled;

  const chooseLevel = useCallback((level) => {
    setHapticLevel(level);
    previewPattern(LEVEL_PREVIEW[level]);
  }, []);

  const chooseIntensity = useCallback((intensity) => {
    setHapticIntensity(intensity);
    previewPattern("added", { intensity });
  }, []);

  // Anahtarın kendisi açma/kapama hissini verir (iOS: UISwitch, Android: SwitchToggle);
  // alanın desenini denemek için satıra dokunulur.
  const toggleCategory = useCallback((category, on) => {
    setHapticCategory(category, on);
  }, []);

  const customized =
    prefs.level !== DEFAULT_HAPTIC_LEVEL ||
    prefs.intensity !== DEFAULT_HAPTIC_INTENSITY ||
    HAPTIC_CATEGORIES.some((id) => !prefs.categories[id]);

  const resetAll = useCallback(() => {
    setHapticLevel(DEFAULT_HAPTIC_LEVEL);
    setHapticIntensity(DEFAULT_HAPTIC_INTENSITY);
    HAPTIC_CATEGORIES.forEach((id) => setHapticCategory(id, true));
    previewPattern("success");
  }, []);

  return (
    <SettingsSubScreen title={copy.title}>
      <GlassBox role="card" style={[s.card, s.firstCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconAmber}
          iconColor={C.amber}
          iconName={enabled ? "phone-portrait-outline" : "phone-portrait"}
          title={copy.masterTitle}
          subtitle={copy.masterSub}
          right={<SwitchToggle value={enabled} onValueChange={changeHapticsEnabled} size={36} />}
          last
        />
      </GlassBox>

      <Text allowFontScaling={false} style={[s.intro, { color: C.muted }]}>
        {enabled ? copy.intro : copy.offHint}
      </Text>

      <View
        pointerEvents={enabled ? "auto" : "none"}
        style={{ opacity: enabled ? 1 : 0.45 }}
        accessibilityElementsHidden={!enabled}
        importantForAccessibility={enabled ? "auto" : "no-hide-descendants"}
      >
        {/* ── NE ZAMAN ── */}
        <SectionLabel color={C.muted}>{copy.levelLabel}</SectionLabel>
        <GlassBox role="card" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {HAPTIC_LEVELS.map((level, index) => {
            const selected = prefs.level === level;
            const [name, hint] = copy.levels[level];
            return (
              <SettingRow
                key={level}
                colors={C}
                iconBg={selected ? C.accentDim : C.cardAlt}
                iconColor={selected ? C.accent : C.muted}
                iconName={LEVEL_ICONS[level]}
                title={name}
                subtitle={hint}
                onPress={() => chooseLevel(level)}
                last={index === HAPTIC_LEVELS.length - 1}
                right={
                  <AppIcon
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={selected ? C.accent : C.borderMuted}
                  />
                }
              />
            );
          })}
        </GlassBox>

        {/* ── GÜÇ ── */}
        <SectionLabel color={C.muted}>{copy.intensityLabel}</SectionLabel>
        <GlassBox role="card" style={[s.card, s.cardPadded, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.segmentRow}>
            {HAPTIC_INTENSITIES.map((intensity) => {
              const selected = prefs.intensity === intensity;
              return (
                <GlassTouchable
                  key={intensity}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  activeOpacity={0.7}
                  onPress={() => chooseIntensity(intensity)}
                  style={[
                    s.segment,
                    {
                      backgroundColor: selected ? alpha(C.accent, 0.16) : C.cardAlt,
                      borderColor: selected ? C.accent : C.borderMuted,
                    },
                  ]}
                >
                  <AppIcon
                    name={INTENSITY_ICONS[intensity]}
                    size={15}
                    color={selected ? C.accent : C.muted}
                  />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[s.segmentLabel, { color: selected ? C.text : C.muted, fontWeight: selected ? "700" : "500" }]}
                  >
                    {copy.intensities[intensity]}
                  </Text>
                </GlassTouchable>
              );
            })}
          </View>
          <Text allowFontScaling={false} style={[s.segmentHint, { color: C.muted }]}>
            {copy.intensityHint[prefs.intensity]}
          </Text>
        </GlassBox>

        {/* ── NEREDE ── */}
        <SectionLabel color={C.muted}>{copy.categoryLabel}</SectionLabel>
        <GlassBox role="card" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {HAPTIC_CATEGORIES.map((category, index) => {
            const ui = CATEGORY_UI[category];
            const [name, hint] = copy.categories[category];
            const on = prefs.categories[category] !== false;
            return (
              <SettingRow
                key={category}
                colors={C}
                iconBg={C[ui.bg]}
                iconColor={C[ui.color]}
                iconName={ui.icon}
                title={name}
                subtitle={hint}
                onPress={() => previewPattern(HAPTIC_SAMPLES[category][0])}
                last={index === HAPTIC_CATEGORIES.length - 1}
                right={
                  <SwitchToggle
                    value={on}
                    onValueChange={(next) => toggleCategory(category, next)}
                    size={36}
                    accessibilityLabel={name}
                  />
                }
              />
            );
          })}
        </GlassBox>
        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {copy.categoryHint}
        </Text>

        {/* ── DESEN KİTAPLIĞI ── */}
        <SectionLabel color={C.muted}>{copy.libraryLabel}</SectionLabel>
        <GlassBox role="card" style={[s.card, s.cardPadded, { backgroundColor: C.card, borderColor: C.border }]}>
          {HAPTIC_CATEGORIES.map((category, index) => {
            const ui = CATEGORY_UI[category];
            const tint = C[ui.color];
            return (
              <View key={category} style={[s.libraryGroup, index > 0 && s.libraryGroupGap]}>
                <View style={s.libraryHead}>
                  <AppIcon name={ui.icon} size={12} color={tint} />
                  <Text allowFontScaling={false} style={[s.libraryTitle, { color: C.muted }]}>
                    {copy.categories[category][0]}
                  </Text>
                </View>
                <View style={s.chipWrap}>
                  {HAPTIC_SAMPLES[category].map((name) => (
                    <GlassTouchable
                      key={name}
                      accessibilityRole="button"
                      activeOpacity={0.6}
                      onPress={() => previewPattern(name)}
                      style={[s.chip, { backgroundColor: alpha(tint, 0.1), borderColor: alpha(tint, 0.35) }]}
                    >
                      <AppIcon name="pulse-outline" size={12} color={tint} />
                      <Text allowFontScaling={false} numberOfLines={1} style={[s.chipLabel, { color: C.text }]}>
                        {copy.patterns[name] ?? name}
                      </Text>
                    </GlassTouchable>
                  ))}
                </View>
              </View>
            );
          })}
        </GlassBox>
        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {copy.libraryHint}
        </Text>

        <Text allowFontScaling={false} style={[s.note, s.platformNote, { color: C.muted }]}>
          {Platform.OS === "android" ? copy.noteAndroid : copy.noteIos}
        </Text>

        {customized ? (
          <GlassTouchable
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={resetAll}
            style={[s.reset, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <View style={[s.iconWrap, { backgroundColor: C.iconAmber }]}>
              <AppIcon name="refresh-outline" size={16} color={C.amber} />
            </View>
            <View style={s.resetTexts}>
              <Text allowFontScaling={false} style={[s.resetTitle, { color: C.text }]}>
                {copy.reset}
              </Text>
              <Text allowFontScaling={false} style={[s.resetSub, { color: C.muted }]}>
                {copy.resetSub}
              </Text>
            </View>
          </GlassTouchable>
        ) : null}
      </View>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  firstCard: { marginTop: 8 },
  cardPadded: { padding: 14 },
  intro: { fontSize: 12, lineHeight: 17, marginTop: 10, marginHorizontal: 4 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  segmentLabel: { fontSize: 13, flexShrink: 1 },
  segmentHint: { fontSize: 11, lineHeight: 15, marginTop: 10, textAlign: "center" },
  note: { fontSize: 11, lineHeight: 15, marginTop: 8, marginHorizontal: 4 },
  platformNote: { marginTop: 18 },
  libraryGroup: {},
  libraryGroupGap: { marginTop: 14 },
  libraryHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  libraryTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipLabel: { fontSize: 12, fontWeight: "500" },
  reset: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  resetTexts: { flex: 1 },
  resetTitle: { fontSize: 14, fontWeight: "500" },
  resetSub: { fontSize: 11, marginTop: 2 },
});
