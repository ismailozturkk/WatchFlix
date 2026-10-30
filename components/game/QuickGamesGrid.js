// components/game/QuickGamesGrid.js
//
// Eğlence'deki Oyunlar modülünün oyun listesi: "Önce hangisi?" + utils/quickGames.js'teki dört oyun, ve (Eğlence
// modülünde) başta Sahne Tahmin + Poster Bulmaca. Her kart oyunun mekaniğini anlatan küçük bir ÖNİZLEME taşır
// (components/game/GamePreviews.js), altında adı ve rekoru (ya da "Yeni").
//
// KOMPAKT DÜZEN (23 Eki): eskiden yedi oyun 2 sütunlu ızgarada dört satır (~450 pt) tutuyordu ve kareler yalnız
// simgeydi. Şimdi:
//   • `leadingTiles` (iki sahne oyunu) yan yana iki büyük önizlemeli kart
//   • hızlı oyunlar tek satırlık yatay ray (başlıklı); `bleed` ile ekran kenarına taşar, kenarda kesik görünmez
//
// Premium kapısı YOK ve modülün kilit şeridinden bağımsızdır (Sahne Tahmin kilitliyken de oynanır): oyunlar yerel,
// sunucu maliyeti yok, deneme kapısı olarak çalışır. Kilitlemek istenirse `onOpen`i modülün `guarded`ına sar.
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
const FEATURE_PREVIEW = 96;
const RAIL_PREVIEW = 72;

/** "Önce hangisi?" bu ailenin ilk üyesi; kendi rotası ve kayıt anahtarı var. */
const OLDER_TILE = { id: "older", colors: ["#6366F1", "#4338CA"] };
/** Film Zinciri (screens/game/FilmChainScreen): rayın başında, günlük bulmacası olan tek hızlı oyun. */
const CHAIN_TILE = { id: "chain", colors: ["#14B8A6", "#0F766E"] };

function GameCard({ tile, best, copy, onOpen, feature, style }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={() => onOpen(tile.id)}
      scaleTo={0.97}
      style={[feature ? styles.featureWrap : styles.railWrap, { shadowColor: tile.colors[1] }, style]}
    >
      <LinearGradient
        colors={tile.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, feature ? styles.featureCard : styles.railCard]}
      >
        <View pointerEvents="none" style={[styles.preview, { height: feature ? FEATURE_PREVIEW : RAIL_PREVIEW }]}>
          <GamePreview gameId={tile.id} height={feature ? FEATURE_PREVIEW : RAIL_PREVIEW} />
        </View>
        <Text
          style={[styles.title, feature ? styles.titleFeature : styles.titleRail]}
          numberOfLines={2}
          allowFontScaling={false}
        >
          {tile.title}
        </Text>
        <View style={styles.meta}>
          <AppIcon
            family="Ionicons"
            name={tile.locked ? "diamond" : tile.meta ? tile.meta.icon : best > 0 ? "trophy" : "sparkles"}
            size={11}
            color={!tile.locked && (tile.meta ? tile.meta.highlight : best > 0) ? GOLD : "#FFFFFF"}
          />
          <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
            {tile.locked ? "Premium" : tile.meta ? tile.meta.text : best > 0 ? copy.cardBest(best) : copy.cardNew}
          </Text>
          {feature && !tile.locked ? (
            <View style={styles.play}>
              <AppIcon family="Ionicons" name="play" size={10} color={tile.colors[1]} />
            </View>
          ) : null}
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
      {leadingTiles.length ? (
        <View style={styles.featureRow}>
          {leadingTiles.map((tile) => (
            <GameCard key={tile.id} tile={tile} best={tile.best ?? 0} copy={copy} onOpen={onOpen} feature />
          ))}
        </View>
      ) : null}

      {heading ? (
        <SectionHeader
          title={heading}
          theme={theme}
          style={[styles.header, !leadingTiles.length && styles.headerFirst]}
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.railScroll, bleed ? { marginHorizontal: -bleed } : null]}
        contentContainerStyle={[styles.rail, { paddingHorizontal: bleed }]}
      >
        {railTiles.map((tile) => (
          <GameCard key={tile.id} tile={tile} best={bests[tile.id] ?? 0} copy={copy} onOpen={onOpen} />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(QuickGamesGrid);

const styles = StyleSheet.create({
  header: { marginTop: 14, marginBottom: 2, paddingHorizontal: 4 },
  headerFirst: { marginTop: 4 },
  featureRow: { flexDirection: "row", gap: 10 },
  featureWrap: {
    flex: 1,
    borderRadius: 20,
    elevation: 5,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
  },
  // Ray kartı: ScrollView gölgeyi keser; gölge kısa, raya dikey pay verilir.
  railWrap: {
    width: 150,
    borderRadius: 18,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  // Üstte GLASS_PRESS_ROOM: basılan cam kart satırın kırpma sınırında kesilmesin; eski 6 pt'nin
  // fazlası dış boşluktan düşülür (yerleşim aynı).
  railScroll: { marginTop: 6 - GLASS_PRESS_ROOM },
  rail: { gap: 10, paddingTop: GLASS_PRESS_ROOM, paddingBottom: 10 },
  card: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  featureCard: { flexGrow: 1, borderRadius: 20, padding: 8 },
  railCard: { borderRadius: 18, padding: 7 },
  preview: { borderRadius: 13, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.2)" },
  title: { color: "#FFFFFF", fontWeight: "900", letterSpacing: -0.2, marginTop: 8, paddingHorizontal: 3 },
  titleFeature: { fontSize: 14.5, lineHeight: 18 },
  titleRail: { fontSize: 12.5, lineHeight: 15.5, minHeight: 31 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: "auto", paddingTop: 4, paddingHorizontal: 3, paddingBottom: 2 },
  metaText: { flex: 1, color: "rgba(255,255,255,0.92)", fontSize: 11, fontWeight: "800" },
  play: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
