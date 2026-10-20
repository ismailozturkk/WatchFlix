// hooks/useFilteredDiscover.js
//
// "Ne izlesem?" sonuç akışı: süzgeç → TMDB `/discover` → sayfalama → "izlediklerimi gizle" →
// "Şaşırt beni". Karar mantığı (URL, imza, birleştirme, otomatik doldurma) utils/discoverFilters.js'te
// saf ve testli; burada yalnız React/ağ bağlaması var.
//
// ESKİ CEVABI ATMA: süzgeç hızla değişince önceki isteğin geç gelen cevabı yeni listenin üstüne
// yazılmasın diye her akış bir `run` numarası taşır; numara değiştiyse cevap sessizce atılır.
//
// "İZLEDİKLERİMİ GİZLE" SORGUYA GİRMEZ: TMDB kullanıcının kütüphanesini bilmez, bu yüzden yalnız
// istemcide süzülür. Anahtarı açıp kapamak listeyi baştan YÜKLEMEZ, eldeki sonuçları anında süzer.
//
// OTOMATİK DOLDURMA: gizleme bir sayfayı tamamen boşaltabilir; liste kısa kalınca kaydırılamaz ve
// kullanıcı sonrakini hiç tetikleyemezdi. Görünür sonuç sayısı hedefe ulaşana dek (en çok
// MAX_AUTOFILL_PAGES sayfa) kendiliğinden sonraki sayfa çekilir. Kütüphane durumu geç yüklenirse ya da
// anahtar sonradan açılırsa aynı doldurma bir kez daha çalışır (sorgu başına en çok TOP_UP_LIMIT kez —
// kütüphane her değiştiğinde sınırsız sayfa çekmesin).
//
// `now` (dönem sınırları için bugün) her akış başında bir kez alınır, sayfalar arasında SABİT kalır:
// gece yarısını aşan uzun bir oturumda 1. ve 5. sayfa farklı tarih aralığına bakmasın.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiSettings, useStreamingProviderSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { fetchDiscoverPage } from "../services/discoverQuery";
import { tmdbLanguageOf, tmdbRegionOf } from "../utils/appLanguages";
import {
  applyHideWatched,
  mergePages,
  normalizeFilters,
  pickSurprise,
  shouldFetchMore,
  surprisePageLimit,
} from "../utils/discoverFilters";
import { randomInt } from "../utils/randomPick";

const INITIAL = Object.freeze({
  items: [],
  page: 0,
  totalPages: 1,
  status: "loading", // "loading" | "ready" | "error"
  loadingMore: false,
});

/** Bir sorgu için kütüphane değişince en çok bu kadar kez yeniden doldurulur. */
export const TOP_UP_LIMIT = 3;

/**
 * @param {object} props
 * @param {"movie"|"tv"} props.mediaType
 * @param {object} props.filters
 * @param {Date} [props.now] yalnız test için
 */
export default function useFilteredDiscover({ mediaType, filters, now }) {
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const listStatus = useListStatusContext();
  const statusIndex = listStatus?.statusIndex;

  const tmdbLanguage = tmdbLanguageOf(language);
  const tmdbRegion = tmdbRegionOf(language);
  const normalized = useMemo(() => normalizeFilters(filters, mediaType), [filters, mediaType]);
  const hideWatched = normalized.hideWatched;

  const [state, setState] = useState(INITIAL);
  const [nonce, setNonce] = useState(0);

  const runRef = useRef(0);
  const busyRef = useRef(false);
  const topUpRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const statusRef = useRef(statusIndex);
  statusRef.current = statusIndex;
  const hideRef = useRef(hideWatched);
  hideRef.current = hideWatched;
  const nowRef = useRef(now || new Date());

  // Sorguya giren her şey tek anahtarda: değişirse akış baştan başlar. `hideWatched` BİLEREK yok.
  const queryKey = useMemo(
    () =>
      JSON.stringify([
        mediaType,
        { ...normalized, hideWatched: false },
        tmdbLanguage,
        tmdbRegion,
        normalized.onMyPlatforms ? streamingProviderIds : null,
        nonce,
      ]),
    [mediaType, normalized, tmdbLanguage, tmdbRegion, streamingProviderIds, nonce],
  );
  const queryRef = useRef(null);
  queryRef.current = {
    mediaType,
    filters: normalized,
    language: tmdbLanguage,
    region: tmdbRegion,
    providerIds: streamingProviderIds,
    apiKey: API_KEY,
  };

  const visibleOf = useCallback(
    (items) => (hideRef.current ? applyHideWatched(items, statusRef.current, queryRef.current.mediaType) : items),
    [],
  );

  /** `startPage`tan başlayıp hedef dolana dek sayfa çeker; her sayfada durumu günceller. */
  const run = useCallback(
    async (runId, startPage, previous) => {
      busyRef.current = true;
      let items = previous;
      let page = startPage - 1;
      let pagesFetched = 0;
      try {
        for (;;) {
          const result = await fetchDiscoverPage({ ...queryRef.current, page: page + 1, now: nowRef.current });
          if (runRef.current !== runId) return; // eski akış: cevap atılır
          items = mergePages(items, result.results);
          page += 1;
          pagesFetched += 1;
          const more = shouldFetchMore({
            visibleCount: visibleOf(items).length,
            page,
            totalPages: result.totalPages,
            pagesFetched,
          });
          setState({ items, page, totalPages: result.totalPages, status: "ready", loadingMore: more });
          if (!more) return;
        }
      } catch (error) {
        if (runRef.current !== runId) return;
        if (__DEV__) console.warn("useFilteredDiscover:", error?.message || error);
        // İlk sayfa hiç gelmediyse hata ekranı; sonraki sayfada eldekiler korunur, tekrar denenebilir.
        setState((current) =>
          current.items.length === 0 && page === 0
            ? { ...INITIAL, status: "error", loadingMore: false }
            : { ...current, loadingMore: false },
        );
      } finally {
        if (runRef.current === runId) busyRef.current = false;
      }
    },
    [visibleOf],
  );

  // Süzgeç / dil / bölge / platform değişince baştan başla.
  useEffect(() => {
    runRef.current += 1;
    busyRef.current = false;
    topUpRef.current = 0;
    nowRef.current = now || new Date();
    setState(INITIAL);
    run(runRef.current, 1, []);
    return () => {
      // Ekran kapanınca uçuştaki cevap atılsın (unmount sonrası setState uyarısı yok).
      runRef.current += 1;
    };
    // `run`, sorgu parçalarını ref'ten okur; queryKey değişimi tek tetikleyici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (busyRef.current || current.status !== "ready" || current.page >= current.totalPages) return;
    busyRef.current = true;
    setState({ ...current, loadingMore: true });
    run(runRef.current, current.page + 1, current.items);
  }, [run]);

  // Gizleme açıldı ya da kütüphane durumu (geç) geldi: görünür sayı hedefin altına düştüyse doldur.
  useEffect(() => {
    const current = stateRef.current;
    if (!hideWatched || current.status !== "ready" || busyRef.current) return;
    if (topUpRef.current >= TOP_UP_LIMIT) return;
    const needsMore = shouldFetchMore({
      visibleCount: visibleOf(current.items).length,
      page: current.page,
      totalPages: current.totalPages,
      pagesFetched: 0,
    });
    if (!needsMore) return;
    topUpRef.current += 1;
    loadMore();
  }, [hideWatched, statusIndex, state.items, visibleOf, loadMore]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const items = useMemo(
    () => (hideWatched ? applyHideWatched(state.items, statusIndex, mediaType) : state.items),
    [hideWatched, state.items, statusIndex, mediaType],
  );

  /**
   * "Şaşırt beni": süzgece uyan sonuçların ilk birkaç sayfasından rastgele bir sayfa çeker, izlenenleri
   * eler, afişli birini seçer. Bulamazsa null; ağ hatasında FIRLATIR (ekran kullanıcıya söyler).
   */
  const surprise = useCallback(async () => {
    const known = stateRef.current;
    const limit = surprisePageLimit(known.status === "ready" ? known.totalPages : 1);
    const pageNumber = randomInt(limit) + 1;
    const result = await fetchDiscoverPage({ ...queryRef.current, page: pageNumber, now: nowRef.current });
    return pickSurprise(visibleOf(result.results), randomInt);
  }, [visibleOf]);

  return {
    items,
    status: state.status,
    loading: state.status === "loading",
    loadingMore: state.loadingMore,
    hasMore: state.page < state.totalPages,
    loadMore,
    reload,
    surprise,
  };
}
