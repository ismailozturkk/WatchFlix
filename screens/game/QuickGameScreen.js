// screens/game/QuickGameScreen.js
//
// Hızlı oyunlar (utils/quickGames.js): "Hangisi daha çok izlendi?", "Hangi on yıl?", "Film mi, dizi mi?", "Hangi tür?".
// Rota parametresi `gameId`. Durum makinesi hooks/useQuickGame.js'te, ortak parçalar components/game/QuickGameParts.js'te.
//
// İKİ DÜZEN
//   pair   (popular) : iki afiş yan yana, dokunduğun cevap. Cevaptan sonra her afişin altında OY SAYISI.
//   single (diğerleri): tek büyük afiş + şık düğmeleri (film/dizi: 2, on yıl / tür: 2×2). Cevaptan sonra afişte YIL
//                       (tür sorusunda altında yapımın bütün türleri); doğru şık yeşil, yanlış seçim kırmızı.
//
// Afiş boyutu pencere yüksekliğinden türer (kısa telefonda küçülür) — şıklar ve geri bildirim şeridi her zaman sığar.
// "Film mi, dizi mi?" 8. doğrudan sonra başlığı gizler (yalnız afiş).
//
// "Önce hangisi?" gibi: liderlik / XP / günlük hak yok, premium kapısı yok.

import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { EndCard, ErrorState, FeedbackStrip, Hearts, LoadingState, PosterCard, QUICK_BAD, QUICK_GOOD, StatRow } from "@components/game/QuickGameParts";
import { PressableScale } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useQuickGame from "@hooks/useQuickGame";
import { QUICK_GAME_META, isQuickGame } from "@utils/quickGames";
import { getOlderCopy } from "@utils/olderGameCopy";
import { getQuickCopy, quickOptionLabel } from "@utils/quickGamesCopy";
import { keyOfItem } from "@utils/olderGame";
import { GameScreenShell } from "./GameScreenShell";

export default function QuickGameScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { API_KEY } = useApiSettings();
  const { width, height } = useWindowDimensions();
  const gameId = isQuickGame(route?.params?.gameId) ? route.params.gameId : "popular";
  const meta = QUICK_GAME_META[gameId];
  const accent = meta.colors[0];
  const copy = getOlderCopy(language); // ortak metinler
  const quick = getQuickCopy(language); // oyuna özgü metinler
  const text = quick.games[gameId];

  const game = useQuickGame({
    gameId,
    apiKey: API_KEY,
    language,
    uid: user?.uid || null,
    source: route?.params?.source === "hub" ? "hub" : "other",
  });
  const { phase, question, lives, score, reveal, summary, stats } = game;
  const best = Math.max(stats.best, summary ? score : 0);
  const playing = (phase === "playing" || phase === "revealed") && question;

  // Tek afişli düzende afiş genişliği: yükseklik bütçesinden (başlık, istatistik, soru, şıklar ve şerit ~470 pt).
  const posterWidth = Math.round(Math.min(Math.max(((height || 700) - 470) * (2 / 3), 110), (width || 360) * 0.55));

  return (
    <GameScreenShell
      navigation={navigation}
      title={text.title}
      subtitle={text.hint}
      headerRight={<Hearts lives={lives} theme={theme} copy={copy} />}
      scroll={false}
    >
      <StatRow theme={theme} copy={copy} score={score} best={best} accent={accent} />

      {phase === "loading" ? <LoadingState theme={theme} copy={copy} /> : null}
      {phase === "error" ? <ErrorState theme={theme} copy={copy} accent={accent} onRetry={game.restart} /> : null}

      {playing && meta.layout === "pair" ? (
        <View style={styles.board}>
          <Text style={[styles.prompt, { color: theme.text.primary }]}>{text.prompt}</Text>
          <View style={styles.posters}>
            {question.items.map((item, index) => {
              const key = keyOfItem(item);
              return (
                <PosterCard
                  key={key}
                  item={item}
                  badge={reveal ? quick.votes(question.facts.votes[index]) : null}
                  state={!reveal ? "idle" : key === reveal.correctKey ? "older" : key === reveal.chosenKey ? "wrong" : "other"}
                  theme={theme}
                  label={copy.posterA11y(item.title)}
                  disabled={phase !== "playing"}
                  onPress={() => game.choose(key)}
                />
              );
            })}
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {playing && meta.layout === "single" ? (
        <View style={styles.board}>
          <Text style={[styles.prompt, { color: theme.text.primary }]}>{text.prompt}</Text>
          <View style={[styles.single, { width: posterWidth }]}>
            <PosterCard
              item={question.items[0]}
              badge={reveal && question.facts.year ? String(question.facts.year) : null}
              state={!reveal ? "idle" : reveal.correct ? "older" : "wrong"}
              theme={theme}
              label={question.items[0].title}
              disabled
              showTitle={question.showTitle}
              style={styles.singlePoster}
            />
          </View>
          {reveal && gameId === "genre" ? (
            <Text style={[styles.genres, { color: theme.text.secondary }]} numberOfLines={2}>
              {question.facts.genres.map((g) => quick.genres[g] || g).join(" · ")}
            </Text>
          ) : null}

          <View style={styles.options}>
            {question.options.map((option) => {
              const state = !reveal
                ? "idle"
                : option.key === reveal.correctKey
                  ? "correct"
                  : option.key === reveal.chosenKey
                    ? "wrong"
                    : "dim";
              const label = quickOptionLabel(quick, gameId, option.key);
              return (
                <PressableScale
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: phase !== "playing" }}
                  disabled={phase !== "playing"}
                  onPress={() => game.choose(option.key)}
                  scaleTo={0.97}
                  style={[
                    styles.option,
                    {
                      backgroundColor: state === "correct" ? `${QUICK_GOOD}26` : state === "wrong" ? `${QUICK_BAD}26` : theme.secondary,
                      borderColor: state === "correct" ? QUICK_GOOD : state === "wrong" ? QUICK_BAD : theme.border,
                      opacity: state === "dim" ? 0.55 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: theme.text.primary }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {phase === "over" ? (
        <EndCard
          theme={theme}
          copy={copy}
          accent={accent}
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
  board: { flex: 1, gap: 10 },
  prompt: { fontSize: 19, fontWeight: "900", textAlign: "center", marginTop: 4 },
  posters: { flexDirection: "row", gap: 12 },
  single: { alignSelf: "center" },
  singlePoster: { flex: 0, alignSelf: "stretch" },
  genres: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // İki sütun: film/dizi tek satırda iki, on yıl/tür 2×2 (flexBasis %45 + büyüme).
  option: { flexGrow: 1, flexBasis: "45%", minHeight: 52, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  optionText: { fontSize: 15, fontWeight: "800", textAlign: "center" },
});
