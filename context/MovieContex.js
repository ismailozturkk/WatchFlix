import { createContext, useContext, useCallback, useEffect, useState, useMemo } from "react";
import { useApiSettings } from "./AppSettingsContext";
import Toast from "react-native-toast-message";
import { useLanguage } from "./LanguageContext";
import axios from "axios";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";

const MovieContext = createContext();
export const useMovie = () => useContext(MovieContext);

export const MovieProvider = ({ children }) => {
  const { API_KEY } = useApiSettings();
  const { language, t } = useLanguage();
  const [activeSections, setActiveSections] = useState({});

  const activateMovieSection = useCallback((section) => {
    setActiveSections((current) => {
      if (current[section]) return current;
      return { ...current, [section]: true };
    });
  }, []);

  const [totalPagesBest, setTotalPagesBest] = useState([]); // Filmler için yeni durum ekleyin
  const [pageBest, setPageBest] = useState(1); // loading durumu ekleyin
  const [loadingBests, setLoadingBests] = useState(true);
  const [movieBests, setMoviesBests] = useState([]);
  const [selectedCategoryBests, setSelectedCategoryBests] =
    useState("vote_count.desc");
  const categorieBests = ["vote_count.desc", "popularity.desc"];

  const getCategoryTitleBests = (category) => {
    switch (category) {
      case "vote_count.desc":
        return t.movieScreens.voted;
      case "popularity.desc":
        return t.movieScreens.popular;
      default:
        return category;
    }
  };

  const fetchMoviesBests = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `movie_bests_${lang}_${selectedCategoryBests}_page_${pageBest}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setMoviesBests(cached.results);
      setTotalPagesBest(cached.total_pages);
      setLoadingBests(false);
      return;
    }

    setLoadingBests(true);
    const options = {
      method: "GET",
      url: "https://api.themoviedb.org/3/discover/movie",
      params: {
        include_adult: "true",
        include_null_first_air_dates: "false",
        language: lang,
        page: pageBest,
        sort_by: selectedCategoryBests,
        "vote_count.gte": "100",
      },
      headers: { accept: "application/json", Authorization: API_KEY },
    };

    try {
      const response = await axios.request(options);
      setMoviesBests(response.data.results);
      setTotalPagesBest(response.data.total_pages);
      setCachedValue(cacheKey, {
        results: response.data.results,
        total_pages: response.data.total_pages,
      });
    } catch (error) {
      Toast.show({ type: "error", text1: "error:" + error });
    } finally {
      setLoadingBests(false);
    }
  };
  useEffect(() => {
    if (!activeSections.bests) return;
    fetchMoviesBests();
  }, [activeSections.bests, selectedCategoryBests, language, pageBest]);

  const categoriesTrends = ["week", "day"];

  const getCategoryTitleTrends = (category) => {
    switch (category) {
      case "week":
        return t.movieScreens.trendWeek;
      case "day":
        return t.movieScreens.trendDay;
      default:
        return category;
    }
  };

  const [movieTrends, setMovieTrends] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [selectedCategoryTrends, setSelectedCategoryTrends] = useState("week");
  const [selectedCategoryTrendsMovie, setSelectedCategoryTrendsMovie] =
    useState("trending");

  const fetchSeriesTrends = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `movie_trends_${lang}_${selectedCategoryTrends}_${selectedCategoryTrendsMovie}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setMovieTrends(cached);
      setLoadingTrends(false);
      return;
    }

    setLoadingTrends(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryTrendsMovie}/movie/${selectedCategoryTrends}`,
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
      setMovieTrends(data);
      setCachedValue(cacheKey, data);
    } catch (error) {
      Toast.show({ type: "error", text1: "error:" + error });
    } finally {
      setLoadingTrends(false);
    }
  };
  useEffect(() => {
    if (!activeSections.trends) return;
    fetchSeriesTrends();
  }, [activeSections.trends, selectedCategoryTrends, selectedCategoryTrendsMovie, language]);

  //!--------------------------- movie oscar --------------
  // Önceki adımda bulduğumuz TMDB ID'leri
  const moviesOscarIds = [
    1054867, 1064213, 872585, 545611, 776503, 581734, 496243, 490132, 399055,
    376867, 314365, 194662, 76203, 68734, 70586, 45269, 12162, 12405, 6978,
    1422, 10123, 70, 122, 1574, 274, 98, 14, 1934, 597, 409, 197, 13,
  ];

  const [moviesOscar, setMoviesOscar] = useState([]);
  const [loadingOscar, setLoadingOscar] = useState(true);
  const [errorOscar, setErrorOscar] = useState(null);

  const fetchMoviesOscar = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `movie_oscar_${lang}`;
    const cached = await getCachedValue(cacheKey, TTL.OSCAR);
    if (cached) {
      setMoviesOscar(cached);
      setErrorOscar(null);
      setLoadingOscar(false);
      return;
    }

    setLoadingOscar(true);
    try {
      const moviePromises = moviesOscarIds.map((id) =>
        axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
          params: { language: lang },
          headers: { Authorization: API_KEY },
        }),
      );
      const responses = await Promise.all(moviePromises);
      const movieResults = responses.map((res) => res.data);
      setMoviesOscar(movieResults);
      setErrorOscar(null);
      setCachedValue(cacheKey, movieResults);
    } catch (err) {
      setErrorOscar(err.message);
    } finally {
      setLoadingOscar(false);
    }
  };

  useEffect(() => {
    if (!activeSections.oscar) return;
    fetchMoviesOscar();
  }, [activeSections.oscar, language]);
  //!------------------ movie collection --------------

  const moviesCollectionList = [
    "10", //sw
    "1241", //hp
    "86311", //mar
    "748", //
    "263",
    "9485",
    "119",
    "121938",
    "87359",
    "556",
    "531241",
    "295",
    "645",
    "2344",
    "8650",
    "131635",
    "328",
    "8354",
    "14740",
  ]; // koleksiyon ID'leri

  const [moviesCollection, setMoviesCollection] = useState([]);
  const [loadingCollection, setLoadingCollection] = useState(true);
  const [errorCollection, setErrorCollection] = useState(null);

  const fetchMoviesCollection = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `movie_collection_${lang}`;
    const cached = await getCachedValue(cacheKey, TTL.COLLECTION);
    if (cached) {
      setMoviesCollection(cached);
      setErrorCollection(null);
      setLoadingCollection(false);
      return;
    }

    setLoadingCollection(true);
    try {
      const moviePromises = moviesCollectionList.map((filmId) =>
        axios.get(`https://api.themoviedb.org/3/collection/${filmId}`, {
          params: { language: lang },
          headers: { Authorization: API_KEY },
        }).then((r) => r.data || []),
      );
      const movieResults = await Promise.all(moviePromises);
      const allMovies = movieResults.flat().filter(Boolean);
      setMoviesCollection(allMovies);
      setErrorCollection(null);
      setCachedValue(cacheKey, allMovies);
    } catch (err) {
      const message =
        err.response?.data?.status_message || err.message || "Bilinmeyen hata";
      setErrorCollection(message);
    } finally {
      setLoadingCollection(false);
    }
  };
  useEffect(() => {
    if (!activeSections.collection) return;
    fetchMoviesCollection();
  }, [activeSections.collection, language]);

  //!------------- movie provide ---------------------
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [moviesProvider, setMoviesProvider] = useState([]);
  const [loadingMovieProvider, setLoadingMovieProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);

  useEffect(() => {
    if (!activeSections.providers) return;
    fetchProviders();
  }, [activeSections.providers, language]);

  const fetchProviders = async () => {
    const cacheKey = `movie_providers_${language}`;
    const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
    if (cached) {
      setProviders(cached);
      if (cached.length > 0) {
        setSelectedProvider(cached[0].provider_id);
        fetchMoviesByProvider(cached[0].provider_id);
      }
      setLoadingProvider(false);
      return;
    }

    setLoadingProvider(true);
    try {
      const url = `https://api.themoviedb.org/3/watch/providers/movie?language=${language}&watch_region=${language == "tr-TR" ? "tr" : "us"}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      const results = response.data.results;
      setProviders(results);
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

  // Seçilen sağlayıcıya göre filmleri çek
  const fetchMoviesByProvider = async (providerId) => {
    const cacheKey = `movie_provider_${language}_${providerId}`;
    const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
    if (cached) {
      setMoviesProvider(cached);
      setLoadingMovieProvider(false);
      return;
    }

    setLoadingMovieProvider(true);
    setSelectedProvider(providerId);
    try {
      const url = `https://api.themoviedb.org/3/discover/movie?watch_region=${language == "tr-TR" ? "TR" : "US"}&with_watch_providers=${providerId}&sort_by=vote_count.desc`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setMoviesProvider(response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingMovieProvider(false);
    }
  };

  const [moviesNowPlaying, setMoviesNowPlaying] = useState([]);
  const [loadingNowPlaying, setLoadingNowPlaying] = useState(false);

  useEffect(() => {
    if (!activeSections.nowPlaying) return;
    fetchMoviNowPlaying();
  }, [activeSections.nowPlaying, language]);
  // Seçilen sağlayıcıya göre filmleri çek
  const fetchMoviNowPlaying = async () => {
    const cacheKey = `movie_now_playing_${language}`;
    const cached = await getCachedValue(cacheKey, TTL.NOW_PLAYING);
    if (cached) {
      setMoviesNowPlaying(cached);
      setLoadingNowPlaying(false);
      return;
    }

    setLoadingNowPlaying(true);
    try {
      const url = `https://api.themoviedb.org/3/movie/now_playing?language=${language}&region=${language == "tr-TR" ? "TR" : "US"}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setMoviesNowPlaying(response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingNowPlaying(false);
    }
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingGenres, setLoadingGenres] = useState(true); // loading durumu ekleyin
  const [pageGenres, setPageGenres] = useState(1); // loading durumu ekleyin

  const movieGenres = async () => {
    const cacheKey = `movie_genres_${language}`;
    const cached = await getCachedValue(cacheKey, TTL.GENRES);
    if (cached) {
      setGenres(cached);
      setLoadingGenres(false);
      return;
    }

    try {
      const url = `https://api.themoviedb.org/3/genre/movie/list?language=${language}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setGenres(response.data.genres);
      setCachedValue(cacheKey, response.data.genres);
    } catch (err) {
      if (__DEV__) console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };
  const fetchMoviesByGenres = async () => {
    const genresKey = [...selectedGenres].sort().join(",");
    const cacheKey = `movie_genres_content_${language}_p${pageGenres}_g${genresKey}`;
    const cached = await getCachedValue(cacheKey, TTL.TREND);
    if (cached) {
      setMoviesGenres(cached);
      setLoadingGenres(false);
      return;
    }

    setLoadingGenres(true);
    try {
      let url = `https://api.themoviedb.org/3/discover/movie?language=${language}&page=${pageGenres}`;
      if (selectedGenres.length > 0) {
        url += `&with_genres=${genresKey}`;
      }
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setMoviesGenres(response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };
  useEffect(() => {
    if (!activeSections.genres) return;
    movieGenres();
    fetchMoviesByGenres();
  }, [activeSections.genres, language, pageGenres, selectedGenres]);

  const toggleGenre = (genreId) => {
    setSelectedGenres(
      (prev) =>
        prev.includes(genreId)
          ? prev.filter((id) => id !== genreId) // Seçiliyse kaldır
          : [...prev, genreId], // Seçili değilse ekle
    );
  };

  const [moviesUpcoming, setMoviesUpcoming] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingUpcoming, setLoadingUpcoming] = useState(true); // loading durumu ekleyin
  const [pageUpcoming, setPageUpcoming] = useState(1); // loading durumu ekleyin
  const [valueUpcoming, setValueUpcoming] = useState("0"); // Varsayılan olarak "Bu hafta" seçili
  const [isFocusUpcoming, setIsFocusUpcoming] = useState(false);
  const [calculatedDate, setCalculatedDate] = useState("");

  const dateData = useMemo(() => [
    { label: t.movieScreens.movieUpcaming.label, value: "0" },
    { label: t.movieScreens.movieUpcaming.label1, value: "1" },
    { label: t.movieScreens.movieUpcaming.label2, value: "2" },
    { label: t.movieScreens.movieUpcaming.label3, value: "3" },
    { label: t.movieScreens.movieUpcaming.label4, value: "12" },
    { label: t.movieScreens.movieUpcaming.label5, value: "24" },
    { label: t.movieScreens.movieUpcaming.label6, value: "36" },
  ], [t]);

  const today = new Date();
  today.setDate(today.getDate() + 1);

  // Tarihi formatlamak için yardımcı fonksiyon
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Ayı al (0-11 arası olduğu için +1 ekliyoruz)
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Seçilen değeri tarihe eklemek için fonksiyon
  const addTimeToDate = (value) => {
    let newDate = new Date(today); // Yeni bir tarih nesnesi oluştur

    // Seçilen değere göre işlem yap
    switch (value) {
      case "0": // Bu hafta
        newDate.setDate(newDate.getDate() + 7); // 7 gün ekle
        break;
      case "1": // Bu ay
        newDate.setMonth(newDate.getMonth() + 1); // 1 ay ekle
        break;
      case "2": // Sonraki 2 ay
        newDate.setMonth(newDate.getMonth() + 2); // 2 ay ekle
        break;
      case "3": // Sonraki 3 ay
        newDate.setMonth(newDate.getMonth() + 3); // 3 ay ekle
        break;
      case "12": // Sonraki 1 yıl
        newDate.setFullYear(newDate.getFullYear() + 1); // 1 yıl ekle
        break;
      case "24": // Sonraki 2 yıl
        newDate.setFullYear(newDate.getFullYear() + 2); // 2 yıl ekle
        break;
      case "36": // Sonraki 3 yıl
        newDate.setFullYear(newDate.getFullYear() + 3); // 3 yıl ekle
        break;
      default:
        break;
    }

    // Hesaplanan tarihi formatla ve set et
    setCalculatedDate(formatDate(newDate));
  };

  // Film türlerini API'den almak
  const fetchMovieUpcoming = async () => {
    if (!calculatedDate) return;
    const cacheKey = `movie_upcoming_${language}_${calculatedDate}_p${pageUpcoming}`;
    const cached = await getCachedValue(cacheKey, TTL.NOW_PLAYING);
    if (cached) {
      setMoviesUpcoming(cached);
      setLoadingUpcoming(false);
      return;
    }

    setLoadingUpcoming(true);
    try {
      const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=${language}&primary_release_date.gte=${formatDate(today)}&primary_release_date.lte=${calculatedDate}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageUpcoming}&sort_by=popularity.desc`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setMoviesUpcoming(response.data.results);
      setCachedValue(cacheKey, response.data.results);
    } catch (err) {
      if (__DEV__) console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  useEffect(() => {
    if (!activeSections.upcoming) return;
    addTimeToDate(valueUpcoming);
    fetchMovieUpcoming();
  }, [activeSections.upcoming, language, pageUpcoming, valueUpcoming, calculatedDate]);

  const RelaseCount = (relaseDate) => {
    const today = new Date().toISOString().split("T")[0]; // Bugünün tarihi
    const targetDate = new Date(relaseDate); // Hedef tarih
    // Bugünün tarihini Date nesnesine çevir
    const todayDate = new Date(today);
    // İki tarih arasındaki farkı milisaniye cinsinden hesapla
    const diffTime = Math.abs(todayDate - targetDate);
    // Milisaniyeyi gün cinsine çevir
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const contextValue = useMemo(() => ({
    pageBest,
    loadingBests,
    movieBests,
    selectedCategoryTrends,
    categoriesTrends,
    categorieBests,
    movieTrends,
    loadingTrends,
    selectedCategoryTrendsMovie,
    selectedCategoryBests,
    totalPagesBest,
    moviesOscar,
    loadingOscar,
    errorOscar,
    selectedProvider,
    providers,
    loadingProvider,
    loadingMovieProvider,
    moviesProvider,
    moviesNowPlaying,
    loadingNowPlaying,
    genres,
    loadingGenres,
    moviesGenres,
    pageGenres,
    selectedGenres,
    dateData,
    moviesUpcoming,
    loadingUpcoming,
    pageUpcoming,
    valueUpcoming,
    isFocusUpcoming,
    moviesCollection,
    loadingCollection,
    errorCollection,

    setTotalPagesBest,
    setPageBest,
    setSelectedCategoryBests,
    getCategoryTitleTrends,
    getCategoryTitleBests,
    setSelectedCategoryTrends,
    setSelectedCategoryTrendsMovie,
    fetchMoviesByProvider,
    activateMovieSection,
    toggleGenre,
    setPageGenres,
    addTimeToDate,
    setPageUpcoming,
    setValueUpcoming,
    setIsFocusUpcoming,
    RelaseCount,
    //!
    fetchSeriesTrends,
    fetchMoviesBests,
    fetchMoviesOscar,
    fetchMoviesCollection,
    fetchProviders,
    fetchMoviNowPlaying,
    fetchMovieUpcoming,
    fetchMoviesByGenres,
  }), [
    pageBest, loadingBests, movieBests, selectedCategoryTrends,
    categoriesTrends, categorieBests, movieTrends, loadingTrends,
    selectedCategoryTrendsMovie, selectedCategoryBests, totalPagesBest,
    moviesOscar, loadingOscar, errorOscar, selectedProvider, providers,
    loadingProvider, loadingMovieProvider, moviesProvider, moviesNowPlaying,
    loadingNowPlaying, genres, loadingGenres, moviesGenres, pageGenres,
    selectedGenres, dateData, moviesUpcoming, loadingUpcoming,
    pageUpcoming, valueUpcoming, isFocusUpcoming, moviesCollection,
    loadingCollection, errorCollection, activateMovieSection
  ]);

  return (
    <MovieContext.Provider value={contextValue}>
      {children}
    </MovieContext.Provider>
  );
};
