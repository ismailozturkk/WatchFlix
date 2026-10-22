// screens/game/OlderGameScreen.js
//
// "Önce hangisi?" hızlı oyunu: iki afiş, tek soru — hangisi daha ÖNCE çıktı? Üç can, art arda doğru sayısı skor.
// Durum makinesi hooks/useOlderGame.js'te, kurallar utils/olderGame.js'te; ortak ekran parçaları
// components/game/QuickGameParts.js'te (diğer hızlı oyunlarla paylaşılır). Bu dosya yalnız bu oyunun düzeni.
//
// Cevaptan sonra iki afişin YILI görünür (doğru olan yeşil çerçeveli) ve 1,5 sn sonra sıradaki çift gelir;
// bekleme sırasında ekrana dokunmak hemen ilerletir.
//
// Sahne Tahmin'den bilinçli ayrı: liderlik / XP / günlük hak yok, premium kapısı yok. Hızlı, çevrimdışı havuzla
// da çalışan, tek elle oynanan bir oyun.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EndCard, ErrorState, FeedbackStrip, Hearts, LoadingState, PosterCard, StatRow } from "@components/game/QuickGameParts";
import { useAuth } from "@context/AuthContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useOlderGame from "@hooks/useOlderGame";
import { keyOfItem } from "@utils/olderGame";
import { getOlderCopy } from "@utils/olderGameCopy";
import { GameScreenShell } from "./GameScreenShell";

const INDIGO = "#6366F1";

export default function OlderGameScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { API_KEY } = useApiSettings();
  const copy = getOlderCopy(language);
  const game = useOlderGame({
    apiKey: API_KEY,
    language,
    uid: user?.uid || null,
    source: route?.params?.source === "hub" ? "hub" : "other",
  });
  const { phase, pair, lives, score, reveal, summary, stats } = game;
  const best = Math.max(stats.best, summary ? score : 0);

  return (
    <GameScreenShell
      navigation={navigation}
      title={copy.title}
      subtitle={copy.cardHint}
      headerRight={<Hearts lives={lives} theme={theme} copy={copy} />}
      scroll={false}
    >
      <StatRow theme={theme} copy={copy} score={score} best={best} accent={INDIGO} />

      {phase === "loading" ? <LoadingState theme={theme} copy={copy} /> : null}
      {phase === "error" ? <ErrorState theme={theme} copy={copy} accent={INDIGO} onRetry={game.restart} /> : null}

      {(phase === "playing" || phase === "revealed") && pair ? (
        <View style={styles.board}>
          <Text style={[styles.prompt, { color: theme.text.primary }]}>{copy.prompt}</Text>
          <View style={styles.posters}>
            {[pair.a, pair.b].map((item, index) => (
              <PosterCard
                key={keyOfItem(item)}
                item={item}
                badge={reveal ? reveal.years[index === 0 ? "a" : "b"] : null}
                state={
                  !reveal
                    ? "idle"
                    : keyOfItem(item) === reveal.olderKey
                      ? "older"
                      : keyOfItem(item) === reveal.chosenKey
                        ? "wrong"
                        : "other"
                }
                theme={theme}
                label={copy.posterA11y(item.title)}
                disabled={phase !== "playing"}
                onPress={() => game.choose(keyOfItem(item))}
              />
            ))}
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {phase === "over" ? (
        <EndCard
          theme={theme}
          copy={copy}
          accent={INDIGO}
          score={score}
          best={best}
          summary={summary}
          stats={stats}
          onAgain={game.restart}
          onClose={() => navigation.goBack()}
        />
      ) : null}
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, gap: 14 },
  prompt: { fontSize: 19, fontWeight: "900", textAlign: "center", marginTop: 4 },
  posters: { flexDirection: "row", gap: 12 },
});
