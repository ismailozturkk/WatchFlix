// components/wrapped/WrappedShareCard.js
//
// Watchify Wrapped — premium paylaşılabilir özet kartı (captureRef hedefi).
// TAM 9:16 oran. İçerik, kartın yüksekliğine göre orantılı ölçeklenir (s = h/REF_H)
// → poster/bölüm vb. her boyutta taşmadan sığar. Saf/statik (animasyon/buton yok)
// olduğundan her yakalamada tam kompozisyon elde edilir.
//
// Dışa açılan sözleşme (WrappedScreen bunlara bağımlı — KORUNMALI):
//   WRAPPED_CARD_THEMES, DEFAULT_WRAPPED_CARD_OPTIONS, getWrappedCardPalette
//   props: { recap, str, theme, language, getTmdbUrl, width, height, customization }

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatNumber, minutesBreakdown } from "../../utils/wrapped";

const APP_LOGO = require("../../assets/android-icon-foreground.png");
const REF_H = 640; // referans tuval yüksekliği (9:16 → genişlik 360)

export const WRAPPED_CARD_THEMES = [
  {
    id: "signature",
    labelKey: "themeSignature",
    accent: "#A78BFA",
    secondary: "#FF2D87",
    colors: ["#7C3AED", "#4B1D8F", "#160C24", "#060409"],
  },
  {
    id: "sunset",
    labelKey: "themeSunset",
    accent: "#FF8A3D",
    secondary: "#FFC857",
    colors: ["#FF6B35", "#B42318", "#351218", "#090507"],
  },
  {
    id: "ocean",
    labelKey: "themeOcean",
    accent: "#34D6EE",
    secondary: "#60A5FA",
    colors: ["#0891B2", "#164E63", "#082F49", "#030712"],
  },
  {
    id: "noir",
    labelKey: "themeNoir",
    accent: "#F4F4F5",
    secondary: "#A1A1AA",
    colors: ["#3F3F46", "#27272A", "#18181B", "#050505"],
  },
];

export const DEFAULT_WRAPPED_CARD_OPTIONS = {
  themeId: "signature",
  variant: "glow",
  showGenres: true,
  showPosters: true,
};

export function getWrappedCardPalette(themeId, fallbackAccent) {
  const preset =
    WRAPPED_CARD_THEMES.find((item) => item.id === themeId) ||
    WRAPPED_CARD_THEMES[0];
  if (preset.id !== "signature" || !fallbackAccent) return preset;
  return {
    ...preset,
    accent: fallbackAccent,
    colors: [fallbackAccent, "#4B1D8F", "#160C24", "#060409"],
  };
}

const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return color.length === 7 ? color + hex : color;
  }
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
};

// accent açık (ocean/noir) ise üstüne gelen yazı koyu olmalı.
const fgOn = (paletteId) => (["ocean", "noir"].includes(paletteId) ? "#0A0F14" : "#fff");

const WrappedShareCard = memo(function WrappedShareCard({
  recap,
  str,
  theme,
  language = "tr",
  getTmdbUrl,
  width,
  height,
  customization = DEFAULT_WRAPPED_CARD_OPTIONS,
}) {
  if (!recap) return null;

  const s = (height || REF_H) / REF_H; // orantı ölçeği
  const u = (v) => Math.round(v * s);

  const { hours } = minutesBreakdown(recap.totalMinutes);
  const palette = getWrappedCardPalette(
    customization.themeId,
    theme?.accent || "#7C3AED",
  );
  const accent = palette.accent;
  const secondary = palette.secondary || accent;
  const onAccent = fgOn(palette.id);
  const isClean = customization.variant === "clean";
  const showGenres = customization.showGenres !== false;
  const showPosterSection = customization.showPosters !== false;
  const posters = (recap.topShows || []).slice(0, 3);
  const genres = (recap.topGenres || []).slice(0, 3);

  const pad = u(22);
  const posterH = u(104);
  const posterW = Math.round(posterH * (2 / 3));

  return (
    <View style={[styles.root, { width, height, borderRadius: u(34) }]}>
      {/* ── Katmanlı arka plan ── */}
      <LinearGradient
        colors={
          isClean
            ? [palette.colors[0], palette.colors[2], palette.colors[3]]
            : palette.colors
        }
        locations={isClean ? [0, 0.55, 1] : [0, 0.36, 0.72, 1]}
        start={{ x: 0.1, y: -0.05 }}
        end={{ x: 0.95, y: 1.05 }}
        style={StyleSheet.absoluteFill}
      />
      {!isClean && (
        <>
          {/* yumuşak renk küreleri (mesh hissi) */}
          <View style={[styles.blob, { backgroundColor: withAlpha(accent, 0.5), top: -u(70), right: -u(60), width: u(220), height: u(220), borderRadius: u(110) }]} />
          <View style={[styles.blob, { backgroundColor: withAlpha(secondary, 0.26), top: u(150), left: -u(80), width: u(200), height: u(200), borderRadius: u(100) }]} />
          <View style={[styles.blob, { backgroundColor: withAlpha(accent, 0.16), bottom: -u(40), right: -u(30), width: u(180), height: u(180), borderRadius: u(90) }]} />
        </>
      )}
      {/* üst parlama */}
      <LinearGradient
        colors={[withAlpha("#FFFFFF", isClean ? 0.08 : 0.14), "transparent"]}
        style={[styles.topSheen, { height: u(220) }]}
      />
      {/* alt vignette (footer/poster okunabilirliği) */}
      <LinearGradient
        colors={["transparent", withAlpha("#000000", 0.55)]}
        style={[styles.bottomVignette, { height: u(240) }]}
      />
      {/* ince iç çerçeve */}
      <View
        style={[
          styles.innerBorder,
          {
            top: u(11),
            left: u(11),
            right: u(11),
            bottom: u(11),
            borderRadius: u(25),
            borderColor: isClean ? withAlpha(accent, 0.3) : "rgba(255,255,255,0.12)",
          },
        ]}
        pointerEvents="none"
      />

      <View style={[styles.inner, { padding: pad }]}>
        {/* ── Marka başlığı ── */}
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <LinearGradient
              colors={[withAlpha(accent, 0.95), withAlpha(secondary, 0.85)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoTile, { width: u(36), height: u(36), borderRadius: u(12) }]}
            >
              <Image source={APP_LOGO} style={{ width: u(30), height: u(30) }} contentFit="contain" />
            </LinearGradient>
            <View>
              <Text style={[styles.brand, { fontSize: u(13) }]} allowFontScaling={false}>
                WATCHIFY
              </Text>
              <Text style={[styles.brandSub, { fontSize: u(8), color: withAlpha(accent, 0.85) }]} allowFontScaling={false}>
                WRAPPED · {recap.year}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.yearPill,
              {
                paddingHorizontal: u(12),
                paddingVertical: u(7),
                borderRadius: u(999),
                borderColor: withAlpha(accent, 0.5),
                backgroundColor: withAlpha(accent, 0.14),
              },
            ]}
          >
            <View style={[styles.liveDot, { width: u(6), height: u(6), borderRadius: u(3), backgroundColor: accent }]} />
            <Text style={[styles.year, { fontSize: u(11) }]} allowFontScaling={false}>
              {recap.year}
            </Text>
          </View>
        </View>

        {/* ── İzleyici kimliği ── */}
        <View
          style={[
            styles.identityCard,
            {
              marginTop: u(16),
              padding: u(10),
              borderRadius: u(18),
              borderColor: withAlpha(accent, 0.28),
            },
          ]}
        >
          <LinearGradient
            colors={[withAlpha(accent, 0.32), withAlpha(secondary, 0.18)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.emojiCircle, { width: u(46), height: u(46), borderRadius: u(15) }]}
          >
            <Text style={{ fontSize: u(26) }} allowFontScaling={false}>
              {recap.personality?.emoji}
            </Text>
          </LinearGradient>
          <View style={styles.identityCopy}>
            <Text style={[styles.eyebrow, { fontSize: u(8), color: withAlpha(accent, 0.95) }]} allowFontScaling={false}>
              {str.personalityTitle?.toUpperCase()}
            </Text>
            <Text style={[styles.identityTitle, { fontSize: u(17), marginTop: u(2) }]} allowFontScaling={false} numberOfLines={1}>
              {recap.personality?.title}
            </Text>
          </View>
          <View style={[styles.identityArrow, { width: u(24), height: u(24), borderRadius: u(8), backgroundColor: withAlpha("#FFFFFF", 0.08) }]}>
            <MaterialCommunityIcons name="arrow-top-right" size={u(15)} color="rgba(255,255,255,0.6)" />
          </View>
        </View>

        {/* ── Hero: toplam süre ── */}
        <View style={{ marginTop: u(16) }}>
          <Text style={[styles.heroEyebrow, { fontSize: u(9) }]} allowFontScaling={false}>
            {str.summaryTitle?.toUpperCase()}
          </Text>
          <View style={styles.heroNumberRow}>
            <Text
              style={[styles.heroNumber, { fontSize: u(60) }]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatNumber(recap.totalMinutes, language)}
            </Text>
            <View
              style={[
                styles.heroUnit,
                {
                  paddingHorizontal: u(10),
                  paddingVertical: u(6),
                  borderRadius: u(999),
                  backgroundColor: withAlpha(accent, 0.2),
                  borderColor: withAlpha(accent, 0.45),
                },
              ]}
            >
              <MaterialCommunityIcons name="clock-outline" size={u(11)} color={accent} />
              <Text style={[styles.heroUnitText, { fontSize: u(9), color: accent }]} allowFontScaling={false}>
                {str.summaryMinutes}
              </Text>
            </View>
          </View>
          <View style={[styles.heroBar, { width: u(54), height: u(4), borderRadius: u(2), backgroundColor: accent, marginTop: u(8) }]} />
          <Text style={[styles.heroLabel, { fontSize: u(10), marginTop: u(7) }]} allowFontScaling={false}>
            ≈ {formatNumber(hours, language)} {str.hours} · {recap.year}
          </Text>
        </View>

        {/* ── Bento istatistikleri ── */}
        <View style={[styles.statGrid, { marginTop: u(16), gap: u(8) }]}>
          <StatCell value={formatNumber(recap.totalMovies, language)} label={str.summaryMovies} icon="movie-open-outline" accent={accent} u={u} />
          <StatCell value={formatNumber(recap.totalEpisodes, language)} label={str.summaryEpisodes} icon="play-box-multiple-outline" accent={accent} u={u} />
          <StatCell value={formatNumber(recap.totalShows, language)} label={str.summaryShows} icon="television-classic" accent={accent} u={u} />
        </View>

        {/* ── Türler ── */}
        {showGenres && genres.length > 0 && (
          <View style={{ marginTop: u(15) }}>
            <SectionHeader title={str.summaryTopGenres} count={genres.length} accent={accent} u={u} />
            <View style={[styles.genreRow, { gap: u(7), marginTop: u(8) }]}>
              {genres.map((g, i) => (
                <GenreChip key={`${g.genre}-${i}`} label={g.genre} top={i === 0} accent={accent} secondary={secondary} onAccent={onAccent} u={u} />
              ))}
            </View>
          </View>
        )}

        <View style={{ flex: 1, minHeight: u(8) }} />

        {/* ── En çok izlenen diziler ── */}
        {showPosterSection && posters.length > 0 && (
          <View>
            <SectionHeader title={str.topShowsTitle} count={posters.length} accent={accent} u={u} />
            <View style={[styles.posterRow, { gap: u(10), marginTop: u(8) }]}>
              {posters.map((p, i) => (
                <PosterCard
                  key={`${p.showId}-${i}`}
                  show={p}
                  rank={i + 1}
                  top={i === 0}
                  accent={accent}
                  onAccent={onAccent}
                  posterW={posterW}
                  posterH={posterH}
                  getTmdbUrl={getTmdbUrl}
                  u={u}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={[styles.cardFooter, { marginTop: u(12), paddingTop: u(10) }]}>
          <View style={styles.footerBrand}>
            <Image source={APP_LOGO} style={{ width: u(22), height: u(22) }} contentFit="contain" />
            <Text style={[styles.footerBrandText, { fontSize: u(10) }]} allowFontScaling={false}>
              Watchify
            </Text>
          </View>
          <View style={[styles.footerMetaPill, { borderColor: withAlpha(accent, 0.4), paddingHorizontal: u(9), paddingVertical: u(4), borderRadius: u(999) }]}>
            <Text style={[styles.footerMeta, { fontSize: u(8), color: withAlpha("#FFFFFF", 0.78) }]} allowFontScaling={false}>
              {recap.year} · WRAPPED
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const StatCell = ({ value, label, icon, accent, u }) => (
  <View style={[styles.statCell, { minHeight: u(72), padding: u(10), borderRadius: u(16) }]}>
    <View style={[styles.statIcon, { width: u(26), height: u(26), borderRadius: u(9), backgroundColor: withAlpha(accent, 0.18) }]}>
      <MaterialCommunityIcons name={icon} size={u(15)} color={accent} />
    </View>
    <Text style={[styles.statValue, { fontSize: u(21), marginTop: u(7) }]} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={[styles.statLabel, { fontSize: u(8.5), marginTop: u(1) }]} allowFontScaling={false} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const GenreChip = ({ label, top, accent, secondary, onAccent, u }) =>
  top ? (
    <LinearGradient
      colors={[accent, secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.genreChip, styles.genreChipTop, { paddingHorizontal: u(11), paddingVertical: u(6.5) }]}
    >
      <MaterialCommunityIcons name="star" size={u(9)} color={onAccent} style={{ marginRight: u(3) }} />
      <Text style={[styles.genreText, { fontSize: u(10), color: onAccent }]} allowFontScaling={false} numberOfLines={1}>
        {label}
      </Text>
    </LinearGradient>
  ) : (
    <View style={[styles.genreChip, { paddingHorizontal: u(11), paddingVertical: u(6.5) }]}>
      <Text style={[styles.genreText, { fontSize: u(10) }]} allowFontScaling={false} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

const PosterCard = ({ show, rank, top, accent, onAccent, posterW, posterH, getTmdbUrl, u }) => (
  <View style={{ alignItems: "center", width: posterW }}>
    <View
      style={[
        styles.posterFrame,
        { width: posterW, height: posterH, borderRadius: u(13) },
        top && { borderWidth: u(2), borderColor: accent, shadowColor: accent, shadowOpacity: 0.55, shadowRadius: u(10), shadowOffset: { width: 0, height: 0 }, elevation: 8 },
      ]}
    >
      {show.showImage ? (
        <Image
          source={{ uri: getTmdbUrl ? getTmdbUrl(show.showImage, "poster", 300) : null }}
          style={styles.poster}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={[styles.poster, styles.posterPh]} />
      )}
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.posterFade} />
      <View
        style={[
          styles.rankChip,
          { top: u(6), left: u(6), minWidth: u(21), height: u(21), borderRadius: u(8), backgroundColor: top ? accent : "rgba(0,0,0,0.6)" },
        ]}
      >
        <Text style={[styles.rankChipText, { fontSize: u(10), color: top ? onAccent : "#fff" }]} allowFontScaling={false}>
          #{rank}
        </Text>
      </View>
    </View>
    <Text style={[styles.posterName, { fontSize: u(9), marginTop: u(6), width: posterW }]} allowFontScaling={false} numberOfLines={1}>
      {show.showName}
    </Text>
  </View>
);

const SectionHeader = ({ title, count, accent, u }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionLeft}>
      <View style={[styles.sectionTick, { width: u(3), height: u(11), borderRadius: u(2), backgroundColor: accent }]} />
      <Text style={[styles.sectionLabel, { fontSize: u(9) }]} allowFontScaling={false}>
        {title}
      </Text>
    </View>
    <View style={[styles.sectionCount, { paddingHorizontal: u(7), height: u(18), borderRadius: u(9), borderColor: withAlpha(accent, 0.35) }]}>
      <Text style={[styles.sectionCountText, { fontSize: u(8), color: withAlpha(accent, 0.95) }]} allowFontScaling={false}>
        TOP {count}
      </Text>
    </View>
  </View>
);

export default WrappedShareCard;

const styles = StyleSheet.create({
  root: { overflow: "hidden", backgroundColor: "#0A0710" },
  inner: { flex: 1 },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomVignette: { position: "absolute", bottom: 0, left: 0, right: 0 },
  blob: { position: "absolute" },
  innerBorder: { position: "absolute", borderWidth: 1 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoTile: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontWeight: "900", letterSpacing: 1.4 },
  brandSub: { fontWeight: "800", letterSpacing: 0.8, marginTop: 1 },
  yearPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1 },
  liveDot: {},
  year: { color: "#fff", fontWeight: "900", letterSpacing: 0.2 },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  emojiCircle: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: { flex: 1, marginLeft: 10 },
  eyebrow: { fontWeight: "900", letterSpacing: 0.8 },
  identityTitle: { color: "#fff", fontWeight: "900", letterSpacing: -0.3 },
  identityArrow: { alignItems: "center", justifyContent: "center" },

  heroEyebrow: { color: "rgba(255,255,255,0.5)", fontWeight: "900", letterSpacing: 1.2 },
  heroNumberRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 2 },
  heroNumber: { color: "#fff", fontWeight: "900", letterSpacing: -3, includeFontPadding: false },
  heroUnit: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 11, borderWidth: 1 },
  heroUnitText: { fontWeight: "900" },
  heroBar: {},
  heroLabel: { color: "rgba(255,255,255,0.58)", fontWeight: "700", letterSpacing: 0.35 },

  statGrid: { flexDirection: "row", alignItems: "stretch" },
  statCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  statIcon: { alignItems: "center", justifyContent: "center" },
  statValue: { color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { color: "rgba(255,255,255,0.56)", fontWeight: "700" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTick: {},
  sectionLabel: { color: "rgba(255,255,255,0.72)", fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  sectionCount: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: { fontWeight: "900", letterSpacing: 0.4 },

  genreRow: { flexDirection: "row", flexWrap: "wrap" },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  genreChipTop: { borderColor: "transparent" },
  genreText: { color: "#fff", fontWeight: "800" },

  posterRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
  posterFrame: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)" },
  poster: { width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.1)" },
  posterPh: {},
  posterFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  rankChip: { position: "absolute", paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  rankChipText: { color: "#fff", fontWeight: "900" },
  posterName: { color: "rgba(255,255,255,0.78)", fontWeight: "700", textAlign: "center" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerBrandText: { color: "#fff", fontWeight: "900", letterSpacing: 0.3 },
  footerMetaPill: { borderWidth: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  footerMeta: { fontWeight: "800", letterSpacing: 0.7 },
});
