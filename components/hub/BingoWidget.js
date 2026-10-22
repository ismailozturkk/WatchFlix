// components/hub/BingoWidget.js
//
// Eğlence'deki "Sinema Bingosu" kartı: ayın 3x3 kartının minik hâli + çizgi/kare,
// kalan gün). Dokununca tam sayfa (CinemaBingoScreen) açılır. Kartın kendisi bir "okuma": kareler
// izleme kayıtlarından kendiliğinden dolar, kullanıcı burada bir şeye basıp işaretlemez.
//
// Alt satır tek bir cümle taşır ve önceliği sabittir: "bir kare kaldı!" (en güçlü çağrı) →
// ay serisi → geçen ayın sonucu → kart tanıtımı.
//
// Hafiftir: yeni dinleyici açmaz; veri useCinemaBingo üzerinden ProfileStatsContext'ten türer.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import HubCard, { GlassPill, HubArrow } from "@components/hub/HubCard";
import useCinemaBingo from "@hooks/useCinemaBingo";
import { useLanguage } from "@context/LanguageContext";
import { getBingoCopy } from "@utils/cinemaBingoCopy";
import { CENTER, cellsOnLines } from "@utils/cinemaBingo";
import { triggerHaptic } from "@services/hapticsService";

const COLORS = ["#14B8A6", "#0F766E", "#053B3A"];
const SHADOW = "#0F766E";
const GOLD = "#FFD76A";
const TEAL_INK = "#0F766E";

/** 3x3 minik kart. Tamamlanmış çizgideki kareler altın, diğer dolular beyaz. */
export function BingoMiniGrid({ cells, lines, size = 22, gap = 5 }) {
  const onLine = cellsOnLines(lines);
  return (
    <View
      pointerEvents="none"
      style={{ width: size * 3 + gap * 2, flexDirection: "row", flexWrap: "wrap", gap }}
    >
      {cells.map((cell, index) => {
        const lit = onLine.has(index);
        return (
          <View
            key={cell.id}
            style={[
              styles.mini,
              { width: size, height: size, borderRadius: Math.round(size * 0.3) },
              cell.done ? { backgroundColor: lit ? GOLD : "#FFFFFF" } : styles.miniOpen,
              index === CENTER && !cell.done ? styles.miniCenter : null,
            ]}
          >
            {cell.done ? (
              <AppIcon family="Ionicons" name="checkmark" size={Math.round(size * 0.6)} color={TEAL_INK} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function BingoWidget({ navigation }) {
  const { language } = useLanguage();
  const copy = getBingoCopy(language);
  const { result, bestLines, daysLeft, streak, previous, weekly, loading } = useCinemaBingo();

  const footer = result.full
    ? copy.fullCard
    : result.oneAway.length > 0 && !loading
      ? copy.oneAway
      : streak >= 2
        ? copy.streak(streak)
        : previous
          ? copy.lastMonth(previous.lines)
          : copy.cardHint;

  const open = () => {
    triggerHaptic("impact");
    navigation.navigate("CinemaBingoScreen", { source: "hub" });
  };

  return (
    <HubCard
      colors={COLORS}
      shadowColor={SHADOW}
      onPress={open}
      cardStyle={styles.card}
      accessibilityRole="button"
      accessibilityHint={copy.openLabel}
      accessibilityLabel={`${copy.title}. ${copy.weeklyCount(weekly.doneCount)}. ${copy.lines(bestLines)}, ${copy.squares(result.doneCount, 9)}. ${footer}`}
    >
      <View style={styles.top}>
        <View style={styles.copy}>
          <View style={styles.badges}>
            <GlassPill icon="grid" text={copy.eyebrow} tone="dark" />
            <GlassPill icon="time-outline" text={copy.daysLeft(daysLeft)} />
          </View>
          <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
            {copy.title}
          </Text>
          <View style={styles.stats}>
            <Text style={styles.stat} allowFontScaling={false} numberOfLines={1}>
              {loading ? copy.loading : copy.lines(bestLines)}
            </Text>
            {loading ? null : (
              <>
                <View style={styles.dot} />
                <Text style={styles.stat} allowFontScaling={false} numberOfLines={1}>
                  {copy.squares(result.doneCount, 9)}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={[styles.grid, loading && styles.gridLoading]}>
          <BingoMiniGrid cells={result.cells} lines={loading ? [] : result.lines} />
        </View>
      </View>

      <View style={styles.weekly}>
        <Text style={styles.weeklyText} allowFontScaling={false} numberOfLines={1}>
          {copy.weeklyTitle}
        </Text>
        <Text style={styles.weeklyCount} allowFontScaling={false}>
          {loading ? "–" : copy.weeklyCount(weekly.doneCount)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerCopy}>
          {result.oneAway.length > 0 && !loading && !result.full ? (
            <AppIcon family="Ionicons" name="flame" size={14} color={GOLD} />
          ) : null}
          <Text style={styles.footerText} allowFontScaling={false} numberOfLines={1}>
            {footer}
          </Text>
        </View>
        <HubArrow color={TEAL_INK} size={34} />
      </View>
    </HubCard>
  );
}

export default memo(BingoWidget);

const styles = StyleSheet.create({
  card: { padding: 16 },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  copy: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, rowGap: 6 },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 10,
  },
  stats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  stat: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 17, fontWeight: "700", flexShrink: 1 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.55)" },

  grid: { padding: 4 },
  gridLoading: { opacity: 0.45 },
  mini: { alignItems: "center", justifyContent: "center" },
  miniOpen: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  miniCenter: { borderColor: "rgba(255,255,255,0.6)" },

  weekly: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13 },
  weeklyText: { flex: 1, color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  weeklyCount: { color: GOLD, fontSize: 12, fontWeight: "900" },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 },
  footerCopy: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { color: "#FFFFFF", fontSize: 13, lineHeight: 17, fontWeight: "800", flexShrink: 1 },
});
