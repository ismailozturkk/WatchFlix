// components/wrapped/WrappedSlides.js
//
// Watchify Wrapped — premium tam ekran hikâye slaytları.
// Tasarım sistemi: zengin 3-stop gradient + yüzen ışıltı orb'ları + dev soluk
// motif + kademeli (staggered) reveal + count-up sayaçlar. Ekran (WrappedScreen)
// aktif slaytı index'e göre render eder; her slayt mount olduğunda animasyonlar
// baştan oynar. Segmentli üst progress ayrı bileşendir (WrappedProgress).

import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  formatNumber,
  minutesBreakdown,
  monthName,
  formatLongDate,
} from "../../utils/wrapped";
import WrappedYearPath from "./WrappedYearPath";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PATH_W = SCREEN_W - 56;
const YEAR_PATH_W = SCREEN_W - 24;
const LIST_MAX_H = SCREEN_H * 0.6; // kaydırmalı slaytların (tür/dizi) iç yüksekliği

// Slayt başına ana vurgu renkleri (canlı). Screen index % length ile seçer.
export const SLIDE_COLORS = [
  "#1DB954", "#E50914", "#7C3AED", "#0A84FF",
  "#FF8A3D", "#FF2D87", "#00C2A8", "#F5C518", "#5AACF0",
];

// Her vurgu için derin gradient eşi (zengin geçiş).
const COMPANION = {
  "#1DB954": "#0A5F2E", "#E50914": "#6E0510", "#7C3AED": "#33167A",
  "#0A84FF": "#063C76", "#FF8A3D": "#9E4717", "#FF2D87": "#8C1149",
  "#00C2A8": "#005C51", "#F5C518": "#7E6500", "#5AACF0": "#28628F",
};

const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return color.length === 7 ? color + hex : color;
  }
  return color;
};

// ─── Animasyon primitifleri ──────────────────────────────────────────────────

/** Mount'ta 0 → value sayan, locale biçimli sayaç (premium count-up). */
const AnimatedCount = memo(function AnimatedCount({
  value = 0,
  duration = 1100,
  format = (n) => String(n),
  style,
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <Text style={style} allowFontScaling={false}>
      {format(display)}
    </Text>
  );
});

/** Kademeli giriş: fade + yukarı kayma (delay ile sıralanır). */
const Reveal = memo(function Reveal({ delay = 0, dy = 20, children, style }) {
  const o = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(dy)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: 460, delay, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 58 }),
    ]).start();
  }, [o, ty, delay]);
  return (
    <Animated.View style={[style, { opacity: o, transform: [{ translateY: ty }] }]}>
      {children}
    </Animated.View>
  );
});

/** Yumuşak yüzen ışıltı orb'u (sahte radyal: iç içe 2 katman + döngü). */
const FloatingOrb = memo(function FloatingOrb({ color, size, style, delay = 0, range = 16 }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 4200, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, range] });
  return (
    <Animated.View pointerEvents="none" style={[styles.orbWrap, style, { transform: [{ translateY }] }]}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(color, 0.22) }} />
      <View
        style={{
          position: "absolute",
          width: size * 0.6,
          height: size * 0.6,
          top: size * 0.2,
          left: size * 0.2,
          borderRadius: size,
          backgroundColor: withAlpha(color, 0.28),
        }}
      />
    </Animated.View>
  );
});

// ─── Segmentli üst progress ──────────────────────────────────────────────────

export const WrappedProgress = memo(function WrappedProgress({
  count,
  activeIndex,
  progressAnim,
  topInset = 0,
}) {
  return (
    <View style={[progressStyles.row, { marginTop: topInset + 10 }]}>
      {Array.from({ length: count }).map((_, i) => {
        const filled = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <View key={i} style={progressStyles.track}>
            {isActive ? (
              <Animated.View
                style={[
                  progressStyles.fill,
                  progressStyles.activeGlow,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            ) : (
              <View style={[progressStyles.fill, { width: filled ? "100%" : "0%" }]} />
            )}
          </View>
        );
      })}
    </View>
  );
});

const progressStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 5, paddingHorizontal: 14 },
  track: { flex: 1, height: 3.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: "#fff" },
  activeGlow: {
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
});

// ─── Slayt çerçevesi (gradient + orb'lar + dev motif + giriş) ─────────────────

export const WrappedSlideFrame = memo(function WrappedSlideFrame({
  accent = SLIDE_COLORS[0],
  children,
  topInset = 0,
  motifIcon,
}) {
  const accent2 = COMPANION[accent] || "#101018";
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.04)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 9, tension: 50 }),
    ]).start();
  }, [opacity, scale]);

  // pointerEvents: arka plan dokunmayı yakalamaz; yalnızca etkileşimli alt
  // bileşenler (yıl çipleri vb.) yakalar → boş alan/metin dokunuşları alttaki
  // navigasyon bölgelerine geçer (WrappedScreen tap zones).
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(accent, 0.95), accent2, "#07070B"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Üst parıltı */}
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha("#FFFFFF", 0.14), "transparent"]}
        style={frameStyles.topSheen}
      />
      {/* Yüzen orb'lar (derinlik) */}
      <FloatingOrb color={accent} size={260} style={{ top: -60, right: -70 }} range={18} />
      <FloatingOrb color={accent2} size={200} style={{ bottom: 40, left: -80 }} delay={900} range={22} />

      {/* Dev soluk motif (monokrom ikon filigranı) */}
      {motifIcon ? (
        <Animated.View pointerEvents="none" style={[frameStyles.motif, { transform: [{ scale }, { rotate: "-10deg" }] }]}>
          <MaterialCommunityIcons name={motifIcon} size={300} color="rgba(255,255,255,0.055)" />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[frameStyles.content, { paddingTop: topInset + 64, transform: [{ scale }] }]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
});

const frameStyles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 28, paddingBottom: 128, justifyContent: "center" },
  topSheen: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  motif: {
    position: "absolute",
    right: -56,
    top: "14%",
  },
});

// ─── Ortak küçük parçalar ────────────────────────────────────────────────────

const Kicker = ({ children, delay = 0 }) => (
  <Reveal delay={delay}>
    <View style={shared.kickerRow}>
      <View style={shared.kickerDot} />
      <Text style={shared.kicker} allowFontScaling={false}>
        {children}
      </Text>
    </View>
  </Reveal>
);

const shared = StyleSheet.create({
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 18 },
  kickerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
  kicker: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  bigNumber: { color: "#fff", fontSize: 82, fontWeight: "900", letterSpacing: -3.5, includeFontPadding: false },
  bigLabel: { color: "#fff", fontSize: 23, fontWeight: "800", marginTop: 2 },
  sub: { color: "rgba(255,255,255,0.82)", fontSize: 16, fontWeight: "600", marginTop: 16, lineHeight: 23 },
});

// ─── 1) Intro ────────────────────────────────────────────────────────────────

export const IntroSlide = memo(function IntroSlide({
  recap, str, topInset, accent, years = [], onSelectYear,
}) {
  const multi = years.length > 1;
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="star-four-points">
      <Reveal delay={60}>
        <View style={introStyles.brandRow}>
          <MaterialCommunityIcons name="gift" size={18} color="#fff" />
          <Text style={introStyles.brand} allowFontScaling={false}>
            {str.brand}
          </Text>
        </View>
      </Reveal>

      {multi ? (
        <>
          <Reveal delay={160}>
            <Text style={introStyles.pickTitle} allowFontScaling={false}>
              {str.pickYear}
            </Text>
            <Text style={introStyles.pickSubtitle} allowFontScaling={false}>
              {str.pickYearHint}
            </Text>
          </Reveal>
          <Reveal delay={280} style={{ alignItems: "center", marginTop: 14 }}>
            <WrappedYearPath
              years={years}
              selectedYear={recap.year}
              onSelect={onSelectYear}
              width={YEAR_PATH_W}
              accent={accent}
              selectedText={str.yearSelected}
            />
          </Reveal>
        </>
      ) : (
        <>
          <Reveal delay={160}>
            <Text style={introStyles.year} allowFontScaling={false}>
              {recap.year}
            </Text>
          </Reveal>
          <Reveal delay={300}>
            <Text style={shared.sub}>{str.introHello}</Text>
          </Reveal>
          <Reveal delay={520}>
            <View style={introStyles.tapHint}>
              <Ionicons name="chevron-forward-circle" size={18} color="rgba(255,255,255,0.75)" />
              <Text style={introStyles.tapText} allowFontScaling={false}>
                {str.introTap}
              </Text>
            </View>
          </Reveal>
        </>
      )}
    </WrappedSlideFrame>
  );
});

const introStyles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: "rgba(255,255,255,0.92)", fontSize: 19, fontWeight: "800", letterSpacing: 0.6 },
  pickTitle: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -0.8, marginTop: 14 },
  pickSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600", marginTop: 4 },
  year: { color: "#fff", fontSize: 104, fontWeight: "900", letterSpacing: -5, includeFontPadding: false, marginTop: 6 },
  yearRow: { gap: 9, paddingRight: 14, alignItems: "center" },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  yearChipText: { fontSize: 15, fontWeight: "800" },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 30 },
  tapText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700" },
});

// ─── 2) Toplam süre ──────────────────────────────────────────────────────────

export const TotalTimeSlide = memo(function TotalTimeSlide({ recap, str, language, topInset, accent }) {
  const { hours, days } = minutesBreakdown(recap.totalMinutes);
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="clock-time-four">
      <Kicker>{str.totalTitle}</Kicker>
      <Reveal delay={180}>
        <AnimatedCount
          value={recap.totalMinutes}
          duration={1400}
          format={(n) => formatNumber(n, language)}
          style={shared.bigNumber}
        />
      </Reveal>
      <Reveal delay={300}>
        <Text style={shared.bigLabel}>{str.minutes}</Text>
      </Reveal>
      <Reveal delay={440}>
        <View style={pillStyles.row}>
          <View style={pillStyles.pill}>
            <Text style={pillStyles.pillNum} allowFontScaling={false}>{formatNumber(hours, language)}</Text>
            <Text style={pillStyles.pillLabel} allowFontScaling={false}>{str.hours}</Text>
          </View>
          {days > 0 && (
            <View style={pillStyles.pill}>
              <Text style={pillStyles.pillNum} allowFontScaling={false}>{formatNumber(days, language)}</Text>
              <Text style={pillStyles.pillLabel} allowFontScaling={false}>{str.days}</Text>
            </View>
          )}
        </View>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const pillStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, marginTop: 22 },
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  pillNum: { color: "#fff", fontSize: 22, fontWeight: "900" },
  pillLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
});

// ─── 3) Filmler ──────────────────────────────────────────────────────────────

export const MoviesSlide = memo(function MoviesSlide({ recap, str, language, getTmdbUrl, topInset, accent }) {
  const { hours } = minutesBreakdown(recap.movieMinutes);
  const posters = (recap.moviePosters || []).slice(0, 6);
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="movie-open">
      <Kicker>{str.moviesTitle}</Kicker>
      <Reveal delay={150}>
        <View style={rowStyles.headlineCompact}>
          <MaterialCommunityIcons name="movie-open" size={28} color="#fff" />
          <AnimatedCount
            value={recap.totalMovies}
            format={(n) => formatNumber(n, language)}
            style={rowStyles.countCompact}
          />
          <Text style={rowStyles.countLabel} allowFontScaling={false}>
            {str.moviesWatched}
          </Text>
        </View>
      </Reveal>
      <Reveal delay={260}>
        <Text style={rowStyles.subCompact} allowFontScaling={false}>
          ~{formatNumber(hours, language)} {str.hours} {str.moviesTime}
        </Text>
      </Reveal>

      {posters.length > 0 && (
        <Reveal delay={400} style={{ marginTop: 22 }}>
          <View style={gridStyles.grid}>
            {posters.map((m, i) => (
              <View key={`${m.id}-${i}`} style={gridStyles.cell}>
                {m.imagePath ? (
                  <Image
                    source={{ uri: getTmdbUrl ? getTmdbUrl(m.imagePath, "poster", 200) : null }}
                    style={gridStyles.poster}
                    contentFit="cover"
                    transition={140}
                  />
                ) : (
                  <View style={[gridStyles.poster, gridStyles.posterPh]} />
                )}
              </View>
            ))}
          </View>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const GRID_GAP = 10;
const GRID_POSTER_W = (PATH_W - GRID_GAP * 2) / 3;
const gridStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  cell: { width: GRID_POSTER_W },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
  },
  posterPh: { borderColor: "rgba(255,255,255,0.2)" },
});

// ─── 4) Diziler ──────────────────────────────────────────────────────────────

export const TvSlide = memo(function TvSlide({ recap, str, language, topInset, accent }) {
  const { hours } = minutesBreakdown(recap.tvMinutes);
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="television-classic">
      <Kicker>{str.tvTitle}</Kicker>
      <Reveal delay={170}>
        <View style={rowStyles.headline}>
          <MaterialCommunityIcons name="television-classic" size={32} color="#fff" />
          <AnimatedCount
            value={recap.totalEpisodes}
            format={(n) => formatNumber(n, language)}
            style={shared.bigNumber}
          />
        </View>
      </Reveal>
      <Reveal delay={290}>
        <Text style={shared.bigLabel}>{str.tvEpisodes}</Text>
      </Reveal>
      <Reveal delay={420}>
        <View style={pillStyles.row}>
          <View style={pillStyles.pill}>
            <Text style={pillStyles.pillNum} allowFontScaling={false}>{formatNumber(recap.totalShows, language)}</Text>
            <Text style={pillStyles.pillLabel} allowFontScaling={false}>{str.tvShows}</Text>
          </View>
          <View style={pillStyles.pill}>
            <Text style={pillStyles.pillNum} allowFontScaling={false}>~{formatNumber(hours, language)}</Text>
            <Text style={pillStyles.pillLabel} allowFontScaling={false}>{str.hours}</Text>
          </View>
        </View>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const rowStyles = StyleSheet.create({
  headline: { flexDirection: "row", alignItems: "center", gap: 14 },
  headlineCompact: { flexDirection: "row", alignItems: "center", gap: 10 },
  countCompact: { color: "#fff", fontSize: 52, fontWeight: "900", letterSpacing: -2, includeFontPadding: false },
  countLabel: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subCompact: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600", marginTop: 10 },
});

// ─── 5) Türler ───────────────────────────────────────────────────────────────

export const TopGenresSlide = memo(function TopGenresSlide({ recap, str, language, topInset, accent }) {
  const genres = recap.allGenres || [];
  const max = genres[0]?.count || 1;
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="drama-masks">
      <Kicker>{str.genresTitle}</Kicker>
      {genres.length === 0 ? (
        <Text style={shared.sub}>{str.genresEmpty}</Text>
      ) : (
        <ScrollView
          style={{ maxHeight: LIST_MAX_H, marginTop: 4 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {genres.map((g, i) => (
            <Reveal key={`${g.genre}-${i}`} delay={120 + Math.min(i, 8) * 70} dy={14}>
              <View style={genreStyles.item}>
                <View style={genreStyles.headerRow}>
                  <Text style={[genreStyles.rank, i === 0 && genreStyles.rankTop]} allowFontScaling={false}>
                    {i + 1}
                  </Text>
                  <Text style={[genreStyles.name, i === 0 && genreStyles.nameTop]} allowFontScaling={false} numberOfLines={1}>
                    {g.genre}
                  </Text>
                  <Text style={genreStyles.count} allowFontScaling={false}>
                    {formatNumber(g.count, language)}
                  </Text>
                </View>
                <View style={genreStyles.barTrack}>
                  <View
                    style={[
                      genreStyles.barFill,
                      { width: `${Math.max(10, (g.count / max) * 100)}%`, backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.5)" },
                    ]}
                  />
                </View>
              </View>
            </Reveal>
          ))}
        </ScrollView>
      )}
    </WrappedSlideFrame>
  );
});

const genreStyles = StyleSheet.create({
  item: { marginBottom: 17 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  rank: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "900", width: 24 },
  rankTop: { color: "#fff", fontSize: 16 },
  name: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  nameTop: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  count: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "800" },
  barTrack: { height: 9, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden", marginLeft: 24 },
  barFill: { height: "100%", borderRadius: 5 },
});

// ─── 6) En çok izlenen diziler ───────────────────────────────────────────────

export const TopShowsSlide = memo(function TopShowsSlide({ recap, str, language, getTmdbUrl, topInset, accent }) {
  const shows = recap.allShows || [];
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="trophy">
      <Kicker>{str.topShowsTitle}</Kicker>
      <ScrollView
        style={{ maxHeight: LIST_MAX_H, marginTop: 4 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {shows.map((s, i) => (
          <Reveal key={`${s.showId}-${i}`} delay={120 + Math.min(i, 8) * 60} dy={14}>
            <View style={[showStyles.row, i === 0 && showStyles.rowTop]}>
              <Text style={[showStyles.rank, i === 0 && showStyles.rankTop]} allowFontScaling={false}>
                {i + 1}
              </Text>
              {s.showImage ? (
                <Image
                  source={{ uri: getTmdbUrl ? getTmdbUrl(s.showImage, "poster", 200) : null }}
                  style={[showStyles.poster, i === 0 && showStyles.posterTop]}
                  contentFit="cover"
                  transition={140}
                />
              ) : (
                <View style={[showStyles.poster, showStyles.posterPh]} />
              )}
              <View style={showStyles.meta}>
                <Text style={[showStyles.name, i === 0 && showStyles.nameTop]} allowFontScaling={false} numberOfLines={2}>
                  {s.showName}
                </Text>
                <View style={showStyles.badge}>
                  <MaterialCommunityIcons name="play-circle" size={12} color="#000" />
                  <Text style={showStyles.badgeText} allowFontScaling={false}>
                    {formatNumber(s.episodeCount, language)} {str.episodesShort}
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>
        ))}
      </ScrollView>
    </WrappedSlideFrame>
  );
});

const showStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  rowTop: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  rank: { color: "rgba(255,255,255,0.55)", fontSize: 18, fontWeight: "900", width: 28 },
  rankTop: { color: "#fff", fontSize: 24 },
  poster: { width: 48, height: 72, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  posterTop: { width: 60, height: 90, borderWidth: 2, borderColor: "#fff" },
  posterPh: { borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  meta: { flex: 1, marginLeft: 13 },
  name: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 7 },
  nameTop: { fontSize: 19, fontWeight: "900" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    backgroundColor: "#fff", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  badgeText: { color: "#000", fontSize: 11, fontWeight: "800" },
});

// ─── 7) En yoğun zamanlar ────────────────────────────────────────────────────

export const BusiestSlide = memo(function BusiestSlide({ recap, str, language, topInset, accent }) {
  const monthly = recap.monthly || [];
  const max = Math.max(1, ...monthly);
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="calendar-month">
      <Kicker>{str.busiestTitle}</Kicker>

      {recap.busiestMonth && (
        <Reveal delay={170}>
          <View style={busyStyles.block}>
            <Text style={busyStyles.label} allowFontScaling={false}>{str.busiestMonth}</Text>
            <Text style={busyStyles.value} allowFontScaling={false}>
              {monthName(recap.busiestMonth.month, language)}
            </Text>
          </View>
        </Reveal>
      )}

      <Reveal delay={320}>
        <View style={busyStyles.chart}>
          {monthly.map((min, i) => {
            const h = Math.max(5, (min / max) * 92);
            const isPeak = recap.busiestMonth && i === recap.busiestMonth.month;
            return (
              <View key={i} style={busyStyles.barCol}>
                <Text
                  style={[busyStyles.barValue, isPeak && busyStyles.barValuePeak]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {min > 0 ? formatNumber(min, language) : ""}
                </Text>
                <View style={[busyStyles.bar, { height: h, backgroundColor: isPeak ? "#fff" : "rgba(255,255,255,0.38)" }]} />
                <Text style={busyStyles.barLabel} allowFontScaling={false}>
                  {monthName(i, language).slice(0, 1)}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={busyStyles.chartUnit} allowFontScaling={false}>
          {str.perMonthMinutes}
        </Text>
      </Reveal>

      {recap.busiestDay && (
        <Reveal delay={460}>
          <View style={busyStyles.block}>
            <Text style={busyStyles.label} allowFontScaling={false}>{str.busiestDay}</Text>
            <Text style={busyStyles.value} allowFontScaling={false}>
              {formatLongDate(recap.busiestDay.date, language)}
            </Text>
            <Text style={busyStyles.sub} allowFontScaling={false}>
              {formatNumber(recap.busiestDay.count, language)} {str.itemsShort}
            </Text>
          </View>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const busyStyles = StyleSheet.create({
  block: { marginTop: 18 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 3, letterSpacing: -0.6 },
  sub: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "700", marginTop: 3 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 142, marginTop: 22 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: 9, borderRadius: 5 },
  barValue: { color: "rgba(255,255,255,0.55)", fontSize: 7.5, fontWeight: "800", marginBottom: 4 },
  barValuePeak: { color: "#fff", fontSize: 8.5 },
  barLabel: { color: "rgba(255,255,255,0.5)", fontSize: 8, fontWeight: "700", marginTop: 6 },
  chartUnit: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 8, letterSpacing: 0.3 },
});

// ─── 7b) En yoğun ayın istatistikleri ───────────────────────────────────────

export const BusiestMonthSlide = memo(function BusiestMonthSlide({ recap, str, language, topInset, accent }) {
  const bm = recap.busiestMonth;
  const { hours } = minutesBreakdown(bm?.minutes || 0);
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="calendar-star">
      <Kicker>{str.busiestMonthTitle}</Kicker>
      <Reveal delay={150}>
        <Text style={bmStyles.monthName} allowFontScaling={false}>
          {bm ? monthName(bm.month, language) : "-"}
        </Text>
      </Reveal>
      <Reveal delay={270}>
        <View style={rowStyles.headlineCompact}>
          <AnimatedCount
            value={bm?.minutes || 0}
            format={(n) => formatNumber(n, language)}
            style={rowStyles.countCompact}
          />
          <Text style={rowStyles.countLabel} allowFontScaling={false}>
            {str.minutes}
          </Text>
        </View>
      </Reveal>
      <Reveal delay={380}>
        <Text style={rowStyles.subCompact} allowFontScaling={false}>
          ~{formatNumber(hours, language)} {str.hours}
        </Text>
      </Reveal>
      <Reveal delay={520}>
        <View style={bmStyles.pillRow}>
          <View style={bmStyles.infoPill}>
            <MaterialCommunityIcons name="movie-open" size={18} color="#fff" />
            <Text style={bmStyles.infoNum} allowFontScaling={false}>{formatNumber(bm?.movieCount || 0, language)}</Text>
            <Text style={bmStyles.infoLabel} allowFontScaling={false}>{str.moviesShort}</Text>
          </View>
          <View style={bmStyles.infoPill}>
            <MaterialCommunityIcons name="television-classic" size={18} color="#fff" />
            <Text style={bmStyles.infoNum} allowFontScaling={false}>{formatNumber(bm?.episodeCount || 0, language)}</Text>
            <Text style={bmStyles.infoLabel} allowFontScaling={false}>{str.tvEpisodes}</Text>
          </View>
        </View>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const bmStyles = StyleSheet.create({
  monthName: { color: "#fff", fontSize: 46, fontWeight: "900", letterSpacing: -1.5, marginBottom: 10 },
  pillRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  infoNum: { color: "#fff", fontSize: 22, fontWeight: "900" },
  infoLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
});

// ─── 8) Kişilik ──────────────────────────────────────────────────────────────

export const PersonalitySlide = memo(function PersonalitySlide({ recap, str, topInset, accent }) {
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="account-star">
      <Kicker>{str.personalityTitle}</Kicker>
      <Reveal delay={180}>
        <Text style={personalityStyles.emoji} allowFontScaling={false}>
          {recap.personality?.emoji}
        </Text>
      </Reveal>
      <Reveal delay={320}>
        <Text style={personalityStyles.title} allowFontScaling={false}>
          {recap.personality?.title}
        </Text>
      </Reveal>
      <Reveal delay={460}>
        <Text style={shared.sub}>
          {str.personalityBased}
          {recap.topGenres?.[0]?.genre ? `: ${recap.topGenres[0].genre}` : ""}
        </Text>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const personalityStyles = StyleSheet.create({
  emoji: { fontSize: 108, marginBottom: 6 },
  title: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1.2, lineHeight: 48 },
});

const styles = StyleSheet.create({
  orbWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
