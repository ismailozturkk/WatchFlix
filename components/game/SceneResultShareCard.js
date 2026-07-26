// components/game/SceneResultShareCard.js
//
// Sahne Tahmin sonuc paylasim karti (Part 13.4). captureRef hedefi.
// Spoiler olusturacak sahne gorselleri YOK; yalniz skor, mod, zorluk, dogruluk,
// seri ve Seelogd marka alani gosterilir. Saf/statik bilesendir (animasyon/buton
// icermez) — her yakalamada tam kompozisyon elde edilir.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";

const APP_LOGO = require("../../assets/android-icon-foreground.png");
const REF_H = 640; // referans tuval yuksekligi (9:16 -> genislik 360)

const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return color.length === 7 ? color + hex : color;
  }
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
};

const SceneResultShareCard = memo(function SceneResultShareCard({
  width,
  height,
  accent = "#7C3AED",
  bold,
  score = 0,
  scoreLabel = "SKOR",
  modeLabel = "",
  difficultyLabel = "",
  accuracy = 0,
  bestStreak = 0,
  correct = 0,
  total = 0,
  brand = "Sahne Tahmin",
  recordLabel = "",
  isNewRecord = false,
  labels = {},
}) {
  const s = (height || REF_H) / REF_H;
  const u = (v) => Math.round(v * s);
  const deep = bold || accent;

  return (
    <View style={[styles.root, { width, height, borderRadius: u(28) }]}>
      <LinearGradient
        colors={[withAlpha(accent, 0.98), deep, "#160C24", "#060409"]}
        locations={[0, 0.4, 0.76, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={[withAlpha("#FFFFFF", 0.16), "transparent"]} style={[styles.topSheen, { height: u(200) }]} />
      <View style={[styles.orb, { backgroundColor: withAlpha(accent, 0.32), top: -u(50), right: -u(40), width: u(170), height: u(170), borderRadius: u(85) }]} />
      <View style={[styles.orb, { backgroundColor: withAlpha("#FF2D87", 0.16), bottom: u(120), left: -u(50), width: u(150), height: u(150), borderRadius: u(75) }]} />
      <View style={[styles.innerBorder, { top: u(10), left: u(10), right: u(10), bottom: u(10), borderRadius: u(20) }]} pointerEvents="none" />

      <View style={[styles.inner, { padding: u(24) }]}>
        {/* Marka */}
        <View style={styles.header}>
          <View style={[styles.brandPill, { paddingHorizontal: u(10), paddingVertical: u(6), gap: u(6) }]}>
            <AppIcon family="Ionicons" name="film" size={u(13)} color="#fff" />
            <Text style={[styles.brand, { fontSize: u(12) }]} allowFontScaling={false} numberOfLines={1}>{brand}</Text>
          </View>
          {(modeLabel || difficultyLabel) ? (
            <Text style={[styles.modeText, { fontSize: u(11) }]} allowFontScaling={false} numberOfLines={1}>
              {[modeLabel, difficultyLabel].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>

        {/* Kupa rozeti */}
        <View style={[styles.trophyWrap, { height: u(112), marginTop: u(20) }]}>
          <View style={[styles.ring, { width: u(112), height: u(112), borderRadius: u(56), borderColor: withAlpha("#FFFFFF", 0.12) }]} />
          <View style={[styles.ring, { width: u(88), height: u(88), borderRadius: u(44), borderColor: withAlpha("#FFFFFF", 0.22) }]} />
          <View style={[styles.trophyCircle, { width: u(76), height: u(76), borderRadius: u(38) }]}>
            <AppIcon family="Ionicons" name="trophy" size={u(38)} color="#E8B931" />
          </View>
        </View>

        {/* Hero skor */}
        <View style={{ alignItems: "center", marginTop: u(16) }}>
          <Text style={[styles.scoreLabel, { fontSize: u(12) }]} allowFontScaling={false}>{scoreLabel.toUpperCase()}</Text>
          <Text style={[styles.heroNumber, { fontSize: u(64) }]} allowFontScaling={false}>{score}</Text>
          {isNewRecord ? (
            <View style={[styles.recordPill, { paddingHorizontal: u(12), paddingVertical: u(6), marginTop: u(6), gap: u(5) }]}>
              <AppIcon family="Ionicons" name="ribbon" size={u(13)} color="#160C24" />
              <Text style={[styles.recordText, { fontSize: u(11) }]} allowFontScaling={false}>{recordLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, minHeight: u(8) }} />

        {/* Istatistik seridi */}
        <View style={[styles.statGrid, { paddingVertical: u(15), borderRadius: u(18) }]}>
          <StatCell value={`${accuracy}%`} label={labels.accuracy} u={u} />
          <View style={[styles.statDivider, { height: u(34) }]} />
          <StatCell value={`${correct}/${total}`} label={labels.correct} u={u} />
          <View style={[styles.statDivider, { height: u(34) }]} />
          <StatCell value={bestStreak} label={labels.streak} u={u} />
        </View>
      </View>

      {/* Filigran */}
      <View style={[styles.watermark, { bottom: u(14), right: u(16), paddingRight: u(11), borderRadius: u(999) }]}>
        <Image source={APP_LOGO} style={{ width: u(30), height: u(30) }} contentFit="contain" />
        <Text style={[styles.wmText, { fontSize: u(12) }]} allowFontScaling={false}>Seelogd</Text>
      </View>
    </View>
  );
});

const StatCell = ({ value, label, u }) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, { fontSize: u(22) }]} allowFontScaling={false} numberOfLines={1}>{value}</Text>
    <Text style={[styles.statCellLabel, { fontSize: u(11), marginTop: u(3) }]} allowFontScaling={false} numberOfLines={1}>{label}</Text>
  </View>
);

export default SceneResultShareCard;

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  inner: { flex: 1 },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0 },
  orb: { position: "absolute" },
  innerBorder: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, backgroundColor: "rgba(0,0,0,0.28)", maxWidth: "62%" },
  brand: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  modeText: { color: "rgba(255,255,255,0.78)", fontWeight: "800", letterSpacing: 0.3 },
  trophyWrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1 },
  trophyCircle: { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  scoreLabel: { color: "rgba(255,255,255,0.72)", fontWeight: "900", letterSpacing: 2 },
  heroNumber: { color: "#fff", fontWeight: "900", letterSpacing: -2.5, includeFontPadding: false, marginTop: 2 },
  recordPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, backgroundColor: "#E8B931" },
  recordText: { color: "#160C24", fontWeight: "900", letterSpacing: 0.3 },
  statGrid: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.07)" },
  statCell: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  statCellLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  watermark: { position: "absolute", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingLeft: 2 },
  wmText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
