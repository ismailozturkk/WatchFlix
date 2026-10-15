// components/ai/AIWelcome.js
//
// CineMatch'in boş sohbet ekranı: günün anına göre selamlayan degrade başlık,
// "ruh haline göre bul" seçicisi (ruh hali · süre · kiminle), etkin filtre özeti,
// sekmeler ve hazır istek çipleri.
//
// Ruh hali seçicisi tek bir AI mesajı gönderir; seçimler istek METNİNİN içine
// girer (services/aiCineInsights.buildVibePrompt), böylece sonraki mesajlarda
// da konuşma geçmişiyle hatırlanır.

import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { alpha } from "../../theme/colors";
import {
  VIBE_COMPANIES,
  VIBE_LENGTHS,
  VIBE_MOODS,
  describeMoment,
  hasVibe,
  normalizeVibe,
} from "../../services/aiCineInsights";
import { ChoiceWrap } from "./AIChips";

const MOOD_ICONS = {
  cozy: "cafe-outline",
  thrilling: "pulse-outline",
  funny: "happy-outline",
  emotional: "heart-outline",
  mindbending: "infinite-outline",
  adventurous: "compass-outline",
};
const LENGTH_ICONS = { short: "flash-outline", medium: "time-outline", long: "hourglass-outline" };
const COMPANY_ICONS = {
  solo: "person-outline",
  partner: "heart-circle-outline",
  friends: "people-outline",
  family: "home-outline",
};

const options = (table, labels, icons) =>
  Object.keys(table).map((value) => ({ value, label: labels[value], icon: icons[value] }));

function momentLabel(copy, now) {
  const moment = describeMoment(now);
  if (!moment) return "";
  if (moment.weekend && moment.part !== "morning") return copy.moment.weekend;
  if (moment.part === "morning") return copy.moment.morning;
  if (moment.part === "afternoon") return copy.moment.afternoon;
  if (moment.part === "evening") return copy.moment.evening;
  return copy.moment.lateNight;
}

const VibePicker = memo(({ theme, copy, onSubmit }) => {
  const [vibe, setVibe] = useState({ mood: null, length: null, company: null });
  const ready = hasVibe(vibe);

  // Seçili değere yeniden basmak seçimi kaldırır.
  const pick = useCallback((field) => (value) => {
    setVibe((current) => ({ ...current, [field]: current[field] === value ? null : value }));
  }, []);

  const moods = useMemo(() => options(VIBE_MOODS, copy.vibe.mood, MOOD_ICONS), [copy]);
  const lengths = useMemo(() => options(VIBE_LENGTHS, copy.vibe.length, LENGTH_ICONS), [copy]);
  const companies = useMemo(() => options(VIBE_COMPANIES, copy.vibe.company, COMPANY_ICONS), [copy]);

  return (
    <View style={[s.vibe, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={s.vibeHead}>
        <View style={[s.vibeIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
          <Ionicons name="color-wand-outline" size={18} color={theme.bold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.vibeTitle, { color: theme.text.primary }]}>{copy.vibe.title}</Text>
          <Text style={[s.vibeSub, { color: theme.text.muted }]}>{copy.vibe.subtitle}</Text>
        </View>
        {ready && (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => setVibe({ mood: null, length: null, company: null })}
            accessibilityLabel={copy.vibe.clear}
          >
            <Ionicons name="close-circle" size={20} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[s.rowLabel, { color: theme.text.muted }]}>{copy.vibe.moodLabel}</Text>
      <ChoiceWrap options={moods} selected={vibe.mood ? [vibe.mood] : []} onToggle={pick("mood")} theme={theme} />

      <Text style={[s.rowLabel, { color: theme.text.muted }]}>{copy.vibe.lengthLabel}</Text>
      <ChoiceWrap options={lengths} selected={vibe.length ? [vibe.length] : []} onToggle={pick("length")} theme={theme} />

      <Text style={[s.rowLabel, { color: theme.text.muted }]}>{copy.vibe.companyLabel}</Text>
      <ChoiceWrap
        options={companies}
        selected={vibe.company ? [vibe.company] : []}
        onToggle={pick("company")}
        theme={theme}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!ready}
        onPress={() => onSubmit(normalizeVibe(vibe))}
        style={[s.cta, { backgroundColor: theme.accent, opacity: ready ? 1 : 0.4 }]}
      >
        <Ionicons name="sparkles" size={16} color="#fff" />
        <Text style={s.ctaText}>{ready ? copy.vibe.cta : copy.vibe.pickOne}</Text>
      </TouchableOpacity>
    </View>
  );
});

function AIWelcome({
  theme,
  t,
  copy,
  tabs,
  tabIcons,
  activeTab,
  onTabChange,
  chips,
  chipIcon,
  filterSummary,
  onOpenFilters,
  onSendChip,
  onVibe,
}) {
  const kicker = useMemo(() => momentLabel(copy, new Date()), [copy]);

  return (
    <View style={s.welcome}>
      <LinearGradient
        colors={[theme.accent, theme.bold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <LottieView style={s.heroLottie} source={require("@lottie/gemini.json")} autoPlay loop />
        <View style={{ flex: 1 }}>
          {!!kicker && <Text style={s.heroKicker}>{kicker.toUpperCase()}</Text>}
          <Text style={s.heroTitle}>
            {t?.AICineChat?.emptyTitle || "Ne izleyeceğine birlikte karar verelim"}
          </Text>
          <Text style={s.heroText}>
            {t?.AICineChat?.emptyText ||
              "Bir öneri iste, iki yapımı karşılaştır, izleme planı yap ya da temalı liste oluştur."}
          </Text>
        </View>
      </LinearGradient>

      {filterSummary ? (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={onOpenFilters}
          style={[s.activeFilters, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.35) }]}
        >
          <Ionicons name="options-outline" size={15} color={theme.bold} />
          <Text numberOfLines={2} style={[s.activeFiltersText, { color: theme.bold }]}>
            {filterSummary}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={theme.bold} />
        </TouchableOpacity>
      ) : null}

      <VibePicker theme={theme} copy={copy} onSubmit={onVibe} />

      <View style={s.tabRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onTabChange(tab)}
              style={[
                s.tab,
                { borderColor: active ? theme.bold : theme.border, backgroundColor: active ? alpha(theme.bold, 0.14) : "transparent" },
              ]}
            >
              <View style={[s.tabIcon, { backgroundColor: active ? alpha(theme.bold, 0.18) : theme.secondary }]}>
                <Ionicons name={tabIcons[tab]} size={18} color={active ? theme.bold : theme.text.muted} />
              </View>
              <Text style={[s.tabText, { color: active ? theme.bold : theme.text.primary }]}>
                {t?.AICineChat?.tabs?.[tab] || tab}
              </Text>
              <Text numberOfLines={2} style={[s.tabHint, { color: theme.text.muted }]}>
                {t?.AICineChat?.tabHints?.[tab] || ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.chipWrap}>
        {chips.map((chip, i) => (
          <TouchableOpacity
            key={`${chip.label}-${i}`}
            activeOpacity={0.8}
            onPress={() => onSendChip(chip.prompt)}
            style={[s.promptChip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <View style={[s.promptIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
              <Ionicons name={chipIcon} size={17} color={theme.bold} />
            </View>
            <Text style={[s.promptChipText, { color: theme.text.primary }]}>{chip.label}</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.text.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default memo(AIWelcome);

const s = StyleSheet.create({
  welcome: { paddingTop: 6, paddingHorizontal: 2 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 22,
    paddingVertical: 14,
    paddingLeft: 8,
    paddingRight: 16,
  },
  heroLottie: { width: 78, height: 78 },
  heroKicker: { color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: "800", letterSpacing: 1.1 },
  heroTitle: { color: "#fff", fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.3, marginTop: 3 },
  heroText: { color: "rgba(255,255,255,0.86)", fontSize: 12.5, lineHeight: 18, marginTop: 5 },

  activeFilters: {
    width: "100%",
    marginTop: 12,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  activeFiltersText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },

  vibe: { marginTop: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  vibeHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  vibeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vibeTitle: { fontSize: 15, fontWeight: "800" },
  vibeSub: { fontSize: 11, marginTop: 1 },
  rowLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, marginTop: 13, marginBottom: 8, textTransform: "uppercase" },
  cta: {
    marginTop: 16,
    height: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  tabRow: { width: "100%", flexDirection: "row", gap: 8, marginTop: 18 },
  tab: { flex: 1, minHeight: 92, paddingHorizontal: 7, paddingVertical: 9, borderRadius: 17, borderWidth: 1, alignItems: "center" },
  tabIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  tabText: { fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center" },
  tabHint: { fontSize: 9, lineHeight: 12, textAlign: "center", marginTop: 3 },
  chipWrap: { width: "100%", gap: 8, marginTop: 14 },
  promptChip: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  promptIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  promptChipText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
