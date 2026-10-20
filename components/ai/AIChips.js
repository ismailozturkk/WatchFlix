// components/ai/AIChips.js
//
// CineMatch ayar/seçim yüzeyleri için ortak seçim çipleri. Sohbet içi ayar
// paneli, "ruh haline göre bul" seçicisi ve Ayarlar > Yapay zeka ekranı aynı
// çipleri kullanır; görünüm tek yerde.
//
//   ChoiceChip       tek çip (simge / renk noktası / seçili hâli)
//   ChoiceWrap       çipleri satır sarmalı olarak dizer (çoklu ya da tekli seçim)
//   SegmentedChoice  eşit genişlikli bölmeli kontrol (2–4 seçenek: stil, sayı…)

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { alpha } from "../../theme/colors";
import GlassTouchable from "../common/GlassTouchable";

export const ChoiceChip = memo(({ label, icon, dotColor, selected, onPress, theme, disabled }) => {
  const tint = selected ? theme.bold : theme.text.secondary;
  return (
    <GlassTouchable
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[
        s.chip,
        {
          borderColor: selected ? theme.bold : theme.border,
          backgroundColor: selected ? alpha(theme.bold, 0.14) : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {dotColor ? <View style={[s.dot, { backgroundColor: dotColor }]} /> : null}
      {icon ? <Ionicons name={icon} size={14} color={selected ? theme.bold : theme.text.muted} /> : null}
      <Text style={[s.chipText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </GlassTouchable>
  );
});

/**
 * options: [{ value, label, icon?, dotColor? }]
 * `selected`: seçili değerlerin dizisi (tekli seçimde tek elemanlı dizi verin).
 */
export const ChoiceWrap = memo(({ options, selected, onToggle, theme, style }) => (
  <View style={[s.wrap, style]}>
    {options.map((option) => (
      <ChoiceChip
        key={String(option.value)}
        label={option.label}
        icon={option.icon}
        dotColor={option.dotColor}
        selected={selected.includes(option.value)}
        onPress={() => onToggle(option.value)}
        theme={theme}
      />
    ))}
  </View>
));

/** options: [{ value, label }] — tek seçim, eşit genişlikli bölmeler. */
export const SegmentedChoice = memo(({ options, value, onChange, theme, style }) => (
  <View style={[s.segment, { backgroundColor: theme.between, borderColor: theme.border }, style]}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <GlassTouchable
          key={String(option.value)}
          activeOpacity={0.8}
          onPress={() => onChange(option.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          style={[s.segmentItem, active && { backgroundColor: theme.bold }]}
        >
          <Text
            numberOfLines={1}
            style={[s.segmentText, { color: active ? "#fff" : theme.text.secondary }]}
          >
            {option.label}
          </Text>
        </GlassTouchable>
      );
    })}
  </View>
));

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  segment: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentText: { fontSize: 12, fontWeight: "700" },
});
