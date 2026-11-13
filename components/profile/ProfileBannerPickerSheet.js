// components/profile/ProfileBannerPickerSheet.js
//
// Profil kapağı seçici: iki adımlı alt sayfa.
//   1) Film / Dizi seç (arama; sorgu yokken önce kendi dört favorin, sonra popüler)
//   2) O yapımın sahne görsellerinden (TMDB backdrops) birini seç → onSelect
//
// Seçim yalnız düzenleme taslağına gider; profil ✓ (Kaydet) ile yazılır.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import LensLoader from "../LensLoader";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassBox from "../common/GlassBox";
import GlassPressable from "../common/GlassPressable";
import FavoriteArt from "../favorites/FavoriteArt";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings, useImageQualitySettings } from "../../context/AppSettingsContext";
import { alpha } from "../../theme/colors";
import { emptyFavorites, normalizeFavorites } from "../../utils/fourFavorites";
import { MIN_SEARCH_CHARS, fetchPickerSuggestions, searchFavorites } from "../../services/fourFavoritesService";
import { fetchBannerCandidates } from "../../services/profileBannerService";
import { getProfileBannerCopy } from "../../utils/profileBannerCopy";
import { SEARCH_DEBOUNCE_MS } from "../../utils/searchDebounce";
import BetaBadge from "../common/BetaBadge";
import { isBetaFeature } from "../../utils/betaFeatures";

const ART_W = 42;
const KIND_TYPE = { movies: "movie", shows: "tv" };
const SHEET_PAD = 16;

function StateBox({ status, theme, accent, copy, emptyText, onRetry }) {
  if (status === "loading" || status === "idle") return <LensLoader style={styles.stateBox} color={accent} />;
  return (
    <View style={styles.stateBox}>
      <Ionicons
        name={status === "error" ? "cloud-offline-outline" : "image-outline"}
        size={30}
        color={theme.text.muted}
      />
      <Text style={[styles.stateText, { color: theme.text.secondary }]}>
        {status === "error" ? copy.loadError : emptyText}
      </Text>
      {status === "error" ? (
        <TouchableOpacity onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.retry, { color: accent }]}>{copy.retry}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Liste satırı: her satıra cam pahalı (bkz. glassCoverageGuard), düz yüzey.
function TitleRow({ item, kind, active, theme, accent, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(item.entry)}
      accessibilityRole="button"
      accessibilityLabel={item.entry.title}
      style={[
        styles.row,
        {
          backgroundColor: active ? alpha(accent, 0.12) : theme.secondary,
          borderColor: active ? alpha(accent, 0.6) : theme.border,
        },
      ]}
    >
      <FavoriteArt
        path={item.entry.image}
        kind={kind}
        mediaId={item.entry.id}
        width={ART_W}
        height={Math.round(ART_W * 1.5)}
        radius={9}
      />
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.text.primary }]}>
          {item.entry.title}
        </Text>
        {!!item.subtitle && (
          <Text numberOfLines={1} style={[styles.rowSub, { color: theme.text.muted }]}>
            {item.subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </TouchableOpacity>
  );
}

/**
 * @param {boolean} props.visible
 * @param {object|null} props.current       taslaktaki kapak ({id,type,title,path})
 * @param {object} [props.favorites]        profilin dört favorisi (öneri için)
 * @param {(banner:object)=>void} props.onSelect
 * @param {()=>void} props.onClose
 */
export default function ProfileBannerPickerSheet({ visible, current, favorites, onSelect, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { width: windowWidth } = useWindowDimensions();
  const copy = getProfileBannerCopy(language);
  const accent = theme.accent;

  const [kind, setKind] = useState("movies");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ status: "idle", rows: [] });
  const [suggest, setSuggest] = useState({ status: "idle", rows: [] });
  const [title, setTitle] = useState(null); // 2. adım: { id, type, title }
  const [scenes, setScenes] = useState({ status: "idle", items: [] });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // Açılış: sıfırla.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setTitle(null);
    setScenes({ status: "idle", items: [] });
    setKind(current?.type === "tv" ? "shows" : "movies");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Öneriler: önce kendi favorilerin (en iyi kapak adayları), sonra popüler.
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    const own = normalizeFavorites(favoritesRef.current)[kind].map((entry) => ({
      key: `${kind}-${entry.id}`,
      entry,
      subtitle: entry.year || "",
    }));
    setSuggest({ status: own.length ? "ready" : "loading", rows: own });
    fetchPickerSuggestions({ kind, favorites: emptyFavorites(), apiKey: API_KEY, language })
      .then(({ rows }) => {
        if (!alive) return;
        const ids = new Set(own.map((row) => row.entry.id));
        setSuggest({ status: "ready", rows: [...own, ...rows.filter((row) => !ids.has(row.entry.id))] });
      })
      .catch(() => {
        if (alive) setSuggest({ status: own.length ? "ready" : "error", rows: own });
      });
    return () => {
      alive = false;
    };
  }, [API_KEY, kind, language, visible, tick]);

  // Arama (bekletmeli).
  const text = query.trim();
  useEffect(() => {
    if (!visible || text.length < MIN_SEARCH_CHARS) {
      setSearch({ status: "idle", rows: [] });
      return undefined;
    }
    setSearch((prev) => ({ ...prev, status: "loading" }));
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      searchFavorites({ kind, query: text, apiKey: API_KEY, language })
        .then((rows) => mine === seq.current && setSearch({ status: "ready", rows }))
        .catch(() => mine === seq.current && setSearch({ status: "error", rows: [] }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [API_KEY, kind, language, text, visible, tick]);

  // 2. adım: sahneler.
  useEffect(() => {
    if (!visible || !title) return undefined;
    let alive = true;
    setScenes({ status: "loading", items: [] });
    fetchBannerCandidates({ id: title.id, type: title.type, apiKey: API_KEY, language })
      .then((items) => alive && setScenes({ status: "ready", items }))
      .catch(() => alive && setScenes({ status: "error", items: [] }));
    return () => {
      alive = false;
    };
  }, [API_KEY, language, title, visible, tick]);

  const searching = text.length >= MIN_SEARCH_CHARS;
  const listState = searching ? search : suggest;
  const sceneWidth = Math.max(200, Math.min(windowWidth, 600) - SHEET_PAD * 2);
  const sceneHeight = Math.round(sceneWidth * (9 / 16));

  const openTitle = useCallback(
    (entry) => setTitle({ id: entry.id, type: KIND_TYPE[kind], title: entry.title }),
    [kind],
  );

  const pickScene = useCallback(
    (path) => {
      if (!title) return;
      onSelect?.({ id: title.id, type: title.type, title: title.title, path });
      onClose?.();
    },
    [onClose, onSelect, title],
  );

  const renderTitle = useCallback(
    ({ item }) => (
      <TitleRow
        item={item}
        kind={kind}
        active={current?.id === item.entry.id && current?.type === KIND_TYPE[kind]}
        theme={theme}
        accent={accent}
        onPress={openTitle}
      />
    ),
    [accent, current, kind, openTitle, theme],
  );

  const renderScene = useCallback(
    ({ item }) => {
      const active = current?.path === item.path;
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => pickScene(item.path)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={copy.bannerLabel(title?.title)}
          style={[
            styles.scene,
            { width: sceneWidth, height: sceneHeight, borderColor: active ? accent : "transparent" },
          ]}
        >
          <Image
            source={{ uri: getTmdbUrl(item.path, "backdrop", sceneWidth * 2) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={`banner-${item.path}`}
          />
          {active ? (
            <View style={[styles.sceneCheck, { backgroundColor: accent }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [accent, copy, current?.path, getTmdbUrl, pickScene, sceneHeight, sceneWidth, title?.title],
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        {title ? (
          <GlassPressable
            onPress={() => setTitle(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copy.back}
            style={[styles.headerIcon, { backgroundColor: alpha(accent, 0.14) }]}
          >
            <Ionicons name="chevron-back" size={20} color={accent} />
          </GlassPressable>
        ) : (
          <View style={[styles.headerIcon, { backgroundColor: alpha(accent, 0.14) }]}>
            <Ionicons name="image-outline" size={20} color={accent} />
          </View>
        )}
        <View style={styles.headerCopy}>
          <View style={styles.headerTitleRow}>
            <Text numberOfLines={1} style={[styles.headerTitle, styles.headerTitleText, { color: theme.text.primary }]}>
              {title ? title.title : copy.title}
            </Text>
            {!title && isBetaFeature("profile_banner") ? <BetaBadge featureId="profile_banner" /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.headerSub, { color: theme.text.muted }]}>
            {title
              ? scenes.status === "ready" && scenes.items.length
                ? `${copy.scenes} · ${copy.scenesSub(scenes.items.length)}`
                : copy.scenes
              : copy.subtitle}
          </Text>
        </View>
        <GlassPressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy.close}
          style={[styles.close, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Ionicons name="close" size={18} color={theme.text.primary} />
        </GlassPressable>
      </View>
    ),
    [accent, copy, onClose, scenes, theme, title],
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      {header}

      {title ? (
        <FlatList
          key="scenes"
          data={scenes.items}
          keyExtractor={(item) => item.path}
          renderItem={renderScene}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scenes.items.length ? styles.sceneList : styles.emptyList}
          ListEmptyComponent={
            <StateBox
              status={scenes.status}
              theme={theme}
              accent={accent}
              copy={copy}
              emptyText={copy.noScenes}
              onRetry={() => setTick((t) => t + 1)}
            />
          }
        />
      ) : (
        <>
          <View style={[styles.segment, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            {["movies", "shows"].map((k) => {
              const on = k === kind;
              return (
                <GlassPressable
                  key={k}
                  onPress={() => setKind(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.segmentItem, on && { backgroundColor: accent }]}
                >
                  <Ionicons
                    name={k === "movies" ? "film-outline" : "tv-outline"}
                    size={15}
                    color={on ? "#fff" : theme.text.secondary}
                  />
                  <Text style={[styles.segmentText, { color: on ? "#fff" : theme.text.secondary }]}>
                    {copy[k]}
                  </Text>
                </GlassPressable>
              );
            })}
          </View>

          <GlassBox role="field" style={[styles.search, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={kind === "movies" ? copy.searchMovies : copy.searchShows}
              placeholderTextColor={theme.text.muted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.text.primary }]}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button">
                <Ionicons name="close-circle" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            )}
          </GlassBox>
          {text.length > 0 && !searching ? (
            <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.typeMore}</Text>
          ) : null}

          <FlatList
            key="titles"
            data={listState.rows}
            keyExtractor={(item) => item.key}
            renderItem={renderTitle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={listState.rows.length ? styles.list : styles.emptyList}
            ListHeaderComponent={
              listState.rows.length ? (
                <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>
                  {searching ? copy.results : copy.suggestions}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <StateBox
                status={listState.status}
                theme={theme}
                accent={accent}
                copy={copy}
                emptyText={copy.noResults}
                onRetry={() => setTick((t) => t + 1)}
              />
            }
          />
        </>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
    minHeight: "70%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: SHEET_PAD,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitleText: { flexShrink: 1 },
  headerSub: { marginTop: 2, fontSize: 12.5, fontWeight: "700" },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, marginBottom: 10 },
  segmentItem: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentText: { fontSize: 13.5, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 0 },
  hint: { marginTop: 8, fontSize: 12, fontWeight: "600", paddingHorizontal: 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  list: { gap: 8, paddingBottom: 12 },
  sceneList: { gap: 10, paddingBottom: 16 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 16, borderWidth: 1 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: "800" },
  rowSub: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  scene: { borderRadius: 16, overflow: "hidden", borderWidth: 2.5, backgroundColor: "#111" },
  sceneCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  stateText: { fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  retry: { fontSize: 13.5, fontWeight: "800" },
});
