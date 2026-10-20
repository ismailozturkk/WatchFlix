// components/home/DiscoverFilterSheet.js
//
// "Ne izlesem?" filtre sayfası (alt sayfa). Seçimler bir TASLAK üzerinde yapılır; "Sonuçları göster"
// taslağı uygular, kapatmak/dışarı dokunmak taslağı atar — kullanıcı yanlış dokunuşla listeyi
// bozmadan deneme yapabilir. Karar mantığı utils/discoverFilters.js'te (saf, testli).
//
// İÇERİK: kayıtlı süzgeçler · tür · dönem · en düşük puan · süre · özgün dil · sıralama · seçenekler
// (Platformlarımda, İzlediklerimi gizle) · "Bu filtreleri kaydet".
//
// ÇIKIŞ PENCERESİ: `visible` düştükten sonra sayfa ~260 ms çizilmeye devam eder (BottomSheetModal);
// taslak kapanışta SIFIRLANMAZ, yalnız sayfa her açılışında güncel süzgeçten yeniden kurulur.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import SheetScroll from "../common/SheetScroll";
import SwitchToggle from "../SwitchToggle";
import DiscoverFilterChip from "./DiscoverFilterChip";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { fillCopy, getDiscoverFiltersCopy } from "../../screens/shared/discoverFiltersCopy";
import { alpha } from "../../theme/colors";
import {
  DEFAULT_FILTERS,
  ERAS,
  GENRES,
  LANGUAGES,
  MAX_GENRES,
  QUICK_PRESETS,
  RATINGS,
  RUNTIMES,
  SORTS,
  countActiveFilters,
  isCustomized,
  normalizeFilters,
  resolveQuickPreset,
  setFilter,
  toggleGenre,
} from "../../utils/discoverFilters";
import GlassPressable from "../common/GlassPressable";

const Section = ({ title, hint, theme, children }) => (
  <View style={styles.section}>
    <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {hint ? (
      <Text allowFontScaling={false} style={[styles.sectionHint, { color: theme.text.muted }]}>
        {hint}
      </Text>
    ) : null}
    <View style={styles.wrap}>{children}</View>
  </View>
);

const ToggleRow = ({ title, subtitle, value, disabled, onChange, theme, testID }) => (
  <View style={[styles.toggleRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
    <View style={styles.toggleText}>
      <Text allowFontScaling={false} style={[styles.toggleTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={[styles.toggleSub, { color: theme.text.muted }]}>
        {subtitle}
      </Text>
    </View>
    <View testID={testID}>
      <SwitchToggle value={value} onValueChange={disabled ? undefined : onChange} disabled={disabled} />
    </View>
  </View>
);

/**
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {"movie"|"tv"} props.mediaType
 * @param {object} props.filters            Uygulanmış süzgeç (sayfa açılırken taslak buradan kurulur)
 * @param {(draft: object) => void} props.onApply
 * @param {boolean} props.hasProviders      Kullanıcının platform üyeliği var mı
 * @param {{id:string,name:string,filters:object}[]} props.presets  Bu medya türünün kayıtlı süzgeçleri
 * @param {(draft: object) => void} props.onSavePreset
 * @param {(id: string) => void} props.onDeletePreset
 */
export default function DiscoverFilterSheet({
  visible,
  onClose,
  mediaType,
  filters,
  onApply,
  hasProviders,
  presets = [],
  onSavePreset,
  onDeletePreset,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getDiscoverFiltersCopy(language);
  const accent = theme.accent ?? "#3B82F6";

  const [draft, setDraft] = useState(() => normalizeFilters(filters, mediaType));
  useEffect(() => {
    if (visible) setDraft(normalizeFilters(filters, mediaType));
    // Yalnız açılışta yeniden kur; açıkken dışarıdan gelen süzgeç değişimi taslağı ezmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const genres = GENRES[mediaType] ?? GENRES.movie;
  const atGenreLimit = draft.genres.length >= MAX_GENRES;
  const activeCount = useMemo(() => countActiveFilters(draft), [draft]);
  const canSave = isCustomized(draft, mediaType);

  const change = useCallback(
    (key, value) => setDraft((current) => setFilter(current, key, value, mediaType)),
    [mediaType],
  );
  const reset = useCallback(() => setDraft(normalizeFilters(DEFAULT_FILTERS, mediaType)), [mediaType]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
          {copy.ui.sheetTitle}
        </Text>
        <Pressable
          testID="filter-sheet-reset"
          accessibilityRole="button"
          hitSlop={10}
          onPress={reset}
          disabled={!canSave}
        >
          <Text
            allowFontScaling={false}
            style={[styles.reset, { color: canSave ? accent : theme.text.muted }]}
          >
            {copy.ui.reset}
          </Text>
        </Pressable>
      </View>

      <SheetScroll contentContainerStyle={styles.scrollContent}>
        <Section title={copy.ui.quickTitle} theme={theme}>
          {QUICK_PRESETS.map((preset) => (
            <DiscoverFilterChip
              key={preset.id}
              testID={`filter-quick-${preset.id}`}
              icon={preset.icon}
              label={copy.presets[preset.id][0]}
              accessibilityLabel={`${copy.presets[preset.id][0]}. ${copy.presets[preset.id][1]}`}
              onPress={() => setDraft(resolveQuickPreset(preset.id, mediaType, { hasProviders }))}
            />
          ))}
        </Section>

        {presets.length > 0 ? (
          <Section title={copy.ui.savedTitle} theme={theme}>
            {presets.map((preset) => (
              <View key={preset.id} style={styles.savedRow}>
                <DiscoverFilterChip
                  testID={`filter-saved-${preset.id}`}
                  icon="bookmark"
                  label={preset.name}
                  style={styles.savedChip}
                  onPress={() => setDraft(normalizeFilters(preset.filters, mediaType))}
                />
                <GlassPressable
                  testID={`filter-saved-remove-${preset.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={copy.ui.savedRemove}
                  hitSlop={8}
                  onPress={() => onDeletePreset?.(preset.id)}
                  style={[styles.removeSaved, { backgroundColor: alpha(theme.text.muted, 0.14) }]}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.text.muted} />
                </GlassPressable>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title={copy.ui.genre} hint={fillCopy(copy.ui.genreHint, { n: MAX_GENRES })} theme={theme}>
          {genres.map((id) => {
            const selected = draft.genres.includes(id);
            return (
              <DiscoverFilterChip
                key={id}
                testID={`filter-genre-${id}`}
                label={copy.genres[id]}
                selected={selected}
                disabled={!selected && atGenreLimit}
                onPress={() => setDraft((current) => toggleGenre(current, id, mediaType))}
              />
            );
          })}
        </Section>

        <Section title={copy.ui.era} theme={theme}>
          {ERAS.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`filter-era-${id}`}
              label={copy.eras[id]}
              selected={draft.era === id}
              onPress={() => change("era", id)}
            />
          ))}
        </Section>

        <Section title={copy.ui.rating} theme={theme}>
          {RATINGS.map((value) => (
            <DiscoverFilterChip
              key={value}
              testID={`filter-rating-${value}`}
              icon={value > 0 ? "star" : undefined}
              label={value > 0 ? fillCopy(copy.ui.ratingOption, { n: value }) : copy.ui.any}
              selected={draft.minRating === value}
              onPress={() => change("minRating", value)}
            />
          ))}
        </Section>

        <Section
          title={copy.ui.runtime}
          hint={mediaType === "tv" ? copy.ui.runtimeTvHint : undefined}
          theme={theme}
        >
          {RUNTIMES.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`filter-runtime-${id}`}
              label={copy.runtimes[mediaType]?.[id] ?? copy.runtimes.movie[id]}
              selected={draft.runtime === id}
              onPress={() => change("runtime", id)}
            />
          ))}
        </Section>

        <Section title={copy.ui.language} theme={theme}>
          {LANGUAGES.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`filter-language-${id}`}
              label={copy.languages[id]}
              selected={draft.language === id}
              onPress={() => change("language", id)}
            />
          ))}
        </Section>

        <Section title={copy.ui.sort} theme={theme}>
          {SORTS.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`filter-sort-${id}`}
              label={copy.sorts[id]}
              selected={draft.sort === id}
              onPress={() => change("sort", id)}
            />
          ))}
        </Section>

        <View style={styles.section}>
          <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {copy.ui.options}
          </Text>
          <ToggleRow
            testID="filter-toggle-platforms"
            theme={theme}
            title={copy.ui.onMyPlatforms}
            subtitle={hasProviders ? copy.ui.onMyPlatformsSub : copy.ui.onMyPlatformsNone}
            value={hasProviders && draft.onMyPlatforms}
            disabled={!hasProviders}
            onChange={(value) => change("onMyPlatforms", value)}
          />
          <ToggleRow
            testID="filter-toggle-watched"
            theme={theme}
            title={copy.ui.hideWatched}
            subtitle={copy.ui.hideWatchedSub}
            value={draft.hideWatched}
            onChange={(value) => change("hideWatched", value)}
          />
        </View>

        {canSave ? (
          <GlassPressable
            testID="filter-sheet-save"
            accessibilityRole="button"
            onPress={() => onSavePreset?.(draft)}
            style={({ pressed }) => [
              styles.saveButton,
              { borderColor: accent, backgroundColor: alpha(accent, 0.08), opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="bookmark-outline" size={17} color={accent} />
            <Text allowFontScaling={false} style={[styles.saveText, { color: accent }]}>
              {copy.ui.saveCurrent}
            </Text>
          </GlassPressable>
        ) : null}
      </SheetScroll>

      <GlassPressable
        testID="filter-sheet-apply"
        accessibilityRole="button"
        onPress={() => onApply?.(draft)}
        style={({ pressed }) => [styles.apply, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text allowFontScaling={false} style={styles.applyText}>
          {activeCount > 0 ? `${copy.ui.apply} (${activeCount})` : copy.ui.apply}
        </Text>
      </GlassPressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 26,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  reset: { fontSize: 14, fontWeight: "700" },
  scrollContent: { paddingBottom: 14 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  sectionHint: { fontSize: 11.5, lineHeight: 15, marginTop: -4, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  // Uzun kayıtlı ad satırdan taşmasın: çip küçülür, içindeki metin tek satırda kırpılır.
  savedChip: { flexShrink: 1, minWidth: 0 },
  removeSaved: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: "700" },
  toggleSub: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
  },
  saveText: { fontSize: 14, fontWeight: "700" },
  apply: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  applyText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
