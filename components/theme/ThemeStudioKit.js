// components/theme/ThemeStudioKit.js
//
// Tema stüdyosunun (özel tema oluşturucu) ortak yapı taşları. Ekran yalnızca
// bunları dizer; her parça aktif UYGULAMA temasını `theme` prop'uyla alır
// (düzenlenen renk setinden bağımsızdır).
//
// Yerleşim kuralı (bkz. yoga-layout-harness): yüksekliği belirsiz kaplarda
// dikey `flex: 1` YOK — satırlarda yatay `flex: 1`, dikeyde sabit/otomatik.
import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { contrastRatio, isLightSurface, shiftLightness } from "@utils/colorUtils";
import { alpha } from "../../theme/colors";
import { fillCopy } from "./themeStudioCopy";

/** Verilen zemin üzerinde okunur yazı rengi (WCAG eşiğinde siyah/beyaz). */
export const inkOn = (color) => (isLightSurface(color) ? "#0B0D12" : "#FFFFFF");

const levelTone = (theme, level) =>
  level === "great" || level === "ok" ? theme.colors.green : level === "low" ? theme.colors.orange : theme.colors.red;
const levelIcon = (level) =>
  level === "great" ? "shield-checkmark" : level === "ok" ? "checkmark-circle" : level === "low" ? "alert-circle" : "warning";
const ratioLevel = (ratio) => (ratio >= 7 ? "great" : ratio >= 4.5 ? "ok" : ratio >= 3 ? "low" : "fail");

/* ───────────────────────── Sekmeler ───────────────────────── */

const TAB_PAD = 4;

/** Kayan göstergeli segment sekmeleri (Kur / Keşfet / İnce ayar). */
export const StudioTabs = memo(function StudioTabs({ tabs, value, onChange, theme, reduceMotion = false }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === value));
  const segW = width > 0 ? (width - TAB_PAD * 2) / tabs.length : 0;
  // 4+ sekmede (Kur · Keşfet · Hazır · İnce ayar) simge/yazı küçülür; "Fine-tune"
  // ve "Ajuste fino" 390 dp'de bile kırpılmasın.
  const crowded = tabs.length > 3;

  useEffect(() => {
    if (!segW) return;
    if (reduceMotion) {
      x.setValue(index * segW);
      return;
    }
    Animated.spring(x, {
      toValue: index * segW,
      mass: 0.6,
      damping: 18,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [index, segW, reduceMotion, x]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.tabsWrap, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabsIndicator,
            {
              width: segW,
              backgroundColor: alpha(theme.accent, 0.16),
              borderColor: alpha(theme.accent, 0.5),
              transform: [{ translateX: x }],
            },
          ]}
        />
      ) : null}
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={() => onChange(tab.key)}
              style={[styles.tabBtn, crowded && styles.tabBtnCrowded]}
            >
              <AppIcon family="Ionicons" name={tab.icon} size={crowded ? 15 : 16} color={active ? theme.accent : theme.text.muted} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.tabLabel, crowded && styles.tabLabelCrowded, { color: active ? theme.text.primary : theme.text.muted }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/* ───────────────────────── Bölüm başlığı ───────────────────────── */

export const SectionHeader = memo(function SectionHeader({ icon, title, sub, right, theme }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
        <AppIcon family="Ionicons" name={icon} size={17} color={theme.accent} />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[styles.sectionSub, { color: theme.text.muted }]} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right || null}
    </View>
  );
});

/* ───────────────────────── Küçük etiket ───────────────────────── */

export const MiniLabel = ({ children, theme, style }) => (
  <Text style={[styles.miniLabel, { color: theme.text.muted }, style]}>{children}</Text>
);

/* ───────────────────────── Renk kutusu ───────────────────────── */

/** Büyük tohum renk kutusu: üstte renk alanı (hex + simge), altta ad + açıklama. */
export const ColorTile = memo(function ColorTile({ label, sub, color, icon, onPress, theme }) {
  const ink = inkOn(color);
  const hex = String(color || "").toUpperCase();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hex}`}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[color, shiftLightness(color, isLightSurface(color) ? -7 : 8)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tileSwatch, { borderColor: alpha(ink, 0.18) }]}
      >
        <View style={styles.tileSwatchTop}>
          <AppIcon family="Ionicons" name={icon} size={18} color={ink} />
          <View style={[styles.tileEdit, { backgroundColor: alpha(ink, 0.16) }]}>
            <AppIcon family="Ionicons" name="create-outline" size={12} color={ink} />
          </View>
        </View>
        <Text style={[styles.tileHex, { color: ink }]}>{hex}</Text>
      </LinearGradient>
      <View style={styles.tileMeta}>
        <Text style={[styles.tileLabel, { color: theme.text.primary }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.tileSub, { color: theme.text.muted }]} numberOfLines={2}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
});

/* ───────────────────────── Renk daireleri ───────────────────────── */

/** Yatay hazır renk şeridi; seçili olan halkalı + tikli. */
export const SwatchRow = memo(function SwatchRow({ colors, selected, onPick, theme, shape = "circle" }) {
  const sel = String(selected || "").toUpperCase();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.swatchRow}
      keyboardShouldPersistTaps="handled"
    >
      {colors.map((hex) => {
        const active = sel === hex.toUpperCase();
        return (
          <TouchableOpacity
            key={hex}
            accessibilityRole="button"
            accessibilityLabel={hex}
            accessibilityState={{ selected: active }}
            activeOpacity={0.8}
            onPress={() => onPick(hex)}
            style={[
              styles.swatch,
              shape === "square" && styles.swatchSquare,
              { backgroundColor: hex, borderColor: active ? theme.text.primary : alpha(theme.text.primary, 0.14) },
              active && styles.swatchActive,
            ]}
          >
            {active ? <AppIcon family="Ionicons" name="checkmark" size={15} color={inkOn(hex)} /> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ───────────────────────── Uyum önerileri ───────────────────────── */

/** Zeminden hesaplanan vurgu önerileri: renk noktası + kısa etiket. */
export const HarmonyRow = memo(function HarmonyRow({ items, selected, onPick, theme }) {
  const sel = String(selected || "").toUpperCase();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.harmonyRow}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => {
        const active = sel === item.hex.toUpperCase();
        return (
          <TouchableOpacity
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} ${item.hex}`}
            accessibilityState={{ selected: active }}
            activeOpacity={0.8}
            onPress={() => onPick(item.hex)}
            style={[
              styles.harmonyItem,
              { backgroundColor: theme.secondary, borderColor: active ? item.hex : theme.border },
              active && { borderWidth: 2 },
            ]}
          >
            <View style={[styles.harmonyDot, { backgroundColor: item.hex }]}>
              {active ? <AppIcon family="Ionicons" name="checkmark" size={13} color={inkOn(item.hex)} /> : null}
            </View>
            <Text style={[styles.harmonyLabel, { color: active ? theme.text.primary : theme.text.secondary }]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

/* ───────────────────────── Segmentli seçici ───────────────────────── */

export const Segmented = memo(function Segmented({ options, value, onChange, theme, dense = false }) {
  return (
    <View style={[styles.segWrap, { backgroundColor: theme.primary, borderColor: theme.border }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.key)}
            style={[styles.segBtn, dense && styles.segBtnDense, active && { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.segText, dense && styles.segTextDense, { color: active ? "#FFFFFF" : theme.text.secondary }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/* ───────────────────────── Hayalet düğme ───────────────────────── */

export const GhostButton = memo(function GhostButton({ icon, label, onPress, theme, disabled, tone }) {
  const color = tone || theme.text.secondary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.ghost, { borderColor: theme.border, opacity: disabled ? 0.45 : 1 }]}
    >
      <AppIcon family="Ionicons" name={icon} size={16} color={color} />
      <Text style={[styles.ghostText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
});

/* ───────────────────────── Palet şeridi ───────────────────────── */

const STRIP_ORDER = [
  "primary", "secondary", "between", "tab", "border",
  "accent", "bold",
  "textPrimary", "textSecondary", "textBetween", "textMuted",
];

/** 11 token'ı tek şeritte gösterir (canlı palet özeti). */
export const PaletteStrip = memo(function PaletteStrip({ resolved, height = 12, theme }) {
  return (
    <View style={[styles.strip, { height, borderColor: alpha(theme.text.primary, 0.12) }]}>
      {STRIP_ORDER.map((key) => (
        <View key={key} style={[styles.stripCell, { backgroundColor: resolved[key] }]} />
      ))}
    </View>
  );
});

/* ───────────────────────── Okunabilirlik ───────────────────────── */

/** Önizleme altındaki özet hap; dokununca ayrıntı paneli açılır. */
export const ReadabilityPill = memo(function ReadabilityPill({ analysis, copy, open, onPress, theme }) {
  const tone = levelTone(theme, analysis.level);
  const levelText = { great: copy.levelGreat, ok: copy.levelOk, low: copy.levelLow, fail: copy.levelFail }[analysis.level];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${copy.readability}: ${levelText}`}
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: alpha(tone, 0.12), borderColor: alpha(tone, 0.4) }]}
    >
      <AppIcon family="Ionicons" name={levelIcon(analysis.level)} size={14} color={tone} />
      {/* Sorun varsa seviye adı yerine SAYI öne çıkar: dar ekranda (320 dp) ikisi
          birden sığmıyor, yazı sıfıra kırpılıyordu. */}
      {analysis.issues > 0 ? (
        <Text style={[styles.pillText, { color: tone }]} numberOfLines={1}>
          {analysis.issues === 1 ? copy.issuesOne : fillCopy(copy.issuesMany, { n: analysis.issues })}
        </Text>
      ) : (
        <Text style={[styles.pillText, { color: theme.text.primary }]} numberOfLines={1}>
          {levelText}
        </Text>
      )}
      <AppIcon family="Ionicons" name={open ? "chevron-up" : "chevron-down"} size={14} color={theme.text.muted} />
    </TouchableOpacity>
  );
});

const CHECK_LABEL_KEY = {
  title: "checkTitle",
  card: "checkCard",
  muted: "checkMuted",
  accent: "checkAccent",
  button: "checkButton",
};

/** Beş kontrolün ayrıntısı + "Okunurluğu düzelt". */
export const ReadabilityPanel = memo(function ReadabilityPanel({ analysis, copy, onFix, theme }) {
  return (
    <View style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {analysis.rows.map((row, i) => {
        const tone = levelTone(theme, row.level);
        return (
          <View
            key={row.id}
            style={[
              styles.checkRow,
              i !== analysis.rows.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={[styles.checkSample, { backgroundColor: row.bgColor, borderColor: alpha(theme.text.primary, 0.14) }]}>
              <Text style={[styles.checkSampleText, { color: row.fgColor }]}>Aa</Text>
            </View>
            <Text style={[styles.checkLabel, { color: theme.text.primary }]} numberOfLines={1}>
              {copy[CHECK_LABEL_KEY[row.id]]}
            </Text>
            <Text style={[styles.checkRatio, { color: tone }]}>{row.ratio.toFixed(1)}:1</Text>
            <AppIcon family="Ionicons" name={levelIcon(row.level)} size={16} color={tone} />
          </View>
        );
      })}
      {analysis.issues > 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={onFix}
          style={[styles.fixBtn, { backgroundColor: theme.accent }]}
        >
          <AppIcon family="Ionicons" name="color-wand" size={16} color="#FFFFFF" />
          <Text style={styles.fixText}>{copy.fixReadability}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.okNote}>
          <AppIcon family="Ionicons" name="checkmark-done" size={15} color={theme.colors.green} />
          <Text style={[styles.okNoteText, { color: theme.text.secondary }]}>{copy.nothingToFix}</Text>
        </View>
      )}
    </View>
  );
});

/* ───────────────────────── İnce ayar satırı ───────────────────────── */

/** Kontrast küçük etiketi (metin token'ları için zemine oran). */
export const RatioChip = memo(function RatioChip({ fg, bg, theme }) {
  const ratio = contrastRatio(fg, bg);
  const tone = levelTone(theme, ratioLevel(ratio));
  return (
    <View style={[styles.ratioChip, { backgroundColor: alpha(tone, 0.14) }]}>
      <Text style={[styles.ratioChipText, { color: tone }]}>{ratio.toFixed(1)}</Text>
    </View>
  );
});

export const TokenRow = memo(function TokenRow({
  label,
  color,
  hex,
  linked,
  linkText,
  ratioAgainst,
  onPress,
  last,
  theme,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.tokenRow, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.tokenSwatch, { backgroundColor: color, borderColor: alpha(theme.text.primary, 0.16) }]}>
        {linked ? (
          <View style={styles.tokenLink}>
            <AppIcon family="Ionicons" name="link" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.tokenCopy}>
        <Text style={[styles.tokenLabel, { color: theme.text.primary }]} numberOfLines={1}>{label}</Text>
        {linked ? <Text style={[styles.tokenSub, { color: theme.accent }]} numberOfLines={1}>{linkText}</Text> : null}
      </View>
      {ratioAgainst ? <RatioChip fg={color} bg={ratioAgainst} theme={theme} /> : null}
      <Text style={[styles.tokenHex, { color: theme.text.muted }]}>{hex}</Text>
      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  /* sekmeler */
  tabsWrap: { borderRadius: 18, borderWidth: 1, padding: TAB_PAD },
  tabsIndicator: { position: "absolute", top: TAB_PAD, bottom: TAB_PAD, left: TAB_PAD, borderRadius: 14, borderWidth: 1 },
  tabsRow: { flexDirection: "row" },
  tabBtn: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
  tabLabel: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  tabBtnCrowded: { gap: 4, paddingHorizontal: 2 },
  tabLabelCrowded: { fontSize: 11.5 },

  /* bölüm başlığı */
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  sectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: 15.5, fontWeight: "900" },
  sectionSub: { fontSize: 11.5, fontWeight: "600", marginTop: 2, lineHeight: 15 },
  miniLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginLeft: 2 },

  /* renk kutusu */
  tile: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 8 },
  tileSwatch: { borderRadius: 13, borderWidth: 1, height: 84, padding: 10, justifyContent: "space-between" },
  tileSwatchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileEdit: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tileHex: { fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  tileMeta: { paddingHorizontal: 4, paddingTop: 9, paddingBottom: 3 },
  tileLabel: { fontSize: 13.5, fontWeight: "850" },
  tileSub: { fontSize: 10.5, fontWeight: "650", marginTop: 2, lineHeight: 14 },

  /* daireler */
  swatchRow: { gap: 10, paddingVertical: 3, paddingRight: 8, alignItems: "center" },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  swatchSquare: { borderRadius: 11 },
  swatchActive: { borderWidth: 2.5, transform: [{ scale: 1.08 }] },

  /* uyum */
  harmonyRow: { gap: 9, paddingVertical: 2, paddingRight: 8 },
  harmonyItem: { minWidth: 82, borderRadius: 14, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10, alignItems: "center", gap: 7 },
  harmonyDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  harmonyLabel: { fontSize: 10.5, fontWeight: "800" },

  /* segment */
  segWrap: { flexDirection: "row", padding: 3, borderRadius: 13, borderWidth: 1, gap: 3 },
  segBtn: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segText: { fontSize: 12, fontWeight: "850" },
  segBtnDense: { minHeight: 30, borderRadius: 9 },
  segTextDense: { fontSize: 11.5 },

  /* hayalet düğme */
  ghost: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 },
  ghostText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },

  /* şerit */
  strip: { flexDirection: "row", borderRadius: 7, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  stripCell: { flex: 1 },

  /* okunabilirlik */
  pill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, flexShrink: 1 },
  pillText: { fontSize: 11.5, fontWeight: "850", flexShrink: 1 },
  panel: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14 },
  checkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11 },
  checkSample: { width: 38, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  checkSampleText: { fontSize: 13, fontWeight: "900" },
  checkLabel: { flex: 1, fontSize: 12.5, fontWeight: "750" },
  checkRatio: { fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  fixBtn: { marginTop: 10, minHeight: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  fixText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  okNote: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  okNoteText: { fontSize: 12, fontWeight: "750" },

  /* ince ayar satırı */
  ratioChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  ratioChipText: { fontSize: 10, fontWeight: "900" },
  tokenRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 },
  tokenSwatch: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, alignItems: "flex-end", justifyContent: "flex-end" },
  tokenLink: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", margin: -1 },
  tokenCopy: { flex: 1 },
  tokenLabel: { fontSize: 14, fontWeight: "750" },
  tokenSub: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  tokenHex: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
});
