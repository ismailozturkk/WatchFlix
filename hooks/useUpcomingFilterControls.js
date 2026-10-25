// hooks/useUpcomingFilterControls.js
//
// "Yaklaşan Filmler" süzgecinin ekran tarafı: sayfanın açık/kapalı durumu, hazır aralık çipi, sayfadan
// uygulama, boş durumdaki sıfırlama ve ölçüm. Raf (screens/movie/MovieUpcoming.js) ve "Tümü" ekranı
// (screens/shared/SeeAllScreen.js) aynı davranışı bu kancadan alır.
import { useCallback, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { triggerHaptic } from "../services/hapticsService";
import { tmdbRegionOf } from "../utils/appLanguages";
import {
  DEFAULT_UPCOMING_FILTERS,
  countActiveUpcomingFilters,
  normalizeUpcomingFilters,
  sameUpcomingFilters,
  setUpcomingRange,
} from "../utils/upcomingFilters";
import { useUpcomingFilters, writeUpcomingFilters } from "./useUpcomingFilters";

/** @param {"rail"|"see_all"} surface  ölçümde hangi yüzeyden uygulandığı */
export default function useUpcomingFilterControls(surface) {
  const { language } = useLanguage();
  const filters = useUpcomingFilters();
  const [sheetVisible, setSheetVisible] = useState(false);

  const apply = useCallback(
    (next, source) => {
      const normalized = normalizeUpcomingFilters(next);
      if (sameUpcomingFilters(normalized, filters)) return;
      writeUpcomingFilters(normalized);
      trackEvent(ANALYTICS_EVENTS.UPCOMING_FILTER_APPLIED, {
        source,
        surface,
        range: normalized.range,
        scope: normalized.scope,
        sort: normalized.sort,
        genre_count: normalized.genres.length,
        filter_count: countActiveUpcomingFilters(normalized),
      });
    },
    [filters, surface],
  );

  const selectRange = useCallback(
    (range) => {
      if (filters.range === range) return;
      try { triggerHaptic("selection"); } catch (e) {}
      apply(setUpcomingRange(filters, range), "chip");
    },
    [apply, filters],
  );

  const applyFromSheet = useCallback(
    (draft) => {
      setSheetVisible(false);
      apply(draft, "sheet");
    },
    [apply],
  );

  const reset = useCallback(() => apply(DEFAULT_UPCOMING_FILTERS, "reset"), [apply]);
  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  return {
    filters,
    region: tmdbRegionOf(language),
    sheetVisible,
    openSheet,
    closeSheet,
    selectRange,
    applyFromSheet,
    reset,
  };
}
