// components/import/ImportHistoryCard.js
//
// Giriş adımındaki "Aktarım geçmişin" kartı: kaynak bazında (Letterboxd / IMDb) şimdiye
// dek kütüphaneye EKLENENLER (birikimli; yeni aktarım üstüne ekler), son aktarımların mini
// grafiği ve satır içi onaylı "… verilerini sıfırla".
// Veri: services/import/importStats (Users/{uid}/private/importStats).

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "../../theme/colors";
import useReduceMotion from "../../hooks/useReduceMotion";
import { hasAnyImportedData, IMPORT_SOURCES } from "../../services/import/importStats";
import SourceBadge from "./SourceBadge";
import { IMPORT_TONES } from "./ImportProgressView";

const TREND_MAX_H = 30;

function formatDate(iso, locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatNumber(value, locale) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function SourceBlock({ source, stats, copy, theme, locale, resetState, onAskReset, onCancelReset, onConfirmReset, busy }) {
  const reduceMotion = useReduceMotion();
  const h = copy.history;
  const name = copy.sources[source];
  const accent = theme.accent || "#138DF0";
  const counters = [
    { key: "titles", label: h.titles, value: stats.titles, color: accent },
    { key: "watchEvents", label: h.watchEvents, value: stats.watchEvents, color: IMPORT_TONES.sky },
    { key: "ratings", label: h.ratings, value: stats.ratings, color: IMPORT_TONES.gold },
    { key: "reviews", label: h.reviews, value: stats.reviews, color: IMPORT_TONES.violet },
    { key: "lists", label: h.lists, value: stats.lists, color: IMPORT_TONES.safe },
  ].filter((counter, index) => index === 0 || counter.value > 0);
  // Geçmiş en yeni başta tutulur; grafik soldan sağa eskiden yeniye.
  const trend = [...stats.history].reverse();
  const trendValue = (entry) => (Number(entry.titles) || 0) + (Number(entry.listItems) || 0) + (Number(entry.ratings) || 0);
  const trendMax = Math.max(1, ...trend.map(trendValue));
  const mine = resetState?.source === source;
  const danger = IMPORT_TONES.danger;

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <SourceBadge source={source} size={30} />
        <View style={styles.blockCopy}>
          <Text style={[styles.blockName, { color: theme.text.primary }]}>{name}</Text>
          {stats.lastImportAt ? (
            <Text numberOfLines={1} style={[styles.blockMeta, { color: theme.text.secondary }]}>
              {h.lastImport(formatDate(stats.lastImportAt, locale), stats.imports)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.counters}>
        {counters.map((counter) => (
          <View key={counter.key} style={[styles.counter, { backgroundColor: alpha(counter.color, 0.1) }]}>
            <Text allowFontScaling={false} style={[styles.counterValue, { color: counter.color }]}>
              {formatNumber(counter.value, locale)}
            </Text>
            <Text numberOfLines={1} style={[styles.counterLabel, { color: theme.text.secondary }]}>{counter.label}</Text>
          </View>
        ))}
      </View>

      {trend.length > 1 ? (
        <View style={styles.trendBlock}>
          <Text style={[styles.trendTitle, { color: theme.text.muted }]}>{h.trendTitle}</Text>
          <View style={styles.trend}>
            {trend.map((entry, index) => (
              <Animated.View
                key={`${entry.at}-${index}`}
                entering={reduceMotion ? undefined : FadeInDown.delay(index * 40).duration(260)}
                style={[
                  styles.trendBar,
                  {
                    height: Math.max(3, Math.round((trendValue(entry) / trendMax) * TREND_MAX_H)),
                    backgroundColor: index === trend.length - 1 ? accent : alpha(accent, 0.35),
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {mine && resetState.phase === "running" ? (
        <View style={styles.resetProgress}>
          <View style={styles.resetRow}>
            <ActivityIndicator size="small" color={danger} />
            <Text style={[styles.resetRunningText, { color: theme.text.primary }]}>{h.resetting}</Text>
            {resetState.total > 0 ? (
              <Text style={[styles.resetPercent, { color: danger }]}>
                {copy.percent(Math.round((resetState.done / resetState.total) * 100))}
              </Text>
            ) : null}
          </View>
          <View style={[styles.resetTrack, { backgroundColor: alpha(theme.text.muted || "#888", 0.18) }]}>
            <View
              style={[
                styles.resetFill,
                { width: `${resetState.total ? Math.round((resetState.done / resetState.total) * 100) : 5}%`, backgroundColor: danger },
              ]}
            />
          </View>
        </View>
      ) : mine && resetState.phase === "confirm" ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(180)}
          style={[styles.confirm, { backgroundColor: alpha(danger, 0.08), borderColor: alpha(danger, 0.3) }]}
        >
          <Text style={[styles.confirmTitle, { color: theme.text.primary }]}>{h.resetTitle(name)}</Text>
          <Text style={[styles.confirmBody, { color: theme.text.secondary }]}>{h.resetBody(copy.sourceFrom[source])}</Text>
          <View style={styles.confirmActions}>
            <GlassTouchable
              style={[styles.confirmBtn, { backgroundColor: alpha(theme.secondary || "#333", 0.9) }]}
              onPress={onCancelReset}
            >
              <Text style={[styles.confirmBtnText, { color: theme.text.primary }]}>{h.resetCancel}</Text>
            </GlassTouchable>
            <GlassTouchable style={[styles.confirmBtn, { backgroundColor: danger }]} onPress={() => onConfirmReset(source)}>
              <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>{h.resetConfirm}</Text>
            </GlassTouchable>
          </View>
        </Animated.View>
      ) : (
        <GlassTouchable
          style={[styles.resetBtn, { borderColor: alpha(danger, 0.4), backgroundColor: alpha(danger, 0.06) }, busy && styles.disabled]}
          onPress={() => onAskReset(source)}
          disabled={busy}
        >
          <AppIcon family="Ionicons" name="trash-outline" size={15} color={danger} />
          <Text style={[styles.resetText, { color: danger }]}>{h.reset(name)}</Text>
        </GlassTouchable>
      )}
    </View>
  );
}

export default function ImportHistoryCard({
  stats,
  loading,
  copy,
  theme,
  locale,
  resetState,
  onAskReset,
  onCancelReset,
  onConfirmReset,
}) {
  const h = copy.history;
  const sources = IMPORT_SOURCES.filter((source) => stats?.[source] && (stats[source].imports > 0 || hasAnyImportedData(stats[source])));
  const busy = resetState?.phase === "running";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5), borderColor: alpha(theme.border || "#444", 0.6) },
      ]}
    >
      <View style={styles.cardHead}>
        <AppIcon family="Ionicons" name="stats-chart" size={15} color={theme.accent || "#138DF0"} />
        <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{h.title}</Text>
      </View>
      {loading && !stats ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.muted }]}>{h.loading}</Text>
        </View>
      ) : sources.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.text.muted }]}>{h.empty}</Text>
      ) : (
        sources.map((source, index) => (
          <View key={source}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: alpha(theme.border || "#444", 0.6) }]} /> : null}
            <SourceBlock
              source={source}
              stats={stats[source]}
              copy={copy}
              theme={theme}
              locale={locale}
              resetState={resetState}
              onAskReset={onAskReset}
              onCancelReset={onCancelReset}
              onConfirmReset={onConfirmReset}
              busy={busy}
            />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 13, gap: 10, marginTop: 16 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  block: { gap: 10 },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  blockCopy: { flex: 1, minWidth: 0 },
  blockName: { fontSize: 14.5, fontWeight: "900" },
  blockMeta: { fontSize: 11.5, marginTop: 1 },
  counters: { flexDirection: "row", gap: 6 },
  counter: { flex: 1, minWidth: 0, borderRadius: 11, paddingVertical: 7, alignItems: "center" },
  counterValue: { fontSize: 15.5, lineHeight: 19, fontWeight: "900" },
  counterLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  trendBlock: { gap: 5 },
  trendTitle: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  trend: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: TREND_MAX_H },
  trendBar: { flex: 1, maxWidth: 22, borderRadius: 4 },
  resetBtn: { minHeight: 42, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  resetText: { fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  confirm: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  confirmTitle: { fontSize: 14, fontWeight: "900" },
  confirmBody: { fontSize: 12, lineHeight: 17 },
  confirmActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  confirmBtn: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontSize: 13.5, fontWeight: "800" },
  resetProgress: { gap: 8 },
  resetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resetRunningText: { flex: 1, fontSize: 13, fontWeight: "800" },
  resetPercent: { fontSize: 13, fontWeight: "900" },
  resetTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  resetFill: { height: "100%", borderRadius: 999 },
});
