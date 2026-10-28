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

  const showPercent = voted && !!shares?.showPercent;

  return (
    <HubCard colors={COLORS} shadowColor={SHADOW} cardStyle={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name="help-circle-outline" size={136} color="rgba(255,255,255,0.08)" />
      </View>

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
          const showBar = showPercent;
          const pct = Math.max(0, Math.min(100, option.percent));
          return (
            <GlassPressable
              key={option.key}
              glass={false}
              onPress={voted ? undefined : () => { triggerHaptic("selection"); vote(option.key); }}
              disabled={voted}
              accessibilityRole="button"
              accessibilityLabel={showBar ? copy.resultA11y(option.text, pct) : copy.optionA11y(option.text)}
              accessibilityState={{ selected: chosen, disabled: voted }}
              style={({ pressed }) => [
                styles.option,
                voted && (chosen ? styles.optionChosen : styles.optionMuted),
                voted && !showBar && chosen && styles.optionChosenSolid,
                !voted && pressed && styles.optionPressed,
              ]}
            >
              {showBar ? (
                <>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.fill,
                      chosen ? styles.fillChosen : styles.fillMuted,
                      pct > 0 && pct < 100 && (chosen ? styles.fillEdgeChosen : styles.fillEdgeMuted),
                      { width: `${pct}%` },
                    ]}
                  />
                  <View pointerEvents="none" style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        chosen ? styles.barFillChosen : styles.barFillMuted,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.optionRow}>
                <View style={styles.indicatorWrap}>
                  {chosen ? (
                    <AppIcon family="Ionicons" name="checkmark-circle" size={20} color={GOLD} />
                  ) : (
                    <View style={[styles.radioRing, voted && styles.radioRingMuted]}>
                      {!voted ? <View style={styles.radioDot} /> : null}
                    </View>
                  )}
                </View>

                <Text
                  style={[styles.optionText, voted && !chosen && styles.optionTextMuted]}
                  allowFontScaling={false}
                  numberOfLines={2}
                >
                  {option.text}
                </Text>

                {showBar ? (
                  <View style={[styles.percentBadge, chosen && styles.percentBadgeChosen]}>
                    <Text
                      style={[styles.percent, !chosen && styles.percentMuted]}
                      allowFontScaling={false}
                    >
                      {`${pct}%`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassPressable>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        {showPercent && status === "ready" ? (
          <View style={styles.youPickedPill}>
            <AppIcon family="Ionicons" name="checkmark-circle" size={13} color={GOLD} />
            <Text style={styles.youPickedText} allowFontScaling={false} numberOfLines={1}>
              {copy.youPicked}
            </Text>
          </View>
        ) : null}
        <Text
          style={[styles.footer, showPercent && status === "ready" && styles.footerRight]}
          allowFontScaling={false}
          numberOfLines={2}
        >
          {voted && myChoice && !showPercent && status === "ready" ? `${copy.youPicked} · ${footer}` : footer}
        </Text>
      </View>
    </HubCard>
  );
}

export default memo(DailyPollWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  watermark: { position: "absolute", right: -16, top: -14, transform: [{ rotate: "-12deg" }] },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  prompt: {
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 10,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  options: { gap: 9, marginTop: 13 },
  // Dış kabukta padding YOK: mutlak konumlu yüzde barı (`fill`) Yoga'da tam genişliği (%0–%100)
  // kayıpsız ölçsün; çerçeve kalınlığı (1.5) her durumda sabit kalarak seçim anında zıplamayı önler.
  option: {
    minHeight: 54,
    borderRadius: 16,
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
  },
  optionPressed: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.48)",
    transform: [{ scale: 0.988 }],
  },
  optionChosen: {
    backgroundColor: "rgba(14, 5, 36, 0.30)",
    borderColor: "rgba(255,255,255,0.92)",
  },
  optionChosenSolid: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  optionMuted: {
    backgroundColor: "rgba(14, 5, 36, 0.34)",
    borderColor: "rgba(255,255,255,0.15)",
  },

  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  fillChosen: { backgroundColor: "rgba(255,255,255,0.26)" },
  fillMuted: { backgroundColor: "rgba(255,255,255,0.10)" },
  fillEdgeChosen: { borderRightWidth: 1.5, borderRightColor: "rgba(255,255,255,0.45)" },
  fillEdgeMuted: { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.18)" },

  barTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  barFill: { height: "100%", borderRadius: 1.5 },
  barFillChosen: { backgroundColor: GOLD },
  barFillMuted: { backgroundColor: "rgba(255,255,255,0.38)" },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  indicatorWrap: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  radioRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioRingMuted: {
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  optionText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  optionTextMuted: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "700",
  },

  percentBadge: {
    minWidth: 48,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  percentBadgeChosen: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.42)",
  },
  percent: {
    color: "#FFFFFF",
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  percentMuted: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "800",
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 22,
    marginTop: 11,
  },
  youPickedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  youPickedText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  footer: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  footerRight: {
    textAlign: "right",
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
