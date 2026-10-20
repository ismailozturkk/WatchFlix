// screens/tabs/settings/widgets/WidgetControls.js
//
// Widget ayar ekranının kontrol seti. iOS ve Android'de AYNI işi yapan ama kendi
// platformunun diliyle çizilen parçalar:
//
//   Segmented   iOS  → kayan başparmaklı grup (UISegmentedControl hissi)
//               Android → Material 3 "segmented button" (seçili parçada ✓)
//   ToggleRow   iOS  → girintili ayraç, sistem anahtarı (SwitchToggle zaten ayırıyor)
//               Android → ayraçsız, daha yüksek dokunma alanı
//   WidgetPicker, ThemeCards, AccentGrid, InfoNote, HowToCard ortak.
//
// Metinler statik `i18nText("autoI18n.…")` ile yazılır (i18nKeys.test.js yalnız
// bu biçimi doğrudan denetler).

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../../../theme/colors";
import { isLightSurface } from "../../../../utils/colorUtils";

// Vurgu rengi üstündeki işaret: gerçek kontrast eşiğiyle siyah/beyaz (readableTextOn
// orta tonlarda yanlış seçer — eşik 0.5 yerine 0.179 olmalı).
const markOn = (hex) => (isLightSurface(hex) ? "#111111" : "#FFFFFF");
import { selectionAsync } from "../../../../services/hapticsService";
import GlassPressable from "../../../../components/common/GlassPressable";

const tap = () => {
  selectionAsync().catch(() => {});
};

// ─── Segmented ───────────────────────────────────────────────────────────────

const TRACK_PAD = 3;

function IosSegmented({ options, value, onChange, colors }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: index,
      damping: 18,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  const segmentWidth =
    options.length > 0 ? Math.max(0, width - TRACK_PAD * 2) / options.length : 0;
  const translateX =
    options.length > 1
      ? slide.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: options.map((_, i) => i * segmentWidth),
        })
      : 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.iosTrack,
        { backgroundColor: colors.cardAlt, borderColor: colors.borderMuted },
      ]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iosThumb,
            {
              width: segmentWidth,
              backgroundColor: colors.accent,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              tap();
              onChange(option.value);
            }}
            style={styles.iosSegment}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.iosSegmentText,
                { color: active ? colors.white : colors.muted },
                active && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MaterialSegmented({ options, value, onChange, colors }) {
  return (
    <View style={[styles.mdRow, { borderColor: colors.border }]}>
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <GlassPressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            android_ripple={{ color: alpha(colors.accent, 0.2) }}
            onPress={() => {
              if (active) return;
              tap();
              onChange(option.value);
            }}
            style={[
              styles.mdSegment,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
              active && { backgroundColor: colors.accentDim },
            ]}
          >
            {active && <AppIcon name="checkmark" size={15} color={colors.accent} />}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.mdSegmentText,
                { color: active ? colors.accent : colors.text },
                active && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
}

export function Segmented({ platform, ...props }) {
  return platform === "ios" ? (
    <IosSegmented {...props} />
  ) : (
    <MaterialSegmented {...props} />
  );
}

// ─── Kart / satır iskeleti ───────────────────────────────────────────────────

export function ControlCard({ colors, platform, children, style }) {
  return (
    <View
      style={[
        styles.card,
        platform === "ios" ? styles.cardIos : styles.cardAndroid,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Başlık + ipucu + gövde; kartta ayraçla alt alta dizilir. */
export function ControlBlock({ colors, title, hint, right, first, children }) {
  return (
    <View
      style={[
        styles.block,
        !first && { borderTopWidth: 1, borderTopColor: colors.borderMuted },
      ]}
    >
      {(title || right) && (
        <View style={styles.blockHeading}>
          <View style={styles.blockCopy}>
            {!!title && (
              <Text
                allowFontScaling={false}
                style={[styles.blockTitle, { color: colors.text }]}
              >
                {title}
              </Text>
            )}
            {!!hint && (
              <Text
                allowFontScaling={false}
                style={[styles.blockHint, { color: colors.muted }]}
              >
                {hint}
              </Text>
            )}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function ToggleRow({
  colors,
  platform,
  icon,
  title,
  subtitle,
  value,
  onChange,
  last,
}) {
  return (
    <View
      style={[
        styles.toggleRow,
        platform === "android" && styles.toggleRowAndroid,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
      ]}
    >
      <View style={[styles.toggleIcon, { backgroundColor: colors.accentDim }]}>
        <AppIcon name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.toggleCopy}>
        <Text
          allowFontScaling={false}
          style={[styles.toggleTitle, { color: colors.text }]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            allowFontScaling={false}
            style={[styles.toggleSubtitle, { color: colors.muted }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <SwitchToggle
        value={value}
        onValueChange={(next) => {
          tap();
          onChange(next);
        }}
        size={36}
      />
    </View>
  );
}

// ─── Widget seçici ───────────────────────────────────────────────────────────

// `compact`: kısa ekranlarda (iPhone SE sınıfı) simge satırı atılır; sahneye yer açılır.
export function WidgetPicker({ widgets, active, onChange, colors, platform, compact }) {
  return (
    <View style={styles.pickerRow}>
      {widgets.map((widget) => {
        const selected = widget.id === active;
        return (
          <GlassPressable
            key={widget.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            android_ripple={{ color: alpha(colors.accent, 0.2), borderless: false }}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(widget.id);
            }}
            style={({ pressed }) => [
              styles.pickerItem,
              compact && styles.pickerItemCompact,
              platform === "ios" ? styles.pickerIos : styles.pickerAndroid,
              {
                backgroundColor: selected ? colors.accentDim : colors.card,
                borderColor: selected ? colors.accent : colors.border,
              },
              platform === "ios" && pressed && { opacity: 0.7 },
            ]}
          >
            {!compact && (
              <View
                style={[
                  styles.pickerIcon,
                  {
                    backgroundColor: selected ? colors.accent : colors.cardAlt,
                  },
                ]}
              >
                <AppIcon
                  name={widget.icon}
                  size={16}
                  color={selected ? colors.white : colors.muted}
                />
              </View>
            )}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.pickerText,
                { color: selected ? colors.text : colors.muted },
                selected && styles.segmentTextActive,
              ]}
            >
              {widget.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
}

// ─── Tema kartları ───────────────────────────────────────────────────────────

function ThemeCard({ item, active, onPress, colors }) {
  const p = item.appearance;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.themeCard, pressed && { opacity: 0.75 }]}
    >
      {/* Mini widget: zemin + başlık şeridi + iki satır — seçilen temanın GERÇEK renkleri. */}
      <View
        style={[
          styles.themeThumb,
          {
            backgroundColor: p.background,
            borderColor: active ? p.accent : alpha(p.border, 0.9),
            borderWidth: active ? 2 : 1,
          },
        ]}
      >
        <View style={styles.themeThumbHeader}>
          <View style={[styles.themeThumbDot, { backgroundColor: p.accent }]} />
          <View style={[styles.themeThumbLine, { backgroundColor: p.text }]} />
        </View>
        {[0.9, 0.62].map((w) => (
          <View
            key={w}
            style={[styles.themeThumbRow, { backgroundColor: p.surfaceAlt }]}
          >
            <View
              style={[
                styles.themeThumbTick,
                { backgroundColor: alpha(p.accent, 0.85) },
              ]}
            />
            <View
              style={[
                styles.themeThumbText,
                { width: `${w * 55}%`, backgroundColor: p.secondaryText },
              ]}
            />
          </View>
        ))}
        {active && (
          <View style={[styles.themeCheck, { backgroundColor: p.accent }]}>
            <AppIcon name="checkmark" size={11} color={markOn(p.accent)} />
          </View>
        )}
      </View>
      <View style={styles.themeNameRow}>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.themeName,
            { color: active ? colors.text : colors.muted },
            active && styles.segmentTextActive,
          ]}
        >
          {item.name}
        </Text>
        {item.custom && (
          <Text
            allowFontScaling={false}
            style={[styles.themeCustom, { color: colors.accent }]}
          >
            {i18nText("autoI18n.widget_custom_theme", "ÖZEL")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function ThemeCards({ catalog, activeId, onPick, colors }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.themeScroll}
      // Yatay liste dikey sayfa kaydırmasını yutmasın (iOS).
      nestedScrollEnabled
    >
      {catalog.map((item) => (
        <ThemeCard
          key={item.id}
          item={item}
          colors={colors}
          active={activeId === item.id}
          onPress={() => {
            tap();
            onPick(item);
          }}
        />
      ))}
    </ScrollView>
  );
}

export function AccentGrid({ options, selected, onPick }) {
  return (
    <View style={styles.accentGrid}>
      {options.map((accent) => {
        const active = selected === accent;
        return (
          <GlassPressable
            key={accent}
            accessibilityRole="button"
            accessibilityLabel={accent}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              tap();
              onPick(accent);
            }}
            hitSlop={4}
            style={[
              styles.accentRing,
              { borderColor: active ? accent : "transparent" },
            ]}
          >
            <View style={[styles.accentDot, { backgroundColor: accent }]}>
              {active && (
                <AppIcon name="checkmark" size={15} color={markOn(accent)} />
              )}
            </View>
          </GlassPressable>
        );
      })}
    </View>
  );
}

// ─── Bilgi / yardım ──────────────────────────────────────────────────────────

export function InfoNote({ colors, icon = "information-circle-outline", children }) {
  return (
    <View
      style={[
        styles.note,
        { backgroundColor: alpha(colors.accent, 0.1), borderColor: alpha(colors.accent, 0.22) },
      ]}
    >
      <AppIcon name={icon} size={17} color={colors.accent} style={styles.noteIcon} />
      <Text allowFontScaling={false} style={[styles.noteText, { color: colors.text }]}>
        {children}
      </Text>
    </View>
  );
}

export function HowToCard({ colors, platform }) {
  const [open, setOpen] = useState(false);
  const steps = useMemo(
    () =>
      platform === "ios"
        ? [
            i18nText("autoI18n.widget_howto_hold", "Ana ekranda boş bir yere basılı tut."),
            i18nText("autoI18n.widget_howto_ios_2", "Sol üstteki + düğmesine dokun ve Seelogd’u seç."),
            i18nText("autoI18n.widget_howto_ios_3", "Widget’ı ve boyutunu seçip Widget Ekle’ye dokun."),
          ]
        : [
            i18nText("autoI18n.widget_howto_hold", "Ana ekranda boş bir yere basılı tut."),
            i18nText("autoI18n.widget_howto_android_2", "Widget’lar’ı aç ve Seelogd’u bul."),
            i18nText("autoI18n.widget_howto_android_3", "Widget’ı basılı tutup ana ekrana sürükle."),
          ],
    [platform],
  );
  return (
    <ControlCard colors={colors} platform={platform}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        android_ripple={{ color: alpha(colors.accent, 0.15) }}
        onPress={() => {
          tap();
          setOpen((v) => !v);
        }}
        style={styles.howHeader}
      >
        <View style={[styles.toggleIcon, { backgroundColor: colors.accentDim }]}>
          <AppIcon name="add-circle-outline" size={18} color={colors.accent} />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.toggleTitle, styles.howTitle, { color: colors.text }]}
        >
          {i18nText("autoI18n.widget_howto_title", "Ana ekrana nasıl eklenir?")}
        </Text>
        <AppIcon
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.muted}
        />
      </Pressable>
      {open && (
        <View style={[styles.howBody, { borderTopColor: colors.borderMuted }]}>
          {steps.map((step, i) => (
            <View key={step} style={styles.howStep}>
              <View style={[styles.howNumber, { backgroundColor: colors.accentDim }]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.howNumberText, { color: colors.accent }]}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.howText, { color: colors.text }]}
              >
                {step}
              </Text>
            </View>
          ))}
          <Text
            allowFontScaling={false}
            style={[styles.howFoot, { color: colors.muted }]}
          >
            {i18nText(
              "autoI18n.widget_howto_sync",
              "Burada yaptığın değişiklikler eklediğin widget’lara otomatik yansır.",
            )}
          </Text>
        </View>
      )}
    </ControlCard>
  );
}

const styles = StyleSheet.create({
  segmentTextActive: { fontWeight: "800" },

  /* Segmented — iOS */
  iosTrack: {
    flexDirection: "row",
    borderRadius: 11,
    borderWidth: 1,
    padding: TRACK_PAD,
    minHeight: 38,
  },
  iosThumb: {
    position: "absolute",
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: TRACK_PAD,
    borderRadius: 8,
  },
  iosSegment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    minHeight: 32,
  },
  iosSegmentText: { fontSize: 13, fontWeight: "600" },

  /* Segmented — Material 3 */
  mdRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 40,
  },
  mdSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    minHeight: 40,
  },
  mdSegmentText: { fontSize: 13.5, fontWeight: "600" },

  /* Kart iskeleti */
  card: { borderWidth: 1, overflow: "hidden" },
  cardIos: { borderRadius: 20 },
  cardAndroid: { borderRadius: 24 },
  block: { padding: 16 },
  blockHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  blockCopy: { flex: 1 },
  blockTitle: { fontSize: 14.5, fontWeight: "700" },
  blockHint: { fontSize: 12, lineHeight: 16, marginTop: 3 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  toggleRowAndroid: { minHeight: 72, paddingVertical: 12 },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14.5, fontWeight: "600" },
  toggleSubtitle: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  /* Widget seçici */
  pickerRow: { flexDirection: "row", gap: 8 },
  pickerItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerItemCompact: { paddingVertical: 11 },
  pickerIos: { borderRadius: 16 },
  pickerAndroid: { borderRadius: 20 },
  pickerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerText: { fontSize: 12.5, fontWeight: "600" },

  /* Tema kartları */
  themeScroll: { gap: 12, paddingRight: 4 },
  themeCard: { width: 116 },
  themeThumb: {
    height: 84,
    borderRadius: 14,
    padding: 8,
    gap: 5,
  },
  themeThumbHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
  themeThumbDot: { width: 11, height: 11, borderRadius: 4 },
  themeThumbLine: { width: "42%", height: 5, borderRadius: 3 },
  themeThumbRow: {
    height: 17,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    gap: 5,
  },
  themeThumbTick: { width: 7, height: 7, borderRadius: 3.5 },
  themeThumbText: { height: 4, borderRadius: 2, opacity: 0.8 },
  themeCheck: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  themeNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  themeName: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  themeCustom: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },

  /* Vurgu rengi */
  accentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accentRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  accentDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Bilgi notu */
  note: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17 },

  /* Nasıl eklenir */
  howHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  howTitle: { flex: 1 },
  howBody: { borderTopWidth: 1, padding: 16, gap: 12 },
  howStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  howNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  howNumberText: { fontSize: 12.5, fontWeight: "800" },
  howText: { flex: 1, fontSize: 13.5, lineHeight: 18 },
  howFoot: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
