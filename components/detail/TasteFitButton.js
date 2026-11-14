// components/detail/TasteFitButton.js
//
// Film/dizi detayında "Zevk uyumunu değerlendir" düğmesi. Basılınca DÜĞMENİN YERİNDE:
//   boşta (kalp atışı + ara ara ışık süpürmesi)
//   → yükleniyor: kart "hesaplıyor" — ters dönen yaylı küre, karışan rakamlar, nefes alan çerçeve,
//     sürekli ışık süpürmesi, adım metni + ilerleme çubuğu, kütüphane sayaçları 0'dan sayar
//   → sıkışma (küre dolar, kart %95'e iner) → PATLAMA (parlama, iki şok dalgası, 24 parçacık, titreşim)
//   → sonuç yaylanarak taşar: halka fırlar ve yüzdeyi sayar, karar ikonu döner, metin kayarak gelir.
// Sonuç satırına dokununca ayrıntılar aynı kartın içinde aşağı açılır (bileşen çubukları, içgörüler,
// izlediğin benzer yapımlar). Hesap saf modülde: utils/titleTasteFit.js; metinler utils/titleTasteFitCopy.js.
//
// Veri cihazdaki ListStatusContext'ten okunur (ek Firestore okuması YOK). Hesap anlıktır; yükleme
// animasyonu kısa bir sahnedir (MIN_LOADING_MS) ve liste verisi henüz inmediyse onu da bekler.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "@theme/colors";
import { useLanguage } from "../../context/LanguageContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import usePosterUri from "../../hooks/usePosterUri";
import { computeTitleTasteFit } from "../../utils/titleTasteFit";
import { getTitleTasteFitCopy, insightText } from "../../utils/titleTasteFitCopy";
import { GENRE_LABELS } from "../../utils/genreDisplay";
import { copyLanguage } from "../../utils/appLanguages";
import { haptic } from "../../services/hapticsService";

export const MIN_LOADING_MS = 2300;
const STEP_MS = 420;
const RING = 50;
const RING_STROKE = 5;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const TIER_COLORS = Object.freeze({
  love: "#FF4D8D",
  like: "#3CCB9A",
  maybe: "#5A9CF8",
  mixed: "#F5A524",
  skip: "#EF6A5A",
});
const TIER_ICONS = Object.freeze({
  love: "heart",
  like: "thumbs-up",
  maybe: "sparkles",
  mixed: "help-circle",
  skip: "thumbs-down",
});
const TONE_ICONS = Object.freeze({ pos: "add-circle", neg: "remove-circle", neutral: "ellipse" });
const PART_ICONS = Object.freeze({
  predicted: "star-outline",
  genres: "pricetags-outline",
  recent: "trending-up-outline",
  genreRate: "star-half-outline",
  combo: "git-merge-outline",
  likes: "heart-outline",
  avoid: "shield-checkmark-outline",
  similar: "albums-outline",
  interest: "bookmark-outline",
  format: "film-outline",
  runtime: "time-outline",
  public: "people-outline",
});
export const LOW_DATA_COLOR = "#F5A524";

const ORB_LOOP_MS = 2400;
const SQUEEZE_MS = 240;
const BURST_MS = 1000;
// Patlama merkezi = sonuç halkasının ortası (kabuk yatay dolgusu 12 + halka yarıçapı; satır 64 yüksek).
const BURST_X = 12 + RING / 2;
const BURST_Y = 32;
const SPARK_GOLD = "#FFC94D";

/** Patlama parçacıkları: deterministik (her seferinde aynı desen), çoğu sağa — kart solda kırpar. */
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2 + (((i * 37) % 11) / 11) * 0.45;
  const dist = 38 + ((i * 53) % 8) * 17;
  let dx = Math.cos(angle) * dist * 1.7;
  if (dx < 0) dx *= 0.32;
  const dy = Math.sin(angle) * Math.min(dist, 34) * 0.9;
  return {
    dx,
    dy,
    fall: 10 + (i % 4) * 5,
    size: 4 + (i % 4) * 1.6,
    kind: i % 6 === 0 ? "heart" : i % 6 === 3 ? "star" : i % 2 ? "dot" : "spark",
    spin: `${(i % 2 ? 1 : -1) * (140 + ((i * 29) % 220))}deg`,
    color: i % 4,
    lag: (i % 3) * 0.05,
  };
});

/** Basit zamanlayıcı: her `ms`'de bir artan sayaç (yalnız onu kullanan küçük bileşeni yeniden çizer). */
function useTicker(ms) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

/** Kartın üstünden geçen çapraz ışık süpürmesi. */
function Sheen({ width, duration, pause, strength = 0.16 }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const steps = [Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true })];
    if (pause) steps.push(Animated.delay(pause));
    const a = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }), ...steps]));
    a.start();
    return () => a.stop();
  }, [t, duration, pause]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheenClip]}>
      <Animated.View
        style={[
          styles.sheen,
          { transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-110, width + 20] }) }, { skewX: "-20deg" }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0)", `rgba(255,255,255,${strength})`, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Ortadaki "hesaplanan" yüzde: rakamlar slot makinesi gibi karışır. */
function ShuffleDigits({ color }) {
  const tick = useTicker(70);
  const n = ((tick * 47 + 13) % 89) + 10;
  return (
    <Text allowFontScaling={false} style={[styles.orbDigits, { color }]}>
      {n}
    </Text>
  );
}

/** Hesaplama küresi: ters dönen iki yay + yörüngede üç uydu + karışan rakamlar. */
function ComputeOrb({ tone, alt, track, charge }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: ORB_LOOP_MS, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [spin]);
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const r2 = r - 7;
  const c2 = 2 * Math.PI * r2;
  const rot = (deg) => ({ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", deg] }) }] });
  return (
    <Animated.View style={[styles.ring, { transform: [{ scale: charge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }]}>
      <Animated.View
        style={[styles.orbGlow, { backgroundColor: tone, opacity: charge.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.45] }) }]}
      />
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, rot("1080deg")]}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={tone}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * 0.3} ${c}`}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, rot("-540deg")]}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r2}
            stroke={alt}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c2 * 0.18} ${c2 * 0.12}`}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, rot("360deg")]}>
        {[0, 120, 240].map((deg, i) => (
          <View key={deg} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${deg}deg` }] }]}>
            <View style={[styles.satellite, { backgroundColor: i === 0 ? SPARK_GOLD : i === 1 ? alt : tone }]} />
          </View>
        ))}
      </Animated.View>
      <ShuffleDigits color={tone} />
    </Animated.View>
  );
}

/** Yükleme sırasında kütüphane sayılarını 0'dan sayarak "tarar". */
function ScanCounters({ watched, rated, likes, color, muted }) {
  const startedAt = useRef(Date.now()).current;
  useTicker(80);
  const p = Math.min(1, Math.max(0, (Date.now() - startedAt) / (MIN_LOADING_MS * 0.85)));
  const e = 1 - Math.pow(1 - p, 3);
  const items = [
    ["film", Math.round(watched * e)],
    ["star", Math.round(rated * e)],
    ["heart", Math.round(likes * e)],
  ];
  return (
    <View style={styles.counters}>
      {items.map(([icon, n]) => (
        <View key={icon} style={styles.counter}>
          <Ionicons name={icon} size={9} color={muted} />
          <Text allowFontScaling={false} style={[styles.counterText, { color }]}>
            {n}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Sonuç anındaki patlama: parlama + iki şok dalgası + yıldız çakması + saçılan parçacıklar. */
function BurstLayer({ tone, palette, onDone }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(t, { toValue: 1, duration: BURST_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => a.stop();
  }, [t, onDone]);
  const wave = (from, to, peak) => ({
    opacity: t.interpolate({ inputRange: [from, from + 0.02, to], outputRange: [0, peak, 0], extrapolate: "clamp" }),
    transform: [{ scale: t.interpolate({ inputRange: [from, to], outputRange: [0.3, 8], extrapolate: "clamp" }) }],
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tone, opacity: t.interpolate({ inputRange: [0, 0.06, 0.4], outputRange: [0.5, 0.28, 0], extrapolate: "clamp" }) },
        ]}
      />
      <Animated.View style={[styles.wave, { borderColor: tone }, wave(0, 0.55, 0.95)]} />
      <Animated.View style={[styles.wave, styles.waveThin, { borderColor: "#FFFFFF" }, wave(0.08, 0.7, 0.6)]} />
      <Animated.View
        style={[
          styles.flare,
          {
            opacity: t.interpolate({ inputRange: [0, 0.12, 0.45], outputRange: [0, 1, 0], extrapolate: "clamp" }),
            transform: [
              { scale: t.interpolate({ inputRange: [0, 0.15, 0.45], outputRange: [0.2, 1.7, 0.4], extrapolate: "clamp" }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "200deg"] }) },
            ],
          },
        ]}
      >
        <Ionicons name="sparkles" size={30} color="#FFFFFF" />
      </Animated.View>
      {PARTICLES.map((pt, i) => {
        const s = pt.lag;
        const color = palette[pt.color % palette.length];
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                opacity: t.interpolate({ inputRange: [s, s + 0.04, 0.72, 1], outputRange: [0, 1, 0.9, 0], extrapolate: "clamp" }),
                transform: [
                  { translateX: t.interpolate({ inputRange: [s, 0.75], outputRange: [0, pt.dx], extrapolate: "clamp" }) },
                  { translateY: t.interpolate({ inputRange: [s, 0.6, 1], outputRange: [0, pt.dy, pt.dy + pt.fall], extrapolate: "clamp" }) },
                  { scale: t.interpolate({ inputRange: [s, s + 0.12, 1], outputRange: [0.2, 1.3, 0.5], extrapolate: "clamp" }) },
                  { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", pt.spin] }) },
                ],
              },
            ]}
          >
            {pt.kind === "heart" || pt.kind === "star" ? (
              <Ionicons name={pt.kind} size={pt.size + 5} color={color} />
            ) : (
              <View
                style={
                  pt.kind === "dot"
                    ? { width: pt.size, height: pt.size, borderRadius: pt.size / 2, backgroundColor: color }
                    : { width: pt.size * 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color }
                }
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Boştaki düğmenin ikonunda çift vuruşlu kalp atışı. */
function HeartBeat({ color }) {
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const up = (v, d) => Animated.timing(beat, { toValue: v, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const a = Animated.loop(Animated.sequence([up(1, 140), up(0.3, 120), up(1, 140), up(0, 260), Animated.delay(1700)]));
    a.start();
    return () => a.stop();
  }, [beat]);
  return (
    <Animated.View style={{ transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
      <Ionicons name="heart-half" size={20} color={color} />
    </Animated.View>
  );
}

/** Sonuç halkası: yay ve yüzde birlikte 0'dan sayarak dolar. */
function ScoreRing({ score, tone, track, pct }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    progress.setValue(0);
    const id = progress.addListener(({ value }) => setShown(Math.round(value * score)));
    const anim = Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => {
      anim.stop();
      progress.removeListener(id);
    };
  }, [progress, score]);
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={tone}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [c, c * (1 - score / 100)] })}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text allowFontScaling={false} style={[styles.ringValue, { color: tone }]}>
        {pct(shown)}
      </Text>
    </View>
  );
}

function PartBar({ label, icon, value, tone, theme }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: value, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, value]);
  return (
    <View style={styles.partRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={14} color={theme.text.muted} />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.partLabel, { color: theme.text.secondary || theme.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.partTrack, { backgroundColor: alpha(theme.border, 0.9) }]}>
        <Animated.View
          style={[
            styles.partFill,
            {
              backgroundColor: tone,
              width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
            },
          ]}
        />
      </View>
      <Text allowFontScaling={false} style={[styles.partValue, { color: theme.text.primary }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} props.theme
 * @param {"movie"|"tv"} props.type
 * @param {object} props.details TMDB detay nesnesi (genres, runtime/episode_run_time, vote_average, vote_count)
 * @param {Array<{id:number}>} [props.similar] TMDB önerilen yapımlar (aynı tür)
 */
function TasteFitButton({ theme, type, details, similar }) {
  const { language } = useLanguage();
  const copy = getTitleTasteFitCopy(language);
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de", "it", "fr", "ja"]);
  const lists = useListStatusContext() || {};
  const posterUri = usePosterUri();

  const [phase, setPhase] = useState("idle"); // idle | loading | result
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [cardWidth, setCardWidth] = useState(320);
  const progress = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(1)).current;
  // squeeze: kart ölçeği (yükleme sonunda sıkışır, sonuçta yaylanarak taşar); pop: halka + karar ikonu fırlaması;
  // charge: sonuçtan hemen önce kürenin "dolması".
  const squeeze = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const charge = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const finishing = useRef(false);
  const onLayout = useCallback((e) => {
    const w = Math.round(e?.nativeEvent?.layout?.width || 0);
    if (w > 0) setCardWidth((prev) => (prev === w ? prev : w));
  }, []);
  const endBurst = useCallback(() => setBursting(false), []);

  const dataReady = !lists.loading && lists.watchedTvLoaded !== false;
  const accent = theme.colors?.pink || "#FF4D8D";

  // Başka bir yapıma geçilince (aynı ekran örneği yeniden kullanılırsa) baştan başla.
  const mediaId = details?.id;
  useEffect(() => {
    setPhase("idle");
    setResult(null);
    setExpanded(false);
    setBursting(false);
  }, [mediaId, type]);

  const libCounts = useMemo(
    () => ({
      watched: (lists.watchedMoviesItems || []).length + Object.keys(lists.watchedTvMap || {}).length,
      rated: Object.keys(lists.activityIndex?.ratings || {}).length,
      likes: (lists.favoritesItems || []).length,
    }),
    [lists.watchedMoviesItems, lists.watchedTvMap, lists.activityIndex, lists.favoritesItems],
  );

  const compute = useCallback(() => {
    const runtime = type === "movie" ? details?.runtime : (details?.episode_run_time || [])[0];
    return computeTitleTasteFit({
      target: {
        type,
        id: details?.id,
        genres: details?.genres || [],
        runtime,
        voteAverage: details?.vote_average,
        voteCount: details?.vote_count,
        similar: similar || [],
      },
      library: {
        watchedMovies: lists.watchedMoviesItems || [],
        watchedShows: Object.values(lists.watchedTvMap || {}),
        watchList: lists.watchListItems || [],
        favorites: lists.favoritesItems || [],
        ratings: lists.activityIndex?.ratings || {},
      },
    });
  }, [type, details, similar, lists.watchedMoviesItems, lists.watchedTvMap, lists.watchListItems, lists.favoritesItems, lists.activityIndex]);

  // Yükleme sahnesi: adım metni döner, çubuk dolar.
  useEffect(() => {
    if (phase !== "loading") return undefined;
    setStep(0);
    progress.setValue(0);
    charge.setValue(0);
    glow.setValue(0);
    const bar = Animated.timing(progress, { toValue: 1, duration: MIN_LOADING_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    bar.start();
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    breathe.start();
    const timer = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    const ticker = setInterval(() => {
      Animated.sequence([
        Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(stepFade, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setStep((s) => Math.min(s + 1, copy.loading.length - 1)), 120);
    }, STEP_MS);
    return () => {
      bar.stop();
      breathe.stop();
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [phase, progress, stepFade, charge, glow, copy.loading.length]);

  // Süre doldu + veri hazır → küre dolar, kart sıkışır; ardından PATLAMA ve sonuç yaylanarak açılır.
  useEffect(() => {
    if (phase !== "loading" || !minElapsed || !dataReady || finishing.current) return undefined;
    finishing.current = true;
    const next = compute();
    const windUp = Animated.parallel([
      Animated.timing(charge, { toValue: 1, duration: SQUEEZE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(squeeze, { toValue: 0.95, duration: SQUEEZE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    windUp.start(({ finished } = {}) => {
      // Yarıda durdurulduysa (bağımlılık değişti / ekran kapandı) sonucu basma; etki yeniden kurulur.
      if (!finished) return;
      finishing.current = false;
      const okNext = next?.state === "ok";
      setResult(next);
      reveal.setValue(0);
      pop.setValue(okNext ? 0 : 1);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPhase("result");
      setBursting(okNext);
      if (okNext) haptic(next.tier === "love" ? "match" : "success");
      Animated.parallel([
        Animated.spring(squeeze, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4.5, tension: 120, useNativeDriver: true }),
        Animated.timing(reveal, { toValue: 1, duration: 420, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return () => {
      windUp.stop();
      finishing.current = false;
    };
  }, [phase, minElapsed, dataReady, compute, reveal, charge, squeeze, pop]);

  const start = useCallback(() => {
    haptic("press");
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    setBursting(false);
    squeeze.setValue(1);
    // Önceki turdan kalan "süre doldu" bayrağı aynı commit'te sonucu hemen getirmesin.
    setMinElapsed(false);
    setPhase("loading");
  }, [squeeze]);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, []);

  const genreLabel = useCallback((id) => GENRE_LABELS[id]?.[lang] || id, [lang]);

  const ok = result?.state === "ok";
  const tone = ok ? TIER_COLORS[result.tier] : accent;
  const track = alpha(theme.border, 0.95);

  const insights = useMemo(
    () => (ok ? result.insights.map((ins) => ({ ...ins, text: insightText(copy, ins, genreLabel) })).filter((i) => i.text) : []),
    [ok, result, copy, genreLabel],
  );

  const purple = theme.colors?.purple || "#A77BFF";
  const wrap = (body) => (
    <Animated.View onLayout={onLayout} style={{ transform: [{ scale: squeeze }] }}>
      {body}
    </Animated.View>
  );

  // ── Boşta: eski "İnceleme" düğmesiyle aynı ölçüde öne çıkan düğme; ara ara üstünden ışık geçer ──
  if (phase === "idle") {
    return wrap(
      <GlassTouchable
        activeOpacity={0.88}
        onPress={start}
        accessibilityRole="button"
        accessibilityLabel={`${copy.button.title}. ${copy.button.subtitle}`}
        style={[styles.shell, { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.38) }]}
      >
        <Sheen width={cardWidth} duration={1100} pause={2600} strength={0.13} />
        <View style={styles.row}>
          <LinearGradient
            colors={[alpha(accent, 0.32), alpha(purple, 0.26)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <HeartBeat color={accent} />
          </LinearGradient>
          <View style={styles.copy}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: theme.text.primary }]}>
              {copy.button.title}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { color: theme.text.muted }]}>
              {copy.button.subtitle}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={17} color={accent} />
        </View>
      </GlassTouchable>,
    );
  }

  // ── Yükleniyor: kart "hesap makinesine" döner — küre, ışık süpürmesi, nefes alan çerçeve, sayaçlar ──
  if (phase === "loading") {
    return wrap(
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={copy.loading[step]}
        style={[styles.shell, styles.clip, { backgroundColor: alpha(accent, 0.08), borderColor: alpha(accent, 0.3) }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(accent, 0.16), alpha(purple, 0.1), alpha(theme.colors?.blue || "#5A9CF8", 0.06)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Sheen width={cardWidth} duration={900} pause={150} strength={0.2} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowFrame,
            {
              borderColor: accent,
              opacity: Animated.add(
                glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.75] }),
                charge.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
              ),
            },
          ]}
        />
        <View style={styles.row}>
          <ComputeOrb tone={accent} alt={purple} track={track} charge={charge} />
          <View style={styles.copy}>
            <Animated.Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.loadingText, { color: theme.text.primary, opacity: stepFade }]}
            >
              {copy.loading[step]}…
            </Animated.Text>
            <View style={[styles.loadTrack, { backgroundColor: track }]}>
              <Animated.View
                style={[styles.loadFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["4%", "100%"] }) }]}
              >
                <LinearGradient
                  colors={[accent, purple, theme.colors?.blue || "#5A9CF8"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.loadHead, { backgroundColor: "#FFFFFF" }]} />
              </Animated.View>
            </View>
            <View style={styles.loadFoot}>
              <View style={styles.dots}>
                {copy.loading.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === step && styles.dotActive,
                      { backgroundColor: i <= step ? accent : alpha(theme.text.muted, 0.35) },
                    ]}
                  />
                ))}
              </View>
              <ScanCounters
                watched={libCounts.watched}
                rated={libCounts.rated}
                likes={libCounts.likes}
                color={theme.text.primary}
                muted={theme.text.muted}
              />
            </View>
          </View>
        </View>
      </View>,
    );
  }

  // ── Sonuç: veri yetersiz ──
  if (!ok) {
    return wrap(
      <View style={[styles.shell, { backgroundColor: alpha(theme.secondary, 0.6), borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
            <Ionicons name="hourglass-outline" size={19} color={theme.text.muted} />
          </View>
          <Text allowFontScaling={false} style={[styles.insufficient, { color: theme.text.secondary || theme.text.primary }]}>
            {copy.insufficient(result?.needed || 5)}
          </Text>
          <Pressable hitSlop={10} onPress={start} accessibilityRole="button" accessibilityLabel={copy.again}>
            <Ionicons name="refresh" size={18} color={theme.text.muted} />
          </Pressable>
        </View>
      </View>,
    );
  }

  // ── Sonuç: patlama katmanı + yaylanan halka, fırlayan karar ikonu, kayarak gelen metin ──
  return wrap(
    <View
      style={[
        styles.shell,
        styles.resultShell,
        styles.clip,
        { backgroundColor: alpha(tone, 0.09), borderColor: alpha(tone, 0.42) },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(tone, 0.2), alpha(tone, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.75, y: 0.5 }}
        style={styles.resultTint}
      />
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${copy.title}: ${copy.pct(result.score)}. ${copy.tiers[result.tier]}`}
        style={styles.row}
      >
        <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }] }}>
          <ScoreRing score={result.score} tone={tone} track={track} pct={copy.pct} />
        </Animated.View>
        <Animated.View
          style={[
            styles.copy,
            { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
          ]}
        >
          <View style={styles.verdictRow}>
            <Animated.View style={{ transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-40deg", "0deg"] }) }] }}>
              <Ionicons name={TIER_ICONS[result.tier]} size={14} color={tone} />
            </Animated.View>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.verdict, { color: theme.text.primary }]}>
              {copy.tiers[result.tier]}
            </Text>
          </View>
          {result.lowData && !expanded ? (
            <View style={styles.lowDataInline}>
              <Ionicons name="warning" size={11} color={LOW_DATA_COLOR} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, styles.lowDataInlineText, { color: LOW_DATA_COLOR }]}>
                {copy.lowDataShort}
              </Text>
            </View>
          ) : (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { color: theme.text.muted }]}>
              {copy.tierHints[result.tier]} · {copy.confidence[result.confidence]}
            </Text>
          )}
        </Animated.View>
        <Animated.View style={[styles.toggleChip, { backgroundColor: alpha(tone, 0.14), opacity: reveal }]}>
          <Text allowFontScaling={false} style={[styles.toggleText, { color: tone }]}>
            {expanded ? copy.hide : copy.details}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color={tone} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <View style={[styles.divider, { backgroundColor: alpha(tone, 0.25) }]} />

          {result.lowData ? (
            <View
              accessible
              accessibilityRole="alert"
              style={[styles.lowDataBox, { backgroundColor: alpha(LOW_DATA_COLOR, 0.12), borderColor: alpha(LOW_DATA_COLOR, 0.35) }]}
            >
              <Ionicons name="warning-outline" size={15} color={LOW_DATA_COLOR} />
              <Text allowFontScaling={false} style={[styles.lowDataText, { color: theme.text.primary }]}>
                {copy.lowData}
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryRow}>
            {result.predictedRating != null ? (
              <View style={[styles.predictBox, { backgroundColor: alpha(tone, 0.12) }]}>
                <Ionicons name="star" size={13} color="#FFC94D" />
                <Text allowFontScaling={false} style={[styles.predictValue, { color: theme.text.primary }]}>
                  {result.predictedRating}
                  <Text style={[styles.predictMax, { color: theme.text.muted }]}>/10</Text>
                </Text>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.predictLabel, { color: theme.text.muted }]}>
                  {copy.predictedLabel}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryCopy}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.summaryConfidence, { color: tone }]}>
                {copy.confidence[result.confidence]}
              </Text>
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.summaryStats, { color: theme.text.muted }]}>
                {copy.analyzed(result.stats.watched, result.stats.rated, result.stats.likes)}
              </Text>
            </View>
          </View>

          <View style={styles.parts}>
            {result.breakdown.map((part) => (
              <PartBar
                key={part.id}
                label={copy.parts[part.id]}
                icon={PART_ICONS[part.id]}
                value={part.score}
                tone={tone}
                theme={theme}
              />
            ))}
          </View>

          {insights.length > 0 ? (
            <View style={styles.insights}>
              {insights.map((ins) => (
                <View key={ins.kind} style={styles.insightRow}>
                  <Ionicons
                    name={TONE_ICONS[ins.tone]}
                    size={ins.tone === "neutral" ? 7 : 14}
                    color={ins.tone === "pos" ? TIER_COLORS.like : ins.tone === "neg" ? TIER_COLORS.skip : theme.text.muted}
                    style={ins.tone === "neutral" ? styles.neutralDot : null}
                  />
                  <Text allowFontScaling={false} style={[styles.insightText, { color: theme.text.secondary || theme.text.primary }]}>
                    {ins.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {result.similarWatched.length > 0 ? (
            <View>
              <Text allowFontScaling={false} style={[styles.sectionLabel, { color: theme.text.muted }]}>
                {copy.similarTitle}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {result.similarWatched.map((item) => (
                  <View key={item.key} style={[styles.thumb, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                    {item.imagePath ? (
                      <Image source={{ uri: posterUri(item.type, item.id, item.imagePath) }} style={styles.thumbImage} contentFit="cover" />
                    ) : null}
                    {item.rating != null ? (
                      <View style={styles.thumbChip}>
                        <Ionicons name="star" size={8} color="#FFC94D" />
                        <Text allowFontScaling={false} style={styles.thumbChipText}>
                          {item.rating}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Pressable onPress={start} hitSlop={8} accessibilityRole="button" style={styles.againBtn}>
            <Ionicons name="refresh" size={13} color={theme.text.muted} />
            <Text allowFontScaling={false} style={[styles.againText, { color: theme.text.muted }]}>
              {copy.again}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {bursting ? <BurstLayer tone={tone} palette={[tone, accent, SPARK_GOLD, "#FFFFFF"]} onDone={endBurst} /> : null}
    </View>,
  );
}

export default memo(TasteFitButton);

const styles = StyleSheet.create({
  // Cam düğmenin kendi stilinde overflow:hidden OLMAZ (basma payı kırpılır; bkz. glassPressRoom testi).
  shell: { minHeight: 64, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  clip: { overflow: "hidden" },
  resultShell: { paddingVertical: 0 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11 },
  iconBox: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  subtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 13, fontWeight: "900", letterSpacing: -0.4 },
  loadingText: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.1 },
  loadTrack: { height: 5, borderRadius: 3, marginTop: 7, overflow: "hidden" },
  loadFill: { height: 5, borderRadius: 3, overflow: "hidden" },
  loadHead: { position: "absolute", right: 0, top: 0, bottom: 0, width: 6, borderRadius: 3, opacity: 0.85 },
  loadFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 8 },
  dots: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotActive: { width: 12 },
  counters: { flexDirection: "row", alignItems: "center", gap: 8 },
  counter: { flexDirection: "row", alignItems: "center", gap: 2.5 },
  counterText: { fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"], minWidth: 12 },
  orbDigits: { fontSize: 12.5, fontWeight: "900", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  orbGlow: { position: "absolute", width: RING - 12, height: RING - 12, borderRadius: (RING - 12) / 2 },
  satellite: { position: "absolute", top: -1.5, left: RING / 2 - 2.5, width: 5, height: 5, borderRadius: 2.5 },
  glowFrame: { ...StyleSheet.absoluteFillObject, borderRadius: 20, borderWidth: 1.5 },
  sheenClip: { borderRadius: 20, overflow: "hidden" },
  sheen: { position: "absolute", top: -10, bottom: -10, width: 80 },
  resultTint: { position: "absolute", left: 0, top: 0, width: 160, height: 64 },
  wave: { position: "absolute", left: BURST_X - 22, top: BURST_Y - 22, width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  waveThin: { borderWidth: 1.5 },
  flare: { position: "absolute", left: BURST_X - 15, top: BURST_Y - 15, width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  particle: { position: "absolute", left: BURST_X - 8, top: BURST_Y - 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  verdict: { flexShrink: 1, fontSize: 15.5, fontWeight: "900", letterSpacing: -0.3 },
  toggleChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11 },
  toggleText: { fontSize: 10.5, fontWeight: "800" },
  insufficient: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17, paddingVertical: 10 },
  details: { paddingBottom: 12 },
  lowDataInline: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  lowDataInlineText: { marginTop: 0, flexShrink: 1 },
  lowDataBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 12, padding: 9, marginBottom: 12 },
  lowDataText: { flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 13 },
  predictBox: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  predictValue: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  predictMax: { fontSize: 10, fontWeight: "700" },
  predictLabel: { fontSize: 10, fontWeight: "700", maxWidth: 90 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryConfidence: { fontSize: 11.5, fontWeight: "800" },
  summaryStats: { fontSize: 10.5, fontWeight: "600", marginTop: 2, lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  parts: { gap: 9 },
  partRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  partLabel: { width: 118, fontSize: 11.5, fontWeight: "700" },
  partTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  partFill: { height: 6, borderRadius: 3 },
  partValue: { width: 26, textAlign: "right", fontSize: 11.5, fontWeight: "800" },
  insights: { marginTop: 14, gap: 7 },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  neutralDot: { marginTop: 5, marginHorizontal: 3.5 },
  insightText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  sectionLabel: { marginTop: 14, marginBottom: 7, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  thumbs: { gap: 7, paddingRight: 4 },
  thumb: { width: 46, height: 69, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  thumbChip: {
    position: "absolute",
    left: 3,
    bottom: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  thumbChipText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "800" },
  againBtn: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 },
  againText: { fontSize: 11, fontWeight: "700" },
});
