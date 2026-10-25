// components/home/UpcomingFilterSheet.js
//
// "Yaklaşan Filmler" filtre sayfası (alt sayfa). Seçimler bir TASLAK üzerinde yapılır; "Sonuçları göster"
// taslağı uygular, kapatmak/dışarı dokunmak taslağı atar — DiscoverFilterSheet ile aynı sözleşme.
// Karar mantığı utils/upcomingFilters.js'te (saf, testli).
//
// İÇERİK: Ne zaman? (hazır aralık · ay seç · özel aralık) · Gösterim (tüm dünya / bölgede sinemada /
// dijitalde) · Tür (çoklu, VEYA) · Özgün dil · Sıralama (Popüler / Tarihe göre).
//
// ÖZEL ARALIK: iki alan her zaman ETKİN pencereyi gösterir (hazır aralık seçiliyken de); birine dokunup
// tarih seçmek aralığı "özel"e çevirir. Başlangıç bitişi geçerse bitiş başlangıçtan bir ay sonraya
// kayar (önce bitişi değiştirmek zorunda kalınmasın). Tarih seçici BU sayfanın ÇOCUĞU olarak açılır —
// iOS'ta ikinci Modal ancak ilkinin çocuğuyken sunulabilir (WatchedDateSheet ile aynı düzen).
//
// ÇIKIŞ PENCERESİ: `visible` düştükten sonra sayfa ~260 ms çizilmeye devam eder (BottomSheetModal);
// taslak kapanışta SIFIRLANMAZ, yalnız her açılışta güncel süzgeçten yeniden kurulur.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import SheetScroll from "../common/SheetScroll";
import GlassPressable from "../common/GlassPressable";
import DatePickerModal from "../modals/DatePickerModal";
import DiscoverFilterChip from "./DiscoverFilterChip";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { getDiscoverFiltersCopy } from "../../screens/shared/discoverFiltersCopy";
import { isoDate } from "../../utils/discoverFilters";
import {
  CUSTOM_MAX_YEARS,
  DEFAULT_UPCOMING_FILTERS,
  QUICK_RANGES,
  SCOPES,
  UPCOMING_GENRES,
  UPCOMING_LANGUAGES,
  UPCOMING_SORTS,
  addMonths,
  isUpcomingCustomized,
  normalizeUpcomingFilters,
  parseIsoDay,
  setUpcomingCustomRange,
  setUpcomingFilter,
  setUpcomingMonth,
  setUpcomingRange,
  toggleUpcomingGenre,
  upcomingBounds,
  upcomingDateRange,
  upcomingMonths,
} from "../../utils/upcomingFilters";
import {
  fillCopy,
  formatUpcomingDay,
  formatUpcomingMonth,
  getUpcomingFiltersCopy,
} from "../../utils/upcomingFiltersCopy";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const Section = ({ title, hint, theme, children, wrap = true }) => (
  <View style={styles.section}>
    <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {hint ? (
      <Text allowFontScaling={false} style={[styles.sectionHint, { color: theme.text.muted }]}>
        {hint}
      </Text>
    ) : null}
    {wrap ? <View style={styles.wrap}>{children}</View> : children}
  </View>
);

const SubTitle = ({ children, theme }) => (
  <Text allowFontScaling={false} style={[styles.subTitle, { color: theme.text.secondary }]}>
    {children}
  </Text>
);

function DateField({ label, value, active, onPress, theme, accent, testID }) {
  return (
    <GlassPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateField,
        {
          backgroundColor: active ? alpha(accent, 0.12) : theme.secondary,
          borderColor: active ? accent : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.dateLabel, { color: theme.text.muted }]}>
        {label}
      </Text>
      <View style={styles.dateValueRow}>
        <Ionicons name="calendar-outline" size={15} color={active ? accent : theme.text.muted} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.dateValue, { color: theme.text.primary }]}
        >
          {value}
        </Text>
      </View>
    </GlassPressable>
  );
}

/**
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {object} props.filters             Uygulanmış süzgeç (sayfa açılırken taslak buradan kurulur)
 * @param {(draft: object) => void} props.onApply
 * @param {string} props.region              TMDB bölgesi ("TR") — gösterim ipucunda adı yazılır
 */
export default function UpcomingFilterSheet({ visible, onClose, filters, onApply, region }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getUpcomingFiltersCopy(language);
  const names = getDiscoverFiltersCopy(language);
  const accent = theme.accent ?? "#3B82F6";

  const [draft, setDraft] = useState(() => normalizeUpcomingFilters(filters));
  // Hangi tarih alanı düzenleniyor: null | "from" | "to".
  const [picker, setPicker] = useState(null);
  useEffect(() => {
    if (visible) {
      setDraft(normalizeUpcomingFilters(filters));
      setPicker(null);
    }
    // Yalnız açılışta yeniden kur; açıkken dışarıdan gelen süzgeç değişimi taslağı ezmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const months = useMemo(() => upcomingMonths(), []);
  const bounds = upcomingBounds();
  const range = upcomingDateRange(draft);
  const canReset = isUpcomingCustomized(draft);
  const regionName = copy.regions[region] ?? region ?? "";

  const change = useCallback((key, value) => setDraft((current) => setUpcomingFilter(current, key, value)), []);
  const reset = useCallback(() => setDraft(normalizeUpcomingFilters(DEFAULT_UPCOMING_FILTERS)), []);

  // Bitiş yoksa ("Tümü") ya da başlangıç onu geçtiyse: başlangıçtan bir ay sonrası.
  const monthAfter = (iso) => isoDate(addMonths(parseIsoDay(iso), 1));
  const confirmDate = (iso) => {
    const which = picker;
    setPicker(null);
    setDraft((current) => {
      const window = upcomingDateRange(current);
      if (which === "from") {
        const to = window.lte && window.lte >= iso ? window.lte : monthAfter(iso);
        return setUpcomingCustomRange(current, { from: iso, to });
      }
      return setUpcomingCustomRange(current, { from: window.gte, to: iso });
    });
  };

  const pickerProps =
    picker === "from"
      ? {
          title: copy.ui.pickFromTitle,
          value: range.gte,
          minDate: bounds.minIso,
          minDateErrorMsg: copy.ui.minFromError,
        }
      : {
          title: copy.ui.pickToTitle,
          value: range.lte ?? monthAfter(range.gte),
          minDate: range.gte,
          minDateErrorMsg: copy.ui.minToError,
        };

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
          testID="upcoming-sheet-reset"
          accessibilityRole="button"
          hitSlop={10}
          onPress={reset}
          disabled={!canReset}
        >
          <Text allowFontScaling={false} style={[styles.reset, { color: canReset ? accent : theme.text.muted }]}>
            {copy.ui.reset}
          </Text>
        </Pressable>
      </View>

      <SheetScroll contentContainerStyle={styles.scrollContent}>
        <Section title={copy.ui.when} hint={copy.ui.quickHint} theme={theme} wrap={false}>
          <View style={styles.wrap}>
            {QUICK_RANGES.map((id) => (
              <DiscoverFilterChip
                key={id}
                testID={`upcoming-range-${id}`}
                label={copy.ranges[id]}
                selected={draft.range === id}
                onPress={() => setDraft((current) => setUpcomingRange(current, id))}
              />
            ))}
          </View>

          <SubTitle theme={theme}>{copy.ui.pickMonth}</SubTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.monthRail}
            contentContainerStyle={styles.monthRailContent}
          >
            {months.map((month) => (
              <DiscoverFilterChip
                key={month}
                testID={`upcoming-month-${month}`}
                label={formatUpcomingMonth(month, copy)}
                selected={draft.range === "calendarMonth" && draft.month === month}
                onPress={() => setDraft((current) => setUpcomingMonth(current, month))}
              />
            ))}
          </ScrollView>

          <SubTitle theme={theme}>{copy.ui.customRange}</SubTitle>
          <Text allowFontScaling={false} style={[styles.sectionHint, { color: theme.text.muted }]}>
            {copy.ui.customHint}
          </Text>
          <View style={styles.dateRow}>
            <DateField
              testID="upcoming-date-from"
              label={copy.ui.from}
              value={formatUpcomingDay(range.gte, copy)}
              active={draft.range === "custom"}
              onPress={() => setPicker("from")}
              theme={theme}
              accent={accent}
            />
            <Ionicons name="arrow-forward" size={16} color={theme.text.muted} />
            <DateField
              testID="upcoming-date-to"
              label={copy.ui.to}
              value={range.lte ? formatUpcomingDay(range.lte, copy) : copy.ui.noEnd}
              active={draft.range === "custom"}
              onPress={() => setPicker("to")}
              theme={theme}
              accent={accent}
            />
          </View>
        </Section>

        <Section title={copy.ui.scope} hint={fillCopy(copy.ui.scopeHint, { region: regionName })} theme={theme}>
          {SCOPES.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`upcoming-scope-${id}`}
              icon={id === "cinema" ? "film-outline" : id === "digital" ? "tv-outline" : "globe-outline"}
              label={copy.scopes[id]}
              selected={draft.scope === id}
              onPress={() => change("scope", id)}
            />
          ))}
        </Section>

        <Section title={copy.ui.genre} hint={copy.ui.genreHint} theme={theme}>
          {UPCOMING_GENRES.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`upcoming-genre-${id}`}
              label={names.genres[id]}
              selected={draft.genres.includes(id)}
              onPress={() => setDraft((current) => toggleUpcomingGenre(current, id))}
            />
          ))}
        </Section>

        <Section title={copy.ui.language} theme={theme}>
          {UPCOMING_LANGUAGES.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`upcoming-language-${id}`}
              label={names.languages[id]}
              selected={draft.language === id}
              onPress={() => change("language", id)}
            />
          ))}
        </Section>

        <Section title={copy.ui.sort} hint={copy.ui.sortHint} theme={theme}>
          {UPCOMING_SORTS.map((id) => (
            <DiscoverFilterChip
              key={id}
              testID={`upcoming-sort-${id}`}
              icon={id === "soonest" ? "time-outline" : "flame-outline"}
              label={copy.sorts[id]}
              selected={draft.sort === id}
              onPress={() => change("sort", id)}
            />
          ))}
        </Section>
      </SheetScroll>

      <GlassPressable
        testID="upcoming-sheet-apply"
        accessibilityRole="button"
        onPress={() => onApply?.(draft)}
        style={({ pressed }) => [styles.apply, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text allowFontScaling={false} style={styles.applyText}>
          {copy.ui.apply}
        </Text>
      </GlassPressable>

      <DatePickerModal
        visible={visible && picker !== null}
        onClose={() => setPicker(null)}
        onConfirm={confirmDate}
        confirmLabel={copy.ui.pickConfirm}
        maxDate={bounds.maxIso}
        maxDateErrorMsg={fillCopy(copy.ui.maxError, { n: CUSTOM_MAX_YEARS })}
        quickActions={false}
        {...pickerProps}
      />
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
    gap: 12,
    marginBottom: 6,
  },
  title: { flexShrink: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  reset: { fontSize: 14, fontWeight: "700" },
  scrollContent: { paddingBottom: 14 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  sectionHint: { fontSize: 11.5, lineHeight: 15, marginTop: -4, marginBottom: 8 },
  subTitle: { fontSize: 12.5, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // Yatay ay satırı sayfanın yan dolgusuna kadar uzanır; ilk/son çip kenarla hizalı kalır.
  // Basılan cam ay çipi satırın kırpma sınırında kesilmesin: dikeyde GLASS_PRESS_ROOM
  // (dolgu + eşit negatif dış boşluk; yerleşim aynı).
  monthRail: { marginHorizontal: -18, marginVertical: -GLASS_PRESS_ROOM },
  monthRailContent: { paddingHorizontal: 18, paddingVertical: GLASS_PRESS_ROOM, gap: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateField: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateLabel: { fontSize: 11, fontWeight: "700" },
  dateValueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dateValue: { flexShrink: 1, fontSize: 14.5, fontWeight: "700" },
  apply: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  applyText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
