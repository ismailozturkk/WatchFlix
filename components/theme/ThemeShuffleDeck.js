// components/theme/ThemeShuffleDeck.js
//
// "Keşfet" sekmesi: ruh haline göre ALTI rastgele tema adayını mini
// mockup olarak yan yana gösterir; kullanıcı beğendiğine dokunur (önizlemeye
// uygulanır, geri alınabilir). Tek bir sonuç yerine aday galerisi, "rastgele"
// deneyimini şansa değil seçime çevirir. Zemin ve vurgu ayrı ayrı KİLİTLENEBİLİR:
// biri sabitken kalan renk karıştırılır.
import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { MOODS } from "@utils/themeStudio";
import { alpha } from "../../theme/colors";
import { moodLabel } from "./themeStudioCopy";
import { SectionHeader, inkOn } from "./ThemeStudioKit";

/* ───────────────────────── Aday kartı ───────────────────────── */

const CandidateCard = memo(function CandidateCard({
  item,
  label,
  icon,
  applied,
  appliedText,
  index,
  animKey,
  reduceMotion,
  onPress,
  theme,
  tone,
}) {
  const t = item.tones?.[tone] || item.tokens;
  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return undefined;
    }
    anim.setValue(0);
    const run = Animated.timing(anim, {
      toValue: 1,
      duration: 340,
      delay: index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [animKey, index, reduceMotion, anim]);

  const enter = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.candidateWrap, enter]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: applied }}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View
          style={[
            styles.mock,
            { backgroundColor: t.primary, borderColor: applied ? t.accent : t.border, borderWidth: applied ? 2 : 1 },
          ]}
        >
          <View style={[styles.mockTop, { backgroundColor: t.secondary, borderBottomColor: t.border }]}>
            <View style={[styles.mockTitle, { backgroundColor: t.textPrimary }]} />
            <View style={[styles.mockDot, { backgroundColor: t.accent }]} />
          </View>
          <View style={styles.mockBody}>
            <View style={styles.mockRow}>
              <View style={[styles.mockPoster, { backgroundColor: t.between, borderColor: t.border }]} />
              <View style={styles.mockLines}>
                <View style={[styles.mockLine, { width: "74%", height: 5, backgroundColor: t.textPrimary }]} />
                <View style={[styles.mockLine, { width: "92%", backgroundColor: t.textSecondary }]} />
                <View style={[styles.mockLine, { width: "56%", backgroundColor: t.textMuted }]} />
              </View>
            </View>
            <View style={[styles.mockBtn, { backgroundColor: t.accent }]}>
              <View style={styles.mockBtnLine} />
            </View>
          </View>
          <View style={[styles.mockTab, { backgroundColor: t.tab, borderTopColor: t.border }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.mockTabDot, { backgroundColor: i === 0 ? t.accent : t.textMuted }]} />
            ))}
          </View>
          {applied ? (
            <View style={[styles.appliedBadge, { backgroundColor: t.accent }]}>
              <AppIcon family="Ionicons" name="checkmark" size={12} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <View style={styles.candidateMeta}>
          <AppIcon family="Ionicons" name={icon} size={13} color={applied ? theme.accent : theme.text.muted} />
          <Text
            numberOfLines={1}
            style={[styles.candidateLabel, { color: applied ? theme.text.primary : theme.text.secondary }]}
          >
            {label}
          </Text>
          {applied ? (
            <Text style={[styles.candidateApplied, { color: theme.accent }]}>{appliedText}</Text>
          ) : (
            // Üç tonun zeminleri: aday tek renk değil, açık · orta · koyu bir set.
            <View style={styles.toneDots}>
              {["light", "mid", "dark"].map((key) => (
                <View
                  key={key}
                  style={[
                    styles.toneDot,
                    { backgroundColor: item.tones?.[key]?.primary || t.primary, borderColor: alpha(theme.text.primary, 0.22) },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

/* ───────────────────────── Ruh hali çipi ───────────────────────── */

const MoodChip = memo(function MoodChip({ icon, label, active, onPress, theme }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.moodChip,
        active
          ? { backgroundColor: alpha(theme.accent, 0.16), borderColor: alpha(theme.accent, 0.6) }
          : { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <AppIcon family="Ionicons" name={icon} size={15} color={active ? theme.accent : theme.text.muted} />
      <Text style={[styles.moodText, { color: active ? theme.text.primary : theme.text.secondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/* ───────────────────────── Kilit hapı ───────────────────────── */

const LockPill = memo(function LockPill({ label, color, locked, onPress, theme }) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: locked }}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.lockPill,
        locked
          ? { backgroundColor: alpha(theme.accent, 0.14), borderColor: alpha(theme.accent, 0.55) }
          : { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.lockSwatch, { backgroundColor: color, borderColor: alpha(inkOn(color), 0.25) }]}>
        <AppIcon
          family="Ionicons"
          name={locked ? "lock-closed" : "lock-open-outline"}
          size={11}
          color={inkOn(color)}
        />
      </View>
      <Text style={[styles.lockText, { color: locked ? theme.text.primary : theme.text.secondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/* ───────────────────────── Deste ───────────────────────── */

function ThemeShuffleDeck({
  theme,
  copy,
  candidates,
  appliedKey,
  candidateLabel,
  moodId,
  onMood,
  lockBg,
  lockAccent,
  lockColors,
  onToggleLock,
  onShuffle,
  onPick,
  shuffleKey,
  tone,
  reduceMotion,
}) {
  const spin = useRef(new Animated.Value(0)).current;

  const handleShuffle = () => {
    if (!reduceMotion) {
      spin.setValue(0);
      Animated.timing(spin, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    onShuffle();
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.deck}>
      <SectionHeader icon="dice-outline" title={copy.discoverTitle} sub={copy.discoverSub} theme={theme} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moodRow}
        keyboardShouldPersistTaps="handled"
      >
        <MoodChip icon="infinite" label={copy.moodMix} active={!moodId} onPress={() => onMood(null)} theme={theme} />
        {MOODS.map((mood) => (
          <MoodChip
            key={mood.id}
            icon={mood.icon}
            label={moodLabel(copy, mood.id)}
            active={moodId === mood.id}
            onPress={() => onMood(mood.id)}
            theme={theme}
          />
        ))}
      </ScrollView>

      <View style={styles.lockRow}>
        <LockPill
          label={copy.lockBg}
          color={lockColors.bg}
          locked={lockBg}
          onPress={() => onToggleLock("bg")}
          theme={theme}
        />
        <LockPill
          label={copy.lockAccent}
          color={lockColors.accent}
          locked={lockAccent}
          onPress={() => onToggleLock("accent")}
          theme={theme}
        />
      </View>
      <Text style={[styles.lockHint, { color: theme.text.muted }]}>
        {lockBg && lockAccent ? copy.lockedBoth : copy.lockHint}
      </Text>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy.shuffle} activeOpacity={0.88} onPress={handleShuffle}>
        <LinearGradient
          colors={[theme.accent, theme.bold || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shuffleBtn}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <AppIcon family="Ionicons" name="dice" size={22} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.shuffleText}>{copy.shuffle}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.grid}>
        {candidates.map((item, index) => (
          <CandidateCard
            key={`${index}`}
            item={item}
            index={index}
            animKey={shuffleKey}
            reduceMotion={reduceMotion}
            label={candidateLabel(item)}
            icon={MOODS.find((m) => m.id === item.moodId)?.icon || "color-palette"}
            applied={appliedKey === item.key}
            appliedText={copy.applied}
            onPress={() => onPick(item)}
            theme={theme}
            tone={tone}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(ThemeShuffleDeck);

const styles = StyleSheet.create({
  deck: { gap: 14 },

  moodRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  moodChip: { minHeight: 38, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12 },
  moodText: { fontSize: 12.5, fontWeight: "800" },

  lockRow: { flexDirection: "row", gap: 10 },
  lockPill: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 9 },
  lockSwatch: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lockText: { flex: 1, fontSize: 12, fontWeight: "800" },
  lockHint: { fontSize: 11, fontWeight: "650", marginTop: -6, marginLeft: 2 },

  shuffleBtn: { minHeight: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  shuffleText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  candidateWrap: { width: "48.5%" },
  pressed: { opacity: 0.85 },
  mock: { height: 122, borderRadius: 16, overflow: "hidden" },
  mockTop: { height: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  mockTitle: { width: "36%", height: 5, borderRadius: 3 },
  mockDot: { width: 10, height: 10, borderRadius: 5 },
  mockBody: { paddingHorizontal: 9, paddingTop: 8, gap: 8 },
  mockRow: { flexDirection: "row", gap: 8 },
  mockPoster: { width: 28, height: 40, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  mockLines: { flex: 1, justifyContent: "center", gap: 5 },
  mockLine: { height: 4, borderRadius: 2 },
  mockBtn: { height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  mockBtnLine: { width: "32%", height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.85)" },
  mockTab: { position: "absolute", left: 0, right: 0, bottom: 0, height: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth },
  mockTabDot: { width: 6, height: 6, borderRadius: 3 },
  appliedBadge: { position: "absolute", top: 4, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  candidateMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  candidateLabel: { flexShrink: 1, fontSize: 12, fontWeight: "800" },
  candidateApplied: { fontSize: 10, fontWeight: "900", marginLeft: "auto" },

  toneDots: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  toneDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
});
