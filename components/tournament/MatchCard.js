// components/tournament/MatchCard.js
//
// Tek bir eleme maçı: yan yana iki poster. OYLAMA = POSTERE 2 KEZ BASMA:
//   1. basış → o posterin üzerinde "Seçimi onayla" katmanı belirir (hafif büyür)
//   2. basış → oy kaydedilir (onVote)
// Diğer postere basmak beklemeyi oraya taşır; 2.6 sn dokunulmazsa iptal olur.
//
// Ayrıca: canlı oy yüzdesi barları, "senin oyun" rozeti, tur bittiğinde kazanan
// kupası + kaybedenin solması, henüz belli olmayan rakip için "?" yer tutucu.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { mass: 0.5, damping: 13, stiffness: 200 };
const PENDING_TIMEOUT = 2600;

// ─── Tek poster hücresi ───────────────────────────────────────────────────────
function Cell({
  side, contestant, votes, total, pct,
  isMyPick, isWinner, isLoser, isPending, locked,
  onPress, theme, getTmdbUrl, lang,
}) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isPending ? 1.045 : 1, PRESS_SPRING);
    lift.value = withTiming(isPending ? 1 : 0, { duration: 160 });
  }, [isPending]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const empty = !contestant;
  const uri = !empty && contestant.posterPath ? getTmdbUrl(contestant.posterPath, "poster", 185) : null;
  const ringColor = isMyPick ? theme.accent : isWinner ? "#F5C518" : "transparent";

  return (
    <AnimatedPressable
      disabled={empty || locked}
      onPress={() => onPress(side)}
      style={[styles.cell, aStyle]}
    >
      <View
        style={[
          styles.posterWrap,
          {
            backgroundColor: theme.between,
            borderColor: ringColor,
            borderWidth: isMyPick || isWinner ? 2.5 : 0,
            opacity: isLoser ? 0.45 : 1,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.poster} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <AppIcon family="Ionicons" name={empty ? "help" : "image-outline"} size={26} color={theme.text.muted} />
          </View>
        )}

        {/* Seed rozeti */}
        {!empty && (
          <View style={[styles.seedBadge, { backgroundColor: theme.primary + "E6" }]}>
            <Text style={[styles.seedText, { color: theme.text.secondary }]}>#{contestant.seed}</Text>
          </View>
        )}

        {/* Kazanan kupası */}
        {isWinner && (
          <View style={styles.crown}>
            <AppIcon family="Ionicons" name="trophy" size={16} color="#F5C518" />
          </View>
        )}

        {/* Senin oyun rozeti */}
        {isMyPick && !isWinner && (
          <View style={[styles.myPickBadge, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="checkmark" size={13} color="#fff" />
          </View>
        )}

        {/* Alt: başlık + oy barı */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.posterFooter}
          pointerEvents="none"
        >
          <Text numberOfLines={2} style={styles.title}>
            {empty ? i18nText("autoI18n.tournament_tbd", "Belli değil") : contestant.title}
          </Text>
          {(total > 0) && (
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%`, backgroundColor: isMyPick ? theme.accent : "#F5C518" },
                  ]}
                />
              </View>
              <Text style={styles.pctText}>%{pct}</Text>
            </View>
          )}
        </LinearGradient>

        {/* "Seçimi onayla" katmanı (1. basıştan sonra) */}
        {isPending && (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={[styles.confirmOverlay, { backgroundColor: theme.accent + "E6" }]}
            pointerEvents="none"
          >
            <AppIcon family="Ionicons" name="checkmark-circle" size={30} color="#fff" />
            <Text style={styles.confirmText}>
              {i18nText("autoI18n.tournament_confirm", "Seçimi onayla")}
            </Text>
            <Text style={styles.confirmSub}>
              {i18nText("autoI18n.tournament_confirm_sub", "tekrar bas")}
            </Text>
          </Animated.View>
        )}
      </View>
    </AnimatedPressable>
  );
}

// ─── Maç ──────────────────────────────────────────────────────────────────────
export default function MatchCard({
  match, mySide, votable, onVote,
  theme, getTmdbUrl, lang = "tr", hapticsEnabled = true,
}) {
  const [pending, setPending] = useState(null); // "a" | "b" | null
  const timer = useRef(null);

  const clearPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPending(null);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handlePress = useCallback(
    (side) => {
      if (!votable) return;
      const contestant = side === "a" ? match.a : match.b;
      if (!contestant) return;

      if (pending === side) {
        // 2. basış → onayla
        clearPending();
        if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onVote?.(match.matchId, side);
      } else {
        // 1. basış (veya diğer tarafa geçiş) → beklet
        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setPending(side);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setPending(null), PENDING_TIMEOUT);
      }
    },
    [votable, pending, match, onVote, hapticsEnabled, clearPending],
  );

  const total = match.total || 0;
  const aPct = total > 0 ? Math.round((match.aVotes / total) * 100) : 0;
  const bPct = total > 0 ? Math.max(0, 100 - aPct) : 0;
  const showWinner = match.decided && !!match.winnerSide;

  return (
    <View style={[styles.match, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Cell
        side="a"
        contestant={match.a}
        votes={match.aVotes}
        total={total}
        pct={aPct}
        isMyPick={mySide === "a"}
        isWinner={showWinner && match.winnerSide === "a"}
        isLoser={showWinner && match.winnerSide === "b"}
        isPending={pending === "a"}
        locked={!votable}
        onPress={handlePress}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />

      <View style={styles.vsWrap}>
        <View style={[styles.vsCircle, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <Text style={[styles.vsText, { color: theme.text.secondary }]}>VS</Text>
        </View>
      </View>

      <Cell
        side="b"
        contestant={match.b}
        votes={match.bVotes}
        total={total}
        pct={bPct}
        isMyPick={mySide === "b"}
        isWinner={showWinner && match.winnerSide === "b"}
        isLoser={showWinner && match.winnerSide === "a"}
        isPending={pending === "b"}
        locked={!votable}
        onPress={handlePress}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  match: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  cell: { flex: 1 },
  posterWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  poster: { width: "100%", height: "100%" },
  posterEmpty: { alignItems: "center", justifyContent: "center" },
  seedBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  seedText: { fontSize: 10, fontWeight: "800" },
  crown: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 11,
    padding: 4,
  },
  myPickBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 11,
    padding: 3,
  },
  posterFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingTop: 16,
    paddingBottom: 7,
  },
  title: { color: "#fff", fontSize: 11.5, fontWeight: "700", lineHeight: 14 },
  barRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  pctText: { color: "#fff", fontSize: 10, fontWeight: "800", marginLeft: 6, width: 34, textAlign: "right" },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  confirmText: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 4 },
  confirmSub: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700" },
  vsWrap: { width: 34, alignItems: "center", justifyContent: "center" },
  vsCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: { fontSize: 10, fontWeight: "900" },
});
