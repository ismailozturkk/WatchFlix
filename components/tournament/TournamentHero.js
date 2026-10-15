// components/tournament/TournamentHero.js
//
// Turnuva ekranının üst kartı (seçim / oylama / "yakında" fazları). Üç katman:
//   1. Kimlik   → ay + ortam (cam çipler) ve büyük TÜR başlığı; faz ikonu soluk
//                 bir filigran olarak arkada durur.
//   2. Zaman    → "şuna kadar" etiketi + bitiş tarihi ve tam genişlik geri sayım.
//   3. İlerleme → interaktif aşama çizelgesi (düğüme bas: o turun listesine git).
//
// Renkler fazdan gelir (phaseMeta.gradient): mavi=seçim, turuncu/kırmızı=oylama,
// gri=yakında. Üzerindeki her şey beyaz/yarı saydam beyazdır, bu yüzden tema
// (açık/koyu) değişse de okunurluk değişmez. Şampiyon kartı (results) ayrıdır.

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import CountdownTimer from "@components/tournament/CountdownTimer";
import StageTimeline from "@components/tournament/StageTimeline";
import { monthLabel, mediaLabel } from "@services/tournamentEngine";
import { i18nText } from "@utils/i18nText";

// Türkçe-güvenli BÜYÜK harf: JS'in toUpperCase'i 'i' → 'I' yapar, doğrusu 'İ'dir.
const upper = (s, lang) =>
  (lang === "tr" ? String(s).replace(/i/g, "İ") : String(s)).toUpperCase();

function GlassChip({ icon, text }) {
  return (
    <View style={styles.chip}>
      <AppIcon family="Ionicons" name={icon} size={12} color="#fff" />
      <Text style={styles.chipText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function TournamentHero({
  phaseMeta, theTheme, mediaType, monthIndex, year, lang = "tr",
  label, deadlineMs, periodId, nowMs, onStagePress,
}) {
  const deadlineText = useMemo(
    () => new Date(deadlineMs).toLocaleDateString(
      lang === "tr" ? "tr-TR" : "en-US",
      { day: "numeric", month: "long" },
    ),
    [deadlineMs, lang],
  );

  return (
    <LinearGradient
      colors={phaseMeta.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon family="Ionicons" name={phaseMeta.icon} size={150} color="rgba(255,255,255,0.11)" />
      </View>

      <View style={styles.chipsRow}>
        <GlassChip icon="calendar" text={`${monthLabel(monthIndex, lang)}${year ? ` ${year}` : ""}`} />
        <GlassChip icon={mediaType === "tv" ? "tv" : "film"} text={mediaLabel(mediaType, lang)} />
      </View>

      <Text style={styles.kicker}>
        {upper(i18nText("autoI18n.tournament_hero_kicker", "Ayın türü"), lang)}
      </Text>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {theTheme}
      </Text>

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <View style={styles.panelLabelWrap}>
            <AppIcon family="Ionicons" name="time-outline" size={14} color="rgba(255,255,255,0.88)" />
            <Text style={styles.panelLabel} numberOfLines={1}>{label}</Text>
          </View>
          <View style={styles.deadlinePill}>
            <Text style={styles.deadlineText} numberOfLines={1}>
              {i18nText("autoI18n.tournament_deadline", "Bitiş")}: {deadlineText}
            </Text>
          </View>
        </View>
        <CountdownTimer
          deadlineMs={deadlineMs}
          lang={lang}
          size="lg"
          fill
          boxColor="rgba(0,0,0,0.22)"
        />
      </View>

      <View style={styles.timelineWrap}>
        <StageTimeline periodId={periodId} nowMs={nowMs} lang={lang} onStagePress={onStagePress} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, padding: 16, marginTop: 6, overflow: "hidden" },
  glowOne: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    right: -70, top: -100, backgroundColor: "rgba(255,255,255,0.10)",
  },
  glowTwo: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    left: -50, bottom: -70, backgroundColor: "rgba(255,255,255,0.07)",
  },
  watermark: { position: "absolute", right: -12, top: 8, transform: [{ rotate: "-12deg" }] },

  chipsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  chipText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },

  kicker: {
    color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: "800",
    letterSpacing: 1.4, marginTop: 16,
  },
  title: {
    color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -0.5, marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.18)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },

  panel: {
    marginTop: 14, padding: 12, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  panelHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 8, marginBottom: 10,
  },
  panelLabelWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  panelLabel: { flexShrink: 1, color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: "800" },
  deadlinePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  deadlineText: { color: "rgba(255,255,255,0.92)", fontSize: 10.5, fontWeight: "800" },

  timelineWrap: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)",
  },
});

export default memo(TournamentHero);
