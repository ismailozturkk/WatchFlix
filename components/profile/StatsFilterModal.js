// components/profile/StatsFilterModal.js
//
// Film / Dizi istatistik ekranlarının "Filtrele" alt sayfası.
//
// ESKİ HÂLİ: tarih ve türler tek bir çip bulutuydu; her izleme günü ayrı çip
// olduğundan yıllarca kullanılan bir hesapta yüzlerce çip alt alta diziliyordu.
//
// YENİSİ:
//   • TARİH — yıl → ay → gün gezintisi. Yıl çipleri her zaman görünür; bir yıl
//     seçilince 12 aylık ızgara, bir ay seçilince o ayın izleme günleri açılır.
//     Seçim her düzeyde tek başına geçerli bir filtredir ("2025", "2025-03",
//     "2025-03-14"; bkz. utils/statsFilters). Seçili çipe tekrar basmak bir üst
//     düzeye döner.
//   • TÜR — izlenme sayısına göre sıralı, sayaçlı çipler. İlk 8 görünür,
//     gerisi "Tümünü göster" ile açılır (TMDB türleri sınırlı olduğundan arama
//     kutusu gerekmedi; böylece klavye yönetimi de gerekmiyor).

import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassPressable from "../common/GlassPressable";
import { i18nText } from "../../utils/i18nText";
import {
  buildDateTree,
  dateFilterParent,
  describeDateFilter,
  monthNames,
  planGenreChips,
} from "../../utils/statsFilters";
import { withAlpha } from "./StatsComponents";

const { height: SCREEN_H } = Dimensions.get("window");

const GENRE_LIMIT = 8;
const MONTH_SLOTS = Array.from({ length: 12 }, (_, index) => index + 1);

// ─── Çip ────────────────────────────────────────────────────────────────────
//
// active  → tam dolgu (bu çip filtrenin kendisi)
// inPath  → çerçeve + hafif dolgu (seçim bu çipin ALTINDA; ör. gün seçiliyken yıl/ay)

const FilterChip = memo(function FilterChip({
  theme,
  label,
  count,
  active = false,
  inPath = false,
  icon,
  onPress,
  testID,
}) {
  const ink = active ? "#fff" : inPath ? theme.accent : theme.text.secondary;
  return (
    <GlassPressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? theme.accent
            : inPath
              ? withAlpha(theme.accent, 0.14)
              : theme.primary,
          borderColor: active || inPath ? theme.accent : theme.border,
        },
      ]}
    >
      {active ? <Ionicons name="checkmark" size={13} color="#fff" style={styles.chipCheck} /> : null}
      {icon ? <Ionicons name={icon} size={13} color={ink} style={styles.chipCheck} /> : null}
      <Text
        style={[styles.chipText, { color: ink, fontWeight: active || inPath ? "700" : "600" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          style={[
            styles.chipCount,
            { color: active ? "rgba(255,255,255,0.8)" : theme.text.muted },
          ]}
        >
          {count}
        </Text>
      ) : null}
    </GlassPressable>
  );
});

// ─── Tarih ──────────────────────────────────────────────────────────────────

const DateFilter = memo(function DateFilter({
  theme,
  dates,
  dateCounts,
  selected,
  onSelect,
  locale,
  allDatesLabel,
}) {
  const tree = useMemo(() => buildDateTree(dates, dateCounts), [dates, dateCounts]);
  const shortMonths = useMemo(() => monthNames(locale, "short"), [locale]);

  const selectedYear = selected ? selected.slice(0, 4) : null;
  const selectedMonth = selected && selected.length >= 7 ? selected.slice(0, 7) : null;

  // Tek yıllık veride yıl çipine basmadan aylar görünsün.
  const openYearKey = selectedYear ?? (tree.length === 1 ? tree[0].key : null);
  const openYear = useMemo(
    () => tree.find((year) => year.key === openYearKey) || null,
    [tree, openYearKey],
  );
  const monthByNumber = useMemo(
    () => new Map((openYear?.months || []).map((month) => [month.month, month])),
    [openYear],
  );
  const openMonth = useMemo(
    () => openYear?.months.find((month) => month.key === selectedMonth) || null,
    [openYear, selectedMonth],
  );

  // Seçili çipe tekrar basmak bir üst düzeye döner.
  const toggle = useCallback(
    (key) => onSelect(selected === key ? dateFilterParent(key) : key),
    [selected, onSelect],
  );
  const clearDate = useCallback(() => onSelect(null), [onSelect]);

  return (
    <View style={styles.dateWrap}>
      <View style={styles.cloud}>
        <FilterChip
          theme={theme}
          testID="stats-date-all"
          label={allDatesLabel}
          active={selected == null}
          onPress={clearDate}
        />
        {tree.map((year) => (
          <FilterChip
            key={year.key}
            testID={`stats-year-${year.key}`}
            theme={theme}
            label={year.key}
            count={year.count}
            active={selected === year.key}
            inPath={selectedYear === year.key && selected !== year.key}
            onPress={() => toggle(year.key)}
          />
        ))}
      </View>

      {openYear ? (
        <View style={styles.monthGrid}>
          {MONTH_SLOTS.map((monthNumber) => {
            const month = monthByNumber.get(monthNumber);
            const name = shortMonths[monthNumber - 1];
            // Verisiz ay: cam düğme değil sade görünüm (cam yolunda opacity düşer).
            if (!month) {
              return (
                <View
                  key={monthNumber}
                  style={[styles.monthCell, styles.monthCellEmpty, { borderColor: theme.border }]}
                >
                  <Text style={[styles.monthName, { color: theme.text.muted }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.monthCount, { color: theme.text.muted }]}>–</Text>
                </View>
              );
            }
            const active = selected === month.key;
            const inPath = selectedMonth === month.key && !active;
            return (
              <GlassPressable
                key={monthNumber}
                testID={`stats-month-${month.key}`}
                onPress={() => toggle(month.key)}
                style={[
                  styles.monthCell,
                  {
                    backgroundColor: active
                      ? theme.accent
                      : inPath
                        ? withAlpha(theme.accent, 0.14)
                        : theme.primary,
                    borderColor: active || inPath ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthName,
                    { color: active ? "#fff" : inPath ? theme.accent : theme.text.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <Text
                  style={[
                    styles.monthCount,
                    { color: active ? "rgba(255,255,255,0.8)" : theme.text.muted },
                  ]}
                >
                  {month.count}
                </Text>
              </GlassPressable>
            );
          })}
        </View>
      ) : null}

      {openMonth ? (
        <View style={styles.dayWrap}>
          {openMonth.days.map((day) => {
            const active = selected === day.key;
            return (
              <GlassPressable
                key={day.key}
                testID={`stats-day-${day.key}`}
                onPress={() => toggle(day.key)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: active ? theme.accent : theme.primary,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: active ? "#fff" : theme.text.secondary,
                      fontWeight: active ? "800" : "600",
                    },
                  ]}
                >
                  {day.day}
                </Text>
              </GlassPressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

// ─── Tür ────────────────────────────────────────────────────────────────────

const GenreFilter = memo(function GenreFilter({
  theme,
  genres,
  selected,
  onSelect,
  allGenresLabel,
  showAllLabel,
  showLessLabel,
}) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(
    () => planGenreChips(genres, selected, expanded, GENRE_LIMIT),
    [genres, selected, expanded],
  );
  const clearGenre = useCallback(() => onSelect(null), [onSelect]);
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);

  return (
    <View style={styles.cloud}>
      <FilterChip
        testID="stats-genre-all"
        theme={theme}
        label={allGenresLabel}
        active={selected == null}
        onPress={clearGenre}
      />
      {plan.visible.map((genre) => (
        <FilterChip
          key={genre.name}
          testID={`stats-genre-${genre.name}`}
          theme={theme}
          label={genre.name}
          count={genre.count}
          active={selected === genre.name}
          onPress={() => onSelect(selected === genre.name ? null : genre.name)}
        />
      ))}
      {plan.hiddenCount > 0 ? (
        <FilterChip
          testID="stats-genre-more"
          theme={theme}
          label={showAllLabel(plan.hiddenCount)}
          icon="chevron-down"
          onPress={toggleExpanded}
        />
      ) : null}
      {plan.canCollapse ? (
        <FilterChip
          testID="stats-genre-less"
          theme={theme}
          label={showLessLabel}
          icon="chevron-up"
          onPress={toggleExpanded}
        />
      ) : null}
    </View>
  );
});

// ─── Pencere ────────────────────────────────────────────────────────────────

const FilterGroup = memo(function FilterGroup({ theme, icon, label, value, children }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Ionicons name={icon} size={15} color={theme.text.muted} />
        <Text style={[styles.groupLabel, { color: theme.text.muted }]}>{label}</Text>
        {value ? (
          <Text style={[styles.groupValue, { color: theme.accent }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
});

/**
 * @param {object} props
 * @param {string[]} props.dates                "YYYY-AA-GG" izleme günleri
 * @param {Record<string, number>} [props.dateCounts]  gün → öğe sayısı (çip sayaçları)
 * @param {string|null} props.selectedDate      null | "YYYY" | "YYYY-AA" | "YYYY-AA-GG"
 * @param {Array<string|{name:string,count:number}>} props.genres  sayıya göre azalan
 * @param {string} [props.locale]               ay adları için Intl yerel ayarı
 */
const StatsFilterModal = memo(function StatsFilterModal({
  visible,
  onClose,
  theme,
  dates = [],
  dateCounts,
  selectedDate,
  onSelectDate,
  genres = [],
  selectedGenre,
  onSelectGenre,
  formatDate,
  locale,
  title = i18nText("autoI18n.filtrele", "Filtrele"),
  dateLabel = i18nText("autoI18n.filtre_tarih", "Tarih"),
  genreLabel = i18nText("autoI18n.filtre_tur", "Tür"),
  allDatesLabel = i18nText("autoI18n.tum_tarihler", "Tüm Tarihler"),
  allGenresLabel = i18nText("autoI18n.tum_turler", "Tüm Türler"),
  clearLabel = i18nText("autoI18n.temizle", "Temizle"),
  doneLabel = i18nText("autoI18n.tamam", "Tamam"),
}) {
  const hasFilters = selectedDate != null || selectedGenre != null;

  const showAllLabel = useCallback(
    (hidden) =>
      i18nText("autoI18n.filtre_tur_tumunu_goster", "Tümünü göster ({{n}})", { n: hidden }),
    [],
  );
  const showLessLabel = i18nText("autoI18n.daha_az_goster", "Daha az göster");

  const dateValue = describeDateFilter(selectedDate, { locale, formatDay: formatDate });

  const clearAll = useCallback(() => {
    onSelectDate(null);
    onSelectGenre(null);
  }, [onSelectDate, onSelectGenre]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
        <GlassCloseButton
          size={32}
          fallbackRadius={16}
          color={theme.text.secondary}
          backgroundColor="transparent"
          borderColor={theme.border}
          hitSlop={10}
          onPress={onClose}
        />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FilterGroup theme={theme} icon="calendar-outline" label={dateLabel} value={dateValue}>
          <DateFilter
            theme={theme}
            dates={dates}
            dateCounts={dateCounts}
            selected={selectedDate}
            onSelect={onSelectDate}
            locale={locale}
            allDatesLabel={allDatesLabel}
          />
        </FilterGroup>

        {genres.length > 0 ? (
          <FilterGroup theme={theme} icon="pricetags-outline" label={genreLabel} value={selectedGenre}>
            <GenreFilter
              theme={theme}
              genres={genres}
              selected={selectedGenre}
              onSelect={onSelectGenre}
              allGenresLabel={allGenresLabel}
              showAllLabel={showAllLabel}
              showLessLabel={showLessLabel}
            />
          </FilterGroup>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <GlassPressable
          testID="stats-filter-clear"
          onPress={clearAll}
          disabled={!hasFilters}
          style={[styles.clearBtn, { borderColor: theme.border, opacity: hasFilters ? 1 : 0.45 }]}
        >
          <Ionicons name="refresh-outline" size={15} color={theme.text.secondary} />
          <Text style={[styles.clearText, { color: theme.text.secondary }]}>{clearLabel}</Text>
        </GlassPressable>
        <GlassPressable
          testID="stats-filter-done"
          onPress={onClose}
          style={[styles.doneBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.doneText}>{doneLabel}</Text>
        </GlassPressable>
      </View>
    </BottomSheetModal>
  );
});

export default StatsFilterModal;

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 6,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, maxHeight: Math.round(SCREEN_H * 0.56) },
  bodyContent: { paddingBottom: 12, gap: 20 },

  group: { gap: 10 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  // Seçili aralığın / türün özeti; başlığın sağına yaslı.
  groupValue: { flex: 1, textAlign: "right", fontSize: 12, fontWeight: "800" },

  cloud: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipCheck: { marginRight: 4 },
  chipText: { fontSize: 13, flexShrink: 1 },
  chipCount: { marginLeft: 6, fontSize: 11, fontWeight: "700" },

  dateWrap: { gap: 10 },
  // 4 sütun x 3 satır. flexBasis yüzdesi + flexGrow: dar ekranda da 4'lü kalır,
  // geniş ekranda hücreler boşluğu paylaşır.
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell: {
    flexBasis: "22%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  monthCellEmpty: { opacity: 0.4, borderStyle: "dashed" },
  monthName: { fontSize: 13, fontWeight: "700" },
  monthCount: { marginTop: 1, fontSize: 11, fontWeight: "700" },
  dayWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  dayText: { fontSize: 13 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  clearText: { fontSize: 13, fontWeight: "700" },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
  },
  doneText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
