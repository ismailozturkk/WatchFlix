// components/tournament/BracketTree.js
//
// Klasik İKİ TARAFLI eleme ağacı: 16 yapım solda, 16 sağda; iki yarı ortadaki
// FİNAL'e doğru daralır. Yerleşim (düğüm kutuları, bağlantı yolları, şampiyon
// yuvası) saf modülde hesaplanır: components/tournament/bracketLayout.js.
//
// "Arena" görünümü: ağaç, ayın TÜRÜNÜN renginden koyulaştırılmış bir zeminde
// durur (genreMeta.arenaColors) — hero ile aynı renk dili, tema açık/koyu ne
// olursa olsun koyu → üstündeki beyaz/parıltı her zaman okunur.
//
// Görsel kurallar:
//   • Düğümde iki poster + altında oy dağılımı çubuğu (önde olan taraf parlak).
//   • Kazananın bir üst tura İLERLEDİĞİ yol türün parıltı renginde, kalın ve
//     hafif ışımalı; henüz oynanmamış yollar soluk. Dirsekler yuvarlak.
//   • Kazanan poster parıltı çerçeveli, kaybeden solar; sıra numarası poster altında.
//   • Final altın çerçeveli; üstünde şampiyon yuvası: final bittiyse şampiyonun
//     büyük posteri, bitmediyse boş kupa (soru işaretli) bekler.
//   • Şu an oylanan tur: sütunları renkli şeritle vurgulanır, başlığında canlı
//     nokta; o turun maçlarının çevresinde nabız atan halka.
//   • Sütun başlıkları turun durumunu söyler: ✓ bitti · ● canlı · 🔒 başlangıç günü.
//
// ETKİLEŞİM:
//   • Her maç düğümü DOKUNULABİLİR → onMatchPress(match): ekran MatchCard'lı
//     detay/oy modalını açar (oy verme buradan da mümkün).
//   • `focusRound` (ekrandaki tur rayının seçimi) değişince ağaç o tura kayar;
//     ilk açılışta da seçili tura (oylamada aktif tur, sonuçta final) konumlanır.
//   • Oyumu kullandığım taraf posterinde küçük onay rozeti.

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
  cancelAnimation, ReduceMotion,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import AppIcon from "@components/AppIcon";
import { roundLabel, ROUNDS, DAY, getPeriodStartMs } from "@services/tournamentEngine";
import { pickByLanguage, tmdbLanguageOf } from "../../utils/appLanguages";
import { FALLBACK_GENRE_META, arenaColors } from "@components/tournament/genreMeta";
import {
  bracketLayout, focusScrollX, isDecided, SLOT_ROUND, HEADER_H,
  POSTER_W, POSTER_H, FINAL_POSTER_W, FINAL_POSTER_H, CHAMP_W, CHAMP_H, CHAMP_LABEL_H,
} from "@components/tournament/bracketLayout";

const GOLD = "#F5C518";
const GOLD_SOFT = "#FDE68A";
const LINE_MUTED = "rgba(255,255,255,0.15)";
const NODE_BG = "rgba(255,255,255,0.06)";
const NODE_BORDER = "rgba(255,255,255,0.13)";
const BAR_TRACK = "rgba(255,255,255,0.12)";
const BAR_TRAIL = "rgba(255,255,255,0.38)";
const INK = "#0B0F1A"; // parıltı rengi (açık pastel) üstünde koyu simge

const COPY = {
  tr: { title: "ELEME AĞACI", live: "Canlı", done: "Bitti", mine: "Oyum", path: "Kazanan yolu", champion: "ŞAMPİYON", tbd: "ŞAMPİYON ?", hint: "Maça dokun", matches: "maç" },
  en: { title: "BRACKET", live: "Live", done: "Done", mine: "Your vote", path: "Winner's path", champion: "CHAMPION", tbd: "CHAMPION ?", hint: "Tap a match", matches: "matches" },
  es: { title: "CUADRO", live: "En vivo", done: "Terminado", mine: "Tu voto", path: "Camino del ganador", champion: "CAMPEÓN", tbd: "¿CAMPEÓN?", hint: "Toca un duelo", matches: "duelos" },
  pt: { title: "CHAVE", live: "Ao vivo", done: "Concluído", mine: "Seu voto", path: "Caminho do vencedor", champion: "CAMPEÃO", tbd: "CAMPEÃO?", hint: "Toque num duelo", matches: "duelos" },
  de: { title: "TURNIERBAUM", live: "Live", done: "Fertig", mine: "Deine Stimme", path: "Siegerweg", champion: "CHAMPION", tbd: "CHAMPION?", hint: "Duell antippen", matches: "Duelle" },
};

// Türkçe-güvenli BÜYÜK harf: JS'in toUpperCase'i 'i' → 'I' yapar ("FINAL"),
// doğrusu 'İ'dir (eski sürüm textTransform ile "ÇEYREK FINAL" yazıyordu).
const upper = (s, lang) => (lang === "tr" ? String(s).replace(/i/g, "İ") : String(s)).toUpperCase();

// ─── Canlı maç halkası — tüm canlı düğümler TEK nabız değerini paylaşır ───────
// Dinlenme değeri (p=0) görünürdür: Reanimated ilk değeri geri yazsa da halka kalır.
function LiveHalo({ pulse, color }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.75 * (1 - pulse.value),
    transform: [{ scale: 1 + 0.07 * pulse.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.liveHalo, { borderColor: color }, style]} />;
}

function LiveDot({ pulse, color }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + 1.2 * pulse.value }],
  }));
  return (
    <View style={styles.liveDotWrap}>
      <Animated.View style={[styles.liveDotRing, { backgroundColor: color }, style]} />
      <View style={[styles.liveDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Tek poster ───────────────────────────────────────────────────────────────
function PosterCell({ c, w, h, winner, loser, mine, glow, gold, getTmdbUrl }) {
  const uri = c?.posterPath ? getTmdbUrl(c.posterPath, "poster", w) : null;
  return (
    <View
      style={[
        styles.poster,
        {
          width: w, height: h,
          borderWidth: winner ? 2 : 1,
          borderColor: winner ? (gold ? GOLD : glow) : "rgba(255,255,255,0.18)",
          opacity: loser ? 0.34 : 1,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={120} />
      ) : (
        <View style={styles.posterEmpty}>
          <AppIcon family="Ionicons" name={c ? "image-outline" : "help"} size={13} color="rgba(255,255,255,0.45)" />
        </View>
      )}
      {!!c?.seed && (
        <View style={styles.seedStrip} pointerEvents="none">
          <Text allowFontScaling={false} style={styles.seedText}>#{c.seed}</Text>
        </View>
      )}
      {winner && gold && (
        <View style={styles.winBadge}>
          <AppIcon family="Ionicons" name="trophy" size={9} color={GOLD} />
        </View>
      )}
      {mine && (
        <View style={[styles.mineBadge, { backgroundColor: glow }]}>
          <AppIcon family="Ionicons" name="checkmark" size={8} color={INK} />
        </View>
      )}
    </View>
  );
}

// ─── Oy dağılımı çubuğu ───────────────────────────────────────────────────────
function VoteBar({ match, glow }) {
  const total = match?.total || 0;
  if (!total) return <View style={styles.barTrack} />;
  const decidedSide = isDecided(match) ? match.winnerSide : null;
  const aLead = decidedSide ? decidedSide === "a" : match.aVotes > match.bVotes;
  const bLead = decidedSide ? decidedSide === "b" : match.bVotes > match.aVotes;
  return (
    <View style={[styles.barTrack, styles.barRow]}>
      {match.aVotes > 0 && <View style={{ flex: match.aVotes, backgroundColor: aLead ? glow : BAR_TRAIL }} />}
      {match.aVotes > 0 && match.bVotes > 0 && <View style={styles.barGap} />}
      {match.bVotes > 0 && <View style={{ flex: match.bVotes, backgroundColor: bLead ? glow : BAR_TRAIL }} />}
    </View>
  );
}

// ─── Maç düğümü (2 poster + oy çubuğu) — dokunulabilir ────────────────────────
function Node({ node, mySide, onPress, getTmdbUrl, glow, pulse }) {
  const m = node.match;
  const dec = isDecided(m);
  const live = !!(m?.votable && !dec);
  const isFinal = !!node.isFinal;
  const pw = isFinal ? FINAL_POSTER_W : POSTER_W;
  const ph = isFinal ? FINAL_POSTER_H : POSTER_H;
  const total = m?.total || 0;
  const pct = total ? Math.round((m.aVotes / total) * 100) : null;
  const label = [
    m?.a?.title || "?",
    "—",
    m?.b?.title || "?",
    pct != null ? `(%${pct} – %${100 - pct})` : "",
  ].join(" ");

  return (
    <Pressable
      onPress={onPress && m ? () => onPress(m) : undefined}
      disabled={!onPress || !m}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.node,
        {
          backgroundColor: isFinal ? "rgba(245,197,24,0.10)" : NODE_BG,
          borderColor: live ? glow : isFinal ? GOLD : NODE_BORDER,
          borderWidth: live || isFinal ? 1.5 : 1,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {live && <LiveHalo pulse={pulse} color={glow} />}
      <View style={styles.posterRow}>
        <PosterCell
          c={m?.a} w={pw} h={ph} glow={glow} gold={isFinal} getTmdbUrl={getTmdbUrl}
          winner={dec && m.winnerSide === "a"} loser={dec && m.winnerSide === "b"} mine={mySide === "a"}
        />
        <PosterCell
          c={m?.b} w={pw} h={ph} glow={glow} gold={isFinal} getTmdbUrl={getTmdbUrl}
          winner={dec && m.winnerSide === "b"} loser={dec && m.winnerSide === "a"} mine={mySide === "b"}
        />
      </View>
      <VoteBar match={m} glow={glow} />
    </Pressable>
  );
}

// ─── Sütun başlığı: tur adı + durum ───────────────────────────────────────────
function ColumnHeader({ x, w, round, def, isFinal, lang, copy, glow, pulse, startText }) {
  const state = round?.decided ? "done" : round?.votable ? "live" : "next";
  const color = isFinal ? GOLD_SOFT : state === "live" ? "#fff" : "rgba(255,255,255,0.72)";
  return (
    <View style={[styles.colHead, { left: x, width: w }]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[styles.colLabel, { color }]}
      >
        {upper(roundLabel(def, lang), lang)}
      </Text>
      <View style={styles.colState}>
        {state === "live" ? (
          <>
            <LiveDot pulse={pulse} color={glow} />
            <Text allowFontScaling={false} style={[styles.colStateText, { color: glow }]}>{copy.live}</Text>
          </>
        ) : state === "done" ? (
          <>
            <AppIcon family="Ionicons" name="checkmark-circle" size={10} color="rgba(255,255,255,0.55)" />
            <Text allowFontScaling={false} style={styles.colStateText}>{copy.done}</Text>
          </>
        ) : (
          <>
            <AppIcon family="Ionicons" name="lock-closed" size={9} color="rgba(255,255,255,0.45)" />
            {!!startText && <Text allowFontScaling={false} style={styles.colStateText}>{startText}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

function BracketTree({
  rounds = [], genre, periodId, focusRound, getTmdbUrl, lang = "tr", myPicks = {}, onMatchPress,
}) {
  const meta = genre || FALLBACK_GENRE_META;
  const glow = meta.glow;
  const copy = pickByLanguage(lang, COPY);
  const layout = useMemo(() => bracketLayout(rounds), [rounds]);

  const paths = useMemo(() => {
    if (!layout) return null;
    return {
      muted: layout.paths.filter((p) => !p.active).map((p) => p.d).join(" "),
      active: layout.paths.filter((p) => p.active).map((p) => p.d).join(" "),
    };
  }, [layout]);

  const activeRound = rounds.findIndex((r) => r.votable);
  const totalMatches = rounds.reduce((n, r) => n + (r.matches?.length || 0), 0);
  const doneCount = useMemo(
    () => rounds.reduce((n, r) => n + r.matches.filter(isDecided).length, 0),
    [rounds],
  );

  // Kilitli turların başlangıç günü ("16 Eki").
  const startTexts = useMemo(() => {
    if (!periodId) return [];
    const base = getPeriodStartMs(periodId);
    return ROUNDS.map((d) => {
      try {
        return new Date(base + d.startDay * DAY).toLocaleDateString(tmdbLanguageOf(lang), { day: "numeric", month: "short" });
      } catch {
        return "";
      }
    });
  }, [periodId, lang]);

  // Canlı tur varsa tek nabız (tüm halkalar + başlık noktası paylaşır).
  const pulse = useSharedValue(0);
  const hasLive = activeRound >= 0;
  useEffect(() => {
    if (!hasLive) return undefined;
    const cfg = { reduceMotion: ReduceMotion.System };
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1300, ...cfg }), withTiming(0, { duration: 0, ...cfg })),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [hasLive, pulse]);

  // Seçili tura kaydır. Ağaç 30 sn'de bir yeniden hesaplanır (nowMs) — kaydırma
  // yalnız TUR SEÇİMİ ya da görünüm genişliği değişince olur, yoksa kullanıcının
  // elle kaydırdığı yer her tazelemede geri alınırdı. Geometri sabittir (yalnız
  // durum bayrakları değişir), bu yüzden son yerleşimi ref'ten okumak yeterli.
  const scrollRef = useRef(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [viewportW, setViewportW] = useState(0);
  const scrolledOnce = useRef(false);
  const ready = !!layout;
  useEffect(() => {
    if (!ready || !viewportW || focusRound == null) return;
    const x = focusScrollX(layoutRef.current, focusRound, viewportW);
    scrollRef.current?.scrollTo({ x, y: 0, animated: scrolledOnce.current });
    scrolledOnce.current = true;
  }, [ready, viewportW, focusRound]);

  if (!layout) return null;
  const { champ } = layout;
  const progress = totalMatches ? doneCount / totalMatches : 0;

  return (
    <LinearGradient colors={arenaColors(meta)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.arena}>
      {/* Üst şerit: başlık + ilerleme */}
      <View style={styles.topBar}>
        <AppIcon family="Ionicons" name="git-network" size={13} color={glow} />
        <Text allowFontScaling={false} style={styles.topTitle}>{copy.title}</Text>
        <View style={styles.flex} />
        <Text allowFontScaling={false} style={styles.topCount}>
          {doneCount}/{totalMatches} {copy.matches}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: glow }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== viewportW) setViewportW(w);
        }}
      >
        <View style={{ width: layout.width, height: layout.height }}>
          {/* Aktif turun şeritleri (iki yarıda da) */}
          {hasLive &&
            layout.lanes
              .filter((l) => l.round === activeRound)
              .map((l) => (
                <View
                  key={l.key}
                  pointerEvents="none"
                  style={[styles.lane, { left: l.x, width: l.w, height: layout.height - 8, backgroundColor: glow }]}
                />
              ))}

          {/* Sütun başlıkları */}
          {SLOT_ROUND.map((r, slot) => (
            <ColumnHeader
              key={`h${slot}`}
              x={layout.colX[slot]}
              w={layout.colW[slot]}
              round={rounds[r]}
              def={ROUNDS[r]}
              isFinal={r === ROUNDS.length - 1}
              lang={lang}
              copy={copy}
              glow={glow}
              pulse={pulse}
              startText={startTexts[r]}
            />
          ))}

          {/* Bağlantılar: soluk ray → kazananın yolu (ışıma + çizgi) → şampiyon bağı */}
          <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
            {!!paths.muted && (
              <Path d={paths.muted} fill="none" stroke={LINE_MUTED} strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round" />
            )}
            {!!paths.active && (
              <>
                <Path d={paths.active} fill="none" stroke={glow} strokeOpacity={0.22} strokeWidth={6}
                  strokeLinecap="round" strokeLinejoin="round" />
                <Path d={paths.active} fill="none" stroke={glow} strokeWidth={2.2}
                  strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            <Path
              d={champ.path} fill="none"
              stroke={champ.champion ? GOLD : "rgba(245,197,24,0.45)"}
              strokeWidth={champ.champion ? 2.4 : 1.5}
              strokeDasharray={champ.champion ? undefined : "3 4"}
              strokeLinecap="round"
            />
          </Svg>

          {/* Maç düğümleri */}
          {layout.nodes.map((n) => (
            <View key={n.key} style={[styles.nodeSlot, { left: n.x, top: n.y, width: n.w, height: n.h }]}>
              <Node
                node={n}
                mySide={myPicks[n.match?.matchId] || null}
                onPress={onMatchPress}
                getTmdbUrl={getTmdbUrl}
                glow={glow}
                pulse={pulse}
              />
            </View>
          ))}

          {/* Şampiyon yuvası (finalin üstünde) */}
          <View
            style={[styles.champWrap, { left: champ.x - 14, top: champ.labelY, width: CHAMP_W + 28 }]}
            accessible
            accessibilityLabel={champ.champion ? `${copy.champion}: ${champ.champion.title || ""}` : copy.tbd}
          >
            <View style={styles.champLabelRow}>
              <AppIcon family="Ionicons" name="trophy" size={11} color={GOLD} />
              <Text allowFontScaling={false} numberOfLines={1} style={styles.champLabel}>
                {champ.champion ? copy.champion : copy.tbd}
              </Text>
            </View>
            {champ.champion ? (
              <View style={styles.champFrame}>
                {champ.champion.posterPath ? (
                  <Image
                    source={{ uri: getTmdbUrl(champ.champion.posterPath, "poster", CHAMP_W) }}
                    style={styles.fill}
                    contentFit="cover"
                    transition={160}
                  />
                ) : (
                  <View style={styles.posterEmpty}>
                    <AppIcon family="Ionicons" name="image-outline" size={18} color="rgba(255,255,255,0.5)" />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.champEmpty}>
                <AppIcon family="Ionicons" name="trophy-outline" size={26} color="rgba(245,197,24,0.6)" />
                <Text allowFontScaling={false} style={styles.champEmptyQ}>?</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Lejant + ipucu */}
      <View style={styles.legend}>
        {hasLive && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLive, { borderColor: glow }]} />
            <Text allowFontScaling={false} style={styles.legendText}>{copy.live}</Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.legendMine, { backgroundColor: glow }]}>
            <AppIcon family="Ionicons" name="checkmark" size={7} color={INK} />
          </View>
          <Text allowFontScaling={false} style={styles.legendText}>{copy.mine}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: glow }]} />
          <Text allowFontScaling={false} style={styles.legendText}>{copy.path}</Text>
        </View>
        <View style={styles.flex} />
        <View style={styles.legendItem}>
          <AppIcon family="Ionicons" name="hand-left-outline" size={11} color="rgba(255,255,255,0.55)" />
          <Text allowFontScaling={false} style={styles.legendText}>{copy.hint}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },

  arena: {
    borderRadius: 22, overflow: "hidden", marginBottom: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
  },
  topTitle: { color: "#fff", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.9 },
  topCount: { color: "rgba(255,255,255,0.62)", fontSize: 10, fontWeight: "800" },
  progressTrack: {
    width: 56, height: 4, borderRadius: 2, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  lane: { position: "absolute", top: 4, borderRadius: 12, opacity: 0.08 },

  colHead: { position: "absolute", top: 6, height: HEADER_H - 6, alignItems: "center" },
  colLabel: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4, textAlign: "center", maxWidth: "100%" },
  colState: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, height: 12 },
  colStateText: { color: "rgba(255,255,255,0.55)", fontSize: 8.5, fontWeight: "800" },
  liveDotWrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  liveDotRing: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },

  nodeSlot: { position: "absolute" },
  node: {
    flex: 1, borderRadius: 10, padding: 4,
    alignItems: "center", justifyContent: "space-between",
  },
  liveHalo: {
    position: "absolute", left: -4, right: -4, top: -4, bottom: -4,
    borderRadius: 13, borderWidth: 2,
  },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 5 },

  poster: { borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  posterEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  seedStrip: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 3, paddingVertical: 1,
    backgroundColor: "rgba(4,7,18,0.62)",
  },
  seedText: { color: "rgba(255,255,255,0.92)", fontSize: 7.5, fontWeight: "900" },
  winBadge: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, padding: 2,
  },
  // Sağ alt: widget'taki treeMineBadge ile aynı köşe (sıra numarası solda).
  mineBadge: {
    position: "absolute", bottom: 1.5, right: 1.5,
    width: 12, height: 12, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },

  barTrack: {
    alignSelf: "stretch", height: 3, borderRadius: 1.5, overflow: "hidden",
    backgroundColor: BAR_TRACK, marginHorizontal: 1,
  },
  barRow: { flexDirection: "row" },
  barGap: { width: 1.5 },

  champWrap: { position: "absolute", alignItems: "center" },
  champLabelRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    height: CHAMP_LABEL_H - 4, marginBottom: 4,
  },
  champLabel: { color: GOLD_SOFT, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },
  champFrame: {
    width: CHAMP_W, height: CHAMP_H, borderRadius: 9, overflow: "hidden",
    borderWidth: 2, borderColor: GOLD,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  champEmpty: {
    width: CHAMP_W, height: CHAMP_H, borderRadius: 9,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(245,197,24,0.5)",
    backgroundColor: "rgba(245,197,24,0.06)",
    alignItems: "center", justifyContent: "center", gap: 2,
  },
  champEmptyQ: { color: "rgba(253,230,138,0.7)", fontSize: 15, fontWeight: "900" },

  legend: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    columnGap: 12, rowGap: 6,
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.10)",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { color: "rgba(255,255,255,0.68)", fontSize: 9.5, fontWeight: "800" },
  legendLive: { width: 12, height: 9, borderRadius: 3, borderWidth: 1.5 },
  legendMine: { width: 11, height: 11, borderRadius: 5.5, alignItems: "center", justifyContent: "center" },
  legendLine: { width: 14, height: 2.5, borderRadius: 1.5 },
});

export default memo(BracketTree);
