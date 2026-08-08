import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  useApiSettings,
  useStreamingProviderSettings,
} from "./AppSettingsContext";
import { useLanguage } from "./LanguageContext";
import { useListStatusContext } from "./ListStatusContext";
import axios from "axios";
// `getCachedValue` hâlâ kullanılıyor: sağlayıcı/tür listelerinin TTL'i zaten
// 24 saat ve 7 gün, yani her açılışta ağ beklemeye yol açmıyorlar. Ayrıca
// sağlayıcı okumasının önbellek isabetinde YAN ETKİSİ var (bir sağlayıcı seçip
// içeriğini çekiyor); SWR'a çevirmek o isteği ikiye katlardı.
import { getCachedValue, getSwr, seedList, setCachedValue, TTL } from "../utils/apiCache";
import { setIfChanged, setListIfChanged } from "../utils/sameData";
import { i18nText } from "../utils/i18nText";
import { getWatchedShowActivityTime } from "../utils/watchState";


const TvShowContext = createContext();
export const useTvShow = () => useContext(TvShowContext);

// `sameJson`/`setIfChanged` buradan utils/sameData.js'e taşındı: aynı iki satır
// bu dosyada, MovieContex'te, ListStatusContext'te ve MediaActivityContext'te
// ayrı ayrı yazılıydı.

// id'ye göre tekilleştirerek append eder (sayfalar arası tekrarları eler).
const mergeUniqueById = (prev, next) => {
  if (!Array.isArray(next)) return prev;
  const seen = new Set(prev.map((x) => x && x.id));
  return [...prev, ...next.filter((x) => x && !seen.has(x.id))];
};

// Trend state'i yalnızca gerçek TMDB kayıtlarını tutar. Eski cache sürümleri
// spacer kayıtları içerebildiği için hem mevcut hem de yeni veriyi normalize et.
const mergeTrendItems = (prev, next) => {
  const realItems = (items) =>
    (Array.isArray(items) ? items : []).filter(
      (x) => x && x.id !== "left-spacer" && x.id !== "right-spacer",
    );
  return mergeUniqueById(realItems(prev), realItems(next));
};

// Sayfalı bölümlerin ortak yükleyicisi: cache okuma, loading bayrakları,
// append/replace + dedup mantığını tek yerde toplar.
// `isStale`: kategori/dil değişince eski (in-flight) isteğin sonucu yeni
// listeye karışmasın diye sonuç uygulanmadan önce kontrol edilir.
const loadPage = async ({
  cacheKey,
  ttl,
  append,
  request,
  setData,
  setTotal,
  setLoading,
  setLoadingMore,
  isStale,
}) => {
  // `arkaPlan`: ekranda zaten (bayat) veri var, tazeleme sessizce yapılıyor.
  // Böyle durumda listeyi KİMLİK bazında karşılaştırıyoruz — TMDB aynı listeyi
  // her istekte biraz farklı `popularity` ondalığıyla döndürdüğü için tam
  // karşılaştırma, kullanıcı için hiçbir fark olmadığı hâlde tüm rayı yeniden
  // çizdirirdi.
  const apply = (results, totalPages, { arkaPlan = false } = {}) => {
    if (isStale?.()) return;
    if (setTotal) setTotal(totalPages || 1);
    if (append) setData((prev) => mergeUniqueById(prev, results));
    else if (arkaPlan) setListIfChanged(setData, results);
    else setIfChanged(setData, results);
  };

  // BAYAT GÖSTER, ARKA PLANDA TAZELE. Eskiden TTL dolunca cache "yok" sayılır,
  // ray iskelete düşer ve ağ beklenirdi; trend TTL'i 1 saat olduğu için bu
  // pratikte her açılış demekti. Artık bayat kayıt hemen çiziliyor, tazeleme
  // arka planda ve "yükleniyor" göstermeden yapılıyor.
  const cached = getSwr(cacheKey, { maxAge: ttl });
  const cachedData = cached.data;
  if (cachedData) {
    apply(cachedData.results ?? cachedData, cachedData.total_pages ?? 1);
    (append ? setLoadingMore : setLoading)(false);
    if (cached.fresh) return;
  } else {
    (append ? setLoadingMore : setLoading)(true);
  }

  try {
    const { results, total_pages } = await request();
    apply(results, total_pages, { arkaPlan: Boolean(cachedData) });
    setCachedValue(cacheKey, { results, total_pages });
  } catch (error) {
    if (__DEV__) console.error("loadPage:", error?.message || error);
  } finally {
    // Bayat veriyle tazeleme yapıldıysa loading zaten false; tekrar false
    // yazmak zararsız ama gereksiz render üretmesin diye yalnız gerekince.
    if (!cachedData) (append ? setLoadingMore : setLoading)(false);
  }
};

export const TvShowProvider = ({ children }) => {
  const [activeSections, setActiveSections] = useState({});
  const activateTvSection = useCallback((section) => {
    setActiveSections((current) => {
      if (current[section]) return current;
      return { ...current, [section]: true };
    });
  }, []);

  // Bölüm başına istek jenerasyonu: fresh (sayfa 1) fetch jenerasyonu artırır,
  // append aynı jenerasyonda kalır. Kategori/dil değişince eski in-flight
  // isteklerin sonuçları stale sayılır ve state'e uygulanmaz.
  const requestGenRef = useRef({});
  const beginFreshRequest = (key) => {
    requestGenRef.current[key] = (requestGenRef.current[key] || 0) + 1;
    return requestGenRef.current[key];
  };
  const currentGen = (key) => requestGenRef.current[key] || 0;

  const { API_KEY } = useApiSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const { language } = useLanguage();

  // ── AÇILIŞ TOHUMLARI ──────────────────────────────────────────────────────
  //
  // Son oturumda görülen listeler MMKV'den SENKRON okunuyor, yani İLK KAREDE
  // çiziliyor. Eskiden state `[]` + `loading:true` ile başlıyordu; önbellek
  // DOLU olsa bile veri ancak efekt çalıştıktan sonra geldiği için kullanıcı
  // her açılışta bir kare iskelet görüyordu.
  //
  // `useMemo(..., [])`: tohum yalnız ilk render için. Kategori/dil değişimini
  // ilgili efekt zaten yeniden çekiyor.
  const seedLang = language === "tr" ? "tr-TR" : "en-US";
  const trendSeed = useMemo(
    () => seedList(`tv_trends_${seedLang}_week_trending`, { maxAge: TTL.TREND }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const bestSeed = useMemo(
    () =>
      seedList(`tv_bests_${seedLang}_discover_vote_count_page_1`, {
        maxAge: TTL.TREND,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Eski cache sürümleri spacer kaydı içerebiliyor; tohumu da normalize et.
  const [seriesTrend, setSeriesTrend] = useState(() =>
    mergeTrendItems([], trendSeed.list),
  );
  const [loadingTrend, setLoadingTren] = useState(!trendSeed.hasCache);
  const [loadingMoreTrend, setLoadingMoreTrend] = useState(false);
  const [pageTrend, setPageTrend] = useState(1);
  // Tohumla açıldığında "daha fazla yükle" hemen çalışabilsin; gerçek değeri
  // ilk istek yazacak.
  const [totalPagesTrend, setTotalPagesTrend] = useState(
    trendSeed.hasCache ? 1000 : 1,
  );
  const [selectedCategoryTrend, setSelectedCategoryTrend] = useState("week");
  const [selectedCategoryTrendShow, setSelectedCategoryTrendShow] =
    useState("trending");
  const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
  const tmdbRegion = language === "tr" ? "TR" : "US";
  const { t } = useLanguage();
  // İzlenen dizilerin tek kaynağı yeni watchedTv subcollection listener'ıdır.
  // Kök dokümandaki legacy watchedTv[] migration sonrasında boşaltıldığı için onu
  // ayrıca dinlemek ana ekranda eksik/eski veri gösteriyordu.
  const { watchedTvMap, watchedTvLoaded } = useListStatusContext();
  const watchedTvShows = useMemo(
    () =>
      Object.entries(watchedTvMap || {})
        .map(([docId, show]) => ({
          ...show,
          id: show?.id ?? docId,
          type: show?.type || "tv",
        }))
        .filter((show) => show.id != null)
        .sort(
          (a, b) =>
            getWatchedShowActivityTime(b) - getWatchedShowActivityTime(a),
        ),
    [watchedTvMap],
  );
  const loadingWatchedTv = !watchedTvLoaded;
  const [refreshing, setRefreshing] = useState(false);

  const categoriesTrends = ["week", "day"];
  const getCategoryTitleTrends = (category) => {
    switch (category) {
      case "week":
        return t.tvShowScreens.trendWeek;
      case "day":
        return t.tvShowScreens.trendDay;
      default:
        return category;
    }
  };

  const fetchSeriesTrends = async (page = 1, append = false) => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const gen = append ? currentGen("trends") : beginFreshRequest("trends");
    const isStale = () => currentGen("trends") !== gen;
    const baseKey = `tv_trends_${lang}_${selectedCategoryTrend}_${selectedCategoryTrendShow}`;
    const cacheKey = page === 1 ? baseKey : `${baseKey}_p${page}`;

    // Bayat göster, arka planda tazele — bkz. loadPage'deki aynı desen.
    const swr = getSwr(cacheKey, { maxAge: TTL.TREND });
    const cached = swr.data;
    if (cached) {
      if (isStale()) return;
      if (append) {
        setSeriesTrend((prev) => mergeTrendItems(prev, cached.results ?? cached));
        setLoadingMoreTrend(false);
      } else {
        // Eski spacer'lı cache kayıtlarını da okurken temizle.
        setIfChanged(setSeriesTrend, mergeTrendItems([], cached.results ?? cached));
        setLoadingTren(false);
        setTotalPagesTrend((p) => (p > 1 ? p : 1000));
      }
      if (swr.fresh) return;
    } else {
      (append ? setLoadingMoreTrend : setLoadingTren)(true);
    }

    try {
      const response = await axios.request({
        method: "GET",
        url: `https://api.themoviedb.org/3/${selectedCategoryTrendShow}/tv/${selectedCategoryTrend}`,
        params: {
          include_adult: "false",
          include_null_first_air_dates: "false",
          language: lang,
          page,
        },
        headers: { accept: "application/json", Authorization: API_KEY },
      });
      const results = response.data.results || [];
      // Cache doğru anahtara yazılabilir; yalnızca state güncellemesi stale'de atlanır.
      setCachedValue(append ? cacheKey : baseKey, results);
      if (isStale()) return;
      setTotalPagesTrend(response.data.total_pages || 1);
      if (append) {
        setSeriesTrend((prev) => mergeTrendItems(prev, results));
      } else if (cached) {
        // Arka plan tazelemesi: yalnız içerik gerçekten değiştiyse rayı
        // yeniden çiz (bkz. loadPage'deki `arkaPlan` açıklaması).
        setListIfChanged(setSeriesTrend, mergeTrendItems([], results));
      } else {
        setIfChanged(setSeriesTrend, mergeTrendItems([], results));
      }
    } catch (error) {
      if (__DEV__) console.error("fetchSeriesTrends:", error?.message || error);
    } finally {
      if (!cached) (append ? setLoadingMoreTrend : setLoadingTren)(false);
    }
  };
  useEffect(() => {
    if (!activeSections.trends) return;
    setPageTrend(1);
    fetchSeriesTrends(1, false);
  }, [activeSections.trends, selectedCategoryTrend, selectedCategoryTrendShow, language]);

  const loadMoreTrend = () => {
    if (loadingTrend || loadingMoreTrend || pageTrend >= totalPagesTrend) return;
    const next = pageTrend + 1;
    setPageTrend(next);
    fetchSeriesTrends(next, true);
  };

  const [seriesBest, setSeriesBest] = useState(bestSeed.list);
  const [loadingBest, setLoadingBest] = useState(!bestSeed.hasCache);
  const [selectedCategoryBestShow, setSelectedCategoryBestShow] =
    useState("discover");
  const [selectedCategoryBest, setSelectedCategoryBest] =
    useState("vote_count");
  const [pageBest, setPageBest] = useState(1);
  const [totalPagesBest, setTotalPagesBest] = useState(1);
  const [loadingMoreBest, setLoadingMoreBest] = useState(false);
  const categoriesBest = ["vote_count", "popularity"];
  const getCategoryTitleBest = (category) => {
    switch (category) {
      case "vote_count":
        return t.tvShowScreens.voted;
      case "popularity":
        return t.tvShowScreens.popular;
      default:
        return category;
    }
  };

  const fetchSeriesBest = (page = 1, append = false) => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const gen = append ? currentGen("best") : beginFreshRequest("best");
    return loadPage({
      cacheKey: `tv_bests_${lang}_${selectedCategoryBestShow}_${selectedCategoryBest}_page_${page}`,
      ttl: TTL.TREND,
      append,
      isStale: () => currentGen("best") !== gen,
      setData: setSeriesBest,
      setTotal: setTotalPagesBest,
      setLoading: setLoadingBest,
      setLoadingMore: setLoadingMoreBest,
      request: async () => {
        const response = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/${selectedCategoryBestShow}/tv`,
          params: {
            include_adult: "false",
            include_null_first_air_dates: "false",
            language: lang,
            page,
            sort_by: `${selectedCategoryBest}.desc`,
            "vote_count.gte": "500",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };
  useEffect(() => {
    if (!activeSections.best) return;
    setPageBest(1);
    fetchSeriesBest(1, false);
  }, [activeSections.best, selectedCategoryBest, selectedCategoryBestShow, language]);

  const loadMoreBest = () => {
    if (loadingBest || loadingMoreBest || pageBest >= totalPagesBest) return;
    const next = pageBest + 1;
    setPageBest(next);
    fetchSeriesBest(next, true);
  };

  const [moviesAiringToday, setMoviesAiringToday] = useState([]);
  const [totalPagesAiringToday, setTotalPagesAiringToday] = useState(1);
  const [loadingAiringToday, setLoadingAiringToday] = useState(true);
  const [loadingMoreAiringToday, setLoadingMoreAiringToday] = useState(false);
  const [pageAiringToday, setPageAiringToday] = useState(1);

  const fetchAiringToday = (page = 1, append = false) => {
    const gen = append ? currentGen("airingToday") : beginFreshRequest("airingToday");
    return loadPage({
      cacheKey: `tv_airing_today_${tmdbLanguage}_${tmdbRegion}_page_${page}`,
      ttl: TTL.NOW_PLAYING,
      append,
      isStale: () => currentGen("airingToday") !== gen,
      setData: setMoviesAiringToday,
      setTotal: setTotalPagesAiringToday,
      setLoading: setLoadingAiringToday,
      setLoadingMore: setLoadingMoreAiringToday,
      request: async () => {
        const url = `https://api.themoviedb.org/3/tv/airing_today?include_adult=false&include_video=false&language=${tmdbLanguage}&region=${tmdbRegion}&page=${page}&sort_by=popularity.desc`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };
  useEffect(() => {
    if (!activeSections.airingToday) return;
    setPageAiringToday(1);
    fetchAiringToday(1, false);
  }, [activeSections.airingToday, language]);

  const loadMoreAiringToday = () => {
    if (loadingAiringToday || loadingMoreAiringToday || pageAiringToday >= totalPagesAiringToday) return;
    const next = pageAiringToday + 1;
    setPageAiringToday(next);
    fetchAiringToday(next, true);
  };

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [moviesProviders, setMoviesProviders] = useState([]);
  const [loadingMoviesByProvider, setLoadingMoviesByProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [loadingMoreProvider, setLoadingMoreProvider] = useState(false);
  const [pageProvider, setPageProvider] = useState(1);
  const [totalPagesProvider, setTotalPagesProvider] = useState(1);
  //const [fetchMoviesByProvider, setFetchMoviesByProvider] = useState(false);

  // Sağlayıcıları çek
  useEffect(() => {
    if (!activeSections.providers) return;
    fetchProviders();
  }, [activeSections.providers, language, streamingProviderIds]);

  const fetchProviders = async () => {
    const cacheKey = `tv_providers_${tmdbLanguage}_${tmdbRegion}`;
    const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
    if (cached) {
      setIfChanged(setProviders, cached);
      if (cached.length > 0) {
        const preferred =
          cached.find((provider) =>
            streamingProviderIds.includes(provider.provider_id),
          ) || cached[0];
        setSelectedProvider(preferred.provider_id);
        fetchMoviesByProvider(preferred.provider_id);
      }
      setLoadingProvider(false);
      return;
    }

    setLoadingProvider(true);
    try {
      const url = `https://api.themoviedb.org/3/watch/providers/tv?language=${tmdbLanguage}&watch_region=${tmdbRegion}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      const results = response.data.results;
      setIfChanged(setProviders, results);
      setCachedValue(cacheKey, results);
      if (results.length > 0) {
        const preferred =
          results.find((provider) =>
            streamingProviderIds.includes(provider.provider_id),
          ) || results[0];
        setSelectedProvider(preferred.provider_id);
        fetchMoviesByProvider(preferred.provider_id);
      }
    } catch (err) {
      if (__DEV__) console.error(i18nText("autoI18n.saglayicilari_cekerken_hata", "Sağlayıcıları çekerken hata:"), err.message);
    } finally {
      setLoadingProvider(false);
    }
  };

  // Seçilen sağlayıcıya göre dizileri çek (sayfalı)
  const fetchMoviesByProvider = (providerId, page = 1, append = false) => {
    if (!append) {
      setSelectedProvider(providerId);
      setPageProvider(1);
    }
    const gen = append ? currentGen("provider") : beginFreshRequest("provider");
    return loadPage({
      cacheKey: `tv_provider_${tmdbLanguage}_${tmdbRegion}_${providerId}_p${page}`,
      ttl: TTL.PROVIDERS,
      append,
      isStale: () => currentGen("provider") !== gen,
      setData: setMoviesProviders,
      setTotal: setTotalPagesProvider,
      setLoading: setLoadingMoviesByProvider,
      setLoadingMore: setLoadingMoreProvider,
      request: async () => {
        const url = `https://api.themoviedb.org/3/discover/tv?language=${tmdbLanguage}&watch_region=${tmdbRegion}&with_watch_providers=${providerId}&sort_by=vote_count.desc&page=${page}`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };

  const loadMoreProvider = () => {
    if (
      loadingMoviesByProvider ||
      loadingMoreProvider ||
      !selectedProvider ||
      pageProvider >= totalPagesProvider
    )
      return;
    const next = pageProvider + 1;
    setPageProvider(next);
    fetchMoviesByProvider(selectedProvider, next, true);
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]);
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [loadingMoreGenres, setLoadingMoreGenres] = useState(false);
  const [pageGenres, setPageGenres] = useState(1);
  const [totalPagesGenres, setTotalPagesGenres] = useState(1);

  const tvGenres = async () => {
    const cacheKey = `tv_genres_${tmdbLanguage}`;
    const cached = await getCachedValue(cacheKey, TTL.GENRES);
    if (cached) {
      setIfChanged(setGenres, cached);
      setLoadingGenres(false);
      return;
    }

    try {
      const url = `https://api.themoviedb.org/3/genre/tv/list?language=${tmdbLanguage}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setGenres, response.data.genres);
      setCachedValue(cacheKey, response.data.genres);
    } catch (err) {
      if (__DEV__) console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };

  // Seçilen türlere göre filmleri almak

  const fetchTvByGenres = (page = 1, append = false) => {
    const genresKey = [...selectedGenres].sort().join(",");
    const gen = append ? currentGen("genres") : beginFreshRequest("genres");
    return loadPage({
      cacheKey: `tv_genres_content_${tmdbLanguage}_p${page}_g${genresKey}`,
      ttl: TTL.TREND,
      append,
      isStale: () => currentGen("genres") !== gen,
      setData: setMoviesGenres,
      setTotal: setTotalPagesGenres,
      setLoading: setLoadingGenres,
      setLoadingMore: setLoadingMoreGenres,
      request: async () => {
        let url = `https://api.themoviedb.org/3/discover/tv?language=${tmdbLanguage}&page=${page}`;
        if (selectedGenres.length > 0) url += `&with_genres=${genresKey}`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };
  useEffect(() => {
    if (!activeSections.genres) return;
    tvGenres();
    setPageGenres(1);
    fetchTvByGenres(1, false);
  }, [activeSections.genres, language, selectedGenres]);

  const loadMoreGenres = () => {
    if (loadingGenres || loadingMoreGenres || pageGenres >= totalPagesGenres) return;
    const next = pageGenres + 1;
    setPageGenres(next);
    fetchTvByGenres(next, true);
  };

  const [moviesOnTheAir, setMoviesOnTheAir] = useState([]);
  const [totalPagesOnTheAir, setTotalPagesOnTheAir] = useState(1);
  const [loadingOnTheAir, setLoadingOnTheAir] = useState(true);
  const [loadingMoreOnTheAir, setLoadingMoreOnTheAir] = useState(false);
  const [pageOnTheAir, setPageOnTheAir] = useState(1);

  const fetchOnTheAir = (page = 1, append = false) => {
    const gen = append ? currentGen("onTheAir") : beginFreshRequest("onTheAir");
    return loadPage({
      cacheKey: `tv_on_the_air_${tmdbLanguage}_${tmdbRegion}_page_${page}`,
      ttl: TTL.NOW_PLAYING,
      append,
      isStale: () => currentGen("onTheAir") !== gen,
      setData: setMoviesOnTheAir,
      setTotal: setTotalPagesOnTheAir,
      setLoading: setLoadingOnTheAir,
      setLoadingMore: setLoadingMoreOnTheAir,
      request: async () => {
        const url = `https://api.themoviedb.org/3/tv/on_the_air?include_adult=false&include_video=false&language=${tmdbLanguage}&region=${tmdbRegion}&page=${page}&sort_by=popularity.desc`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };
  useEffect(() => {
    if (!activeSections.onTheAir) return;
    setPageOnTheAir(1);
    fetchOnTheAir(1, false);
  }, [activeSections.onTheAir, language]);

  const loadMoreOnTheAir = () => {
    if (loadingOnTheAir || loadingMoreOnTheAir || pageOnTheAir >= totalPagesOnTheAir) return;
    const next = pageOnTheAir + 1;
    setPageOnTheAir(next);
    fetchOnTheAir(next, true);
  };

  const contextValue = useMemo(() => ({
    seriesTrend,
    seriesBest,
    loadingTrend,
    loadingBest,
    selectedCategoryTrend,
    selectedCategoryBest,
    totalPagesBest,
    pageBest,
    moviesAiringToday,
    totalPagesAiringToday,
    loadingAiringToday,
    pageAiringToday,
    providers,
    selectedProvider,
    moviesProviders,
    loadingMoviesByProvider,
    loadingProvider,
    genres,
    selectedGenres,
    pageGenres,
    moviesGenres,
    loadingGenres,
    pageOnTheAir,
    moviesOnTheAir,
    totalPagesOnTheAir,
    loadingOnTheAir,
    categoriesBest,
    categoriesTrends,
    refreshing,
    setRefreshing,

    setPageBest,
    loadMoreBest,
    loadingMoreBest,
    loadMoreAiringToday,
    loadingMoreAiringToday,
    loadMoreGenres,
    loadingMoreGenres,
    totalPagesGenres,
    loadMoreOnTheAir,
    loadingMoreOnTheAir,
    fetchMoviesByProvider,
    loadMoreProvider,
    loadingMoreProvider,
    pageProvider,
    totalPagesProvider,
    loadMoreTrend,
    loadingMoreTrend,
    pageTrend,
    totalPagesTrend,
    setSelectedCategoryTrend,
    setSelectedCategoryTrendShow,
    setSelectedCategoryBestShow,
    setSelectedCategoryBest,
    setPageAiringToday,
    setSelectedGenres,
    setPageGenres,
    setPageOnTheAir,
    activateTvSection,
    getCategoryTitleBest,
    getCategoryTitleTrends,
    watchedTvShows,
    loadingWatchedTv,
    //!
    fetchSeriesTrends,
    fetchSeriesBest,
    fetchAiringToday,
    fetchProviders,
    fetchTvByGenres,
    fetchOnTheAir,
  }), [
    seriesTrend, seriesBest, loadingTrend, loadingBest, selectedCategoryTrend,
    selectedCategoryBest, totalPagesBest, pageBest, moviesAiringToday,
    totalPagesAiringToday, loadingAiringToday, pageAiringToday, providers,
    selectedProvider, moviesProviders, loadingMoviesByProvider, loadingProvider,
    genres, selectedGenres, pageGenres, moviesGenres, loadingGenres, pageOnTheAir,
    moviesOnTheAir, totalPagesOnTheAir, loadingOnTheAir, categoriesBest,
    categoriesTrends, refreshing, watchedTvShows, loadingWatchedTv, activateTvSection,
    loadingMoreBest, loadingMoreAiringToday, loadingMoreGenres, totalPagesGenres,
    loadingMoreOnTheAir,
    loadingMoreProvider, pageProvider, totalPagesProvider,
    loadingMoreTrend, pageTrend, totalPagesTrend,
  ]);

  return (
    <TvShowContext.Provider value={contextValue}>
      {children}
    </TvShowContext.Provider>
  );
};
