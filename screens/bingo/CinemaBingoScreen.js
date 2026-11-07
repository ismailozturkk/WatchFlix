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
import WatchBadgeCard from "@components/badges/WatchBadgeCard";
import GlassPressable from "@components/common/GlassPressable";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import useCinemaBingo from "@hooks/useCinemaBingo";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { triggerHaptic } from "@services/hapticsService";
import { BINGO_LINES, CENTER, cellsOnLines } from "@utils/cinemaBingo";
import { bingoCellIcon, bingoCellText, getBingoCopy } from "@utils/cinemaBingoCopy";
import { intlLocaleOf } from "@utils/appLanguages";
import { GameScreenShell } from "../game/GameScreenShell";

const TEAL = "#14B8A6";
const TEAL_DEEP = "#075E59";
const TEAL_DARK = "#064E4A";
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
  const watchProgress = useWatchProgressContext() || {};
  const { result, bestLines, weekly, loading, streak, totals, previous, daysLeft, unseenLines, markSeen } = bingo;
  const bingoBadge = useMemo(
    () => watchProgress.kartlar?.find((badge) => badge.family === "bingo") || null,
    [watchProgress.kartlar],
  );

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
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroGlowLarge} />
        <View pointerEvents="none" style={styles.heroGlowSmall} />
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}>
            <AppIcon family="Ionicons" name="calendar-outline" size={13} color="#FFFFFF" />
            <Text style={styles.heroBadgeText}>{copy.eyebrow}</Text>
          </View>
          <View style={[styles.heroBadge, styles.heroBadgeWarm]}>
            <AppIcon family="Ionicons" name="time-outline" size={13} color={GOLD} />
            <Text style={[styles.heroBadgeText, styles.heroBadgeTextWarm]}>{copy.daysLeft(daysLeft)}</Text>
          </View>
        </View>
        <Text style={styles.intro}>{copy.intro}</Text>
        <View style={styles.heroStats}>
          <HeroStat icon="trophy-outline" value={loading ? "–" : `${bestLines}/${BINGO_LINES.length}`} label={copy.linesLabel} />
          <View style={styles.heroDivider} />
          <HeroStat icon="grid-outline" value={loading ? "–" : `${result.doneCount}/9`} label={copy.squaresLabel} />
          <View style={styles.heroDivider} />
          <HeroStat icon="flame-outline" value={loading ? "–" : String(streak)} label={copy.streakLabel} />
        </View>
      </View>

      <View style={[styles.boardCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.boardHeading}>
          <View>
            <Text style={[styles.boardEyebrow, { color: TEAL }]}>{copy.eyebrow}</Text>
            <Text style={[styles.boardTitle, { color: theme.text.primary }]}>{copy.squares(result.doneCount, 9)}</Text>
          </View>
          <View style={[styles.boardScore, { backgroundColor: `${TEAL}1F`, borderColor: `${TEAL}55` }]}>
            <AppIcon family="Ionicons" name="trophy-outline" size={14} color={TEAL} />
            <Text style={styles.boardScoreText}>{loading ? "–" : copy.lines(bestLines)}</Text>
          </View>
        </View>
        <View style={[styles.boardTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.boardTrackFill, { width: `${loading ? 0 : (result.doneCount / 9) * 100}%` }]} />
        </View>
        <View onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)} style={styles.board}>
          {cell > 0
            ? result.cells.map((c, index) => {
                const text = bingoCellText(copy, c);
                const lit = onLine.has(index);
                const nearly = !c.done && result.oneAway.includes(index);
                const bg = c.done ? (lit ? GOLD : TEAL) : theme.primary;
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
                    {c.done ? <View pointerEvents="none" style={styles.cellShine} /> : null}
                    <View style={[styles.cellIcon, c.done ? styles.cellIconDone : { backgroundColor: `${TEAL}18` }]}>
                      <AppIcon
                        family="Ionicons"
                        name={c.done ? "checkmark" : bingoCellIcon(c)}
                        size={17}
                        color={c.done ? ink : TEAL}
                      />
                    </View>
                    <Text
                      style={[styles.cellText, { color: ink }]}
                      numberOfLines={3}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                    >
                      {text.short}
                    </Text>
                    {!c.done && c.need > 1 ? (
                      <View style={[styles.cellProgressPill, { backgroundColor: theme.secondary }]}>
                        <Text style={[styles.cellProgress, { color: theme.text.muted }]}>{copy.progress(c.have, c.need)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
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

      {bingoBadge ? (
        <View style={styles.badgeSection}>
          <View style={styles.badgeHeading}>
            <View style={[styles.badgeHeadingIcon, { backgroundColor: `${GOLD}24`, borderColor: `${GOLD}66` }]}>
              <AppIcon family="Ionicons" name="ribbon-outline" size={17} color={FLAME} />
            </View>
            <View style={styles.badgeHeadingCopy}>
              <Text style={[styles.badgeTitle, { color: theme.text.primary }]}>{copy.badgeTitle}</Text>
              <Text style={[styles.badgeHint, { color: theme.text.muted }]}>{copy.badgeHint}</Text>
            </View>
          </View>
          <WatchBadgeCard badge={bingoBadge} />
        </View>
      ) : null}

      <View style={[styles.weeklyBox, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.weeklyHeading}>
          <View style={[styles.weeklyIcon, { backgroundColor: `${TEAL}1F` }]}>
            <AppIcon family="Ionicons" name="sparkles-outline" size={18} color={TEAL} />
          </View>
          <View style={styles.weeklyHeadingCopy}>
            <Text style={[styles.weeklyTitle, { color: theme.text.primary }]}>{copy.weeklyTitle}</Text>
            <Text style={[styles.weeklyHint, { color: theme.text.secondary }]}>{copy.weeklyHint}</Text>
          </View>
          <View style={[styles.weeklyCountPill, { backgroundColor: `${TEAL}1F` }]}>
            <Text style={styles.weeklyCount}>{loading ? "–" : copy.weeklyCount(weekly.doneCount)}</Text>
          </View>
        </View>
        <View style={styles.weeklyGoals}>
          {weekly.goals.map((goal, index) => {
            const done = goal.done && !loading;
            const ratio = loading ? 0 : Math.min(1, goal.have / Math.max(goal.need, 1));
            return (
              <View
                key={goal.id}
                style={[styles.weeklyGoal, index > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}
                accessible
                accessibilityLabel={loading ? copy.loading : copy.cellA11y(copy.weeklyGoals[goal.id], goal.done)}
              >
                <View style={[styles.weeklyCheck, { backgroundColor: done ? TEAL : theme.primary, borderColor: done ? TEAL : theme.border }]}>
                  <AppIcon family="Ionicons" name={done ? "checkmark" : "ellipse-outline"} size={15} color={done ? "#FFFFFF" : theme.text.muted} />
                </View>
                <View style={styles.weeklyGoalCopy}>
                  <Text style={[styles.weeklyGoalText, { color: theme.text.primary }]}>{copy.weeklyGoals[goal.id]}</Text>
                  <View style={[styles.goalTrack, { backgroundColor: theme.border }]}>
                    <View style={[styles.goalTrackFill, { width: `${ratio * 100}%` }]} />
                  </View>
                </View>
                <Text style={[styles.weeklyGoalCount, { color: done ? TEAL : theme.text.muted }]}>{loading ? "–" : copy.progress(goal.have, goal.need)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{copy.howTitle}</Text>
        <View style={[styles.sectionCount, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Text style={[styles.sectionCountText, { color: theme.text.muted }]}>{loading ? "–" : `${result.doneCount}/9`}</Text>
        </View>
      </View>
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
              <View style={[styles.rowProgressPill, { backgroundColor: c.done ? `${TEAL}1F` : theme.primary }]}>
                <Text style={[styles.rowProgress, { color: c.done ? TEAL_INK : theme.text.muted }]}>
                  {c.done ? copy.doneMark : copy.progress(c.have, c.need)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {previous || totals.fullCards > 0 ? (
        <View style={[styles.footerNotes, { backgroundColor: `${TEAL}12`, borderColor: `${TEAL}3D` }]}>
          <AppIcon family="Ionicons" name="ribbon-outline" size={18} color={TEAL} />
          <View style={styles.footerNoteCopy}>
            {previous ? <Text style={[styles.note, { color: theme.text.secondary }]}>{copy.lastMonth(previous.lines)}</Text> : null}
            {totals.fullCards > 0 ? <Text style={[styles.note, { color: theme.text.muted }]}>{copy.fullCards(totals.fullCards)}</Text> : null}
          </View>
        </View>
      ) : null}
    </GameScreenShell>
  );
}

function HeroStat({ icon, value, label }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatTop}>
        <AppIcon family="Ionicons" name={icon} size={15} color={GOLD} />
        <Text style={styles.heroStatValue} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shareBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: TEAL_DEEP,
    borderRadius: 24,
    padding: 17,
    overflow: "hidden",
    shadowColor: TEAL_DARK,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroGlowLarge: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -70, top: -95, backgroundColor: "rgba(255,255,255,0.09)" },
  heroGlowSmall: { position: "absolute", width: 90, height: 90, borderRadius: 45, left: -34, bottom: -55, backgroundColor: "rgba(255,215,106,0.10)" },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 9, paddingVertical: 5 },
  heroBadgeWarm: { backgroundColor: "rgba(255,215,106,0.10)", borderColor: "rgba(255,215,106,0.24)" },
  heroBadgeText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.5 },
  heroBadgeTextWarm: { color: GOLD },
  intro: { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19, fontWeight: "550", marginTop: 13, maxWidth: 520 },
  heroStats: { flexDirection: "row", alignItems: "stretch", marginTop: 16, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.14)", paddingVertical: 11, paddingHorizontal: 7 },
  heroStat: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 0 },
  heroStatTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroStatValue: { color: "#FFFFFF", fontSize: 18, lineHeight: 22, fontWeight: "900", letterSpacing: -0.25 },
  heroStatLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10.5, lineHeight: 14, fontWeight: "750", marginTop: 1 },
  heroDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.18)", marginVertical: 2 },

  boardCard: { borderRadius: 24, borderWidth: 1, padding: 12, paddingTop: 14, shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  boardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 3, marginBottom: 9 },
  boardEyebrow: { fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 0.9 },
  boardTitle: { fontSize: 17, lineHeight: 22, fontWeight: "900", letterSpacing: -0.25, marginTop: 1 },
  boardScore: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  boardScoreText: { color: TEAL, fontSize: 11.5, fontWeight: "900" },
  boardTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginHorizontal: 3, marginBottom: 11 },
  boardTrackFill: { height: "100%", borderRadius: 2, backgroundColor: TEAL },
  board: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  cell: {
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    overflow: "hidden",
  },
  cellShine: { position: "absolute", width: 70, height: 70, borderRadius: 35, right: -38, top: -38, backgroundColor: "rgba(255,255,255,0.14)" },
  cellIcon: { width: 27, height: 27, borderRadius: 13.5, alignItems: "center", justifyContent: "center" },
  cellIconDone: { backgroundColor: "rgba(255,255,255,0.18)" },
  cellText: { fontSize: 11.5, lineHeight: 14, fontWeight: "850", textAlign: "center" },
  cellProgressPill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  cellProgress: { fontSize: 9.5, lineHeight: 12, fontWeight: "850" },

  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  bannerCopy: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: "900" },
  bannerBody: { fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 1 },

  badgeSection: { gap: 9, marginTop: 3 },
  badgeHeading: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 3 },
  badgeHeadingIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badgeHeadingCopy: { flex: 1, minWidth: 0 },
  badgeTitle: { fontSize: 15, lineHeight: 19, fontWeight: "900", letterSpacing: -0.15 },
  badgeHint: { fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 1 },

  weeklyBox: { borderRadius: 22, borderWidth: 1, padding: 14 },
  weeklyHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  weeklyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  weeklyHeadingCopy: { flex: 1, minWidth: 0 },
  weeklyTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: "850" },
  weeklyCountPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  weeklyCount: { color: TEAL, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  weeklyHint: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  weeklyGoals: { marginTop: 10 },
  weeklyGoal: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 49, paddingVertical: 8 },
  weeklyCheck: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  weeklyGoalCopy: { flex: 1, minWidth: 0 },
  weeklyGoalText: { fontSize: 12.5, lineHeight: 16, fontWeight: "700" },
  weeklyGoalCount: { fontSize: 11.5, fontWeight: "850", minWidth: 28, textAlign: "right" },
  goalTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: 5 },
  goalTrackFill: { height: "100%", borderRadius: 2, backgroundColor: TEAL },

  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginTop: 5 },
  sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: "900", letterSpacing: -0.2 },
  sectionCount: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  sectionCountText: { fontSize: 11, lineHeight: 14, fontWeight: "850" },
  list: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowIcon: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "650" },
  rowTextDone: { textDecorationLine: "line-through" },
  rowProgressPill: { borderRadius: 999, minWidth: 42, paddingHorizontal: 7, paddingVertical: 4, alignItems: "center" },
  rowProgress: { fontSize: 10.5, fontWeight: "850" },

  footerNotes: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  footerNoteCopy: { flex: 1, gap: 1 },
  note: { fontSize: 11.5, lineHeight: 16, fontWeight: "650" },
});
