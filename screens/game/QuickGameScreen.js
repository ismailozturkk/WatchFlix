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
//   blur  (Bulanık Afiş): netleşen afiş (components/game/BlurPoster) + geri sayım çubuğu + canlı puan + dört BAŞLIK
//         şıkkı. Skor satırı "Puan" yazar, oyun sonu "n puan". Afişin erişilebilirlik etiketi başlığı SÖYLEMEZ
//         (ekran okuyucu cevabı sızdırmasın).
//   rating (Yüksek puanı bul): iki afiş yan yana ve iki puan da gizli; oyuncu puanı daha yüksek olan AFİŞE dokunur.
//         Cevapta iki puan birlikte açılır. Tek can (başlıktaki tek kalp); afiş genişliği pencere yüksekliğinden türer.
//
// "Önce hangisi?" gibi: premium kapısı yok; rekor oyun sonunda liderlik tablosuna yazılır (hooks/useQuickGame).

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { EndCard, ErrorState, FeedbackStrip, Hearts, LoadingState, PosterCard, QuestionPrompt, QUICK_BAD, QUICK_GOOD, StatRow } from "@components/game/QuickGameParts";
import BlurPoster from "@components/game/BlurPoster";
import GameTimerBar from "@components/game/GameTimerBar";
import { PressableScale } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useGameIdentity from "@hooks/useGameIdentity";
import useQuickGame from "@hooks/useQuickGame";
import { BLUR_MAX_POINTS, BLUR_ROUND_MS, QUICK_GAME_META, blurPoints, isQuickGame } from "@utils/quickGames";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { getOlderCopy } from "@utils/olderGameCopy";
import { getQuickCopy, quickOptionLabel } from "@utils/quickGamesCopy";
import { keyOfItem } from "@utils/olderGame";
import { GameScreenShell } from "./GameScreenShell";

const TICK_MS = 100;
const ROUND_SECONDS = BLUR_ROUND_MS / 1000;

/** Saat → ekranda görünen { kalan saniye, kazanılacak puan }. Saat başlamadıysa tam süre / tam puan. */
const clockFace = (startedAt, now) =>
  startedAt == null
    ? { seconds: ROUND_SECONDS, points: BLUR_MAX_POINTS }
    : { seconds: Math.max(0, Math.ceil((BLUR_ROUND_MS - (now - startedAt)) / 1000)), points: blurPoints(now - startedAt) };

/**
 * Tur saati satırı: kalan saniye + azalan çubuk + o an kazanılacak puan (cevaptan sonra kazanılan / "süre doldu").
 * Puan hesabı hook'ta cevap anında yapılır; bu satır yalnız görsel. Saniye/puan değişmedikçe yeniden çizilmez
 * (10 Hz kontrol, ama durum yalnız değer değişince yazılır) — çubuk native sürücüde, JS'ten bağımsız akar.
 */
function RoundClock({ startedAt, running, reveal, resetKey, accent, theme, copy }) {
  const [face, setFace] = useState(() => clockFace(startedAt, Date.now()));
  useEffect(() => {
    const update = () => {
      const next = clockFace(startedAt, Date.now());
      setFace((prev) => (prev.seconds === next.seconds && prev.points === next.points ? prev : next));
    };
    update();
    if (!running) return undefined;
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const urgent = running && face.seconds <= 3;
  const result = reveal
    ? reveal.correct
      ? copy.points(reveal.points)
      : reveal.timedOut
        ? copy.timeUp
        : copy.points(0)
    : copy.points(face.points);
  const resultTone = reveal ? (reveal.correct ? QUICK_GOOD : QUICK_BAD) : accent;
  return (
    <View style={styles.clockRow}>
      <View
        style={[styles.chip, styles.secondsChip, { backgroundColor: theme.secondary, borderColor: urgent ? QUICK_BAD : theme.border }]}
        accessible
        accessibilityLabel={copy.secondsLeft(face.seconds)}
      >
        <AppIcon family="Ionicons" name="timer-outline" size={14} color={urgent ? QUICK_BAD : theme.text.secondary} />
        <Text style={[styles.chipText, { color: urgent ? QUICK_BAD : theme.text.primary }]} allowFontScaling={false}>
          {copy.secondsLeft(face.seconds)}
        </Text>
      </View>
      <View style={styles.clockBar}>
        <GameTimerBar
          timeLeft={ROUND_SECONDS}
          totalSeconds={ROUND_SECONDS}
          running={running}
          resetKey={resetKey}
          color={urgent ? QUICK_BAD : accent}
          trackColor={theme.secondary}
        />
      </View>
      <View style={[styles.chip, styles.pointsChip, { backgroundColor: `${resultTone}22`, borderColor: `${resultTone}66` }]}>
        <Text style={[styles.chipText, { color: theme.text.primary }]} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {result}
        </Text>
      </View>
    </View>
  );
}

function AnswerOption({ label, state, disabled, onPress, accent, theme, glyph, icon, compact = false }) {
  const correct = state === "correct";
  const wrong = state === "wrong";
  const tone = correct ? QUICK_GOOD : wrong ? QUICK_BAD : accent;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.option,
        compact && styles.titleOptionCard,
        {
          backgroundColor: correct ? `${QUICK_GOOD}22` : wrong ? `${QUICK_BAD}22` : theme.secondary,
          borderColor: correct ? QUICK_GOOD : wrong ? QUICK_BAD : theme.border,
          opacity: state === "dim" ? 0.5 : 1,
          shadowColor: tone,
        },
      ]}
    >
      <View style={[styles.optionGlyph, { backgroundColor: `${tone}20`, borderColor: `${tone}55` }]}>
        {icon ? (
          <AppIcon family="Ionicons" name={icon} size={17} color={tone} />
        ) : (
          <Text style={[styles.optionGlyphText, { color: tone }]} allowFontScaling={false}>{glyph}</Text>
        )}
      </View>
      <Text
        style={[styles.optionText, compact && styles.titleOption, { color: theme.text.primary }]}
        numberOfLines={compact ? 2 : 2}
        adjustsFontSizeToFit
        minimumFontScale={compact ? 0.7 : 0.75}
      >
        {label}
      </Text>
      {correct || wrong ? (
        <AppIcon
          family="Ionicons"
          name={correct ? "checkmark-circle" : "close-circle"}
          size={19}
          color={tone}
        />
      ) : null}
    </PressableScale>
  );
}

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
  // Bulanık Afiş'te skor PUANDIR: skor satırı ve oyun sonu metni ortak tablodan değil, oyunun kendinden.
  const shared = meta.layout === "blur" ? { ...copy, scoreLabel: quick.blur.scoreLabel, endScore: quick.blur.endScore } : copy;

  const identity = useGameIdentity();
  const game = useQuickGame({
    gameId,
    identity,
    apiKey: API_KEY,
    language,
    uid: user?.uid || null,
    source: route?.params?.source === "hub" ? "hub" : "other",
  });
  const { phase, question, lives, score, reveal, summary, stats, roundStartedAt } = game;
  const best = Math.max(stats.best, summary ? score : 0);
  const playing = (phase === "playing" || phase === "revealed") && question;

  // Tek afişli düzende afiş genişliği: yükseklik bütçesinden (başlık, istatistik, soru, şıklar ve şerit ~470 pt).
  // Bulanık Afiş'te ek olarak sayaç çubuğu + canlı puan satırı (~40 pt).
  const reserved = meta.layout === "blur" ? 510 : 470;
  const posterWidth = Math.round(Math.min(Math.max(((height || 700) - reserved) * (2 / 3), 110), (width || 360) * 0.55));
  // Yüksek puanı bul: iki afiş yan yana; ayrı cevap düğmesi yok, afişlerin kendisi cevap.
  const pairWidth = Math.round(Math.min(Math.max(((height || 700) - 440) * (2 / 3), 112), ((width || 360) - 44) / 2));
  const clockRunning = phase === "playing" && roundStartedAt != null;

  return (
    <GameScreenShell
      navigation={navigation}
      title={text.title}
      subtitle={text.hint}
      headerRight={<Hearts lives={lives} max={game.maxLives} theme={theme} copy={copy} />}
      scroll={false}
    >
      <StatRow theme={theme} copy={shared} score={score} best={best} accent={accent} />

      {phase === "loading" ? <LoadingState theme={theme} copy={copy} /> : null}
      {phase === "error" ? <ErrorState theme={theme} copy={copy} accent={accent} onRetry={game.restart} /> : null}

      {playing && meta.layout === "pair" ? (
        <View style={styles.board}>
          <QuestionPrompt theme={theme} accent={accent} icon={meta.icon}>{text.prompt}</QuestionPrompt>
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

      {playing && meta.layout === "rating" ? (
        <View style={styles.board}>
          <QuestionPrompt theme={theme} accent={accent} icon={meta.icon}>{text.prompt}</QuestionPrompt>
          <View style={[styles.posters, styles.ratingPosters]}>
            {question.items.map((item, index) => {
              const key = keyOfItem(item);
              const rating = question.facts.ratings[index];
              return (
                <PosterCard
                  key={key}
                  item={item}
                  badge={reveal ? quick.rating.format(rating) : null}
                  state={!reveal ? "idle" : key === reveal.correctKey ? "older" : key === reveal.chosenKey ? "wrong" : "other"}
                  theme={theme}
                  label={reveal ? quick.rating.ratingA11y(item.title, rating) : item.title}
                  disabled={phase !== "playing"}
                  onPress={() => game.choose(key)}
                  style={[styles.ratingPoster, { width: pairWidth }]}
                />
              );
            })}
            <View pointerEvents="none" style={[styles.ratingVs, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <AppIcon family="Ionicons" name="flash" size={16} color={accent} />
            </View>
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {playing && meta.layout === "single" ? (
        <View style={styles.board}>
          <QuestionPrompt theme={theme} accent={accent} icon={meta.icon}>{text.prompt}</QuestionPrompt>
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
            {question.options.map((option, index) => {
              const state = !reveal
                ? "idle"
                : option.key === reveal.correctKey
                  ? "correct"
                  : option.key === reveal.chosenKey
                    ? "wrong"
                    : "dim";
              const label = quickOptionLabel(quick, gameId, option.key);
              return <AnswerOption key={option.key} label={label} state={state} disabled={phase !== "playing"} onPress={() => game.choose(option.key)} accent={accent} theme={theme} glyph={String.fromCharCode(65 + index)} />;
            })}
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {playing && meta.layout === "blur" ? (
        <View style={styles.board}>
          <QuestionPrompt theme={theme} accent={accent} icon={meta.icon}>{text.prompt}</QuestionPrompt>
          <RoundClock
            startedAt={roundStartedAt}
            running={clockRunning}
            reveal={reveal}
            resetKey={question.correctKey}
            accent={accent}
            theme={theme}
            copy={quick.blur}
          />
          <View
            style={[styles.single, { width: posterWidth }]}
            accessible
            accessibilityLabel={reveal ? question.items[0].title : quick.blur.posterA11y}
          >
            <BlurPoster
              uri={buildTmdbUrl(question.items[0].posterPath, "poster", 342)}
              durationMs={BLUR_ROUND_MS}
              running={clockRunning}
              revealed={!!reveal}
              resetKey={question.correctKey}
              theme={theme}
              borderColor={!reveal ? theme.border : reveal.correct ? QUICK_GOOD : QUICK_BAD}
              borderWidth={reveal ? 3 : 1}
              onReady={game.arm}
            />
          </View>
          <View style={styles.options}>
            {question.options.map((option, index) => {
              const state = !reveal
                ? "idle"
                : option.key === reveal.correctKey
                  ? "correct"
                  : option.key === reveal.chosenKey
                    ? "wrong"
                    : "dim";
              const disabled = !clockRunning;
              return <AnswerOption key={option.key} label={option.title} state={state} disabled={disabled} onPress={() => game.choose(option.key)} accent={accent} theme={theme} glyph={String.fromCharCode(65 + index)} compact />;
            })}
          </View>
          <FeedbackStrip reveal={reveal} theme={theme} copy={copy} onPress={game.advance} />
        </View>
      ) : null}

      {phase === "over" ? (
        <EndCard
          theme={theme}
          copy={shared}
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
  board: { flex: 1, gap: 11 },
  posters: { flexDirection: "row", gap: 12 },
  single: { alignSelf: "center" },
  singlePoster: { flex: 0, alignSelf: "stretch" },
  genres: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // İki sütun: film/dizi tek satırda iki, on yıl/tür 2×2 (flexBasis %45 + büyüme).
  option: { flexGrow: 1, flexBasis: "45%", minHeight: 58, borderRadius: 18, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9, paddingVertical: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 7, elevation: 2 },
  optionGlyph: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  optionGlyphText: { fontSize: 12, fontWeight: "900" },
  optionText: { flex: 1, fontSize: 14, fontWeight: "850", textAlign: "left" },
  ratingPosters: { justifyContent: "center" },
  ratingPoster: { flex: 0 },
  ratingVs: { position: "absolute", left: "50%", top: "38%", marginLeft: -19, width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 3, elevation: 7 },
  titleOptionCard: { minHeight: 62 },
  titleOption: { fontSize: 12.5 },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // GameTimerBar kendi yatay boşluğunu taşır (16); satırda kenara yaslansın.
  clockBar: { flex: 1, marginHorizontal: -16 },
  chip: { height: 30, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 9 },
  // Sabit genişlik: saniye/puan metni değiştikçe çubuk genişliği oynamasın (oynarsa çubuk "sekerdi").
  secondsChip: { width: 66 },
  pointsChip: { width: 92 },
  chipText: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
});
