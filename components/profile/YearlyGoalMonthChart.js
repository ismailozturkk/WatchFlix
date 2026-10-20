// components/profile/YearlyGoalMonthChart.js
//
// "Aylık plan": 12 ay için o ay İLK kez izlenen eser sayısı (çubuk) + planın aylık çizgisi
// (hedef / 12). Çubuk çizginin üstündeyse o ay plandan önde geçmiş. Gelecek aylar soluk
// çerçeve, içinde bulunulan ay vurgulu. Film ve dizi hedefi birlikte açıksa üstteki iki
// çipten biri seçilir.
//
// VERİYİ KENDİ OKUR (useProfileStats): sayfa kapalıyken bileşen hiç mount olmaz, bu yüzden aylık
// döküm (tüm geçmişi tarar) yalnız sayfa açıkken hesaplanır — profilde her zaman duran düğmeye
// maliyet yüklemez. Hesap `monthlyYearTitles` (saf, testli); aynı eser ilk görüldüğü ayda
// bir kez sayılır, toplam hedef halkasındaki sayıyla aynıdır.

import React, { memo, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useProfileStats } from "@context/ProfileStatsContext";
import { alpha } from "../../theme/colors";
import { intlLocaleOf } from "../../utils/appLanguages";
import { monthlyYearTitles } from "../../utils/yearlyGoal";
import { fillCopy, formatGoalNumber } from "./yearlyGoalCopy";
import GlassPressable from "../common/GlassPressable";

const BAR_AREA = 92;
const MIN_BAR = 3;

/** Dar ay adları ("O Ş M …"); Intl yoksa/hata verirse sayı. */
function monthLabels(language) {
  try {
    const formatter = new Intl.DateTimeFormat(intlLocaleOf(language), { month: "narrow", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(Date.UTC(2021, i, 15))));
  } catch {
    return Array.from({ length: 12 }, (_, i) => String(i + 1));
  }
}

/**
 * @param {object} props
 * @param {number} props.year
 * @param {Date} props.now
 * @param {Array<{track: string, kind: string, target: number, color: string, name: string}>} props.series
 *        Açık hatlar (taslaktaki hedefle); boşsa bileşen hiçbir şey çizmez.
 */
function YearlyGoalMonthChart({ theme, language, copy, year, now, series }) {
  const { movieHistoryItems, flatEpisodesTv } = useProfileStats() || {};
  const monthly = useMemo(
    () => monthlyYearTitles({ movieEntries: movieHistoryItems || [], episodes: flatEpisodesTv || [], year }),
    [movieHistoryItems, flatEpisodesTv, year],
  );
  const labels = useMemo(() => monthLabels(language), [language]);
  const [picked, setPicked] = useState(null);

  if (!series.length) return null;
  // Seçili hat kapanmış olabilir → ilk açık hatta düş.
  const active = series.find((item) => item.track === picked) || series[0];
  const values = monthly[active.kind] || [];
  const plan = active.target / 12;
  const peak = Math.max(plan, ...values, 1);
  const currentMonth = now.getFullYear() === year ? now.getMonth() : now.getFullYear() > year ? 11 : -1;
  const total = values.reduce((sum, value) => sum + value, 0);
  const planBottom = (plan / (peak * 1.12)) * BAR_AREA;

  return (
    <View
      testID="yearly-goal-chart"
      style={[styles.card, { backgroundColor: theme.between, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>{copy.chart.title}</Text>
          <Text testID="yearly-goal-chart-plan" style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
            {fillCopy(copy.chart.plan, { n: formatGoalNumber(plan, language) })}
          </Text>
        </View>
        {series.length > 1 ? (
          <View style={styles.tabs}>
            {series.map((item) => {
              const selected = item.track === active.track;
              return (
                <GlassPressable
                  key={item.track}
                  testID={`yearly-goal-chart-tab-${item.track}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPicked(item.track)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: selected ? alpha(item.color, 0.2) : theme.secondary,
                      borderColor: selected ? item.color : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.tabText, { color: selected ? theme.text.primary : theme.text.secondary }]}>
                    {item.name}
                  </Text>
                </GlassPressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={[styles.chart, { height: BAR_AREA + 18 }]}>
        {/* Plan çizgisi: çubukların ARKASINDA, tam genişlikte. */}
        <View
          testID="yearly-goal-chart-line"
          pointerEvents="none"
          style={[styles.planLine, { bottom: 18 + planBottom, backgroundColor: alpha(theme.text.primary, 0.45) }]}
        />
        {values.map((value, index) => {
          const future = currentMonth >= 0 ? index > currentMonth : false;
          const isNow = index === currentMonth;
          const height = value > 0 ? Math.max(MIN_BAR, (value / (peak * 1.12)) * BAR_AREA) : 0;
          return (
            <View key={index} style={styles.column}>
              <View style={[styles.barSlot, { height: BAR_AREA }]}>
                {value > 0 ? (
                  <Text allowFontScaling={false} style={[styles.value, { color: theme.text.secondary }]}>
                    {value}
                  </Text>
                ) : null}
                <View
                  testID={`yearly-goal-bar-${index}`}
                  style={[
                    styles.bar,
                    future
                      ? { height: MIN_BAR, backgroundColor: alpha(theme.text.muted, 0.25) }
                      : {
                          height,
                          backgroundColor: active.color,
                          opacity: isNow ? 1 : 0.78,
                        },
                  ]}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.month,
                  { color: isNow ? theme.text.primary : theme.text.muted, fontWeight: isNow ? "900" : "700" },
                ]}
              >
                {labels[index]}
              </Text>
            </View>
          );
        })}
      </View>

      {total === 0 ? (
        <Text testID="yearly-goal-chart-empty" style={[styles.empty, { color: theme.text.muted }]}>
          {copy.chart.empty}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "800" },
  subtitle: { fontSize: 11.5, fontWeight: "600", marginTop: 1 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 10, height: 28, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 12, fontWeight: "800" },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 14 },
  planLine: { position: "absolute", left: 0, right: 0, height: 1 },
  column: { flex: 1, minWidth: 0, alignItems: "center" },
  barSlot: { width: "100%", alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "70%", maxWidth: 22, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  value: { fontSize: 9, fontWeight: "800", marginBottom: 2, fontVariant: ["tabular-nums"] },
  month: { fontSize: 10, marginTop: 5, height: 13 },
  empty: { fontSize: 11.5, lineHeight: 16, fontWeight: "600", textAlign: "center", marginTop: 10 },
});

export default memo(YearlyGoalMonthChart);
