// components/hub/DailyPollWidget.js
//
// Eğlence'deki "Günün Sorusu" kartı: sinema zevkiyle ilgili iki seçenekli bir soru. Oy verilmeden sonuç görünmez;
// oy verilince iki seçenek yüzde çubuğuna döner (kendi seçimin işaretli). Toplam oy az ise (< 5) yüzde yerine
// "sonuçlar oy arttıkça belirir" der — tek oyla "%100" yanıltıcı olurdu.
//
// Oy yazılamazsa (çevrimdışı / sunucu kuralları henüz yayında değil) kart bozulmaz: oy yerelde görünür, alt satır
// "bu cihazda kayıtlı, bağlantı gelince sayılacak" der ve sonraki açılışta yeniden denenir.
//
// Soru metni paketlidir (data/dailyPollQuestions.js), sunucudan yalnız iki sayaç okunur.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassPressable from "@components/common/GlassPressable";
import HubCard, { GlassPill } from "@components/hub/HubCard";
import useDailyPoll from "@hooks/useDailyPoll";
import { useLanguage } from "@context/LanguageContext";
import { getPollCopy } from "@utils/dailyPollCopy";
import { triggerHaptic } from "@services/hapticsService";

const COLORS = ["#A855F7", "#7E22CE", "#2E1065"];
const SHADOW = "#7E22CE";
const GOLD = "#FFD76A";

function DailyPollWidget() {
  const { language } = useLanguage();
  const copy = getPollCopy(language);
  const { question, myChoice, shares, status, streak, vote } = useDailyPoll({ source: "hub" });
  if (!question) return null;

  const voted = !!myChoice;
  const options = [
    { key: "a", text: question.a, percent: shares?.percentA ?? 0, count: shares?.a ?? 0 },
    { key: "b", text: question.b, percent: shares?.percentB ?? 0, count: shares?.b ?? 0 },
  ];

  const footer =
    status === "saving"
      ? copy.waiting
      : status === "pending"
        ? copy.pendingSync
        : voted && shares
          ? shares.showPercent
            ? copy.votes(shares.total)
            : shares.total <= 1
              ? copy.firstVoter
              : copy.fewVotes
          : voted
            ? copy.nextQuestion
            : copy.hint;

  return (
    <HubCard colors={COLORS} shadowColor={SHADOW} cardStyle={styles.card}>
      <View style={styles.badges}>
        <GlassPill icon="help-circle" text={copy.eyebrow} tone="dark" />
        {streak >= 2 ? <GlassPill icon="flame" iconColor={GOLD} text={copy.streak(streak)} /> : null}
      </View>

      <Text style={styles.prompt} allowFontScaling={false}>
        {question.prompt}
      </Text>

      <View style={styles.options}>
        {options.map((option) => {
          const chosen = myChoice === option.key;
          const showBar = voted && !!shares?.showPercent;
          return (
            <GlassPressable
              key={option.key}
              onPress={voted ? undefined : () => { triggerHaptic("selection"); vote(option.key); }}
              disabled={voted}
              accessibilityRole="button"
              accessibilityLabel={voted && shares?.showPercent ? copy.resultA11y(option.text, option.percent) : copy.optionA11y(option.text)}
              accessibilityState={{ selected: chosen, disabled: voted }}
              style={[styles.option, showBar && styles.optionClip, chosen && styles.optionChosen]}
            >
              {showBar ? (
                <View
                  pointerEvents="none"
                  style={[styles.fill, chosen && styles.fillChosen, { width: `${Math.max(4, option.percent)}%` }]}
                />
              ) : null}
              <View style={styles.optionRow}>
                {chosen ? <AppIcon family="Ionicons" name="checkmark-circle" size={18} color="#FFFFFF" /> : null}
                <Text style={styles.optionText} allowFontScaling={false} numberOfLines={2}>
                  {option.text}
                </Text>
                {showBar ? (
                  <Text style={styles.percent} allowFontScaling={false}>
                    {`${option.percent}%`}
                  </Text>
                ) : null}
              </View>
            </GlassPressable>
          );
        })}
      </View>

      <Text style={styles.footer} allowFontScaling={false} numberOfLines={2}>
        {voted && myChoice && !(shares?.showPercent) && status === "ready" ? `${copy.youPicked} · ${footer}` : footer}
      </Text>
    </HubCard>
  );
}

export default memo(DailyPollWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  prompt: {
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 10,
  },
  options: { gap: 8, marginTop: 12 },
  option: {
    minHeight: 48,
    borderRadius: 16,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  optionChosen: { borderColor: "rgba(255,255,255,0.85)", borderWidth: 1.5 },
  // Kırpma YALNIZ sonuç çubuğu görünürken (oy verilmiş = düğme kapalı): etkin cam düğmenin
  // katmanı çocuğudur, overflow onu basılınca düğmenin sınırında keserdi.
  optionClip: { overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.16)" },
  fillChosen: { backgroundColor: "rgba(255,255,255,0.34)" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionText: { flex: 1, color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontWeight: "800" },
  percent: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  footer: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 16, fontWeight: "600", marginTop: 10 },
});
