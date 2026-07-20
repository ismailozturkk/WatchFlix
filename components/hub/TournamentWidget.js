// components/hub/TournamentWidget.js
//
// Hub ekranındaki interaktif turnuva widget'ı. Bu ayın türünü, fazını ve geri
// sayımını gösterir; faza göre KİŞİSEL durum satırı ekler:
//   • selection → hype hakkın duruyor mu ("1 hype hakkın var" / "Hype'ın kayıtlı")
//   • voting    → aktif turda kaç maça oy verdiğin (ör. "3/16 maç")
//   • results   → şampiyon posteri
// Tüm fazlarda sayacın altında, kartın tam genişliğini kullanan kompakt bracket
// önizlemesi gösterilir.
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
import Svg, { Circle, Path } from "react-native-svg";
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

function MiniPoster({ contestant, getTmdbUrl, accent = false }) {
  const uri = contestant?.posterPath
    ? getTmdbUrl(contestant.posterPath, "poster", 45)
    : null;

  return (
    <View style={[styles.treePoster, accent && styles.treePosterAccent]}>
      {uri ? (
        <Image source={{ uri }} style={styles.treePosterImage} contentFit="cover" />
      ) : (
        <AppIcon family="Ionicons" name="help" size={8} color="rgba(255,255,255,0.58)" />
      )}
    </View>
  );
}

function MiniMatch({ match, getTmdbUrl, final = false, compact = false }) {
  const winnerId = match?.winner?.id;
  return (
    <View style={[
      styles.treeMatch,
      compact && styles.treeMatchCompact,
      final && styles.treeFinalMatch,
    ]}>
      <MiniPoster
        contestant={match?.a}
        getTmdbUrl={getTmdbUrl}
        accent={!!winnerId && winnerId === match?.a?.id}
      />
      <MiniPoster
        contestant={match?.b}
        getTmdbUrl={getTmdbUrl}
        accent={!!winnerId && winnerId === match?.b?.id}
      />
    </View>
  );
}

// Büyük bracket ağacının Hub kartına sığan, iki taraflı yatay özeti. Dıştaki
// ilk tur eşleşmeleri merkeze doğru birleşir; ilerleyen turlar açıldıkça aynı
// düğümler gerçek adaylarla dolar.
function TournamentTreePreview({ bracket, getTmdbUrl, accent, lang }) {
  const [canvasWidth, setCanvasWidth] = useState(320);
  const rounds = bracket?.rounds || [];
  const first = rounds[0]?.matches || [];
  const second = rounds[1]?.matches || [];
  const finalMatch = rounds[4]?.matches?.[0] || null;
  const isDecided = (match) => !!(match?.decided && match?.winnerSide);

  const outerLeft = 8;
  const outerRight = canvasWidth - outerLeft - 40;
  const middleLeft = canvasWidth * 0.25625;
  const middleRight = canvasWidth - middleLeft - 40;
  const centerLeft = canvasWidth / 2 - 22;
  const leftJunction = canvasWidth * 0.190625;
  const rightJunction = canvasWidth - leftJunction;
  const paths = [
    { d: `M${outerLeft + 40} 18.5 H${leftJunction} V38.5 H${middleLeft}`, active: isDecided(first[0]) },
    { d: `M${outerLeft + 40} 57.5 H${leftJunction} V38.5 H${middleLeft}`, active: isDecided(first[1]) },
    { d: `M${middleLeft + 40} 38.5 H${centerLeft}`, active: isDecided(second[0]) },
    { d: `M${outerRight} 18.5 H${rightJunction} V38.5 H${middleRight + 40}`, active: isDecided(first[8]) },
    { d: `M${outerRight} 57.5 H${rightJunction} V38.5 H${middleRight + 40}`, active: isDecided(first[9]) },
    { d: `M${middleRight} 38.5 H${centerLeft + 44}`, active: isDecided(second[4]) },
  ];

  return (
    <View style={styles.treePreview} pointerEvents="none">
      <View style={styles.treeHeader}>
        <View style={styles.treeHeaderTitle}>
          <AppIcon family="Ionicons" name="git-network-outline" size={11} color="rgba(255,255,255,0.84)" />
          <Text style={styles.treeHeaderText}>
            {lang === "tr" ? "ELEME AĞACI" : "BRACKET"}
          </Text>
        </View>
        <Text style={styles.treeRoundText}>{lang === "tr" ? "SON 32" : "TOP 32"}</Text>
        <View style={styles.treeFinalPill}>
          <View style={[styles.treeLiveDot, { backgroundColor: accent }]} />
          <Text style={styles.treeFinalText}>{lang === "tr" ? "FİNAL" : "FINAL"}</Text>
        </View>
        <Text style={styles.treeRoundText}>{lang === "tr" ? "SON 32" : "TOP 32"}</Text>
      </View>

      <View
        style={styles.treeCanvas}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== canvasWidth) setCanvasWidth(nextWidth);
        }}
      >
        <View style={styles.treeCenterGlow} />
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${canvasWidth} 76`} preserveAspectRatio="none">
          {paths.map((path, index) => (
            <Path
              key={`base-${index}`}
              d={path.d}
              fill="none"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {paths.filter((path) => path.active).map((path, index) => (
            <Path
              key={`active-${index}`}
              d={path.d}
              fill="none"
              stroke={accent}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <Circle cx={leftJunction} cy="38.5" r="2.2" fill="rgba(255,255,255,0.72)" />
          <Circle cx={rightJunction} cy="38.5" r="2.2" fill="rgba(255,255,255,0.72)" />
        </Svg>

        <View style={[styles.treeNode, { left: outerLeft, top: 4 }]}>
          <MiniMatch match={first[0]} getTmdbUrl={getTmdbUrl} compact />
        </View>
        <View style={[styles.treeNode, { left: outerLeft, top: 43 }]}>
          <MiniMatch match={first[1]} getTmdbUrl={getTmdbUrl} compact />
        </View>
        <View style={[styles.treeNode, { left: middleLeft, top: 24 }]}>
          <MiniMatch match={second[0]} getTmdbUrl={getTmdbUrl} />
        </View>

        <View style={[styles.treeNode, styles.treeNodeCenter, { left: centerLeft }]}>
          <View style={styles.treeTrophy}>
            <AppIcon family="Ionicons" name="trophy" size={11} color="#F5C518" />
          </View>
          <MiniMatch match={finalMatch} getTmdbUrl={getTmdbUrl} final />
        </View>

        <View style={[styles.treeNode, { left: middleRight, top: 24 }]}>
          <MiniMatch match={second[4]} getTmdbUrl={getTmdbUrl} />
        </View>
        <View style={[styles.treeNode, { left: outerRight, top: 4 }]}>
          <MiniMatch match={first[8]} getTmdbUrl={getTmdbUrl} compact />
        </View>
        <View style={[styles.treeNode, { left: outerRight, top: 43 }]}>
          <MiniMatch match={first[9]} getTmdbUrl={getTmdbUrl} compact />
        </View>
      </View>
    </View>
  );
}

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
  const [bracketPreview, setBracketPreview] = useState(null);
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
      setAgg(a);
      setMyVote(mine);
      if (d?.nominees?.length) {
        let nomTally = a?.noms || {};
        let tallies = a?.picks || {};
        if (!a && phaseInfo.phase === "results") {
          const votes = await fetchVotesOnce(periodId);
          if (!active) return;
          nomTally = tallyNominations(votes);
          tallies = tallyVotes(votes);
        }
        // Havuz > 32 ise finalistler hype oylarından türer (ekranla aynı kural).
        const finalists = selectFinalists(d.nominees, nomTally);
        const b = buildBracket({ nominees: finalists, tallies, periodId, ms: nowMs });
        setBracketPreview(b);
      } else {
        setBracketPreview(null);
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

        <View style={styles.topRow}>
          <View style={styles.left}>
            <View style={styles.titleRow}>
              <AppIcon family="Ionicons" name="trophy" size={16} color="#fff" />
              <Text style={styles.kicker}>{i18nText("autoI18n.tournament_monthly", "AYLIK TURNUVA")}</Text>
            </View>
            <Text style={styles.theme} numberOfLines={1}>
              {theTheme} {mediaLabel(entry.mediaType, lang)}
            </Text>
            <Text style={styles.phaseLabel} numberOfLines={1}>{phaseLabel}</Text>
          </View>

          <View style={styles.openIcon}>
            <AppIcon family="Ionicons" name="arrow-forward" size={17} color="#fff" />
          </View>
        </View>

        <View style={styles.countdownRow}>
          <CountdownTimer deadlineMs={phaseInfo.nextDeadlineMs} lang={lang} size="sm" />
          {votersLine && (
            <View style={styles.votersPill}>
              <AppIcon family="Ionicons" name="people" size={10} color="#fff" />
              <Text style={styles.votersText}>{votersLine}</Text>
            </View>
          )}
        </View>

        <TournamentTreePreview
          bracket={bracketPreview}
          getTmdbUrl={getTmdbUrl}
          accent={phaseColor}
          lang={lang}
        />
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
    minHeight: 226,
    borderRadius: 24,
    padding: 18,
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
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  left: { flex: 1, paddingRight: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  theme: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 6 },
  phaseLabel: { color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "800", marginTop: 6, marginBottom: 5 },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  votersPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9,
  },
  votersText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  openIcon: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
  },

  treePreview: {
    width: "100%", height: 105, marginTop: 10, borderRadius: 16,
    backgroundColor: "rgba(5,10,24,0.30)", overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  treeHeader: {
    height: 28, paddingHorizontal: 9, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.14)",
  },
  treeHeaderTitle: { flexDirection: "row", alignItems: "center", gap: 4 },
  treeHeaderText: { color: "rgba(255,255,255,0.84)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 },
  treeRoundText: { color: "rgba(255,255,255,0.54)", fontSize: 7.5, fontWeight: "800", letterSpacing: 0.5 },
  treeFinalPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  treeLiveDot: { width: 4, height: 4, borderRadius: 2 },
  treeFinalText: { color: "#fff", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.6 },
  treeCanvas: { flex: 1, position: "relative" },
  treeCenterGlow: {
    position: "absolute", left: "50%", top: 9, marginLeft: -30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(245,197,24,0.08)",
  },
  treeNode: { position: "absolute", zIndex: 2 },
  treeNodeCenter: { top: 21, alignItems: "center" },
  treeMatch: {
    width: 40, height: 29, borderRadius: 6, padding: 2, gap: 2,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  treeMatchCompact: { width: 40, height: 29, backgroundColor: "rgba(255,255,255,0.10)" },
  treeFinalMatch: {
    width: 44, height: 34, padding: 3,
    borderColor: "rgba(245,197,24,0.92)", borderWidth: 1.5,
    backgroundColor: "rgba(245,197,24,0.18)",
  },
  treePoster: {
    width: 16, height: 23, borderRadius: 3, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 0.75,
    borderColor: "rgba(255,255,255,0.28)",
  },
  treePosterAccent: { borderColor: "#F5C518", borderWidth: 1.25 },
  treePosterImage: { width: "100%", height: "100%" },
  treeTrophy: {
    position: "absolute", zIndex: 3, top: -13,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(8,12,25,0.78)", borderWidth: 1,
    borderColor: "rgba(245,197,24,0.72)",
  },
});
