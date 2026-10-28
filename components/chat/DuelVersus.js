// components/chat/DuelVersus.js
//
// Düello kartlarının (SharedChallengeMessage, SharedDuelResultMessage) ortak parçaları:
//   • DuelStatusChip : başlığın altındaki durum hapı (bekleniyor / kabul edildi / bitti / süresi doldu)
//   • DuelVersus     : iki taraf yan yana — baş harf rozeti, ad, skor; kazananın üstünde taç ve vurgu
//                      halkası, altta iki skorun oranını gösteren ayrık çubuk. Skoru henüz olmayan taraf
//                      "?" ve kum saati ile çizilir.
//   • DuelVerdict    : kazandın / geride kaldın / berabere satırı
//
// Renkler balon paletinden (shareKit.sharePalette) gelir; giden balonda (vurgu zemini) yeşil/kırmızı yerine
// beyaz kullanılır ki okunurluk düşmesin.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { formatDuelScore } from "../../utils/dailyDuel";

export const DUEL_AMBER = "#F59E0B";
export const DUEL_WIN = "#22C55E";
export const DUEL_LOSE = "#EF4444";

const initialOf = (name) => {
  const first = String(name || "").trim().charAt(0);
  return first ? first.toLocaleUpperCase() : "?";
};

/**
 * @param {"waiting"|"accepted"|"done"|"expired"} tone
 */
export const DuelStatusChip = memo(function DuelStatusChip({ tone, label, palette, isOutgoing }) {
  const color = isOutgoing
    ? palette.primary
    : tone === "accepted" || tone === "done"
      ? DUEL_WIN
      : tone === "expired"
        ? palette.muted
        : DUEL_AMBER;
  const icon =
    tone === "accepted" ? "checkmark-circle" : tone === "done" ? "flag" : tone === "expired" ? "time-outline" : "hourglass-outline";
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: isOutgoing ? palette.surface : alpha(color, 0.12), borderColor: isOutgoing ? palette.surfaceBorder : alpha(color, 0.34) },
      ]}
    >
      <Ionicons name={icon} size={12} color={color} />
      <Text allowFontScaling={false} style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

/**
 * @param {object} p
 * @param {{ label: string, score: number|null }} p.left
 * @param {{ label: string, score: number|null }} p.right
 * @param {"left"|"right"|null} p.winner
 */
export const DuelVersus = memo(function DuelVersus({ left, right, winner, palette, isOutgoing, accessibilityLabel }) {
  const l = Number.isFinite(left.score) ? left.score : null;
  const r = Number.isFinite(right.score) ? right.score : null;
  const both = l !== null && r !== null;
  const sum = both ? l + r : 0;
  // İkisi de 0 ise eşit böl; aksi halde oran (çok küçük pay da görünür kalsın).
  const leftShare = both ? (sum === 0 ? 0.5 : Math.min(0.92, Math.max(0.08, l / sum))) : 0.5;
  const ink = (side) => (isOutgoing ? palette.primary : winner === side ? DUEL_WIN : winner && winner !== side ? palette.secondary : palette.primary);
  const barColor = (side) =>
    isOutgoing
      ? winner === side ? palette.primary : palette.tile
      : !both ? palette.surfaceBorder : winner === side ? DUEL_WIN : winner === null ? DUEL_AMBER : alpha(DUEL_LOSE, 0.66);

  return (
    <View
      style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.row}>
        <Side data={left} score={l} strong={winner === "left"} ink={ink("left")} palette={palette} isOutgoing={isOutgoing} />
        <View style={[styles.vsDisc, { backgroundColor: palette.tile }]}>
          <Text allowFontScaling={false} style={[styles.vs, { color: palette.tileInk }]}>
            VS
          </Text>
        </View>
        <Side data={right} score={r} strong={winner === "right"} ink={ink("right")} palette={palette} isOutgoing={isOutgoing} />
      </View>
      <View style={styles.bar}>
        <View style={[styles.barPart, { flex: leftShare, backgroundColor: barColor("left") }]} />
        <View style={[styles.barPart, { flex: 1 - leftShare, backgroundColor: barColor("right") }]} />
      </View>
    </View>
  );
});

function Side({ data, score, strong, ink, palette, isOutgoing }) {
  const ring = strong ? (isOutgoing ? palette.primary : DUEL_WIN) : palette.surfaceBorder;
  return (
    <View style={styles.side}>
      <View style={styles.crownSlot}>
        {strong ? <Ionicons name="trophy" size={13} color={isOutgoing ? palette.primary : DUEL_AMBER} /> : null}
      </View>
      <View style={[styles.monogram, { backgroundColor: palette.tile, borderColor: ring }]}>
        <Text allowFontScaling={false} style={[styles.monogramText, { color: palette.tileInk }]}>
          {initialOf(data.label)}
        </Text>
      </View>
      <Text allowFontScaling={false} style={[styles.label, { color: palette.muted }]} numberOfLines={1}>
        {data.label}
      </Text>
      {score === null ? (
        <View style={styles.pending}>
          <Ionicons name="hourglass-outline" size={16} color={palette.muted} />
          <Text allowFontScaling={false} style={[styles.score, { color: palette.muted }]}>
            ?
          </Text>
        </View>
      ) : (
        <Text allowFontScaling={false} style={[styles.score, { color: ink }, strong ? styles.scoreStrong : null]} numberOfLines={1}>
          {formatDuelScore(score)}
        </Text>
      )}
    </View>
  );
}

/** @param {"win"|"lose"|"tie"|"decided"} verdict */
export const DuelVerdict = memo(function DuelVerdict({ verdict, text, palette, isOutgoing }) {
  const color = verdict === "win" || verdict === "decided" ? DUEL_WIN : verdict === "lose" ? DUEL_LOSE : DUEL_AMBER;
  const icon = verdict === "win" || verdict === "decided" ? "trophy" : verdict === "lose" ? "trending-down" : "remove-circle";
  return (
    <View
      style={[
        styles.verdict,
        isOutgoing
          ? { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }
          : { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.4) },
      ]}
    >
      <Ionicons name={icon} size={15} color={isOutgoing ? palette.primary : color} />
      <Text allowFontScaling={false} style={[styles.verdictText, { color: palette.primary }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipText: { fontSize: 11, fontWeight: "800", flexShrink: 1 },

  panel: { marginTop: 8, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  side: { flex: 1, alignItems: "center", minWidth: 0 },
  crownSlot: { height: 15, justifyContent: "flex-end" },
  monogram: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  monogramText: { fontSize: 14, fontWeight: "900" },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2, marginTop: 4, maxWidth: "100%" },
  score: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  scoreStrong: { fontSize: 28, fontWeight: "900", lineHeight: 34 },
  pending: { flexDirection: "row", alignItems: "center", gap: 3, height: 34 },
  vsDisc: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
  vs: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },

  bar: { flexDirection: "row", height: 6, marginTop: 10, borderRadius: 3, overflow: "hidden", gap: 2 },
  barPart: { height: 6, borderRadius: 3 },

  verdict: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  verdictText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1, textAlign: "center" },
});
