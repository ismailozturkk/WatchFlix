// hooks/useCineSoloDeck.js
//
// CineSwipe SOLO destesinin ağ katmanı: saf durum makinesini (soloReducer) TMDB /
// izleme listesi istekleriyle sürer. Durum geçişleri reducer'dadır; burası yalnız
// "ne zaman istek atılır" ve "yanıt hangi `requestId` ile döner" sorusunu çözer.
//
//   • Deste ilk kez `enabled` olunca (ve hesap değişince) yüklenir; Solo ↔ Duo
//     geçişi desteyi ve sepeti SİLMEZ (eski ekran her dönüşte yeniden yüklüyordu).
//   • Destede `SOLO_PREFETCH_THRESHOLD` kart kalınca sonraki sayfa istenir.
//   • Filtre değişince / 2. tur başlayınca `requestId` yenilenir: eski isteğin geç
//     gelen cevabı reducer'da atılır, yeni desteye karışmaz.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { fetchSwipeDeckPage } from "../services/cineswipe/cineswipeService";
import { DEFAULT_FILTERS, normalizeFilters, sameFilters, tmdbLanguage } from "../services/cineswipe/deckModel";
import { createSoloState, soloReducer, soloView } from "../services/cineswipe/soloReducer";

export default function useCineSoloDeck({ enabled = true, language, userId = null } = {}) {
  const [state, dispatch] = useReducer(soloReducer, undefined, createSoloState);
  const [filters, setFilters] = useState(() => normalizeFilters(DEFAULT_FILTERS));

  const requestRef = useRef(0);
  const filtersRef = useRef(filters);
  const languageRef = useRef(language);
  const userRef = useRef(userId);
  const loadedFor = useRef(null);
  languageRef.current = language;
  userRef.current = userId;

  const fetchPage = useCallback(
    (page, withFilters = filtersRef.current) =>
      fetchSwipeDeckPage({
        ...withFilters,
        language: tmdbLanguage(languageRef.current),
        page,
        userId: userRef.current,
      }),
    [],
  );

  const load = useCallback(
    async (nextFilters, { clearSeen = false } = {}) => {
      const requestId = ++requestRef.current;
      dispatch({ type: "LOAD_START", requestId, clearSeen });
      try {
        const { items, hasMore } = await fetchPage(1, nextFilters);
        dispatch({ type: "LOAD_OK", requestId, items, page: 1, hasMore });
      } catch (error) {
        dispatch({ type: "LOAD_FAIL", requestId });
      }
    },
    [fetchPage],
  );

  // İlk yükleme: Solo sekmesi ilk açıldığında ve hesap değiştiğinde.
  useEffect(() => {
    if (!enabled) return;
    const owner = userId || "anonymous";
    if (loadedFor.current === owner) return;
    loadedFor.current = owner;
    load(filtersRef.current, { clearSeen: true });
  }, [enabled, userId, load]);

  const view = useMemo(() => soloView(state), [state]);

  // Sonraki sayfa: deste azalınca (boş destede de) bir kez istenir.
  useEffect(() => {
    if (!view.needsMore) return;
    const requestId = state.requestId;
    const page = state.page + 1;
    dispatch({ type: "MORE_START", requestId });
    fetchPage(page)
      .then(({ items, hasMore }) => dispatch({ type: "MORE_OK", requestId, items, page, hasMore }))
      .catch(() => dispatch({ type: "MORE_FAIL", requestId }));
  }, [view.needsMore, state.requestId, state.page, fetchPage]);

  const applyFilters = useCallback(
    (next) => {
      const normalized = normalizeFilters(next);
      if (sameFilters(normalized, filtersRef.current)) return false;
      filtersRef.current = normalized;
      setFilters(normalized);
      load(normalized, { clearSeen: false });
      return true;
    },
    [load],
  );

  /** Aynı filtrelerle yeniden yükler; `clearSeen` bu oturumda görülenleri de geri getirir. */
  const reload = useCallback(
    ({ clearSeen = false } = {}) => load(filtersRef.current, { clearSeen }),
    [load],
  );

  const resetFilters = useCallback(() => {
    const normalized = normalizeFilters(DEFAULT_FILTERS);
    filtersRef.current = normalized;
    setFilters(normalized);
    load(normalized, { clearSeen: true });
  }, [load]);

  const swipe = useCallback((direction) => dispatch({ type: "SWIPE", direction }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const retryMore = useCallback(() => dispatch({ type: "RETRY_MORE" }), []);
  const removeFromBasket = useCallback((key) => dispatch({ type: "REMOVE_FROM_BASKET", key }), []);
  const clearBasket = useCallback(() => dispatch({ type: "CLEAR_BASKET" }), []);
  const startFinal = useCallback((items) => {
    // Yeni requestId: sürmekte olan sayfa isteği eskimiş sayılır, final destesine eklenmez.
    const requestId = ++requestRef.current;
    dispatch({ type: "START_FINAL", requestId, items });
  }, []);

  return {
    state,
    view,
    filters,
    applyFilters,
    resetFilters,
    reload,
    swipe,
    undo,
    retryMore,
    removeFromBasket,
    clearBasket,
    startFinal,
  };
}
