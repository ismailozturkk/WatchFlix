// screens/bingo/CinemaBingoScreen.js
//
// Sinema Bingosu sayfası: aylık 3x3 kart, üç küçük haftalık hedef, çizgi/kare/seri ve "bir kare kaldı"
// çağrısı ve karelerin tam cümleleri. Kareler izleme kayıtlarından kendiliğinden işaretlenir
// (utils/cinemaBingo.js); sayfada işaretlenecek bir şey YOK — bilinçli.
//
// KUTLAMA: sayfa açıldığında kullanıcının henüz GÖRMEDİĞİ çizgi varsa (kayıt `seen` < çizgi) tek
// bir toast + titreşim çıkar ve görülen sayısı yazılır. Aynı çizgi bir daha kutlanmaz; kullanıcı
// sayfayı hiç açmadan çizgi yapsa da bir sonraki açılışta kutlanır.
//
// Ölçüler: kare genişliği onLayout ile ölçülen kutudan türer (320 pt'te de 3 sütun sığar).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import GlassPressable from "@components/common/GlassPressable";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useCinemaBingo from "@hooks/useCinemaBingo";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { triggerHaptic } from "@services/hapticsService";
import { BINGO_LINES, CENTER, cellsOnLines } from "@utils/cinemaBingo";
import { bingoCellIcon, bingoCellText, getBingoCopy } from "@utils/cinemaBingoCopy";
import { intlLocaleOf } from "@utils/appLanguages";
import { GameScreenShell } from "../game/GameScreenShell";

const TEAL = "#14B8A6";
const TEAL_INK = "#0F766E";
const GOLD = "#FFD76A";
const GOLD_INK = "#5B4300";
const FLAME = "#E0A100"; // açık ve koyu temada okunan altın
const GAP = 8;

function formatDay(dayKey, locale) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short" });
  } catch {
    return dayKey;
  }
}

export default function CinemaBingoScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getBingoCopy(language);
  const bingo = useCinemaBingo();
  const { result, bestLines, weekly, loading, streak, totals, previous, unseenLines, markSeen } = bingo;

  const [boardWidth, setBoardWidth] = useState(0);
  const cell = boardWidth ? Math.floor((boardWidth - GAP * 2) / 3) : 0;
  const onLine = useMemo(() => cellsOnLines(result.lines), [result.lines]);
  const range = copy.monthRange(formatDay(bingo.monthId, intlLocaleOf(language)), formatDay(bingo.monthEnd, intlLocaleOf(language)));

  // Açılış ölçümü: veri hazır olunca bir kez.
  const viewed = useRef(false);
  useEffect(() => {
    if (loading || viewed.current) return;
    viewed.current = true;
    trackEvent(ANALYTICS_EVENTS.BINGO_VIEWED, {
      source: route?.params?.source === "hub" ? "hub" : "other",
      lines: bestLines,
      squares: result.doneCount,
    });
  }, [loading, bestLines, result.doneCount, route?.params?.source]);

  // Kutlama: görülmemiş çizgi varsa bir kez.
  const celebrated = useRef(0);
  useEffect(() => {
    if (loading || unseenLines <= 0 || celebrated.current >= bestLines) return;
    celebrated.current = bestLines;
    triggerHaptic("success");
    toast.success(result.full ? copy.newFull : copy.newLine, copy.lines(bestLines));
    trackEvent(ANALYTICS_EVENTS.BINGO_LINE, { lines: bestLines, full: result.full, streak });
    markSeen(bestLines);
  }, [loading, unseenLines, bestLines, result.full, streak, copy, markSeen]);

  const onShare = useCallback(async () => {
    try {
      await Share.share({ message: copy.shareMessage(bestLines, result.doneCount, 9) });
      trackEvent(ANALYTICS_EVENTS.BINGO_SHARED, { lines: bestLines, squares: result.doneCount });
    } catch {
      // Kullanıcı vazgeçti ya da paylaşım kullanılamıyor: sessiz.
    }
  }, [copy, bestLines, result.doneCount]);

  const shareButton = (
    <GlassPressable
      onPress={onShare}
      accessibilityRole="button"
      accessibilityLabel={copy.share}
      hitSlop={6}
      style={[styles.shareBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <AppIcon family="Ionicons" name="share-outline" size={19} color={theme.text.primary} />
    </GlassPressable>
  );

  return (
    <GameScreenShell navigation={navigation} title={copy.title} subtitle={range} headerRight={shareButton}>
      <Text style={[styles.intro, { color: theme.text.secondary }]}>{copy.intro}</Text>

      <View style={[styles.weeklyBox, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.weeklyHeading}>
          <Text style={[styles.weeklyTitle, { color: theme.text.primary }]}>{copy.weeklyTitle}</Text>
          <Text style={[styles.weeklyCount, { color: TEAL }]}>{loading ? "–" : copy.weeklyCount(weekly.doneCount)}</Text>
        </View>
        <Text style={[styles.weeklyHint, { color: theme.text.secondary }]}>{copy.weeklyHint}</Text>
        {weekly.goals.map((goal) => (
          <View key={goal.id} style={styles.weeklyGoal} accessible accessibilityLabel={loading ? copy.loading : copy.cellA11y(copy.weeklyGoals[goal.id], goal.done)}>
            <AppIcon family="Ionicons" name={goal.done && !loading ? "checkmark-circle" : "ellipse-outline"} size={19} color={goal.done && !loading ? TEAL : theme.text.muted} />
            <Text style={[styles.weeklyGoalText, { color: theme.text.primary }]}>{copy.weeklyGoals[goal.id]}</Text>
            <Text style={[styles.weeklyGoalCount, { color: theme.text.muted }]}>{loading ? "–" : copy.progress(goal.have, goal.need)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stats}>
        <StatTile theme={theme} icon="trophy-outline" value={loading ? "–" : `${bestLines}/${BINGO_LINES.length}`} label={copy.linesLabel} />
        <StatTile theme={theme} icon="grid-outline" value={loading ? "–" : `${result.doneCount}/9`} label={copy.squaresLabel} />
        <StatTile theme={theme} icon="flame-outline" value={loading ? "–" : String(streak)} label={copy.streakLabel} />
      </View>

      <View onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)} style={styles.board}>
        {cell > 0
          ? result.cells.map((c, index) => {
              const text = bingoCellText(copy, c);
              const lit = onLine.has(index);
              const nearly = !c.done && result.oneAway.includes(index);
              const bg = c.done ? (lit ? GOLD : TEAL) : theme.secondary;
              const ink = c.done ? (lit ? GOLD_INK : "#FFFFFF") : theme.text.primary;
              return (
                <View
                  key={c.id}
                  accessible
                  accessibilityLabel={copy.cellA11y(text.long, c.done)}
                  style={[
                    styles.cell,
                    {
                      width: cell,
                      height: cell,
                      backgroundColor: bg,
                      borderColor: nearly ? GOLD : c.done ? "transparent" : theme.border,
                      borderWidth: nearly ? 2 : 1,
                    },
                    index === CENTER && !c.done ? { borderColor: TEAL, borderWidth: 1.5 } : null,
                  ]}
                >
                  <AppIcon
                    family="Ionicons"
                    name={c.done ? "checkmark-circle" : bingoCellIcon(c)}
                    size={22}
                    color={c.done ? ink : TEAL}
                  />
                  <Text
                    style={[styles.cellText, { color: ink }]}
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {text.short}
                  </Text>
                  {!c.done && c.need > 1 ? (
                    <Text style={[styles.cellProgress, { color: theme.text.muted }]}>
                      {copy.progress(c.have, c.need)}
                    </Text>
                  ) : null}
                </View>
              );
            })
          : null}
      </View>

      {!loading && !result.full && result.oneAway.length > 0 ? (
        <View style={[styles.banner, { backgroundColor: `${GOLD}26`, borderColor: `${GOLD}80` }]}>
          <AppIcon family="Ionicons" name="flame" size={18} color={FLAME} />
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>{copy.oneAway}</Text>
            <Text style={[styles.bannerBody, { color: theme.text.secondary }]}>{copy.oneAwayHint}</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{copy.howTitle.toUpperCase()}</Text>
      <View style={[styles.list, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {result.cells.map((c, index) => {
          const text = bingoCellText(copy, c);
          return (
            <View
              key={c.id}
              style={[
                styles.row,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: c.done ? `${TEAL}26` : `${theme.text.muted}1F` }]}>
                <AppIcon
                  family="Ionicons"
                  name={c.done ? "checkmark" : bingoCellIcon(c)}
                  size={16}
                  color={c.done ? TEAL_INK : theme.text.muted}
                />
              </View>
              <Text
                style={[
                  styles.rowText,
                  { color: c.done ? theme.text.muted : theme.text.primary },
                  c.done ? styles.rowTextDone : null,
                ]}
              >
                {text.long}
              </Text>
              <Text style={[styles.rowProgress, { color: c.done ? TEAL_INK : theme.text.muted }]}>
                {c.done ? copy.doneMark : copy.progress(c.have, c.need)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footerNotes}>
        {previous ? (
          <Text style={[styles.note, { color: theme.text.muted }]}>{copy.lastMonth(previous.lines)}</Text>
        ) : null}
        {totals.fullCards > 0 ? (
          <Text style={[styles.note, { color: theme.text.muted }]}>{copy.fullCards(totals.fullCards)}</Text>
        ) : null}
      </View>
    </GameScreenShell>
  );
}

function StatTile({ theme, icon, value, label }) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <AppIcon family="Ionicons" name={icon} size={16} color={TEAL} />
      <Text style={[styles.tileValue, { color: theme.text.primary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shareBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  intro: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  weeklyBox: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  weeklyHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  weeklyTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  weeklyCount: { fontSize: 13, fontWeight: "900" },
  weeklyHint: { fontSize: 12, lineHeight: 16 },
  weeklyGoal: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 26 },
  weeklyGoalText: { flex: 1, fontSize: 13, fontWeight: "600" },
  weeklyGoalCount: { fontSize: 12, fontWeight: "800" },

  stats: { flexDirection: "row", gap: GAP },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 12, alignItems: "center", gap: 2 },
  tileValue: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  tileLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },

  board: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  cell: {
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cellText: { fontSize: 12, lineHeight: 15, fontWeight: "800", textAlign: "center" },
  cellProgress: { fontSize: 10.5, fontWeight: "800" },

  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  bannerCopy: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: "900" },
  bannerBody: { fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 1 },

  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: 6, paddingHorizontal: 4 },
  list: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  rowIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "600" },
  rowTextDone: { textDecorationLine: "line-through" },
  rowProgress: { fontSize: 12, fontWeight: "800" },

  footerNotes: { gap: 2, paddingHorizontal: 4, paddingBottom: 6 },
  note: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
