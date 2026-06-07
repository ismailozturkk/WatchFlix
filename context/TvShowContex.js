import { createContext, useContext, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useApiSettings } from "./AppSettingsContext";
import Toast from "react-native-toast-message";
import { useLanguage } from "./LanguageContext";
import { useAuth } from "./AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";

const TvShowContext = createContext();
export const useTvShow = () => useContext(TvShowContext);

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const setIfChanged = (setter, next) => {
  setter((current) => (sameJson(current, next) ? current : next));
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
  const [selectedCategoryTrend, setSelectedCategoryTrend] = useState("week");
  const [selectedCategoryTrendShow, setSelectedCategoryTrendShow] =
    useState("trending");
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
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
      AsyncStorage.setItem(WATCHED_TV_CACHE, JSON.stringify(raw)).catch(() => {});
    });
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

  const fetchSeriesTrends = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `tv_trends_${lang}_${selectedCategoryTrend}_${selectedCategoryTrendShow}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setIfChanged(setSeriesTrend, cached);
      setLoadingTren(false);
      return;
    }

    setLoadingTren(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryTrendShow}/tv/${selectedCategoryTrend}`,
      params: {
        include_adult: "false",
        include_null_first_air_dates: "false",
        language: lang,
        page: "1",
      },
      headers: { accept: "application/json", Authorization: API_KEY },
    };

    try {
      const response = await axios.request(options);
      const data = [
        { id: "left-spacer" },
        ...response.data.results,
        { id: "right-spacer" },
      ];
      setIfChanged(setSeriesTrend, data);
      setCachedValue(cacheKey, data);
    } catch (error) {
      Toast.show({ type: "error", text1: "error:" + error });
    } finally {
      setLoadingTren(false);
    }
  };
  useEffect(() => {
    if (!activeSections.trends) return;
    fetchSeriesTrends();
  }, [activeSections.trends, selectedCategoryTrend, selectedCategoryTrendShow, language]);

  const [seriesBest, setSeriesBest] = useState([]);
  const [loadingBest, setLoadingBest] = useState(true);
  const [selectedCategoryBestShow, setSelectedCategoryBestShow] =
    useState("discover");
  const [selectedCategoryBest, setSelectedCategoryBest] =
    useState("vote_count");
  const [pageBest, setPageBest] = useState(1); // loading durumu ekleyin
  const [totalPagesBest, setTotalPagesBest] = useState([]); // Filmler için yeni durum ekleyin
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

  const fetchSeriesBest = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `tv_bests_${lang}_${selectedCategoryBestShow}_${selectedCategoryBest}_page_${pageBest}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setIfChanged(setSeriesBest, cached.results);
      setTotalPagesBest(cached.total_pages);
      setLoadingBest(false);
      return;
    }

    setLoadingBest(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryBestShow}/tv`,
      params: {
        include_adult: "false",
        include_null_first_air_dates: "false",
        language: lang,
        page: pageBest,
        sort_by: `${selectedCategoryBest}.desc`,
        "vote_count.gte": "500",
      },
      headers: { accept: "application/json", Authorization: API_KEY },
    };

    try {
      const response = await axios.request(options);
      setIfChanged(setSeriesBest, response.data.results);
      setTotalPagesBest(response.data.total_pages);
      setCachedValue(cacheKey, {
        results: response.data.results,
        total_pages: response.data.total_pages,
      });
    } catch (error) {
      Toast.show({ type: "error", text1: "error:" + error });
    } finally {
      setLoadingBest(false);
    }
  };
  useEffect(() => {
    if (!activeSections.best) return;
    fetchSeriesBest();
  }, [activeSections.best, selectedCategoryBest, selectedCategoryBestShow, language, pageBest]);

  const [moviesAiringToday, setMoviesAiringToday] = useState([]); // Filmler için yeni durum ekleyin
  const [totalPagesAiringToday, setTotalPagesAiringToday] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingAiringToday, setLoadingAiringToday] = useState(true); // loading durumu ekleyin
  const [pageAiringToday, setPageAiringToday] = useState(1); // loading durumu ekleyin

  const fetchAiringToday = async () => {
    const cacheKey = `tv_airing_today_${language}_page_${pageAiringToday}`;
    const cached = await getCachedValue(cacheKey, TTL.NOW_PLAYING);
    if (cached) {
      setIfChanged(setMoviesAiringToday, cached.results);
      setTotalPagesAiringToday(cached.total_pages);
      setLoadingAiringToday(false);
      return;
    }

    setLoadingAiringToday(true);
    try {
      const url = `https://api.themoviedb.org/3/tv/airing_today?include_adult=false&include_video=false&language=${language}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageAiringToday}&sort_by=popularity.desc`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setMoviesAiringToday, response.data.results);
      setTotalPagesAiringToday(response.data.total_pages);
      setCachedValue(cacheKey, {
        results: response.data.results,
        total_pages: response.data.total_pages,
      });
    } catch (err) {
      if (__DEV__) console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingAiringToday(false);
    }
  };
  useEffect(() => {
    if (!activeSections.airingToday) return;
    fetchAiringToday();
  }, [activeSections.airingToday, language, pageAiringToday]);

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [moviesProviders, setMoviesProviders] = useState([]);
  const [loadingMoviesByProvider, setLoadingMoviesByProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  //const [fetchMoviesByProvider, setFetchMoviesByProvider] = useState(false);

  // Sağlayıcıları çek
  useEffect(() => {
    if (!activeSections.providers) return;
    fetchProviders();
  }, [activeSections.providers, language]);

  const fetchProviders = async () => {
    const cacheKey = `tv_providers_${language}`;
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
      const url = `https://api.themoviedb.org/3/watch/providers/tv?language=${language}&watch_region=${language == "tr-TR" ? "tr" : "us"}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      const results = response.data.results;
      setIfChanged(setProviders, results);
      setCachedValue(cacheKey, results);
      if (results.length > 0) {
        setSelectedProvider(results[0].provider_id);
        fetchMoviesByProvider(results[0].provider_id);
      }
    } catch (err) {
      if (__DEV__) console.error("Sağlayıcıları çekerken hata:", err.message);
    } finally {
      setLoadingProvider(false);
    }
  };

  // Seçilen sağlayıcıya göre dizileri çek
  const fetchMoviesByProvider = async (providerId) => {
    const cacheKey = `tv_provider_${language}_${providerId}`;
    const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
    if (cached) {
      setIfChanged(setMoviesProviders, cached);
      setLoadingMoviesByProvider(false);
      return;
    }

    setLoadingMoviesByProvider(true);
    setSelectedProvider(providerId);
    try {
      const url = `https://api.themoviedb.org/3/discover/tv?watch_region=${language == "tr-TR" ? "TR" : "US"}&with_watch_providers=${providerId}&sort_by=vote_count.desc`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setMoviesProviders, response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingMoviesByProvider(false);
    }
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingGenres, setLoadingGenres] = useState(true); // loading durumu ekleyin
  const [pageGenres, setPageGenres] = useState(1); // loading durumu ekleyin

  const tvGenres = async () => {
    const cacheKey = `tv_genres_${language}`;
    const cached = await getCachedValue(cacheKey, TTL.GENRES);
    if (cached) {
      setIfChanged(setGenres, cached);
      setLoadingGenres(false);
      return;
    }

    try {
      const url = `https://api.themoviedb.org/3/genre/tv/list?language=${language}`;
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

  const fetchTvByGenres = async () => {
    const genresKey = [...selectedGenres].sort().join(",");
    const cacheKey = `tv_genres_content_${language}_p${pageGenres}_g${genresKey}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setIfChanged(setMoviesGenres, cached);
      setLoadingGenres(false);
      return;
    }

    setLoadingGenres(true);
    try {
      let url = `https://api.themoviedb.org/3/discover/tv?language=${language}&page=${pageGenres}`;
      if (selectedGenres.length > 0) {
        url += `&with_genres=${genresKey}`;
      }
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setMoviesGenres, response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };
  useEffect(() => {
    if (!activeSections.genres) return;
    tvGenres();
    fetchTvByGenres();
  }, [activeSections.genres, language, pageGenres, selectedGenres]);

  const [moviesOnTheAir, setMoviesOnTheAir] = useState([]); // Filmler için yeni durum ekleyin
  const [totalPagesOnTheAir, setTotalPagesOnTheAir] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingOnTheAir, setLoadingOnTheAir] = useState(true); // loading durumu ekleyin
  const [pageOnTheAir, setPageOnTheAir] = useState(1); // loading durumu ekleyin

  // Film türlerini API'den almak

  const fetchOnTheAir = async () => {
    const cacheKey = `tv_on_the_air_${language}_page_${pageOnTheAir}`;
    const cached = await getCachedValue(cacheKey, TTL.NOW_PLAYING);
    if (cached) {
      setIfChanged(setMoviesOnTheAir, cached.results);
      setTotalPagesOnTheAir(cached.total_pages);
      setLoadingOnTheAir(false);
      return;
    }

    setLoadingOnTheAir(true);
    try {
      const url = `https://api.themoviedb.org/3/tv/on_the_air?include_adult=false&include_video=false&language=${language}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageOnTheAir}&sort_by=popularity.desc`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setMoviesOnTheAir, response.data.results);
      setTotalPagesOnTheAir(response.data.total_pages);
      setCachedValue(cacheKey, {
        results: response.data.results,
        total_pages: response.data.total_pages,
      });
    } catch (err) {
      if (__DEV__) console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingOnTheAir(false);
    }
  };
  useEffect(() => {
    if (!activeSections.onTheAir) return;
    fetchOnTheAir();
  }, [activeSections.onTheAir, language, pageOnTheAir]);

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
    fetchMoviesByProvider,
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
    categoriesTrends, refreshing, watchedTvShows, loadingWatchedTv, activateTvSection
  ]);

  return (
    <TvShowContext.Provider value={contextValue}>
      {children}
    </TvShowContext.Provider>
  );
};
