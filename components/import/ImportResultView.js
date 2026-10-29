// components/import/ImportResultView.js
//
// Aktarım bitince ya da yarıda kalınca görünen ekran.
//   success      → yaylanan onay rozeti + yayılan halka, aktarılan afişlerden yelpaze,
//                  özet kutucukları, ayrıntı satırları, eşleşmeyenlerin listesi,
//                  "başarısızları yeniden dene"
//   interrupted  → neden (bağlantı / TMDB / kayıt), şu ana dek kaydedilenler, son ilerleme,
//                  "kaldığı yerden devam et"
//   cancelled    → kullanıcı durdurdu; aynı devam seçeneği
//
// REANIMATED KURALI: rozetin dinlenme değeri GÖRÜNÜR (ölçek 1); giriş hareketi efektte
// "küçüğe atla → yaylan" diye oynar. Halka yalnız süs: dinlenmede gizli.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "../../theme/colors";
import useReduceMotion from "../../hooks/useReduceMotion";
import { renderRich } from "./richText";
import { importErrorText } from "./importCopy";
import { buildImportResultRows, durationText } from "./importPresentation";
import { IMPORT_TONES, PosterThumb, toneColor } from "./ImportProgressView";

const UNMATCHED_LIMIT = 80;
const FAN = [
  { rotate: "-9deg", y: 8 },
  { rotate: "-4deg", y: 2 },
  { rotate: "0deg", y: 0 },
  { rotate: "4deg", y: 2 },
  { rotate: "9deg", y: 8 },
];

function ResultOrb({ color, icon, reduceMotion }) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(0.55, { duration: 0 }),
      withSpring(1, { damping: 11, stiffness: 170, mass: 0.8 }),
    );
    burst.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(120, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) })),
    );
  }, [burst, reduceMotion, scale]);
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? 0.5 * (1 - burst.value) : 0,
    transform: [{ scale: 1 + burst.value * 0.9 }],
  }));
  return (
    <View style={styles.orbWrap}>
      <Animated.View pointerEvents="none" style={[styles.orbRing, { borderColor: color }, ringStyle]} />
      <Animated.View style={[styles.orb, { backgroundColor: alpha(color, 0.16) }, orbStyle]}>
        <AppIcon family="Ionicons" name={icon} size={32} color={color} />
      </Animated.View>
    </View>
  );
}

function PosterFan({ posters, theme, reduceMotion }) {
  const shown = posters.slice(0, FAN.length);
  if (shown.length < 2) return null;
  const offset = Math.floor((FAN.length - shown.length) / 2);
  return (
    <View style={styles.fan}>
      {shown.map((path, index) => {
        const slot = FAN[index + offset];
        return (
          <Animated.View
            key={path}
            entering={reduceMotion ? undefined : FadeInDown.delay(140 + index * 70).duration(320)}
            style={[
              styles.fanItem,
              { zIndex: index === Math.floor(shown.length / 2) ? 5 : index, transform: [{ rotate: slot.rotate }, { translateY: slot.y }] },
            ]}
          >
            <PosterThumb path={path} width={58} height={87} radius={10} theme={theme} />
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function ImportResultView({
  variant,
  result,
  error,
  summary,
  progress,
  copy,
  theme,
  onDone,
  onResume,
  onRetryFailed,
}) {
  const reduceMotion = useReduceMotion();
  const [showUnmatched, setShowUnmatched] = useState(false);
  const accent = theme.accent || "#138DF0";

  if (variant !== "success") {
    const cancelled = variant === "cancelled";
    const color = cancelled ? accent : IMPORT_TONES.warning;
    const percent = Math.min(100, Math.round((progress?.ratio || 0) * 100));
    return (
      <View style={styles.container}>
        <View style={[styles.hero, { backgroundColor: alpha(color, 0.08), borderColor: alpha(color, 0.26) }]}>
          <ResultOrb color={color} icon={cancelled ? "pause" : "cloud-offline-outline"} reduceMotion={reduceMotion} />
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {cancelled ? copy.result.cancelledTitle : copy.result.interruptedTitle}
          </Text>
          {!cancelled ? (
            <Text style={[styles.desc, { color: theme.text.secondary }]}>{importErrorText(error, copy)}</Text>
          ) : null}
          <Text style={[styles.desc, { color: theme.text.secondary }]}>
            {summary?.saved > 0
              ? renderRich(copy.result.savedSoFar(summary.saved), { fontWeight: "900", color: theme.text.primary })
              : copy.result.nothingSaved}
          </Text>
          <View style={[styles.partialTrack, { backgroundColor: alpha(theme.text.muted || "#888", 0.18) }]}>
            <View style={[styles.partialFill, { width: `${percent}%`, backgroundColor: color }]} />
          </View>
          <Text allowFontScaling={false} style={[styles.partialPercent, { color }]}>{copy.percent(percent)}</Text>
        </View>

        <GlassTouchable style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={onResume}>
          <AppIcon family="Ionicons" name="play" size={16} color="#FFFFFF" />
          <Text style={styles.primaryText}>{copy.result.resume}</Text>
        </GlassTouchable>
        <GlassTouchable
          style={[styles.secondaryBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.85) }]}
          onPress={onDone}
        >
          <Text style={[styles.secondaryText, { color: theme.text.primary }]}>{copy.result.close}</Text>
        </GlassTouchable>
      </View>
    );
  }

  const stats = result || {};
  const rows = buildImportResultRows(stats, copy);
  const duration = durationText(stats.durationMs, copy);
  const tiles = [
    { key: "titles", label: copy.result.tileTitles, value: stats.count || 0, icon: "film-outline", color: accent },
    { key: "ratings", label: copy.result.tileRatings, value: stats.ratingsCount || 0, icon: "star", color: IMPORT_TONES.gold },
    { key: "reviews", label: copy.result.tileReviews, value: stats.reviewsCount || 0, icon: "create-outline", color: IMPORT_TONES.sky },
    { key: "lists", label: copy.result.tileLists, value: stats.customListsCount || 0, icon: "albums-outline", color: IMPORT_TONES.violet },
  ].filter((tile, index) => index === 0 || tile.value > 0);
  const unmatched = Array.isArray(stats.unmatchedItems) ? stats.unmatchedItems : [];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.hero,
          { backgroundColor: alpha(IMPORT_TONES.safe, 0.09), borderColor: alpha(IMPORT_TONES.safe, 0.26) },
        ]}
      >
        <ResultOrb color={IMPORT_TONES.safe} icon="checkmark" reduceMotion={reduceMotion} />
        <Text style={[styles.title, { color: theme.text.primary }]}>{copy.successTitle}</Text>
        <Text style={[styles.desc, { color: theme.text.secondary }]}>
          {renderRich(copy.successTotal(stats.count || 0), { fontWeight: "900", color: IMPORT_TONES.safe })}
        </Text>
        {duration ? (
          <Text style={[styles.duration, { color: theme.text.muted }]}>{copy.result.duration(duration)}</Text>
        ) : null}
        <PosterFan posters={stats.posters || []} theme={theme} reduceMotion={reduceMotion} />
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile, index) => (
          <Animated.View
            key={tile.key}
            entering={reduceMotion ? undefined : FadeInUp.delay(220 + index * 60).duration(280)}
            style={[styles.tile, { backgroundColor: alpha(tile.color, 0.1), borderColor: alpha(tile.color, 0.22) }]}
          >
            <AppIcon family="Ionicons" name={tile.icon} size={15} color={tile.color} />
            <Text allowFontScaling={false} style={[styles.tileValue, { color: theme.text.primary }]}>{tile.value}</Text>
            <Text numberOfLines={1} style={[styles.tileLabel, { color: theme.text.secondary }]}>{tile.label}</Text>
          </Animated.View>
        ))}
      </View>

      {rows.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{copy.resultDetails}</Text>
          <View
            style={[
              styles.card,
              { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.52), borderColor: alpha(theme.border || "#444", 0.7) },
            ]}
          >
            {rows.map((row, index) => {
              const tone = toneColor(row.tone, theme);
              return (
                <View key={row.key}>
                  <View style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: alpha(tone, 0.13) }]}>
                      <AppIcon family="Ionicons" name={row.icon} size={16} color={tone} />
                    </View>
                    <Text style={[styles.rowText, { color: row.tone === "warning" ? tone : theme.text.primary }]}>{row.text}</Text>
                  </View>
                  {index < rows.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: alpha(theme.border || "#444", 0.65) }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {unmatched.length > 0 ? (
        <View style={styles.section}>
          <GlassTouchable
            style={[styles.toggle, { backgroundColor: alpha(IMPORT_TONES.warning, 0.08), borderColor: alpha(IMPORT_TONES.warning, 0.25) }]}
            onPress={() => setShowUnmatched((value) => !value)}
          >
            <AppIcon family="Ionicons" name="list-outline" size={16} color={IMPORT_TONES.warning} />
            <Text style={[styles.toggleText, { color: theme.text.primary }]}>
              {showUnmatched ? copy.result.unmatchedHide : copy.result.unmatchedShow(unmatched.length)}
            </Text>
            <AppIcon
              family="Ionicons"
              name={showUnmatched ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.text.secondary}
            />
          </GlassTouchable>
          {showUnmatched ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(200)}
              style={[styles.unmatchedCard, { borderColor: alpha(theme.border || "#444", 0.7) }]}
            >
              <Text style={[styles.unmatchedHint, { color: theme.text.muted }]}>{copy.result.unmatchedHint}</Text>
              {unmatched.slice(0, UNMATCHED_LIMIT).map((item, index) => (
                <Text
                  key={`${item.title}-${item.year}-${index}`}
                  numberOfLines={1}
                  style={[styles.unmatchedItem, { color: theme.text.primary }]}
                >
                  • {item.title}
                  {item.year ? <Text style={{ color: theme.text.secondary }}>{` (${item.year})`}</Text> : null}
                </Text>
              ))}
              {unmatched.length > UNMATCHED_LIMIT ? (
                <Text style={[styles.unmatchedItem, { color: theme.text.muted }]}>
                  {`+${unmatched.length - UNMATCHED_LIMIT}`}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {stats.retryableCount > 0 ? (
        <GlassTouchable
          style={[styles.secondaryBtn, styles.retryBtn, { borderColor: alpha(accent, 0.45), backgroundColor: alpha(accent, 0.1) }]}
          onPress={onRetryFailed}
        >
          <AppIcon family="Ionicons" name="refresh" size={16} color={accent} />
          <Text style={[styles.secondaryText, { color: accent }]}>{copy.result.retry(stats.retryableCount)}</Text>
        </GlassTouchable>
      ) : null}

      <GlassTouchable style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={onDone}>
        <Text style={styles.primaryText}>{copy.done}</Text>
      </GlassTouchable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8, gap: 12 },
  hero: { alignItems: "center", borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 18 },
  orbWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  orb: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  orbRing: { position: "absolute", width: 62, height: 62, borderRadius: 31, borderWidth: 2 },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  desc: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 2 },
  duration: { fontSize: 11.5, fontWeight: "700", marginTop: 6 },
  fan: { flexDirection: "row", justifyContent: "center", marginTop: 16, height: 100 },
  fanItem: {
    marginHorizontal: -9,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  partialTrack: { alignSelf: "stretch", height: 8, borderRadius: 999, overflow: "hidden", marginTop: 14 },
  partialFill: { height: "100%", borderRadius: 999 },
  partialPercent: { fontSize: 13, fontWeight: "900", marginTop: 6 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 15, borderWidth: 1, paddingVertical: 10, alignItems: "center", gap: 2 },
  tileValue: { fontSize: 19, lineHeight: 23, fontWeight: "900" },
  tileLabel: { fontSize: 10.5, fontWeight: "700" },
  section: { gap: 7 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", paddingHorizontal: 2 },
  card: { borderRadius: 17, borderWidth: 1, paddingHorizontal: 12 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rowIcon: { width: 31, height: 31, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 41 },
  toggle: { minHeight: 46, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  toggleText: { flex: 1, fontSize: 13, fontWeight: "800" },
  unmatchedCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 3 },
  unmatchedHint: { fontSize: 11.5, lineHeight: 16, marginBottom: 5 },
  unmatchedItem: { fontSize: 12.5, lineHeight: 18 },
  primaryBtn: {
    minHeight: 48,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
  },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryBtn: {
    minHeight: 46,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
  },
  retryBtn: { borderWidth: 1 },
  secondaryText: { fontSize: 14, fontWeight: "800" },
});
