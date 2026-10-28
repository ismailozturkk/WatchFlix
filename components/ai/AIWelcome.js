// components/ai/AIWelcome.js
//
// CineMatch'in boş sohbet ekranı: günün anına göre selamlayan kompakt degrade
// başlık, "ruh haline göre bul" seçicisi (ruh hali · süre · kiminle), etkin
// filtre özeti ve hazır istek bölümleri (Keşfet · Karşılaştır · Listeler).
//
// Hazır istek bölümleri akordeondur: kapalıyken başlık + emoji önizlemesi
// (ilk istekler) görünür, basınca açılır ve istekler yatay kaydırılan önizleme
// kartlarına dönüşür (etiket + AI'a gidecek metin). Aynı anda tek bölüm açık.
// Açılış BİLEREK animasyonsuz: kartlar cam; atada opaklık animasyonu ya da
// overflow:hidden iOS 26 camını bozar/keser.
//
// Önizleme kartları ETKİLEŞİMSİZ cam (GlassBox): etkileşimli cam (GlassTouchable)
// basınca kutusunun dışına esner ve yatay kaydırıcının sınırında kesik görünür.
// Basma geri bildirimi kartın hafifçe küçülmesidir (transform; opaklık değil).
//
// Ruh hali seçicisi tek bir AI mesajı gönderir; seçimler istek METNİNİN içine
// girer (services/aiCineInsights.buildVibePrompt), böylece sonraki mesajlarda
// da konuşma geçmişiyle hatırlanır.

import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet } from "react-native";
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
import { fillCopy } from "../../utils/aiCopy";
import { ChoiceWrap } from "./AIChips";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";

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

// Kapalı bölümde önizlenen emoji sayısı; fazlası "+N" olur.
const PREVIEW_EMOJIS = 4;

const options = (table, labels, icons) =>
  Object.keys(table).map((value) => ({ value, label: labels[value], icon: icons[value] }));

// Harf/rakam içeren ilk sözcük emoji sayılmaz (Hermes'te \p{L} yok; Latin +
// Kiril aralıkları yeterli).
const WORD_CHAR = /[0-9A-Za-zÀ-ɏЀ-ӿ]/;

/** "🍿 Film öner" → { emoji: "🍿", text: "Film öner" }; emojisiz etiket olduğu gibi kalır. */
export function splitChipLabel(label) {
  const raw = String(label ?? "").trim();
  const match = /^(\S+)\s+(.+)$/.exec(raw);
  if (match && match[1].length <= 12 && !WORD_CHAR.test(match[1])) {
    return { emoji: match[1], text: match[2] };
  }
  return { emoji: null, text: raw };
}

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

      <GlassTouchable
        activeOpacity={0.85}
        disabled={!ready}
        onPress={() => onSubmit(normalizeVibe(vibe))}
        style={[s.cta, { backgroundColor: theme.accent, opacity: ready ? 1 : 0.4 }]}
      >
        <Ionicons name="sparkles" size={16} color="#fff" />
        <Text style={s.ctaText}>{ready ? copy.vibe.cta : copy.vibe.pickOne}</Text>
      </GlassTouchable>
    </View>
  );
});

const PromptPreviewCard = memo(({ chip, icon, theme, askLabel, onPress }) => {
  const { emoji, text } = splitChipLabel(chip.label);
  // Kartta AI'a gidecek metin önizlenir; metni modele yönelik (ör. İngilizce
  // "sürpriz" istemi) olan çipler kendi `preview` metnini taşır.
  const preview = chip.preview ?? chip.prompt;
  return (
    <Pressable
      onPress={() => onPress(chip.prompt)}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={preview}
    >
      {({ pressed }) => (
        <GlassBox
          role="card"
          style={[s.card, { backgroundColor: theme.primary, borderColor: theme.border }, pressed && s.cardPressed]}
        >
          <View style={[s.cardEmoji, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            {emoji ? (
              <Text style={s.cardEmojiText}>{emoji}</Text>
            ) : (
              <Ionicons name={icon} size={18} color={theme.bold} />
            )}
          </View>
          <Text numberOfLines={1} style={[s.cardTitle, { color: theme.text.primary }]}>
            {text}
          </Text>
          <Text numberOfLines={3} style={[s.cardPrompt, { color: theme.text.muted }]}>
            “{preview}”
          </Text>
          <View style={s.cardFoot}>
            <Text style={[s.cardAsk, { color: theme.bold }]}>{askLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color={theme.bold} />
          </View>
        </GlassBox>
      )}
    </Pressable>
  );
});

const PromptSection = memo(({ tab, title, hint, icon, chips, open, onToggle, onSendChip, theme, copy }) => {
  const parts = useMemo(() => chips.map((chip) => splitChipLabel(chip.label)), [chips]);
  const emojis = parts.map((part) => part.emoji).filter(Boolean);
  const shown = emojis.slice(0, PREVIEW_EMOJIS);
  const rest = chips.length - shown.length;
  const peek = parts.slice(0, 3).map((part) => part.text).join(" · ");

  return (
    <View
      style={[
        s.section,
        {
          backgroundColor: open ? alpha(theme.bold, 0.07) : theme.secondary,
          borderColor: open ? alpha(theme.bold, 0.45) : theme.border,
        },
      ]}
    >
      <GlassTouchable
        activeOpacity={0.8}
        onPress={() => onToggle(tab)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${fillCopy(copy.welcome.count, { n: chips.length })}`}
        accessibilityHint={hint}
        style={s.sectionHead}
      >
        <View style={[s.sectionIcon, { backgroundColor: open ? alpha(theme.bold, 0.18) : alpha(theme.accent, 0.14) }]}>
          <Ionicons name={icon} size={18} color={theme.bold} />
        </View>
        <View style={s.sectionBody}>
          <View style={s.sectionTitleRow}>
            <Text numberOfLines={1} style={[s.sectionTitle, { color: open ? theme.bold : theme.text.primary }]}>
              {title}
            </Text>
            <View style={[s.countPill, { backgroundColor: alpha(theme.bold, 0.12) }]}>
              <Text style={[s.countText, { color: theme.bold }]}>{chips.length}</Text>
            </View>
          </View>
          {open ? (
            <Text numberOfLines={1} style={[s.sectionHint, { color: theme.text.muted }]}>
              {hint}
            </Text>
          ) : (
            <View style={s.peekRow}>
              {shown.length > 0 && (
                <View style={s.emojiStack}>
                  {shown.map((emoji, i) => (
                    <View
                      key={`${emoji}-${i}`}
                      style={[
                        s.emojiBubble,
                        { backgroundColor: theme.primary, borderColor: theme.secondary, marginLeft: i ? -7 : 0 },
                      ]}
                    >
                      <Text style={s.emojiBubbleText}>{emoji}</Text>
                    </View>
                  ))}
                  {rest > 0 && (
                    <View
                      style={[
                        s.emojiBubble,
                        { backgroundColor: alpha(theme.bold, 0.14), borderColor: theme.secondary, marginLeft: -7 },
                      ]}
                    >
                      <Text style={[s.restText, { color: theme.bold }]}>+{rest}</Text>
                    </View>
                  )}
                </View>
              )}
              <Text numberOfLines={1} style={[s.peekText, { color: theme.text.muted }]}>
                {peek}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={open ? theme.bold : theme.text.muted} />
      </GlassTouchable>

      {open && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.cardRow}
        >
          {chips.map((chip, i) => (
            <PromptPreviewCard
              key={`${chip.label}-${i}`}
              chip={chip}
              icon={icon}
              theme={theme}
              askLabel={copy.welcome.ask}
              onPress={onSendChip}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
});

function AIWelcome({
  theme,
  t,
  copy,
  tabs,
  tabIcons,
  chipsByTab,
  filterSummary,
  onOpenFilters,
  onSendChip,
  onVibe,
}) {
  const kicker = useMemo(() => momentLabel(copy, new Date()), [copy]);
  // Hepsi kapalı başlar; açık bölüme yeniden basmak kapatır.
  const [openTab, setOpenTab] = useState(null);
  const toggleTab = useCallback((tab) => setOpenTab((current) => (current === tab ? null : tab)), []);

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
          <Text numberOfLines={2} style={s.heroTitle}>
            {t?.AICineChat?.emptyTitle || "Ne izleyeceğine birlikte karar verelim"}
          </Text>
        </View>
      </LinearGradient>

      {filterSummary ? (
        <GlassTouchable
          activeOpacity={0.82}
          onPress={onOpenFilters}
          style={[s.activeFilters, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.35) }]}
        >
          <Ionicons name="options-outline" size={15} color={theme.bold} />
          <Text numberOfLines={2} style={[s.activeFiltersText, { color: theme.bold }]}>
            {filterSummary}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={theme.bold} />
        </GlassTouchable>
      ) : null}

      <VibePicker theme={theme} copy={copy} onSubmit={onVibe} />

      <View style={s.sections}>
        {tabs.map((tab) => (
          <PromptSection
            key={tab}
            tab={tab}
            title={t?.AICineChat?.tabs?.[tab] || tab}
            hint={t?.AICineChat?.tabHints?.[tab] || ""}
            icon={tabIcons[tab]}
            chips={chipsByTab?.[tab] || []}
            open={openTab === tab}
            onToggle={toggleTab}
            onSendChip={onSendChip}
            theme={theme}
            copy={copy}
          />
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
    gap: 4,
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 14,
  },
  heroLottie: { width: 50, height: 50 },
  heroKicker: { color: "rgba(255,255,255,0.78)", fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 15, lineHeight: 19, fontWeight: "800", letterSpacing: -0.2, marginTop: 2 },

  activeFilters: {
    width: "100%",
    marginTop: 10,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  activeFiltersText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },

  vibe: { marginTop: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
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

  sections: { width: "100%", gap: 8, marginTop: 14 },
  section: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionBody: { flex: 1, minWidth: 0 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { flexShrink: 1, fontSize: 14, fontWeight: "800" },
  countPill: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 10.5, fontWeight: "800" },
  sectionHint: { fontSize: 11, marginTop: 3 },
  peekRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5 },
  emojiStack: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  emojiBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBubbleText: { fontSize: 11 },
  restText: { fontSize: 9, fontWeight: "800" },
  peekText: { flex: 1, fontSize: 11 },

  cardRow: { gap: 8, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12 },
  card: {
    width: 158,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
  },
  cardPressed: { transform: [{ scale: 0.97 }] },
  cardEmoji: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  cardEmojiText: { fontSize: 17 },
  cardTitle: { fontSize: 13, fontWeight: "800", marginTop: 9 },
  cardPrompt: { fontSize: 11, lineHeight: 15, marginTop: 4, minHeight: 45 },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  cardAsk: { fontSize: 11.5, fontWeight: "800" },
});
