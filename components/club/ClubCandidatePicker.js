// components/club/ClubCandidatePicker.js
//
// Film Kulübü — yeni turun adaylarını seçme sayfası. Arama kutusu boşken izleme listesinden öneriler, yazınca
// TMDB film + dizi araması (ana aramayla aynı bulanık servis). 2–6 aday seçilince "Oylamayı başlat".
// Seçim kapanınca SIFIRLANMAZ (BottomSheetModal çıkış penceresi); yalnız başarıyla gönderilince temizlenir.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import LensLoader from "../LensLoader";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassField from "@components/common/GlassField";
import GlassPressable from "@components/common/GlassPressable";
import { useApiSettings, useContentSettings } from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useTheme } from "@context/ThemeContext";
import { searchMediaWithFuzzyFallback } from "@services/fuzzyMediaSearch";
import { tmdbLanguageOf } from "@utils/appLanguages";
import {
  CLUB_MAX_CANDIDATES,
  CLUB_MIN_CANDIDATES,
  candidateIdOf,
  sanitizeClubMedia,
} from "@utils/filmClub";
import { getFilmClubCopy } from "@utils/filmClubCopy";
import { GLASS_PRESS_ROOM } from "@utils/liquidGlass";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import usePosterCorner from "@hooks/usePosterCorner";
import { SEARCH_DEBOUNCE_MS } from "../../utils/searchDebounce";

export const CLUB_ACCENT = "#E8A33D";
const WATCHLIST_SUGGESTIONS = 30;

function PosterThumb({ path, width, theme }) {
  const uri = buildTmdbUrl(path, "poster", width * 2);
  const corner = usePosterCorner("fun");
  return (
    <View style={[styles.thumb, { width, height: width * 1.5, borderRadius: corner(6), backgroundColor: theme.secondary }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      ) : (
        <AppIcon family="Ionicons" name="film-outline" size={width * 0.45} color={theme.text.muted} />
      )}
    </View>
  );
}

export default function ClubCandidatePicker({ visible, onClose, onSubmit, submitting = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { adultContent } = useContentSettings();
  const { watchListItems } = useListStatusContext() || {};
  const copy = getFilmClubCopy(language);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]);
  const seqRef = useRef(0);

  const suggestions = useMemo(
    () =>
      (Array.isArray(watchListItems) ? watchListItems : [])
        .map(sanitizeClubMedia)
        .filter(Boolean)
        .slice(0, WATCHLIST_SUGGESTIONS),
    [watchListItems],
  );

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      seqRef.current += 1;
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const lang = tmdbLanguageOf(language);
      const lists = await Promise.all(
        ["movie", "tv"].map((mediaType) =>
          searchMediaWithFuzzyFallback({ mediaType, query: text, language: lang, adultContent, API_KEY })
            .then(({ results: rows }) => rows.map((row) => ({ ...row, media_type: mediaType })))
            .catch(() => []),
        ),
      );
      if (seq !== seqRef.current) return;
      // Popülerliğe göre karışık; aynı başlık iki türde çıkmaz (kimlik türle birlikte).
      const merged = lists
        .flat()
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .map(sanitizeClubMedia)
        .filter(Boolean);
      setResults(merged);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, language, adultContent, API_KEY]);

  const selectedIds = useMemo(() => new Set(selected.map(candidateIdOf)), [selected]);
  const full = selected.length >= CLUB_MAX_CANDIDATES;
  const ready = selected.length >= CLUB_MIN_CANDIDATES;
  const showingSearch = query.trim().length >= 2;
  const rows = showingSearch ? results : suggestions;

  const toggle = (media) => {
    const id = candidateIdOf(media);
    setSelected((prev) => {
      if (prev.some((item) => candidateIdOf(item) === id)) return prev.filter((item) => candidateIdOf(item) !== id);
      if (prev.length >= CLUB_MAX_CANDIDATES) return prev;
      return [...prev, media];
    });
  };

  const submit = async () => {
    if (!ready || submitting) return;
    const ok = await onSubmit?.(selected);
    if (ok) {
      setSelected([]);
      setQuery("");
    }
  };

  const renderRow = ({ item }) => {
    const picked = selectedIds.has(candidateIdOf(item));
    const disabled = !picked && full;
    const year = item.release_date ? item.release_date.slice(0, 4) : "";
    return (
      <GlassPressable
        glass={false}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: picked, disabled }}
        accessibilityLabel={year ? `${item.title}, ${year}` : item.title}
        onPress={() => toggle(item)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: theme.border },
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <PosterThumb path={item.poster_path} width={38} theme={theme} />
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text.primary }]}>
            {item.title}
          </Text>
          <View style={styles.rowMeta}>
            <AppIcon
              family="Ionicons"
              name={item.media_type === "tv" ? "tv-outline" : "film-outline"}
              size={12}
              color={theme.text.muted}
            />
            {year ? <Text style={[styles.rowSub, { color: theme.text.muted }]}>{year}</Text> : null}
          </View>
        </View>
        <AppIcon
          family="Ionicons"
          name={picked ? "checkmark-circle" : "add-circle-outline"}
          size={24}
          color={picked ? CLUB_ACCENT : theme.text.muted}
        />
      </GlassPressable>
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>{copy.pickerTitle}</Text>
          <Text style={[styles.hint, { color: theme.text.muted }]}>
            {copy.pickerHint(CLUB_MIN_CANDIDATES, CLUB_MAX_CANDIDATES)}
          </Text>
        </View>
        <GlassCloseButton
          size={36}
          fallbackRadius={18}
          iconSize={21}
          color={theme.text.primary}
          backgroundColor={theme.secondary}
          onPress={onClose}
        />
      </View>

      {selected.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
        >
          {selected.map((item) => (
            <GlassPressable
              key={candidateIdOf(item)}
              glass={false}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} ×`}
              onPress={() => toggle(item)}
              style={styles.chip}
            >
              <PosterThumb path={item.poster_path} width={46} theme={theme} />
              <View style={[styles.chipX, { backgroundColor: CLUB_ACCENT }]}>
                <AppIcon family="Ionicons" name="close" size={11} color="#fff" />
              </View>
            </GlassPressable>
          ))}
        </ScrollView>
      ) : null}

      <GlassField
        height={44}
        focused={focused}
        accent={CLUB_ACCENT}
        fallbackStyle={[styles.searchBox, { backgroundColor: theme.secondary, borderColor: focused ? CLUB_ACCENT : theme.border }]}
        style={styles.searchField}
      >
        <AppIcon family="Ionicons" name="search" size={16} color={focused ? CLUB_ACCENT : theme.text.muted} />
        <TextInput
          allowFontScaling={false}
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder={copy.search}
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching ? <LensLoader size="small" color={CLUB_ACCENT} /> : null}
      </GlassField>

      {!showingSearch && suggestions.length ? (
        <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{copy.fromWatchlist}</Text>
      ) : null}

      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={candidateIdOf}
        renderItem={renderRow}
        extraData={selectedIds}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          showingSearch && !searching ? (
            <Text style={[styles.empty, { color: theme.text.muted }]}>{copy.noResults}</Text>
          ) : null
        }
      />

      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready || submitting }}
        disabled={!ready || submitting}
        onPress={submit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: ready ? CLUB_ACCENT : theme.secondary },
          pressed && styles.pressed,
        ]}
      >
        {submitting ? (
          <LensLoader tone="mono" color="#fff" />
        ) : (
          <>
            <Text style={[styles.submitText, { color: ready ? "#fff" : theme.text.muted }]}>{copy.startVoting}</Text>
            <Text style={[styles.submitCount, { color: ready ? "rgba(255,255,255,0.85)" : theme.text.muted }]}>
              {copy.selected(selected.length, CLUB_MAX_CANDIDATES)}
            </Text>
          </>
        )}
      </GlassPressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
    minHeight: "60%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900" },
  hint: { fontSize: 12.5, fontWeight: "650", marginTop: 2 },
  // Basılan cam çip satırın kırpma sınırında kesilmesin (utils/liquidGlass GLASS_PRESS_ROOM).
  chipScroll: { flexGrow: 0, marginVertical: -GLASS_PRESS_ROOM + 2 },
  chips: { gap: 8, paddingVertical: GLASS_PRESS_ROOM },
  chip: { position: "relative" },
  chipX: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { width: "100%", height: "100%" },
  thumb: { borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  searchField: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  searchBox: { borderRadius: 22, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 0 },
  sectionLabel: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  list: { flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  rowSub: { fontSize: 12, fontWeight: "700" },
  empty: { textAlign: "center", fontSize: 13, fontWeight: "700", paddingVertical: 24 },
  submit: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  submitText: { fontSize: 16, fontWeight: "900" },
  submitCount: { fontSize: 11.5, fontWeight: "800", marginTop: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
