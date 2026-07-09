// components/hub/TournamentWidget.js
//
// Hub ekranındaki interaktif turnuva widget'ı. Bu ayın türünü, fazını ve geri
// sayımını gösterir; faza göre KİŞİSEL durum satırı ekler:
//   • selection → hype hakkın duruyor mu ("1 hype hakkın var" / "Hype'ın kayıtlı")
//                 + en çok hype alan 3 posterin canlı önizlemesi
//   • voting    → aktif turda kaç maça oy verdiğin (ör. "3/16 maç")
//   • results   → şampiyon posteri
// Basınca TournamentScreen'e gider.
//
// Hafiftir: aday listesini OLUŞTURMAZ (getTournamentDoc — yoksa null); sayımlar
// tek agregat dokümandan (fetchAggOnce), kişisel durum tek kendi-oy dokümanından
// (fetchMyVoteOnce) okunur. Tür/faz/geri sayım motordan (ağ gerekmez) gelir.

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings, useLanguageSettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import {
  getPeriodId, parsePeriodId, getScheduleEntry, getPhaseInfo, ROUNDS,
  roundLabel, mediaLabel, buildBracket, tallyVotes, tallyNominations,
  selectFinalists, now,
} from "@services/tournamentEngine";
import {
  getTournamentDoc, fetchVotesOnce, fetchAggOnce, fetchMyVoteOnce,
} from "@services/tournamentService";
import CountdownTimer from "@components/tournament/CountdownTimer";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 12, stiffness: 180 };
const PHASE_COLOR = { selection: "#3B82F6", voting: "#F59E0B", results: "#F5C518", upcoming: "#6B7280" };

export default function TournamentWidget({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const { selectedLanguage: lang } = useLanguageSettings();
  const uid = user?.uid;

  const periodId = useMemo(() => getPeriodId(), []);
  const { monthIndex } = useMemo(() => parsePeriodId(periodId), [periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);

  const [nowMs, setNowMs] = useState(now());
  const [doc, setDoc] = useState(null);
  const [champion, setChampion] = useState(null);
  const [agg, setAgg] = useState(null);       // { noms, picks, voters } | null
  const [myVote, setMyVote] = useState(null); // kendi oy dokümanım | null

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    const id = setInterval(() => setNowMs(now()), 30000);
    return () => clearInterval(id);
  }, []);

  const phaseInfo = useMemo(() => getPhaseInfo(periodId, nowMs), [periodId, nowMs]);

  // Hafif önizleme verisi (oluşturmadan oku): meta + agg + kendi oyum.
  // Tally için oy koleksiyonunun tamamı YALNIZ agg yoksa (eski ay) çekilir.
  useEffect(() => {
    let active = true;
    (async () => {
      const [d, a, mine] = await Promise.all([
        getTournamentDoc(periodId),
        fetchAggOnce(periodId),
        uid ? fetchMyVoteOnce(periodId, uid) : Promise.resolve(null),
      ]);
      if (!active) return;
      setDoc(d);
      setAgg(a);
      setMyVote(mine);
      if (d?.nominees?.length && phaseInfo.phase === "results") {
        let nomTally;
        let tallies;
        if (a) {
          nomTally = a.noms;
          tallies = a.picks;
        } else {
          const votes = await fetchVotesOnce(periodId);
          if (!active) return;
          nomTally = tallyNominations(votes);
          tallies = tallyVotes(votes);
        }
        // Havuz > 32 ise finalistler hype oylarından türer (ekranla aynı kural).
        const finalists = selectFinalists(d.nominees, nomTally);
        const b = buildBracket({ nominees: finalists, tallies, periodId, ms: nowMs });
        setChampion(b.champion || null);
      }
    })();
    return () => { active = false; };
  }, [periodId, phaseInfo.phase, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseColor = PHASE_COLOR[phaseInfo.phase] || PHASE_COLOR.selection;
  const theTheme = lang === "tr" ? entry.tr : entry.en;

  // Kişisel durum: hype hakkı / aktif turdaki oy sayısı.
  const myNomCount = useMemo(
    () => Object.keys(myVote?.noms || {}).filter((k) => myVote.noms[k]).length,
    [myVote],
  );
  const activeRoundDef =
    phaseInfo.phase === "voting" ? ROUNDS[phaseInfo.activeRound] : null;
  const myRoundPicks = useMemo(() => {
    if (!activeRoundDef) return 0;
    return Object.keys(myVote?.picks || {}).filter((k) =>
      k.startsWith(`${activeRoundDef.key}_`),
    ).length;
  }, [myVote, activeRoundDef]);

  const phaseLabel =
    phaseInfo.phase === "selection"
      ? myNomCount > 0
        ? i18nText("autoI18n.tournament_widget_hyped", "🔥 Hype'ın kayıtlı — sıralamayı izle")
        : i18nText("autoI18n.tournament_widget_hype_left", "🔥 1 hype hakkın var — İlk 32'yi sen seç")
      : phaseInfo.phase === "voting"
        ? `${roundLabel(activeRoundDef, lang)}${
            uid
              ? ` · ${myRoundPicks}/${activeRoundDef.matches} ${i18nText("autoI18n.tournament_widget_match", "maç")}`
              : ""
          }`
        : i18nText("autoI18n.tournament_next_in", "Yeni turnuvaya");

  // Katılım satırı (agg varsa): "N katılımcı".
  const votersLine =
    agg?.voters > 0
      ? `${agg.voters} ${i18nText("autoI18n.tournament_widget_voters", "katılımcı")}`
      : null;

  // Önizleme posterleri: şampiyon (results) → en çok HYPE alan 3 (selection,
  // agg varsa) → en üst 3 seed (fallback).
  const previewPosters = useMemo(() => {
    if (champion?.posterPath) return [champion];
    const nominees = doc?.nominees || [];
    if (phaseInfo.phase === "selection" && agg && Object.keys(agg.noms).length > 0) {
      const hyped = [...nominees]
        .sort(
          (a, b) =>
            (agg.noms[String(b.id)] || 0) - (agg.noms[String(a.id)] || 0) ||
            (a.seed || 0) - (b.seed || 0),
        )
        .slice(0, 3);
      if (hyped.length) return hyped;
    }
    return [...nominees].sort((a, b) => a.seed - b.seed).slice(0, 3);
  }, [champion, doc, agg, phaseInfo.phase]);

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
          <View style={styles.countdownRow}>
            <CountdownTimer deadlineMs={phaseInfo.nextDeadlineMs} lang={lang} size="sm" />
            {votersLine && (
              <View style={styles.votersPill}>
                <AppIcon family="Ionicons" name="people" size={10} color="#fff" />
                <Text style={styles.votersText}>{votersLine}</Text>
              </View>
            )}
          </View>
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
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  votersPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9,
  },
  votersText: { color: "#fff", fontSize: 10, fontWeight: "800" },

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
