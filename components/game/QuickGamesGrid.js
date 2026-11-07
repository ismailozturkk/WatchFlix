// components/game/QuickGamesGrid.js
//
// Eğlence'deki Oyunlar modülünün oyun listesi: Sahne Tahmin + Poster Bulmaca + "Önce hangisi?" +
// utils/quickGames.js'teki oyunlar. Her kart oyunun mekaniğini anlatan küçük bir ÖNİZLEME taşır
// (components/game/GamePreviews.js), altında adı ve rekoru (ya da "Yeni").
//
// KOMPAKT DÜZEN: bütün oyunlar tek satırlık "Hızlı oyunlar" rayındadır. `leadingTiles`
// (Sahne Tahmin + Poster Bulmaca) rayın başına eklenir; `bleed` ile ekran kenarına taşar.
//
// Raydaki yerel hızlı oyunların Premium kapısı yoktur. Sahne Tahmin ve Poster Bulmaca kendi mevcut
// `locked` durumlarını korur; tek raya taşınmaları erişim davranışını değiştirmez.
//
// `leadingTiles` öğesi { id, colors, title, best, locked } taşır; kilitliyse rekor yerine "Premium" yazar.
// Dokunuşta yine `onOpen(id)`. `title={null}`: ray başlığı çizilmez.

import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { PressableScale, SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { Keys, useStored } from "@services/storage";
import { normalizeOlderStats } from "@utils/olderGame";
import { getOlderCopy } from "@utils/olderGameCopy";
import { dailyChainRecord } from "@utils/filmChain";
import { getFilmChainCopy } from "@utils/filmChainCopy";
import { QUICK_GAME_IDS, QUICK_GAME_META, normalizeQuickStats } from "@utils/quickGames";
import { getQuickCopy } from "@utils/quickGamesCopy";
import GamePreview from "./GamePreviews";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const GOLD = "#FFD76A";
const EMPTY = [];
const RAIL_PREVIEW = 88;

/** "Önce hangisi?" bu ailenin ilk üyesi; kendi rotası ve kayıt anahtarı var. */
const OLDER_TILE = { id: "older", colors: ["#6366F1", "#4338CA"] };
/** Film Zinciri (screens/game/FilmChainScreen): rayın başında, günlük bulmacası olan tek hızlı oyun. */
const CHAIN_TILE = { id: "chain", colors: ["#14B8A6", "#0F766E"] };

function cardIconOf(tile, best) {
  if (tile.locked) return "diamond";
  if (tile.meta?.icon) return tile.meta.icon;
  if (QUICK_GAME_META[tile.id]?.icon) return QUICK_GAME_META[tile.id].icon;
  if (tile.id === "scene_guess") return "film-outline";
  if (tile.id === "poster_puzzle") return "grid-outline";
  if (tile.id === "older") return "swap-horizontal";
  return best > 0 ? "trophy" : "game-controller-outline";
}

function GameCard({ tile, best, copy, onOpen, style }) {
  const cardIcon = cardIconOf(tile, best);
  const metaHighlight = !tile.locked && (tile.meta?.highlight || best > 0);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={() => onOpen(tile.id)}
      scaleTo={0.97}
      style={[styles.railWrap, { shadowColor: tile.colors[1] }, style]}
    >
      <LinearGradient
        colors={tile.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.railCard]}
      >
        <View pointerEvents="none" style={styles.ambientTop} />
        <View pointerEvents="none" style={styles.ambientBottom} />

        <View pointerEvents="none" style={[styles.preview, { height: RAIL_PREVIEW }]}>
          <GamePreview gameId={tile.id} height={RAIL_PREVIEW} />
          <LinearGradient
            colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0)", "rgba(0,0,0,0.18)"]}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <View pointerEvents="none" style={styles.gameIcon}>
          <AppIcon family="Ionicons" name={cardIcon} size={14} color="#FFFFFF" />
        </View>

        <View style={styles.cardBody}>
          <Text
            style={[styles.title, styles.titleRail]}
            numberOfLines={2}
            allowFontScaling={false}
          >
            {tile.title}
          </Text>
          <View style={styles.footer}>
            <View style={[styles.meta, metaHighlight && styles.metaHighlight]}>
              <AppIcon
                family="Ionicons"
                name={tile.locked ? "diamond" : tile.meta ? tile.meta.icon : best > 0 ? "trophy" : "sparkles"}
                size={11}
                color={metaHighlight ? GOLD : "rgba(255,255,255,0.9)"}
              />
              <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
                {tile.locked ? "Premium" : tile.meta ? tile.meta.text : best > 0 ? copy.cardBest(best) : copy.cardNew}
              </Text>
            </View>
            <View style={styles.playButton}>
              <AppIcon family="Ionicons" name="play" size={10} color={tile.colors[1]} />
            </View>
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

// `chainLocked`: Film Zinciri bu planda kapalı (registry "film_chain") — kart "Premium" yazar; dokunuş yine `onOpen`.
function QuickGamesGrid({ theme, onOpen, leadingTiles = EMPTY, title, bleed = 0, chainLocked = false }) {
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const copy = getOlderCopy(language); // ortak metinler + "Önce hangisi?" başlığı
  const quick = getQuickCopy(language);
  const chainCopy = getFilmChainCopy(language);

  const olderRaw = useStored(Keys.olderGame, { uid });
  const quickRaw = useStored(Keys.quickGames, { uid });
  const bests = useMemo(() => {
    const all = normalizeQuickStats(quickRaw);
    const map = { older: normalizeOlderStats(olderRaw).best };
    QUICK_GAME_IDS.forEach((id) => { map[id] = all[id]?.best || 0; });
    return map;
  }, [olderRaw, quickRaw]);

  // Film Zinciri: rekor yerine bugünün günlük durumu ("Bugün çözüldü" / "Bugünün zinciri").
  const chainRaw = useStored(Keys.filmChain, { uid });
  const chainDone = useMemo(() => !!dailyChainRecord(chainRaw), [chainRaw]);

  const railTiles = [
    ...leadingTiles,
    {
      ...CHAIN_TILE,
      title: chainCopy.title,
      locked: chainLocked,
      meta: chainDone
        ? { icon: "checkmark-circle", text: chainCopy.cardDone, highlight: true }
        : { icon: "git-network-outline", text: chainCopy.cardToday, highlight: false },
    },
    { ...OLDER_TILE, title: copy.title },
    ...QUICK_GAME_IDS.map((id) => ({
      id,
      colors: QUICK_GAME_META[id].colors,
      title: quick.games[id].title,
    })),
  ];

  const heading = title === undefined ? quick.gridTitle : title;

  return (
    <View>
      {heading ? (
        <View
          style={[
            styles.header,
            styles.headerFirst,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={[styles.headerIcon, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="game-controller" size={15} color="#FFFFFF" />
          </View>
          <SectionHeader title={heading} theme={theme} style={styles.headingSection} />
          <View style={[styles.countPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Text style={[styles.countText, { color: theme.text.secondary }]} allowFontScaling={false}>
              {railTiles.length}
            </Text>
            <View style={[styles.countDot, { backgroundColor: theme.accent }]} />
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.railScroll, bleed ? { marginHorizontal: -bleed } : null]}
        contentContainerStyle={[styles.rail, { paddingLeft: bleed, paddingRight: bleed + 6 }]}
      >
        {railTiles.map((tile) => (
          <GameCard key={tile.id} tile={tile} best={tile.best ?? bests[tile.id] ?? 0} copy={copy} onOpen={onOpen} />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(QuickGamesGrid);

const styles = StyleSheet.create({
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  headerFirst: { marginTop: 4 },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  headingSection: { flex: 1, marginTop: 0, marginBottom: 0, paddingHorizontal: 0 },
  countPill: {
    height: 26,
    minWidth: 42,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  countText: { fontSize: 11, fontWeight: "900" },
  countDot: { width: 5, height: 5, borderRadius: 3 },
  // Ray kartı: ScrollView gölgeyi keser; gölge kısa, raya dikey pay verilir.
  railWrap: {
    width: 166,
    borderRadius: 22,
    elevation: 5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
  },
  // Üstte GLASS_PRESS_ROOM: basılan cam kart satırın kırpma sınırında kesilmesin; eski 6 pt'nin
  // fazlası dış boşluktan düşülür (yerleşim aynı).
  railScroll: { marginTop: 6 - GLASS_PRESS_ROOM },
  rail: { gap: 12, paddingTop: GLASS_PRESS_ROOM, paddingBottom: 14 },
  card: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  railCard: { minHeight: 190, borderRadius: 22, padding: 9 },
  ambientTop: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -62,
    right: -34,
    backgroundColor: "rgba(255,255,255,0.17)",
  },
  ambientBottom: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    bottom: -56,
    left: -28,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  preview: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  gameIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,12,20,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  cardBody: { flex: 1, paddingHorizontal: 2, paddingBottom: 1 },
  title: { color: "#FFFFFF", fontWeight: "900", letterSpacing: -0.25, marginTop: 10 },
  titleRail: { fontSize: 13.5, lineHeight: 16.5, minHeight: 34 },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: "auto", paddingTop: 7 },
  meta: {
    flex: 1,
    minWidth: 0,
    height: 27,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  metaHighlight: { backgroundColor: "rgba(35,24,3,0.23)", borderColor: "rgba(255,215,106,0.26)" },
  metaText: { flex: 1, color: "rgba(255,255,255,0.94)", fontSize: 10.5, fontWeight: "800" },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
});
