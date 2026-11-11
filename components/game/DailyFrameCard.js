// components/game/DailyFrameCard.js
//
// Eğlence → Oyunlar modülünün başındaki "Günün Karesi" bandı (oyun: screens/game/DailyFrameScreen.js).
// Ağsız: durum yalnız cihaz kaydından (hooks/useDailyFrame.useDailyFrameSummary) — kart bulmacayı yüklemez.
// Üç hâl: yeni (Oyna) · yarıda (Devam et, kaç hak kaldı) · bitti (kutucuklar, Sonucu gör).
// Premium (registry "daily_frame"): `locked` iken kart görünür ama "Premium" der; dokunuş yine `onPlay` (çağıran
// yükseltme sayfasını açar).

import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useDailyFrameSummary } from "@hooks/useDailyFrame";
import { formatRemaining, nextDayStartMs } from "@utils/dailyChallenge";
import { FRAME_MAX_GUESSES } from "@utils/dailyFrame";
import { getFrameCopy } from "@utils/dailyFrameCopy";
import { PressableScale } from "./ui";
import BetaBadge from "../common/BetaBadge";
import { isBetaFeature } from "@utils/betaFeatures";
import { upperText } from "@utils/i18nText";
import useLoopActive from "../../hooks/useLoopActive";

const COLORS = ["#312E81", "#4F46E5", "#7C3AED"];
const INK = "#312E81";
const MARK_COLORS = { miss: "#EF4444", skip: "#CBD5E1", hit: "#4ADE80", empty: "rgba(0,0,0,0.28)" };

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  const active = useLoopActive();
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function DailyFrameCard({ onPlay, locked = false }) {
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const copy = getFrameCopy(language);
  const summary = useDailyFrameSummary({ uid: user?.uid || null });
  const now = useClock();

  const done = summary.status === "won" || summary.status === "lost";
  const playing = summary.status === "playing";
  const hit = summary.marks ? summary.marks.indexOf("hit") : -1;
  const title = done ? copy.cardDone : copy.title;
  const subtitle = done
    ? hit >= 0
      ? copy.wonLine(hit + 1)
      : copy.lostTitle
    : playing
      ? copy.guessesLeft(FRAME_MAX_GUESSES - summary.guesses)
      : copy.cardHint;
  const cta = locked ? "Premium" : done ? copy.seeResult : playing ? copy.resume : copy.play;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${copy.title} #${summary.number}. ${subtitle}. ${cta}`}
      onPress={onPlay}
      scaleTo={0.98}
      style={[styles.shadow, { shadowColor: COLORS[0] }]}
    >
      <LinearGradient colors={COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View pointerEvents="none" style={styles.watermark}>
          <View style={styles.orbitLarge} />
          <View style={styles.orbitSmall} />
          <AppIcon family="Ionicons" name="aperture-outline" size={92} color="rgba(255,255,255,0.14)" />
        </View>

        <View style={styles.topRow}>
          <View style={styles.badge}>
            <AppIcon family="Ionicons" name="aperture" size={12} color="#DDD6FE" />
            <Text style={styles.badgeText} allowFontScaling={false} numberOfLines={1}>
              {upperText(copy.title)}
            </Text>
          </View>
          <View style={styles.topRight}>
            {isBetaFeature("daily_frame") ? <BetaBadge tone="onDark" compact /> : null}
            <View style={styles.numberBadge}>
              <Text style={styles.numberText} allowFontScaling={false}>{`#${summary.number}`}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} allowFontScaling={false} numberOfLines={2}>
          {subtitle}
        </Text>

        <View style={styles.footer}>
          {summary.marks ? (
            <View style={styles.marks}>
              {summary.marks.map((mark, index) => (
                <View key={index} style={[styles.mark, { backgroundColor: MARK_COLORS[mark] }]} />
              ))}
            </View>
          ) : (
            <View style={styles.chips}>
              <View style={styles.chip}>
                <AppIcon family="Ionicons" name="time-outline" size={13} color="#FFFFFF" />
                <Text style={styles.chipText} allowFontScaling={false}>
                  {formatRemaining(nextDayStartMs(now), now)}
                </Text>
              </View>
              <View style={styles.chip}>
                <AppIcon family="Ionicons" name="flame" size={13} color={summary.streak > 0 ? "#FF9F5A" : "rgba(255,255,255,0.7)"} />
                <Text style={styles.chipText} allowFontScaling={false}>
                  {summary.streak}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.cta}>
            <Text style={styles.ctaText} allowFontScaling={false} numberOfLines={1}>
              {cta}
            </Text>
            <View style={styles.ctaIcon}>
              <AppIcon
                family="Ionicons"
                name={locked ? "diamond" : done ? "stats-chart" : playing ? "arrow-forward" : "play"}
                size={13}
                color="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

export default memo(DailyFrameCard);

const styles = StyleSheet.create({
  shadow: { borderRadius: 24, elevation: 8, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  card: {
    borderRadius: 24,
    padding: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  watermark: { position: "absolute", right: -8, top: 18, width: 116, height: 116, alignItems: "center", justifyContent: "center" },
  orbitLarge: { position: "absolute", width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  orbitSmall: { position: "absolute", width: 78, height: 78, borderRadius: 39, backgroundColor: "rgba(255,255,255,0.05)" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badge: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  badgeText: { flexShrink: 1, color: "#FFFFFF", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.9 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  numberBadge: { minWidth: 40, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  numberText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  title: { color: "#FFFFFF", fontSize: 20, lineHeight: 24, fontWeight: "900", letterSpacing: -0.35, marginTop: 11, maxWidth: "78%" },
  subtitle: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 17, fontWeight: "650", marginTop: 4, maxWidth: "78%" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 13 },
  marks: { flexDirection: "row", gap: 4, flexShrink: 1 },
  mark: { width: 18, height: 18, borderRadius: 5 },
  chips: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "850" },
  cta: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 9, minHeight: 40, paddingLeft: 14, paddingRight: 5, borderRadius: 15, backgroundColor: "#FFFFFF", shadowColor: "#111827", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  ctaText: { color: INK, fontSize: 12.5, fontWeight: "900", letterSpacing: -0.1 },
  ctaIcon: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: INK },
});
