// screens/shared/DiscoverFiltersScreen.js
//
// "Ne izlesem?" (Filtreli Keşif) ekranı: süzgeç çubuğu + sonuç ızgarası.
//
//   üst        : Film/Dizi anahtarı (MediaTypeSwitch) — değişince süzgeç eşlenerek taşınır
//   çip satırı : "Filtreler · n" (filtre sayfasını açar) · "Şaşırt beni" · süzgeç YOKKEN hazır süzgeç ve
//                kayıtlı süzgeç çipleri (tek dokunuşla uygular), süzgeç VARKEN etkin süzgeç çipleri
//                (dokununca kaldırır) · sıralama · "Kaydet"
//   ızgara     : SeeAllScreen'in ortak ızgarası (SeeAllGrid) — sütun/köşe ayarı, poster rozetleri, uzun
//                basınca hızlı eylemler ve sonsuz kaydırma aynen gelir
//
// Ana ekranın üst satırındaki keşfet düğmesi (components/home/DiscoverExploreAction.js) bu ekranı yalnız
// `mediaType` ile açar → EN SON KULLANILAN süzgeçle başlar. Aşağıdaki diğer rota parametreleri derin bağlantı /
// gelecekteki girişler içindir (şu an çağıran yok):
//
// Rota parametreleri (hepsi isteğe bağlı):
//   mediaType  : "movie" | "tv"                 (varsayılan: Dizi, ana ekranın varsayılanı)
//   presetId   : hazır süzgeç kimliği           (utils/discoverFilters.js QUICK_PRESETS)
//   savedId    : kayıtlı süzgeç kimliği
//   filters    : doğrudan süzgeç nesnesi
// Hiçbiri yoksa EN SON KULLANILAN süzgeçle açılır.
//
// Karar mantığı utils/discoverFilters.js'te (saf, testli); akış hooks/useFilteredDiscover.js'te.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { toast } from "../../components/AppToast";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import DiscoverFilterSheet from "../../components/home/DiscoverFilterSheet";
import MediaTypeSwitch from "../../components/home/MediaTypeSwitch";
import { useStreamingProviderSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import {
  deleteDiscoverPreset,
  readLastDiscoverFilters,
  saveDiscoverPreset,
  useDiscoverPresets,
  writeLastDiscoverFilters,
} from "../../hooks/useDiscoverFilterStore";
import useFilteredDiscover from "../../hooks/useFilteredDiscover";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analytics";
import { alpha } from "../../theme/colors";
import { normalizeMediaType } from "../../utils/discoverMedia";
import {
  DEFAULT_FILTERS,
  QUICK_PRESETS,
  convertFiltersForType,
  countActiveFilters,
  describeFilters,
  isCustomized,
  needsPlatformSetup,
  presetNameFor,
  resolveInitialFilters,
  resolveQuickPreset,
  setFilter,
  toggleGenre,
} from "../../utils/discoverFilters";
import { SeeAllGrid } from "./SeeAllScreen";
import { describeCopyOf, fillCopy, getDiscoverFiltersCopy } from "./discoverFiltersCopy";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

/** Ölçüm: süzgeç uygulandı (kaynak: hazır çip / kayıtlı / filtre sayfası). Metin ASLA gönderilmez. */
const trackApplied = (source, mediaType, filters, extra) =>
  trackEvent(ANALYTICS_EVENTS.DISCOVER_FILTER_APPLIED, {
    source,
    media_type: mediaType,
    filter_count: countActiveFilters(filters),
    genre_count: filters.genres.length,
    platform: filters.onMyPlatforms,
    hide_watched: filters.hideWatched,
    sort: filters.sort,
    ...extra,
  });

function StateCard({ icon, title, text, actionLabel, onAction, theme, testID }) {
  const accent = theme.accent ?? "#3B82F6";
  return (
    <View testID={testID} style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: alpha(accent, 0.14) }]}>
        <Ionicons name={icon} size={26} color={accent} />
      </View>
      <Text allowFontScaling={false} style={[styles.stateTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={[styles.stateText, { color: theme.text.muted }]}>
        {text}
      </Text>
      <Pressable
        testID={`${testID}-action`}
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.stateAction, { backgroundColor: accent, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text allowFontScaling={false} style={styles.stateActionText}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export default function DiscoverFiltersScreen({ route, navigation }) {
  const params = route?.params || {};
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const copy = getDiscoverFiltersCopy(language);
  const describeCopy = useMemo(() => describeCopyOf(copy), [copy]);
  const { streamingProviderIds } = useStreamingProviderSettings();
  const hasProviders = streamingProviderIds.length > 0;
  const presets = useDiscoverPresets();

  // Başlangıç (medya türü + süzgeç) yalnız ilk çizimde, rota parametrelerinden ve depodan kurulur.
  const [initial] = useState(() => {
    const type = normalizeMediaType(params.mediaType);
    return {
      mediaType: type,
      filters: resolveInitialFilters(params, type, {
        presets,
        hasProviders,
        last: readLastDiscoverFilters(type),
      }),
    };
  });
  const [mediaType, setMediaType] = useState(initial.mediaType);
  const [filters, setFilters] = useState(initial.filters);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [surprising, setSurprising] = useState(false);
  const surprisingRef = useRef(false);
  const chipScrollRef = useRef(null);

  // Ana ekrandaki hazır çip / kayıtlı süzgeçle gelindiyse ölçüm (yalnız açılışta bir kez).
  useEffect(() => {
    if (params.presetId) trackApplied("preset", initial.mediaType, initial.filters, { preset: params.presetId });
    else if (params.savedId) trackApplied("saved", initial.mediaType, initial.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Son kullanılan süzgeç hatırlanır: ana ekrandaki "Filtrele" kaldığın yerden açar.
  useEffect(() => {
    writeLastDiscoverFilters(mediaType, filters);
  }, [mediaType, filters]);

  const feed = useFilteredDiscover({ mediaType, filters });

  const labels = useMemo(() => ({ tv: t.tvShows ?? copy.ui.typeTv, movie: t.movies ?? copy.ui.typeMovie }), [t, copy]);
  const chips = useMemo(() => describeFilters(filters, mediaType, describeCopy), [filters, mediaType, describeCopy]);
  const activeCount = countActiveFilters(filters);
  const customized = isCustomized(filters, mediaType);
  // Çip satırı hazır çiplerden etkin çiplere (ya da tersine) dönünce BAŞA kaydır: sağdaki bir hazır çipe
  // basıldıysa satır sağa kaymış olurdu ve soldaki "Filtreler" düğmesi ekran dışında kalırdı.
  useEffect(() => {
    chipScrollRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [customized]);
  const savedForType = useMemo(() => presets.filter((preset) => preset.mediaType === mediaType), [presets, mediaType]);

  const onMediaChange = useCallback(
    (next) => {
      if (next === mediaType) return;
      setFilters((current) => convertFiltersForType(current, mediaType, next));
      setMediaType(next);
    },
    [mediaType],
  );

  const removeChip = useCallback(
    (chip) =>
      setFilters((current) =>
        chip.key === "genres"
          ? toggleGenre(current, chip.value, mediaType)
          : setFilter(current, chip.key, DEFAULT_FILTERS[chip.key], mediaType),
      ),
    [mediaType],
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const savePreset = useCallback(
    (draft) => {
      const name = presetNameFor(draft, mediaType, describeCopy, copy.ui.filters);
      const result = saveDiscoverPreset({ name, mediaType, filters: draft });
      if (result.ok) toast.success(copy.ui.saved);
    },
    [copy, describeCopy, mediaType],
  );

  const removePreset = useCallback(
    (id) => {
      if (deleteDiscoverPreset(id)) toast.info(copy.ui.savedRemoved);
    },
    [copy],
  );

  const applyDraft = useCallback(
    (draft) => {
      setFilters(draft);
      setSheetVisible(false);
      trackApplied("manual", mediaType, draft);
    },
    [mediaType],
  );

  const openDetails = useCallback(
    (item) => navigation.push(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", { id: item.id }),
    [mediaType, navigation],
  );

  const { surprise } = feed;
  const onSurprise = useCallback(
    async () => {
      if (surprisingRef.current) return;
      surprisingRef.current = true;
      setSurprising(true);
      let outcome = "error";
      try {
        const pick = await surprise();
        if (pick) {
          outcome = "opened";
          openDetails(pick);
        } else {
          outcome = "none";
          toast.info(copy.ui.surpriseNone);
        }
      } catch {
        toast.error(copy.ui.surpriseFailed);
      } finally {
        surprisingRef.current = false;
        setSurprising(false);
        trackEvent(ANALYTICS_EVENTS.DISCOVER_SURPRISE, {
          outcome,
          media_type: mediaType,
          filter_count: activeCount,
        });
      }
    },
    [activeCount, copy, mediaType, openDetails, surprise],
  );

  // Süzgeç yokken satırdaki hazır çipler TEK dokunuşla uygular (ana ekrandaki kartın yerini alır).
  const applyQuick = useCallback(
    (id) => {
      const next = resolveQuickPreset(id, mediaType, { hasProviders });
      if (!next) return;
      setFilters(next);
      trackApplied("preset", mediaType, next, { preset: id });
    },
    [hasProviders, mediaType],
  );
  const applySaved = useCallback(
    (preset) => {
      const next = convertFiltersForType(preset.filters, preset.mediaType, mediaType);
      setFilters(next);
      trackApplied("saved", mediaType, next);
    },
    [mediaType],
  );

  const platformsMissing = needsPlatformSetup(filters, streamingProviderIds);

  const bar = (
    <View style={styles.bar}>
      <View style={styles.switchRow}>
        <MediaTypeSwitch value={mediaType} onChange={onMediaChange} labels={labels} />
      </View>
      <ScrollView
        ref={chipScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        <DiscoverFilterChip
          testID="discover-open-filters"
          filled
          icon="options-outline"
          label={activeCount > 0 ? fillCopy(copy.ui.filtersCount, { n: activeCount }) : copy.ui.filters}
          onPress={() => setSheetVisible(true)}
        />
        <DiscoverFilterChip
          testID="discover-surprise"
          icon="shuffle"
          label={surprising ? copy.ui.surpriseBusy : copy.ui.surprise}
          disabled={surprising}
          onPress={onSurprise}
        />
        {!customized
          ? QUICK_PRESETS.map((preset) => (
              <DiscoverFilterChip
                key={preset.id}
                testID={`discover-quick-${preset.id}`}
                icon={preset.icon}
                label={copy.presets[preset.id][0]}
                accessibilityLabel={`${copy.presets[preset.id][0]}. ${copy.presets[preset.id][1]}`}
                onPress={() => applyQuick(preset.id)}
              />
            ))
          : null}
        {!customized
          ? savedForType.map((preset) => (
              <DiscoverFilterChip
                key={preset.id}
                testID={`discover-saved-${preset.id}`}
                icon="bookmark"
                label={preset.name}
                onPress={() => applySaved(preset)}
              />
            ))
          : null}
        {chips.map((chip) => (
          <DiscoverFilterChip
            key={`${chip.key}-${chip.value ?? ""}`}
            testID={`discover-chip-${chip.key}${chip.value != null ? `-${chip.value}` : ""}`}
            selected
            label={chip.label}
            trailingIcon="close"
            accessibilityLabel={fillCopy(copy.ui.removeFilter, { name: chip.label })}
            onPress={() => removeChip(chip)}
          />
        ))}
        {filters.sort !== DEFAULT_FILTERS.sort ? (
          <DiscoverFilterChip
            testID="discover-chip-sort"
            selected
            icon="swap-vertical"
            label={copy.sorts[filters.sort]}
            trailingIcon="close"
            accessibilityLabel={fillCopy(copy.ui.removeFilter, { name: copy.sorts[filters.sort] })}
            onPress={() => setFilters((current) => setFilter(current, "sort", DEFAULT_FILTERS.sort, mediaType))}
          />
        ) : null}
        {customized ? (
          <DiscoverFilterChip
            testID="discover-save"
            icon="bookmark-outline"
            label={copy.ui.save}
            onPress={() => savePreset(filters)}
          />
        ) : null}
      </ScrollView>
      {platformsMissing ? (
        <View testID="discover-platforms-missing" style={styles.warning}>
          <Ionicons name="information-circle-outline" size={15} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[styles.warningText, { color: theme.text.muted }]}>
            {copy.ui.platformsMissing}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let emptyComponent;
  if (feed.status === "error") {
    emptyComponent = (
      <StateCard
        testID="discover-error"
        theme={theme}
        icon="cloud-offline-outline"
        title={copy.ui.errorTitle}
        text={copy.ui.errorText}
        actionLabel={copy.ui.retry}
        onAction={feed.reload}
      />
    );
  } else if (feed.status === "ready" && !feed.loadingMore && feed.items.length === 0) {
    emptyComponent = (
      <StateCard
        testID="discover-empty"
        theme={theme}
        icon="film-outline"
        title={copy.ui.emptyTitle}
        text={copy.ui.emptyText}
        actionLabel={copy.ui.emptyAction}
        onAction={resetFilters}
      />
    );
  }

  return (
    <>
      <SeeAllGrid
        title={copy.ui.title}
        mediaType={mediaType}
        navigation={navigation}
        data={feed.items}
        loadMore={feed.loadMore}
        loadingMore={feed.loadingMore}
        hasMore={feed.hasMore}
        headerExtra={bar}
        emptyComponent={emptyComponent}
      />
      <DiscoverFilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        mediaType={mediaType}
        filters={filters}
        onApply={applyDraft}
        hasProviders={hasProviders}
        presets={savedForType}
        onSavePreset={savePreset}
        onDeletePreset={removePreset}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 10 },
  switchRow: { alignItems: "center" },
  // Basılan cam çip satırın kırpma sınırında kesilmesin (utils/liquidGlass GLASS_PRESS_ROOM).
  chipScroll: { marginVertical: -GLASS_PRESS_ROOM },
  chipRow: { paddingHorizontal: 12, paddingVertical: GLASS_PRESS_ROOM, gap: 8, alignItems: "center" },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 14 },
  warningText: { flex: 1, fontSize: 11.5, lineHeight: 15 },
  state: { width: "100%", alignItems: "center", paddingHorizontal: 32, paddingTop: 48, paddingBottom: 24 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 17, fontWeight: "800", marginTop: 14, textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: "center" },
  stateAction: {
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stateActionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
