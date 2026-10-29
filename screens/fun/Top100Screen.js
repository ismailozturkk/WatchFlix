// screens/fun/Top100Screen.js
//
// "Seelogd Top 100": film ve dizilerin KARIŞIK topluluk sıralaması (Eğlence > Günün Sorusu'nun altındaki karttan).
//
//   • Sıra = hibrit oy sayısı: TMDB değerlendirme sayısı + Seelogd oyu × ağırlık (utils/top100.js; veri hooks/useTop100).
//     En çok oy alan en üstte; puan ortalaması sıralamaya girmez.
//   • 4'lü afiş ızgarası: her afişte sıra rozeti, oy sayısı ve tek dokunuşluk "Oy ver" (hype; tekrar dokununca geri alınır).
//   • Üstte arama: herhangi bir film/diziyi bulup oy ver; Top 100 dışındaysa oyu onu yarışa sokar.
//   • Üst kart: ünlem düğmesi (ayrıntılı açıklama, Top100InfoSheet) + "Liste olarak kaydet" / "Sohbete gönder".
//     İkisi önce uzunluk sorar (İlk 20/50/70/100, Top100CountSheet), sonra SaveSharedListModal / ShareToChatSheet
//     açılır — ikinci sayfa birincinin onDismissed'ında (iOS iki Modal kuralı).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import Toast from "@components/AppToast";
import GlassField from "@components/common/GlassField";
import GlassTouchable from "@components/common/GlassTouchable";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import SaveSharedListModal from "@components/modals/SaveSharedListModal";
import Top100CountSheet from "@components/top100/Top100CountSheet";
import Top100InfoSheet from "@components/top100/Top100InfoSheet";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings, useImageQualitySettings } from "@context/AppSettingsContext";
import { useGlassScheme } from "@components/common/GlassSurface";
import useTop100 from "@hooks/useTop100";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { searchTop100, TOP100_LIMIT_ERROR } from "@services/top100Service";
import { triggerHaptic } from "@services/hapticsService";
import { buildListShare } from "@utils/chatShare";
import { decorateItem, showsTotalVotes, top100MediaList } from "@utils/top100";
import { getTop100Copy } from "@utils/top100Copy";

const MEDALS = ["#F5B70A", "#A8B0BC", "#CD7F42"];
const HYPE = "#F97316";
const FILTERS = ["all", "movie", "tv"];
const SEARCH_DEBOUNCE_MS = 350;
const COLUMNS = 4;
const GAP = 8;
const SIDE = 16; // GameScreenShell içerik dolgusu

// locked: Free'de henüz oy verilmemiş yapım — düğme kilit simgesiyle çizilir, dokunuş yükseltme sayfasını açar.
const Cell = React.memo(function Cell({ row, width, hyped, locked, copy, theme, getTmdbUrl, onOpen, onHype }) {
  const medal = row.rank && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  return (
    <View style={{ width }}>
      <GlassTouchable
        glass={false}
        onPress={() => onOpen(row)}
        accessibilityRole="button"
        accessibilityLabel={copy.cellA11y(row.rank, row.title, row.votes)}
        style={[styles.poster, { width, height: width * 1.5, backgroundColor: theme.border }]}
      >
        {row.poster_path ? (
          <Image
            source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            recyclingKey={row.key}
          />
        ) : null}
        <View style={[styles.rankBadge, medal ? { backgroundColor: medal } : styles.rankBadgePlain]}>
          <Text style={[styles.rankText, medal && styles.rankTextMedal]} allowFontScaling={false}>
            {row.rank ? `#${row.rank}` : "–"}
          </Text>
        </View>
        {hyped ? (
          <View style={styles.hypedMark}>
            <AppIcon family="Ionicons" name="flame" size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </GlassTouchable>

      <Text style={[styles.cellTitle, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
        {row.title}
      </Text>
      <View style={styles.votesLine}>
        <AppIcon family="Ionicons" name="people" size={10} color={theme.text.muted} />
        <Text style={[styles.votesText, { color: theme.text.secondary }]} numberOfLines={1} allowFontScaling={false}>
          {copy.votes(row.votes)}
        </Text>
      </View>

      <GlassTouchable
        glass={false}
        onPress={() => onHype(row)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ selected: hyped }}
        accessibilityLabel={copy.hypeA11y(row.title, hyped)}
        style={[
          styles.hypeBtn,
          hyped
            ? { backgroundColor: HYPE, borderColor: HYPE }
            : { borderColor: `${HYPE}AA`, backgroundColor: `${HYPE}14` },
        ]}
      >
        <AppIcon
          family="Ionicons"
          name={hyped ? "flame" : locked ? "lock-closed" : "flame-outline"}
          size={locked && !hyped ? 11 : 12}
          color={hyped ? "#FFFFFF" : HYPE}
        />
        <Text style={[styles.hypeText, { color: hyped ? "#FFFFFF" : HYPE }]} numberOfLines={1} allowFontScaling={false}>
          {hyped ? copy.voted : copy.vote}
        </Text>
      </GlassTouchable>
    </View>
  );
});

export default function Top100Screen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { width: screenWidth } = useWindowDimensions();
  const glassScheme = useGlassScheme();
  const copy = getTop100Copy(language);
  const { status, ranked, counters, myHype, used, totalVotes, refresh, toggleHype, rankOf, syncMyHype } = useTop100();
  // Aktif oy hakkı (registry "top100_vote": Free 0 · Premium 10 · Max 20; sunucu aynası firestore.rules).
  // Listeyi görmek, aramak, kaydetmek, paylaşmak ve verilmiş oyu GERİ ALMAK (hakkı geri verir) her planda serbest.
  const voteGate = usePremiumGate("top100_vote");
  const voteLimit = Number(voteGate.limit) || 0;
  const canVote = voteGate.allows(used);

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState({ status: "idle", results: [] });
  const [infoVisible, setInfoVisible] = useState(false);
  const [countMode, setCountMode] = useState(null);
  const [countVisible, setCountVisible] = useState(false);
  const [pending, setPending] = useState(null); // { mode, count } — sayım sayfası kapanınca açılacak sayfa
  const [saveTarget, setSaveTarget] = useState(null);
  const [chatShare, setChatShare] = useState(null);
  const searchSeq = useRef(0);

  // Afiş genişliği ÇİFT tam sayı (2:3 afiş yarım piksel kırpılmasın — shareKit PosterEdge dersi).
  const cellWidth = Math.max(60, Math.floor((screenWidth - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS / 2) * 2);

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
          if (seq !== searchSeq.current) return;
          setSearch({ status: "ready", results });
          syncMyHype(results.map((item) => item.key));
        })
        .catch(() => {
          if (seq === searchSeq.current) setSearch({ status: "error", results: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searching, API_KEY, language, syncMyHype]);

  const rankedByKey = useMemo(() => new Map(ranked.map((row) => [row.key, row])), [ranked]);

  // Arama sonucu: Top 100'deyse sıralı satır, değilse sayaçla hesaplanan oy sayısıyla sırasız satır.
  const decorate = useCallback(
    (item) => rankedByKey.get(item.key) || { ...decorateItem(item, counters[item.key]), rank: rankOf(item.key) },
    [rankedByKey, counters, rankOf],
  );

  const data = useMemo(() => {
    if (searching) return search.results.map(decorate);
    return filter === "all" ? ranked : ranked.filter((row) => row.media_type === filter);
  }, [searching, search.results, decorate, filter, ranked]);

  const openDetails = useCallback(
    (row) => navigation.navigate(row.media_type === "tv" ? "TvShowsDetails" : "MovieDetails", { id: row.id }),
    [navigation],
  );

  const onHype = useCallback(
    async (row) => {
      const adding = !myHype[row.key];
      // Free: kilitli sayfa; Premium'da hak doluysa "hakkın doldu" + kullanım göstergesi (used / limit).
      const upsell = (usedNow) =>
        voteGate.showUpsell({
          used: usedNow,
          preview: {
            kind: "vote",
            title: row.title,
            posterUri: row.poster_path ? getTmdbUrl(row.poster_path, "poster", 200) : null,
            rank: row.rank || null,
            votes: row.votes,
          },
        });
      if (adding && !canVote) {
        triggerHaptic("selection");
        upsell(used);
        return;
      }
      triggerHaptic(adding ? "success" : "selection");
      try {
        const { hyped, rank } = await toggleHype(row, { limit: voteLimit });
        if (adding && hyped) {
          Toast.show({
            type: "success",
            text1: copy.voteAdded,
            text2: `${row.title} · ${rank ? copy.newRank(rank) : copy.notRanked}`,
          });
        }
      } catch (error) {
        // Başka cihazda hak dolmuş olabilir: sunucunun sayısıyla yükseltme sayfası.
        if (error?.code === TOP100_LIMIT_ERROR) upsell(error.used);
        else Toast.show({ type: "error", text1: copy.voteFailed });
      }
    },
    [myHype, canVote, used, voteLimit, voteGate, getTmdbUrl, toggleHype, copy],
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

  const showTotal = showsTotalVotes(totalVotes);
  // Hak çubuğu: Premium/Max'ta "Oy hakkın 3/10"; Free'de yalnız (hak sisteminden önceki) oyları varsa sayı.
  const budgetText = voteLimit > 0 ? copy.budget(used, voteLimit) : used > 0 ? copy.myVotes(used) : null;

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
        <View style={styles.heroTop}>
          <AppIcon family="Ionicons" name="trophy" size={15} color="#FFE7A3" />
          <Text style={styles.heroEyebrow} numberOfLines={1}>
            {copy.eyebrow}
          </Text>
          {/* Ayrıntılı açıklama: ünlem düğmesi → Top100InfoSheet */}
          <GlassTouchable
            glass={false}
            onPress={() => {
              triggerHaptic("selection");
              setInfoVisible(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copy.infoA11y}
            style={styles.infoBtn}
          >
            <AppIcon family="Ionicons" name="alert-circle-outline" size={20} color="#FFFFFF" />
          </GlassTouchable>
        </View>
        {showTotal || budgetText ? (
          <View style={styles.heroStats}>
            {showTotal ? (
              <View style={styles.heroPill}>
                <AppIcon family="Ionicons" name="people" size={12} color="#FFFFFF" />
                <Text style={styles.heroPillText}>{copy.totalVotes(totalVotes)}</Text>
              </View>
            ) : null}
            {budgetText ? (
              <View style={[styles.heroPill, voteLimit > 0 && used >= voteLimit && styles.heroPillFull]}>
                <AppIcon family="Ionicons" name="flame" size={12} color="#FFD76A" />
                <Text style={styles.heroPillText}>{budgetText}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
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
      <Cell
        row={item}
        width={cellWidth}
        hyped={!!myHype[item.key]}
        locked={!canVote}
        copy={copy}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        onOpen={openDetails}
        onHype={onHype}
      />
    ),
    [cellWidth, myHype, canVote, copy, theme, getTmdbUrl, openDetails, onHype],
  );

  return (
    <GameScreenShell navigation={navigation} title={copy.screenTitle} subtitle={copy.screenSub} scroll={false}>
      <FlatList
        data={data}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        windowSize={9}
      />

      <Top100InfoSheet visible={infoVisible} copy={copy} onClose={() => setInfoVisible(false)} />

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
  list: { paddingBottom: 40, gap: 14 },
  gridRow: { gap: GAP },
  headerWrap: { gap: 12, marginBottom: 2 },
  hero: { borderRadius: 24, padding: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  heroMark: { position: "absolute", right: -20, top: -18, transform: [{ rotate: "-12deg" }] },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroEyebrow: { flex: 1, color: "#FFE7A3", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  infoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
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
  // Hak doldu: hap koyu kırmızıya döner (oy düğmeleri de kilitli çizilir).
  heroPillFull: { backgroundColor: "rgba(127,29,29,0.55)" },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 12 },
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

  poster: { borderRadius: 10, overflow: "hidden" },
  rankBadge: {
    position: "absolute",
    left: 4,
    top: 4,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgePlain: { backgroundColor: "rgba(0,0,0,0.68)" },
  rankText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900", fontVariant: ["tabular-nums"] },
  rankTextMedal: { color: "#1F1300" },
  hypedMark: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: HYPE,
    alignItems: "center",
    justifyContent: "center",
  },
  cellTitle: { fontSize: 11, fontWeight: "800", marginTop: 5 },
  votesLine: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  votesText: { flexShrink: 1, fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hypeBtn: {
    height: 26,
    marginTop: 5,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  hypeText: { fontSize: 10.5, fontWeight: "900", flexShrink: 1 },

  state: { alignItems: "center", gap: 10, paddingVertical: 40 },
  stateText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  retry: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: "900" },
});
