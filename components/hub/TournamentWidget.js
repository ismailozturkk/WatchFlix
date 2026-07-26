// components/hub/TournamentWidget.js
//
// Hub ekranındaki interaktif turnuva widget'ı. Bu ayın türünü, fazını ve geri
// sayımını gösterir; faza göre KİŞİSEL durum satırı ekler:
//   • selection → hype hakkın duruyor mu ("1 hype hakkın var" / "Hype'ın kayıtlı")
//   • voting    → aktif turda kaç maça oy verdiğin (ör. "3/16 maç")
//   • results   → şampiyon posteri
// Tüm fazlarda sayacın altında, kartın tam genişliğini kullanan bracket
// önizlemesi gösterilir: 31 maçın TAMAMI (her yarıda 8+4+2+1 çentik, merkezde
// final) tek bakışta okunan iki taraflı bir huni olarak çizilir. Basınca
// TournamentScreen'e gider.
//
// Hafiftir: aday listesini OLUŞTURMAZ (getTournamentDoc — yoksa null); sayımlar
// tek agregat dokümandan (fetchAggOnce), kişisel durum tek kendi-oy dokümanından
// (fetchMyVoteOnce) okunur. Tür/faz/geri sayım motordan (ağ gerekmez) gelir.

import React, { memo, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence, withTiming,
  ReduceMotion,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
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

// ─── Eleme ağacı önizlemesi ───────────────────────────────────────────────────
// Ölçüler tek yerden türer (BracketTree'nin yaptığı gibi); tuval genişliği
// onLayout ile ölçülür, YÜKSEKLİK sabittir → SVG 1:1 çizilir (viewBox yok),
// böylece bağlantılar ile mutlak konumlu View'lar aynı koordinat sisteminde.
const TREE_H = 102;          // tuval yüksekliği
const TREE_PAD_Y = 5;
const TREE_LABEL_H = 12;     // alttaki tur etiketi şeridi
const SIDE_COLS = 4;         // her yarıda 8 / 4 / 2 / 1 maç
const TICK_H = [5, 6.5, 8.5, 11];   // tur ilerledikçe kalınlaşan çentikler
const TRACK = "rgba(255,255,255,0.15)";
const TRACK_LINE = "rgba(255,255,255,0.22)";
const DONE = "rgba(255,255,255,0.92)";
const GOLD = "#F5C518";
const TOTAL_MATCHES = ROUNDS.reduce((s, r) => s + r.matches, 0); // 31

// BracketTree ile AYNI kural: maç ancak turu bittiyse ve kazananı varsa çözülmüş.
const isDecided = (m) => !!(m && m.decided && m.winnerSide);

// Türkçe-güvenli BÜYÜK harf: JS'in toUpperCase'i 'i' → 'I' yapar ("FINAL"),
// Türkçede doğrusu 'İ'dir. Intl'e bağımlı olmadan önce i'leri İ'ye çeviririz.
const upperLocale = (s, lang) => (lang === "tr" ? String(s).replace(/i/g, "İ") : s).toUpperCase();

// StageTimeline'ın kısa tur etiketleri — aynı sözlük.
const shortRound = (key, lang) =>
  key === "r32" ? "32"
  : key === "r16" ? "16"
  : key === "qf" ? (lang === "tr" ? "ÇF" : "QF")
  : key === "sf" ? (lang === "tr" ? "YF" : "SF")
  : (lang === "tr" ? "FİNAL" : "FINAL");

// Aktif turun nabzı — StageTimeline'daki onaylı desenin aynısı.
const Pulse = memo(({ style }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System };
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, ...cfg }),
        withTiming(0, { duration: 0, ...cfg }),
      ),
      -1,
    );
  }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: 0.30 * (1 - p.value) }));
  return <Animated.View pointerEvents="none" style={[style, a]} />;
});

// Tüm ölçüler ölçülen genişlikten türer — sihirli sabit yok.
function treeGeometry(width) {
  if (!width) return null;
  const finalW = Math.round(Math.min(124, Math.max(92, width * 0.3)));
  const sideW = (width - finalW) / 2;
  const colSpan = sideW / SIDE_COLS;
  const tickW = Math.max(9, Math.min(22, colSpan * 0.58));
  const top = TREE_PAD_Y;
  const bottom = TREE_H - TREE_LABEL_H - TREE_PAD_Y;
  const step = (bottom - top) / 8;

  // Satır merkezleri BracketTree'deki gibi özyinelemeli: her üst tur, altındaki
  // iki maçın tam ortasına oturur.
  const centers = [Array.from({ length: 8 }, (_, i) => top + step * (i + 0.5))];
  for (let r = 1; r < SIDE_COLS; r++) {
    centers[r] = Array.from({ length: 8 >> r }, (_, j) =>
      (centers[r - 1][2 * j] + centers[r - 1][2 * j + 1]) / 2);
  }
  const midY = centers[SIDE_COLS - 1][0];
  // Final posterleri okunabilir olmalı — BracketTree'nin 34x50'sinden bile büyük.
  const posterW = Math.min(44, Math.max(30, Math.floor((finalW - 14) / 2)));
  const posterH = Math.round(posterW * 1.5);
  return { width, finalW, sideW, colSpan, tickW, centers, midY, posterW, posterH };
}

// 30 bağlantı → sadece 2 <Path> (soluk ray + kazananın ilerlediği yol).
// centerW: merkezdeki içeriğin (final çifti ya da şampiyon posteri) GERÇEK
// genişliği — yarı final çizgileri tam posterin kenarında bitsin diye.
function treePaths(geo, rounds, centerW) {
  const { width, colSpan, tickW, centers, midY } = geo;
  const edge = (width - centerW) / 2;
  const muted = [];
  const active = [];

  for (let side = 0; side < 2; side++) {
    const left = side === 0;
    const X = (x) => (left ? x : width - x);
    for (let r = 0; r < SIDE_COLS - 1; r++) {
      const half = 8 >> r;
      const childR = r * colSpan + tickW;
      const parentL = (r + 1) * colSpan;
      const mx = (childR + parentL) / 2;
      for (let j = 0; j < half; j++) {
        const m = rounds?.[r]?.matches?.[left ? j : half + j];
        const d = `M${X(childR)} ${centers[r][j]}H${X(mx)}V${centers[r + 1][j >> 1]}H${X(parentL)}`;
        (isDecided(m) ? active : muted).push(d);
      }
    }
    // Yarı final → final
    const sfM = rounds?.[SIDE_COLS - 1]?.matches?.[left ? 0 : 1];
    const d = `M${X((SIDE_COLS - 1) * colSpan + tickW)} ${midY}H${X(edge)}`;
    (isDecided(sfM) ? active : muted).push(d);
  }
  return { muted: muted.join(" "), active: active.join(" ") };
}

// Final/şampiyon posteri — gold YALNIZ burada (BracketTree'deki kural).
// Rozet dilbilgisi de BracketTree'den: kazanana kupa (sağ üst), kendi oyuma
// accent onay işareti (sağ alt); kaybeden RENK DEĞİŞTİRMEZ, yalnız solar.
function TreePoster({ c, w, h, winner, loser, mine, accent, getTmdbUrl }) {
  const uri = c?.posterPath ? getTmdbUrl(c.posterPath, "poster", w) : null;
  return (
    <View
      style={{
        width: w, height: h, borderRadius: 6, overflow: "hidden",
        borderWidth: winner ? 2 : 1,
        borderColor: winner ? GOLD : "rgba(255,255,255,0.42)",
        backgroundColor: "rgba(255,255,255,0.10)",
        opacity: loser ? 0.42 : 1,
        alignItems: "center", justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.treePosterImage} contentFit="cover" transition={140} />
      ) : (
        <AppIcon family="Ionicons" name={c ? "image-outline" : "help"} size={14} color="rgba(255,255,255,0.55)" />
      )}
      {/* Sıra numarası poster üstünde okunabilsin diye alt karartma */}
      {!!c?.seed && (
        <LinearGradient
          colors={["rgba(4,7,18,0)", "rgba(4,7,18,0.85)"]}
          style={styles.treeScrim}
          pointerEvents="none"
        >
          <Text allowFontScaling={false} style={styles.treeSeedText}>#{c.seed}</Text>
        </LinearGradient>
      )}
      {winner && (
        <View style={styles.treeWinBadge}>
          <AppIcon family="Ionicons" name="trophy" size={9} color={GOLD} />
        </View>
      )}
      {mine && (
        <View style={[styles.treeMineBadge, { backgroundColor: accent }]}>
          <AppIcon family="Ionicons" name="checkmark" size={8} color="#fff" />
        </View>
      )}
    </View>
  );
}

// Büyük bracket'in Hub kartına sığan, iki taraflı GERÇEK özeti: 16 sol + 16 sağ
// çentik ortadaki finale daralır. Çentiğin dolgusu maçın durumunu taşır
// (dolu = oynandı, boş çerçeve = şu an oylanıyor, soluk = sırada), kazananın
// yolu beyaz çizgiyle finale kadar izlenir. Posterler yalnız okunabildikleri
// yerde — finalde — kullanılır; final bittiyse yerini şampiyon posteri alır.
function TournamentTreePreview({ bracket, getTmdbUrl, accent, lang, phase, activeRound, myPicks }) {
  const [canvasWidth, setCanvasWidth] = useState(0);
  const rounds = bracket?.rounds;
  const geo = useMemo(() => treeGeometry(canvasWidth), [canvasWidth]);

  const finalRound = rounds?.[ROUNDS.length - 1];
  const finalMatch = finalRound?.matches?.[0] || null;
  const champion = bracket?.championDecided ? bracket.champion : null;
  // Gold ancak final GERÇEKTEN kurulduğunda (yarı final bitip final açıldığında)
  // gelir; yarı final sürerken görünen çift henüz değişebilir → projeksiyon.
  const finalSet = !!champion || !!(finalRound && (finalRound.votable || finalRound.decided));
  // Şampiyon posteri tek ve daha büyük; final ise iki posterlik bir sıra.
  const champW = geo ? Math.min(48, geo.posterW + 8) : 0;
  const centerW = champion ? champW : geo ? 2 * geo.posterW + 6 : 0;
  const paths = useMemo(
    () => (geo ? treePaths(geo, rounds, centerW) : null),
    [geo, rounds, centerW],
  );
  const doneCount = useMemo(
    () => (rounds ? rounds.reduce((n, r) => n + r.matches.filter(isDecided).length, 0) : 0),
    [rounds],
  );

  // Başlık rozeti — her fazda DOĞRUYU söyler (sabit "SON 32" yok).
  const chip = !rounds
    ? { text: lang === "tr" ? "HAZIRLANIYOR" : "PREPARING", dot: "rgba(255,255,255,0.55)", gold: false }
    : champion
      ? { text: lang === "tr" ? "ŞAMPİYON" : "CHAMPION", dot: GOLD, gold: true }
      : phase === "voting" && ROUNDS[activeRound]
        ? { text: upperLocale(roundLabel(ROUNDS[activeRound], lang), lang), dot: "#EF4444", gold: false, live: true }
        : { text: lang === "tr" ? "PROJEKSİYON" : "PROJECTED", dot: "rgba(255,255,255,0.55)", gold: false };

  return (
    // İlerleme bilgisi kartın KENDİ accessibilityLabel'ında duyurulur; burada
    // iç içe accessible View açmak iOS'ta dış etiketi bastırırdı.
    <View style={styles.treePreview} pointerEvents="none">
      <View style={styles.treeHeader}>
        <AppIcon family="Ionicons" name="git-network-outline" size={11} color="rgba(255,255,255,0.80)" />
        <Text allowFontScaling={false} style={styles.treeHeaderText}>
          {lang === "tr" ? "ELEME AĞACI" : "BRACKET"}
        </Text>
        <View style={styles.treeHeaderSpacer} />
        {!!rounds && (
          <Text allowFontScaling={false} style={styles.treeCountText}>
            {doneCount}/{TOTAL_MATCHES}
          </Text>
        )}
        <View style={[styles.treeChip, chip.gold && styles.treeChipGold]}>
          {chip.live && <Pulse style={[styles.treeChipPulse, { backgroundColor: chip.dot }]} />}
          <View style={[styles.treeDot, { backgroundColor: chip.dot }]} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.treeChipText, chip.gold && styles.treeChipTextGold]}
          >
            {chip.text}
          </Text>
        </View>
      </View>

      <View
        style={styles.treeCanvas}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== canvasWidth) setCanvasWidth(w);
        }}
      >
        {!!geo && (
          <>
            {/* Bağlantılar: önce soluk ray, üstüne kazananın yolu */}
            <Svg width={geo.width} height={TREE_H} style={StyleSheet.absoluteFill}>
              {!!paths.muted && (
                <Path d={paths.muted} fill="none" stroke={TRACK_LINE} strokeWidth={1.3}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {!!paths.active && (
                <Path d={paths.active} fill="none" stroke={DONE} strokeWidth={2.2}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>

            {/* Maç çentikleri — 30 eleme maçının tamamı */}
            {[0, 1, 2, 3].map((r) => {
              const half = 8 >> r;
              const h = TICK_H[r];
              return [0, 1].map((side) =>
                Array.from({ length: half }, (_, j) => {
                  const m = rounds?.[r]?.matches?.[side === 0 ? j : half + j];
                  const done = isDecided(m);
                  const live = !!(m && m.votable && !done);
                  return (
                    <View
                      key={`t${r}_${side}_${j}`}
                      style={[
                        styles.treeTick,
                        {
                          left: side === 0 ? r * geo.colSpan : geo.width - r * geo.colSpan - geo.tickW,
                          top: geo.centers[r][j] - h / 2,
                          width: geo.tickW,
                          height: h,
                          borderRadius: h / 2,
                          backgroundColor: done ? DONE : live ? "rgba(255,255,255,0.20)" : TRACK,
                        },
                        live && styles.treeTickLive,
                      ]}
                    />
                  );
                }),
              );
            })}

            {/* Merkez: final eşleşmesi — veya final bittiyse şampiyon.
                İçerik TAM midY'de merkezlenir (etiket akışta değil, alt şeritte)
                ki yarı final çizgileri posterlerin dikey ortasında bitsin. */}
            <View style={[styles.treeFinalWrap, { left: geo.sideW, width: geo.finalW }]}>
              {champion ? (
                <TreePoster
                  c={champion} w={champW} h={Math.round(champW * 1.5)}
                  winner accent={accent} getTmdbUrl={getTmdbUrl}
                />
              ) : (
                <View style={styles.treeFinalRow}>
                  <TreePoster
                    c={finalMatch?.a} w={geo.posterW} h={geo.posterH}
                    winner={isDecided(finalMatch) && finalMatch.winnerSide === "a"}
                    loser={isDecided(finalMatch) && finalMatch.winnerSide === "b"}
                    mine={myPicks?.[finalMatch?.matchId] === "a"}
                    accent={accent}
                    getTmdbUrl={getTmdbUrl}
                  />
                  <TreePoster
                    c={finalMatch?.b} w={geo.posterW} h={geo.posterH}
                    winner={isDecided(finalMatch) && finalMatch.winnerSide === "b"}
                    loser={isDecided(finalMatch) && finalMatch.winnerSide === "a"}
                    mine={myPicks?.[finalMatch?.matchId] === "b"}
                    accent={accent}
                    getTmdbUrl={getTmdbUrl}
                  />
                </View>
              )}
            </View>

            {/* Tur etiketleri — her sütunun tam altında, aktif tur parlar.
                Merkezdekiler BracketTree'nin 9 sütunluk etiket şeridiyle aynı
                dili konuşur: dıştan içe 32 · 16 · ÇF · YF · FİNAL · YF · … */}
            {[0, 1, 2, 3].map((r) =>
              [0, 1].map((side) => (
                <Text
                  key={`l${r}_${side}`}
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.treeColLabel,
                    {
                      left: (side === 0 ? r * geo.colSpan : geo.width - r * geo.colSpan - geo.tickW)
                        + geo.tickW / 2 - 13,
                      opacity: activeRound === r ? 1 : 0.42,
                    },
                  ]}
                >
                  {shortRound(ROUNDS[r].key, lang)}
                </Text>
              )),
            )}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.treeColLabel,
                styles.treeCenterLabel,
                { left: geo.sideW, width: geo.finalW },
                finalSet && styles.treeCenterLabelGold,
              ]}
            >
              {champion
                ? (lang === "tr" ? "ŞAMPİYON" : "CHAMPION")
                : shortRound("final", lang)}
            </Text>
          </>
        )}
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
  const [seed, setSeed] = useState(null);     // { finalists, tallies } | null
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
        // Agg dokümanı YOKSA (Cloud Function henüz kurulmadıysa) tüm oy
        // koleksiyonundan say — TournamentScreen ile AYNI kural. Aksi halde
        // tallies boş kalır ve ağaç, oylara değil seed sırasına göre kazanan
        // gösterirdi; yani detay ekranından farklı bir şampiyon çıkardı.
        if (!a) {
          const votes = await fetchVotesOnce(periodId);
          if (!active) return;
          nomTally = tallyNominations(votes);
          tallies = tallyVotes(votes);
        }
        // Havuz > 32 ise finalistler hype oylarından türer (ekranla aynı kural).
        setSeed({ finalists: selectFinalists(d.nominees, nomTally), tallies });
      } else {
        setSeed(null);
      }
    })();
    return () => { active = false; };
  }, [periodId, phaseInfo.phase, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bracket AĞDAN değil, çekilen tohumdan türer: nowMs değiştikçe (30 sn'de bir)
  // yeniden hesaplanır, böylece bir tur Hub açıkken KAPANDIĞINDA ağaç kendi
  // kendine ilerler. (Oy sayımları tek seferlik okunur; tazelenmeleri için
  // ekran yeniden odaklanmalı — Hub'ı hafif tutmak bilinçli bir ödün.)
  const bracketPreview = useMemo(
    () => (seed
      ? buildBracket({ nominees: seed.finalists, tallies: seed.tallies, periodId, ms: nowMs })
      : null),
    [seed, periodId, nowMs],
  );

  const phaseColor = PHASE_COLOR[phaseInfo.phase] || PHASE_COLOR.selection;
  const theTheme = lang === "tr" ? entry.tr : entry.en;

  // Kişisel durum: hype hakkı / aktif turdaki oy sayısı.
  const myNomCount = useMemo(
    () => Object.keys(myVote?.noms || {}).filter((k) => myVote.noms[k]).length,
    [myVote],
  );
  // Ağaç için sabit kimlik: myVote her tazelemede yeni nesne olur, picks değil.
  const myPicks = useMemo(() => myVote?.picks || null, [myVote]);
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

  // Ekran okuyucu için ağacın ilerlemesi (ağaç paneli sessizdir).
  const bracketProgress = useMemo(() => {
    if (!bracketPreview) return null;
    const done = bracketPreview.rounds.reduce(
      (n, r) => n + r.matches.filter((m) => m.decided && m.winnerSide).length, 0,
    );
    return lang === "tr"
      ? `${TOTAL_MATCHES} maçın ${done} tanesi tamamlandı`
      : `${done} of ${TOTAL_MATCHES} matches complete`;
  }, [bracketPreview, lang]);

  // Katılım satırı (agg varsa): "N katılımcı".
  const votersLine =
    agg?.voters > 0
      ? `${agg.voters} ${i18nText("autoI18n.tournament_widget_voters", "katılımcı")}`
      : null;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.tournament_open", "Aylık turnuvayı aç")} — ${theTheme}, ${phaseLabel}${bracketProgress ? `, ${bracketProgress}` : ""}`}
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
          accent={theme.accent}
          lang={lang}
          phase={phaseInfo.phase}
          activeRound={phaseInfo.activeRound}
          myPicks={myPicks}
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

  // ── Eleme ağacı önizlemesi ──────────────────────────────────────────────────
  // Panelin yüksekliği SABİT DEĞİL: başlık (26) + tuval (TREE_H) kadar büyür,
  // böylece eski 105/28/76 uyuşmazlığı yapısal olarak imkânsız.
  treePreview: {
    width: "100%", marginTop: 10, borderRadius: 16,
    backgroundColor: "rgba(5,10,24,0.40)", overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
  },
  treeHeader: {
    height: 26, paddingHorizontal: 10, flexDirection: "row",
    alignItems: "center", gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  treeHeaderText: { color: "rgba(255,255,255,0.80)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 },
  treeHeaderSpacer: { flex: 1 },
  treeCountText: {
    color: "rgba(255,255,255,0.52)", fontSize: 9, fontWeight: "800",
    letterSpacing: 0.2, marginRight: 2,
  },
  treeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.12)", maxWidth: "46%",
  },
  treeChipGold: { backgroundColor: "rgba(245,197,24,0.20)" },
  treeChipPulse: { position: "absolute", left: 4, width: 12, height: 12, borderRadius: 6 },
  treeDot: { width: 4.5, height: 4.5, borderRadius: 2.5 },
  treeChipText: { color: "#fff", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.5, flexShrink: 1 },
  treeChipTextGold: { color: "#FDE68A" },

  treeCanvas: { height: TREE_H, position: "relative" },
  treeTick: { position: "absolute" },
  treeTickLive: { borderWidth: 1.2, borderColor: "#fff" },

  treeFinalWrap: {
    position: "absolute", top: 0, height: TREE_H - TREE_LABEL_H,
    alignItems: "center", justifyContent: "center", zIndex: 2,
  },
  treeFinalRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  treePosterImage: { width: "100%", height: "100%" },
  treeScrim: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: "42%",
    justifyContent: "flex-end", paddingBottom: 1.5, paddingHorizontal: 3,
  },
  treeSeedText: { color: "rgba(255,255,255,0.92)", fontSize: 8.5, fontWeight: "900" },
  treeWinBadge: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, padding: 2,
  },
  // Sağ alt: BracketTree'deki mineBadge ile aynı köşe (sıra numarası solda).
  treeMineBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 13, height: 13, borderRadius: 6.5,
    alignItems: "center", justifyContent: "center",
  },
  treeColLabel: {
    position: "absolute", bottom: 0, width: 26, textAlign: "center",
    color: "#fff", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.3,
  },
  treeCenterLabel: { opacity: 1, color: "rgba(255,255,255,0.62)" },
  treeCenterLabelGold: { color: "#FDE68A" },
});
