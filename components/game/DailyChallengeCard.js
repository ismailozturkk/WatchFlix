// components/game/DailyChallengeCard.js
//
// Günlük Meydan Okuma kartı: Hub sekmesindeki Oyunlar modülünün ve Oyun
// Merkezi'nin ORTAK vitrini. Tek dokunuşla ya oyunu başlatır (müsaitse) ya da
// bugünün sıralamasını açar (deneme kullanıldıysa).
//
// Sağdaki afiş yığını ağdan bağımsız: uygulamayla paketlenen splash afişlerinden
// günün tohumuyla seçilir (her gün farklı üçlü), yani kart yüklenirken boş kalmaz.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { hashString } from "@utils/seededRandom";
import { formatRemaining } from "@utils/dailyChallenge";
import { SPLASH_POSTER_CATALOG } from "../../data/splashPosterCatalog";
import { PressableScale } from "./ui";

// Üç afişin yığın yerleşimi (sağdan taşan, hafif dönük).
const POSTER_LAYOUT = [
  { right: 78, top: 26, rotate: "-11deg", scale: 0.92, opacity: 0.85 },
  { right: 36, top: 14, rotate: "-2deg", scale: 1, opacity: 0.95 },
  { right: -6, top: 34, rotate: "10deg", scale: 0.96, opacity: 1 },
];
// İnce (compact) bant: daha küçük afişler, daha sıkı yığın — Eğlence'deki Oyunlar modülü bunu kullanır.
const POSTER_LAYOUT_COMPACT = [
  { right: 60, top: 22, rotate: "-11deg", scale: 0.92, opacity: 0.85 },
  { right: 28, top: 12, rotate: "-2deg", scale: 1, opacity: 0.95 },
  { right: -6, top: 28, rotate: "10deg", scale: 0.96, opacity: 1 },
];

function pickPosters(dayKey) {
  const total = SPLASH_POSTER_CATALOG.length;
  const picked = [];
  let salt = 0;
  while (picked.length < 3 && salt < 30) {
    const index = hashString(`${dayKey}|poster|${salt}`) % total;
    if (!picked.includes(index)) picked.push(index);
    salt += 1;
  }
  return picked.map((index) => SPLASH_POSTER_CATALOG[index]);
}

export default function DailyChallengeCard({ daily, theme, onPlay, onResult, compact = false }) {
  const completed = daily.status === "completed";
  const posters = useMemo(() => pickPosters(daily.dayKey), [daily.dayKey]);
  const remaining = formatRemaining(daily.expiresAt, daily.now);
  const result = daily.result;

  const accent = theme.accent;
  const bold = theme.bold || theme.accent;

  const title = completed
    ? i18nText("autoI18n.gunluk_bugun_bitti", "Bugünkü deneme tamam")
    : i18nText("autoI18n.gunluk_bugunun_sahneleri", "Bugünün 10 sahnesi");
  const subtitle = completed
    ? i18nText("autoI18n.gunluk_sonuc_ozeti", "{{correct}}/{{total}} doğru · {{score}} puan", {
        correct: result?.correct || 0,
        total: result?.total || daily.questionCount,
        score: result?.score || 0,
      })
    : i18nText("autoI18n.gunluk_herkes_ayni", "Herkes aynı sahneleri görür. Tek deneme, yarın yeni set.");
  const cta = completed
    ? i18nText("autoI18n.gunluk_siralamayi_gor", "Sıralamayı gör")
    : i18nText("autoI18n.gunluk_basla", "Başla");

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma")}. ${title}. ${cta}`}
      onPress={completed ? onResult : onPlay}
      scaleTo={0.98}
      style={[styles.shadow, compact && styles.shadowCompact, { shadowColor: bold }]}
    >
      <LinearGradient colors={[bold, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, compact && styles.cardCompact]}>
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />

        <View pointerEvents="none" style={styles.posterStack}>
          {posters.map((poster, index) => {
            const layout = (compact ? POSTER_LAYOUT_COMPACT : POSTER_LAYOUT)[index];
            return (
              <View
                key={`${poster.mediaType}-${poster.id}`}
                style={[
                  styles.poster,
                  compact && styles.posterCompact,
                  {
                    right: layout.right,
                    top: layout.top,
                    opacity: layout.opacity,
                    transform: [{ rotate: layout.rotate }, { scale: layout.scale }],
                  },
                ]}
              >
                <Image source={poster.source} style={styles.posterImage} contentFit="cover" />
              </View>
            );
          })}
        </View>

        <View style={styles.badge}>
          <AppIcon family="Ionicons" name={completed ? "checkmark-circle" : "sunny"} size={12} color={completed ? "#7CF3A6" : "#FFD76A"} />
          <Text style={styles.badgeText} allowFontScaling={false}>
            {i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma").toUpperCase()}
          </Text>
        </View>

        <Text style={[styles.title, compact && styles.titleCompact]} allowFontScaling={false} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} allowFontScaling={false} numberOfLines={2}>
          {subtitle}
        </Text>

        <View style={[styles.footer, compact && styles.footerCompact]}>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <AppIcon family="Ionicons" name="time-outline" size={13} color="#FFFFFF" />
              <Text style={styles.chipText} allowFontScaling={false}>
                {remaining}
              </Text>
            </View>
            <View style={styles.chip}>
              <AppIcon family="Ionicons" name="flame" size={13} color={daily.streak > 0 ? "#FF9F5A" : "rgba(255,255,255,0.7)"} />
              <Text style={styles.chipText} allowFontScaling={false}>
                {daily.streak}
              </Text>
            </View>
            <View style={styles.chip}>
              <AppIcon family="Ionicons" name="sparkles" size={13} color="#FFD76A" />
              <Text style={styles.chipText} allowFontScaling={false}>
                +{completed && result?.xpEarned ? result.xpEarned : daily.rewardXp}
              </Text>
            </View>
          </View>

          <View style={[styles.cta, compact && styles.ctaCompact]}>
            <Text style={[styles.ctaText, { color: bold }]} allowFontScaling={false}>
              {cta}
            </Text>
            <AppIcon family="Ionicons" name={completed ? "podium-outline" : "play"} size={13} color={bold} />
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 26,
    elevation: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
  shadowCompact: { borderRadius: 22 },
  card: {
    minHeight: 204,
    borderRadius: 26,
    padding: 18,
    overflow: "hidden",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cardCompact: { minHeight: 0, padding: 14, borderRadius: 22 },
  glowOne: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -70,
    top: -90,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  glowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -40,
    bottom: -50,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  posterStack: { ...StyleSheet.absoluteFill },
  poster: {
    position: "absolute",
    width: 62,
    height: 93,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  posterCompact: { width: 48, height: 72, borderRadius: 8 },
  posterImage: { width: "100%", height: "100%" },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  badgeText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.9 },
  title: { color: "#FFFFFF", fontSize: 24, lineHeight: 29, fontWeight: "900", maxWidth: "62%", marginTop: 12 },
  titleCompact: { fontSize: 19, lineHeight: 23, marginTop: 9 },
  subtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "650",
    maxWidth: "62%",
    marginTop: 5,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 },
  footerCompact: { marginTop: 10 },
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
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  ctaCompact: { height: 34, paddingHorizontal: 12, borderRadius: 12 },
  ctaText: { fontSize: 12.5, fontWeight: "900" },
});
