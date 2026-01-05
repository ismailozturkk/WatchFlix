import { createContext, useContext, useEffect, useState } from "react";
import { useAppSettings } from "./AppSettingsContext";
import Toast from "react-native-toast-message";
import { useLanguage } from "./LanguageContext";
import axios from "axios";

const TvShowContext = createContext();
export const useTvShow = () => useContext(TvShowContext);

export const TvShowProvider = ({ children }) => {
  const [seriesTrend, setSeriesTrend] = useState([]);
  const [loadingTrend, setLoadingTren] = useState(true);
  const [selectedCategoryTrend, setSelectedCategoryTrend] = useState("week");
  const [selectedCategoryTrendShow, setSelectedCategoryTrendShow] =
    useState("trending");
  const { API_KEY } = useAppSettings();
  const { language } = useLanguage();
  const { t } = useLanguage();
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
    setLoadingTren(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryTrendShow}/tv/${selectedCategoryTrend}`,
      params: {
        include_adult: "false",
        include_null_first_air_dates: "false",
        language: language === "tr" ? "tr-TR" : "en-US",
        page: "1",
      },
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    };

    try {
      const response = await axios.request(options);
      setSeriesTrend([
        { id: "left-spacer" },
        ...response.data.results,
        { id: "right-spacer" },
      ]);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "error:" + error,
      });
    } finally {
      setLoadingTren(false);
    }
  };
  useEffect(() => {
    fetchSeriesTrends();
  }, [selectedCategoryTrend, selectedCategoryTrendShow, language]);

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
    setLoadingBest(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryBestShow}/tv`,
      params: {
        include_adult: "false",
        include_null_first_air_dates: "false",
        language: language === "tr" ? "tr-TR" : "en-US",
        page: pageBest,
        sort_by: `${selectedCategoryBest}.desc`,
        "vote_count.gte": "500",
      },
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    };

    try {
      const response = await axios.request(options);
      setSeriesBest(response.data.results);
      setTotalPagesBest(response.data.total_pages); // Filmleri ekrana yazdır
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "error:" + error,
      });
    } finally {
      setLoadingBest(false);
    }
  };
  useEffect(() => {
    fetchSeriesBest();
  }, [selectedCategoryBest, selectedCategoryBestShow, language, pageBest]);

  const [moviesAiringToday, setMoviesAiringToday] = useState([]); // Filmler için yeni durum ekleyin
  const [totalPagesAiringToday, setTotalPagesAiringToday] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingAiringToday, setLoadingAiringToday] = useState(true); // loading durumu ekleyin
  const [pageAiringToday, setPageAiringToday] = useState(1); // loading durumu ekleyin

  const fetchAiringToday = async () => {
    setLoadingAiringToday(true);
    try {
      const url = `https://api.themoviedb.org/3/tv/airing_today?include_adult=false&include_video=false&language=${language}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageAiringToday}&sort_by=popularity.desc`; // API'den filmleri çekmek için URL
      const headers = {
        Authorization: API_KEY,
      };

      const response = await axios.get(url, { headers });
      setMoviesAiringToday(response.data.results); // Filmleri ekrana yazdır
      setTotalPagesAiringToday(response.data.total_pages); // Filmleri ekrana yazdır
    } catch (err) {
      console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingAiringToday(false);
    }
  };
  useEffect(() => {
    fetchAiringToday();
  }, [language, pageAiringToday]);

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [moviesProviders, setMoviesProviders] = useState([]);
  const [loadingMoviesByProvider, setLoadingMoviesByProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  //const [fetchMoviesByProvider, setFetchMoviesByProvider] = useState(false);

  // Sağlayıcıları çek
  useEffect(() => {
    fetchProviders();
  }, [language]);

  const fetchProviders = async () => {
    setLoadingProvider(true);
    try {
      const url = `https://api.themoviedb.org/3/watch/providers/tv?language=${language}&watch_region=${language == "tr-TR" ? "tr" : "us"}`;
      const headers = {
        Authorization: API_KEY,
      };
      const response = await axios.get(url, { headers });
      setProviders(response.data.results);
      if (response.data.results.length > 0) {
        const firstProvider = response.data.results[0];
        setSelectedProvider(firstProvider.provider_id);
        fetchMoviesByProvider(firstProvider.provider_id);
      }
    } catch (err) {
      console.error("Sağlayıcıları çekerken hata:", err.message);
    } finally {
      setLoadingProvider(false);
    }
  };

  // Seçilen sağlayıcıya göre filmleri çek
  const fetchMoviesByProvider = async (providerId) => {
    setLoadingMoviesByProvider(true);
    setSelectedProvider(providerId);

    try {
      let url = `https://api.themoviedb.org/3/discover/tv?watch_region=${language == "tr-TR" ? "TR" : "US"}&with_watch_providers=${providerId}&sort_by=vote_count.desc`;

      const headers = {
        Authorization: API_KEY, // Buraya kendi API keyini koy
      };

      const response = await axios.get(url, { headers });
      setMoviesProviders(response.data.results);
    } catch (err) {
      console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingMoviesByProvider(false);
    }
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingGenres, setLoadingGenres] = useState(true); // loading durumu ekleyin
  const [pageGenres, setPageGenres] = useState(1); // loading durumu ekleyin

  // Film türlerini API'den almak
  const tvGenres = async () => {
    setLoadingGenres(true);
    try {
      const url = `https://api.themoviedb.org/3/genre/tv/list?language=${language}`;
      const headers = {
        Authorization: API_KEY,
      };
      const response = await axios.get(url, { headers });
      const genres = response.data.genres;
      setGenres(genres);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };

  // Seçilen türlere göre filmleri almak

  const fetchTvByGenres = async () => {
    setLoadingGenres(true);
    try {
      let url = `https://api.themoviedb.org/3/discover/tv?language=${language}&page=${pageGenres}`;

      if (selectedGenres.length > 0) {
        const genreIds = selectedGenres.join(",");
        url += `&with_genres=${genreIds}`;
      }

      const headers = {
        Authorization: API_KEY,
      };

      const response = await axios.get(url, { headers });
      setMoviesGenres(response.data.results);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };
  useEffect(() => {
    tvGenres();
    fetchTvByGenres();
  }, [language, pageGenres, selectedGenres]);

  const [moviesOnTheAir, setMoviesOnTheAir] = useState([]); // Filmler için yeni durum ekleyin
  const [totalPagesOnTheAir, setTotalPagesOnTheAir] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingOnTheAir, setLoadingOnTheAir] = useState(true); // loading durumu ekleyin
  const [pageOnTheAir, setPageOnTheAir] = useState(1); // loading durumu ekleyin

  // Film türlerini API'den almak

  const fetchOnTheAir = async () => {
    setLoadingOnTheAir(true);
    try {
      const url = `https://api.themoviedb.org/3/tv/on_the_air?include_adult=false&include_video=false&language=${language}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageOnTheAir}&sort_by=popularity.desc`; // API'den filmleri çekmek için URL
      const headers = {
        Authorization: API_KEY,
      };

      const response = await axios.get(url, { headers });
      setMoviesOnTheAir(response.data.results); // Filmleri ekrana yazdır
      setTotalPagesOnTheAir(response.data.total_pages); // Filmleri ekrana yazdır
    } catch (err) {
      console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingOnTheAir(false);
    }
  };
  useEffect(() => {
    fetchOnTheAir();
  }, [language, pageOnTheAir]);

  return (
    <TvShowContext.Provider
      value={{
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
        genres,
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
        setPageBest,
        setPageAiringToday,
        setPageAiringToday,
        setSelectedGenres,
        setPageGenres,
        setPageOnTheAir,
        getCategoryTitleBest,
        getCategoryTitleTrends,
        //!
        fetchSeriesTrends,
        fetchSeriesBest,
        fetchAiringToday,
        fetchProviders,
        fetchTvByGenres,
        fetchOnTheAir,
      }}
    >
      {children}
    </TvShowContext.Provider>
  );
};
