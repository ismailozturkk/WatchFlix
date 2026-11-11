// screens/fun/Top100Screen.js
//
// "Seelogd Top 100": film ve dizilerin KARIŞIK topluluk sıralaması (Eğlence > Günün Sorusu'nun altındaki karttan).
//
//   • Sıra = hibrit oy sayısı: TMDB değerlendirme sayısı + Seelogd oyu × ağırlık (utils/top100.js; veri hooks/useTop100).
//     En çok oy alan en üstte; puan ortalaması sıralamaya girmez.
//   • 4'lü afiş ızgarası: afiş (seçilmişse turuncu çerçeve) + altında sıra numarası ve oy sayısı (ad/düğme yok).
//     Hücreye dokunuş seçenek sayfasını açar (Top100PosterSheet): Bilgi → detay · Seçim yap → oy ver / geri al · İptal et.
//   • Üstte arama: herhangi bir film/diziyi bulup oy ver; Top 100 dışındaysa oyu onu yarışa sokar.
//   • Üst kart: ünlem düğmesi (ayrıntılı açıklama, Top100InfoSheet) + "Liste olarak kaydet" / "Sohbete gönder".
//     İkisi önce uzunluk sorar (İlk 20/50/70/100, Top100CountSheet), sonra SaveSharedListModal / ShareToChatSheet
//     açılır — ikinci sayfa birincinin onDismissed'ında (iOS iki Modal kuralı).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import LensLoader from "../../components/LensLoader";
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
import Top100PosterSheet from "@components/top100/Top100PosterSheet";
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
import usePosterCorner from "@hooks/usePosterCorner";
import { SEARCH_DEBOUNCE_MS } from "../../utils/searchDebounce";

const MEDALS = ["#F5B70A", "#A8B0BC", "#CD7F42"];
const RANK_FILL = "#5B6B80"; // 4. sıradan itibaren rozet dolgusu (arduvaz)
const HYPE = "#F97316";
const FILTERS = ["all", "movie", "tv"];
const COLUMNS = 4;
const GAP = 10;
const SIDE = 16; // GameScreenShell içerik dolgusu

// Afişin altında yalnız sıra rozeti + oy sayısı: dokunuş seçenek sayfasını açar (Bilgi · Seçim yap · İptal et; Top100PosterSheet).
const Cell = React.memo(function Cell({ row, width, hyped, copy, theme, getTmdbUrl, onPress }) {
  const corner = usePosterCorner("fun");
  const radius = corner(10);
  const height = width * 1.5;
  const medal = row.rank && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  const label = row.rank ? String(row.rank) : "–";
  return (
    <GlassTouchable
      glass={false}
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityState={{ selected: hyped }}
      accessibilityLabel={copy.cellA11y(row.rank, row.title, row.votes)}
      accessibilityHint={copy.menuA11y(row.title)}
      style={{ width }}
    >
      <View style={[styles.poster, { width, height, borderRadius: radius, backgroundColor: theme.border }]}>
        {row.poster_path ? (
          <Image
            source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            recyclingKey={row.key}
          />
        ) : null}
        {hyped ? (
          <>
            {/* Kenar çerçevesi görselin ÜSTÜNDE ayrı katman: 2:3 afiş oranı bozulmaz (shareKit PosterEdge dersi). */}
            <View pointerEvents="none" style={[styles.hypedBorder, { borderRadius: radius }]} />
            <View pointerEvents="none" style={styles.hypedMark}>
              <AppIcon family="Ionicons" name="flame" size={10} color="#FFFFFF" />
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.cellFoot}>
        <View style={[styles.rankBadge, { backgroundColor: medal || (hyped ? HYPE : RANK_FILL) }]}>
          <Text
            style={[styles.rankText, label.length > 2 && styles.rankTextSmall, medal && styles.rankTextMedal]}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
        <View style={styles.votesRow}>
          <AppIcon family="Ionicons" name="people" size={10} color={hyped ? HYPE : theme.text.muted} />
          <Text
            style={[styles.votesText, { color: hyped ? theme.text.primary : theme.text.secondary }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {copy.num(row.votes)}
          </Text>
        </View>
      </View>
    </GlassTouchable>
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
  const [menuRow, setMenuRow] = useState(null); // seçenek sayfasındaki afiş
  const menuAction = useRef(null); // sayfa kapanınca çalışacak iş: { action, row }
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

  // Afiş dokunuşu → seçenek sayfası. Seçilen iş sayfa kapandıktan SONRA çalışır (onMenuDismissed): yükseltme sayfası
  // da bir Modal ve iOS kapanmakta olan Modal'ın üstüne ikincisini sunamaz; detay geçişi de perdenin arkasında kalmaz.
  const openMenu = useCallback((row) => {
    triggerHaptic("selection");
    menuAction.current = null;
    setMenuRow(row);
  }, []);

  const onMenuAction = (action) => {
    if (!menuRow) return;
    menuAction.current = { action, row: menuRow };
    setMenuRow(null);
  };

  const onMenuDismissed = () => {
    const pendingAction = menuAction.current;
    menuAction.current = null;
    if (!pendingAction) return;
    if (pendingAction.action === "info") openDetails(pendingAction.row);
    else if (pendingAction.action === "vote") onHype(pendingAction.row);
  };

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
  const budgetFull = voteLimit > 0 && used >= voteLimit;

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.hero}>
        <LinearGradient
          colors={["#3A1D07", "#1C1009", "#0F0A08"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Sağ üstte kehribar ışıma + ince üst parıltı: düz turuncu yerine derinlikli, koyu kart. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(245,158,11,0.46)", "rgba(245,158,11,0.10)", "rgba(245,158,11,0)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.heroSheen} />

        <View style={styles.heroTop}>
          <View style={styles.heroChip}>
            <AppIcon family="Ionicons" name="trophy" size={12} color="#FCD34D" />
            <Text style={styles.heroEyebrow} numberOfLines={1}>
              {copy.eyebrow}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
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
            <AppIcon family="Ionicons" name="alert-circle-outline" size={19} color="#FFFFFF" />
          </GlassTouchable>
        </View>

        <View style={styles.heroMain}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {copy.widgetTitle}
            </Text>
            <Text style={styles.heroBody} numberOfLines={3}>
              {copy.heroBody}
            </Text>
          </View>
          {/* İlk üç: ortada 1., solda 2., sağda 3. — yelpaze. */}
          <View style={styles.podium} pointerEvents="none">
            {[1, 0, 2].map((index) => {
              const row = ranked[index];
              const front = index === 0;
              return (
                <View
                  key={index}
                  style={[
                    styles.podiumPoster,
                    front ? styles.podiumFront : index === 1 ? styles.podiumLeft : styles.podiumRight,
                    { borderColor: MEDALS[index] },
                  ]}
                >
                  {row?.poster_path ? (
                    <Image
                      source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={160}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {showTotal || budgetText ? (
          <View style={styles.heroStats}>
            {showTotal ? (
              <View style={styles.heroPill}>
                <AppIcon family="Ionicons" name="people" size={12} color="#FDE68A" />
                <Text style={styles.heroPillText}>{copy.totalVotes(totalVotes)}</Text>
              </View>
            ) : null}
            {budgetText ? (
              <View style={[styles.heroPill, budgetFull && styles.heroPillFull, voteLimit > 0 && styles.heroBudget]}>
                <AppIcon family="Ionicons" name="flame" size={12} color={budgetFull ? "#FCA5A5" : "#FDBA74"} />
                <Text style={styles.heroPillText}>{budgetText}</Text>
                {voteLimit > 0 ? (
                  <View style={styles.budgetTrack}>
                    <View
                      style={[
                        styles.budgetFill,
                        { width: `${Math.min(100, (used / voteLimit) * 100)}%` },
                        budgetFull && { backgroundColor: "#F87171" },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.heroActions}>
          {[
            { mode: "save", icon: "bookmark", label: copy.saveList, primary: true },
            { mode: "chat", icon: "paper-plane", label: copy.sendChat },
          ].map((action) => (
            <GlassTouchable
              key={action.mode}
              glass={false}
              disabled={!ranked.length}
              onPress={() => openCount(action.mode)}
              accessibilityRole="button"
              style={[styles.heroBtn, action.primary && styles.heroBtnPrimary, !ranked.length && { opacity: 0.5 }]}
            >
              <AppIcon family="Ionicons" name={action.icon} size={15} color={action.primary ? "#1F1300" : "#FFFFFF"} />
              <Text style={[styles.heroBtnText, action.primary && styles.heroBtnTextPrimary]} numberOfLines={1}>
                {action.label}
              </Text>
            </GlassTouchable>
          ))}
        </View>
      </View>

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
      <LensLoader size="screen" color={theme.accent} />
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
        copy={copy}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        onPress={openMenu}
      />
    ),
    [cellWidth, myHype, copy, theme, getTmdbUrl, openMenu],
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

      <Top100PosterSheet
        visible={!!menuRow}
        row={menuRow}
        hyped={!!(menuRow && myHype[menuRow.key])}
        locked={!canVote}
        copy={copy}
        getTmdbUrl={getTmdbUrl}
        onAction={onMenuAction}
        onClose={() => setMenuRow(null)}
        onDismissed={onMenuDismissed}
      />

      <SaveSharedListModal visible={!!saveTarget} post={saveTarget} onClose={() => setSaveTarget(null)} />

      <ShareToChatSheet visible={!!chatShare} share={chatShare} onClose={() => setChatShare(null)} />
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: 14 },
  gridRow: { gap: GAP },
  headerWrap: { gap: 12, marginBottom: 6 },
  hero: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.22)",
    backgroundColor: "#1C1009",
  },
  heroSheen: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(251,191,36,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.30)",
  },
  heroEyebrow: { color: "#FCD34D", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  heroMain: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: "#FFFFFF", fontSize: 21, lineHeight: 25, fontWeight: "900", letterSpacing: -0.4 },
  heroBody: { color: "rgba(255,237,213,0.72)", fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 6 },
  // İlk üç afiş yelpazesi: 1. önde ve büyük, 2. solda, 3. sağda; çerçeve madalya renginde.
  podium: { width: 116, height: 96 },
  podiumPoster: {
    position: "absolute",
    borderRadius: 9,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  podiumFront: { left: 30, top: 0, width: 56, height: 84, zIndex: 2, elevation: 4 },
  podiumLeft: { left: 0, top: 14, width: 46, height: 69, transform: [{ rotate: "-10deg" }], opacity: 0.92 },
  podiumRight: { right: 0, top: 14, width: 46, height: 69, transform: [{ rotate: "10deg" }], opacity: 0.92 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroPillText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  // Hak çubuğu: metnin yanında ince doluluk göstergesi.
  heroBudget: { paddingRight: 12 },
  budgetTrack: { width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.14)", overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 3, backgroundColor: "#FB923C" },
  // Hak doldu: hap koyu kırmızıya döner.
  heroPillFull: { backgroundColor: "rgba(127,29,29,0.45)", borderColor: "rgba(248,113,113,0.35)" },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroBtnPrimary: { backgroundColor: "#FBBF24", borderColor: "#FCD34D" },
  heroBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", flexShrink: 1 },
  heroBtnTextPrimary: { color: "#1F1300" },
  searchField: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  searchBox: { borderRadius: 16, borderWidth: 1 },
  searchInput: { flex: 1, height: "100%", fontSize: 15, padding: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  filters: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: "800" },

  poster: { borderRadius: 10, overflow: "hidden" },
  hypedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: HYPE,
  },
  hypedMark: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: HYPE,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 5,
  },
  rankBadge: {
    minWidth: 18,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"], includeFontPadding: false },
  rankTextSmall: { fontSize: 9 },
  rankTextMedal: { color: "#1F1300", fontWeight: "900" },
  votesRow: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1, minWidth: 0 },
  votesText: { flexShrink: 1, fontSize: 10.5, fontWeight: "700", fontVariant: ["tabular-nums"], includeFontPadding: false },

  state: { alignItems: "center", gap: 10, paddingVertical: 40 },
  stateText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  retry: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: "900" },
});
