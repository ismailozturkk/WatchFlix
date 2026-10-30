// components/profile/ProfileGamesModule.js
//
// Eğlence sekmesindeki "Oyunlar" modülü (dosya adı, profilden taşındığı günden
// kaldı). Yukarıdan aşağıya:
//   0) Başlık + oyuncu çipi — seviye halkası/seri; dokununca Oyun Merkezi (ilerleme)
//   1) Günlük Meydan Okuma  — ince bant, tek dokunuşla oynanır, her gün yeni set
//   2) Oyunlar              — Sahne Tahmin + Poster Bulmaca yan yana iki büyük kart,
//                             altında hızlı oyunlar yatay rayda; her kartta oyunun
//                             küçük önizlemesi (components/game/QuickGamesGrid +
//                             GamePreviews)
//
// KOMPAKT DÜZEN (23 Eki, aynı gün ikinci istek): modül ~800 pt'den ~590 pt'ye indi —
// tam genişlik oyuncu şeridi başlığa çip oldu, günlük kart ince banda, 4 satırlık
// simge ızgarası önizlemeli iki kart + tek satırlık raya döndü.
//
// SADELEŞTİRME (23 Eki): Sahne Tahmin'e girmek eskiden üç ekran sürüyordu
// (oyun vitrini → kurulum → oyun) ve modülde iki ayrı oyun bölümü vardı. Şimdi
// karta dokununca kurulum ALT SAYFASI (GameSetupSheet) burada açılır, son
// seçimler hazırdır, "Oyunu Başlat" doğrudan oyuna gider.
//
// Veri tek okuma (useGameStats); ekran her odaklandığında içerik yerinde
// kalarak arkadan tazelenir.

import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Skeleton from "@components/Skeleton";
import PremiumPill from "@components/premium/PremiumPill";
import { usePremiumGate } from "@hooks/usePremiumGate";
import DailyChallengeCard from "@components/game/DailyChallengeCard";
import DuelSendButton from "@components/game/DuelSendButton";
import GameSetupSheet from "@components/game/GameSetupSheet";
import QuickGamesGrid from "@components/game/QuickGamesGrid";
import { duelPayloadFromResult } from "@utils/dailyDuel";
import { PlayerChip } from "@components/game/PlayerStrip";
import { SectionHeader } from "@components/game/ui";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useDailyView from "@hooks/useDailyView";
import useGameStats from "@hooks/useGameStats";
import { i18nText } from "@utils/i18nText";
import { DAILY_MODE_ID, DAILY_SOURCE_ID } from "@utils/dailyChallenge";
import { SCENE_GAME_ID } from "@screens/game/gameConfig";
import {
  bestScoreForGame,
  buildSceneGameProgress,
  GAME_REGISTRY,
  resolveGameAccentColors,
} from "@screens/game/gameRegistry";
import GlassPressable from "../common/GlassPressable";

const REGISTRY_IDS = new Set(GAME_REGISTRY.map((game) => game.id));

export default function ProfileGamesModule({ navigation }) {
  const { theme } = useTheme();
  useLanguage(); // dil değişince i18nText çağrıları yeniden değerlendirilsin
  const { ready, stats } = useGameStats();
  // Modül ekranın %90'ı: hızlı oyun rayı iki yandaki %5'e taşar (kenarda kesik görünmesin).
  const { width } = useWindowDimensions();
  const bleed = Math.round(width * 0.05);
  const daily = useDailyView(stats);
  const progress = useMemo(() => buildSceneGameProgress(stats, daily.now), [stats, daily.now]);
  // Kilitli (planda oyun yok) kullanıcıda düello yok: oynamadığı bir günü gönderecek sonucu zaten olmaz.
  const duelPayload = useMemo(
    () => (daily.status === "completed" ? duelPayloadFromResult(daily.result, { dayKey: daily.dayKey }) : null),
    [daily.status, daily.result, daily.dayKey],
  );
  // Kurulum sayfası: açıkken hangi oyun. Kapanışta oyun kimliği SİLİNMEZ
  // (sayfa çıkış animasyonu boyunca başlık boşalmasın); yalnız görünürlük düşer.
  const [setup, setSetup] = useState({ visible: false, gameId: SCENE_GAME_ID });

  // Oyunlar Premium'da. Free kullanıcıda modül görünür kalır (neyin kilitli
  // olduğu görülsün) ama her giriş yükseltme sayfasını açar, ekrana gitmez.
  // Günlük hakkı biten Premium kullanıcı kilitli SAYILMAZ: allows(0) yalnız
  // planda oyun hiç yoksa false döner; hak bitişini oyun başlangıcı denetler.
  const gamesGate = usePremiumGate("games");
  // Film Zinciri ayrı bir Premium erişimi (registry "film_chain"): kartı "Premium" yazar, dokununca yükseltme.
  const chainGate = usePremiumGate("film_chain");
  const chainLocked = !chainGate.allows(0);
  const locked = !gamesGate.allows(0);
  const guarded = (action) => (...args) => {
    if (locked) {
      gamesGate.showUpsell();
      return;
    }
    action(...args);
  };

  const openHub = guarded(() => navigation.navigate("GameHubScreen"));
  const playDaily = guarded(() =>
    navigation.navigate("SceneGamePlayScreen", {
      gameId: SCENE_GAME_ID,
      modeId: DAILY_MODE_ID,
      difficultyId: "normal",
      sourceId: DAILY_SOURCE_ID,
    }),
  );
  const openDailyBoard = guarded(() =>
    navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID, scope: "daily" }),
  );
  const openSetup = guarded((gameId) => setSetup({ visible: true, gameId }));
  // Hızlı oyunlar kilitten bağımsız: "Önce hangisi?" kendi rotasında, diğerleri ortak ekranda.
  const openQuickGame = (gameId) => {
    if (REGISTRY_IDS.has(gameId)) {
      openSetup(gameId);
      return;
    }
    if (gameId === "chain") {
      if (chainLocked) chainGate.showUpsell();
      else navigation.navigate("FilmChainScreen", { mode: "daily" });
    }
    else if (gameId === "older") navigation.navigate("OlderGameScreen", { source: "hub" });
    else navigation.navigate("QuickGameScreen", { gameId, source: "hub" });
  };

  // Sahne Tahmin + Poster Bulmaca, hızlı oyunlarla aynı karo dilinde ızgaranın başında.
  const leadingTiles = useMemo(
    () =>
      GAME_REGISTRY.map((game) => ({
        id: game.id,
        colors: resolveGameAccentColors(game, theme),
        title: i18nText(game.titleKey, game.id),
        best: bestScoreForGame(stats, game.id),
        locked,
      })),
    [stats, theme, locked],
  );

  return (
    <View style={styles.module}>
      <View style={styles.headerRow}>
        <SectionHeader title={i18nText("autoI18n.oyunlar", "Oyunlar")} theme={theme} style={styles.header} />
        {ready ? <PlayerChip progress={progress} theme={theme} onPress={openHub} /> : null}
      </View>

      {locked ? (
        <GlassPressable
          onPress={() => gamesGate.showUpsell()}
          accessibilityRole="button"
          style={[styles.lockBanner, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <PremiumPill />
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.lockText, { color: theme.text.secondary }]}
          >
            {i18nText(
              "autoI18n.hub_oyunlar_kilitli",
              "Sahne tahmin oyunları Premium'da. Günlük meydan okuma, liderlik tablosu ve istatistikler dahil.",
            )}
          </Text>
        </GlassPressable>
      ) : null}

      {!ready ? (
        <GamesModuleSkeleton theme={theme} />
      ) : (
        <View style={styles.stack}>
          <DailyChallengeCard daily={daily} theme={theme} onPlay={playDaily} onResult={openDailyBoard} compact />

          {/* Bugünkü deneme bittiyse: sonucu bir arkadaşa düello olarak gönder. */}
          {duelPayload ? <DuelSendButton payload={duelPayload} theme={theme} source="hub" dense /> : null}

          {/* Önizlemeli oyun kartları; hızlı oyunlar kilit şeridinden bağımsız, her planda açık. */}
          <QuickGamesGrid
            theme={theme}
            onOpen={openQuickGame}
            leadingTiles={leadingTiles}
            bleed={bleed}
            chainLocked={chainLocked}
          />
        </View>
      )}

      <GameSetupSheet
        visible={setup.visible}
        gameId={setup.gameId}
        stats={stats}
        bestScore={bestScoreForGame(stats, setup.gameId)}
        onClose={() => setSetup((current) => ({ ...current, visible: false }))}
        onStart={(params) => navigation.navigate("SceneGamePlayScreen", params)}
      />
    </View>
  );
}

function GamesModuleSkeleton({ theme }) {
  const box = { backgroundColor: theme.secondary };
  return (
    <View
      style={styles.stack}
      accessibilityLabel={i18nText("autoI18n.oyunlar_yukleniyor", "Oyunlar yükleniyor")}
    >
      <Skeleton height={134} style={[styles.skeletonHero, box]} />
      <View style={[styles.tiles, styles.tilesSkeleton]}>
        <Skeleton width="48.5%" height={170} style={[styles.skeletonTile, box]} />
        <Skeleton width="48.5%" height={170} style={[styles.skeletonTile, box]} />
      </View>
      <View style={styles.tiles}>
        <Skeleton width={150} height={142} style={[styles.skeletonTile, box]} />
        <Skeleton width={150} height={142} style={[styles.skeletonTile, box]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  module: { width: "90%", marginTop: 14, marginBottom: 15 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  header: { flex: 1, marginTop: 0, marginBottom: 0, paddingHorizontal: 10 },
  stack: { gap: 10 },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  lockText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  tiles: { flexDirection: "row", gap: 10, overflow: "hidden" },
  tilesSkeleton: { justifyContent: "space-between" },
  skeletonHero: { borderRadius: 22 },
  skeletonTile: { borderRadius: 20 },
});
