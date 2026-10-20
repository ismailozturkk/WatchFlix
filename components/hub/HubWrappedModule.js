// components/hub/HubWrappedModule.js
//
// Hub sekmesindeki Seelogd Wrapped & Yıllık Arşiv modülü.
//
// İki parça:
//   • Hero kart  — en son yılın toplam izleme süresi (sayaç animasyonu), geçen
//     yılla kıyas, gerçek aylık dağılım grafiği, tek satırlık kompakt rakam şeridi
//     (film / dizi / bölüm / aktif gün / en uzun seri), izleyici kişiliği +
//     poster yelpazesi ve "Özetini gör" CTA'sı. Eski sürümdeki sahte (süs)
//     çubuklar yerine kullanıcının kendi verisi çizilir. "En yoğun ay" ayrı bir
//     kutu değil: grafikteki zirve çubuğu + başlığı zaten onu anlatıyor.
//   • Yıllık arşiv — geçmiş yıllara giden satır + alt sayfa.
//
// Animasyon kuralları:
//   • Hepsi Reanimated (UI thread). Sürekli dönenler (orb, parıltı, ok) ve
//     giriş animasyonları ReduceMotion.System ile sistemin "Hareketi azalt"
//     ayarına uyar; sayaç da aynı ayar açıkken doğrudan son değere atlar.
//   • `revealed` false iken hiçbir şey başlamaz: modül ekranın alt yarısında
//     olduğundan giriş animasyonu kullanıcı kartı görünce oynamalı, mount
//     anında (ekran dışındayken) değil. HubScreen kaydırmayı izleyip bayrağı
//     açar; prop verilmezse modül kendi başına hemen oynar.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  ReduceMotion,
  FadeInDown,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import {
  buildYearlyRecap,
  formatNumber,
  getAvailableYears,
  getYearPace,
  getYearSummaries,
  minutesBreakdown,
  monthName,
} from "@utils/wrapped";
import { getWrappedStrings } from "@utils/wrappedStrings";
import { i18nText } from "@utils/i18nText";
import {
  canViewWrappedYear,
  pickViewableWrappedYear,
  requiredPlanForWrappedYear,
} from "@utils/premiumFeatures";
import { PREMIUM_PLAN, getPremiumPlanDisplayName } from "@utils/premium";
import { usePremiumGate } from "@hooks/usePremiumGate";
import useReduceMotion from "@hooks/useReduceMotion";
import { triggerHaptic } from "@services/hapticsService";
import GlassPressable from "../common/GlassPressable";

const RM = ReduceMotion.System;
const PRESS_SPRING = { mass: 0.4, damping: 12, stiffness: 180 };
const GOLD = "#FFD700";
const HERO_GRADIENT = ["#10061F", "#34136A", "#5E4BFF", "#A23BE8"];

const BAR_MIN = 4;
const BAR_MAX = 58;

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Kilitli yıl satırına gerçek özet verilmez (bkz. YearRow).
const LOCKED_YEAR_SUMMARY = Object.freeze({ movies: 0, episodes: 0, shows: 0, minutes: 0 });

// ─── Küçük yapı taşları ──────────────────────────────────────────────────────

function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => {
    scale.value = withSpring(to, PRESS_SPRING);
  }, [scale, to]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);
  return { style, onPressIn, onPressOut };
}

/** Görünür olunca aşağıdan süzülüp beliren sarmalayıcı (kademeli: `delay`). */
const Reveal = memo(function Reveal({ active, delay = 0, dy = 18, style, children }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    p.value = withDelay(
      delay,
      withSpring(1, { damping: 18, stiffness: 140, mass: 0.9, reduceMotion: RM }),
      RM,
    );
  }, [active, delay, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.4),
    transform: [{ translateY: (1 - p.value) * dy }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
});

/**
 * 0'dan hedef sayıya sayan metin. Durum bu bileşende tutulur → her karede
 * yalnız bu küçük <Text> yeniden çizilir, kart değil. Hareketi azalt açıkken
 * veya hedef 0 iken sayma yapılmaz.
 */
const CountUp = memo(function CountUp({
  value,
  active,
  reduceMotion,
  language,
  delay = 0,
  duration = 1100,
  style,
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (reduceMotion || value <= 0) {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, active, reduceMotion, delay, duration]);
  return (
    <Text style={style} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
      {formatNumber(shown, language)}
    </Text>
  );
});

/** Yumuşak, yavaşça süzülen ışık küresi (iç içe 3 halka = sahte radyal). */
const GlowOrb = memo(function GlowOrb({
  size,
  color,
  style,
  active,
  dx = 16,
  dy = 12,
  duration = 7000,
  delay = 0,
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    const cfg = { duration, easing: Easing.inOut(Easing.sin), reduceMotion: RM };
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, cfg), withTiming(0, cfg)), -1, false, undefined, RM),
      RM,
    );
  }, [active, duration, delay, t]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * dx },
      { translateY: t.value * dy },
      { scale: 1 + t.value * 0.1 },
    ],
  }));
  const ring = (inset, opacity) => ({
    position: "absolute",
    top: size * inset,
    left: size * inset,
    width: size * (1 - inset * 2),
    height: size * (1 - inset * 2),
    borderRadius: size,
    backgroundColor: color,
    opacity,
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size }, style, a]}
    >
      <View style={ring(0, 0.14)} />
      <View style={ring(0.2, 0.2)} />
      <View style={ring(0.36, 0.3)} />
    </Animated.View>
  );
});

/** Kartın üzerinden periyodik geçen çapraz parıltı bandı. */
const Sheen = memo(function Sheen({ width, active }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    t.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
          // Bant kartın sağında beklerken değer 1'de kalır; sonra sıfırlanır.
          withDelay(4200, withTiming(0, { duration: 0, reduceMotion: RM }), RM),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [active, t]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: -140 + t.value * (width + 280) }, { skewX: "-18deg" }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, a]}>
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.16)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

/** CTA okunun ileri-geri hafif itişi (dikkat çeker, rahatsız etmez). */
const NudgeArrow = memo(function NudgeArrow({ active }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    const cfg = { duration: 650, easing: Easing.inOut(Easing.quad), reduceMotion: RM };
    t.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(1, cfg),
          withTiming(0, cfg),
          // Bir sonraki itişe kadar dinlenir.
          withDelay(1600, withTiming(0, { duration: 0, reduceMotion: RM }), RM),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [active, t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 3.5 }] }));
  return (
    <Animated.View style={a}>
      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
    </Animated.View>
  );
});

// ─── Aylık mini grafik ───────────────────────────────────────────────────────

const ChartBar = memo(function ChartBar({ ratio, isPeak, index, active }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    p.value = withDelay(
      520 + index * 55,
      withSpring(1, { damping: 11, stiffness: 120, mass: 0.7, reduceMotion: RM }),
      RM,
    );
  }, [active, index, p]);
  const a = useAnimatedStyle(() => ({
    height: BAR_MIN + (BAR_MAX - BAR_MIN) * ratio * p.value,
  }));
  return (
    <Animated.View
      style={[styles.bar, ratio <= 0 && styles.barEmpty, isPeak && styles.barPeak, a]}
    />
  );
});

const MonthlyChart = memo(function MonthlyChart({ monthly, peakIndex, active }) {
  const max = Math.max(...monthly, 0);
  return (
    <View style={styles.chart}>
      {monthly.map((minutes, i) => (
        <ChartBar
          // Ay sırası sabit 12 öğe: indeks anahtarı burada doğru.
          key={i}
          index={i}
          active={active}
          ratio={max > 0 ? minutes / max : 0}
          isPeak={i === peakIndex}
        />
      ))}
    </View>
  );
});

// ─── Poster yelpazesi ────────────────────────────────────────────────────────

const FAN_ROT = { 1: [0], 2: [-7, 7], 3: [-10, 0, 10] };
const POSTER_W = 42;
const POSTER_H = 62;
const POSTER_STEP = 21;

const FanPoster = memo(function FanPoster({ uri, rot, left, lift, index, active, z }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    p.value = withDelay(
      650 + index * 90,
      withSpring(1, { damping: 12, stiffness: 110, mass: 0.8, reduceMotion: RM }),
      RM,
    );
  }, [active, index, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.5),
    transform: [
      // Merkezden açılır: başta üst üste, yay etkisiyle yelpaze olur.
      { translateX: (1 - p.value) * (POSTER_STEP * (1 - index)) },
      { translateY: lift * p.value },
      { rotate: `${rot * p.value}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.fanPoster, { left, zIndex: z }, a]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
    </Animated.View>
  );
});

const PosterFan = memo(function PosterFan({ paths, getTmdbUrl, active, emoji }) {
  const n = paths.length;
  if (n === 0) {
    return (
      <View style={styles.fanBox}>
        <View style={styles.emojiTile}>
          <Text style={styles.emojiTileText} allowFontScaling={false}>
            {emoji}
          </Text>
        </View>
      </View>
    );
  }
  const rots = FAN_ROT[n];
  const total = POSTER_W + (n - 1) * POSTER_STEP;
  const offset = (84 - total) / 2;
  return (
    <View style={styles.fanBox}>
      {paths.map((path, i) => (
        <FanPoster
          key={path}
          uri={getTmdbUrl ? getTmdbUrl(path, "poster", 200) : null}
          rot={rots[i]}
          left={offset + i * POSTER_STEP}
          lift={i === Math.floor((n - 1) / 2) ? 0 : 4}
          index={i}
          active={active}
          // Ortadaki poster en üstte: yelpaze derinlik kazanır.
          z={i === Math.floor((n - 1) / 2) ? 3 : 1}
        />
      ))}
    </View>
  );
});

// ─── Rakam şeridi hücresi ────────────────────────────────────────────────────

// Hero kartın (koyu gradyan) içinde durur: renkler kart temasından bağımsız,
// sabit açık tonlardır.
const HeroStat = memo(function HeroStat({
  icon,
  color,
  value,
  unit,
  label,
  active,
  delay,
  language,
  reduceMotion,
  first,
}) {
  return (
    <Reveal
      active={active}
      delay={delay}
      dy={10}
      style={[styles.statCell, !first && styles.statCellDivider, !value && styles.statCellEmpty]}
    >
      <View style={styles.statValueRow}>
        <Ionicons name={icon} size={11} color={color} />
        <View style={styles.statValueBox}>
          <CountUp
            value={value}
            active={active}
            reduceMotion={reduceMotion}
            language={language}
            delay={delay + 160}
            duration={900}
            style={styles.statValue}
          />
          {unit ? (
            <Text style={styles.statUnit} allowFontScaling={false} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        style={styles.statLabel}
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Reveal>
  );
});

// ─── Arşiv alt sayfasındaki yıl satırı ───────────────────────────────────────

const YearRow = memo(function YearRow({
  year,
  index,
  summary,
  maxMinutes,
  isLatest,
  locked,
  lockedPlanName,
  theme,
  str,
  onPress,
}) {
  // Kilitli yılın verisi (film/dizi/saat, çubuk) HİÇ gösterilmez: satır yalnız
  // "şu planla açılır" der. Veri kilidi açmadan önce sızmasın.
  const share = !locked && maxMinutes > 0 ? summary.minutes / maxMinutes : 0;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      180 + Math.min(index, 8) * 45,
      withTiming(share, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: RM }),
      RM,
    );
  }, [share, index, w]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, w.value * 100)}%` }));
  const press = usePressScale(0.98);
  const hours = Math.floor(summary.minutes / 60);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .springify()
        .damping(16)
        .reduceMotion(RM)}
    >
      <Animated.View style={press.style}>
        <GlassPressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${year} ${str.hubRecap}`}
          style={[
            styles.yearRow,
            {
              backgroundColor: isLatest ? theme.accent + "12" : theme.between,
              borderColor: isLatest ? theme.accent + "66" : theme.border,
            },
          ]}
        >
          <View
            style={[styles.yearBadge, { backgroundColor: isLatest ? theme.accent : theme.primary }]}
          >
            <Text
              style={[styles.yearBadgeText, { color: isLatest ? "#FFFFFF" : theme.text.primary }]}
              allowFontScaling={false}
            >
              {year}
            </Text>
          </View>

          <View style={styles.yearInfo}>
            <View style={styles.yearTitleRow}>
              <Text style={[styles.yearTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {year} {str.hubRecap}
              </Text>
              {isLatest && (
                <View style={[styles.latestBadge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.latestBadgeText}>{str.hubLatest}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.yearSub, { color: theme.text.muted }]} numberOfLines={1}>
              {locked
                ? str.hubArchiveLockedSub.replace("{plan}", lockedPlanName)
                : `${summary.movies} ${str.moviesShort} · ${summary.shows} ${str.hubShowsWord} · ${hours} ${str.hubHoursShort}`}
            </Text>
            <View style={[styles.yearTrack, { backgroundColor: theme.border }]}>
              {locked ? null : (
                <Animated.View style={[styles.yearFill, { backgroundColor: theme.accent }, barStyle]} />
              )}
            </View>
          </View>

          <View style={[styles.launchBtn, { backgroundColor: theme.accent }]}>
            <Text style={styles.launchBtnText}>{locked ? lockedPlanName : str.hubWatch}</Text>
            <Ionicons name={locked ? "diamond" : "play"} size={12} color="#FFFFFF" />
          </View>
        </GlassPressable>
      </Animated.View>
    </Animated.View>
  );
});

// ─── Modül ───────────────────────────────────────────────────────────────────

export default function HubWrappedModule({ navigation, revealed = true }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { listItems, flatEpisodesTv } = useProfileStats();
  const { getTmdbUrl } = useImageQualitySettings();
  const reduceMotion = useReduceMotion();

  const str = useMemo(() => getWrappedStrings(language), [language]);

  const movies = useMemo(
    () => (listItems || []).filter((m) => m?.type === "movie"),
    [listItems],
  );
  const episodes = flatEpisodesTv || [];

  const wrappedYears = useMemo(() => getAvailableYears(movies, episodes), [movies, episodes]);
  const latestWrappedYear = wrappedYears[0];

  // Wrapped arşivi: Free yalnız bu yılı, Premium son 5 yılı görür, Premium Max'te
  // sınır yok (bkz. utils/premiumFeatures.js `wrapped_archive`).
  const wrappedGate = usePremiumGate("wrapped_archive");
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);

  // Hero kart ve "yılın rakamları" planın görebildiği EN YENİ yılı anlatır. Veri
  // olan en yeni yıl kilitliyse (ör. Ocak'ta Free: bu yıl henüz kayıt yok) o yılın
  // rakamları kartta gösterilip dokununca yükseltme sayfasına düşülmesin diye
  // kart hiç çizilmez; arşiv satırı (kilitli yıllarla) kalır.
  const featuredYear = useMemo(
    () => pickViewableWrappedYear(wrappedYears, wrappedGate.plan),
    [wrappedYears, wrappedGate.plan],
  );

  const yearSummaries = useMemo(() => getYearSummaries(movies, episodes), [movies, episodes]);
  // Çubuk oranı yalnız açık yıllar arasında hesaplanır: kilitli bir yılın
  // büyüklüğü, açık yılların çubuğundan sezilmesin.
  const maxYearMinutes = useMemo(
    () =>
      Math.max(
        0,
        ...Object.entries(yearSummaries)
          .filter(([yr]) => canViewWrappedYear(yr, wrappedGate.plan))
          .map(([, s]) => s.minutes),
      ),
    [yearSummaries, wrappedGate.plan],
  );

  // Açık yıl yoksa boş özet kurulur (hero çizilmediği için gösterilmez; aşağıdaki
  // türetilmiş değerler null'a takılmasın diye).
  const recap = useMemo(
    () =>
      latestWrappedYear == null
        ? null
        : featuredYear == null
          ? buildYearlyRecap({ year: latestWrappedYear, language })
          : buildYearlyRecap({ movies, episodes, year: featuredYear, language }),
    [movies, episodes, latestWrappedYear, featuredYear, language],
  );
  const pace = useMemo(
    () =>
      featuredYear == null ? null : getYearPace({ movies, episodes, year: featuredYear }),
    [movies, episodes, featuredYear],
  );

  const hero = usePressScale(0.97);
  const archive = usePressScale(0.98);
  const [heroW, setHeroW] = useState(340);

  const openRecap = useCallback(
    (year) => {
      triggerHaptic("selection");
      navigation.navigate("WrappedScreen", { year, hideYearPicker: true });
    },
    [navigation],
  );

  // Kilitli yıla basılınca Premium sayfası arşiv KAPANIRKEN değil, kapandıktan
  // sonra açılmalı: ikisi de Modal ve iOS kapanmakta olanın üstüne ikincisini
  // sunamıyor (ekran kilitlenmiş gibi kalıyordu). İş burada bekletilir,
  // BottomSheetModal `onDismissed` ile pencere gerçekten kalkınca çalıştırılır.
  const afterArchiveRef = useRef(null);
  const openArchive = useCallback(() => {
    afterArchiveRef.current = null;
    triggerHaptic("selection");
    setArchiveModalVisible(true);
  }, []);
  const closeArchive = useCallback(() => setArchiveModalVisible(false), []);
  const onArchiveDismissed = useCallback(() => {
    const next = afterArchiveRef.current;
    afterArchiveRef.current = null;
    next?.();
  }, []);
  const onYearPress = useCallback(
    (year, locked) => {
      setArchiveModalVisible(false);
      if (locked) {
        afterArchiveRef.current = () => wrappedGate.showUpsell();
        return;
      }
      openRecap(year);
    },
    [openRecap, wrappedGate],
  );

  if (latestWrappedYear == null || !recap) {
    return null;
  }

  const active = revealed;
  const totalMin = recap.totalMinutes;
  const { hours, days } = minutesBreakdown(totalMin);
  const showMinutes = totalMin < 60;
  const heroValue = showMinutes ? totalMin : hours;
  const heroUnit = showMinutes ? str.minutes : str.hours;
  const approx =
    days >= 1 ? `≈ ${days} ${str.days} ${hours % 24} ${str.hubHoursShort}` : null;

  const delta = pace?.deltaPct;
  const deltaUp = delta != null && delta > 0;
  const deltaLabel =
    delta == null || delta === 0
      ? null
      : `${language === "tr" ? "%" : ""}${Math.min(999, Math.abs(delta))}${language === "tr" ? "" : "%"}`;

  const bm = recap.busiestMonth;
  const peakCaption = bm
    ? `${str.hubPeak} · ${cap(monthName(bm.month, language))}`
    : null;

  const topGenre = recap.topGenres[0]?.genre;
  const topShow = recap.topShows[0];
  const posterPaths = [
    ...recap.topShows.map((s) => s.showImage),
    ...recap.moviePosters.map((m) => m.imagePath),
  ]
    .filter(Boolean)
    .filter((p, i, all) => all.indexOf(p) === i)
    .slice(0, 3);

  // En yoğun ay burada yok: grafikteki altın zirve çubuğu + altındaki başlık
  // (`peakCaption`) onu zaten gösteriyor.
  const stats = [
    { key: "movies", icon: "film", color: "#FBBF24", value: recap.totalMovies, label: str.summaryMovies },
    { key: "shows", icon: "tv", color: "#38BDF8", value: recap.totalShows, label: str.summaryShows },
    { key: "eps", icon: "play-circle", color: "#34D399", value: recap.totalEpisodes, label: str.summaryEpisodes },
    { key: "days", icon: "calendar", color: "#F472B6", value: recap.activeDays, unit: str.days, label: str.hubTileActiveDays },
    { key: "streak", icon: "flame", color: "#FB923C", value: recap.longestStreak, unit: str.days, label: str.hubTileStreak },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.wrapped_section", "Wrapped & Arşiv")}
      </Text>

      {featuredYear != null ? (
        <>
          {/* ── HERO KART ── */}
          <Reveal active={active} dy={26} style={styles.heroReveal}>
            <Animated.View style={[styles.heroShadow, hero.style]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${str.brand} ${featuredYear}`}
                onPressIn={hero.onPressIn}
                onPressOut={hero.onPressOut}
                onPress={() => openRecap(featuredYear)}
                onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}
                style={styles.heroCard}
              >
                <LinearGradient
                  colors={HERO_GRADIENT}
                  locations={[0, 0.42, 0.82, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0.03)", "transparent"]}
                  locations={[0, 0.4, 1]}
                  style={styles.heroTopSheen}
                />
                <GlowOrb
                  size={190}
                  color="#6C63FF"
                  active={active}
                  style={{ top: -70, left: -60 }}
                />
                <GlowOrb
                  size={210}
                  color="#D946EF"
                  active={active}
                  dx={-18}
                  dy={-10}
                  duration={8200}
                  delay={800}
                  style={{ bottom: -90, right: -70 }}
                />
                <MaterialCommunityIcons
                  name="creation"
                  size={120}
                  color="rgba(255,255,255,0.06)"
                  style={styles.heroMotif}
                />
                <Sheen width={heroW} active={active} />

                {/* Üst bar */}
                <View style={styles.topRow}>
                  <View style={styles.pill}>
                    <MaterialCommunityIcons name="creation" size={12} color={GOLD} />
                    <Text style={styles.pillText} allowFontScaling={false}>
                      SEELOGD · WRAPPED
                    </Text>
                  </View>
                  <View style={[styles.pill, styles.pillYear]}>
                    <MaterialCommunityIcons name="calendar-star" size={12} color={GOLD} />
                    <Text style={[styles.pillText, styles.pillYearText]} allowFontScaling={false}>
                      {featuredYear}
                    </Text>
                  </View>
                </View>

                {/* Toplam süre + grafik */}
                <View style={styles.heroRow}>
                  <View style={styles.heroLeft}>
                    <Text style={styles.eyebrow} allowFontScaling={false}>
                      {str.hubEyebrowTotal}
                    </Text>
                    <View style={styles.bigRow}>
                      <CountUp
                        value={heroValue}
                        active={active}
                        reduceMotion={reduceMotion}
                        language={language}
                        delay={350}
                        duration={1400}
                        style={styles.bigNumber}
                      />
                      <Text style={styles.bigUnit} allowFontScaling={false}>
                        {heroUnit}
                      </Text>
                    </View>
                    {approx ? (
                      <Text style={styles.approx} allowFontScaling={false} numberOfLines={1}>
                        {approx}
                      </Text>
                    ) : null}
                    {deltaLabel ? (
                      <View
                        style={[
                          styles.deltaChip,
                          deltaUp ? styles.deltaUp : styles.deltaDown,
                        ]}
                      >
                        <Ionicons
                          name={deltaUp ? "trending-up" : "trending-down"}
                          size={12}
                          color={deltaUp ? "#34D399" : "#FBBF24"}
                        />
                        <Text
                          style={[styles.deltaText, { color: deltaUp ? "#6EE7B7" : "#FDE68A" }]}
                          allowFontScaling={false}
                          numberOfLines={1}
                        >
                          {deltaLabel} {str.hubVsLastYear}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.heroRight}>
                    <MonthlyChart
                      monthly={recap.monthly}
                      peakIndex={bm ? bm.month : -1}
                      active={active}
                    />
                    {peakCaption ? (
                      <Text style={styles.chartCaption} allowFontScaling={false} numberOfLines={1}>
                        {peakCaption}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Rakam şeridi: eski "Yılın rakamları" bölümünün kompakt hâli */}
                <View style={styles.statStrip}>
                  {stats.map((s, i) => (
                    <HeroStat
                      key={s.key}
                      icon={s.icon}
                      color={s.color}
                      value={s.value}
                      unit={s.unit}
                      label={s.label}
                      active={active}
                      delay={620 + i * 70}
                      language={language}
                      reduceMotion={reduceMotion}
                      first={i === 0}
                    />
                  ))}
                </View>

                {/* Kişilik + posterler */}
                <View style={styles.personaRow}>
                  <PosterFan
                    paths={posterPaths}
                    getTmdbUrl={getTmdbUrl}
                    active={active}
                    emoji={recap.personality?.emoji}
                  />
                  <View style={styles.personaCol}>
                    <Text style={styles.eyebrow} allowFontScaling={false}>
                      {str.hubPersonality}
                    </Text>
                    <Text style={styles.personaTitle} allowFontScaling={false} numberOfLines={1}>
                      {recap.personality?.emoji} {recap.personality?.title}
                    </Text>
                    <View style={styles.personaMeta}>
                      {topGenre ? (
                        <View style={styles.metaChip}>
                          <Ionicons name="pricetag" size={10} color={GOLD} />
                          <Text style={styles.metaChipText} allowFontScaling={false} numberOfLines={1}>
                            {topGenre}
                          </Text>
                        </View>
                      ) : null}
                      {topShow?.showName ? (
                        <View style={[styles.metaChip, styles.metaChipShow]}>
                          <Ionicons name="tv" size={10} color="#38BDF8" />
                          <Text style={styles.metaChipText} allowFontScaling={false} numberOfLines={1}>
                            {topShow.showName}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Alt: başlık + CTA */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerTitle} allowFontScaling={false} numberOfLines={2}>
                    {str.entrySubtitle}
                  </Text>
                  <View style={styles.cta}>
                    <Text style={styles.ctaText} allowFontScaling={false} numberOfLines={1}>
                      {str.entryCta}
                    </Text>
                    <View style={styles.ctaIcon}>
                      <NudgeArrow active={active} />
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </Reveal>

        </>
      ) : null}

      {/* ── YILLIK ARŞİV ── */}
      <Reveal active={active} delay={1250} dy={14} style={styles.archiveReveal}>
        <Animated.View style={archive.style}>
          <GlassPressable
            onPressIn={archive.onPressIn}
            onPressOut={archive.onPressOut}
            onPress={openArchive}
            accessibilityRole="button"
            accessibilityLabel={str.hubArchiveTitle}
            style={[
              styles.archiveBtn,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={[styles.archiveIconWrap, { backgroundColor: theme.accent + "1C" }]}>
              <MaterialCommunityIcons name="calendar-text-outline" size={18} color={theme.accent} />
            </View>
            <View style={styles.archiveTextWrap}>
              <Text style={[styles.archiveBtnTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {str.hubArchiveTitle}
              </Text>
              <Text style={[styles.archiveBtnSub, { color: theme.text.muted }]} numberOfLines={1}>
                {(wrappedYears.length > 1 ? str.hubArchiveSubMany : str.hubArchiveSubOne).replace(
                  "{n}",
                  String(wrappedYears.length),
                )}
              </Text>
            </View>
            <View style={styles.archiveChips}>
              {wrappedYears.slice(0, 3).map((yr, i) => (
                <View
                  key={yr}
                  style={[
                    styles.archiveChip,
                    {
                      backgroundColor: i === 0 ? theme.accent : theme.between,
                      borderColor: i === 0 ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.archiveChipText,
                      { color: i === 0 ? "#FFFFFF" : theme.text.secondary },
                    ]}
                    allowFontScaling={false}
                  >
                    {String(yr).slice(2)}
                  </Text>
                </View>
              ))}
              <Ionicons name="chevron-forward" size={15} color={theme.text.muted} />
            </View>
          </GlassPressable>
        </Animated.View>
      </Reveal>

      {/* ── ARŞİV ALT SAYFASI ── */}
      <BottomSheetModal
        visible={archiveModalVisible}
        onClose={closeArchive}
        onDismissed={onArchiveDismissed}
        intensity={35}
        dimColor="rgba(0,0,0,0.42)"
        sheetStyle={[
          styles.modalContent,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />

        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
              {str.hubModalTitle}
            </Text>
            <Text style={[styles.modalSub, { color: theme.text.muted }]}>{str.hubModalSub}</Text>
          </View>
          <GlassCloseButton
            size={30}
            fallbackRadius={15}
            color={theme.text.primary}
            backgroundColor={theme.between}
            accessibilityLabel={str.close}
            onPress={closeArchive}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalList}
        >
          {wrappedYears.map((yr, i) => {
            const locked = !canViewWrappedYear(yr, wrappedGate.plan);
            return (
              <YearRow
                key={yr}
                year={yr}
                index={i}
                // Kilitli yıla gerçek özet geçirilmez: veri bileşene hiç ulaşmaz.
                summary={locked ? LOCKED_YEAR_SUMMARY : yearSummaries[yr] || LOCKED_YEAR_SUMMARY}
                maxMinutes={maxYearMinutes}
                isLatest={!locked && yr === latestWrappedYear}
                locked={locked}
                // Bu yılı hangi planın açtığı: Premium'un 5 yıllık penceresi dışındaki
                // satır "Premium Max ile aç" der, diğerleri "Premium ile aç".
                lockedPlanName={
                  locked
                    ? getPremiumPlanDisplayName(
                        requiredPlanForWrappedYear(yr) ?? PREMIUM_PLAN.PREMIUM,
                      )
                    : null
                }
                theme={theme}
                str={str}
                onPress={() => onYearPress(yr, locked)}
              />
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginTop: 18,
  },
  sectionTitle: {
    width: "90%",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  // Hero
  heroReveal: { width: "90%", marginBottom: 14 },
  heroShadow: {
    borderRadius: 26,
    // Android elevation gölgesi arka planı olmayan View'da çizilmez; kart zaten
    // opak olduğundan ara ton yeterli.
    backgroundColor: "#34136A",
    shadowColor: "#5E4BFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 10,
  },
  heroCard: {
    borderRadius: 26,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroTopSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  heroMotif: { position: "absolute", right: -18, bottom: -22 },
  sheen: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 90,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.28)",
  },
  pillYear: { borderColor: "rgba(255,215,0,0.5)" },
  pillText: { color: GOLD, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },
  pillYearText: { fontSize: 11, letterSpacing: 0.5 },

  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    marginTop: 16,
  },
  heroLeft: { flex: 1, minWidth: 0 },
  heroRight: { width: 118, alignItems: "flex-end" },
  eyebrow: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  bigRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  bigNumber: {
    color: "#FFFFFF",
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  bigUnit: { color: GOLD, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  approx: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 1,
  },
  deltaChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  deltaUp: { backgroundColor: "rgba(52,211,153,0.16)", borderColor: "rgba(52,211,153,0.4)" },
  deltaDown: { backgroundColor: "rgba(251,191,36,0.14)", borderColor: "rgba(251,191,36,0.38)" },
  deltaText: { fontSize: 10, fontWeight: "800" },

  chart: {
    width: 118,
    height: BAR_MAX + 4,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  barEmpty: { backgroundColor: "rgba(255,255,255,0.12)" },
  barPeak: {
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  chartCaption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9.5,
    fontWeight: "800",
    marginTop: 7,
  },

  // Rakam şeridi: koyu cam şerit, 5 eşit hücre + ince ayraçlar.
  statStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 14,
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  statCellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.2)",
  },
  statCellEmpty: { opacity: 0.5 },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    maxWidth: "100%",
  },
  statValueBox: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  statUnit: { color: "rgba(255,255,255,0.62)", fontSize: 8.5, fontWeight: "800" },
  statLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 8.5,
    fontWeight: "800",
    marginTop: 1,
    maxWidth: "100%",
  },

  personaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  fanBox: { width: 84, height: POSTER_H + 8, justifyContent: "center" },
  fanPoster: {
    position: "absolute",
    top: 4,
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  emojiTile: {
    width: 60,
    height: 60,
    alignSelf: "center",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  emojiTileText: { fontSize: 30 },
  personaCol: { flex: 1, minWidth: 0 },
  personaTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  personaMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  metaChipShow: { flexShrink: 1 },
  metaChipText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 10,
    fontWeight: "800",
    flexShrink: 1,
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  footerTitle: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: { color: "#16091F", fontSize: 12, fontWeight: "900", letterSpacing: -0.2 },
  ctaIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2A0F4D",
    alignItems: "center",
    justifyContent: "center",
  },

  // Arşiv satırı
  archiveReveal: { width: "90%", marginBottom: 6 },
  archiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  archiveIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveTextWrap: { flex: 1, minWidth: 0 },
  archiveBtnTitle: { fontSize: 13.5, fontWeight: "800" },
  archiveBtnSub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  archiveChips: { flexDirection: "row", alignItems: "center", gap: 4 },
  archiveChip: {
    minWidth: 26,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveChipText: { fontSize: 10.5, fontWeight: "900" },

  // Alt sayfa
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: "75%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
    opacity: 0.5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: "900" },
  modalSub: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  modalList: { gap: 10, paddingVertical: 12 },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  yearBadge: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  yearBadgeText: { fontSize: 13, fontWeight: "900" },
  yearInfo: { flex: 1, minWidth: 0 },
  yearTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  yearTitle: { fontSize: 13.5, fontWeight: "800", flexShrink: 1 },
  yearSub: { fontSize: 10.5, fontWeight: "600", marginTop: 2 },
  yearTrack: { height: 4, borderRadius: 2, marginTop: 7, overflow: "hidden" },
  yearFill: { height: 4, borderRadius: 2 },
  latestBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  latestBadgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },
  launchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  launchBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
