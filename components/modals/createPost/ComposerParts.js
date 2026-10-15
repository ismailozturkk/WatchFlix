// components/modals/createPost/ComposerParts.js
//
// "Yeni paylaşım" penceresinin (CreatePostModal) SUNUM parçaları. Durum ve iş
// mantığı (taslak, arama, hidrasyon, gönderim) pencerenin kendisinde kalır;
// burada yalnız prop alan, tema token'larıyla boyanan bileşenler var. Böylece
// pencere dosyası görünümle değil akışla uğraşır.
//
// Vurgu rengi (`accent`) paylaşım tipinden gelir (postTypeBadge ile aynı:
// inceleme/sohbet mavi, liste yeşil, anket mor) — feed kartındaki tip diliyle
// birebir aynı kalsın diye.

import React, { memo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
  Switch,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { alpha } from "../../../theme/colors";

export const DANGER = "#f04f4f";
const STAR = "#FFD54F";

// İnceleme posteri: feed'deki büyütülmüş poster (118×177) ile aynı oran.
export const POSTER_W = 118;
export const POSTER_H = 177;

// ─── Metin alanı kartı ───────────────────────────────────────────────────────
// Etiket + sayaç kartın içinde; odaklanınca kenarlık ve etiket vurgu rengine
// döner. Odak durumu burada tutulur — pencerenin her tuş vuruşunda render olan
// durumuna bir alan daha eklemek gerekmesin.

export const FieldCard = memo(function FieldCard({
  theme,
  accent,
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline = false,
  minHeight,
  emphasis = false,
  grow = false,
  style,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const atMax = value.length >= maxLength;

  return (
    <View
      style={[
        st.field,
        {
          backgroundColor: theme.secondary,
          borderColor: focused ? alpha(accent, 0.7) : theme.border,
        },
        style,
      ]}
    >
      <View style={st.fieldHead}>
        <Ionicons
          name={icon}
          size={13}
          color={focused ? accent : theme.text.muted}
        />
        <Text style={[st.fieldLabel, { color: focused ? accent : theme.text.muted }]}>
          {label}
        </Text>
        <Text style={[st.fieldCounter, { color: atMax ? DANGER : theme.text.muted }]}>
          {value.length}/{maxLength}
        </Text>
      </View>
      <TextInput
        {...inputProps}
        style={[
          st.fieldInput,
          emphasis && st.fieldInputEmphasis,
          multiline && { minHeight, textAlignVertical: "top" },
          grow && { flex: 1 },
          { color: theme.text.primary },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.text.muted}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
});

// ─── Tip seçici (kayan, tip renginde gösterge) ───────────────────────────────

export const TypeSelector = memo(function TypeSelector({
  theme,
  items,
  active,
  onChange,
  anim,
}) {
  const range = items.map((_, i) => i);
  const left = anim.interpolate({
    inputRange: range,
    outputRange: range.map((i) => `${(i * 100) / items.length}%`),
  });
  const bg = anim.interpolate({
    inputRange: range,
    outputRange: items.map((it) => alpha(it.color, 0.16)),
  });
  const border = anim.interpolate({
    inputRange: range,
    outputRange: items.map((it) => alpha(it.color, 0.5)),
  });

  return (
    <View
      style={[
        st.typeTrack,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={st.typeInner}>
        <Animated.View
          style={[
            st.typeIndicator,
            { width: `${100 / items.length}%`, left, backgroundColor: bg, borderColor: border },
          ]}
        />
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={st.typeBtn}
              onPress={() => onChange(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={isActive ? item.color : theme.text.muted}
              />
              <Text
                style={[
                  st.typeText,
                  {
                    color: isActive ? theme.text.primary : theme.text.secondary,
                    fontWeight: isActive ? "800" : "600",
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

// ─── Hızlı ekle çubuğu (inceleme: seçilen içeriğin adı + özeti) ──────────────

const QuickButton = memo(function QuickButton({
  theme,
  accent,
  icon,
  label,
  done,
  loading,
  onPress,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: done, busy: loading }}
      onPress={onPress}
      style={({ pressed }) => [
        st.quickBtn,
        {
          backgroundColor: done ? alpha(accent, 0.14) : theme.secondary,
          borderColor: done ? alpha(accent, 0.55) : alpha(accent, 0.3),
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={accent} />
      <Text
        style={[st.quickBtnText, { color: done ? accent : theme.text.primary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : done ? (
        <Ionicons name="checkmark-circle" size={17} color={accent} />
      ) : null}
    </Pressable>
  );
});

export const QuickFillBar = memo(function QuickFillBar({
  theme,
  accent,
  mediaName,
  title,
  nameLabel,
  summaryLabel,
  nameDone,
  summaryDone,
  summaryLoading,
  onAddName,
  onAddSummary,
}) {
  return (
    <View
      style={[
        st.quick,
        { backgroundColor: alpha(accent, 0.07), borderColor: alpha(accent, 0.26) },
      ]}
    >
      <View style={st.quickHead}>
        <View style={[st.quickSpark, { backgroundColor: alpha(accent, 0.18) }]}>
          <Ionicons name="flash" size={13} color={accent} />
        </View>
        <Text style={[st.quickTitle, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[st.quickName, { color: theme.text.muted }]} numberOfLines={1}>
          {mediaName}
        </Text>
      </View>
      <View style={st.quickRow}>
        <QuickButton
          theme={theme}
          accent={accent}
          icon="text"
          label={nameLabel}
          done={nameDone}
          onPress={onAddName}
        />
        <QuickButton
          theme={theme}
          accent={accent}
          icon="document-text-outline"
          label={summaryLabel}
          done={summaryDone}
          loading={summaryLoading}
          onPress={onAddSummary}
        />
      </View>
    </View>
  );
});

// ─── Poster alanı (inceleme) ─────────────────────────────────────────────────

export const PosterSlot = memo(function PosterSlot({
  theme,
  accent,
  uri,
  meta,
  emptyLabel,
  changeLabel,
  onPress,
}) {
  const filled = !!uri;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={filled ? changeLabel : emptyLabel}
      onPress={onPress}
      style={({ pressed }) => [
        st.poster,
        {
          backgroundColor: theme.secondary,
          borderColor: filled ? alpha(accent, 0.45) : alpha(accent, 0.4),
          borderStyle: filled ? "solid" : "dashed",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {filled ? (
        <>
          <Image source={{ uri }} style={st.posterImg} contentFit="cover" transition={120} />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.82)"]}
            style={st.posterScrim}
            pointerEvents="none"
          >
            {!!meta && (
              <Text style={st.posterMeta} numberOfLines={1}>
                {meta}
              </Text>
            )}
            <View style={st.posterChange}>
              <Ionicons name="swap-horizontal" size={12} color="#fff" />
              <Text style={st.posterChangeText}>{changeLabel}</Text>
            </View>
          </LinearGradient>
        </>
      ) : (
        <>
          <View style={[st.posterPlus, { backgroundColor: alpha(accent, 0.14) }]}>
            <Ionicons name="add" size={26} color={accent} />
          </View>
          <Text style={[st.posterEmpty, { color: theme.text.secondary }]}>{emptyLabel}</Text>
        </>
      )}
    </Pressable>
  );
});

// ─── Seçenekler kartı: puan + spoiler + sıralı liste satırları ───────────────

export const OptionsCard = memo(function OptionsCard({ theme, children }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[st.options, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {rows.map((row, i) => (
        <View
          key={row.key ?? i}
          style={i > 0 && [st.optionsDivider, { borderTopColor: theme.border }]}
        >
          {row}
        </View>
      ))}
    </View>
  );
});

export const RatingRow = memo(function RatingRow({
  theme,
  rating,
  label,
  clearLabel,
  onRate,
  onClear,
}) {
  return (
    <View style={st.optRow}>
      <View style={st.optHead}>
        <View style={[st.optIcon, { backgroundColor: alpha(STAR, 0.16) }]}>
          <Octicons name="star-fill" size={15} color={STAR} />
        </View>
        <Text style={[st.optTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {label}
        </Text>
        {rating > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={onClear}
            hitSlop={8}
            style={[st.ratingClear, { backgroundColor: theme.primary, borderColor: theme.border }]}
          >
            <Text style={[st.ratingValue, { color: theme.text.primary }]}>{rating}/5</Text>
            <Ionicons name="close" size={12} color={theme.text.muted} />
          </Pressable>
        )}
      </View>
      <View style={st.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`${star}/5`}
            onPress={() => onRate(star)}
            style={st.starHit}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <Octicons
              name={rating >= star ? "star-fill" : "star"}
              size={30}
              color={rating >= star ? STAR : theme.text.muted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
});

export const ToggleRow = memo(function ToggleRow({
  theme,
  tint,
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}) {
  // Satırın metin kısmı da anahtarı çevirir; Switch'in kendisi ayrı bir kardeş
  // (Pressable İÇİNDE olsa dokunuş iki kez işlenebilirdi).
  return (
    <View style={[st.optRow, st.toggleRow]}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={st.toggleHit}
      >
        <View style={[st.optIcon, { backgroundColor: alpha(tint, value ? 0.2 : 0.12) }]}>
          <Ionicons name={icon} size={16} color={value ? tint : theme.text.muted} />
        </View>
        <View style={st.toggleCopy}>
          <Text style={[st.optTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[st.toggleSub, { color: theme.text.muted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      </Pressable>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: alpha(tint, 0.55) }}
        thumbColor={value ? tint : Platform.OS === "android" ? theme.text.muted : undefined}
        ios_backgroundColor={theme.border}
      />
    </View>
  );
});

// ─── Bölüm başlığı + iki seçenekli hap anahtarı ──────────────────────────────

export const SectionHeader = memo(function SectionHeader({ theme, accent, label, badge }) {
  return (
    <View style={st.section}>
      <Text style={[st.sectionLabel, { color: theme.text.muted }]}>{label}</Text>
      {!!badge && (
        <View style={[st.sectionBadge, { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.35) }]}>
          <Text style={[st.sectionBadgeText, { color: accent }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
});

export const PillToggle = memo(function PillToggle({ theme, accent, items, active, onChange }) {
  return (
    <View style={[st.pillTrack, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(item.key)}
            style={[
              st.pillBtn,
              isActive && {
                backgroundColor: alpha(accent, 0.16),
                borderColor: alpha(accent, 0.5),
              },
            ]}
          >
            <Ionicons name={item.icon} size={15} color={isActive ? accent : theme.text.muted} />
            <Text
              style={[
                st.pillText,
                {
                  color: isActive ? accent : theme.text.secondary,
                  fontWeight: isActive ? "800" : "600",
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const st = StyleSheet.create({
  // Alan kartı
  field: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  fieldHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  fieldLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  fieldCounter: { fontSize: 11, fontWeight: "700" },
  fieldInput: { fontSize: 15, lineHeight: 22, paddingVertical: 6, paddingHorizontal: 0 },
  fieldInputEmphasis: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.3 },

  // Tip seçici
  typeTrack: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeInner: { position: "relative", flexDirection: "row" },
  typeIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
  },
  typeText: { fontSize: 11.5 },

  // Hızlı ekle
  quick: { borderRadius: 18, borderWidth: 1, padding: 12, marginTop: 12 },
  quickHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  quickSpark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: { fontSize: 13, fontWeight: "800" },
  quickName: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right" },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickBtnText: { flex: 1, fontSize: 11.5, lineHeight: 14, fontWeight: "700" },

  // Poster alanı
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterImg: { width: "100%", height: "100%" },
  posterScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 30,
    paddingBottom: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 5,
  },
  posterMeta: { color: "#fff", fontSize: 10, fontWeight: "800" },
  posterChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  posterChangeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  posterPlus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  posterEmpty: { fontSize: 11.5, fontWeight: "700", textAlign: "center", paddingHorizontal: 8 },

  // Seçenekler kartı
  options: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginTop: 12 },
  optionsDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  optRow: { paddingHorizontal: 14, paddingVertical: 12 },
  optHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  optIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  optTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  ratingClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingValue: { fontSize: 12, fontWeight: "800" },
  starsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  starHit: { flex: 1, alignItems: "center", paddingVertical: 2 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleHit: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  toggleCopy: { flex: 1, minWidth: 0 },
  toggleSub: { fontSize: 11.5, lineHeight: 15, marginTop: 1 },

  // Bölüm başlığı + hap anahtarı
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 10 },
  sectionLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  sectionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: "800" },
  pillTrack: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillText: { fontSize: 13 },
});
