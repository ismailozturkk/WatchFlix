// components/favorites/FavoritePickerSheet.js
//
// Favori seçici alt sayfası: arama + (sorgu yokken) öneriler. Film, dizi ve
// oyuncu için AYNI sayfa; kategori `kind` ile gelir.
//
// Seçimler ANINDA uygulanır (`onToggle`) ve sayfa açık kalır — kullanıcı 4'e
// kadar arka arkaya seçebilsin. Kategori dolunca seçili olmayan satırlar söner;
// seçili olanlara dokunmak yine çıkarır (değiştirmenin yolu bu).
//
// Önerilen liste sayfa AÇILDIĞINDA bir kez kurulur (o anki seçimlere göre):
// her dokunuşta yeniden kurulsaydı liste parmağın altından kayardı. Seçilmişler
// listede kalır ve tikli görünür.
//
// Dil ve API anahtarı bağlamdan okunur; onboarding dahil her yerde aynı sayfa.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import { MAX_FAVORITES, countFavorites, isFavorite, isKindFull } from "../../utils/fourFavorites";
import {
  MIN_SEARCH_CHARS,
  fetchPickerSuggestions,
  searchFavorites,
} from "../../services/fourFavoritesService";
import FavoriteArt from "./FavoriteArt";

const SEARCH_DEBOUNCE_MS = 350;
const ART_W = 46;

const VARIANT_LABEL_KEY = {
  basedOnPicks: "basedOnPicks",
  castOfPicks: "castOfPicks",
  popular: "popular",
};

function PickerRow({ row, kind, selected, blocked, theme, accent, onPress, copy }) {
  const onAccent = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  const { entry } = row;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={blocked}
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: blocked }}
      accessibilityLabel={selected ? copy.picker.removeLabel(entry.title) : copy.picker.add(entry.title)}
      style={[
        styles.row,
        {
          backgroundColor: selected ? alpha(accent, 0.12) : theme.secondary,
          borderColor: selected ? alpha(accent, 0.6) : theme.border,
          opacity: blocked ? 0.4 : 1,
        },
      ]}
    >
      <FavoriteArt
        path={entry.image}
        kind={kind}
        width={ART_W}
        height={kind === "people" ? ART_W : Math.round(ART_W * 1.5)}
        radius={10}
      />
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.text.primary }]}>
          {entry.title}
        </Text>
        {!!row.subtitle && (
          <Text numberOfLines={1} style={[styles.rowSub, { color: theme.text.muted }]}>
            {row.subtitle}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.mark,
          selected
            ? { backgroundColor: accent, borderColor: accent }
            : { borderColor: alpha(theme.text.muted, 0.5) },
        ]}
      >
        <Ionicons
          name={selected ? "checkmark" : "add"}
          size={15}
          color={selected ? onAccent : theme.text.muted}
        />
      </View>
    </TouchableOpacity>
  );
}

/**
 * @param {boolean} props.visible
 * @param {"movies"|"shows"|"people"|null} props.kind
 * @param {object} props.favorites                       anlık seçimler
 * @param {(kind:string, entry:object)=>void} props.onToggle
 * @param {()=>void} props.onClose
 */
export default function FavoritePickerSheet({ visible, kind, favorites, onToggle, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const copy = getFavoritesCopy(language);
  const accent = theme.accent;
  const onAccent = isLightSurface(accent) ? "#111827" : "#FFFFFF";

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ status: "idle", rows: [] });
  const [suggest, setSuggest] = useState({ status: "idle", variant: "popular", rows: [] });

  // Kapanış animasyonu sürerken (~260 ms) sayfa çizilmeye devam ediyor; kategori
  // sıfırlanınca başlık/liste boşalmasın diye son geçerli kategoriyi tut.
  const lastKind = useRef(kind);
  if (kind) lastKind.current = kind;
  const activeKind = kind || lastKind.current || "movies";
  const kindCopy = copy.kinds[activeKind];

  // Açılış anındaki seçimler öneri kurulumu için sabitlenir (bkz. dosya başlığı).
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  // Öneri ve arama AYRI sıra sayaçlarında: ortak olsaydı, öneriler gelmeden yazıp
  // silen kullanıcıda gelen öneri "eski" sayılıp atılır, liste hep yükleniyor kalırdı.
  const suggestSeq = useRef(0);
  const searchSeq = useRef(0);
  const [searchTick, setSearchTick] = useState(0);

  const loadSuggestions = useCallback(() => {
    if (!kind) return;
    const seq = ++suggestSeq.current;
    setSuggest((current) => ({ ...current, status: "loading" }));
    fetchPickerSuggestions({
      kind,
      favorites: favoritesRef.current,
      apiKey: API_KEY,
      language,
    })
      .then((data) => {
        if (seq === suggestSeq.current) setSuggest({ status: "ready", ...data });
      })
      .catch(() => {
        if (seq === suggestSeq.current) setSuggest({ status: "error", variant: "popular", rows: [] });
      });
  }, [API_KEY, kind, language]);

  // Sayfa açılınca: sorguyu sıfırla, önerileri kur.
  useEffect(() => {
    if (!visible || !kind) return;
    setQuery("");
    setSearch({ status: "idle", rows: [] });
    setSuggest({ status: "loading", variant: "popular", rows: [] });
    loadSuggestions();
    // Yalnız açılış/kategori değişiminde; seçimler değişince yeniden kurulmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, kind]);

  // Arama (debounce). Eski yanıt yenisini ezmesin diye sıra numarası.
  const text = query.trim();
  useEffect(() => {
    if (!visible || !kind) return undefined;
    if (text.length < MIN_SEARCH_CHARS) {
      setSearch({ status: "idle", rows: [] });
      return undefined;
    }
    setSearch((current) => ({ ...current, status: "loading" }));
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      searchFavorites({ kind, query: text, apiKey: API_KEY, language })
        .then((rows) => {
          if (seq === searchSeq.current) setSearch({ status: "ready", rows });
        })
        .catch(() => {
          if (seq === searchSeq.current) setSearch({ status: "error", rows: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [API_KEY, kind, language, text, visible, searchTick]);

  const searching = text.length >= MIN_SEARCH_CHARS;
  const state = searching ? search : suggest;
  const rows = state.rows;
  const full = isKindFull(favorites, activeKind);
  const count = countFavorites(favorites, activeKind);

  const sectionLabel = searching
    ? copy.picker.results
    : copy.picker[VARIANT_LABEL_KEY[suggest.variant] || "popular"];

  const renderItem = useCallback(
    ({ item }) => {
      const selected = isFavorite(favorites, activeKind, item.entry.id);
      return (
        <PickerRow
          row={item}
          kind={activeKind}
          selected={selected}
          blocked={full && !selected}
          theme={theme}
          accent={accent}
          copy={copy}
          onPress={(entry) => onToggle(activeKind, entry)}
        />
      );
    },
    [accent, activeKind, copy, favorites, full, onToggle, theme],
  );

  const retry = () => {
    if (searching) setSearchTick((tick) => tick + 1);
    else loadSuggestions();
  };

  const empty = (() => {
    if (state.status === "loading" || state.status === "idle") {
      return <ActivityIndicator style={styles.stateBox} color={accent} />;
    }
    if (state.status === "error") {
      return (
        <View style={styles.stateBox}>
          <Ionicons name="cloud-offline-outline" size={30} color={theme.text.muted} />
          <Text style={[styles.stateText, { color: theme.text.secondary }]}>
            {searching ? copy.picker.searchError : copy.picker.loadError}
          </Text>
          <TouchableOpacity onPress={retry} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.retry, { color: accent }]}>{copy.picker.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.stateBox}>
        <Ionicons name="search-outline" size={30} color={theme.text.muted} />
        <Text style={[styles.stateText, { color: theme.text.secondary }]}>
          {copy.picker.noResults}
        </Text>
      </View>
    );
  })();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: alpha(accent, 0.14) }]}>
          <Ionicons name={kindCopy.icon} size={20} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text.primary }]}>
            {kindCopy.pickTitle}
          </Text>
          <Text style={[styles.headerSub, { color: full ? accent : theme.text.muted }]}>
            {full ? copy.picker.full : copy.counter(count, MAX_FAVORITES)}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={copy.picker.done}
          style={[styles.done, { backgroundColor: accent }]}
        >
          <Text style={[styles.doneText, { color: onAccent }]}>{copy.picker.done}</Text>
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={kindCopy.search}
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
      </View>
      {text.length > 0 && text.length < MIN_SEARCH_CHARS ? (
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.picker.typeMore}</Text>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraData={favorites}
        contentContainerStyle={rows.length ? styles.list : styles.emptyList}
        ListHeaderComponent={
          rows.length ? (
            <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{sectionLabel}</Text>
          ) : null
        }
        ListEmptyComponent={empty}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "86%",
    minHeight: "60%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSub: { marginTop: 2, fontSize: 12.5, fontWeight: "700" },
  done: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { fontSize: 13.5, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
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
  emptyList: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: "800" },
  rowSub: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  stateText: { fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  retry: { fontSize: 13.5, fontWeight: "800" },
});
