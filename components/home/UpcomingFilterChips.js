// components/home/UpcomingFilterChips.js
//
// "Yaklaşan Filmler" rafının çip satırı — hem ana ekrandaki rafta (screens/movie/MovieUpcoming.js) hem
// "Tümü" ekranında (screens/shared/SeeAllScreen.js) AYNI satır kullanılır:
//
//   [⚙ Filtreler · 2] [📅 Aralık 2026]* [1 hafta] [1 ay] [3 ay] [6 ay] [1 yıl] [Tümü] [📅 Tarih seç]**
//     *  yalnız takvim ayı / özel aralık seçiliyken (seçili), dokununca sayfa açılır
//     ** yalnız hazır aralık seçiliyken; ay/özel aralık sayfadan seçilir
//
// Hazır aralık çipi süzgeci DOĞRUDAN uygular (tek dokunuş, eski davranış); geri kalan her şey sayfada.
// Sayaç tarihi saymaz: tarih zaten bu satırda görünüyor.
import React, { memo, useMemo } from "react";
import DiscoverFilterChip from "./DiscoverFilterChip";
import { SectionChipRail } from "./SectionChips";
import { useLanguage } from "../../context/LanguageContext";
import { QUICK_RANGES, countActiveUpcomingFilters } from "../../utils/upcomingFilters";
import { fillCopy, getUpcomingFiltersCopy, upcomingRangeLabel } from "../../utils/upcomingFiltersCopy";

/**
 * @param {object} props.filters        normalize edilmiş süzgeç (useUpcomingFilters)
 * @param {() => void} props.onOpenFilters
 * @param {(range: string) => void} props.onSelectRange   hazır aralık kimliği (QUICK_RANGES)
 * @param {object} [props.style]        SectionChipRail dış kabı
 */
function UpcomingFilterChips({ filters, onOpenFilters, onSelectRange, style }) {
  const { language } = useLanguage();
  const copy = getUpcomingFiltersCopy(language);
  const count = countActiveUpcomingFilters(filters);
  const picked = filters.range === "calendarMonth" || filters.range === "custom";
  const pickedLabel = picked ? upcomingRangeLabel(filters, copy) : "";

  const data = useMemo(
    () => [
      { key: "filters" },
      ...(picked ? [{ key: "picked" }] : []),
      ...QUICK_RANGES.map((id) => ({ key: `range-${id}`, id })),
      ...(picked ? [] : [{ key: "pick" }]),
    ],
    [picked],
  );

  const renderChip = (item) => {
    if (item.key === "filters") {
      return (
        <DiscoverFilterChip
          testID="upcoming-chip-filters"
          icon="options-outline"
          label={count > 0 ? fillCopy(copy.ui.filtersCount, { n: count }) : copy.ui.filters}
          selected={count > 0}
          onPress={onOpenFilters}
        />
      );
    }
    if (item.key === "picked") {
      return (
        <DiscoverFilterChip
          testID="upcoming-chip-picked"
          icon="calendar"
          label={pickedLabel}
          selected
          onPress={onOpenFilters}
        />
      );
    }
    if (item.key === "pick") {
      return (
        <DiscoverFilterChip
          testID="upcoming-chip-pick"
          icon="calendar-outline"
          label={copy.ui.pickDate}
          onPress={onOpenFilters}
        />
      );
    }
    return (
      <DiscoverFilterChip
        testID={`upcoming-chip-range-${item.id}`}
        label={copy.ranges[item.id]}
        selected={filters.range === item.id}
        onPress={() => onSelectRange(item.id)}
      />
    );
  };

  return (
    <SectionChipRail
      data={data}
      keyExtractor={(item) => item.key}
      extraData={`${filters.range}|${pickedLabel}|${count}|${language}`}
      renderChip={renderChip}
      style={style}
    />
  );
}

export default memo(UpcomingFilterChips);
