// components/profile/RatingDistributionCard.js
//
// Profil "Puan dağılımı" kartı: kullanıcının verdiği puanların 20 kademelik
// (½ … 10, yarım puan adımlı; 10 yıldız ölçeği) histogramı. Sütun boyu o kademedeki oy sayısıyla orantılı.
//
// Veri: Lists/{uid}.activityIndex.ratings haritası (0-10) — EK OKUMA YOK.
//   Kendi profil  → ListStatusContext.activityIndex.ratings
//   Arkadaş profil → zaten dinlenen Lists/{friendUid} belgesi
// Saf hesap utils/ratingDistribution.js'te (testli).
//
// Etkileşim: grafiğe dokunup parmağı yatay kaydırınca kademe seçilir; alt başlık
// o kademenin yıldızlarını, oy sayısını ve payını gösterir, sütunun üstünde sayı
// belirir. Parmak kalkınca seçim kısa süre sonra kendiliğinden kalkar. Dikey
// hareket kaydırma görünümüne bırakılır.

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import GlassBox from "../common/GlassBox";
import { alpha as withAlpha } from "../../theme/colors";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as Haptics from "../../services/hapticsService";
import { intlLocaleOf } from "../../utils/appLanguages";
import {
  RATING_STEPS,
  ratingStepsOf,
  buildRatingDistribution,
  formatStarAverage,
  formatStep,
} from "../../utils/ratingDistribution";
import { getRatingDistributionCopy } from "../../utils/ratingDistributionCopy";
import useRatingScale from "../../hooks/useRatingScale";

// Kompakt düzen (9 Kas kullanıcı kararı): grafik ½ ile 10★ arasında tek satır,
// başlık tek blok; kart Aktivitelerim kartının altında onunla aynı ölçekte durur.
const CHART_HEIGHT = 40;
// Seçili sütunun üstündeki sayı etiketine yer.
const CHART_TOP_ROOM = 12;
// 20 kademe (14 Kas, yarım puan): sütun arası daraldı.
const BAR_GAP = 2;
// Dolu kademede sütun en az bu kadar görünsün (tek oy da fark edilsin).
const MIN_BAR = 3;
const SELECTION_HOLD_MS = 2200;
// En geniş ölçek (10 yıldız = 20 kademe); 5 yıldızda ilk 10 kullanılır.
const ALL_STEPS = Array.from({ length: RATING_STEPS }, (_, i) => i + 1);

// Kademe etiketi: "8,5★" — 10 yıldızlı ölçekte yıldız dizisi sığmaz, sayı + tek yıldız.
const StepLabel = memo(function StepLabel({ step, size, color, language, scale }) {
  return (
    <View style={styles.starRun}>
      <Text allowFontScaling={false} style={[styles.stepText, { color, fontSize: size + 1.5 }]}>
        {formatStep(step, language, scale)}
      </Text>
      <Ionicons name="star" size={size} color={color} />
    </View>
  );
});

function RatingDistributionCard({
  ratings,
  onPress,
  hideWhenEmpty = false,
  style,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getRatingDistributionCopy(language);
  const locale = intlLocaleOf(language);
  const starColor = theme.colors?.orange ?? "#F97316";
  const muted = theme.text?.muted ?? "#888";

  // Ayarlar > Kişiselleştirme: 10 yıldız → 20 yarım puan kademesi, 5 yıldız → 10 tam puan kademesi
  // (iki modda da etiketler ve ortalama 10 üzerinden).
  const ratingScale = useRatingScale();
  const stepCount = ratingStepsOf(ratingScale);
  const STEPS = useMemo(() => ALL_STEPS.slice(0, stepCount), [stepCount]);
  const stepCountRef = useRef(stepCount);
  stepCountRef.current = stepCount;
  const dist = useMemo(() => buildRatingDistribution(ratings, ratingScale), [ratings, ratingScale]);
  const { counts, total, max, average, modeStep } = dist;
  const empty = total === 0;

  // ── Seçim (dokun-kaydır) ────────────────────────────────────────────────
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  const widthRef = useRef(0);
  const originRef = useRef(0);
  const clearTimer = useRef(null);

  const pick = useCallback((x) => {
    const width = widthRef.current;
    if (!width) return;
    const index = Math.min(
      stepCountRef.current - 1,
      Math.max(0, Math.floor((x / width) * stepCountRef.current)),
    );
    const step = index + 1;
    if (selectedRef.current !== step) {
      selectedRef.current = step;
      setSelected(step);
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const release = useCallback(() => {
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      selectedRef.current = null;
      setSelected(null);
    }, SELECTION_HOLD_MS);
  }, []);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !empty,
        onMoveShouldSetPanResponder: (_, g) =>
          !empty && Math.abs(g.dx) > Math.abs(g.dy),
        // Dikey kaydırma başlarsa ScrollView devralsın.
        onPanResponderTerminationRequest: (_, g) =>
          Math.abs(g.dy) > Math.abs(g.dx),
        // Hareket sırasında locationX Android'de güvenilmez (hedef değişir); dokunuşun
        // başında grafiğin sayfadaki sol kenarı bulunur, sonra pageX'ten ölçülür.
        onPanResponderGrant: (evt) => {
          clearTimeout(clearTimer.current);
          originRef.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
          pick(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) =>
          pick(evt.nativeEvent.pageX - originRef.current),
        onPanResponderRelease: release,
        onPanResponderTerminate: release,
      }),
    [empty, pick, release],
  );

  // ── Büyüme animasyonu: veri ilk geldiğinde sütunlar sırayla yükselir ───────
  const grow = useRef(ALL_STEPS.map(() => new Animated.Value(0))).current;
  const grown = useRef(false);
  useEffect(() => {
    if (empty || grown.current) return;
    grown.current = true;
    Animated.stagger(
      22,
      grow.map((value) =>
        Animated.spring(value, {
          toValue: 1,
          stiffness: 210,
          damping: 20,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [empty, grow]);

  if (empty && hideWhenEmpty) return null;

  const fmt = (n) => Number(n).toLocaleString(locale);
  const averageText = formatStarAverage(average, language);
  const selCount = selected ? counts[selected - 1] : 0;
  const selPct = selected && total ? Math.round((selCount / total) * 100) : 0;

  // Alt başlık: seçim varsa o kademe, yoksa toplam + en sık kademe.
  const subtitle = empty ? (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[styles.subtitle, { color: muted }]}
    >
      {copy.emptyOwn}
    </Text>
  ) : selected ? (
    <View style={styles.subtitleRow}>
      <StepLabel step={selected} size={10} color={starColor} language={language} scale={ratingScale} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.subtitle, { color: theme.text?.primary }]}
      >
        {"  "}
        {copy.count(selCount, fmt(selCount))}
        <Text style={{ color: muted }}>{`  ·  ${copy.share(selPct)}`}</Text>
      </Text>
    </View>
  ) : (
    <View style={styles.subtitleRow}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.subtitle, { color: muted }]}
      >
        {copy.count(total, fmt(total))}
        {modeStep ? `  ·  ${copy.mostCommon} ` : ""}
      </Text>
      {modeStep ? (
        <StepLabel step={modeStep} size={9} color={withAlpha(starColor, 0.85)} language={language} scale={ratingScale} />
      ) : null}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View
        style={[styles.icon, { backgroundColor: withAlpha(starColor, 0.16) }]}
      >
        <Ionicons name="star" size={13} color={starColor} />
      </View>
      <View style={styles.titleCol}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
        >
          {copy.title}
        </Text>
        {subtitle}
      </View>
      {!empty ? (
        <View
          style={[
            styles.averagePill,
            { backgroundColor: withAlpha(starColor, 0.14) },
          ]}
          accessibilityLabel={`${copy.average} ${averageText}`}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.averageValue,
              { color: theme.text?.primary ?? "#fff" },
            ]}
          >
            {averageText}
          </Text>
          <Ionicons name="star" size={11} color={starColor} />
        </View>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={15} color={muted} />
      ) : null}
    </View>
  );

  const a11yLabel = empty
    ? `${copy.title}. ${copy.emptyOwn}`
    : [
        copy.a11y(fmt(total), averageText),
        ...STEPS.filter((s) => counts[s - 1] > 0).map((s) =>
          copy.a11yStep(
            formatStep(s, language, ratingScale),
            fmt(counts[s - 1]),
          ),
        ),
      ].join(". ");

  return (
    <GlassBox
      role="card"
      style={[
        styles.card,
        { backgroundColor: theme.secondary, borderColor: theme.border },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(starColor, 0.14), withAlpha(starColor, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}

      {/* ── Histogram: ½★ [20 sütun] 10★ ──────────────────────────────────── */}
      <View style={styles.chartRow}>
        <Ionicons
          name="star-half"
          size={10}
          color={withAlpha(starColor, empty ? 0.4 : 0.9)}
          style={styles.axisStart}
        />
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={a11yLabel}
          style={styles.chart}
          onLayout={(e) => {
            widthRef.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          {/* Çocuklar dokunma almaz: locationX hep grafiğe göre ölçülür. */}
          <View pointerEvents="none" style={styles.bars}>
            {STEPS.map((step, index) => {
              const count = counts[index];
              const ratio = max > 0 ? count / max : 0;
              // Boşken arkada soluk bir çan eğrisi: kartın neye dönüşeceğini sezdirir.
              const ghost = empty
                ? 0.18 + 0.62 * Math.exp(-((step / stepCount - 0.7) ** 2) / 0.08)
                : 0;
              const height = empty
                ? Math.round(ghost * CHART_HEIGHT)
                : count > 0
                  ? Math.max(MIN_BAR, Math.round(ratio * CHART_HEIGHT))
                  : 0;
              const isSelected = selected === step;
              const opacity = empty
                ? 1
                : selected != null
                  ? isSelected
                    ? 1
                    : 0.32
                  : step === modeStep
                    ? 1
                    : 0.72;
              return (
                <View key={step} style={styles.slot}>
                  <View
                    style={[
                      styles.track,
                      {
                        backgroundColor: withAlpha(
                          muted,
                          isSelected ? 0.14 : 0.06,
                        ),
                      },
                    ]}
                  />
                  {isSelected ? (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[
                        styles.barLabel,
                        {
                          bottom: height + 2,
                          color: theme.text?.primary ?? "#fff",
                        },
                      ]}
                    >
                      {fmt(count)}
                    </Text>
                  ) : null}
                  {height > 0 ? (
                    <Animated.View
                      style={[
                        styles.bar,
                        {
                          height,
                          opacity,
                          transform: [{ scaleY: empty ? 1 : grow[index] }],
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={
                          empty
                            ? [withAlpha(muted, 0.1), withAlpha(muted, 0.03)]
                            : [starColor, withAlpha(starColor, 0.5)]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.axisEnd}>
          <StepLabel
            step={stepCount}
            size={8}
            color={withAlpha(starColor, empty ? 0.4 : 0.9)}
            language={language}
            scale={ratingScale}
          />
        </View>
      </View>
    </GlassBox>
  );
}

const styles = StyleSheet.create({
  // MyActivityButton kartıyla aynı kabuk ölçüsü (köşe 20, dolgu 12).
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  pressed: { opacity: 0.7 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: { flex: 1, minWidth: 0, gap: 1 },
  title: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitleRow: { flexDirection: "row", alignItems: "center", minHeight: 13 },
  subtitle: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  averagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  averageValue: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
    includeFontPadding: false,
  },

  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  axisStart: { marginBottom: -1 },
  axisEnd: { marginBottom: 0 },
  chart: {
    flex: 1,
    height: CHART_HEIGHT + CHART_TOP_ROOM,
    justifyContent: "flex-end",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: BAR_GAP,
    height: CHART_HEIGHT,
  },
  slot: {
    flex: 1,
    height: CHART_HEIGHT,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  // absoluteFillObject RN 0.85'te kalktı (utils/styleSheetCompat); açık yazılır.
  track: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    overflow: "hidden",
    // scaleY alttan büyüsün.
    transformOrigin: "bottom",
  },
  barLabel: {
    position: "absolute",
    left: -8,
    right: -8,
    textAlign: "center",
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: "900",
  },
  starRun: { flexDirection: "row", alignItems: "center", gap: 1 },
  stepText: { fontWeight: "900", includeFontPadding: false },
});

export default memo(RatingDistributionCard);
