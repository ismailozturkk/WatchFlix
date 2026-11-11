// screens/game/DailyFrameScreen.js
//
// "Günün Karesi" oyun ekranı (rota `DailyFrameScreen`). Tasarım: docs/ozellikler/GUNUN_KARESI.md.
// Durum hooks/useDailyFrame.js'te, kurallar utils/dailyFrame.js'te.
//
// YUKARIDAN AŞAĞIYA
//   • Kare: 16:9 sahne; altında 1–6 kare düğmeleri (açılmış karelere geri dönülür, kilitliler sönük; kullanılan
//     hakların rengi düğmede: kırmızı yanlış, gri geçildi, yeşil doğru).
//   • İpucu çipleri: 3. karede tür, 4.'te yıl, 5.'te yönetmen, 6.'da baş harf.
//   • Oynarken: arama kutusu (TMDB film araması, 300 ms bekleme) + sonuçlar + "Geç"; altında yapılan tahminler.
//   • Bitince (kare görüntüleyici yerine): büyük kare + karar rozeti + cevap (afiş, ad, yıl, yönetmen; dokununca film
//     sayfası), kutucuklar, paylaş / sohbete gönder, kalan süre; "Adım adım" dökümü (her karede ne seçildi, o karede
//     hangi ipucu açıldı — satıra dokununca kare üstte büyür) ve istatistik + dağılım kartı.
//
// Cevap; erişilebilirlik etiketlerinde, sohbet kartında ve paylaşım metninde YOK (oyun bitene dek hiçbir yerde).
// Premium (registry "daily_frame", 30 Eki kararı): girişler (Eğlence kartı, sohbet kartı) kilitliyken yükseltme açar;
// ekranın kendi kapısı başka yoldan gelinirse yükseltmeyi açıp geri sarar. Kilitliyken bulmaca HİÇ yüklenmez.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import LensLoader from "../../components/LensLoader";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import GlassField from "@components/common/GlassField";
import GlassPressable from "@components/common/GlassPressable";
import { useGlassScheme } from "@components/common/GlassSurface";
import { QUICK_BAD, QUICK_GOOD } from "@components/game/QuickGameParts";
import { useAuth } from "@context/AuthContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useDailyFrame from "@hooks/useDailyFrame";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { searchFrameMovies } from "@services/dailyFrameService";
import { triggerHaptic } from "@services/hapticsService";
import { buildFrameShare } from "@utils/chatShare";
import { formatRemaining, nextDayStartMs } from "@utils/dailyChallenge";
import {
  FRAME_COUNT,
  FRAME_MAX_GUESSES,
  alreadyGuessed,
  buildShareText,
  hintAtFrame,
  initialOf,
  visibleHints,
} from "@utils/dailyFrame";
import { getFrameCopy } from "@utils/dailyFrameCopy";
import { canonGenresOf } from "@utils/quickGames";
import { getQuickCopy } from "@utils/quickGamesCopy";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import usePosterCorner from "@hooks/usePosterCorner";
import { SEARCH_DEBOUNCE_MS } from "../../utils/searchDebounce";
import { percentText } from "@utils/i18nText";

export const FRAME_ACCENT = "#6366F1";
const SKIP_GREY = "#94A3B8";
const MARK_COLORS = { miss: QUICK_BAD, skip: SKIP_GREY, hit: QUICK_GOOD };

/** Kare düğmesinin rengi: o karede harcanan hak (yoksa nötr). */
const markOfFrame = (marks, index) => (marks[index] && marks[index] !== "empty" ? marks[index] : null);

function FrameViewer({ puzzle, openCount, viewIndex, onSelect, marks, theme, copy, width }) {
  const height = Math.round(width * (9 / 16));
  const path = puzzle.frames[viewIndex];
  return (
    <View style={styles.viewer}>
      <View style={[styles.frame, { width, height, backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Image
          source={{ uri: buildTmdbUrl(path, "backdrop", width) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
          accessible
          accessibilityLabel={copy.frameA11y(viewIndex + 1, FRAME_COUNT)}
        />
      </View>
      <View style={styles.frameTabs}>
        {puzzle.frames.map((_, index) => {
          const open = index < openCount;
          const active = index === viewIndex;
          const mark = markOfFrame(marks, index);
          const tone = mark ? MARK_COLORS[mark] : null;
          return (
            <GlassPressable
              key={index}
              glass={false}
              disabled={!open}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              accessibilityLabel={copy.frameA11y(index + 1, FRAME_COUNT)}
              accessibilityState={{ selected: active, disabled: !open }}
              style={[
                styles.frameTab,
                {
                  backgroundColor: tone ? `${tone}2E` : theme.secondary,
                  borderColor: active ? FRAME_ACCENT : tone || theme.border,
                  opacity: open ? 1 : 0.45,
                },
              ]}
            >
              {open ? (
                <Text style={[styles.frameTabText, { color: theme.text.primary }]} allowFontScaling={false}>
                  {index + 1}
                </Text>
              ) : (
                <AppIcon family="Ionicons" name="lock-closed" size={13} color={theme.text.muted} />
              )}
            </GlassPressable>
          );
        })}
      </View>
    </View>
  );
}

function HintChips({ puzzle, round, theme, copy, genreNames }) {
  const hints = visibleHints(round);
  const chips = [];
  // Sıra kareyle aynı: 3. kare tür, 4. yıl, 5. yönetmen (bilinmiyorsa çip çıkmaz), 6. baş harf.
  if (hints.genres && genreNames) chips.push({ key: "genres", label: copy.hintGenres, value: genreNames });
  if (hints.year && puzzle.year) chips.push({ key: "year", label: copy.hintYear, value: puzzle.year });
  const directors = Array.isArray(puzzle.directors) ? puzzle.directors.slice(0, 2).join(", ") : "";
  if (hints.director && directors) chips.push({ key: "director", label: copy.hintDirector, value: directors });
  if (hints.initial) {
    const initial = initialOf(puzzle.title);
    if (initial) chips.push({ key: "initial", label: copy.hintInitial, value: `${initial}…` });
  }
  if (chips.length === 0) return null;
  return (
    <View style={styles.hints}>
      {chips.map((chip) => (
        <View key={chip.key} style={[styles.hint, { backgroundColor: `${FRAME_ACCENT}1F`, borderColor: `${FRAME_ACCENT}55` }]}>
          <Text style={[styles.hintLabel, { color: theme.text.muted }]} allowFontScaling={false}>
            {chip.label}
          </Text>
          <Text style={[styles.hintValue, { color: theme.text.primary }]} numberOfLines={1}>
            {chip.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function GuessRows({ round, theme, copy }) {
  if (!round || round.guesses.length === 0) return null;
  return (
    <View style={styles.guesses}>
      {round.guesses.map((guess, index) => {
        const hit = !guess.skip && guess.key === round.answerKey;
        const tone = guess.skip ? SKIP_GREY : hit ? QUICK_GOOD : QUICK_BAD;
        return (
          <View key={`${index}-${guess.key || "skip"}`} style={[styles.guessRow, { borderColor: `${tone}66`, backgroundColor: `${tone}14` }]}>
            <AppIcon
              family="Ionicons"
              name={guess.skip ? "play-skip-forward" : hit ? "checkmark-circle" : "close-circle"}
              size={16}
              color={tone}
            />
            <Text style={[styles.guessText, { color: theme.text.primary }]} numberOfLines={1}>
              {guess.skip ? copy.skip : guess.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function GuessBox({ apiKey, language, round, theme, copy, onGuess, onSkip }) {
  const corner = usePosterCorner("fun");
  const glassScheme = useGlassScheme();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      searchFrameMovies(apiKey, language, text)
        .then((list) => {
          if (id === seq.current) setResults(list);
        })
        .catch(() => {
          if (id === seq.current) setResults([]);
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [apiKey, language, query]);

  const pick = (item) => {
    if (alreadyGuessed(round, item.key)) {
      setNotice(copy.already);
      triggerHaptic("warning");
      return;
    }
    setNotice(null);
    setQuery("");
    setResults([]);
    Keyboard.dismiss();
    onGuess(item);
  };

  const left = FRAME_MAX_GUESSES - round.guesses.length;
  const showList = query.trim().length >= 2;

  return (
    <View style={styles.guessBox}>
      <View style={styles.searchRow}>
        <GlassField
          height={46}
          focused={focused}
          accent={FRAME_ACCENT}
          fallbackStyle={[styles.searchBox, { backgroundColor: theme.secondary, borderColor: focused ? FRAME_ACCENT : theme.border }]}
          style={styles.searchField}
        >
          <AppIcon family="Ionicons" name="search" size={17} color={focused ? FRAME_ACCENT : theme.text.muted} />
          <TextInput
            allowFontScaling={false}
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={theme.text.muted}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (notice) setNotice(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            keyboardAppearance={glassScheme}
          />
          {loading ? <LensLoader size="small" color={theme.text.muted} /> : null}
        </GlassField>
        <GlassPressable
          onPress={() => {
            triggerHaptic("selection");
            setNotice(null);
            onSkip();
          }}
          accessibilityRole="button"
          accessibilityLabel={copy.skipA11y}
          style={[styles.skip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <AppIcon family="Ionicons" name="play-skip-forward" size={15} color={theme.text.secondary} />
          <Text style={[styles.skipText, { color: theme.text.secondary }]} allowFontScaling={false}>
            {copy.skip}
          </Text>
        </GlassPressable>
      </View>

      <Text style={[styles.left, { color: notice ? QUICK_BAD : theme.text.muted }]}>{notice || copy.guessesLeft(left)}</Text>

      {showList ? (
        <View style={[styles.results, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {results.length === 0 ? (
            <Text style={[styles.resultEmpty, { color: theme.text.muted }]}>{loading ? copy.searching : copy.noResults}</Text>
          ) : (
            results.map((item, index) => {
              const tried = alreadyGuessed(round, item.key);
              return (
                <GlassPressable
                  key={item.key}
                  glass={false}
                  onPress={() => pick(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.year ? `${item.title}, ${item.year}` : item.title}
                  style={[styles.result, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }, tried && styles.resultTried]}
                >
                  {item.posterPath ? (
                    <Image source={{ uri: buildTmdbUrl(item.posterPath, "poster", 92) }} style={[styles.resultPoster, { borderRadius: corner(6) }]} contentFit="cover" />
                  ) : (
                    <View style={[styles.resultPoster, { borderRadius: corner(6), backgroundColor: theme.border }]} />
                  )}
                  <Text style={[styles.resultTitle, { color: theme.text.primary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.year ? <Text style={[styles.resultYear, { color: theme.text.muted }]}>{item.year}</Text> : null}
                </GlassPressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

function Countdown({ theme, copy }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={[styles.countdown, { color: theme.text.muted }]}>{copy.nextIn(formatRemaining(nextDayStartMs(now), now))}</Text>
  );
}

const HINT_LABEL_KEYS = { genres: "hintGenres", year: "hintYear", director: "hintDirector", initial: "hintInitial" };

/** Sonucun üstü: seçili kare büyük, üstünde karar rozeti + cevap (dokununca film sayfası). */
function ResultHero({ puzzle, round, frameIndex, copy, width, onOpenTitle, solvedAt }) {
  const corner = usePosterCorner("fun");
  const won = round.status === "won";
  const height = Math.round(width * (9 / 16)) + 64;
  const directors = Array.isArray(puzzle.directors) ? puzzle.directors.slice(0, 2).join(", ") : "";
  const meta = [puzzle.year, directors].filter(Boolean).join(" · ");
  return (
    <GlassPressable
      glass={false}
      onPress={onOpenTitle}
      accessibilityRole="button"
      accessibilityLabel={`${won ? copy.resultBadgeWon(solvedAt) : copy.resultBadgeLost}. ${puzzle.title}. ${copy.openTitle}`}
      style={[styles.hero, { width, height }]}
    >
      <Image
        source={{ uri: buildTmdbUrl(puzzle.frames[frameIndex], "backdrop", width) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={160}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.heroBadge, { backgroundColor: won ? QUICK_GOOD : QUICK_BAD }]}>
        <AppIcon family="Ionicons" name={won ? "checkmark-circle" : "close-circle"} size={14} color="#FFFFFF" />
        <Text style={styles.heroBadgeText} allowFontScaling={false}>
          {won ? copy.resultBadgeWon(solvedAt) : copy.resultBadgeLost}
        </Text>
      </View>
      <View style={styles.heroFrameNo}>
        <Text style={styles.heroFrameNoText} allowFontScaling={false}>
          {copy.stepFrame(frameIndex + 1)}
        </Text>
      </View>
      <View style={styles.heroBottom}>
        {puzzle.posterPath ? (
          <Image source={{ uri: buildTmdbUrl(puzzle.posterPath, "poster", 185) }} style={[styles.heroPoster, { borderRadius: corner(9) }]} contentFit="cover" />
        ) : null}
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker} allowFontScaling={false}>
            {won ? copy.wonTitle : copy.lostLine}
          </Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {puzzle.title}
          </Text>
          {meta ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <View style={styles.heroOpen}>
          <AppIcon family="Ionicons" name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </View>
    </GlassPressable>
  );
}

/** Altı adımın dökümü: her karede ne seçildi, o karede hangi ipucu açıldı. Satıra dokununca kare üstte büyür. */
function StepTimeline({ puzzle, round, selected, onSelect, theme, copy }) {
  const corner = usePosterCorner("fun");
  return (
    <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text style={[gameSharedStyles.sectionTitle, styles.cardTitle, { color: theme.text.secondary }]}>{copy.stepsTitle}</Text>
      {puzzle.frames.map((path, index) => {
        const guess = round.guesses[index];
        const hit = guess && !guess.skip && guess.key === round.answerKey;
        const state = !guess ? "unused" : guess.skip ? "skip" : hit ? "hit" : "miss";
        const tone = state === "hit" ? QUICK_GOOD : state === "miss" ? QUICK_BAD : state === "skip" ? SKIP_GREY : theme.text.muted;
        const status = { hit: copy.stepRight, miss: copy.stepWrong, skip: copy.stepSkipped, unused: copy.stepUnused }[state];
        const hintKey = hintAtFrame(index + 1);
        const active = index === selected;
        return (
          <GlassPressable
            key={path}
            glass={false}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityLabel={`${copy.stepFrame(index + 1)}. ${guess && !guess.skip ? `${guess.title}, ` : ""}${status}`}
            accessibilityHint={copy.viewFrameA11y(index + 1)}
            accessibilityState={{ selected: active }}
            style={[
              styles.step,
              index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              state === "unused" && styles.stepUnused,
            ]}
          >
            <View style={[styles.stepDot, { backgroundColor: state === "unused" ? theme.border : tone }]}>
              <Text style={styles.stepDotText} allowFontScaling={false}>
                {index + 1}
              </Text>
            </View>
            <View style={[styles.stepThumb, { borderColor: active ? FRAME_ACCENT : "transparent", backgroundColor: theme.border }]}>
              <Image source={{ uri: buildTmdbUrl(path, "backdrop", 300) }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <View style={styles.stepBody}>
              <View style={styles.stepHead}>
                <Text style={[styles.stepFrame, { color: theme.text.muted }]} allowFontScaling={false}>
                  {copy.stepFrame(index + 1)}
                </Text>
                {hintKey ? (
                  <View style={[styles.stepHint, { backgroundColor: `${FRAME_ACCENT}22` }]}>
                    <Text style={[styles.stepHintText, { color: FRAME_ACCENT }]} allowFontScaling={false}>
                      {copy.stepHint(copy[HINT_LABEL_KEYS[hintKey]])}
                    </Text>
                  </View>
                ) : null}
              </View>
              {guess && !guess.skip ? (
                <View style={styles.stepGuess}>
                  {guess.posterPath ? (
                    <Image source={{ uri: buildTmdbUrl(guess.posterPath, "poster", 92) }} style={[styles.stepPoster, { borderRadius: corner(3) }]} contentFit="cover" />
                  ) : null}
                  <Text style={[styles.stepTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {guess.year ? `${guess.title} · ${guess.year}` : guess.title}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.stepStatus, { backgroundColor: `${tone}1F` }]}>
                <AppIcon
                  family="Ionicons"
                  name={{ hit: "checkmark-circle", miss: "close-circle", skip: "play-skip-forward", unused: "ellipse-outline" }[state]}
                  size={12}
                  color={tone}
                />
                <Text style={[styles.stepStatusText, { color: tone }]} allowFontScaling={false}>
                  {status}
                </Text>
              </View>
            </View>
          </GlassPressable>
        );
      })}
    </View>
  );
}

function StatsCard({ stats, streak, won, solvedAt, theme, copy }) {
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);
  const metrics = [
    { label: copy.statsPlayed, value: stats.played },
    { label: copy.statsWinRate, value: percentText(winRate) },
    { label: copy.statsStreak, value: streak, flame: true },
    { label: copy.statsBest, value: stats.bestStreak },
  ];
  return (
    <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text style={[gameSharedStyles.sectionTitle, styles.cardTitle, { color: theme.text.secondary }]}>{copy.statsTitle}</Text>
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <View style={styles.metricValueRow}>
              {metric.flame && metric.value > 0 ? <AppIcon family="Ionicons" name="flame" size={15} color="#FF9F5A" /> : null}
              <Text style={[styles.metricValue, { color: theme.text.primary }]} allowFontScaling={false}>
                {metric.value}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
              {metric.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.distTitle, { color: theme.text.muted }]}>{copy.distTitle}</Text>
      {stats.dist.map((value, index) => {
        const today = won && solvedAt === index + 1;
        return (
          <View key={index} style={styles.distRow}>
            <Text style={[styles.distLabel, { color: theme.text.secondary }]}>{index + 1}</Text>
            <View style={styles.distTrack}>
              <View
                style={[
                  styles.distBar,
                  { width: `${Math.max(9, (value / maxDist) * 100)}%`, backgroundColor: today ? QUICK_GOOD : theme.border },
                ]}
              >
                <Text style={[styles.distValue, { color: today ? "#FFFFFF" : theme.text.primary }]}>{value}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ResultPanel({ game, theme, copy, width, onOpenTitle, onShareOut, onShareChat }) {
  const { puzzle, round, stats, streak, marks } = game;
  const won = round.status === "won";
  // Üstteki büyük kare: bilindiyse bilinen kare, bilinmediyse en tanınır (son) kare.
  const [selected, setSelected] = useState(() => (won && game.solvedAt ? game.solvedAt - 1 : FRAME_COUNT - 1));
  return (
    <View style={styles.resultPanel}>
      <ResultHero
        puzzle={puzzle}
        round={round}
        frameIndex={selected}
        copy={copy}
        width={width}
        solvedAt={game.solvedAt}
        onOpenTitle={onOpenTitle}
      />
      <View style={styles.marks} accessible accessibilityLabel={marks.map((m) => copy.markA11y[m]).join(", ")}>
        {marks.map((mark, index) => (
          <View key={index} style={[styles.markBox, { backgroundColor: mark === "empty" ? theme.border : MARK_COLORS[mark] }]} />
        ))}
      </View>

      <View style={styles.shareRow}>
        <GlassPressable
          onPress={onShareOut}
          accessibilityRole="button"
          style={[gameSharedStyles.primaryButton, styles.shareButton, { backgroundColor: FRAME_ACCENT }]}
        >
          <AppIcon family="Ionicons" name="share-social" size={18} color="#FFFFFF" />
          <Text style={gameSharedStyles.primaryButtonText}>{copy.shareOut}</Text>
        </GlassPressable>
        <GlassPressable
          onPress={onShareChat}
          accessibilityRole="button"
          style={[gameSharedStyles.primaryButton, styles.shareButton, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }]}
        >
          <AppIcon family="Ionicons" name="paper-plane" size={17} color={theme.text.primary} />
          <Text style={[gameSharedStyles.primaryButtonText, { color: theme.text.primary }]} numberOfLines={1}>
            {copy.shareChat}
          </Text>
        </GlassPressable>
      </View>
      <Countdown theme={theme} copy={copy} />

      <StepTimeline puzzle={puzzle} round={round} selected={selected} onSelect={setSelected} theme={theme} copy={copy} />
      <StatsCard stats={stats} streak={streak} won={won} solvedAt={game.solvedAt} theme={theme} copy={copy} />
    </View>
  );
}

function DailyFrameGame({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const { API_KEY } = useApiSettings();
  const { width } = useWindowDimensions();
  const copy = getFrameCopy(language);
  const quick = getQuickCopy(language);
  const game = useDailyFrame({ apiKey: API_KEY, language, uid: user?.uid || null });
  const { phase, puzzle, round, openCount, marks } = game;
  const [viewIndex, setViewIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  // Yeni kare açılınca görünüm ona geçer (geri dönmüş olsan da).
  useEffect(() => {
    setViewIndex(Math.max(0, openCount - 1));
  }, [openCount]);

  const genreNames = useMemo(
    () => (puzzle ? canonGenresOf(puzzle).slice(0, 2).map((g) => quick.genres[g] || g).join(" · ") : ""),
    [puzzle, quick],
  );
  const finished = round && round.status !== "playing";
  const share = useMemo(
    () =>
      finished && puzzle
        ? buildFrameShare({ dayKey: puzzle.dayKey, number: puzzle.number, marks, host: user?.displayName })
        : null,
    [finished, puzzle, marks, user?.displayName],
  );

  const onGuess = (item) => {
    const result = game.guess(item);
    if (result.changed) triggerHaptic(result.correct ? "win" : result.round?.status === "lost" ? "lose" : "wrong");
  };

  const onShareOut = () => {
    if (!puzzle) return;
    trackEvent(ANALYTICS_EVENTS.DAILY_FRAME_SHARED, { number: puzzle.number, target: "out" });
    Share.share({ message: buildShareText({ title: copy.shareTitle, number: puzzle.number, marks }) }).catch(() => {});
  };

  const frameWidth = Math.round((width || 360) - 32);
  const subtitle = puzzle ? `#${puzzle.number}` : copy.cardHint;

  return (
    <GameScreenShell navigation={navigation} title={copy.title} subtitle={subtitle} scroll={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {phase === "loading" ? (
          <View style={styles.center} accessibilityLabel={copy.loading}>
            <LensLoader size="screen" color={FRAME_ACCENT} />
            <Text style={[styles.note, { color: theme.text.secondary }]}>{copy.loading}</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={styles.center}>
            <AppIcon family="Ionicons" name="cloud-offline-outline" size={44} color={theme.text.muted} />
            <Text style={[styles.note, { color: theme.text.secondary }]}>{copy.error}</Text>
            <GlassPressable
              onPress={game.retry}
              accessibilityRole="button"
              style={[gameSharedStyles.primaryButton, styles.retry, { backgroundColor: FRAME_ACCENT }]}
            >
              <AppIcon family="Ionicons" name="refresh" size={18} color="#FFFFFF" />
              <Text style={gameSharedStyles.primaryButtonText}>{copy.retry}</Text>
            </GlassPressable>
          </View>
        ) : null}

        {phase === "ready" && puzzle && round ? (
          <>
            {finished ? null : (
            <FrameViewer
              puzzle={puzzle}
              openCount={openCount}
              viewIndex={Math.min(viewIndex, openCount - 1)}
              onSelect={setViewIndex}
              marks={marks}
              theme={theme}
              copy={copy}
              width={frameWidth}
            />
            )}
            {finished ? null : <HintChips puzzle={puzzle} round={round} theme={theme} copy={copy} genreNames={genreNames} />}
            {finished ? (
              <ResultPanel
                game={game}
                theme={theme}
                copy={copy}
                width={frameWidth}
                onOpenTitle={() => navigation.push("MovieDetails", { id: puzzle.id })}
                onShareOut={onShareOut}
                onShareChat={() => setChatOpen(true)}
              />
            ) : (
              <GuessBox
                apiKey={API_KEY}
                language={language}
                round={round}
                theme={theme}
                copy={copy}
                onGuess={onGuess}
                onSkip={game.skip}
              />
            )}
            {finished ? null : <GuessRows round={round} theme={theme} copy={copy} />}
          </>
        ) : null}
      </ScrollView>
      <ShareToChatSheet
        visible={chatOpen}
        share={share}
        onClose={() => setChatOpen(false)}
        onSent={() => trackEvent(ANALYTICS_EVENTS.DAILY_FRAME_SHARED, { number: puzzle?.number ?? 0, target: "chat" })}
      />
    </GameScreenShell>
  );
}

export default function DailyFrameScreen({ navigation }) {
  const { language } = useLanguage();
  const locked = usePremiumScreenGuard("daily_frame", navigation);
  if (locked) return <GameScreenShell navigation={navigation} title={getFrameCopy(language).title} scroll={false} />;
  return <DailyFrameGame navigation={navigation} />;
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 34 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 14 },
  note: { fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  retry: { marginTop: 6 },
  viewer: { gap: 10 },
  frame: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  frameTabs: { flexDirection: "row", gap: 8 },
  frameTab: { flex: 1, height: 36, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  frameTabText: { fontSize: 14, fontWeight: "900" },
  hints: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, maxWidth: "100%" },
  hintLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  hintValue: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
  guessBox: { gap: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  searchBox: { borderRadius: 23, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 0 },
  skip: { height: 46, paddingHorizontal: 14, borderRadius: 23, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  skipText: { fontSize: 14, fontWeight: "800" },
  left: { fontSize: 12, fontWeight: "700", paddingHorizontal: 6 },
  results: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  resultEmpty: { fontSize: 13, fontWeight: "600", padding: 14, textAlign: "center" },
  result: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  resultTried: { opacity: 0.45 },
  resultPoster: { width: 34, height: 51, borderRadius: 6 },
  resultTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  resultYear: { fontSize: 13, fontWeight: "700" },
  guesses: { gap: 6 },
  guessRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  guessText: { flex: 1, fontSize: 14, fontWeight: "700" },
  resultPanel: { gap: 12 },
  hero: { borderRadius: 22, overflow: "hidden", justifyContent: "flex-end" },
  heroBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11 },
  heroBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  heroFrameNo: { position: "absolute", top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.5)" },
  heroFrameNoText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  heroBottom: { flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 14 },
  heroPoster: { width: 58, height: 87, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  heroCopy: { flex: 1, minWidth: 0, gap: 2 },
  heroKicker: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { color: "#FFFFFF", fontSize: 21, lineHeight: 25, fontWeight: "900" },
  heroMeta: { color: "rgba(255,255,255,0.82)", fontSize: 12.5, fontWeight: "700" },
  heroOpen: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)" },
  marks: { flexDirection: "row", gap: 6, justifyContent: "center" },
  markBox: { width: 30, height: 30, borderRadius: 7 },
  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cardTitle: { marginTop: 0, marginBottom: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  stepUnused: { opacity: 0.55 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepDotText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  stepThumb: { width: 88, height: 50, borderRadius: 9, overflow: "hidden", borderWidth: 2 },
  stepBody: { flex: 1, minWidth: 0, gap: 4 },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepFrame: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  stepHint: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stepHintText: { fontSize: 10.5, fontWeight: "900" },
  stepGuess: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepPoster: { width: 18, height: 27, borderRadius: 3 },
  stepTitle: { flex: 1, fontSize: 13.5, fontWeight: "800" },
  stepStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  stepStatusText: { fontSize: 11, fontWeight: "900" },
  metrics: { flexDirection: "row", marginBottom: 12 },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricLabel: { fontSize: 11, fontWeight: "700" },
  distTitle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  distLabel: { width: 14, fontSize: 13, fontWeight: "800", textAlign: "center" },
  distTrack: { flex: 1 },
  distBar: { height: 22, borderRadius: 6, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 7 },
  distValue: { fontSize: 12, fontWeight: "900" },
  shareRow: { flexDirection: "row", gap: 10 },
  shareButton: { flex: 1, paddingHorizontal: 12 },
  countdown: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },
});
