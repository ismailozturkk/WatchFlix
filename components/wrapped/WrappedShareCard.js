// components/wrapped/WrappedShareCard.js
//
// Watchify Wrapped — premium paylaşılabilir özet kartı (captureRef hedefi).
// TAM 9:16 oran. İçerik, kartın yüksekliğine göre orantılı ölçeklenir (s = h/640)
// → poster/bölüm vb. her boyutta taşmadan sığar. Saf/statik (animasyon/buton yok)
// olduğundan her yakalamada tam kompozisyon elde edilir.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatNumber, minutesBreakdown } from "../../utils/wrapped";

const APP_LOGO = require("../../assets/android-icon-foreground.png");
const REF_H = 640; // referans tuval yüksekliği (9:16 → genişlik 360)

const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return color.length === 7 ? color + hex : color;
  }
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
};

const WrappedShareCard = memo(function WrappedShareCard({
  recap,
  str,
  theme,
  language = "tr",
  getTmdbUrl,
  width,
  height,
}) {
  if (!recap) return null;

  const s = (height || REF_H) / REF_H; // orantı ölçeği
  const u = (v) => Math.round(v * s);

  const { hours } = minutesBreakdown(recap.totalMinutes);
  const accent = theme?.accent || "#7C3AED";
  const showPosters = (recap.topShows || []).slice(0, 3);

  const pad = u(22);
  const posterH = u(108);
  const posterW = Math.round(posterH * (2 / 3));

  return (
    <View style={[styles.root, { width, height, borderRadius: u(28) }]}>
      {/* Zengin marka gradyanı */}
      <LinearGradient
        colors={[withAlpha(accent, 0.98), "#4B1D8F", "#160C24", "#060409"]}
        locations={[0, 0.38, 0.74, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={[withAlpha("#FFFFFF", 0.16), "transparent"]} style={[styles.topSheen, { height: u(200) }]} />
      <View style={[styles.orb, { backgroundColor: withAlpha(accent, 0.32), top: -u(50), right: -u(40), width: u(170), height: u(170), borderRadius: u(85) }]} />
      <View style={[styles.orb, { backgroundColor: withAlpha("#FF2D87", 0.16), bottom: u(120), left: -u(50), width: u(150), height: u(150), borderRadius: u(75) }]} />
      <View style={[styles.innerBorder, { top: u(10), left: u(10), right: u(10), bottom: u(10), borderRadius: u(20) }]} pointerEvents="none" />

      <View style={[styles.inner, { padding: pad }]}>
        {/* Üst: marka + yıl */}
        <View style={styles.header}>
          <View style={[styles.brandPill, { paddingHorizontal: u(10), paddingVertical: u(6), gap: u(6) }]}>
            <MaterialCommunityIcons name="gift" size={u(13)} color="#fff" />
            <Text style={[styles.brand, { fontSize: u(12) }]} allowFontScaling={false}>
              {str.brand}
            </Text>
          </View>
          <Text style={[styles.year, { fontSize: u(26) }]} allowFontScaling={false}>
            {recap.year}
          </Text>
        </View>

        {/* Kişilik — merkezde parlayan rozet */}
        <View style={[styles.personalityWrap, { height: u(108), marginTop: u(16) }]}>
          <View style={[styles.ring, { width: u(108), height: u(108), borderRadius: u(54), borderColor: withAlpha("#FFFFFF", 0.12) }]} />
          <View style={[styles.ring, { width: u(86), height: u(86), borderRadius: u(43), borderColor: withAlpha("#FFFFFF", 0.22) }]} />
          <View style={[styles.emojiCircle, { width: u(74), height: u(74), borderRadius: u(37) }]}>
            <Text style={{ fontSize: u(38) }} allowFontScaling={false}>
              {recap.personality?.emoji}
            </Text>
          </View>
        </View>
        <Text style={[styles.personalityTitle, { fontSize: u(19), marginTop: u(10) }]} allowFontScaling={false} numberOfLines={1}>
          {recap.personality?.title}
        </Text>

        {/* Hero: toplam süre */}
        <View style={{ alignItems: "center", marginTop: u(14) }}>
          <Text style={[styles.heroNumber, { fontSize: u(52) }]} allowFontScaling={false}>
            {formatNumber(recap.totalMinutes, language)}
          </Text>
          <Text style={[styles.heroLabel, { fontSize: u(12) }]} allowFontScaling={false}>
            {str.summaryMinutes.toUpperCase()} · ~{formatNumber(hours, language)} {str.hours}
          </Text>
        </View>

        {/* İstatistik şeridi */}
        <View style={[styles.statGrid, { marginTop: u(18), paddingVertical: u(13), borderRadius: u(18) }]}>
          <StatCell value={formatNumber(recap.totalMovies, language)} label={str.summaryMovies} u={u} />
          <View style={[styles.statDivider, { height: u(32) }]} />
          <StatCell value={formatNumber(recap.totalEpisodes, language)} label={str.summaryEpisodes} u={u} />
          <View style={[styles.statDivider, { height: u(32) }]} />
          <StatCell value={formatNumber(recap.totalShows, language)} label={str.summaryShows} u={u} />
        </View>

        {/* Türler */}
        {recap.topGenres?.length > 0 && (
          <View style={{ marginTop: u(16) }}>
            <Text style={[styles.sectionLabel, { fontSize: u(11), marginBottom: u(9) }]} allowFontScaling={false}>
              {str.summaryTopGenres}
            </Text>
            <View style={[styles.genreRow, { gap: u(8) }]}>
              {recap.topGenres.slice(0, 3).map((g, i) => (
                <View
                  key={`${g.genre}-${i}`}
                  style={[
                    styles.genreChip,
                    { paddingHorizontal: u(13), paddingVertical: u(8) },
                    i === 0 && styles.genreChipTop,
                  ]}
                >
                  <Text style={[styles.genreText, { fontSize: u(13) }, i === 0 && { color: "#000" }]} allowFontScaling={false} numberOfLines={1}>
                    {g.genre}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ flex: 1, minHeight: u(8) }} />

        {/* En çok izlenen diziler — posterler (sığacak şekilde sabit yükseklik) */}
        {showPosters.length > 0 && (
          <View>
            <Text style={[styles.sectionLabel, { fontSize: u(11), marginBottom: u(9) }]} allowFontScaling={false}>
              {str.topShowsTitle}
            </Text>
            <View style={[styles.posterRow, { gap: u(12) }]}>
              {showPosters.map((s2, i) => (
                <View key={`${s2.showId}-${i}`} style={{ alignItems: "center", width: posterW }}>
                  <View style={[styles.posterFrame, { width: posterW, height: posterH, borderRadius: u(10) }, i === 0 && styles.posterFrameTop]}>
                    {s2.showImage ? (
                      <Image
                        source={{ uri: getTmdbUrl ? getTmdbUrl(s2.showImage, "poster", 300) : null }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <View style={[styles.poster, styles.posterPh]} />
                    )}
                    <View style={[styles.rankChip, { top: u(6), left: u(6), minWidth: u(20), height: u(20), borderRadius: u(10) }]}>
                      <Text style={[styles.rankChipText, { fontSize: u(11) }]} allowFontScaling={false}>{i + 1}</Text>
                    </View>
                  </View>
                  {i === 0 && (
                    <Text style={[styles.posterName, { fontSize: u(11), marginTop: u(6), width: posterW }]} allowFontScaling={false} numberOfLines={1}>
                      {s2.showName}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Filigran */}
      <View style={[styles.watermark, { bottom: u(14), right: u(16), paddingRight: u(11), borderRadius: u(999) }]}>
        <Image source={APP_LOGO} style={{ width: u(30), height: u(30) }} contentFit="contain" />
        <Text style={[styles.wmText, { fontSize: u(12) }]} allowFontScaling={false}>
          Watchify
        </Text>
      </View>
    </View>
  );
});

const StatCell = ({ value, label, u }) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, { fontSize: u(22) }]} allowFontScaling={false} numberOfLines={1}>
      {value}
    </Text>
    <Text style={[styles.statLabel, { fontSize: u(11), marginTop: u(3) }]} allowFontScaling={false} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

export default WrappedShareCard;

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  inner: { flex: 1 },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0 },
  orb: { position: "absolute" },
  innerBorder: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, backgroundColor: "rgba(0,0,0,0.28)" },
  brand: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  year: { color: "#fff", fontWeight: "900", letterSpacing: -1 },

  personalityWrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1 },
  emojiCircle: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  personalityTitle: { color: "#fff", fontWeight: "900", letterSpacing: -0.3, textAlign: "center" },

  heroNumber: { color: "#fff", fontWeight: "900", letterSpacing: -2.5, includeFontPadding: false },
  heroLabel: { color: "rgba(255,255,255,0.82)", fontWeight: "800", letterSpacing: 0.4 },

  statGrid: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },

  sectionLabel: { color: "rgba(255,255,255,0.6)", fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  genreRow: { flexDirection: "row", flexWrap: "wrap" },
  genreChip: { borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(0,0,0,0.22)" },
  genreChipTop: { backgroundColor: "#fff", borderColor: "#fff" },
  genreText: { color: "#fff", fontWeight: "800" },

  posterRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
  posterFrame: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  posterFrameTop: { borderWidth: 2, borderColor: "#fff" },
  poster: { width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.1)" },
  posterPh: {},
  rankChip: {
    position: "absolute",
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankChipText: { color: "#fff", fontWeight: "900" },
  posterName: { color: "rgba(255,255,255,0.88)", fontWeight: "800", textAlign: "center" },

  watermark: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingLeft: 2,
  },
  wmText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
