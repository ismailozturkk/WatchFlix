// components/top100/Top100VoteSheet.js
//
// Seelogd Top 100 oy sayfası: afiş + başlık, TMDB / Seelogd / birleşik puan şeridi ve 1–10 puan ızgarası.
// Puan TMDB oylamasına eklenir (bkz. utils/top100.combinedScore). Kayıt işini çağıran yapar (`onSubmit` → Promise);
// sayfa yalnız seçimi ve "kaydediliyor" durumunu tutar. Önceki oy varsa ızgara onunla başlar, düğme "güncelle" der.

import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import { useTheme } from "@context/ThemeContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { triggerHaptic } from "@services/hapticsService";
import { formatScore, MAX_SCORE, MIN_SCORE } from "@utils/top100";

const noop = () => {};
const SCORES = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

/** Puan → renk (düşük kırmızı, orta amber, yüksek yeşil); seçili hücre ve büyük rakam bunu kullanır. */
export function scoreColor(score) {
  if (score >= 9) return "#16A34A";
  if (score >= 7) return "#65A30D";
  if (score >= 5) return "#D97706";
  if (score >= 3) return "#EA580C";
  return "#DC2626";
}

export default function Top100VoteSheet({ visible, item, myScore, copy, onClose, onSubmit, onDismissed }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const [selected, setSelected] = useState(myScore || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelected(myScore || null);
  }, [visible, item?.key, myScore]);

  const changed = !!selected && selected !== myScore;
  const seelogdAvg = item?.count > 0 ? item.sum / item.count : 0;

  const submit = async () => {
    if (!changed || saving) return;
    setSaving(true);
    try {
      await onSubmit?.(selected);
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: copy.tmdb, value: formatScore(item?.tmdbAvg) },
    { label: copy.seelogdAvg, value: seelogdAvg > 0 ? formatScore(seelogdAvg) : "–", sub: copy.votes(item?.count || 0) },
    { label: copy.combined, value: formatScore(item?.avg), accent: true },
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={saving ? noop : onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={[styles.poster, { backgroundColor: theme.border }]}>
          {item?.poster_path ? (
            <Image
              source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
            {item?.title}
          </Text>
          <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>
            {[item?.media_type === "tv" ? copy.tv : copy.movie, item?.year].filter(Boolean).join(" · ")}
          </Text>
          {item?.rank ? (
            <View style={[styles.rankPill, { backgroundColor: `${theme.accent}22` }]}>
              <AppIcon family="Ionicons" name="trophy" size={11} color={theme.accent} />
              <Text style={[styles.rankText, { color: theme.accent }]}>{`#${item.rank}`}</Text>
            </View>
          ) : (
            <Text style={[styles.meta, { color: theme.text.muted, marginTop: 6 }]}>{copy.outside}</Text>
          )}
        </View>
        <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
      </View>

      <View style={[styles.stats, { borderColor: theme.border }]}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
            <Text style={[styles.statValue, { color: stat.accent ? theme.accent : theme.text.primary }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>
              {stat.label}
            </Text>
            {stat.sub ? (
              <Text style={[styles.statSub, { color: theme.text.muted }]} numberOfLines={1}>
                {stat.sub}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.choice}>
        <Text style={[styles.choiceNumber, { color: selected ? scoreColor(selected) : theme.text.muted }]}>
          {selected || "–"}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.choiceLabel, { color: theme.text.primary }]}>
            {selected ? copy.scoreLabel(selected) : copy.vote}
          </Text>
          <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.voteHint}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {SCORES.map((score) => {
          const active = selected === score;
          return (
            <GlassTouchable
              key={score}
              glass={false}
              onPress={() => {
                triggerHaptic("selection");
                setSelected(score);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${score}, ${copy.scoreLabel(score)}`}
              style={[
                styles.cell,
                { backgroundColor: theme.primary, borderColor: theme.border },
                active && { backgroundColor: scoreColor(score), borderColor: scoreColor(score) },
              ]}
            >
              <Text style={[styles.cellText, { color: active ? "#FFFFFF" : theme.text.primary }]}>{score}</Text>
              {myScore === score && !active ? <View style={[styles.mineDot, { backgroundColor: theme.accent }]} /> : null}
            </GlassTouchable>
          );
        })}
      </View>

      <GlassTouchable
        glass={false}
        onPress={submit}
        disabled={!changed || saving}
        accessibilityRole="button"
        style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: !changed || saving ? 0.5 : 1 }]}
      >
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <AppIcon family="Ionicons" name="star" size={16} color="#fff" />}
        <Text style={styles.saveText}>{saving ? copy.saving : myScore ? copy.updateVote : copy.saveVote}</Text>
      </GlassTouchable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  poster: { width: 56, height: 84, borderRadius: 10, overflow: "hidden" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: "900", lineHeight: 22 },
  meta: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 7,
  },
  rankText: { fontSize: 11.5, fontWeight: "900" },
  stats: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    marginTop: 16,
    paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statValue: { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  statSub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  choice: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 },
  choiceNumber: { fontSize: 40, fontWeight: "900", minWidth: 50, textAlign: "center", fontVariant: ["tabular-nums"] },
  choiceLabel: { fontSize: 16, fontWeight: "900" },
  hint: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  // 5 sütun: (100% − 4 boşluk) / 5 ≈ %18,4.
  cell: {
    width: "18.4%",
    flexGrow: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  mineDot: { position: "absolute", bottom: 6, width: 4, height: 4, borderRadius: 2 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    marginTop: 18,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
