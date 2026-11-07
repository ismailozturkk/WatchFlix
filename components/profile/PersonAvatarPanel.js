// components/profile/PersonAvatarPanel.js
//
// Avatar seçicinin "Oyuncu & Yönetmen" sekmesi: TMDB kişi fotoğrafını avatar
// yapar. Sorgu yokken favori oyuncular → takip edilenler → popüler; sorgu
// varken arama sonuçları. Hücreye dokununca seçim NESNESİ (utils/avatarPhotos
// personAvatarChoice) `onSelect`e gider — kaydetmeyi çağıran yapar (Profil:
// hemen; Profili Düzenle: Kaydet'te).
//
// Kararlar utils/personAvatars.js'te (süzme, bölümler), veri
// services/personAvatarService.js'te.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassBox from "@components/common/GlassBox";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useUserProfile } from "@context/UserProfileContext";
import useFollowedPeople from "../../hooks/useFollowedPeople";
import { getAvatarSource } from "@utils/avatars";
import { sameAvatarChoice } from "@utils/avatarPhotos";
import { readProfileFavorites } from "@utils/fourFavorites";
import {
  PERSON_GRID_COLUMNS,
  buildPersonAvatarSections,
  chunkRows,
  personSearchState,
} from "@utils/personAvatars";
import { SEARCH_DEBOUNCE_MS } from "@utils/searchDebounce";
import { i18nText } from "@utils/i18nText";
import { fetchPopularPeople, searchPersonAvatars } from "@services/personAvatarService";

// Hücre ~76 pt; w185 kopyası yeter (avatarRenderPx ile aynı eşik).
const CELL_PX = 222;

const SECTION_TITLE = {
  favorites: () => i18nText("autoI18n.avatar_kisi_favoriler", "Favori oyuncuların"),
  followed: () => i18nText("autoI18n.avatar_kisi_takip", "Takip ettiklerin"),
  popular: () => i18nText("autoI18n.avatar_kisi_populer", "Popüler"),
  results: () => i18nText("autoI18n.avatar_kisi_sonuclar", "Sonuçlar"),
};

function departmentLabel(department) {
  if (department === "Directing") return i18nText("autoI18n.yonetmen", "Yönetmen");
  if (department === "Acting") return i18nText("autoI18n.oyuncu", "Oyuncu");
  return "";
}

const PersonCell = memo(function PersonCell({ row, selected, accent, theme, disabled, onSelect }) {
  const source = useMemo(
    () => getAvatarSource(row.choice.avatarIndex, row.choice.photoURL, CELL_PX),
    [row.choice.avatarIndex, row.choice.photoURL],
  );
  const role = departmentLabel(row.department);
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={disabled}
      onPress={() => onSelect(row.choice)}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={i18nText("autoI18n.avatar_kisi_etiketi", "{{name}} fotoğrafı", { name: row.name })}
    >
      <View
        style={[
          styles.photoRing,
          { borderColor: selected ? accent : "transparent" },
        ]}
      >
        <Image
          source={source}
          style={[styles.photo, { backgroundColor: theme.border }]}
          contentFit="cover"
          // Portre (2:3) kareye kırpılır; yüz üst yarıda (bkz. avatarContentPosition).
          contentPosition="top"
          cachePolicy="memory-disk"
          recyclingKey={row.key}
          transition={120}
        />
        {selected ? (
          <View style={[styles.check, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={[styles.name, { color: theme.text.primary }]}>
        {row.name}
      </Text>
      {role ? (
        <Text numberOfLines={1} style={[styles.role, { color: theme.text.muted }]}>
          {role}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

/**
 * @param {object}   props
 * @param {object}   props.current   Seçili avatar (seçim nesnesi) — işaret için.
 * @param {Function} props.onSelect  Seçim nesnesiyle çağrılır.
 * @param {boolean}  [props.disabled] Kaydedilirken dokunuşlar kapalı.
 */
export default function PersonAvatarPanel({ current, onSelect, disabled = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { profile } = useUserProfile() || {};
  const { people: followed } = useFollowedPeople();

  const [query, setQuery] = useState("");
  const [popular, setPopular] = useState([]);
  const [popularState, setPopularState] = useState("loading");
  const [popularTick, setPopularTick] = useState(0);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const requestRef = useRef(0);

  const text = query.trim();
  const favorites = useMemo(() => readProfileFavorites(profile).people, [profile]);

  // Popüler kişiler (panel ilk açıldığında bir kez; dil değişince yeniden).
  useEffect(() => {
    let alive = true;
    setPopularState("loading");
    fetchPopularPeople({ apiKey: API_KEY, language })
      .then((people) => {
        if (!alive) return;
        setPopular(people);
        setPopularState("ready");
      })
      .catch(() => alive && setPopularState("error"));
    return () => {
      alive = false;
    };
  }, [API_KEY, language, popularTick]);

  // Arama (yazmayı bekleyerek; geç gelen eski cevap yenisini ezmesin).
  useEffect(() => {
    if (personSearchState({ query: text }) === "idle") {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return undefined;
    }
    const id = ++requestRef.current;
    setSearching(true);
    setSearchError(false);
    const timer = setTimeout(() => {
      searchPersonAvatars({ query: text, apiKey: API_KEY, language })
        .then((rows) => {
          if (requestRef.current !== id) return;
          setResults(rows);
          setSearching(false);
        })
        .catch(() => {
          if (requestRef.current !== id) return;
          setResults([]);
          setSearchError(true);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [API_KEY, language, text, searchTick]);

  const searchState = personSearchState({ query: text, loading: searching, error: searchError, rows: results });

  const sections = useMemo(() => {
    const list =
      searchState === "idle"
        ? buildPersonAvatarSections({ favorites, followed, popular })
        : searchState === "results"
          ? [{ id: "results", rows: results }]
          : [];
    return list.map((section) => ({
      key: section.id,
      title: SECTION_TITLE[section.id](),
      data: chunkRows(section.rows, PERSON_GRID_COLUMNS),
    }));
  }, [searchState, favorites, followed, popular, results]);

  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.gridRow}>
        {item.map((row) => (
          <PersonCell
            key={row.key}
            row={row}
            selected={sameAvatarChoice(row.choice, current)}
            accent={theme.accent}
            theme={theme}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
        {/* Son satır eksikse hücreler sola yaslı kalsın. */}
        {Array.from({ length: PERSON_GRID_COLUMNS - item.length }, (_, i) => (
          <View key={`pad-${i}`} style={styles.cell} />
        ))}
      </View>
    ),
    [current, theme, disabled, onSelect],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <Text style={[styles.sectionTitle, { color: theme.text.muted, backgroundColor: theme.secondary }]}>
        {section.title}
      </Text>
    ),
    [theme],
  );

  const retry = useCallback(() => {
    if (searchState === "error") setSearchTick((n) => n + 1);
    else setPopularTick((n) => n + 1);
  }, [searchState]);

  let empty = null;
  if (searchState === "loading" || (searchState === "idle" && popularState === "loading" && !sections.length)) {
    empty = <ActivityIndicator style={styles.state} color={theme.accent} />;
  } else if (searchState === "error" || (searchState === "idle" && popularState === "error" && !sections.length)) {
    empty = (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.text.muted} />
        <Text style={[styles.stateText, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.avatar_kisi_hata", "Şu an yüklenemedi. Bağlantını kontrol et.")}
        </Text>
        <Text onPress={retry} style={[styles.retry, { color: theme.accent }]} accessibilityRole="button">
          {i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}
        </Text>
      </View>
    );
  } else if (searchState === "empty") {
    empty = (
      <View style={styles.state}>
        <Ionicons name="person-outline" size={26} color={theme.text.muted} />
        <Text style={[styles.stateText, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.avatar_kisi_bulunamadi", "Fotoğrafı olan oyuncu ya da yönetmen bulunamadı")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GlassBox role="field" style={[styles.search, { backgroundColor: theme.primary, borderColor: theme.border }]}>
        <Ionicons name="search" size={17} color={theme.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={i18nText("autoI18n.avatar_kisi_ara", "Oyuncu ya da yönetmen ara")}
          placeholderTextColor={theme.text.muted}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          editable={!disabled}
          style={[styles.searchInput, { color: theme.text.primary }]}
        />
        {searching && results.length ? <ActivityIndicator size="small" color={theme.text.muted} /> : null}
        {query ? (
          <Ionicons
            name="close-circle"
            size={18}
            color={theme.text.muted}
            onPress={() => setQuery("")}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.temizle", "Temizle")}
          />
        ) : null}
      </GlassBox>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.map((row) => row.key).join("|")}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={5}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          searchState === "idle" ? (
            <Text style={[styles.hint, { color: theme.text.muted }]}>
              {i18nText(
                "autoI18n.avatar_kisi_ipucu",
                "Seçtiğin fotoğraf, arkadaşlarının seni gördüğü her yerde avatarın olur",
              )}
            </Text>
          ) : null
        }
        ListEmptyComponent={empty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: "600", paddingVertical: 0 },
  list: { paddingBottom: 14 },
  hint: { fontSize: 11.5, fontWeight: "600", lineHeight: 15, marginBottom: 4, paddingHorizontal: 2 },
  // textTransform "uppercase" YOK: yerel ayarı bilmez, Türkçe "i"yi "I" yapar
  // ("TAKIP ETTIKLERIN").
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.1,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  gridRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cell: { width: "23.5%", alignItems: "center" },
  photoRing: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2.5,
    padding: 3,
  },
  photo: { width: "100%", height: "100%", borderRadius: 999 },
  check: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  name: { fontSize: 11.5, fontWeight: "700", textAlign: "center", marginTop: 5, lineHeight: 14 },
  role: { fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 1 },
  state: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 },
  stateText: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 },
  retry: { fontSize: 13, fontWeight: "800", marginTop: 2 },
});
