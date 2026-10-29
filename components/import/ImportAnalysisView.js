// components/import/ImportAnalysisView.js
//
// Dosya seçildikten sonraki İÇERİK ANALİZİ ekranı: aktarım başlamadan önce dosyada ne
// bulunduğunu gösterir (sayılar, puan dağılımı, yıllara göre izleme, dönemler, tahmini
// süre), kullanıcı neleri alacağını seçer ve "İçeri aktar" ile işi başlatır.
// Veri: services/import/importAnalysis.analyzeImport (saf).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "../../theme/colors";
import useReduceMotion from "../../hooks/useReduceMotion";
import { triggerHaptic } from "../../services/hapticsService";
import SourceBadge from "./SourceBadge";
import { IMPORT_TONES } from "./ImportProgressView";

const BAR_MAX_H = 64;
const YEAR_MAX_H = 54;

function estimateText(ms, copy) {
  if (!Number.isFinite(ms) || ms < 60000) return copy.analysis.estimateUnderMinute;
  return copy.analysis.estimateMinutes(Math.ceil(ms / 60000));
}

const sourceKey = (origins) => (origins.length > 1 ? "mixed" : origins[0] === "imdb" ? "imdb" : "letterboxd");

function Toggle({ active, icon, title, meta, onPress, theme }) {
  const accent = theme.accent || "#138DF0";
  return (
    <GlassTouchable
      style={[
        styles.toggle,
        { borderColor: active ? accent : alpha(theme.border || "#444", 0.8), backgroundColor: active ? alpha(accent, 0.1) : "transparent" },
      ]}
      onPress={() => {
        triggerHaptic("selection");
        onPress();
      }}
      activeOpacity={0.8}
    >
      <AppIcon family="Ionicons" name={icon} size={18} color={active ? accent : theme.text.muted} />
      <View style={styles.toggleCopy}>
        <Text numberOfLines={1} style={[styles.toggleTitle, { color: theme.text.primary }]}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={[styles.toggleMeta, { color: theme.text.secondary }]}>{meta}</Text> : null}
      </View>
      <AppIcon family="Ionicons" name={active ? "checkbox" : "square-outline"} size={20} color={active ? accent : theme.text.muted} />
    </GlassTouchable>
  );
}

export default function ImportAnalysisView({
  parsed,
  analysis,
  copy,
  theme,
  includeWatched,
  includeWatchlist,
  includeCustomLists,
  onToggleWatched,
  onToggleWatchlist,
  onToggleCustomLists,
  targetList,
  onTargetChange,
  importCount,
  onBack,
  onImport,
}) {
  const reduceMotion = useReduceMotion();
  const accent = theme.accent || "#138DF0";
  const a = copy.analysis;
  const { totals } = analysis;
  const source = sourceKey(analysis.origins);
  const sourceName = analysis.origins.map((origin) => copy.sources[origin] || origin).join(" + ");
  const span = analysis.dateRange
    ? a.span(analysis.dateRange.from.slice(0, 4), analysis.dateRange.to.slice(0, 4))
    : null;
  const enter = (index) => (reduceMotion ? undefined : FadeInUp.delay(60 + index * 45).duration(260));

  const kpis = [
    { key: "titles", label: a.kpiTitles, value: totals.titles, icon: "film-outline", color: accent },
    { key: "watchEvents", label: a.kpiWatchEvents, value: totals.watchEvents, icon: "eye-outline", color: IMPORT_TONES.sky },
    { key: "ratings", label: a.kpiRatings, value: totals.ratings, icon: "star", color: IMPORT_TONES.gold },
    { key: "reviews", label: a.kpiReviews, value: totals.reviews, icon: "create-outline", color: IMPORT_TONES.violet },
    { key: "rewatches", label: a.kpiRewatches, value: totals.rewatches, icon: "repeat", color: IMPORT_TONES.safe },
    { key: "watchlist", label: a.kpiWatchlist, value: totals.watchlist, icon: "bookmark-outline", color: "#4CA7FF" },
    { key: "lists", label: a.kpiLists, value: totals.lists, icon: "albums-outline", color: IMPORT_TONES.violet },
    { key: "series", label: a.kpiSeries, value: totals.series, icon: "tv-outline", color: "#F05B7A" },
  ].filter((kpi, index) => index === 0 || kpi.value > 0).slice(0, 6);

  const histogramMax = Math.max(1, ...analysis.ratingHistogram);
  const yearMax = Math.max(1, ...analysis.byYear.map((entry) => entry.count));
  const cardStyle = { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5), borderColor: alpha(theme.border || "#444", 0.6) };
  const isBundle = analysis.isBundle;
  const notices = [
    analysis.skippedCount > 0 ? copy.skippedUnsupported(analysis.skippedCount) : null,
    analysis.unknownFilesCount > 0 ? copy.unknownFiles(analysis.unknownFilesCount) : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Başlık + sayılar */}
      <View style={[styles.card, styles.headerCard, { backgroundColor: alpha(accent, 0.07), borderColor: alpha(accent, 0.24) }]}>
        <View style={styles.headerRow}>
          <SourceBadge source={source} size={38} />
          <View style={styles.headerCopy}>
            <Text numberOfLines={2} style={[styles.headerTitle, { color: theme.text.primary }]}>{a.title(sourceName)}</Text>
            {span ? (
              <Text style={[styles.headerSub, { color: theme.text.secondary }]}>
                <AppIcon family="Ionicons" name="calendar-outline" size={11} color={theme.text.secondary} /> {span}
              </Text>
            ) : null}
          </View>
          <AppIcon family="Ionicons" name="checkmark-circle" size={22} color={IMPORT_TONES.safe} />
        </View>
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, index) => (
            <Animated.View
              key={kpi.key}
              entering={enter(index)}
              style={[styles.kpi, { backgroundColor: alpha(kpi.color, 0.1), borderColor: alpha(kpi.color, 0.2) }]}
            >
              <AppIcon family="Ionicons" name={kpi.icon} size={14} color={kpi.color} />
              <Text allowFontScaling={false} style={[styles.kpiValue, { color: theme.text.primary }]}>{kpi.value}</Text>
              <Text numberOfLines={1} style={[styles.kpiLabel, { color: theme.text.secondary }]}>{kpi.label}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Puan dağılımı */}
      {totals.ratings > 0 ? (
        <View style={[styles.card, cardStyle]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{a.ratingsTitle}</Text>
            {analysis.ratingAverage != null ? (
              <View style={[styles.pill, { backgroundColor: alpha(IMPORT_TONES.gold, 0.16) }]}>
                <AppIcon family="Ionicons" name="star" size={11} color={IMPORT_TONES.gold} />
                <Text style={[styles.pillText, { color: IMPORT_TONES.gold }]}>{a.average(analysis.ratingAverage)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.histogram}>
            {analysis.ratingHistogram.map((count, index) => {
              const height = count > 0 ? Math.max(4, Math.round((count / histogramMax) * BAR_MAX_H)) : 2;
              return (
                <View key={index} style={styles.histColumn}>
                  {count > 0 ? (
                    <Text allowFontScaling={false} style={[styles.histCount, { color: theme.text.muted }]}>{count}</Text>
                  ) : null}
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInDown.delay(80 + index * 40).duration(300)}
                    style={[
                      styles.histBar,
                      { height, backgroundColor: count > 0 ? alpha(IMPORT_TONES.gold, 0.35 + 0.65 * (count / histogramMax)) : alpha(theme.text.muted || "#888", 0.2) },
                    ]}
                  />
                  <Text allowFontScaling={false} style={[styles.histLabel, { color: theme.text.secondary }]}>{index + 1}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Yıllara göre izleme */}
      {analysis.byYear.length > 1 ? (
        <View style={[styles.card, cardStyle]}>
          <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{a.yearsTitle}</Text>
          <View style={styles.years}>
            {analysis.byYear.map((entry, index) => (
              <View key={entry.year} style={styles.yearColumn}>
                <Text allowFontScaling={false} style={[styles.yearCount, { color: theme.text.primary }]}>{entry.count}</Text>
                <Animated.View
                  entering={reduceMotion ? undefined : FadeInDown.delay(100 + index * 50).duration(300)}
                  style={[
                    styles.yearBar,
                    { height: Math.max(4, Math.round((entry.count / yearMax) * YEAR_MAX_H)), backgroundColor: alpha(accent, 0.45 + 0.55 * (entry.count / yearMax)) },
                  ]}
                />
                <Text allowFontScaling={false} style={[styles.yearLabel, { color: theme.text.secondary }]}>{entry.year}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Dönemler */}
      {analysis.decades.length > 0 ? (
        <View style={styles.decadesBlock}>
          <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{a.decadesTitle}</Text>
          <View style={styles.decades}>
            {analysis.decades.map((entry, index) => (
              <View
                key={entry.decade}
                style={[styles.decadeChip, { backgroundColor: alpha(index === 0 ? accent : theme.text.muted || "#888", index === 0 ? 0.16 : 0.1) }]}
              >
                <Text style={[styles.decadeText, { color: index === 0 ? accent : theme.text.primary }]}>{a.decade(entry.decade)}</Text>
                <Text style={[styles.decadeCount, { color: theme.text.secondary }]}>{entry.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Seçim */}
      <View style={[styles.card, cardStyle]}>
        <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{isBundle ? a.pickTitle : copy.targetTitle}</Text>
        {isBundle ? (
          <View style={styles.toggles}>
            {parsed.stats.watchedCount > 0 ? (
              <Toggle
                active={includeWatched}
                icon="film-outline"
                title={analysis.origins.includes("imdb") ? copy.watchedTitles : copy.watchedMovies}
                meta={String(parsed.stats.watchedCount)}
                onPress={onToggleWatched}
                theme={theme}
              />
            ) : null}
            {parsed.stats.watchlistCount > 0 ? (
              <Toggle
                active={includeWatchlist}
                icon="bookmark-outline"
                title={copy.watchlist}
                meta={String(parsed.stats.watchlistCount)}
                onPress={onToggleWatchlist}
                theme={theme}
              />
            ) : null}
            {parsed.stats.listsCount > 0 ? (
              <Toggle
                active={includeCustomLists}
                icon="albums-outline"
                title={copy.customLists}
                meta={copy.customListsMeta(parsed.stats.listsCount, parsed.stats.listItemsCount)}
                onPress={onToggleCustomLists}
                theme={theme}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.targets}>
            {[
              { key: "watchedMovies", label: copy.targetWatched, icon: "film-outline" },
              { key: "watchList", label: copy.targetWatchlist, icon: "bookmark-outline" },
              { key: "favorites", label: copy.targetFavorites, icon: "heart-outline" },
            ].map((target) => {
              const active = targetList === target.key;
              return (
                <GlassTouchable
                  key={target.key}
                  style={[
                    styles.targetBtn,
                    { borderColor: active ? accent : alpha(theme.border || "#444", 0.8), backgroundColor: active ? accent : "transparent" },
                  ]}
                  onPress={() => {
                    triggerHaptic("selection");
                    onTargetChange(target.key);
                  }}
                >
                  <AppIcon family="Ionicons" name={target.icon} size={14} color={active ? "#FFFFFF" : theme.text.secondary} />
                  <Text numberOfLines={1} style={[styles.targetText, { color: active ? "#FFFFFF" : theme.text.secondary }]}>{target.label}</Text>
                </GlassTouchable>
              );
            })}
          </View>
        )}
      </View>

      {notices.map((notice) => (
        <View key={notice} style={[styles.notice, { backgroundColor: alpha(IMPORT_TONES.warning, 0.1) }]}>
          <AppIcon family="Ionicons" name="information-circle-outline" size={16} color={IMPORT_TONES.warning} />
          <Text style={[styles.noticeText, { color: theme.text.secondary }]}>{notice}</Text>
        </View>
      ))}

      <View style={styles.metaRow}>
        <AppIcon family="Ionicons" name="time-outline" size={14} color={theme.text.muted} />
        <Text style={[styles.metaText, { color: theme.text.secondary }]}>{a.estimate(estimateText(analysis.estimateMs, copy))}</Text>
      </View>
      <View style={styles.metaRow}>
        <AppIcon family="Ionicons" name="shield-checkmark-outline" size={14} color={IMPORT_TONES.safe} />
        <Text style={[styles.metaText, { color: theme.text.secondary }]}>{a.safeNote}</Text>
      </View>

      <View style={styles.actions}>
        <GlassTouchable style={[styles.backBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.8) }]} onPress={onBack}>
          <Text style={[styles.backText, { color: theme.text.primary }]}>{copy.back}</Text>
        </GlassTouchable>
        <GlassTouchable
          style={[styles.importBtn, { backgroundColor: accent }, importCount === 0 && styles.disabled]}
          onPress={onImport}
          disabled={importCount === 0}
        >
          <AppIcon family="Ionicons" name="cloud-download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.importText}>{a.importBtn(importCount)}</Text>
        </GlassTouchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 13, gap: 10 },
  headerCard: { gap: 13 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: "900" },
  headerSub: { fontSize: 12, fontWeight: "700" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  kpi: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 88,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 1,
  },
  kpiValue: { fontSize: 18, lineHeight: 22, fontWeight: "900" },
  kpiLabel: { fontSize: 10.5, fontWeight: "700" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11.5, fontWeight: "900" },
  histogram: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: BAR_MAX_H + 34 },
  histColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  histCount: { fontSize: 9, fontWeight: "700" },
  histBar: { width: "100%", borderRadius: 5 },
  histLabel: { fontSize: 10, fontWeight: "800" },
  years: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: YEAR_MAX_H + 36 },
  yearColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  yearCount: { fontSize: 10.5, fontWeight: "800" },
  yearBar: { width: "72%", borderRadius: 6 },
  yearLabel: { fontSize: 10, fontWeight: "700" },
  decadesBlock: { gap: 8, paddingHorizontal: 2 },
  decades: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  decadeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  decadeText: { fontSize: 12.5, fontWeight: "800" },
  decadeCount: { fontSize: 11.5, fontWeight: "700" },
  toggles: { gap: 8 },
  toggle: { minHeight: 52, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  toggleCopy: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 13.5, fontWeight: "800" },
  toggleMeta: { fontSize: 11.5, marginTop: 1 },
  targets: { flexDirection: "row", gap: 8 },
  targetBtn: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  targetText: { fontSize: 12, fontWeight: "800", flexShrink: 1 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 2 },
  metaText: { flex: 1, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  backBtn: { paddingHorizontal: 16, height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 14, fontWeight: "700" },
  importBtn: { flex: 1, height: 50, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  importText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.5 },
});
