// components/game/GamePreviews.js
//
// Eğlence > Oyunlar kartlarındaki küçük "nasıl oynanır" önizlemeleri: her oyun kendi mekaniğini tek bakışta
// anlatan minik bir sahne çizer (sahne karesi + şıklar, parçalı afiş, iki afiş + yıl, oy çubukları, on yıl /
// film-dizi / tür şıkları). Doğru şık işaretlidir — kart oyunu "oynanmış bir soru" gibi gösterir.
//
// AĞDAN BAĞIMSIZ: afişler uygulamayla paketlenen splash havuzundan (data/splashPosterCatalog) SABİT seçilir;
// önizlemedeki doğru cevaplar o yapımların GERÇEK bilgisidir (yıl, film/dizi, tür, TMDB oy sayısı). Afiş
// değiştirilirse cevap da değişmeli — PREVIEW_FACTS tek yer.
//
// Animasyon yok: Hub kaydırılırken yedi kart birden iş çıkarmasın (LevelRing ile aynı ilke).
// Her önizleme bulunduğu kutuyu doldurur; boyutu kartın önizleme alanı belirler (`height`).

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import { getQuickCopy } from "@utils/quickGamesCopy";
import { SPLASH_POSTER_CATALOG } from "../../data/splashPosterCatalog";

const GREEN = "#34D399";

const posterOf = (mediaType, id) =>
  SPLASH_POSTER_CATALOG.find((p) => p.mediaType === mediaType && p.id === id) || SPLASH_POSTER_CATALOG[0];

/** Önizlemelerin afişleri ve bu afişlere ait doğru cevaplar. */
export const PREVIEW_FACTS = Object.freeze({
  scene_guess: { poster: posterOf("movie", 19995) }, // Avatar
  poster_puzzle: { poster: posterOf("tv", 93405) }, // Squid Game
  older: {
    first: { poster: posterOf("movie", 13), year: 1994 }, // Forrest Gump
    second: { poster: posterOf("movie", 27205), year: 2010 }, // Inception
  },
  popular: { winner: posterOf("movie", 157336), loser: posterOf("tv", 69050) }, // Interstellar > Riverdale
  decade: { poster: posterOf("movie", 680), options: [1970, 1990, 2010], correct: 1990 }, // Pulp Fiction (1994)
  kind: { poster: posterOf("tv", 1396), correct: "tv" }, // Breaking Bad
  genre: { poster: posterOf("movie", 155), options: ["comedy", "action", "romance"], correct: "action" }, // The Dark Knight
  // Bulanık Afiş: şıklar yapım BAŞLIKLARI (çevrilmez); doğru olan afişin kendi adı.
  blur: { poster: posterOf("movie", 550), options: ["Se7en", "Fight Club", "Memento"], correct: "Fight Club", points: 70 },
});

// Sahne karesinde gizlenen parçalar (3×3, soldan sağa) — afişin yarısı açık kalsın.
const PUZZLE_HIDDEN = [0, 2, 4, 5, 7];

function MiniPoster({ poster, height, style, children }) {
  return (
    <View style={[styles.poster, { height, width: Math.round((height * 2) / 3) }, style]}>
      <Image source={poster.source} style={styles.fill} contentFit="cover" />
      {children}
    </View>
  );
}

/** Dikey şık listesi: doğru olan beyaz dolgulu + tik, diğerleri cam. */
function OptionStack({ labels, correctIndex, compact }) {
  return (
    <View style={styles.options}>
      {labels.map((label, index) => {
        const right = index === correctIndex;
        return (
          <View key={label} style={[styles.option, compact && styles.optionCompact, right && styles.optionRight]}>
            <Text
              style={[styles.optionText, compact && styles.optionTextCompact, right && styles.optionTextRight]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {label}
            </Text>
            {right ? <AppIcon family="Ionicons" name="checkmark-circle" size={compact ? 10 : 11} color={GREEN} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function ScenePreview({ height }) {
  const { poster } = PREVIEW_FACTS.scene_guess;
  return (
    <View style={[styles.frame, { height }]}>
      <Image source={poster.source} style={styles.fill} contentFit="cover" contentPosition="center" />
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]} style={styles.fill} />
      {/* Vizör köşeleri: "bu kare hangi yapımdan?" */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      <View style={styles.sceneQuestion}>
        <AppIcon family="Ionicons" name="help" size={13} color="#FFFFFF" />
      </View>
      <View style={styles.sceneBars}>
        <View style={styles.sceneBar} />
        <View style={[styles.sceneBar, styles.sceneBarRight]}>
          <AppIcon family="Ionicons" name="checkmark" size={9} color="#064E3B" />
        </View>
      </View>
    </View>
  );
}

function PuzzlePreview({ height }) {
  const { poster } = PREVIEW_FACTS.poster_puzzle;
  const posterHeight = height - 10;
  return (
    <View style={[styles.center, { height }]}>
      {/* Arkada aynı afişin bulanık hâli: kutu boş kalmasın, "netleşen afiş" hissi. */}
      <Image source={poster.source} style={styles.fill} contentFit="cover" blurRadius={14} />
      <View style={[styles.fill, styles.dim]} />
      <MiniPoster poster={poster} height={posterHeight}>
        <View style={styles.puzzleGrid}>
          {Array.from({ length: 9 }, (_, index) => {
            const hidden = PUZZLE_HIDDEN.includes(index);
            return (
              <View key={index} style={[styles.puzzleCell, hidden && styles.puzzleCellHidden]}>
                {hidden && index === 4 ? (
                  <AppIcon family="Ionicons" name="help" size={10} color="rgba(255,255,255,0.8)" />
                ) : null}
              </View>
            );
          })}
        </View>
      </MiniPoster>
    </View>
  );
}

function OlderPreview({ height }) {
  const { first, second } = PREVIEW_FACTS.older;
  const posterHeight = height - 10;
  return (
    <View style={[styles.row, { height }]}>
      <MiniPoster poster={first.poster} height={posterHeight} style={styles.posterRight}>
        <View style={[styles.yearTag, styles.yearTagRight]}>
          <Text style={styles.yearText} allowFontScaling={false}>{first.year}</Text>
        </View>
      </MiniPoster>
      <View style={styles.vs}>
        <AppIcon family="Ionicons" name="swap-horizontal" size={11} color="#FFFFFF" />
      </View>
      <MiniPoster poster={second.poster} height={posterHeight}>
        <View style={styles.yearTag}>
          <Text style={styles.yearText} allowFontScaling={false}>{second.year}</Text>
        </View>
      </MiniPoster>
    </View>
  );
}

function PopularPreview({ height }) {
  const { winner, loser } = PREVIEW_FACTS.popular;
  const posterHeight = height - 20;
  const ratio = loser.voteCount / winner.voteCount;
  const column = (poster, fill, right) => (
    <View style={styles.voteColumn}>
      <MiniPoster poster={poster} height={posterHeight} style={right && styles.posterRight} />
      <View style={[styles.voteTrack, { width: Math.round((posterHeight * 2) / 3) }]}>
        <View style={[styles.voteFill, { width: `${Math.round(fill * 100)}%` }, right && styles.voteFillRight]} />
      </View>
    </View>
  );
  return (
    <View style={[styles.row, styles.rowWide, { height }]}>
      {column(winner, 1, true)}
      <AppIcon family="Ionicons" name="people" size={13} color="rgba(255,255,255,0.85)" />
      {column(loser, ratio, false)}
    </View>
  );
}

function ChoicePreview({ poster, labels, correctIndex, height, compact }) {
  return (
    <View style={[styles.row, styles.choiceRow, { height }]}>
      <MiniPoster poster={poster} height={height - 10} />
      <OptionStack labels={labels} correctIndex={correctIndex} compact={compact} />
    </View>
  );
}

/** Yarı netleşmiş afiş + kalan süre çubuğu + o anki puan; yanında başlık şıkları. */
function BlurPreview({ height, compact, pointsLabel }) {
  const { poster, options, correct, points } = PREVIEW_FACTS.blur;
  return (
    <View style={[styles.row, styles.choiceRow, { height }]}>
      <MiniPoster poster={poster} height={height - 10}>
        <Image source={poster.source} style={styles.fill} contentFit="cover" blurRadius={6} />
        <View style={styles.blurTrack}>
          <View style={[styles.blurFill, { width: `${points}%` }]} />
        </View>
        <View style={styles.blurPoints}>
          <Text style={styles.blurPointsText} allowFontScaling={false} numberOfLines={1}>
            {pointsLabel(points)}
          </Text>
        </View>
      </MiniPoster>
      <OptionStack labels={options} correctIndex={options.indexOf(correct)} compact={compact} />
    </View>
  );
}

/**
 * Oyun kimliğine göre önizleme. Bilinmeyen kimlikte null (kart yalnız simgeyle çizilir).
 * @param {{ gameId: string, height: number }} props
 */
function GamePreview({ gameId, height }) {
  const { language } = useLanguage();
  const quick = getQuickCopy(language);
  const compact = height < 84;
  switch (gameId) {
    case "scene_guess":
      return <ScenePreview height={height} />;
    case "poster_puzzle":
      return <PuzzlePreview height={height} />;
    case "older":
      return <OlderPreview height={height} />;
    case "popular":
      return <PopularPreview height={height} />;
    case "decade": {
      const { poster, options, correct } = PREVIEW_FACTS.decade;
      return (
        <ChoicePreview
          poster={poster}
          labels={options.map((d) => quick.decadeLabel(d))}
          correctIndex={options.indexOf(correct)}
          height={height}
          compact={compact}
        />
      );
    }
    case "kind": {
      const { poster, correct } = PREVIEW_FACTS.kind;
      const keys = ["movie", "tv"];
      return (
        <ChoicePreview
          poster={poster}
          labels={keys.map((k) => quick.kind[k])}
          correctIndex={keys.indexOf(correct)}
          height={height}
          compact={compact}
        />
      );
    }
    case "genre": {
      const { poster, options, correct } = PREVIEW_FACTS.genre;
      return (
        <ChoicePreview
          poster={poster}
          labels={options.map((g) => quick.genres[g])}
          correctIndex={options.indexOf(correct)}
          height={height}
          compact={compact}
        />
      );
    }
    case "blur":
      return <BlurPreview height={height} compact={compact} pointsLabel={quick.blur.points} />;
    default:
      return null;
  }
}

export default memo(GamePreview);

const CORNER = 10;

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  dim: { backgroundColor: "rgba(0,0,0,0.35)" },
  center: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  rowWide: { gap: 8 },
  choiceRow: { gap: 8, paddingHorizontal: 8, justifyContent: "flex-start" },
  poster: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  posterRight: { borderColor: GREEN, borderWidth: 1.5 },

  // Sahne Tahmin
  frame: { overflow: "hidden" },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "rgba(255,255,255,0.9)" },
  cornerTL: { top: 7, left: 7, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 },
  cornerTR: { top: 7, right: 7, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 },
  cornerBL: { bottom: 7, left: 7, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 7, right: 7, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 },
  sceneQuestion: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  sceneBars: { position: "absolute", left: 22, right: 22, bottom: 9, flexDirection: "row", gap: 5 },
  sceneBar: { flex: 1, height: 13, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.32)" },
  sceneBarRight: { backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },

  // Poster Bulmaca
  puzzleGrid: { ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" },
  puzzleCell: {
    width: "33.333%",
    height: "33.333%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  puzzleCellHidden: { backgroundColor: "rgba(17,17,30,0.9)" },

  // Önce hangisi?
  vs: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  yearTag: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 1,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  yearTagRight: { backgroundColor: "rgba(6,78,59,0.9)" },
  yearText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900" },

  // Hangisi daha çok izlendi?
  voteColumn: { alignItems: "center", gap: 5 },
  voteTrack: { height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.25)" },
  voteFill: { height: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)" },
  voteFillRight: { backgroundColor: GREEN },

  // Bulanık Afiş
  blurTrack: { position: "absolute", left: 3, right: 3, top: 3, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.3)" },
  blurFill: { height: "100%", borderRadius: 2, backgroundColor: "#FFFFFF" },
  blurPoints: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 1,
    alignItems: "center",
    backgroundColor: "rgba(6,78,59,0.9)",
  },
  blurPointsText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },

  // Şıklı önizlemeler (on yıl / film-dizi / tür)
  options: { flex: 1, minWidth: 0, gap: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  optionCompact: { paddingHorizontal: 6, paddingVertical: 3 },
  optionRight: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  optionText: { flexShrink: 1, color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  optionTextCompact: { fontSize: 9 },
  optionTextRight: { color: "#111827" },
});
