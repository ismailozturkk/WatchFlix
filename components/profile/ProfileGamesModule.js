// components/profile/ProfileGamesModule.js
//
// Hub sekmesindeki "Oyunlar" modülü (dosya adı, profilden taşındığı günden
// kaldı). Üç katman:
//   1) Günlük Meydan Okuma — tek dokunuşla oynanır, her gün yeni set
//   2) Oyun kartları       — Sahne Tahmin + Poster Bulmaca yan yana
//   3) Oyuncu şeridi       — seviye/XP/seri; dokununca Oyun Merkezi
//
// Veri tek okuma (useGameStats); ekran her odaklandığında içerik yerinde
// kalarak arkadan tazelenir.

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Skeleton from "@components/Skeleton";
import PremiumPill from "@components/premium/PremiumPill";
import { usePremiumGate } from "@hooks/usePremiumGate";
import DailyChallengeCard from "@components/game/DailyChallengeCard";
import GameTile from "@components/game/GameTile";
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
} from "@screens/game/gameRegistry";

export default function ProfileGamesModule({ navigation }) {
  const { theme } = useTheme();
  useLanguage(); // dil değişince i18nText çağrıları yeniden değerlendirilsin
  const { user } = useAuth();
  const { ready, stats } = useGameStats();
  const daily = useDailyView(stats);
  const progress = useMemo(() => buildSceneGameProgress(stats, daily.now), [stats, daily.now]);

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
  const openGame = guarded((game) => navigation.navigate(game.routeName, { gameId: game.id }));

  return (
    <View style={styles.module}>
      <SectionHeader
        title={i18nText("autoI18n.oyunlar", "Oyunlar")}
        action={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")}
        onAction={openHub}
        theme={theme}
        style={styles.header}
      />

      {locked ? (
        <Pressable
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
        </Pressable>
      ) : null}

      {!ready ? (
        <GamesModuleSkeleton theme={theme} />
      ) : (
        <View style={styles.stack}>
          <DailyChallengeCard daily={daily} theme={theme} onPlay={playDaily} onResult={openDailyBoard} />

          <View style={styles.tiles}>
            {GAME_REGISTRY.map((game) => (
              <GameTile
                key={game.id}
                game={game}
                theme={theme}
                bestScore={bestScoreForGame(stats, game.id)}
                onPress={() => openGame(game)}
              />
            ))}
          </View>

          <PlayerStrip progress={progress} theme={theme} user={user} onPress={openHub} compact />
        </View>
      )}
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
        <Skeleton width="48.5%" height={148} style={[styles.skeletonTile, box]} />
        <Skeleton width="48.5%" height={148} style={[styles.skeletonTile, box]} />
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
  skeletonTile: { borderRadius: 22 },
  skeletonStrip: { borderRadius: 22 },
});
