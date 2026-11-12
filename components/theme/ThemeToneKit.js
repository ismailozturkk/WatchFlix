// components/theme/ThemeToneKit.js
//
// Tema stüdyosunun TON parçaları: ton kutusu (çok açık … AMOLED zemin) ve
// Hazır temalar ızgarası. Ortak yapı taşları ThemeStudioKit'te; burası yalnız
// "beş tonlu tema" modeline özel parçaları taşır (ton listesi theme/toneModel.js).
//
// Yerleşim kuralı (bkz. yoga-layout-harness): yüksekliği belirsiz kaplarda
// dikey `flex: 1` YOK — satırlarda yatay `flex: 1`, dikeyde sabit yükseklik.
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { alpha } from "../../theme/colors";
import { inkOn } from "./ThemeStudioKit";
import { DEFAULT_TONE, TONES } from "../../theme/toneModel";

/* ───────────────────────── Ton kutusu ───────────────────────── */

/**
 * Bir tonun zeminini gösteren küçük kutu: o tonun gerçek zemini, üstünde kart
 * yüzeyi + vurgu noktası. Basınca ton seçilir (ve zemin seçici açılır).
 * `active`: önizlenen ton — vurgu renginde kalın halka.
 */
export const ToneTile = memo(function ToneTile({ label, tokens, active, onPress, theme, compact = false }) {
  const hex = String(tokens.primary || "").toUpperCase();
  const ink = inkOn(tokens.primary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hex}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toneTile,
        compact && styles.toneTileCompact,
        {
          backgroundColor: theme.secondary,
          borderColor: active ? theme.accent : theme.border,
          borderWidth: active ? 2 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.toneSwatch, compact && styles.toneSwatchCompact, { backgroundColor: tokens.primary, borderColor: alpha(ink, 0.16) }]}>
        <View style={[styles.toneCard, { backgroundColor: tokens.secondary, borderColor: tokens.border }]}>
          <View style={[styles.toneLine, { backgroundColor: tokens.textPrimary }]} />
          <View style={[styles.toneLine, styles.toneLineThin, { backgroundColor: tokens.textMuted }]} />
        </View>
        <View style={[styles.toneAccent, compact && styles.toneAccentCompact, { backgroundColor: tokens.accent }]} />
      </View>
      <Text
        style={[styles.toneLabel, compact && styles.toneLabelCompact, { color: theme.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
      <Text style={[styles.toneHex, compact && styles.toneHexCompact, { color: theme.text.muted }]} numberOfLines={1}>{hex}</Text>
    </Pressable>
  );
});

/* ───────────────────────── Hazır tema ızgarası ───────────────────────── */

/**
 * Hazır temalar: her kart beş tonu yan yana bantlar halinde gösterir (çok açık
 * → AMOLED zemin) ve üstüne vurgu noktası koyar. `activeId`: şu an
 * düzenlenen deste bu hazır temayla aynıysa tik.
 */
export const PresetGrid = memo(function PresetGrid({ items, activeId, onPick, appliedText, theme }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onPick(item.id)}
            style={({ pressed }) => [
              styles.presetWrap,
              { backgroundColor: theme.secondary, borderColor: active ? theme.accent : theme.border, borderWidth: active ? 2 : 1 },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.presetBands}>
              {TONES.map((tone) => (
                <View key={tone} style={[styles.presetBand, { backgroundColor: item.bundle.tones[tone].primary }]}>
                  <View
                    style={[
                      styles.presetChip,
                      { backgroundColor: item.bundle.tones[tone].secondary, borderColor: item.bundle.tones[tone].border },
                    ]}
                  />
                  <View style={[styles.presetDot, { backgroundColor: item.bundle.tones[tone].accent }]} />
                </View>
              ))}
              {active ? (
                <View style={[styles.presetBadge, { backgroundColor: item.bundle.tones[DEFAULT_TONE].accent }]}>
                  <AppIcon family="Ionicons" name="checkmark" size={12} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <View style={styles.presetMeta}>
              <Text style={[styles.presetLabel, { color: theme.text.primary }]} numberOfLines={1}>{item.label}</Text>
              {active ? <Text style={[styles.presetApplied, { color: theme.accent }]}>{appliedText}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.86 },

  toneTile: { flex: 1, borderRadius: 16, padding: 8, gap: 5 },
  toneSwatch: { height: 62, borderRadius: 11, borderWidth: 1, overflow: "hidden", padding: 7 },
  toneCard: { width: "70%", borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, padding: 5, gap: 3 },
  toneLine: { width: "70%", height: 4, borderRadius: 2 },
  toneLineThin: { width: "46%", height: 3 },
  toneAccent: { position: "absolute", right: 8, bottom: 8, width: 14, height: 14, borderRadius: 7 },
  toneLabel: { fontSize: 12.5, fontWeight: "900", marginTop: 2 },
  toneHex: { fontSize: 10.5, fontWeight: "700", marginTop: -2 },
  // Beş ton tek satırda: kutu daralır, yazılar küçülür.
  toneTileCompact: { padding: 5, borderRadius: 13, gap: 4 },
  toneSwatchCompact: { height: 52, borderRadius: 9, padding: 5 },
  toneAccentCompact: { right: 5, bottom: 5, width: 10, height: 10, borderRadius: 5 },
  toneLabelCompact: { fontSize: 11, marginTop: 1 },
  toneHexCompact: { fontSize: 8.5 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  presetWrap: { width: "48.5%", borderRadius: 16, overflow: "hidden" },
  presetBands: { height: 74, flexDirection: "row" },
  presetBand: { flex: 1, padding: 4, justifyContent: "space-between" },
  presetChip: { width: "100%", height: 16, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  presetDot: { width: 8, height: 8, borderRadius: 4 },
  presetBadge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  presetMeta: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  presetLabel: { flexShrink: 1, fontSize: 12.5, fontWeight: "900" },
  presetApplied: { fontSize: 10, fontWeight: "900", marginLeft: "auto" },
});
