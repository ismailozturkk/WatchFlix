import { createContext, useContext, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useApiSettings } from "./AppSettingsContext";
import Toast from "react-native-toast-message";
import { useLanguage } from "./LanguageContext";
import { useAuth } from "./AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { snapshotErrorHandler } from "../utils/firestoreError";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";
import { i18nText } from "../utils/i18nText";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";


const TvShowContext = createContext();
export const useTvShow = () => useContext(TvShowContext);

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const setIfChanged = (setter, next) => {
  setter((current) => (sameJson(current, next) ? current : next));
};

// id'ye göre tekilleştirerek append eder (sayfalar arası tekrarları eler).
const mergeUniqueById = (prev, next) => {
  if (!Array.isArray(next)) return prev;
  const seen = new Set(prev.map((x) => x && x.id));
  return [...prev, ...next.filter((x) => x && !seen.has(x.id))];
};

// Trend carousel'i için: kenar spacer'larını koruyarak yeni sayfayı sağ
// spacer'dan ÖNCE ekler (mevcut kartların index/animasyonu bozulmaz).
const rewrapTrends = (prev, next) => {
  const raw = (prev || []).filter(
    (x) => x && x.id !== "left-spacer" && x.id !== "right-spacer",
  );
  const merged = mergeUniqueById(raw, next);
  return [{ id: "left-spacer" }, ...merged, { id: "right-spacer" }];
};

// Sayfalı bölümlerin ortak yükleyicisi: cache okuma, loading bayrakları,
// append/replace + dedup mantığını tek yerde toplar.
const loadPage = async ({
  cacheKey,
  ttl,
  append,
  request,
  setData,
  setTotal,
  setLoading,
  setLoadingMore,
}) => {
  const apply = (results, totalPages) => {
    if (setTotal) setTotal(totalPages || 1);
    if (append) setData((prev) => mergeUniqueById(prev, results));
    else setIfChanged(setData, results);
  };
  const cached = await getCachedValue(cacheKey, ttl);
  if (cached) {
    apply(cached.results ?? cached, cached.total_pages ?? 1);
    (append ? setLoadingMore : setLoading)(false);
    return;
  }
  (append ? setLoadingMore : setLoading)(true);
  try {
    const { results, total_pages } = await request();
    apply(results, total_pages);
    setCachedValue(cacheKey, { results, total_pages });
  } catch (error) {
    if (__DEV__) console.error("loadPage:", error?.message || error);
  } finally {
    (append ? setLoadingMore : setLoading)(false);
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

  const [seriesTrend, setSeriesTrend] = useState([]);
  const [loadingTrend, setLoadingTren] = useState(true);
  const [loadingMoreTrend, setLoadingMoreTrend] = useState(false);
  const [pageTrend, setPageTrend] = useState(1);
  const [totalPagesTrend, setTotalPagesTrend] = useState(1);
  const [selectedCategoryTrend, setSelectedCategoryTrend] = useState("week");
  const [selectedCategoryTrendShow, setSelectedCategoryTrendShow] =
    useState("trending");
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
  const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
  const tmdbRegion = language === "tr" ? "TR" : "US";
  const { t } = useLanguage();
  const { user } = useAuth();

  // ── İzlenen diziler (Firebase + AsyncStorage cache) ────────────────────────
  const WATCHED_TV_CACHE = "cache_watchedTvShows";
  const [watchedTvShows, setWatchedTvShows] = useState([]);
  const [loadingWatchedTv, setLoadingWatchedTv] = useState(true);
  const unsubRef = useRef(null);

  const processShows = (raw) => {
    const filtered = raw.filter((s) => s.type === "tv" || s.seasons !== undefined);
    filtered.sort((a, b) => new Date(b.addedShowDate) - new Date(a.addedShowDate));
    return filtered;
  };

  const startListener = (uid) => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!uid) {
      setWatchedTvShows([]);
      setLoadingWatchedTv(false);
      AsyncStorage.removeItem(WATCHED_TV_CACHE).catch(() => {});
      return;
    }
    const docRef = doc(db, "Lists", uid);
    unsubRef.current = onSnapshot(docRef, (snap) => {
      const raw = processShows(snap.exists() ? snap.data().watchedTv || [] : []);
      setIfChanged(setWatchedTvShows, raw);
      setLoadingWatchedTv(false);
      if (shouldPersistInternetData()) {
        AsyncStorage.setItem(WATCHED_TV_CACHE, JSON.stringify(raw)).catch(() => {});
      }
    }, snapshotErrorHandler("TvShow/watchedTv"));
  };

  // Uygulama açılır açılmaz: önce cache'den yükle, sonra listener başlat
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(WATCHED_TV_CACHE),
      AsyncStorage.getItem("cachedUserId"),
    ]).then(([cached, cachedUid]) => {
      if (cached) {
        setIfChanged(setWatchedTvShows, JSON.parse(cached));
        setLoadingWatchedTv(false);
      }
      if (cachedUid) startListener(cachedUid);
      else if (!cached) setLoadingWatchedTv(false);
    });
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // Auth değişince listener'ı güncelle
  useEffect(() => {
    if (user?.uid) {
      startListener(user.uid);
    } else if (user === null) {
      startListener(null);
    }
  }, [user?.uid]);
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
    const baseKey = `tv_trends_${lang}_${selectedCategoryTrend}_${selectedCategoryTrendShow}`;
    const cacheKey = page === 1 ? baseKey : `${baseKey}_p${page}`;

    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      if (append) {
        setSeriesTrend((prev) => rewrapTrends(prev, cached.results ?? cached));
        setLoadingMoreTrend(false);
      } else {
        // page 1 önbelleği spacer'lı tam dizi (offline indirme ile uyumlu)
        setIfChanged(setSeriesTrend, cached);
        setLoadingTren(false);
        setTotalPagesTrend((p) => (p > 1 ? p : 1000));
      }
      return;
    }

    (append ? setLoadingMoreTrend : setLoadingTren)(true);
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
      setTotalPagesTrend(response.data.total_pages || 1);
      if (append) {
        setSeriesTrend((prev) => rewrapTrends(prev, results));
        setCachedValue(cacheKey, results);
      } else {
        const data = [
          { id: "left-spacer" },
          ...results,
          { id: "right-spacer" },
        ];
        setIfChanged(setSeriesTrend, data);
        setCachedValue(baseKey, data);
      }
    } catch (error) {
      if (__DEV__) console.error("fetchSeriesTrends:", error?.message || error);
    } finally {
      (append ? setLoadingMoreTrend : setLoadingTren)(false);
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

  const [seriesBest, setSeriesBest] = useState([]);
  const [loadingBest, setLoadingBest] = useState(true);
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
    return loadPage({
      cacheKey: `tv_bests_${lang}_${selectedCategoryBestShow}_${selectedCategoryBest}_page_${page}`,
      ttl: TTL.TREND,
      append,
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
    return loadPage({
      cacheKey: `tv_airing_today_${tmdbLanguage}_${tmdbRegion}_page_${page}`,
      ttl: TTL.NOW_PLAYING,
      append,
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
  }, [activeSections.providers, language]);

  const fetchProviders = async () => {
    const cacheKey = `tv_providers_${tmdbLanguage}_${tmdbRegion}`;
    const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
    if (cached) {
      setIfChanged(setProviders, cached);
      if (cached.length > 0) {
        setSelectedProvider(cached[0].provider_id);
        fetchMoviesByProvider(cached[0].provider_id);
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
        setSelectedProvider(results[0].provider_id);
        fetchMoviesByProvider(results[0].provider_id);
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
    return loadPage({
      cacheKey: `tv_provider_${tmdbLanguage}_${tmdbRegion}_${providerId}_p${page}`,
      ttl: TTL.PROVIDERS,
      append,
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
    return loadPage({
      cacheKey: `tv_genres_content_${tmdbLanguage}_p${page}_g${genresKey}`,
      ttl: TTL.TREND,
      append,
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
    return loadPage({
      cacheKey: `tv_on_the_air_${tmdbLanguage}_${tmdbRegion}_page_${page}`,
      ttl: TTL.NOW_PLAYING,
      append,
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
