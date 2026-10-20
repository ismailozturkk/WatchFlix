// components/wrapped/WrappedSlides.js
//
// Seelogd Wrapped — tam ekran hikâye slaytları.
// Tasarım sistemi: zengin 3-stop gradient + SVG radyal ışımalar + ince nokta
// dokusu + yüzen orb'lar, cam paneller (yarı saydam dolgu + üst ışık + ince
// kenar), halka/halka-grafik göstergeler, poster yelpazeleri, kademeli (staggered)
// reveal ve count-up sayaçlar. Ekran (WrappedScreen) aktif slaytı index'e göre
// render eder; her slayt mount olduğunda animasyonlar baştan oynar. Segmentli üst
// progress ayrı bileşendir (WrappedProgress).
//
// Her slayt şu prop'ları alır:
//   { recap, str, theme, language, getTmdbUrl, topInset, accent, years,
//     onSelectYear, pace, step }
//   pace: getYearPace çıktısı ({ deltaPct, sameWindow }) — geçen yıla kıyas.
//   step: slaytın sıra numarası (üst etiketteki "02" rozeti).

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  daysInYear,
  formatNumber,
  minutesBreakdown,
  monthName,
  formatLongDate,
  weekdayName,
} from "../../utils/wrapped";
import { buildYearHeat } from "../../utils/wrappedCard";
import WrappedYearPath from "./WrappedYearPath";
import YearHeat from "./YearHeat";
import RollingNumber from "../animated/RollingNumber";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PATH_W = SCREEN_W - 56;
const YEAR_PATH_W = SCREEN_W - 24;
const BODY_W = SCREEN_W - 56; // içerik genişliği (yatay padding 28)

// Slayt başına ana vurgu renkleri (canlı). Screen index % length ile seçer.
export const SLIDE_COLORS = [
  "#1DB954",
  "#E50914",
  "#7C3AED",
  "#0A84FF",
  "#FF8A3D",
  "#FF2D87",
  "#00C2A8",
  "#F5C518",
  "#5AACF0",
];

// Her vurgu için derin gradient eşi (zengin geçiş).
const COMPANION = {
  "#1DB954": "#0A5F2E",
  "#E50914": "#6E0510",
  "#7C3AED": "#33167A",
  "#0A84FF": "#063C76",
  "#FF8A3D": "#9E4717",
  "#FF2D87": "#8C1149",
  "#00C2A8": "#005C51",
  "#F5C518": "#7E6500",
  "#5AACF0": "#28628F",
};

const WHITE = "#FFFFFF";

const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return color.length === 7 ? color + hex : color;
  }
  return color;
};

const fill = (template, n) => String(template || "").replace("{n}", String(n));

// ─── Animasyon primitifleri ──────────────────────────────────────────────────

/** Kademeli giriş: fade + yukarı kayma (delay ile sıralanır). */
const Reveal = memo(function Reveal({ delay = 0, dy = 20, children, style }) {
  const o = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(dy)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, {
        toValue: 1,
        duration: 460,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(ty, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        friction: 7,
        tension: 58,
      }),
    ]).start();
  }, [o, ty, delay]);
  return (
    <Animated.View
      style={[style, { opacity: o, transform: [{ translateY: ty }] }]}
    >
      {children}
    </Animated.View>
  );
});

/**
 * 0 → 1 eased ilerleme (rAF). Halka/halka-grafik gibi SVG özniteliklerini
 * sürmek için: Animated değeri SVG özniteliğine bağlanamaz (yerel sürücü yok),
 * bu yüzden React durumu üzerinden sayılır — RollingNumber ile aynı teknik.
 */
function useEasedProgress(duration = 1300, delay = 0) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = null;
    const startAt = Date.now() + delay;
    const tick = () => {
      const k = Math.min(1, Math.max(0, (Date.now() - startAt) / duration));
      setP(1 - Math.pow(1 - k, 3));
      frame = k < 1 ? requestAnimationFrame(tick) : null;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [duration, delay]);
  return p;
}

/** Yumuşak yüzen ışıltı orb'u (sahte radyal: iç içe 2 katman + döngü). */
const FloatingOrb = memo(function FloatingOrb({
  color,
  size,
  style,
  delay = 0,
  range = 16,
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 4200,
          delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, range],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.orbWrap, style, { transform: [{ translateY }] }]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(color, 0.2),
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.6,
          height: size * 0.6,
          top: size * 0.2,
          left: size * 0.2,
          borderRadius: size,
          backgroundColor: withAlpha(color, 0.26),
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
              <View
                style={[progressStyles.fill, { width: filled ? "100%" : "0%" }]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
});

const progressStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, paddingHorizontal: 14 },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2, backgroundColor: WHITE },
  activeGlow: {
    shadowColor: WHITE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
});

// ─── Slayt çerçevesi (gradient + ışımalar + doku + giriş) ────────────────────

export const WrappedSlideFrame = memo(function WrappedSlideFrame({
  accent = SLIDE_COLORS[0],
  children,
  topInset = 0,
  motifIcon,
}) {
  const accent2 = COMPANION[accent] || "#101018";
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.04)).current;
  const gid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 9,
        tension: 50,
      }),
    ]).start();
  }, [opacity, scale]);

  // pointerEvents: arka plan dokunmayı yakalamaz; yalnızca etkileşimli alt
  // bileşenler (yıl çipleri vb.) yakalar → boş alan/metin dokunuşları alttaki
  // navigasyon bölgelerine geçer (WrappedScreen tap zones).
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="box-none"
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(accent, 0.95), accent2, "#07070B"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radyal ışımalar + nokta dokusu: tek SVG katmanı */}
      <Svg
        pointerEvents="none"
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id={`ga${gid}`}
            cx={SCREEN_W * 0.92}
            cy={SCREEN_H * 0.06}
            r={SCREEN_W * 0.95}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={WHITE} stopOpacity="0.2" />
            <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={`gb${gid}`}
            cx={SCREEN_W * 0.05}
            cy={SCREEN_H * 0.86}
            r={SCREEN_W * 0.9}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={accent} stopOpacity="0.34" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
          <Pattern id={`gd${gid}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1.1" fill={WHITE} fillOpacity="0.1" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill={`url(#gd${gid})`} />
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill={`url(#ga${gid})`} />
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill={`url(#gb${gid})`} />
      </Svg>

      {/* Yüzen orb'lar (derinlik) */}
      <FloatingOrb
        color={accent}
        size={240}
        style={{ top: -50, right: -80 }}
        range={18}
      />
      <FloatingOrb
        color={accent2}
        size={190}
        style={{ bottom: 60, left: -90 }}
        delay={900}
        range={22}
      />

      {/* Dev soluk motif (monokrom ikon filigranı) */}
      {motifIcon ? (
        <Animated.View
          pointerEvents="none"
          style={[
            frameStyles.motif,
            { transform: [{ scale }, { rotate: "-10deg" }] },
          ]}
        >
          <MaterialCommunityIcons
            name={motifIcon}
            size={300}
            color="rgba(255,255,255,0.05)"
          />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[
          frameStyles.content,
          { paddingTop: topInset + 64, transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
});

const frameStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 128,
    justifyContent: "center",
  },
  motif: {
    position: "absolute",
    right: -56,
    top: "14%",
  },
});

// ─── Ortak parçalar ──────────────────────────────────────────────────────────

/** Cam panel: yarı saydam dolgu + sol-üstten ışık + ince kenar. */
const GlassCard = ({ children, style, radius = 20, strong = false }) => (
  <View
    style={[
      shared.glass,
      {
        borderRadius: radius,
        backgroundColor: strong ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.1)",
      },
      style,
    ]}
  >
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.7, y: 0.9 }}
      style={StyleSheet.absoluteFill}
    />
    {children}
  </View>
);

/** Üst etiket: cam hap içinde sıra rozeti + başlık. */
const Kicker = ({ children, step, delay = 0 }) => (
  <Reveal delay={delay}>
    <View style={shared.kickerPill}>
      {step != null ? (
        <View style={shared.kickerStep}>
          <Text style={shared.kickerStepText} allowFontScaling={false}>
            {String(step).padStart(2, "0")}
          </Text>
        </View>
      ) : (
        <View style={shared.kickerDot} />
      )}
      <Text style={shared.kicker} allowFontScaling={false} numberOfLines={1}>
        {children}
      </Text>
    </View>
  </Reveal>
);

/** Küçük afiş: TMDB posteri, yoksa yer tutucu. */
const Poster = ({ path, getTmdbUrl, width, height, radius = 10, style, glow }) => (
  <View
    style={[
      {
        width,
        height,
        borderRadius: radius,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.7)",
        overflow: "hidden",
      },
      glow && shared.posterGlow,
      style,
    ]}
  >
    {path && getTmdbUrl ? (
      <Image
        source={{ uri: getTmdbUrl(path, "poster", 300) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={140}
      />
    ) : (
      <View style={shared.posterEmpty}>
        <MaterialCommunityIcons
          name="movie-open-outline"
          size={Math.min(width, height) * 0.36}
          color="rgba(255,255,255,0.4)"
        />
      </View>
    )}
  </View>
);

/** Halka gösterge: ilerleme 0–1 (renk + iz). */
const Ring = ({ size, stroke, progress, color = WHITE, track = "rgba(255,255,255,0.18)", children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
};

const shared = StyleSheet.create({
  glass: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  kickerPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 32,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 18,
  },
  kickerStep: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 5,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  kickerStepText: { color: "#000", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.3 },
  kickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WHITE, marginLeft: 8 },
  kicker: {
    color: WHITE,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  bigNumber: {
    color: WHITE,
    fontSize: 78,
    lineHeight: 84,
    fontWeight: "900",
    letterSpacing: -3.5,
    includeFontPadding: false,
  },
  bigLabel: { color: WHITE, fontSize: 22, fontWeight: "800", marginTop: 4 },
  sub: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    lineHeight: 23,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  posterGlow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  posterEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
});

/** İki satır sayı + etiketli küçük cam kutu. */
const StatBox = ({ icon, value, label, style }) => (
  <GlassCard radius={18} style={[statStyles.box, style]}>
    {icon ? (
      <View style={statStyles.icon}>
        <MaterialCommunityIcons name={icon} size={16} color={WHITE} />
      </View>
    ) : null}
    <Text style={statStyles.value} allowFontScaling={false} numberOfLines={1}>
      {value}
    </Text>
    <Text style={statStyles.label} allowFontScaling={false} numberOfLines={1}>
      {label}
    </Text>
  </GlassCard>
);

const statStyles = StyleSheet.create({
  box: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  value: { color: WHITE, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  label: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
});

/** "+%24 geçen yıla göre" cam rozeti (kıyas yoksa hiç çizilmez). */
const PaceBadge = ({ pace, str }) => {
  if (!pace || pace.deltaPct == null || Math.abs(pace.deltaPct) < 1) return null;
  const up = pace.deltaPct > 0;
  const key = up
    ? pace.sameWindow
      ? "paceUpSoFar"
      : "paceUp"
    : pace.sameWindow
      ? "paceDownSoFar"
      : "paceDown";
  return (
    <GlassCard radius={16} style={paceStyles.badge}>
      <View style={[paceStyles.icon, { backgroundColor: up ? "#22C55E" : "#F43F5E" }]}>
        <Ionicons name={up ? "trending-up" : "trending-down"} size={14} color={WHITE} />
      </View>
      <Text style={paceStyles.text} allowFontScaling={false} numberOfLines={2}>
        {fill(str[key], Math.abs(pace.deltaPct))}
      </Text>
    </GlassCard>
  );
};

const paceStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  icon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  text: { color: WHITE, fontSize: 13, fontWeight: "800", flexShrink: 1 },
});

// ─── 1) Intro ────────────────────────────────────────────────────────────────

const FAN_ROT = [-12, -6, 0, 6, 12];
const FAN_DY = [14, 4, 0, 4, 14];

export const IntroSlide = memo(function IntroSlide({
  recap,
  str,
  topInset,
  accent,
  years = [],
  onSelectYear,
  getTmdbUrl,
}) {
  const multi = years.length > 1;
  // Tek yıllıksa alt kısımda kullanıcının kendi posterlerinden bir yelpaze.
  const fan = useMemo(() => {
    const shows = (recap.topShows || []).map((s) => s.showImage);
    const movies = (recap.moviePosters || []).map((m) => m.imagePath);
    const merged = [];
    for (let i = 0; i < 5; i += 1) {
      const next = i % 2 === 0 ? shows.shift() || movies.shift() : movies.shift() || shows.shift();
      if (next) merged.push(next);
    }
    return merged;
  }, [recap]);

  // Hareket yönü bilgisi: pulsing ok.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="star-four-points"
    >
      <Reveal delay={60}>
        <GlassCard radius={16} style={introStyles.brandPill}>
          <MaterialCommunityIcons name="gift" size={16} color={WHITE} />
          <Text style={introStyles.brand} allowFontScaling={false}>
            {str.brand}
          </Text>
        </GlassCard>
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
            <Animated.View
              style={[
                introStyles.tapHint,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                  transform: [
                    { translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) },
                  ],
                },
              ]}
            >
              <Text style={introStyles.tapText} allowFontScaling={false}>
                {str.introTap}
              </Text>
              <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.9)" />
            </Animated.View>
          </Reveal>
          {fan.length > 0 && (
            <Reveal delay={680} dy={34} style={introStyles.fanWrap}>
              {fan.map((path, i) => {
                const slot = fan.length === 5 ? i : i + Math.floor((5 - fan.length) / 2);
                return (
                  <Poster
                    key={`${path}-${i}`}
                    path={path}
                    getTmdbUrl={getTmdbUrl}
                    width={66}
                    height={99}
                    radius={11}
                    glow
                    style={{
                      marginLeft: i === 0 ? 0 : -14,
                      transform: [{ translateY: FAN_DY[slot] }, { rotate: `${FAN_ROT[slot]}deg` }],
                      zIndex: slot === 2 ? 5 : 4 - Math.abs(slot - 2),
                    }}
                  />
                );
              })}
            </Reveal>
          )}
        </>
      )}
    </WrappedSlideFrame>
  );
});

const introStyles = StyleSheet.create({
  brandPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  brand: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pickTitle: {
    color: WHITE,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 14,
  },
  pickSubtitle: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  year: {
    color: WHITE,
    fontSize: 116,
    fontWeight: "900",
    letterSpacing: -6,
    includeFontPadding: false,
    marginTop: 8,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 26,
  },
  tapText: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, fontWeight: "800" },
  fanWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginTop: 34,
    paddingBottom: 14,
  },
});

// ─── 2) Toplam süre ──────────────────────────────────────────────────────────

export const TotalTimeSlide = memo(function TotalTimeSlide({
  recap,
  str,
  language,
  topInset,
  accent,
  pace,
  step,
}) {
  const { hours, days } = minutesBreakdown(recap.totalMinutes);
  const remHours = hours - days * 24;
  // Yılın kaçını izlemeyle geçirdi: saat / (yıl günü × 24). Görünür olsun diye
  // halka en az %2 dolar; yazı gerçek yüzdeyi söyler.
  const yearHours = daysInYear(recap.year) * 24;
  const share = Math.min(1, hours / yearHours);
  const pct = share >= 0.1 ? Math.round(share * 100) : Math.round(share * 1000) / 10;
  const p = useEasedProgress(1500, 250);
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="clock-time-four"
    >
      <Kicker step={step}>{str.totalTitle}</Kicker>
      <Reveal delay={180}>
        <RollingNumber
          value={recap.totalMinutes}
          duration={1400}
          format={(n) => formatNumber(n, language)}
          style={shared.bigNumber}
        />
      </Reveal>
      <Reveal delay={300}>
        <Text style={shared.bigLabel}>{str.minutes}</Text>
      </Reveal>

      <Reveal delay={440} style={{ marginTop: 22 }}>
        <GlassCard radius={26} style={totalStyles.card}>
          <Ring size={112} stroke={11} progress={Math.max(0.02, share) * p} color={WHITE}>
            <Text style={totalStyles.ringValue} allowFontScaling={false}>
              {language === "tr" ? `%${pct}` : `${pct}%`}
            </Text>
            <Text style={totalStyles.ringLabel} allowFontScaling={false}>
              {str.totalShareLabel}
            </Text>
          </Ring>
          <View style={totalStyles.copy}>
            <Text style={shared.eyebrow} allowFontScaling={false} numberOfLines={2}>
              {str.totalNonStop}
            </Text>
            <View style={totalStyles.chips}>
              {days > 0 && (
                <View style={totalStyles.chip}>
                  <Text style={totalStyles.chipNum} allowFontScaling={false}>
                    {formatNumber(days, language)}
                  </Text>
                  <Text style={totalStyles.chipLabel} allowFontScaling={false}>
                    {str.days}
                  </Text>
                </View>
              )}
              <View style={totalStyles.chip}>
                <Text style={totalStyles.chipNum} allowFontScaling={false}>
                  {formatNumber(days > 0 ? remHours : hours, language)}
                </Text>
                <Text style={totalStyles.chipLabel} allowFontScaling={false}>
                  {str.hours}
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>
      </Reveal>

      <Reveal delay={600}>
        <PaceBadge pace={pace} str={str} />
      </Reveal>
    </WrappedSlideFrame>
  );
});

const totalStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 18, padding: 16 },
  ringValue: { color: WHITE, fontSize: 24, fontWeight: "900", letterSpacing: -0.8 },
  ringLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginTop: 1,
  },
  copy: { flex: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  chipNum: { color: WHITE, fontSize: 22, fontWeight: "900" },
  chipLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
});

// ─── 3) Filmler ──────────────────────────────────────────────────────────────

const MOVIE_FAN_ROT = [-9, -4.5, 0, 4.5, 9];
const MOVIE_FAN_DY = [12, 4, 0, 4, 12];

export const MoviesSlide = memo(function MoviesSlide({
  recap,
  str,
  language,
  getTmdbUrl,
  topInset,
  accent,
  step,
}) {
  const { hours } = minutesBreakdown(recap.movieMinutes);
  const posters = (recap.moviePosters || []).slice(0, 5);
  const longest = (recap.moviePosters || [])[0];
  const longestH = longest ? Math.floor(longest.minutes / 60) : 0;
  const longestM = longest ? longest.minutes % 60 : 0;
  const posterW = Math.min(76, (BODY_W + 4 * 18) / 5);
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="movie-open"
    >
      <Kicker step={step}>{str.moviesTitle}</Kicker>
      <Reveal delay={150}>
        <View style={rowStyles.headlineCompact}>
          <RollingNumber
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
        <Reveal delay={400} dy={30} style={movieStyles.fan}>
          {posters.map((m, i) => {
            const slot = posters.length === 5 ? i : i + Math.floor((5 - posters.length) / 2);
            const center = slot === 2;
            return (
              <Poster
                key={`${m.id}-${i}`}
                path={m.imagePath}
                getTmdbUrl={getTmdbUrl}
                width={center ? posterW + 12 : posterW}
                height={Math.round((center ? posterW + 12 : posterW) * 1.5)}
                radius={12}
                glow
                style={{
                  marginLeft: i === 0 ? 0 : -18,
                  transform: [{ translateY: MOVIE_FAN_DY[slot] }, { rotate: `${MOVIE_FAN_ROT[slot]}deg` }],
                  zIndex: center ? 5 : 4 - Math.abs(slot - 2),
                }}
              />
            );
          })}
        </Reveal>
      )}

      {longest && (
        <Reveal delay={560} style={{ marginTop: 20 }}>
          <GlassCard radius={18} style={movieStyles.longest}>
            <View style={movieStyles.longestIcon}>
              <MaterialCommunityIcons name="timer-sand" size={18} color={WHITE} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={shared.eyebrow} allowFontScaling={false}>
                {str.moviesLongest}
              </Text>
              <Text style={movieStyles.longestName} allowFontScaling={false} numberOfLines={1}>
                {longest.name}
              </Text>
            </View>
            <Text style={movieStyles.longestTime} allowFontScaling={false}>
              {longestH}
              {str.hoursShort} {String(longestM).padStart(2, "0")}
              {str.minutesShort}
            </Text>
          </GlassCard>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const movieStyles = StyleSheet.create({
  fan: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginTop: 26,
    paddingBottom: 10,
  },
  longest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  longestIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  longestName: { color: WHITE, fontSize: 16, fontWeight: "900", marginTop: 2 },
  longestTime: { color: WHITE, fontSize: 15, fontWeight: "900" },
});

// ─── 4) Diziler ──────────────────────────────────────────────────────────────

export const TvSlide = memo(function TvSlide({
  recap,
  str,
  language,
  getTmdbUrl,
  topInset,
  accent,
  step,
}) {
  const { hours } = minutesBreakdown(recap.tvMinutes);
  const lead = (recap.topShows || [])[0];
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="television-classic"
    >
      <Kicker step={step}>{str.tvTitle}</Kicker>
      <Reveal delay={170}>
        <RollingNumber
          value={recap.totalEpisodes}
          format={(n) => formatNumber(n, language)}
          style={shared.bigNumber}
        />
      </Reveal>
      <Reveal delay={290}>
        <Text style={shared.bigLabel}>{str.tvEpisodes}</Text>
      </Reveal>
      <Reveal delay={400} style={{ marginTop: 22 }}>
        <View style={tvStyles.boxes}>
          <StatBox
            icon="television-classic"
            value={formatNumber(recap.totalShows, language)}
            label={str.tvShows}
          />
          <StatBox
            icon="clock-outline"
            value={`~${formatNumber(hours, language)}`}
            label={str.hours}
          />
        </View>
      </Reveal>

      {lead && (
        <Reveal delay={560} style={{ marginTop: 14 }}>
          <GlassCard radius={22} strong style={tvStyles.lead}>
            <Poster
              path={lead.showImage}
              getTmdbUrl={getTmdbUrl}
              width={64}
              height={96}
              radius={12}
              glow
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={shared.eyebrow} allowFontScaling={false}>
                {str.tvTopShow}
              </Text>
              <Text style={tvStyles.leadName} allowFontScaling={false} numberOfLines={2}>
                {lead.showName}
              </Text>
              <View style={tvStyles.leadBadge}>
                <MaterialCommunityIcons name="play-circle" size={13} color="#000" />
                <Text style={tvStyles.leadBadgeText} allowFontScaling={false}>
                  {formatNumber(lead.episodeCount, language)} {str.episodesShort}
                </Text>
              </View>
            </View>
          </GlassCard>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const tvStyles = StyleSheet.create({
  boxes: { flexDirection: "row", gap: 12 },
  lead: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12 },
  leadName: { color: WHITE, fontSize: 19, fontWeight: "900", marginTop: 3, letterSpacing: -0.3 },
  leadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: WHITE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 9,
  },
  leadBadgeText: { color: "#000", fontSize: 11.5, fontWeight: "800" },
});

const rowStyles = StyleSheet.create({
  headlineCompact: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  countCompact: {
    color: WHITE,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: "900",
    letterSpacing: -2.5,
    includeFontPadding: false,
  },
  countLabel: { color: WHITE, fontSize: 19, fontWeight: "800" },
  subCompact: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
});

// ─── 5) Türler ───────────────────────────────────────────────────────────────

// Halka-grafiğin dilim opaklıkları: birinci beyaz, sonrakiler giderek soluk.
const DONUT_ALPHAS = [1, 0.78, 0.58, 0.4, 0.26];

export const TopGenresSlide = memo(function TopGenresSlide({
  recap,
  str,
  language,
  topInset,
  accent,
  step,
}) {
  const genres = recap.allGenres || [];
  const total = genres.reduce((sum, g) => sum + g.count, 0) || 1;
  const max = genres[0]?.count || 1;
  const topShare = genres[0] ? Math.round((genres[0].count / total) * 100) : 0;
  const p = useEasedProgress(1300, 200);

  const SIZE = 132;
  const STROKE = 20;
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  let cursor = 0;
  const slices = genres.slice(0, 5).map((g, i) => {
    const share = g.count / total;
    const slice = { i, start: cursor, share };
    cursor += share;
    return slice;
  });

  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="drama-masks"
    >
      <Kicker step={step}>{str.genresTitle}</Kicker>
      {genres.length === 0 ? (
        <Text style={shared.sub}>{str.genresEmpty}</Text>
      ) : (
        <>
          <Reveal delay={140}>
            <GlassCard radius={24} strong style={genreStyles.hero}>
              <View style={{ width: SIZE, height: SIZE }}>
                <Svg width={SIZE} height={SIZE}>
                  <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} fill="none" />
                  {slices.map((s) => {
                    const len = Math.max(0, c * s.share * p - 2);
                    return (
                      <Circle
                        key={s.i}
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={r}
                        stroke={WHITE}
                        strokeOpacity={DONUT_ALPHAS[s.i]}
                        strokeWidth={STROKE}
                        fill="none"
                        strokeDasharray={`${len} ${c}`}
                        strokeDashoffset={-c * s.start * p}
                        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                      />
                    );
                  })}
                </Svg>
                <View style={genreStyles.donutCenter} pointerEvents="none">
                  <Text style={genreStyles.donutValue} allowFontScaling={false}>
                    {language === "tr" ? `%${topShare}` : `${topShare}%`}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={shared.eyebrow} allowFontScaling={false}>
                  {str.genresTopLabel}
                </Text>
                <Text
                  style={genreStyles.heroName}
                  allowFontScaling={false}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {genres[0].genre}
                </Text>
                <Text style={genreStyles.heroShare} allowFontScaling={false} numberOfLines={2}>
                  {fill(str.genresTopShare, topShare)}
                </Text>
              </View>
            </GlassCard>
          </Reveal>

          <ScrollView
            style={{ maxHeight: SCREEN_H * 0.36, marginTop: 16 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {genres.map((g, i) => (
              <Reveal
                key={`${g.genre}-${i}`}
                delay={260 + Math.min(i, 8) * 60}
                dy={14}
              >
                <View style={genreStyles.item}>
                  <View style={genreStyles.headerRow}>
                    <View style={[genreStyles.dot, { opacity: DONUT_ALPHAS[Math.min(i, 4)] }]} />
                    <Text
                      style={[genreStyles.name, i === 0 && genreStyles.nameTop]}
                      allowFontScaling={false}
                      numberOfLines={1}
                    >
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
                        {
                          width: `${Math.max(8, (g.count / max) * 100)}%`,
                          backgroundColor: i === 0 ? WHITE : "rgba(255,255,255,0.55)",
                        },
                      ]}
                    />
                  </View>
                </View>
              </Reveal>
            ))}
          </ScrollView>
        </>
      )}
    </WrappedSlideFrame>
  );
});

const genreStyles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  donutValue: { color: WHITE, fontSize: 24, fontWeight: "900", letterSpacing: -0.8 },
  heroName: { color: WHITE, fontSize: 30, fontWeight: "900", letterSpacing: -1, marginTop: 4, lineHeight: 34 },
  heroShare: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "700", marginTop: 6 },
  item: { marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 7, gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: WHITE },
  name: { color: WHITE, fontSize: 16, fontWeight: "800", flex: 1 },
  nameTop: { fontSize: 18, fontWeight: "900" },
  count: { color: "rgba(255,255,255,0.78)", fontSize: 14, fontWeight: "800" },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
    marginLeft: 18,
  },
  barFill: { height: "100%", borderRadius: 4 },
});

// ─── 6) En çok izlenen diziler ───────────────────────────────────────────────

export const TopShowsSlide = memo(function TopShowsSlide({
  recap,
  str,
  language,
  getTmdbUrl,
  topInset,
  accent,
  step,
}) {
  const shows = recap.allShows || [];
  const lead = shows[0];
  const rest = shows.slice(1);
  const max = lead?.episodeCount || 1;
  return (
    <WrappedSlideFrame accent={accent} topInset={topInset} motifIcon="trophy">
      <Kicker step={step}>{str.topShowsTitle}</Kicker>
      <ScrollView
        style={{ maxHeight: SCREEN_H * 0.62 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {lead && (
          <Reveal delay={120} dy={16}>
            <GlassCard radius={24} strong style={showStyles.lead}>
              <View style={showStyles.crown}>
                <MaterialCommunityIcons name="crown" size={13} color="#000" />
                <Text style={showStyles.crownText} allowFontScaling={false}>
                  {str.showsLeadLabel}
                </Text>
              </View>
              <View style={showStyles.leadRow}>
                <Poster
                  path={lead.showImage}
                  getTmdbUrl={getTmdbUrl}
                  width={84}
                  height={126}
                  radius={14}
                  glow
                  style={{ borderColor: WHITE, borderWidth: 2 }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={showStyles.leadName} allowFontScaling={false} numberOfLines={3}>
                    {lead.showName}
                  </Text>
                  <View style={showStyles.badge}>
                    <MaterialCommunityIcons name="play-circle" size={13} color="#000" />
                    <Text style={showStyles.badgeText} allowFontScaling={false}>
                      {formatNumber(lead.episodeCount, language)} {str.episodesShort}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </Reveal>
        )}

        {rest.map((s, i) => (
          <Reveal
            key={`${s.showId}-${i}`}
            delay={240 + Math.min(i, 8) * 60}
            dy={14}
          >
            <View style={showStyles.row}>
              <Text style={showStyles.rank} allowFontScaling={false}>
                {i + 2}
              </Text>
              <Poster
                path={s.showImage}
                getTmdbUrl={getTmdbUrl}
                width={42}
                height={63}
                radius={8}
                style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
              />
              <View style={showStyles.meta}>
                <Text style={showStyles.name} allowFontScaling={false} numberOfLines={1}>
                  {s.showName}
                </Text>
                <View style={showStyles.barTrack}>
                  <View
                    style={[
                      showStyles.barFill,
                      { width: `${Math.max(8, (s.episodeCount / max) * 100)}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={showStyles.count} allowFontScaling={false}>
                {formatNumber(s.episodeCount, language)}
              </Text>
            </View>
          </Reveal>
        ))}
      </ScrollView>
    </WrappedSlideFrame>
  );
});

const showStyles = StyleSheet.create({
  lead: { padding: 14, marginBottom: 16 },
  crown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: WHITE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  crownText: { color: "#000", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  leadName: { color: WHITE, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, lineHeight: 26 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
  },
  badgeText: { color: WHITE, fontSize: 11.5, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 },
  rank: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 17,
    fontWeight: "900",
    width: 20,
    textAlign: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { color: WHITE, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.8)" },
  count: { color: WHITE, fontSize: 15, fontWeight: "900", minWidth: 34, textAlign: "right" },
});

// ─── 7) En yoğun zamanlar ────────────────────────────────────────────────────

export const BusiestSlide = memo(function BusiestSlide({
  recap,
  str,
  language,
  topInset,
  accent,
  step,
}) {
  const monthly = recap.monthly || [];
  const max = Math.max(1, ...monthly);
  const peak = recap.busiestMonth ? recap.busiestMonth.month : -1;
  const grow = useEasedProgress(1100, 300);
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="calendar-month"
    >
      <Kicker step={step}>{str.busiestTitle}</Kicker>

      {recap.busiestMonth && (
        <Reveal delay={150}>
          <Text style={busyStyles.label} allowFontScaling={false}>
            {str.busiestMonth}
          </Text>
          <Text style={busyStyles.value} allowFontScaling={false}>
            {monthName(recap.busiestMonth.month, language)}
          </Text>
        </Reveal>
      )}

      <Reveal delay={300} style={{ marginTop: 18 }}>
        <GlassCard radius={22} style={busyStyles.chartCard}>
          <View style={busyStyles.chart}>
            {monthly.map((min, i) => {
              const h = Math.max(6, (min / max) * 96) * grow;
              const isPeak = i === peak;
              return (
                <View key={i} style={busyStyles.barCol}>
                  <Text
                    style={[busyStyles.barValue, isPeak && busyStyles.barValuePeak]}
                    allowFontScaling={false}
                  >
                    {isPeak ? formatNumber(min, language) : ""}
                  </Text>
                  <View
                    style={[
                      busyStyles.bar,
                      {
                        height: Math.max(4, h),
                        backgroundColor: isPeak ? WHITE : "rgba(255,255,255,0.36)",
                      },
                      isPeak && busyStyles.barPeak,
                    ]}
                  />
                  <Text
                    style={[busyStyles.barLabel, isPeak && { color: WHITE }]}
                    allowFontScaling={false}
                  >
                    {monthName(i, language).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={busyStyles.chartUnit} allowFontScaling={false}>
            {str.perMonthMinutes}
          </Text>
        </GlassCard>
      </Reveal>

      {recap.busiestDay && (
        <Reveal delay={480} style={{ marginTop: 12 }}>
          <GlassCard radius={20} strong style={busyStyles.dayCard}>
            <View style={busyStyles.dayIcon}>
              <MaterialCommunityIcons name="fire" size={20} color={WHITE} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={busyStyles.label} allowFontScaling={false}>
                {str.busiestDay}
              </Text>
              <Text style={busyStyles.dayValue} allowFontScaling={false} numberOfLines={1}>
                {formatLongDate(recap.busiestDay.date, language)}
              </Text>
            </View>
            <View style={busyStyles.dayCount}>
              <Text style={busyStyles.dayCountNum} allowFontScaling={false}>
                {formatNumber(recap.busiestDay.count, language)}
              </Text>
              <Text style={busyStyles.dayCountLabel} allowFontScaling={false}>
                {str.itemsShort}
              </Text>
            </View>
          </GlassCard>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const busyStyles = StyleSheet.create({
  label: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  value: {
    color: WHITE,
    fontSize: 40,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -1.2,
  },
  chartCard: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 150,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: 12, borderRadius: 6 },
  barPeak: {
    shadowColor: WHITE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  // Sütun ~27px; değer kutusu ondan geniş ve ortalı (taşan kısım iki yana eşit).
  barValue: {
    width: 56,
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 5,
    minHeight: 12,
  },
  barValuePeak: { color: WHITE, fontSize: 11 },
  barLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 7,
  },
  chartUnit: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  dayCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  dayIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayValue: { color: WHITE, fontSize: 18, fontWeight: "900", marginTop: 2, letterSpacing: -0.3 },
  dayCount: { alignItems: "flex-end" },
  dayCountNum: { color: WHITE, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  dayCountLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" },
});

// ─── 7b) En yoğun ayın istatistikleri ───────────────────────────────────────

export const BusiestMonthSlide = memo(function BusiestMonthSlide({
  recap,
  str,
  language,
  topInset,
  accent,
  step,
}) {
  const bm = recap.busiestMonth;
  const { hours } = minutesBreakdown(bm?.minutes || 0);
  // O ayın diğer aylara göre payı: yıl toplamından ne kadarı o ay geçti.
  const sharePct = recap.totalMinutes
    ? Math.round(((bm?.minutes || 0) / recap.totalMinutes) * 100)
    : 0;
  const p = useEasedProgress(1200, 250);
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="calendar-star"
    >
      <Kicker step={step}>{str.busiestMonthTitle}</Kicker>
      <Reveal delay={150}>
        <Text style={bmStyles.monthName} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
          {bm ? monthName(bm.month, language) : "-"}
        </Text>
      </Reveal>
      <Reveal delay={270}>
        <View style={rowStyles.headlineCompact}>
          <RollingNumber
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
        <View style={bmStyles.shareRow}>
          <View style={bmStyles.shareTrack}>
            <View style={[bmStyles.shareFill, { width: `${Math.max(3, sharePct) * p}%` }]} />
          </View>
          <Text style={bmStyles.shareText} allowFontScaling={false}>
            ~{formatNumber(hours, language)} {str.hours} · {language === "tr" ? `%${sharePct}` : `${sharePct}%`}
          </Text>
        </View>
      </Reveal>
      <Reveal delay={520}>
        <View style={bmStyles.pillRow}>
          <StatBox
            icon="movie-open"
            value={formatNumber(bm?.movieCount || 0, language)}
            label={str.moviesShort}
          />
          <StatBox
            icon="television-classic"
            value={formatNumber(bm?.episodeCount || 0, language)}
            label={str.tvEpisodes}
          />
        </View>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const bmStyles = StyleSheet.create({
  monthName: {
    color: WHITE,
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 6,
  },
  shareRow: { marginTop: 14, gap: 8 },
  shareTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  shareFill: { height: "100%", borderRadius: 4, backgroundColor: WHITE },
  shareText: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: "700" },
  pillRow: { flexDirection: "row", gap: 12, marginTop: 22 },
});

// ─── 8) Düzenin (ısı haritası + seri) ───────────────────────────────────────

export const ConsistencySlide = memo(function ConsistencySlide({
  recap,
  str,
  language,
  topInset,
  accent,
  step,
}) {
  const days = daysInYear(recap.year);
  const grid = useMemo(
    () => buildYearHeat(recap.year, recap.dayHeat || []),
    [recap.year, recap.dayHeat]
  );
  const heatW = BODY_W - 24; // cam kart iç boşluğu
  const pitch = heatW / grid.cols;
  const fav = recap.favoriteWeekday;
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="calendar-check"
    >
      <Kicker step={step}>{str.consistencyTitle}</Kicker>
      <Reveal delay={150}>
        <View style={rowStyles.headlineCompact}>
          <RollingNumber
            value={recap.activeDays}
            format={(n) => formatNumber(n, language)}
            style={shared.bigNumber}
          />
        </View>
      </Reveal>
      <Reveal delay={260}>
        <Text style={consistencyStyles.sub} allowFontScaling={false}>
          {str.cardActiveDays} {fill(str.consistencyOutOf, days)}
        </Text>
      </Reveal>

      <Reveal delay={380} style={{ marginTop: 18 }}>
        <GlassCard radius={22} style={consistencyStyles.heatCard}>
          <YearHeat
            year={recap.year}
            dayHeat={recap.dayHeat || []}
            width={heatW}
            color={WHITE}
            trackColor="rgba(255,255,255,0.12)"
          />
          <View style={{ height: 12, marginTop: 6 }}>
            {grid.monthCols.map((col, i) => (
              <Text
                key={i}
                style={[consistencyStyles.monthTick, { left: col * pitch }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {monthName(i, language).slice(0, 3)}
              </Text>
            ))}
          </View>
          <View style={consistencyStyles.legend}>
            <Text style={consistencyStyles.legendText} allowFontScaling={false}>
              {str.legendLess}
            </Text>
            {[0, 0.3, 0.52, 0.76, 1].map((o, i) => (
              <View
                key={i}
                style={[
                  consistencyStyles.legendCell,
                  { backgroundColor: i === 0 ? "rgba(255,255,255,0.12)" : `rgba(255,255,255,${o})` },
                ]}
              />
            ))}
            <Text style={consistencyStyles.legendText} allowFontScaling={false}>
              {str.legendMore}
            </Text>
          </View>
        </GlassCard>
      </Reveal>

      <Reveal delay={540} style={{ marginTop: 12 }}>
        <View style={consistencyStyles.boxes}>
          <GlassCard radius={18} strong style={consistencyStyles.box}>
            <View style={consistencyStyles.boxIcon}>
              <MaterialCommunityIcons name="fire" size={16} color={WHITE} />
            </View>
            <Text style={shared.eyebrow} allowFontScaling={false} numberOfLines={1}>
              {str.consistencyStreakLabel}
            </Text>
            <View style={consistencyStyles.boxValueRow}>
              <Text style={consistencyStyles.boxValue} allowFontScaling={false}>
                {formatNumber(recap.longestStreak, language)}
              </Text>
              <Text style={consistencyStyles.boxUnit} allowFontScaling={false} numberOfLines={1}>
                {str.consistencyStreakUnit}
              </Text>
            </View>
          </GlassCard>
          {fav != null && (
            <GlassCard radius={18} strong style={consistencyStyles.box}>
              <View style={consistencyStyles.boxIcon}>
                <MaterialCommunityIcons name="calendar-heart" size={16} color={WHITE} />
              </View>
              <Text style={shared.eyebrow} allowFontScaling={false} numberOfLines={1}>
                {str.consistencyFavDay}
              </Text>
              <Text
                style={consistencyStyles.boxValueText}
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {weekdayName(fav, language)}
              </Text>
            </GlassCard>
          )}
        </View>
      </Reveal>
    </WrappedSlideFrame>
  );
});

const consistencyStyles = StyleSheet.create({
  sub: { color: "rgba(255,255,255,0.84)", fontSize: 17, fontWeight: "800", marginTop: 2 },
  heatCard: { padding: 12 },
  monthTick: {
    position: "absolute",
    top: 0,
    color: "rgba(255,255,255,0.55)",
    fontSize: 8.5,
    fontWeight: "800",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 10,
  },
  legendText: { color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: "700", marginHorizontal: 3 },
  legendCell: { width: 10, height: 10, borderRadius: 3 },
  boxes: { flexDirection: "row", gap: 12 },
  box: { flex: 1, padding: 14 },
  boxIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  boxValueRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 4 },
  boxValue: { color: WHITE, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  boxUnit: { color: "rgba(255,255,255,0.78)", fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  boxValueText: { color: WHITE, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, marginTop: 4 },
});

// ─── 9) Kişilik ──────────────────────────────────────────────────────────────

export const PersonalitySlide = memo(function PersonalitySlide({
  recap,
  str,
  topInset,
  accent,
  step,
}) {
  const genres = (recap.topGenres || []).slice(0, 3);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <WrappedSlideFrame
      accent={accent}
      topInset={topInset}
      motifIcon="account-star"
    >
      <Kicker step={step}>{str.personalityTitle}</Kicker>
      <Reveal delay={180}>
        <View style={personalityStyles.emojiWrap}>
          <Animated.View
            style={[
              personalityStyles.halo,
              { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
            ]}
          />
          <View style={personalityStyles.haloInner} />
          <Text style={personalityStyles.emoji} allowFontScaling={false}>
            {recap.personality?.emoji}
          </Text>
        </View>
      </Reveal>
      <Reveal delay={320}>
        <Text style={personalityStyles.title} allowFontScaling={false}>
          {recap.personality?.title}
        </Text>
      </Reveal>
      {recap.personality?.desc ? (
        <Reveal delay={420}>
          <Text style={personalityStyles.desc}>{recap.personality.desc}</Text>
        </Reveal>
      ) : null}
      {genres.length > 0 && (
        <Reveal delay={540} style={{ marginTop: 22 }}>
          <Text style={shared.eyebrow} allowFontScaling={false}>
            {str.personalityTopGenres}
          </Text>
          <View style={personalityStyles.chips}>
            {genres.map((g, i) => (
              <View key={`${g.genre}-${i}`} style={[personalityStyles.chip, i === 0 && personalityStyles.chipTop]}>
                <Text
                  style={[personalityStyles.chipText, i === 0 && { color: "#000" }]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {g.genre}
                </Text>
              </View>
            ))}
          </View>
        </Reveal>
      )}
    </WrappedSlideFrame>
  );
});

const personalityStyles = StyleSheet.create({
  emojiWrap: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  halo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    borderStyle: "dashed",
  },
  haloInner: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  emoji: { fontSize: 72, lineHeight: 88 },
  title: {
    color: WHITE,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  desc: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
    marginTop: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    maxWidth: "100%",
  },
  chipTop: { backgroundColor: WHITE, borderColor: WHITE },
  chipText: { color: WHITE, fontSize: 13.5, fontWeight: "800" },
});

const styles = StyleSheet.create({
  orbWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
