// components/profile/ProfileGamesModule.js
//
// Eğlence sekmesindeki "Oyunlar" modülü (dosya adı, profilden taşındığı günden
// kaldı). Üç katman, yukarıdan aşağıya:
//   1) Günlük Meydan Okuma — tek dokunuşla oynanır, her gün yeni set
//   2) Oyun ızgarası       — TÜM oyunlar tek ızgarada: Sahne Tahmin + Poster
//                            Bulmaca + hızlı oyunlar (components/game/QuickGamesGrid)
//   3) Oyuncu şeridi       — seviye/XP/seri; dokununca Oyun Merkezi (ilerleme)
//
// SADELEŞTİRME (23 Eki): Sahne Tahmin'e girmek eskiden üç ekran sürüyordu
// (oyun vitrini → kurulum → oyun) ve modülde iki ayrı oyun bölümü vardı. Şimdi
// karta dokununca kurulum ALT SAYFASI (GameSetupSheet) burada açılır, son
// seçimler hazırdır, "Oyunu Başlat" doğrudan oyuna gider.
//
// Veri tek okuma (useGameStats); ekran her odaklandığında içerik yerinde
// kalarak arkadan tazelenir.

import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Skeleton from "@components/Skeleton";
import PremiumPill from "@components/premium/PremiumPill";
import { usePremiumGate } from "@hooks/usePremiumGate";
import DailyChallengeCard from "@components/game/DailyChallengeCard";
import DuelSendButton from "@components/game/DuelSendButton";
import GameSetupSheet from "@components/game/GameSetupSheet";
import QuickGamesGrid from "@components/game/QuickGamesGrid";
import { duelPayloadFromResult } from "@utils/dailyDuel";
import PlayerStrip from "@components/game/PlayerStrip";
import { SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
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
  const { user } = useAuth();
  const { ready, stats } = useGameStats();
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
    if (gameId === "older") navigation.navigate("OlderGameScreen", { source: "hub" });
    else navigation.navigate("QuickGameScreen", { gameId, source: "hub" });
  };

  // Sahne Tahmin + Poster Bulmaca, hızlı oyunlarla aynı karo dilinde ızgaranın başında.
  const leadingTiles = useMemo(
    () =>
      GAME_REGISTRY.map((game) => ({
        id: game.id,
        icon: game.icon.name,
        colors: resolveGameAccentColors(game, theme),
        title: i18nText(game.titleKey, game.id),
        best: bestScoreForGame(stats, game.id),
        locked,
      })),
    [stats, theme, locked],
  );

  return (
    <View style={styles.module}>
      <SectionHeader title={i18nText("autoI18n.oyunlar", "Oyunlar")} theme={theme} style={styles.header} />

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
          <DailyChallengeCard daily={daily} theme={theme} onPlay={playDaily} onResult={openDailyBoard} />

          {/* Bugünkü deneme bittiyse: sonucu bir arkadaşa düello olarak gönder. */}
          {duelPayload ? <DuelSendButton payload={duelPayload} theme={theme} source="hub" /> : null}

          {/* Tek oyun ızgarası; hızlı oyunlar kilit şeridinden bağımsız, her planda açık. */}
          <QuickGamesGrid theme={theme} onOpen={openQuickGame} leadingTiles={leadingTiles} title={null} />

          <PlayerStrip progress={progress} theme={theme} user={user} onPress={openHub} compact />
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
      <Skeleton height={204} style={[styles.skeletonHero, box]} />
      <View style={[styles.tiles, styles.tilesSkeleton]}>
        <Skeleton width="48.5%" height={104} style={[styles.skeletonTile, box]} />
        <Skeleton width="48.5%" height={104} style={[styles.skeletonTile, box]} />
      </View>
      <View style={[styles.tiles, styles.tilesSkeleton]}>
        <Skeleton width="48.5%" height={104} style={[styles.skeletonTile, box]} />
        <Skeleton width="48.5%" height={104} style={[styles.skeletonTile, box]} />
      </View>
      <Skeleton height={76} style={[styles.skeletonStrip, box]} />
    </View>
  );
}

const styles = StyleSheet.create({
  module: { width: "90%", marginTop: 14, marginBottom: 15 },
  header: { marginTop: 0, paddingHorizontal: 10 },
  stack: { gap: 12 },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  lockText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  tiles: { flexDirection: "row", gap: 12 },
  tilesSkeleton: { justifyContent: "space-between" },
  skeletonHero: { borderRadius: 26 },
  skeletonTile: { borderRadius: 20 },
  skeletonStrip: { borderRadius: 22 },
});
