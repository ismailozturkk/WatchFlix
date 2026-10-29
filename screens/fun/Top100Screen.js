// screens/fun/Top100Screen.js
//
// "Seelogd Top 100": film ve dizilerin KARIŞIK topluluk sıralaması (Eğlence > Günün Sorusu'nun altındaki karttan).
//
//   • Varsayılan liste: TMDB'nin en çok oylanan film + dizileri, TMDB puanına Seelogd oyları eklenerek sıralanır
//     (model utils/top100.js; veri hooks/useTop100).
//   • Üstte arama: herhangi bir film/diziyi bulup oy ver; Top 100 dışındaysa oyu onu yarışa sokar.
//   • Her satırda "Oy ver" (1–10, Top100VoteSheet); kendi oyun satırda renkli rozet olarak görünür.
//   • "Liste olarak kaydet" ve "Sohbete gönder": önce uzunluk (İlk 20/50/70/100, Top100CountSheet), sonra mevcut
//     SaveSharedListModal / ShareToChatSheet (listShare). İkinci sayfa birincinin onDismissed'ında açılır
//     (iOS iki Modal kuralı).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import Toast from "@components/AppToast";
import GlassField from "@components/common/GlassField";
import GlassTouchable from "@components/common/GlassTouchable";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import SaveSharedListModal from "@components/modals/SaveSharedListModal";
import Top100VoteSheet, { scoreColor } from "@components/top100/Top100VoteSheet";
import Top100CountSheet from "@components/top100/Top100CountSheet";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings, useImageQualitySettings } from "@context/AppSettingsContext";
import useTop100 from "@hooks/useTop100";
import { useGlassScheme } from "@components/common/GlassSurface";
import { searchTop100 } from "@services/top100Service";
import { triggerHaptic } from "@services/hapticsService";
import { buildListShare } from "@utils/chatShare";
import { asCounter, combinedScore, formatScore, top100MediaList } from "@utils/top100";
import { getTop100Copy } from "@utils/top100Copy";

const MEDALS = ["#F5B70A", "#A8B0BC", "#CD7F42"];
const FILTERS = ["all", "movie", "tv"];
const SEARCH_DEBOUNCE_MS = 350;

const Row = React.memo(function Row({ row, myScore, copy, theme, getTmdbUrl, onOpen, onVote }) {
  const medal = row.rank && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  return (
    <GlassTouchable
      glass={false}
      onPress={() => onOpen(row)}
      accessibilityRole="button"
      accessibilityLabel={copy.rowA11y(row.rank || "–", row.title, formatScore(row.avg))}
      style={[styles.row, { backgroundColor: theme.secondary, borderColor: medal ? `${medal}88` : theme.border }]}
    >
      <View style={styles.rankCol}>
        {medal ? (
          <View style={[styles.medal, { backgroundColor: medal }]}>
            <Text style={styles.medalText}>{row.rank}</Text>
          </View>
        ) : (
          <Text
            style={[styles.rankText, { color: row.rank ? theme.text.secondary : theme.text.muted }]}
            allowFontScaling={false}
          >
            {row.rank || "–"}
          </Text>
        )}
      </View>

      <View style={[styles.poster, { backgroundColor: theme.border }]}>
        {row.poster_path ? (
          <Image
            source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            recyclingKey={row.key}
          />
        ) : null}
      </View>

      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.text.muted }]} numberOfLines={1}>
          {[row.media_type === "tv" ? copy.tv : copy.movie, row.year].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.scoreLine}>
          <AppIcon family="Ionicons" name="star" size={12} color={MEDALS[0]} />
          <Text style={[styles.scoreText, { color: theme.text.primary }]}>{formatScore(row.avg)}</Text>
          <Text style={[styles.scoreSub, { color: theme.text.muted }]} numberOfLines={1}>
            {`${copy.tmdb} ${formatScore(row.tmdbAvg)}${row.count > 0 ? ` · ${copy.votes(row.count)}` : ""}`}
          </Text>
        </View>
        {!row.rank ? (
          <Text style={[styles.outside, { color: theme.text.muted }]}>{copy.outside}</Text>
        ) : null}
      </View>

      <GlassTouchable
        glass={false}
        onPress={() => onVote(row)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={myScore ? `${copy.yourVote} ${myScore}` : copy.vote}
        style={[
          styles.voteBtn,
          myScore
            ? { backgroundColor: scoreColor(myScore), borderColor: scoreColor(myScore) }
            : { borderColor: theme.accent, backgroundColor: `${theme.accent}14` },
        ]}
      >
        {myScore ? (
          <>
            <AppIcon family="Ionicons" name="star" size={12} color="#FFFFFF" />
            <Text style={[styles.voteText, { color: "#FFFFFF" }]}>{myScore}</Text>
          </>
        ) : (
          <Text style={[styles.voteText, { color: theme.accent }]}>{copy.vote}</Text>
        )}
      </GlassTouchable>
    </GlassTouchable>
  );
});

export default function Top100Screen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const glassScheme = useGlassScheme();
  const copy = getTop100Copy(language);
  const { status, ranked, counters, myVotes, totalVotes, refresh, vote, rankOf, syncMyVote } = useTop100();

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState({ status: "idle", results: [] });
  const [voteItem, setVoteItem] = useState(null);
  const [countMode, setCountMode] = useState(null);
  const [countVisible, setCountVisible] = useState(false);
  const [pending, setPending] = useState(null); // { mode, count } — sayım sayfası kapanınca açılacak sayfa
  const [saveTarget, setSaveTarget] = useState(null);
  const [chatShare, setChatShare] = useState(null);
  const searchSeq = useRef(0);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  useEffect(() => {
    if (!searching || !API_KEY) {
      setSearch({ status: "idle", results: [] });
      return undefined;
    }
    const seq = ++searchSeq.current;
    setSearch((prev) => ({ ...prev, status: "loading" }));
    const timer = setTimeout(() => {
      searchTop100(API_KEY, language, trimmed)
        .then((results) => {
          if (seq === searchSeq.current) setSearch({ status: "ready", results });
        })
        .catch(() => {
          if (seq === searchSeq.current) setSearch({ status: "error", results: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searching, API_KEY, language]);

  const rankedByKey = useMemo(() => new Map(ranked.map((row) => [row.key, row])), [ranked]);

  // Arama sonucu: Top 100'deyse sıralı satır, değilse sayaçtan hesaplanan puanla sırasız satır.
  const decorate = useCallback(
    (item) => {
      const hit = rankedByKey.get(item.key);
      if (hit) return hit;
      const counter = asCounter(counters[item.key]);
      const { avg, score } = combinedScore({ ...item, ...counter });
      return { ...item, ...counter, avg, score, rank: rankOf(item.key) };
    },
    [rankedByKey, counters, rankOf],
  );

  const data = useMemo(() => {
    if (searching) return search.results.map(decorate);
    return filter === "all" ? ranked : ranked.filter((row) => row.media_type === filter);
  }, [searching, search.results, decorate, filter, ranked]);

  const liveVoteItem = voteItem ? decorate(voteItem) : null;

  const openDetails = useCallback(
    (row) => navigation.navigate(row.media_type === "tv" ? "TvShowsDetails" : "MovieDetails", { id: row.id }),
    [navigation],
  );

  const openVote = useCallback(
    (row) => {
      triggerHaptic("selection");
      setVoteItem(row);
      syncMyVote(row.key);
    },
    [syncMyVote],
  );

  const submitVote = useCallback(
    async (score) => {
      if (!voteItem) return;
      try {
        const { rank } = await vote(voteItem, score);
        triggerHaptic("success");
        Toast.show({
          type: "success",
          text1: copy.voteSaved,
          text2: `${voteItem.title} · ${rank ? copy.newRank(rank) : copy.notRanked}`,
        });
        setVoteItem(null);
      } catch {
        Toast.show({ type: "error", text1: copy.voteFailed });
      }
    },
    [voteItem, vote, copy],
  );

  const openCount = (mode) => {
    if (!ranked.length) return;
    triggerHaptic("selection");
    setCountMode(mode);
    setCountVisible(true);
  };

  const confirmCount = (count) => {
    setPending({ mode: countMode, count });
    setCountVisible(false);
  };

  const onCountDismissed = () => {
    if (!pending) return;
    const { mode, count } = pending;
    setPending(null);
    const mediaList = top100MediaList(ranked, count);
    const title = copy.listTitle(count);
    if (mode === "save") setSaveTarget({ id: `top100_${count}`, title, mediaList });
    else setChatShare(buildListShare({ title, items: mediaList }));
  };

  const myCount = Object.keys(myVotes).length;

  const header = (
    <View style={styles.headerWrap}>
      <LinearGradient
        colors={["#F59E0B", "#B45309", "#431407"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroMark}>
          <AppIcon family="Ionicons" name="trophy-outline" size={130} color="rgba(255,255,255,0.08)" />
        </View>
        <Text style={styles.heroEyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.heroBody}>{copy.heroBody}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroPill}>
            <AppIcon family="Ionicons" name="people" size={12} color="#FFFFFF" />
            <Text style={styles.heroPillText}>{copy.totalVotes(totalVotes)}</Text>
          </View>
          {myCount > 0 ? (
            <View style={styles.heroPill}>
              <AppIcon family="Ionicons" name="star" size={12} color="#FFD76A" />
              <Text style={styles.heroPillText}>{copy.myVotes(myCount)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heroActions}>
          {[
            { mode: "save", icon: "bookmark-outline", label: copy.saveList },
            { mode: "chat", icon: "paper-plane-outline", label: copy.sendChat },
          ].map((action) => (
            <GlassTouchable
              key={action.mode}
              glass={false}
              disabled={!ranked.length}
              onPress={() => openCount(action.mode)}
              accessibilityRole="button"
              style={[styles.heroBtn, !ranked.length && { opacity: 0.5 }]}
            >
              <AppIcon family="Ionicons" name={action.icon} size={16} color="#FFFFFF" />
              <Text style={styles.heroBtnText} numberOfLines={1}>
                {action.label}
              </Text>
            </GlassTouchable>
          ))}
        </View>
      </LinearGradient>

      <GlassField
        height={46}
        focused={focused}
        accent={theme.accent}
        fallbackStyle={[styles.searchBox, { backgroundColor: theme.secondary, borderColor: focused ? theme.accent : theme.border }]}
        style={styles.searchField}
      >
        <AppIcon family="Ionicons" name="search" size={17} color={focused ? theme.accent : theme.text.muted} />
        <TextInput
          allowFontScaling={false}
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder={copy.searchPlaceholder}
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
          keyboardAppearance={glassScheme}
        />
        {query ? (
          <GlassTouchable glass={false} onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button">
            <AppIcon family="Ionicons" name="close-circle" size={18} color={theme.text.muted} />
          </GlassTouchable>
        ) : null}
      </GlassField>

      {searching ? (
        <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{copy.searchHeader}</Text>
      ) : (
        <View style={styles.filters}>
          {FILTERS.map((key) => {
            const active = filter === key;
            const label = key === "all" ? copy.filterAll : key === "tv" ? copy.tv : copy.movie;
            return (
              <GlassTouchable
                key={key}
                glass={false}
                onPress={() => setFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.filterChip,
                  { borderColor: theme.border, backgroundColor: theme.secondary },
                  active && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
              >
                <Text style={[styles.filterText, { color: active ? "#FFFFFF" : theme.text.secondary }]}>{label}</Text>
              </GlassTouchable>
            );
          })}
        </View>
      )}
    </View>
  );

  const busy = searching ? search.status === "loading" : status === "loading";
  const failed = searching ? search.status === "error" : status === "error";

  const empty = busy ? (
    <View style={styles.state}>
      <ActivityIndicator color={theme.accent} />
      <Text style={[styles.stateText, { color: theme.text.muted }]}>{searching ? copy.searching : copy.loading}</Text>
    </View>
  ) : failed ? (
    <View style={styles.state}>
      <AppIcon family="Ionicons" name="cloud-offline-outline" size={28} color={theme.text.muted} />
      <Text style={[styles.stateText, { color: theme.text.muted }]}>{copy.error}</Text>
      {!searching ? (
        <GlassTouchable
          glass={false}
          onPress={refresh}
          accessibilityRole="button"
          style={[styles.retry, { borderColor: theme.accent }]}
        >
          <Text style={[styles.retryText, { color: theme.accent }]}>{copy.retry}</Text>
        </GlassTouchable>
      ) : null}
    </View>
  ) : searching ? (
    <View style={styles.state}>
      <Text style={[styles.stateText, { color: theme.text.muted }]}>{copy.searchEmpty}</Text>
    </View>
  ) : null;

  const renderItem = useCallback(
    ({ item }) => (
      <Row
        row={item}
        myScore={myVotes[item.key] || null}
        copy={copy}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        onOpen={openDetails}
        onVote={openVote}
      />
    ),
    [myVotes, copy, theme, getTmdbUrl, openDetails, openVote],
  );

  return (
    <GameScreenShell navigation={navigation} title={copy.screenTitle} subtitle={copy.screenSub} scroll={false}>
      <FlatList
        data={data}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
      />

      <Top100VoteSheet
        visible={!!voteItem}
        item={liveVoteItem}
        myScore={voteItem ? myVotes[voteItem.key] || null : null}
        copy={copy}
        onClose={() => setVoteItem(null)}
        onSubmit={submitVote}
      />

      <Top100CountSheet
        visible={countVisible}
        mode={countMode}
        ranked={ranked}
        copy={copy}
        onClose={() => setCountVisible(false)}
        onConfirm={confirmCount}
        onDismissed={onCountDismissed}
      />

      <SaveSharedListModal visible={!!saveTarget} post={saveTarget} onClose={() => setSaveTarget(null)} />

      <ShareToChatSheet visible={!!chatShare} share={chatShare} onClose={() => setChatShare(null)} />
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: 8 },
  headerWrap: { gap: 12, marginBottom: 4 },
  hero: { borderRadius: 24, padding: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  heroMark: { position: "absolute", right: -20, top: -18, transform: [{ rotate: "-12deg" }] },
  heroEyebrow: { color: "#FFE7A3", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heroBody: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 6 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  heroPillText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  heroBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", flexShrink: 1 },
  searchField: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  searchBox: { borderRadius: 16, borderWidth: 1 },
  searchInput: { flex: 1, height: "100%", fontSize: 15, padding: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  filters: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  rankCol: { width: 30, alignItems: "center" },
  rankText: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  medalText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  // 2:3 afiş, genişlik çift (kırpılma dersi).
  poster: { width: 48, height: 72, borderRadius: 10, overflow: "hidden" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: "800", lineHeight: 18 },
  rowMeta: { fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  scoreLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  scoreText: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
  scoreSub: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
  outside: { fontSize: 10.5, fontWeight: "700", marginTop: 3 },
  voteBtn: {
    minWidth: 62,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  voteText: { fontSize: 12.5, fontWeight: "900" },

  state: { alignItems: "center", gap: 10, paddingVertical: 40 },
  stateText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  retry: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: "900" },
});
