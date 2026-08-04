// components/comments/CommentScopeSheet.js
//
// Kapsam seçici: dizi geneli → sezonlar → bölümler ağacı.
// İki modda çalışır:
//   mode="filter" → hangi kapsamın yorumları LİSTELENECEK (Tümü / Yalnız sezon
//                   geneli seçenekleri de burada)
//   mode="target" → yazılacak yorum NEREYE referans verecek
//
// RN <Modal> İÇİNE gömülü bir <Modal> AÇMAZ: yorum sayfası zaten bir modal
// içinde yaşıyor ve iç içe modal Android'de kapanma/klavye sorunları çıkarıyor.
// Bunun yerine yorum bileşeninin üstüne mutlak konumlu bir katman serilir.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Pressable,
  BackHandler,
} from "react-native";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { i18nText } from "../../utils/i18nText";
import {
  COMMENT_SCOPE,
  SCOPE_FILTER,
  ALL_SCOPE_FILTER,
  makeScopeFilter,
  normalizeScope,
  scopeKey,
  seasonBucket,
} from "../../utils/commentScope";
import { episodeRowLabel, seasonRowLabel } from "./scopeTexts";

// Bölüm listeleri oturum boyunca bellekte tutulur — aynı sezonu tekrar açmak
// yeni bir TMDB isteği doğurmaz. (axios cevap önbelleği ayrıca diske yazar.)
const episodeCache = new Map(); // `${showId}:${season}:${lang}` → episodes[]
const EPISODE_CACHE_MAX = 120; // ~10 dizi × 12 sezon; en eski kayıt düşer

const cacheEpisodes = (key, episodes) => {
  if (episodeCache.size >= EPISODE_CACHE_MAX) {
    const oldest = episodeCache.keys().next().value;
    if (oldest !== undefined) episodeCache.delete(oldest);
  }
  episodeCache.set(key, episodes);
};

const filterKeyOf = (filter) => {
  const f = filter || ALL_SCOPE_FILTER;
  if (f.type === SCOPE_FILTER.SHOW) return "show";
  if (f.type === SCOPE_FILTER.SEASON) return `s${f.seasonNumber}`;
  if (f.type === SCOPE_FILTER.SEASON_ONLY) return `s${f.seasonNumber}only`;
  if (f.type === SCOPE_FILTER.EPISODE)
    return `s${f.seasonNumber}e${f.episodeNumber}`;
  return "all";
};

const Row = ({
  theme,
  label,
  sublabel,
  count,
  icon,
  iconColor,
  selected,
  indent,
  onPress,
  right,
}) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={[
      styles.row,
      indent && styles.rowIndent,
      { borderColor: theme.border },
      selected && {
        backgroundColor: alpha(theme.accent, 0.14),
        borderColor: alpha(theme.accent, 0.45),
      },
    ]}
  >
    <View
      style={[
        styles.rowIcon,
        { backgroundColor: alpha(iconColor || theme.accent, 0.16) },
      ]}
    >
      <Ionicons name={icon} size={14} color={iconColor || theme.accent} />
    </View>

    <View style={styles.rowBody}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.rowLabel, { color: theme.text.primary }]}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.rowSublabel, { color: theme.text.muted }]}
        >
          {sublabel}
        </Text>
      ) : null}
    </View>

    {count > 0 && (
      <View style={[styles.rowCount, { backgroundColor: alpha(theme.accent, 0.18) }]}>
        <Ionicons name="chatbubble" size={9} color={theme.accent} />
        <Text allowFontScaling={false} style={[styles.rowCountText, { color: theme.accent }]}>
          {count}
        </Text>
      </View>
    )}

    {selected && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
    {right}
  </TouchableOpacity>
);

export default function CommentScopeSheet({
  visible,
  onClose,
  mode = "filter",
  theme,
  showId,
  seasons = [],
  summary,
  value,
  onSelect,
}) {
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const slide = useRef(new Animated.Value(1)).current;

  const [expanded, setExpanded] = useState({});
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [loadingSeason, setLoadingSeason] = useState({});
  const [mounted, setMounted] = useState(visible);
  // Kapanış ötelemesi sabit olamaz: panel içeriğe göre büyür (ekranın %88'ine
  // kadar). Sabit 480px'te uzun panelin üst kısmı ekranda asılı kalırdı.
  const [panelHeight, setPanelHeight] = useState(480);

  const isFilterMode = mode === "filter";
  const currentKey = isFilterMode ? filterKeyOf(value) : scopeKey(value);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(slide, {
      toValue: visible ? 0 : 1,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, slide]);

  const loadEpisodes = useCallback(
    async (seasonNumber) => {
      const key = `${showId}:${seasonNumber}:${language}`;
      const cached = episodeCache.get(key);
      if (cached) {
        setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: cached }));
        return;
      }
      setLoadingSeason((prev) => ({ ...prev, [seasonNumber]: true }));
      try {
        const res = await axios.get(
          `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        const episodes = (res.data?.episodes || [])
          .filter((e) => Number.isFinite(Number(e?.episode_number)))
          .map((e) => ({
            episodeNumber: Number(e.episode_number),
            name: e.name || "",
          }));
        cacheEpisodes(key, episodes);
        setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: episodes }));
      } catch {
        // Ağ hatası: bölüm sayısından türetilen yedek liste zaten gösteriliyor.
      } finally {
        setLoadingSeason((prev) => ({ ...prev, [seasonNumber]: false }));
      }
    },
    [showId, language, API_KEY],
  );

  // Android geri tuşu: bu katman bir <Modal> OLMADIĞI için geri tuşunu dıştaki
  // yorum modalı yakalar ve bütün sayfayı (yazılmış taslakla birlikte) kapatırdı.
  // Katman açıkken olayı burada yutup yalnız katmanı kapatıyoruz.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose?.();
      return true;
    });
    return () => (sub && sub.remove ? sub.remove() : undefined);
  }, [visible, onClose]);

  // Açılışta seçili sezonu genişlet — kullanıcı nerede olduğunu görsün.
  useEffect(() => {
    if (!visible) return;
    const season = isFilterMode
      ? value?.seasonNumber
      : normalizeScope(value).seasonNumber;
    if (season == null) return;
    setExpanded((prev) => ({ ...prev, [season]: true }));
    loadEpisodes(season);
    // value referansı her açılışta yeniden kurulabilir; yalnız görünürlükte çalış.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Yan etki (fetch) setState güncelleyicisinin İÇİNDE tetiklenmez —
  // StrictMode güncelleyiciyi iki kez çağırabilir.
  const toggleSeason = useCallback(
    (seasonNumber) => {
      const willOpen = !expanded[seasonNumber];
      setExpanded((prev) => ({ ...prev, [seasonNumber]: !prev[seasonNumber] }));
      if (willOpen) loadEpisodes(seasonNumber);
    },
    [expanded, loadEpisodes],
  );

  const emit = useCallback(
    (scopeType, seasonNumber, episodeNumber, title) => {
      if (isFilterMode) {
        onSelect?.(makeScopeFilter(scopeType, seasonNumber, episodeNumber));
      } else {
        const scope =
          scopeType === SCOPE_FILTER.SHOW || scopeType === SCOPE_FILTER.ALL
            ? COMMENT_SCOPE.SHOW
            : scopeType === SCOPE_FILTER.EPISODE
              ? COMMENT_SCOPE.EPISODE
              : COMMENT_SCOPE.SEASON;
        onSelect?.(
          normalizeScope({
            scope,
            seasonNumber,
            episodeNumber,
            scopeTitle: title || null,
          }),
        );
      }
      onClose?.();
    },
    [isFilterMode, onSelect, onClose],
  );

  if (!mounted) return null;

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, panelHeight],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent?.layout?.height || 0;
          if (h > 0 && Math.abs(h - panelHeight) > 1) setPanelHeight(h);
        }}
        style={[
          styles.panel,
          {
            backgroundColor: theme.primary,
            borderColor: theme.border,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Ionicons
              name={isFilterMode ? "funnel" : "locate"}
              size={16}
              color={theme.accent}
            />
            <Text
              allowFontScaling={false}
              style={[styles.headerTitle, { color: theme.text.primary }]}
            >
              {isFilterMode
                ? i18nText("autoI18n.kapsami_filtrele", "Kapsamı filtrele")
                : i18nText("autoI18n.yorum_hedefi_sec", "Yorum hedefi seç")}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={theme.text.muted} />
          </TouchableOpacity>
        </View>

        <Text
          allowFontScaling={false}
          style={[styles.headerHint, { color: theme.text.muted }]}
        >
          {isFilterMode
            ? i18nText(
                "autoI18n.kapsam_filtre_ipucu",
                "Dizinin geneli, tek bir sezon veya tek bir bölüm — yorumları o kısma göre süz.",
              )
            : i18nText(
                "autoI18n.kapsam_hedef_ipucu",
                "Bölüm sayfasına girmeden buradan sezon veya bölüm seçip yorum yazabilirsin.",
              )}
        </Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isFilterMode && (
            <Row
              theme={theme}
              icon="apps"
              label={i18nText("autoI18n.tum_yorumlar", "Tüm yorumlar")}
              count={summary?.total ?? 0}
              selected={currentKey === "all"}
              onPress={() => emit(SCOPE_FILTER.ALL)}
            />
          )}

          <Row
            theme={theme}
            icon="tv"
            iconColor={theme.accent}
            label={i18nText("autoI18n.dizi_geneli", "Dizi geneli")}
            sublabel={i18nText(
              "autoI18n.dizi_geneli_aciklama",
              "Sezon/bölüm ayırmadan dizinin bütünü",
            )}
            count={summary?.show ?? 0}
            selected={currentKey === "show"}
            onPress={() => emit(SCOPE_FILTER.SHOW)}
          />

          {seasons.length > 0 && (
            <Text
              allowFontScaling={false}
              style={[styles.groupTitle, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.sezonlar", "Sezonlar")}
            </Text>
          )}

          {seasons.map((season) => {
            const sn = season.seasonNumber;
            const bucket = seasonBucket(summary, sn);
            const isOpen = !!expanded[sn];
            // Ağ cevabı gelene kadar bölüm sayısından yedek liste kurulur;
            // isim gelince yerine geçer.
            const fetched = episodesBySeason[sn];
            const fallback =
              season.episodeCount > 0
                ? Array.from({ length: season.episodeCount }, (_, i) => ({
                    episodeNumber: i + 1,
                    name: "",
                  }))
                : [];
            const episodes = fetched?.length ? fetched : fallback;
            // Yorumu olup listede olmayan bölümler (TMDB listesi değişmiş
            // olabilir) düşmesin.
            const extra = bucket.episodes
              .filter((e) => !episodes.some((x) => x.episodeNumber === e.episodeNumber))
              .map((e) => ({ episodeNumber: e.episodeNumber, name: e.title || "" }));
            const allEpisodes = [...episodes, ...extra].sort(
              (a, b) => a.episodeNumber - b.episodeNumber,
            );

            return (
              <View key={`scope-sheet-season-${sn}`}>
                <Row
                  theme={theme}
                  icon="albums"
                  iconColor={theme.colors?.orange || theme.accent}
                  label={seasonRowLabel(sn, season.name)}
                  sublabel={
                    season.episodeCount > 0
                      ? i18nText("autoI18n.bolum_sayisi", "{count} bölüm").replace(
                          /\{\{?\s*count\s*\}?\}/g,
                          String(season.episodeCount),
                        )
                      : null
                  }
                  count={bucket.total}
                  selected={currentKey === `s${sn}`}
                  onPress={() => emit(SCOPE_FILTER.SEASON, sn, null, season.name)}
                  right={
                    <TouchableOpacity
                      onPress={() => toggleSeason(sn)}
                      hitSlop={10}
                      style={styles.expandButton}
                    >
                      {loadingSeason[sn] ? (
                        <ActivityIndicator size="small" color={theme.text.muted} />
                      ) : (
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={theme.text.muted}
                        />
                      )}
                    </TouchableOpacity>
                  }
                />

                {isOpen && (
                  <View style={styles.subList}>
                    {isFilterMode && (
                      <Row
                        theme={theme}
                        indent
                        icon="albums-outline"
                        iconColor={theme.colors?.orange || theme.accent}
                        label={i18nText(
                          "autoI18n.yalniz_sezon_geneli",
                          "Yalnız sezon geneli",
                        )}
                        count={bucket.seasonOnly}
                        selected={currentKey === `s${sn}only`}
                        onPress={() => emit(SCOPE_FILTER.SEASON_ONLY, sn)}
                      />
                    )}
                    {allEpisodes.length === 0 && !loadingSeason[sn] && (
                      <Text
                        allowFontScaling={false}
                        style={[styles.emptyEpisodes, { color: theme.text.muted }]}
                      >
                        {i18nText("autoI18n.bolum_bulunamadi", "Bölüm bulunamadı.")}
                      </Text>
                    )}
                    {allEpisodes.map((episode) => {
                      const epCount =
                        bucket.episodes.find(
                          (e) => e.episodeNumber === episode.episodeNumber,
                        )?.count || 0;
                      return (
                        <Row
                          key={`scope-sheet-episode-${sn}-${episode.episodeNumber}`}
                          theme={theme}
                          indent
                          icon="play-circle"
                          iconColor={theme.colors?.green || theme.accent}
                          label={episodeRowLabel(episode.episodeNumber)}
                          sublabel={episode.name || null}
                          count={epCount}
                          selected={currentKey === `s${sn}e${episode.episodeNumber}`}
                          onPress={() =>
                            emit(
                              SCOPE_FILTER.EPISODE,
                              sn,
                              episode.episodeNumber,
                              episode.name,
                            )
                          }
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.55)" },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: "800" },
  headerHint: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    fontSize: 11.5,
    lineHeight: 16,
  },

  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 12, paddingBottom: 24, gap: 6 },
  groupTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 2,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIndent: { marginLeft: 18 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 13.5, fontWeight: "700" },
  rowSublabel: { fontSize: 11, marginTop: 2 },
  rowCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  rowCountText: { fontSize: 10, fontWeight: "800" },
  expandButton: { paddingHorizontal: 4, paddingVertical: 2 },

  subList: { gap: 6, marginTop: 6 },
  emptyEpisodes: { fontSize: 11.5, paddingHorizontal: 26, paddingVertical: 8 },
});
