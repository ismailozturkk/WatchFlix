// components/streak/StreakFlameSheet.js
//
// Seri rozetine dokununca açılan alt sayfa:
//   • büyük canlı alev + seri sayısı + ay rengi
//   • AY · HAFTA · GÜN sütunları — seri bu üçünün toplamı (47 = 1 ay 2 hafta 3 gün)
//   • bugünün durumu: yandı / risk / telafi bekliyor (x/2) / kalkan koruyacak
//   • sonraki hafta ve ay kademesine kalan gün
//   • seri koruması: telafi hakkı (hazır / N gün sonra) ve kalkanlar (n/2)
//   • 13 basamaklı ay merdiveni (yatay kaydırılır), rekor, "nasıl çalışır"
//
// Merdivendeki küçük alevler DURGUN çizilir (animated=false): on üç alevin ayrı
// saati sayfayı ağırlaştırırdı, hareket tek büyük alevde.
//
// ÇIKIŞ PENCERESİ: `visible` düştükten sonra sayfa ≈260 ms daha çizilir
// (BottomSheetModal). `state` profil verisinden gelir ve kapanışta sıfırlanmaz,
// yani bu pencerede boş içerik görünmez.

import React, { memo, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassTouchable from "@components/common/GlassTouchable";
import SheetScroll from "@components/common/SheetScroll";
import { alpha } from "@theme/colors";
import { intlLocaleOf } from "@utils/appLanguages";
import {
  DAYS_PER_WEEK,
  STREAK_MONTHS,
  WEEKS_PER_MONTH,
  streakLook,
  streakFlameState,
} from "@utils/streakFlame";
import { getStreakFlameCopy, streakLevelText } from "@utils/streakFlameCopy";
import StreakFlame from "./StreakFlame";

const HERO_FLAME = 118;
const LADDER_FLAME = 28;
// Sayfa hazır olmayan bir durumla çizilirse (çıkış penceresi) ilk kademe.
const FALLBACK_STATE = streakFlameState({ gunSerisi: 3, bugunAktif: true });
const OK_COLOR = "#2FBF71";
const WARN_COLOR = "#F5A524";

const STATUS_ICON = Object.freeze({
  lit: "checkmark-circle",
  risk: "hourglass",
  repair: "bandage",
  shield: "shield-checkmark",
});

// Basamak alevleri yalnız paletle çizilir: efektsiz, tam boy.
const LADDER_LOOKS = STREAK_MONTHS.map((palette) => ({ palette, effects: [], heat: 1, intensity: 0, growth: 1 }));

function Pips({ total, filled, color, track }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < filled ? color : track }]} />
      ))}
    </View>
  );
}

function LevelColumn({ label, value, children, theme }) {
  return (
    <View style={styles.levelCol}>
      <Text allowFontScaling={false} style={[styles.levelValue, { color: theme.text.primary }]}>
        {value}
      </Text>
      <Text allowFontScaling={false} style={[styles.levelLabel, { color: theme.text.muted }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ProtectionItem({ icon, title, value, valueColor, theme, accent }) {
  return (
    <View style={styles.protItem}>
      <View style={[styles.protIcon, { backgroundColor: alpha(accent, 0.14) }]}>
        <AppIcon family="Ionicons" name={icon} size={14} color={accent} />
      </View>
      <View style={styles.protBody}>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.protTitle, { color: theme.text.muted }]}>
          {title}
        </Text>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.protValue, { color: valueColor }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function StreakFlameSheet({ visible, onClose, state: stateProp, theme, language, animated = true }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const copy = getStreakFlameCopy(language);
  // BottomSheet kapanış animasyonu sırasında profil verisi eşik altına düşebilir.
  // Sahte 3 günlük fallback göstermek yerine son gerçek görünür durumu koru.
  const lastVisibleState = useRef(FALLBACK_STATE);
  if (stateProp?.visible) lastVisibleState.current = stateProp;
  const state = stateProp?.visible ? stateProp : lastVisibleState.current;
  const { level, look, next, protection } = state;
  const palette = look.palette;
  const locale = intlLocaleOf(language);
  const track = alpha(theme.text.muted, 0.18);
  const statusColor = state.status === "lit" ? OK_COLOR : state.status === "risk" ? WARN_COLOR : palette.text;
  const statusText = state.status === "repair"
    ? copy.status.repair(protection.repairHave, protection.repairNeed)
    : copy.status[state.status];
  const nextLook = next.nextPalette ? streakLook(next.monthAt) : null;

  // Her açılışta ayrıntı metni kapalı başlar; böylece ana kademe özeti kompakt kalır.
  useEffect(() => {
    if (!visible) setInfoOpen(false);
  }, [visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={30}
      dimColor="rgba(0,0,0,0.45)"
      sheetStyle={styles.sheetWrap}
    >
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <SheetScroll contentContainerStyle={styles.content}>
          {/* Kahraman: büyük alev + sayı. Hale/halkalar alev kutusunun dışına
              taştığı için kutu yüksekliği bunlara yer bırakacak kadar geniş. */}
          <View style={styles.hero}>
            <StreakFlame look={look} size={HERO_FLAME} animated={animated && visible} dimmed={state.dimmed} />
          </View>
          <Text allowFontScaling={false} style={[styles.days, { color: palette.text }]}>
            {state.days.toLocaleString(locale)}
          </Text>
          <Text allowFontScaling={false} style={[styles.daysLabel, { color: theme.text.muted }]}>
            {copy.dayStreak}
          </Text>
          <View style={styles.summaryHead}>
            <View
              style={[
                styles.tierChip,
                { backgroundColor: alpha(palette.glow, 0.16), borderColor: alpha(palette.glow, 0.45) },
              ]}
            >
              <AppIcon family="Ionicons" name="flame" size={13} color={palette.text} />
              <Text allowFontScaling={false} style={[styles.tierChipText, { color: palette.text }]}>
                {copy.palettes[palette.id]} · {streakLevelText(copy, level)}
              </Text>
            </View>
            <GlassTouchable
              testID="streak-info-toggle"
              style={[
                styles.infoButton,
                {
                  backgroundColor: infoOpen ? alpha(palette.glow, 0.16) : alpha(theme.text.muted, 0.08),
                  borderColor: infoOpen ? alpha(palette.glow, 0.45) : alpha(theme.text.muted, 0.2),
                },
              ]}
              onPress={() => setInfoOpen((open) => !open)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={copy.howTitle}
              accessibilityHint={copy.howHint}
              accessibilityState={{ expanded: infoOpen }}
            >
              <AppIcon
                family="Ionicons"
                name={infoOpen ? "alert-circle" : "alert-circle-outline"}
                size={20}
                color={infoOpen ? palette.text : theme.text.secondary}
              />
            </GlassTouchable>
          </View>

          {infoOpen ? (
            <View
              testID="streak-info-panel"
              style={[
                styles.infoPanel,
                { backgroundColor: alpha(palette.glow, 0.08), borderColor: alpha(palette.glow, 0.26) },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.infoTitle, { color: theme.text.primary }]}>
                {copy.howTitle}
              </Text>
              <Text allowFontScaling={false} style={[styles.how, { color: theme.text.muted }]}>
                {copy.how}
              </Text>
              <View style={[styles.infoDivider, { backgroundColor: alpha(theme.text.muted, 0.16) }]} />
              <Text allowFontScaling={false} style={[styles.infoDetail, { color: theme.text.muted }]}>
                <Text style={[styles.infoDetailTitle, { color: theme.text.primary }]}>{copy.repairTitle}: </Text>
                {copy.repairHint}
              </Text>
              <Text allowFontScaling={false} style={[styles.infoDetail, { color: theme.text.muted }]}>
                <Text style={[styles.infoDetailTitle, { color: theme.text.primary }]}>{copy.shieldTitle}: </Text>
                {copy.shieldHint}
              </Text>
            </View>
          ) : null}

          {/* AY · HAFTA · GÜN: seri bu üç kademenin toplamı. */}
          <View style={[styles.levelRow, { borderColor: alpha(theme.text.muted, 0.16) }]}>
            <LevelColumn label={copy.columns.month} value={level.month} theme={theme}>
              <View style={[styles.monthDot, { backgroundColor: palette.glow }]} />
            </LevelColumn>
            <View style={[styles.levelDivider, { backgroundColor: alpha(theme.text.muted, 0.16) }]} />
            <LevelColumn label={copy.columns.week} value={level.week} theme={theme}>
              <Pips total={WEEKS_PER_MONTH} filled={level.week} color={palette.glow} track={track} />
            </LevelColumn>
            <View style={[styles.levelDivider, { backgroundColor: alpha(theme.text.muted, 0.16) }]} />
            <LevelColumn label={copy.columns.day} value={level.day} theme={theme}>
              <Pips total={DAYS_PER_WEEK} filled={level.day} color={palette.glow} track={track} />
            </LevelColumn>
          </View>

          <View
            style={[
              styles.status,
              { backgroundColor: alpha(statusColor, 0.1), borderColor: alpha(statusColor, 0.32) },
            ]}
          >
            <AppIcon family="Ionicons" name={STATUS_ICON[state.status]} size={16} color={statusColor} />
            <Text allowFontScaling={false} style={[styles.statusText, { color: theme.text.primary }]}>
              {statusText}
            </Text>
          </View>

          <View style={styles.progressBlock}>
            {next.daysToWeek !== null ? (
              <>
                <Text allowFontScaling={false} style={[styles.progressLabel, { color: theme.text.secondary }]}>
                  {copy.toWeek(next.daysToWeek)}
                </Text>
                <View style={[styles.track, { backgroundColor: track }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: palette.glow,
                        width: `${Math.max(4, Math.round((level.day / DAYS_PER_WEEK) * 100))}%`,
                      },
                    ]}
                  />
                </View>
              </>
            ) : null}
            {nextLook ? (
              <>
                <Text allowFontScaling={false} style={[styles.progressLabel, { color: theme.text.secondary }]}>
                  {copy.toMonth(next.daysToMonth, copy.palettes[nextLook.palette.id])}
                </Text>
                <View style={[styles.track, { backgroundColor: track }]}>
                  <LinearGradient
                    colors={[palette.glow, nextLook.palette.glow]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.fill, { width: `${Math.max(4, Math.round(state.monthProgress * 100))}%` }]}
                  />
                </View>
              </>
            ) : (
              <Text allowFontScaling={false} style={[styles.progressLabel, { color: theme.text.secondary }]}>
                {copy.maxed}
              </Text>
            )}
            <View style={[styles.recordRow, { backgroundColor: alpha("#FFD76A", 0.08), borderColor: alpha("#FFD76A", 0.22) }]}>
              <AppIcon family="Ionicons" name="trophy-outline" size={13} color="#D9A514" />
              <Text allowFontScaling={false} style={[styles.recordText, { color: theme.text.secondary }]}>
                {copy.record(state.record)}
              </Text>
            </View>
          </View>

          <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            {copy.protectionTitle}
          </Text>
          <View style={[styles.protCard, { borderColor: alpha(theme.text.muted, 0.16) }]}>
            <ProtectionItem
              icon="bandage"
              title={copy.repairTitle}
              value={protection.repairReady ? copy.repairReady : copy.repairWait(protection.repairIn)}
              valueColor={protection.repairReady ? OK_COLOR : theme.text.muted}
              accent={palette.text}
              theme={theme}
            />
            <View style={[styles.protDivider, { backgroundColor: alpha(theme.text.muted, 0.14) }]} />
            <ProtectionItem
              icon="shield-checkmark"
              title={copy.shieldTitle}
              value={copy.shields(protection.shields, protection.shieldMax)}
              valueColor={protection.shields > 0 ? palette.text : theme.text.muted}
              accent={palette.text}
              theme={theme}
            />
          </View>

          <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.secondary }]}>
            {copy.ladderTitle}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ladderScroll}
            contentContainerStyle={styles.ladder}
          >
            {LADDER_LOOKS.map((item, month) => {
              const reached = level.month >= month;
              const current = month === Math.min(level.month, LADDER_LOOKS.length - 1);
              return (
                <View
                  key={item.palette.id}
                  style={[
                    styles.step,
                    current && {
                      backgroundColor: alpha(item.palette.glow, 0.14),
                      borderColor: alpha(item.palette.glow, 0.45),
                    },
                  ]}
                >
                  <View style={styles.stepFlame}>
                    <StreakFlame look={item} size={LADDER_FLAME} animated={false} locked={!reached} />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.stepLabel,
                      { color: reached ? theme.text.primary : theme.text.muted },
                      current && { color: item.palette.text },
                    ]}
                  >
                    {month === 0 ? copy.ladderStart : copy.parts.month(month)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <GlassTouchable
            // Dış alevin koyu tonu: beyaz yazı her kademede okunur (açık paletlerin
            // `glow` tonu üstünde okunmazdı).
            style={[styles.closeBtn, { backgroundColor: palette.outer[0] }]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text allowFontScaling={false} style={styles.closeText}>
              {copy.close}
            </Text>
          </GlassTouchable>
        </SheetScroll>
      </SafeAreaView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetWrap: { maxHeight: "92%" },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 6, alignItems: "center" },
  hero: {
    height: HERO_FLAME + 60,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 14,
  },
  days: { fontSize: 46, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  daysLabel: { fontSize: 13, fontWeight: "700", marginTop: -4 },
  tierChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: "100%",
  },
  tierChipText: { fontSize: 13, fontWeight: "900", flexShrink: 1 },
  summaryHead: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoPanel: {
    alignSelf: "stretch",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
  },
  infoTitle: { fontSize: 12.5, fontWeight: "900", marginBottom: 3 },
  infoDivider: { height: 1, marginVertical: 8 },
  infoDetail: { fontSize: 11.5, fontWeight: "500", lineHeight: 16, marginTop: 3 },
  infoDetailTitle: { fontWeight: "800" },
  levelRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  levelCol: { flex: 1, alignItems: "center", gap: 2 },
  levelValue: { fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  levelLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  levelDivider: { width: 1, marginVertical: 4 },
  monthDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  pips: { flexDirection: "row", gap: 3, marginTop: 4 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  status: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: { flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 17 },
  progressBlock: { alignSelf: "stretch", marginTop: 10, gap: 5 },
  progressLabel: { fontSize: 12, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  recordRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  recordText: { fontSize: 11.5, fontWeight: "800" },
  sectionTitle: {
    alignSelf: "stretch",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  protCard: {
    alignSelf: "stretch",
    alignItems: "stretch",
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  protItem: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 2, paddingVertical: 4 },
  protIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  protBody: { flex: 1, minWidth: 0 },
  protTitle: { fontSize: 10.5, lineHeight: 13, fontWeight: "700" },
  protValue: { fontSize: 12.5, fontWeight: "900", marginTop: 1 },
  protDivider: { height: 1, marginVertical: 5 },
  ladderScroll: { alignSelf: "stretch", flexGrow: 0 },
  ladder: { gap: 4, paddingRight: 4 },
  step: {
    width: 52,
    alignItems: "center",
    gap: 4,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  stepFlame: { height: LADDER_FLAME, justifyContent: "flex-end" },
  stepLabel: { fontSize: 11, fontWeight: "800" },
  how: { alignSelf: "stretch", fontSize: 12, fontWeight: "500", lineHeight: 17 },
  closeBtn: {
    alignSelf: "stretch",
    minHeight: 44,
    marginTop: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

export default memo(StreakFlameSheet);
