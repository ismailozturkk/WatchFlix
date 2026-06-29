// components/hub/TournamentWidget.js
//
// Hub ekranındaki interaktif turnuva widget'ı. Bu ayın türünü, fazını ve geri
// sayımını gösterir; sonuç fazındaysa şampiyon posterini, değilse en üst seed'li
// birkaç posteri önizler. Basınca TournamentScreen'e gider.
//
// Hafiftir: aday listesini OLUŞTURMAZ (getTournamentDoc — yoksa null). Tür/faz/
// geri sayım zaten motordan (ağ gerekmez) gelir.

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useImageQualitySettings, useLanguageSettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import {
  getPeriodId, parsePeriodId, getScheduleEntry, getPhaseInfo, ROUNDS,
  roundLabel, mediaLabel, buildBracket, tallyVotes, now,
} from "@services/tournamentEngine";
import { getTournamentDoc, fetchVotesOnce } from "@services/tournamentService";
import CountdownTimer from "@components/tournament/CountdownTimer";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 12, stiffness: 180 };
const PHASE_COLOR = { selection: "#3B82F6", voting: "#F59E0B", results: "#F5C518", upcoming: "#6B7280" };

export default function TournamentWidget({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const { selectedLanguage: lang } = useLanguageSettings();

  const periodId = useMemo(() => getPeriodId(), []);
  const { monthIndex } = useMemo(() => parsePeriodId(periodId), [periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);

  const [nowMs, setNowMs] = useState(now());
  const [doc, setDoc] = useState(null);
  const [champion, setChampion] = useState(null);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    const id = setInterval(() => setNowMs(now()), 30000);
    return () => clearInterval(id);
  }, []);

  const phaseInfo = useMemo(() => getPhaseInfo(periodId, nowMs), [periodId, nowMs]);

  // Hafif önizleme verisi (oluşturmadan oku).
  useEffect(() => {
    let active = true;
    (async () => {
      const d = await getTournamentDoc(periodId);
      if (!active) return;
      setDoc(d);
      if (d?.nominees?.length && phaseInfo.phase === "results") {
        const votes = await fetchVotesOnce(periodId);
        if (!active) return;
        const b = buildBracket({ nominees: d.nominees, tallies: tallyVotes(votes), periodId, ms: nowMs });
        setChampion(b.champion || null);
      }
    })();
    return () => { active = false; };
  }, [periodId, phaseInfo.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseColor = PHASE_COLOR[phaseInfo.phase] || PHASE_COLOR.selection;
  const theTheme = lang === "tr" ? entry.tr : entry.en;
  const phaseLabel =
    phaseInfo.phase === "selection"
      ? i18nText("autoI18n.tournament_voting_soon", "Oylama yakında")
      : phaseInfo.phase === "voting"
        ? roundLabel(ROUNDS[phaseInfo.activeRound], lang)
        : i18nText("autoI18n.tournament_next_in", "Yeni turnuvaya");

  // Önizleme posterleri: şampiyon (results) veya en üst 3 seed.
  const previewPosters = useMemo(() => {
    if (champion?.posterPath) return [champion];
    const noms = [...(doc?.nominees || [])].sort((a, b) => a.seed - b.seed).slice(0, 3);
    return noms;
  }, [champion, doc]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={i18nText("autoI18n.tournament_open", "Aylık turnuvayı aç")}
      onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING); }}
      onPress={() => navigation.navigate("TournamentScreen")}
      style={[styles.shadow, { shadowColor: theme.shadow || phaseColor }, animStyle]}
    >
      <LinearGradient
        colors={[phaseColor, theme.accent, theme.bold || theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />

        <View style={styles.left}>
          <View style={styles.titleRow}>
            <AppIcon family="Ionicons" name="trophy" size={16} color="#fff" />
            <Text style={styles.kicker}>{i18nText("autoI18n.tournament_monthly", "AYLIK TURNUVA")}</Text>
          </View>
          <Text style={styles.theme} numberOfLines={1}>
            {theTheme} {mediaLabel(entry.mediaType, lang)}
          </Text>
          <Text style={styles.phaseLabel} numberOfLines={1}>{phaseLabel}</Text>
          <CountdownTimer deadlineMs={phaseInfo.nextDeadlineMs} lang={lang} size="sm" />
        </View>

        {/* Poster önizleme */}
        <View style={styles.posters}>
          {previewPosters.length > 0 ? (
            previewPosters.map((p, i) => {
              const uri = p.posterPath ? getTmdbUrl(p.posterPath, "poster", 92) : null;
              return (
                <View
                  key={p.id || i}
                  style={[
                    styles.posterWrap,
                    { right: i * 24, zIndex: previewPosters.length - i, transform: [{ rotate: `${(i - 1) * 5}deg` }] },
                  ]}
                >
                  {uri ? (
                    <Image source={{ uri }} style={styles.poster} contentFit="cover" />
                  ) : (
                    <View style={[styles.poster, styles.posterEmpty]} />
                  )}
                  {champion && i === 0 && (
                    <View style={styles.champBadge}>
                      <AppIcon family="Ionicons" name="trophy" size={11} color="#F5C518" />
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.cta}>
              <AppIcon family="Ionicons" name="arrow-forward" size={20} color="#fff" />
            </View>
          )}
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: "90%",
    borderRadius: 24,
    elevation: 8,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    marginBottom: 14,
  },
  card: {
    minHeight: 116,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  glowOne: {
    position: "absolute", width: 170, height: 170, borderRadius: 85,
    right: -50, top: -70, backgroundColor: "rgba(255,255,255,0.10)",
  },
  glowTwo: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    left: -30, bottom: -50, backgroundColor: "rgba(255,255,255,0.07)",
  },
  left: { flex: 1, paddingRight: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  theme: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 6 },
  phaseLabel: { color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "800", marginTop: 6, marginBottom: 5 },

  posters: { width: 92, height: 84, alignItems: "flex-end", justifyContent: "center" },
  posterWrap: { position: "absolute" },
  poster: { width: 52, height: 78, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
  posterEmpty: { backgroundColor: "rgba(255,255,255,0.18)" },
  champBadge: {
    position: "absolute", top: -6, alignSelf: "center", right: 18,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, padding: 3,
  },
  cta: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
  },
});
