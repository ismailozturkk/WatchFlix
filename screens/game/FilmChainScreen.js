// screens/game/FilmChainScreen.js
//
// Film Zinciri (docs/ozellikler/FILM_ZINCIRI.md): başlangıç oyuncusundan hedefe oyuncu → film → oyuncu adımlarıyla
// ulaş. Durum makinesi hooks/useFilmChain.js'te, kurallar utils/filmChain.js + utils/filmChainRules.js'te. Bu dosya
// yalnız düzen:
//
//   [Günlük | Serbest]
//   [başlangıç ── en kısa: N film ── hedef]      ← klavye açıkken tek satırlık şeride iner
//   [zincir şeridi: kişi › film › kişi …]  [Geri al] [Pes et]
//   [seçici: arama + liste]   ya da   [sonuç: puan kartı, sayılar, zincir zaman çizelgesi, meydan oku]
//
// KLAVYE: arama kutusu açılınca liste klavyenin altında kalıyordu (iOS pencereyi küçültmez; Android'de kenardan
// kenara pencerede `adjustResize` her zaman tutmaz). Pano `useKeyboardInset` ile klavyenin ÖRTTÜĞÜ kadar alttan
// boşluk alır (pencere zaten küçüldüyse o kısım eklenmez) ve üst kart / mod anahtarı yer açmak için daralır.
//
// MEYDAN OKUMA: sonuç sohbete `chainShare` kartı olarak gider (utils/chatShare.buildChainShare) — bulmaca + sayılar +
// puan; zincirin halkaları gitmez. Karttan gelen alıcı `route.params.puzzleId` ile aynı bulmacayı serbest modda açar.
//
// Hızlı oyunlar gibi premium kapısı / liderlik / XP yok; kayıt cihaz-yerel.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import GlassField from "@components/common/GlassField";
import GlassPressable from "@components/common/GlassPressable";
import GlassSegmentedControl from "@components/common/GlassSegmentedControl";
import { ErrorState, LoadingState } from "@components/game/QuickGameParts";
import { PressableScale } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useFilmChain from "@hooks/useFilmChain";
import useKeyboardInset from "@hooks/useKeyboardInset";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { buildChainShare } from "@utils/chatShare";
import {
  CHAIN_MAX_FILMS,
  chainAtLimit,
  chainShareText,
  chainStars,
  filterChainOptions,
  nodeKey,
  usedKeysOf,
} from "@utils/filmChain";
import { getFilmChainCopy } from "@utils/filmChainCopy";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";

export const CHAIN_ACCENT = "#14B8A6";
const HERO = ["#134E4A", "#0F766E", "#14B8A6"];
const HERO_GAVE_UP = ["#334155", "#1E293B", "#0F172A"];
const GOLD = "#FFD76A";

function Avatar({ path, size, theme, style }) {
  const uri = buildTmdbUrl(path, "profile", size);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.secondary }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      ) : (
        <AppIcon family="Ionicons" name="person" size={Math.round(size * 0.45)} color={theme.text.muted} />
      )}
    </View>
  );
}

function Thumb({ path, width, theme, style }) {
  const uri = buildTmdbUrl(path, "poster", width);
  return (
    <View style={[styles.thumb, { width, height: Math.round((width * 3) / 2), backgroundColor: theme.secondary }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      ) : (
        <AppIcon family="Ionicons" name="film-outline" size={16} color={theme.text.muted} />
      )}
    </View>
  );
}

function RouteCard({ puzzle, copy, theme, links }) {
  return (
    <View style={[styles.route, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <RouteEnd person={puzzle.start} label={copy.startLabel} theme={theme} />
      <View style={styles.routeMid}>
        <View style={styles.routeLine}>
          <View style={[styles.routeDash, { backgroundColor: CHAIN_ACCENT }]} />
          <AppIcon family="Ionicons" name="git-commit-outline" size={18} color={CHAIN_ACCENT} />
          <View style={[styles.routeDash, { backgroundColor: CHAIN_ACCENT }]} />
        </View>
        <Text style={[styles.routePar, { color: theme.text.primary }]} numberOfLines={2}>
          {copy.parLabel(puzzle.par)}
        </Text>
        <Text style={[styles.routeLinks, { color: theme.text.muted }]} numberOfLines={1}>
          {copy.linksLabel(links)}
        </Text>
      </View>
      <RouteEnd person={puzzle.target} label={copy.targetLabel} theme={theme} target />
    </View>
  );
}

/** Klavye açıkken: tek satır — küçük avatarlar, adlar, film sayısı / en kısa. */
function CompactRoute({ puzzle, theme, links }) {
  return (
    <View style={[styles.compactRoute, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Avatar path={puzzle.start.profilePath} size={26} theme={theme} />
      <Text style={[styles.compactName, { color: theme.text.primary }]} numberOfLines={1}>
        {puzzle.start.name}
      </Text>
      <AppIcon family="Ionicons" name="arrow-forward" size={14} color={CHAIN_ACCENT} />
      <Avatar path={puzzle.target.profilePath} size={26} theme={theme} style={{ borderWidth: 1.5, borderColor: GOLD }} />
      <Text style={[styles.compactName, { color: theme.text.primary }]} numberOfLines={1}>
        {puzzle.target.name}
      </Text>
      <Text style={[styles.compactCount, { color: theme.text.muted }]} allowFontScaling={false}>
        {`${links}/${puzzle.par}`}
      </Text>
    </View>
  );
}

function RouteEnd({ person, label, theme, target }) {
  return (
    <View style={styles.routeEnd}>
      <Avatar path={person.profilePath} size={58} theme={theme} style={target ? { borderWidth: 2, borderColor: GOLD } : null} />
      <Text style={[styles.routeKicker, { color: target ? GOLD : theme.text.muted }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.routeName, { color: theme.text.primary }]} numberOfLines={2}>
        {person.name}
      </Text>
    </View>
  );
}

/** Zincir şeridi çipi. */
function NodeChip({ node, theme, active, target }) {
  const film = node.kind === "film";
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: theme.secondary, borderColor: target ? GOLD : active ? CHAIN_ACCENT : theme.border },
      ]}
    >
      {film ? <Thumb path={node.posterPath} width={22} theme={theme} /> : <Avatar path={node.profilePath} size={26} theme={theme} />}
      <Text style={[styles.chipText, { color: theme.text.primary }]} numberOfLines={1}>
        {film ? node.title : node.name}
      </Text>
    </View>
  );
}

function ChainStrip({ chain, puzzle, theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd?.({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [chain.length]);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {chain.map((node, index) => (
        <View key={nodeKey(node)} style={styles.stripItem}>
          {index > 0 ? <AppIcon family="Ionicons" name="chevron-forward" size={14} color={theme.text.muted} /> : null}
          <NodeChip
            node={node}
            theme={theme}
            active={index === chain.length - 1}
            target={node.kind === "person" && node.id === puzzle.target.id}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function OptionRow({ item, kind, copy, theme, onPress }) {
  const film = kind === "film";
  const title = film ? item.title : item.name;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={film ? copy.filmA11y(item.title, item.year) : item.name}
      onPress={() => onPress(item)}
      scaleTo={0.98}
      style={[styles.row, { borderColor: theme.border }]}
    >
      {film ? <Thumb path={item.posterPath} width={38} theme={theme} /> : <Avatar path={item.profilePath} size={44} theme={theme} />}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
          {film && item.year ? <Text style={{ color: theme.text.muted }}>{`  ${item.year}`}</Text> : null}
        </Text>
        {item.character ? (
          <Text style={[styles.rowSub, { color: theme.text.muted }]} numberOfLines={1}>
            {copy.asCharacter(item.character)}
          </Text>
        ) : null}
      </View>
      <AppIcon family="Ionicons" name="add-circle" size={22} color={CHAIN_ACCENT} />
    </PressableScale>
  );
}

function Picker({ game, copy, theme, compact }) {
  const { chain, puzzle, pickKind, options } = game;
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const last = chain[chain.length - 1];
  useEffect(() => setQuery(""), [last?.kind, last?.id]);

  const used = useMemo(() => usedKeysOf(chain), [chain]);
  const items = useMemo(
    () => filterChainOptions(options.items, { query, used, kind: pickKind }),
    [options.items, query, used, pickKind],
  );
  const film = pickKind === "film";

  if (chainAtLimit(chain, puzzle)) {
    return (
      <View style={styles.limit}>
        <AppIcon family="Ionicons" name="alert-circle-outline" size={32} color={theme.text.muted} />
        <Text style={[styles.limitText, { color: theme.text.secondary }]}>{copy.maxReached(CHAIN_MAX_FILMS)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.picker}>
      {compact ? null : (
        <View>
          <Text style={[styles.pickTitle, { color: theme.text.primary }]}>{film ? copy.pickFilmTitle : copy.pickPersonTitle}</Text>
          <Text style={[styles.pickSub, { color: theme.text.muted }]} numberOfLines={1}>
            {film ? copy.pickFilmFrom(last.name) : copy.pickPersonFrom(last.title)}
          </Text>
        </View>
      )}
      <GlassField
        height={44}
        focused={focused}
        accent={CHAIN_ACCENT}
        fallbackStyle={[styles.searchBox, { backgroundColor: theme.secondary, borderColor: focused ? CHAIN_ACCENT : theme.border }]}
        style={styles.searchField}
      >
        <AppIcon family="Ionicons" name="search" size={16} color={focused ? CHAIN_ACCENT : theme.text.muted} />
        <TextInput
          allowFontScaling={false}
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder={film ? copy.searchFilms : copy.searchCast}
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <GlassPressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="×" hitSlop={10}>
            <AppIcon family="Ionicons" name="close-circle" size={17} color={theme.text.muted} />
          </GlassPressable>
        ) : null}
      </GlassField>

      {options.status === "loading" ? <LoadingState theme={theme} copy={copy} /> : null}
      {options.status === "error" ? <ErrorState theme={theme} copy={copy} accent={CHAIN_ACCENT} onRetry={game.retry} /> : null}
      {options.status === "ready" ? (
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <OptionRow item={item} kind={pickKind} copy={copy} theme={theme} onPress={game.pick} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          windowSize={7}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.text.muted }]}>{copy.noMatches}</Text>}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

/** Sonuç zinciri: dikey zaman çizelgesi — oyuncu (yuvarlak foto) ve film (afiş + yıl) halkaları çizgiyle bağlı. */
function ChainTimeline({ nodes, theme, puzzle }) {
  return (
    <View style={styles.timeline}>
      {nodes.map((node, index) => {
        const film = node.kind === "film";
        const target = !film && node.id === puzzle.target.id;
        const first = index === 0;
        const last = index === nodes.length - 1;
        return (
          <View key={nodeKey(node)} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlLine, { backgroundColor: first ? "transparent" : `${CHAIN_ACCENT}66` }]} />
              <View
                style={[
                  styles.tlDot,
                  { backgroundColor: film ? theme.secondary : target ? GOLD : CHAIN_ACCENT, borderColor: film ? CHAIN_ACCENT : "transparent" },
                ]}
              />
              <View style={[styles.tlLine, { backgroundColor: last ? "transparent" : `${CHAIN_ACCENT}66` }]} />
            </View>
            <View style={[styles.tlCard, film && styles.tlCardFilm, { backgroundColor: theme.secondary, borderColor: target ? GOLD : theme.border }]}>
              {film ? <Thumb path={node.posterPath} width={30} theme={theme} /> : <Avatar path={node.profilePath} size={34} theme={theme} />}
              <View style={styles.tlCopy}>
                <Text style={[styles.tlTitle, { color: theme.text.primary }]} numberOfLines={1}>
                  {film ? node.title : node.name}
                </Text>
                {film && node.year ? (
                  <Text style={[styles.tlSub, { color: theme.text.muted }]} allowFontScaling={false}>
                    {node.year}
                  </Text>
                ) : null}
              </View>
              {target ? <AppIcon family="Ionicons" name="flag" size={15} color={GOLD} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StatTile({ value, label, theme, accent }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: accent || theme.text.primary }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ResultView({ game, copy, theme, mode, canSend, onSend, onMode, onClose }) {
  const { puzzle, chain, phase, points, links, streak } = game;
  const gaveUp = phase === "gaveUp";
  const [showSolution, setShowSolution] = useState(gaveUp);
  const stars = chainStars(links, puzzle.par, gaveUp);
  const actors = chain.filter((n) => n.kind === "person").length;

  const verdict = gaveUp
    ? null
    : links < puzzle.par
      ? copy.beatPar
      : links === puzzle.par
        ? copy.perfect
        : copy.overPar(links - puzzle.par);

  const shareOut = async () => {
    try {
      await Share.share({ message: chainShareText(copy, { puzzle, links, gaveUp }) });
      trackEvent(ANALYTICS_EVENTS.FILM_CHAIN_SHARED, { mode, number: puzzle.number || 0, target: "out" });
    } catch {}
  };

  return (
    <ScrollView contentContainerStyle={styles.result} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gaveUp ? HERO_GAVE_UP : HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View pointerEvents="none" style={styles.heroMark}>
          <AppIcon family="Ionicons" name="git-network" size={150} color="rgba(255,255,255,0.07)" />
        </View>
        <Text style={styles.heroKicker} allowFontScaling={false}>
          {(gaveUp ? copy.gaveUpTitle : copy.solvedTitle).toUpperCase()}
        </Text>
        <View style={styles.heroScore}>
          <Text style={styles.heroPoints} allowFontScaling={false}>
            {points}
          </Text>
          <Text style={styles.heroPointsLabel} allowFontScaling={false}>
            {copy.pointsLabel}
          </Text>
        </View>
        {!gaveUp ? (
          <View style={styles.stars} accessibilityLabel={`${stars}/3`}>
            {[0, 1, 2].map((i) => (
              <AppIcon key={i} family="Ionicons" name={i < stars ? "star" : "star-outline"} size={24} color={i < stars ? GOLD : "rgba(255,255,255,0.45)"} />
            ))}
          </View>
        ) : null}
        {verdict ? <Text style={styles.heroVerdict}>{verdict}</Text> : null}
        <View style={styles.heroRoute}>
          <Avatar path={puzzle.start.profilePath} size={28} theme={theme} />
          <Text style={styles.heroRouteName} numberOfLines={1}>
            {puzzle.start.name}
          </Text>
          <AppIcon family="Ionicons" name="arrow-forward" size={13} color="#FFFFFF" />
          <Avatar path={puzzle.target.profilePath} size={28} theme={theme} style={{ borderWidth: 1.5, borderColor: GOLD }} />
          <Text style={styles.heroRouteName} numberOfLines={1}>
            {puzzle.target.name}
          </Text>
        </View>
        {mode === "daily" && streak > 0 ? (
          <View style={styles.streakPill}>
            <AppIcon family="Ionicons" name="flame" size={13} color={GOLD} />
            <Text style={styles.streakText}>{copy.streak(streak)}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {!gaveUp ? (
        <View style={styles.stats}>
          <StatTile value={links} label={copy.statFilms} theme={theme} accent={CHAIN_ACCENT} />
          <StatTile value={actors} label={copy.statActors} theme={theme} />
          <StatTile value={puzzle.par} label={copy.statPar} theme={theme} accent={GOLD} />
        </View>
      ) : null}

      {canSend ? (
        <View style={styles.sendBlock}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.challengeFriend}
            onPress={onSend}
            style={[gameSharedStyles.primaryButton, { backgroundColor: CHAIN_ACCENT }]}
          >
            <AppIcon family="Ionicons" name="paper-plane" size={18} color="#FFFFFF" />
            <Text style={gameSharedStyles.primaryButtonText}>{copy.challengeFriend}</Text>
          </PressableScale>
          <View style={styles.sendHint}>
            <AppIcon family="Ionicons" name="eye-off-outline" size={13} color={theme.text.muted} />
            <Text style={[styles.sendHintText, { color: theme.text.muted }]}>{copy.challengeHint}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.secondaryRow}>
        <GlassPressable onPress={shareOut} accessibilityRole="button" style={[styles.secondary, { borderColor: theme.border }]}>
          <AppIcon family="Ionicons" name="share-outline" size={16} color={theme.text.secondary} />
          <Text style={[styles.secondaryText, { color: theme.text.secondary }]}>{copy.share}</Text>
        </GlassPressable>
        {mode === "free" ? (
          <GlassPressable onPress={game.newPuzzle} accessibilityRole="button" style={[styles.secondary, { borderColor: CHAIN_ACCENT }]}>
            <AppIcon family="Ionicons" name="shuffle" size={16} color={CHAIN_ACCENT} />
            <Text style={[styles.secondaryText, { color: CHAIN_ACCENT }]}>{copy.newPuzzle}</Text>
          </GlassPressable>
        ) : (
          <GlassPressable onPress={() => onMode("free")} accessibilityRole="button" style={[styles.secondary, { borderColor: CHAIN_ACCENT }]}>
            <AppIcon family="Ionicons" name="shuffle" size={16} color={CHAIN_ACCENT} />
            <Text style={[styles.secondaryText, { color: CHAIN_ACCENT }]} numberOfLines={1}>
              {copy.playFree}
            </Text>
          </GlassPressable>
        )}
      </View>

      {!gaveUp ? (
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{copy.yourChain}</Text>
          <ChainTimeline nodes={chain} theme={theme} puzzle={puzzle} />
        </View>
      ) : null}

      <GlassPressable
        onPress={() => setShowSolution((v) => !v)}
        accessibilityRole="button"
        style={[styles.ghost, { borderColor: theme.border }]}
      >
        <AppIcon family="Ionicons" name={showSolution ? "eye-off-outline" : "eye-outline"} size={16} color={theme.text.secondary} />
        <Text style={[styles.ghostText, { color: theme.text.secondary }]}>
          {showSolution ? copy.hideSolution : copy.showSolution}
        </Text>
      </GlassPressable>
      {showSolution ? (
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{copy.ourChain(puzzle.par)}</Text>
          <ChainTimeline nodes={puzzle.solution} theme={theme} puzzle={puzzle} />
        </View>
      ) : null}

      <GlassPressable onPress={onClose} accessibilityRole="button" style={[styles.ghost, { borderColor: theme.border }]}>
        <Text style={[styles.ghostText, { color: theme.text.secondary }]}>{copy.close}</Text>
      </GlassPressable>
    </ScrollView>
  );
}

function LockedShell({ navigation }) {
  const { language } = useLanguage();
  return <GameScreenShell navigation={navigation} title={getFilmChainCopy(language).title} scroll={false} />;
}

function FilmChainGame({ navigation, initialMode, puzzleId }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { API_KEY } = useApiSettings();
  const copy = getFilmChainCopy(language);
  const [mode, setMode] = useState(initialMode);
  const game = useFilmChain({ apiKey: API_KEY, language, uid: user?.uid || null, mode, puzzleId });
  const { puzzle, chain, phase } = game;
  const playing = phase === "playing";
  const { inset, onLayout } = useKeyboardInset(playing);
  const keyboardOpen = playing && inset > 0;
  const [chatOpen, setChatOpen] = useState(false);

  const share = useMemo(
    () =>
      puzzle && !playing
        ? buildChainShare({ puzzle, links: game.links, gaveUp: phase === "gaveUp", mode, host: user?.displayName })
        : null,
    [puzzle, playing, game.links, phase, mode, user?.displayName],
  );

  if (!puzzle) {
    return (
      <GameScreenShell navigation={navigation} title={copy.title} scroll={false}>
        <ErrorState theme={theme} copy={copy} accent={CHAIN_ACCENT} onRetry={() => navigation.goBack()} />
      </GameScreenShell>
    );
  }

  return (
    <GameScreenShell
      navigation={navigation}
      title={copy.title}
      subtitle={puzzle.number ? copy.dailyNumber(puzzle.number) : copy.freeMode}
      scroll={false}
    >
      <View style={[styles.board, { paddingBottom: inset }]} onLayout={onLayout}>
        {keyboardOpen ? null : (
          <GlassSegmentedControl
            options={[
              { value: "daily", label: copy.modeDaily, icon: "calendar" },
              { value: "free", label: copy.modeFree, icon: "shuffle" },
            ]}
            value={mode}
            onChange={setMode}
            height={38}
            accessibilityLabel={copy.title}
            testIDPrefix="chain-mode"
          />
        )}

        {playing ? (
          <>
            {keyboardOpen ? (
              <CompactRoute puzzle={puzzle} theme={theme} links={game.links} />
            ) : (
              <RouteCard puzzle={puzzle} copy={copy} theme={theme} links={game.links} />
            )}
            <View style={styles.stripRow}>
              <View style={styles.stripWrap}>
                <ChainStrip chain={chain} puzzle={puzzle} theme={theme} />
              </View>
            </View>
            {keyboardOpen ? null : (
              <View style={styles.actions}>
                <GlassPressable
                  onPress={game.undo}
                  disabled={chain.length <= 1}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: chain.length <= 1 }}
                  style={[styles.action, { borderColor: theme.border, opacity: chain.length <= 1 ? 0.45 : 1 }]}
                >
                  <AppIcon family="Ionicons" name="arrow-undo" size={15} color={theme.text.secondary} />
                  <Text style={[styles.actionText, { color: theme.text.secondary }]}>{copy.undo}</Text>
                </GlassPressable>
                <GlassPressable onPress={game.giveUp} accessibilityRole="button" style={[styles.action, { borderColor: theme.border }]}>
                  <AppIcon family="Ionicons" name="flag-outline" size={15} color={theme.text.secondary} />
                  <Text style={[styles.actionText, { color: theme.text.secondary }]}>{copy.giveUp}</Text>
                </GlassPressable>
              </View>
            )}
            <Picker key={puzzle.id} game={game} copy={copy} theme={theme} compact={keyboardOpen} />
          </>
        ) : (
          <ResultView
            key={`${puzzle.id}:${phase}`}
            game={game}
            copy={copy}
            theme={theme}
            mode={mode}
            canSend={!!user?.uid && !!share}
            onSend={() => setChatOpen(true)}
            onMode={setMode}
            onClose={() => navigation.goBack()}
          />
        )}
      </View>
      <ShareToChatSheet
        visible={chatOpen}
        share={share}
        onClose={() => setChatOpen(false)}
        onSent={() => trackEvent(ANALYTICS_EVENTS.FILM_CHAIN_SHARED, { mode, number: puzzle.number || 0, target: "chat" })}
      />
    </GameScreenShell>
  );
}

export default function FilmChainScreen({ navigation, route }) {
  // Premium (registry "film_chain"). Girişler (ray kartı, sohbet kartı) kilitliyken zaten yükseltme açar; bu ikinci
  // kapı başka yoldan gelinirse yükseltmeyi açıp ekranı geri sarar. Kilitliyken oyun HİÇ kurulmaz (TMDB isteği yok).
  const locked = usePremiumScreenGuard("film_chain", navigation);
  const puzzleId = typeof route?.params?.puzzleId === "string" ? route.params.puzzleId : null;
  const initialMode = puzzleId || route?.params?.mode === "free" ? "free" : "daily";
  if (locked) return <LockedShell navigation={navigation} />;
  // Sohbetteki başka bir meydan okumadan gelince (ekran zaten açıkken) oyun o bulmacayla baştan kurulur.
  return <FilmChainGame key={`${initialMode}:${puzzleId || ""}`} navigation={navigation} initialMode={initialMode} puzzleId={puzzleId} />;
}

const styles = StyleSheet.create({
  board: { flex: 1, gap: 12 },
  fill: { width: "100%", height: "100%" },
  avatar: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumb: { borderRadius: 5, overflow: "hidden", alignItems: "center", justifyContent: "center" },

  route: { flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 10 },
  routeEnd: { width: 92, alignItems: "center", gap: 3 },
  routeKicker: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 4 },
  routeName: { fontSize: 13, fontWeight: "800", textAlign: "center", lineHeight: 16 },
  routeMid: { flex: 1, alignItems: "center", gap: 4 },
  routeLine: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 4 },
  routeDash: { flex: 1, height: 2, borderRadius: 1, opacity: 0.6 },
  routePar: { fontSize: 13, fontWeight: "900", textAlign: "center" },
  routeLinks: { fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  compactRoute: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 8 },
  compactName: { flexShrink: 1, fontSize: 12.5, fontWeight: "800" },
  compactCount: { marginLeft: "auto", fontSize: 12, fontWeight: "900", paddingLeft: 4 },

  stripRow: { flexDirection: "row", alignItems: "center" },
  stripWrap: { flex: 1 },
  strip: { alignItems: "center", gap: 4, paddingVertical: 2 },
  stripItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, maxWidth: 190, borderRadius: 18, borderWidth: 1.5, paddingVertical: 4, paddingLeft: 4, paddingRight: 11 },
  chipText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },

  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minHeight: 38, borderRadius: 19, borderWidth: 1 },
  actionText: { fontSize: 13, fontWeight: "800" },

  picker: { flex: 1, gap: 10 },
  pickTitle: { fontSize: 17, fontWeight: "900" },
  pickSub: { fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  searchField: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  searchBox: { borderRadius: 22, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 0 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: "800" },
  rowSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  empty: { textAlign: "center", fontSize: 13, fontWeight: "700", marginTop: 24 },
  limit: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  limitText: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 19 },

  result: { gap: 12, paddingBottom: 40 },
  hero: { borderRadius: 24, overflow: "hidden", paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 6 },
  heroMark: { position: "absolute", right: -34, top: -30 },
  heroKicker: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heroScore: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  heroPoints: { color: "#FFFFFF", fontSize: 64, fontWeight: "900", lineHeight: 70, letterSpacing: -1.5 },
  heroPointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "900", marginBottom: 12 },
  stars: { flexDirection: "row", gap: 6 },
  heroVerdict: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", textAlign: "center" },
  heroRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroRouteName: { flexShrink: 1, color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.25)", marginTop: 4 },
  streakText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },

  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "800", marginTop: 1 },

  sendBlock: { gap: 6 },
  sendHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  sendHintText: { flexShrink: 1, fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  secondaryRow: { flexDirection: "row", gap: 8 },
  secondary: { flex: 1, flexDirection: "row", gap: 6, minHeight: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { flexShrink: 1, fontSize: 13.5, fontWeight: "800" },

  sectionTitle: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.6, marginBottom: 6, textTransform: "uppercase" },
  timeline: {},
  tlRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  tlRail: { width: 14, alignItems: "center" },
  tlLine: { width: 2, flexGrow: 1 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  tlCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 8, marginVertical: 3 },
  tlCardFilm: { marginLeft: 12 },
  tlCopy: { flex: 1, minWidth: 0 },
  tlTitle: { fontSize: 13.5, fontWeight: "800" },
  tlSub: { fontSize: 11.5, fontWeight: "700", marginTop: 1 },
  ghost: { alignSelf: "stretch", flexDirection: "row", gap: 6, minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "800" },
});
