// components/tournament/BracketTree.js
//
// Klasik İKİ TARAFLI eleme ağacı: 16 yapım solda, 16 sağda; iki yarı ortadaki
// FİNAL'e doğru daralır. Maçlar gerçek BAĞLANTI ÇİZGİLERİ ile bağlanır.
//
// Görsel kurallar:
//   • Düğümlerde yalnız POSTER var (isim YOK), posterler büyük.
//   • Kazananın bir üst tura İLERLEDİĞİ yol accent (vurgu) renkli + kalın çizilir;
//     henüz oynanmamış/kaybeden yollar soluk (border) kalır.
//   • Kazanan poster accent çerçeveli + kupa rozetli; kaybeden solar.
//   • Final bittiyse finalin ÜSTÜNE şampiyonun büyük posteri (kupa + accent) konur.
//
// ETKİLEŞİM (genel yapı bozulmadan):
//   • Her maç düğümü DOKUNULABİLİR → onMatchPress(match): ekran, MatchCard'lı
//     detay/oy modalını açar (oy verme buradan da mümkün).
//   • Şu an oylanabilir maçlar accent kesikli çerçeve + canlı nokta ile vurgulanır.
//   • Oyumu kullandığım taraf posterinde küçük accent onay rozeti görünür.

import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import { roundLabel, ROUNDS } from "@services/tournamentEngine";

// ─── Ölçüler ──────────────────────────────────────────────────────────────────
const POSTER_W = 34;
const POSTER_H = 50;
const NODE_W = 2 * POSTER_W + 6 + 8;   // iki poster + aralarındaki boşluk + iç pay
const MATCH_H = POSTER_H + 8;
const GAP = 16;
const STEP = MATCH_H + GAP;
const CONN_W = 26;
const COLSPAN = NODE_W + CONN_W;
const HEADER_H = 24;
const PAD_TOP = HEADER_H + 18;
const LINE = 1.4;
const LINE_A = 2.6;
const CHAMP_W = 58;
const CHAMP_H = 86;

const SLOT_ROUND = [0, 1, 2, 3, 4, 3, 2, 1, 0];

// ─── Tek poster ───────────────────────────────────────────────────────────────
function PosterCell({ c, isWinner, isLoser, isMine, theme, getTmdbUrl, w = POSTER_W, h = POSTER_H }) {
  const empty = !c;
  const uri = !empty && c.posterPath ? getTmdbUrl(c.posterPath, "poster", w) : null;
  return (
    <View
      style={{
        width: w, height: h, borderRadius: 6, overflow: "hidden",
        borderWidth: isWinner ? 2 : 1,
        borderColor: isWinner ? theme.accent : theme.border,
        opacity: isLoser ? 0.4 : 1,
        backgroundColor: theme.between,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppIcon family="Ionicons" name={empty ? "help" : "image-outline"} size={13} color={theme.text.muted} />
        </View>
      )}
      {isWinner && (
        <View style={styles.winBadge}>
          <AppIcon family="Ionicons" name="trophy" size={9} color="#F5C518" />
        </View>
      )}
      {/* Benim oyum — kesinleşmiş seçim rozeti */}
      {isMine && (
        <View style={[styles.mineBadge, { backgroundColor: theme.accent }]}>
          <AppIcon family="Ionicons" name="checkmark" size={8} color="#fff" />
        </View>
      )}
    </View>
  );
}

// ─── Maç (2 poster yan yana) — dokunulabilir düğüm ───────────────────────────
function Node({ match, theme, getTmdbUrl, isFinal, mySide, onPress }) {
  const dec = match.decided && !!match.winnerSide;
  const hot = match.votable && !dec; // şu an oy verilebilir
  return (
    <Pressable
      onPress={onPress ? () => onPress(match) : undefined}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.node,
        {
          backgroundColor: theme.secondary,
          borderColor: hot ? theme.accent : isFinal ? "#F5C518" : theme.border,
          borderWidth: hot || isFinal ? 1.5 : 1,
          borderStyle: hot ? "dashed" : "solid",
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <PosterCell c={match.a} isWinner={dec && match.winnerSide === "a"} isLoser={dec && match.winnerSide === "b"} isMine={mySide === "a"} theme={theme} getTmdbUrl={getTmdbUrl} />
      <PosterCell c={match.b} isWinner={dec && match.winnerSide === "b"} isLoser={dec && match.winnerSide === "a"} isMine={mySide === "b"} theme={theme} getTmdbUrl={getTmdbUrl} />
      {/* Canlı (oylanabilir) nokta */}
      {hot && <View style={[styles.hotDot, { backgroundColor: theme.accent }]} />}
    </Pressable>
  );
}

export default function BracketTree({
  rounds = [], theme, getTmdbUrl, lang = "tr", myPicks = {}, onMatchPress,
}) {
  const geo = useMemo(() => {
    if (rounds.length < 5) return null;

    // Sol yarı maç Y-merkezleri (sağ yarı aynı Y'leri kullanır).
    const centers = [];
    const n0 = Math.floor(rounds[0].matches.length / 2); // 8
    centers[0] = Array.from({ length: n0 }, (_, i) => PAD_TOP + i * STEP + MATCH_H / 2);
    for (let r = 1; r < 4; r++) {
      const cnt = Math.floor(rounds[r].matches.length / 2);
      centers[r] = Array.from({ length: cnt }, (_, j) => (centers[r - 1][2 * j] + centers[r - 1][2 * j + 1]) / 2);
    }
    const midY = centers[3][0];
    const width = 8 * COLSPAN + NODE_W;
    const height = centers[0][n0 - 1] + MATCH_H / 2 + 16;

    // Düğümler
    const nodes = [];
    for (let r = 0; r < 4; r++) {
      const cnt = centers[r].length;
      for (let j = 0; j < cnt; j++) {
        nodes.push({ key: `L${r}_${j}`, x: r * COLSPAN, y: centers[r][j] - MATCH_H / 2, match: rounds[r].matches[j] });
        nodes.push({ key: `R${r}_${j}`, x: (8 - r) * COLSPAN, y: centers[r][j] - MATCH_H / 2, match: rounds[r].matches[cnt + j] });
      }
    }
    const finalMatch = rounds[4].matches[0];
    nodes.push({ key: "F", x: 4 * COLSPAN, y: midY - MATCH_H / 2, match: finalMatch, isFinal: true });

    // Çizgiler (active = kazananın ilerlediği yol)
    const lines = [];
    const addH = (x1, x2, y, active) => {
      const th = active ? LINE_A : LINE;
      lines.push({ left: Math.min(x1, x2), top: y - th / 2, width: Math.abs(x2 - x1), height: th, active });
    };
    const addV = (x, y1, y2, active) => {
      const th = active ? LINE_A : LINE;
      lines.push({ left: x - th / 2, top: Math.min(y1, y2), width: th, height: Math.abs(y2 - y1), active });
    };
    const dec = (m) => !!(m && m.decided && m.winnerSide); // maç bitti → kazananı ilerledi

    for (let r = 1; r < 4; r++) {
      const cnt = centers[r].length;
      const cntPrev = Math.floor(rounds[r - 1].matches.length / 2);
      for (let j = 0; j < cnt; j++) {
        const cT = centers[r - 1][2 * j];
        const cB = centers[r - 1][2 * j + 1];
        const cP = centers[r][j];
        // SOL yarı (sağa akar)
        {
          const topM = rounds[r - 1].matches[2 * j];
          const botM = rounds[r - 1].matches[2 * j + 1];
          const childR = (r - 1) * COLSPAN + NODE_W;
          const conn = childR + CONN_W / 2;
          addH(childR, conn, cT, dec(topM)); addV(conn, cT, cP, dec(topM));
          addH(childR, conn, cB, dec(botM)); addV(conn, cB, cP, dec(botM));
          addH(conn, r * COLSPAN, cP, dec(topM) || dec(botM));
        }
        // SAĞ yarı (sola akar — ayna)
        {
          const topM = rounds[r - 1].matches[cntPrev + 2 * j];
          const botM = rounds[r - 1].matches[cntPrev + 2 * j + 1];
          const childL = (8 - (r - 1)) * COLSPAN;
          const conn = childL - CONN_W / 2;
          addH(childL, conn, cT, dec(topM)); addV(conn, cT, cP, dec(topM));
          addH(childL, conn, cB, dec(botM)); addV(conn, cB, cP, dec(botM));
          addH(conn, (8 - r) * COLSPAN + NODE_W, cP, dec(topM) || dec(botM));
        }
      }
    }
    // Yarı finallerden finale
    addH(3 * COLSPAN + NODE_W, 4 * COLSPAN, midY, dec(rounds[3].matches[0]));
    addH(4 * COLSPAN + NODE_W, 5 * COLSPAN, midY, dec(rounds[3].matches[1]));

    // Şampiyon (final bittiyse)
    const champion = dec(finalMatch) ? finalMatch.winner : null;
    let champBox = null;
    if (champion) {
      const cx = 4 * COLSPAN + NODE_W / 2;
      const finalTop = midY - MATCH_H / 2;
      const imgTop = finalTop - 16 - CHAMP_H;
      champBox = { cx, champion, top: imgTop - 18, imgTop, imgBottom: finalTop - 16 };
      addV(cx, finalTop - 16, finalTop, true); // postere bağlayan accent çizgi
    }

    return { nodes, lines, width, height, midY, champBox };
  }, [rounds]);

  if (!geo) return null;
  const muted = geo.lines.filter((l) => !l.active);
  const active = geo.lines.filter((l) => l.active);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 10 }}>
      <View style={{ width: geo.width, height: geo.height }}>
        {/* Sütun başlıkları */}
        {SLOT_ROUND.map((rIdx, slot) => (
          <Text key={`h${slot}`} numberOfLines={1} style={[styles.colLabel, { left: slot * COLSPAN, width: NODE_W, color: slot === 4 ? "#F5C518" : theme.text.muted }]}>
            {roundLabel(ROUNDS[rIdx], lang)}
          </Text>
        ))}

        {/* Çizgiler: önce soluk, sonra accent (üstte kalsın) */}
        {muted.map((l, i) => (
          <View key={`m${i}`} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height, backgroundColor: theme.border, borderRadius: LINE }} />
        ))}
        {active.map((l, i) => (
          <View key={`a${i}`} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height, backgroundColor: theme.accent, borderRadius: LINE_A }} />
        ))}

        {/* Maç düğümleri */}
        {geo.nodes.map((n) => (
          <View key={n.key} style={{ position: "absolute", left: n.x, top: n.y, width: NODE_W, height: MATCH_H }}>
            <Node
              match={n.match}
              isFinal={n.isFinal}
              mySide={myPicks[n.match?.matchId] || null}
              onPress={onMatchPress}
              theme={theme}
              getTmdbUrl={getTmdbUrl}
            />
          </View>
        ))}

        {/* Şampiyon posteri (finalin üstünde) */}
        {geo.champBox && (
          <View style={{ position: "absolute", left: geo.champBox.cx - CHAMP_W / 2, top: geo.champBox.top, width: CHAMP_W, alignItems: "center" }}>
            <AppIcon family="Ionicons" name="trophy" size={15} color="#F5C518" />
            <View style={styles.champFrame}>
              {geo.champBox.champion.posterPath ? (
                <Image source={{ uri: getTmdbUrl(geo.champBox.champion.posterPath, "poster", CHAMP_W) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: theme.between }} />
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  colLabel: {
    position: "absolute",
    top: 4,
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  node: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 9,
    padding: 4,
  },
  winBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    padding: 2,
  },
  mineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  hotDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  champFrame: {
    width: CHAMP_W,
    height: CHAMP_H,
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#F5C518",
    marginTop: 2,
  },
});
