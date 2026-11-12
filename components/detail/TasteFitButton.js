// components/detail/TasteFitButton.js
//
// Film/dizi detayında "Zevk uyumunu değerlendir" düğmesi. Basılınca DÜĞMENİN YERİNDE:
//   boşta → yükleniyor (dönen halka + adım adım metin + ilerleme çubuğu) → sonuç (yüzde halkası + karar).
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

/** Yüklenirken dönen yay + ortada nabız atan kalp. */
function LoadingRing({ tone, track }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [spin, pulse]);
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
        ]}
      >
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={tone}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * 0.28} ${c}`}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.08] }) }],
        }}
      >
        <Ionicons name="heart" size={17} color={tone} />
      </Animated.View>
    </View>
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
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de", "it"]);
  const lists = useListStatusContext() || {};
  const posterUri = usePosterUri();

  const [phase, setPhase] = useState("idle"); // idle | loading | result
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(1)).current;

  const dataReady = !lists.loading && lists.watchedTvLoaded !== false;
  const accent = theme.colors?.pink || "#FF4D8D";

  // Başka bir yapıma geçilince (aynı ekran örneği yeniden kullanılırsa) baştan başla.
  const mediaId = details?.id;
  useEffect(() => {
    setPhase("idle");
    setResult(null);
    setExpanded(false);
  }, [mediaId, type]);

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
    const bar = Animated.timing(progress, { toValue: 1, duration: MIN_LOADING_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    bar.start();
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
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [phase, progress, stepFade, copy.loading.length]);

  useEffect(() => {
    if (phase !== "loading" || !minElapsed || !dataReady) return;
    setResult(compute());
    reveal.setValue(0);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhase("result");
    Animated.timing(reveal, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [phase, minElapsed, dataReady, compute, reveal]);

  const start = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    // Önceki turdan kalan "süre doldu" bayrağı aynı commit'te sonucu hemen getirmesin.
    setMinElapsed(false);
    setPhase("loading");
  }, []);

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

  // ── Boşta: eski "İnceleme" düğmesiyle aynı ölçüde öne çıkan düğme ──
  if (phase === "idle") {
    return (
      <GlassTouchable
        activeOpacity={0.88}
        onPress={start}
        accessibilityRole="button"
        accessibilityLabel={`${copy.button.title}. ${copy.button.subtitle}`}
        style={[styles.shell, { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.38) }]}
      >
        <View style={styles.row}>
          <LinearGradient
            colors={[alpha(accent, 0.32), alpha(theme.colors?.purple || "#A77BFF", 0.26)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Ionicons name="heart-half" size={20} color={accent} />
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
      </GlassTouchable>
    );
  }

  // ── Yükleniyor ──
  if (phase === "loading") {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={copy.loading[step]}
        style={[styles.shell, styles.clip, { backgroundColor: alpha(accent, 0.08), borderColor: alpha(accent, 0.3) }]}
      >
        <View style={styles.row}>
          <LoadingRing tone={accent} track={track} />
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
                style={[
                  styles.loadFill,
                  { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["4%", "100%"] }) },
                ]}
              >
                <LinearGradient
                  colors={[accent, theme.colors?.purple || "#A77BFF", theme.colors?.blue || "#5A9CF8"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <View style={styles.dots}>
              {copy.loading.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: i <= step ? accent : alpha(theme.text.muted, 0.35) }]}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Sonuç: veri yetersiz ──
  if (!ok) {
    return (
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
      </View>
    );
  }

  // ── Sonuç ──
  return (
    <Animated.View
      style={[
        styles.shell,
        styles.resultShell,
        styles.clip,
        {
          backgroundColor: alpha(tone, 0.09),
          borderColor: alpha(tone, 0.42),
          opacity: reveal,
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${copy.title}: ${copy.pct(result.score)}. ${copy.tiers[result.tier]}`}
        style={styles.row}
      >
        <ScoreRing score={result.score} tone={tone} track={track} pct={copy.pct} />
        <View style={styles.copy}>
          <View style={styles.verdictRow}>
            <Ionicons name={TIER_ICONS[result.tier]} size={14} color={tone} />
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
        </View>
        <View style={[styles.toggleChip, { backgroundColor: alpha(tone, 0.14) }]}>
          <Text allowFontScaling={false} style={[styles.toggleText, { color: tone }]}>
            {expanded ? copy.hide : copy.details}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color={tone} />
        </View>
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
    </Animated.View>
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
  dots: { flexDirection: "row", gap: 4, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
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
