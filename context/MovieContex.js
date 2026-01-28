import { createContext, useContext, useEffect, useState } from "react";
import { useAppSettings } from "./AppSettingsContext";
import Toast from "react-native-toast-message";
import { useLanguage } from "./LanguageContext";
import axios from "axios";

const MovieContext = createContext();
export const useMovie = () => useContext(MovieContext);

export const MovieProvider = ({ children }) => {
  const { API_KEY } = useAppSettings();
  const { language, t } = useLanguage();

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
    setLoadingBests(true);
    const options = {
      method: "GET",
      url: "https://api.themoviedb.org/3/discover/movie",
      params: {
        include_adult: "true",
        include_null_first_air_dates: "false",
        language: language === "tr" ? "tr-TR" : "en-US",
        page: pageBest,
        sort_by: selectedCategoryBests,
        "vote_count.gte": "100",
      },
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    };

    try {
      const response = await axios.request(options);
      setMoviesBests(response.data.results);
      setTotalPagesBest(response.data.total_pages); // Filmleri ekrana yazdır
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "error:" + error,
      });
    } finally {
      setLoadingBests(false);
    }
  };
  useEffect(() => {
    fetchMoviesBests();
  }, [selectedCategoryBests, language, pageBest]);

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
    setLoadingTrends(true);
    const options = {
      method: "GET",
      url: `https://api.themoviedb.org/3/${selectedCategoryTrendsMovie}/movie/${selectedCategoryTrends}`,
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
      setMovieTrends([
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
      setLoadingTrends(false);
    }
  };
  useEffect(() => {
    fetchSeriesTrends();
  }, [selectedCategoryTrends, selectedCategoryTrendsMovie, language]);

  //!--------------------------- movie oscar --------------
  const moviesOscarList = [
    "Anora",
    "Oppenheimer",
    "Everything Everywhere All at Once",
    "CODA",
    "Nomadland",
    "Parasite",
    "Green Book",
    "The Shape of Water",
    "Moonlight",
    "Spotlight",
    "Birdman",
    "12 Years a Slave",
    "Argo",
    "The Artist",
    "The King's Speech",
    "The Hurt Locker",
    "Slumdog Millionaire",
    "No Country for Old Men",
    "The Departed",
    "Crash",
    "Million Dollar Baby",
    "The Lord of the Rings: The Return of the King",
    "Chicago",
    "A Beautiful Mind",
    "Gladiator",
    "American Beauty",
    "Shakespeare in Love",
    "Titanic",
    "The English Patient",
    "Braveheart",
    "Forrest Gump",
  ];

  const [moviesOscar, setMoviesOscar] = useState([]);
  const [loadingOscar, setLoadingOscar] = useState(true);
  const [errorOscar, setErrorOscar] = useState(null);

  const fetchMoviesOscar = async () => {
    setLoadingOscar(true);
    try {
      const moviePromises = moviesOscarList.map(async (film) => {
        const url = `https://api.themoviedb.org/3/search/movie`;
        const params = {
          query: film,
          include_adult: "false",
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
        };
        const headers = {
          Authorization: API_KEY,
        };

        const response = await axios.get(url, { params, headers });
        const movies = response.data.results;
        // Oy sayısı en az 1000 olan ilk filmi al
        return movies.find((movie) => movie.vote_count >= 1000);
      });

      const movieResults = await Promise.all(moviePromises);
      setMoviesOscar(movieResults.filter((movie) => movie !== undefined)); // undefined olanları filtrele
      setErrorOscar(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOscar(false);
    }
  };
  useEffect(() => {
    fetchMoviesOscar();
  }, [language]);
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
    setLoadingCollection(true);
    try {
      const moviePromises = moviesCollectionList.map(async (filmId) => {
        const url = `https://api.themoviedb.org/3/collection/${filmId}`;
        const params = {
          language: language === "tr" ? "tr-TR" : "en-US",
        };
        const headers = {
          Authorization: API_KEY,
        };

        const response = await axios.get(url, { params, headers });
        const movies = response.data || [];

        // Örn. 1 tane bile geçerli film yoksa boş dizi dönebilir
        return movies;
      });

      const movieResults = await Promise.all(moviePromises);

      const allMovies = movieResults.flat().filter(Boolean); // null/undefined filtrele
      setMoviesCollection(allMovies);
      setErrorCollection(null);
    } catch (err) {
      const message =
        err.response?.data?.status_message || err.message || "Bilinmeyen hata";
      setErrorCollection(message);
    } finally {
      setLoadingCollection(false);
    }
  };
  useEffect(() => {
    fetchMoviesCollection();
  }, [language]);

  //!------------- movie provide ---------------------
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [moviesProvider, setMoviesProvider] = useState([]);
  const [loadingMovieProvider, setLoadingMovieProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, [language]);

  const fetchProviders = async () => {
    setLoadingProvider(true);
    try {
      const url = `https://api.themoviedb.org/3/watch/providers/movie?language=${language}&watch_region=${language == "tr-TR" ? "tr" : "us"}`;
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
    setLoadingMovieProvider(true);
    setSelectedProvider(providerId);

    try {
      let url = `https://api.themoviedb.org/3/discover/movie?watch_region=${language == "tr-TR" ? "TR" : "US"}&with_watch_providers=${providerId}&sort_by=vote_count.desc`;

      const headers = {
        Authorization: API_KEY, // Buraya kendi API keyini koy
      };

      const response = await axios.get(url, { headers });
      setMoviesProvider(response.data.results);
    } catch (err) {
      console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingMovieProvider(false);
    }
  };

  const [moviesNowPlaying, setMoviesNowPlaying] = useState([]);
  const [loadingNowPlaying, setLoadingNowPlaying] = useState(false);

  useEffect(() => {
    fetchMoviNowPlaying();
  }, [language]);
  // Seçilen sağlayıcıya göre filmleri çek
  const fetchMoviNowPlaying = async () => {
    setLoadingNowPlaying(true);

    try {
      let url = `https://api.themoviedb.org/3/movie/now_playing?language=${language}&region=${language == "tr-TR" ? "TR" : "US"}`;

      const headers = {
        Authorization: API_KEY, // Buraya kendi API keyini koy
      };

      const response = await axios.get(url, { headers });
      setMoviesNowPlaying(response.data.results);
    } catch (err) {
      console.error("Filmleri çekerken hata:", err.message);
    } finally {
      setLoadingNowPlaying(false);
    }
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingGenres, setLoadingGenres] = useState(true); // loading durumu ekleyin
  const [pageGenres, setPageGenres] = useState(1); // loading durumu ekleyin

  // Film türlerini API'den almak
  const movieGenres = async () => {
    try {
      const url = `https://api.themoviedb.org/3/genre/movie/list?language=${language}`;
      const headers = {
        Authorization: API_KEY,
      };
      const response = await axios.get(url, { headers });
      const genres = response.data.genres;
      setGenres(genres);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  // Seçilen türlere göre filmleri almak
  useEffect(() => {
    fetchMoviesByGenres(); // Sayfa veya türler değiştiğinde tekrar filmleri al
  }, [selectedGenres, pageGenres]); // selectedGenres veya page değiştiğinde çalışır

  const fetchMoviesByGenres = async () => {
    setLoadingGenres(true);
    try {
      let url = `https://api.themoviedb.org/3/discover/movie?language=${language}&page=${pageGenres}`;

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
    movieGenres();
    fetchMoviesByGenres();
  }, [language, pageGenres]);

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

  const dateData = [
    { label: t.movieScreens.movieUpcaming.label, value: "0" },
    { label: t.movieScreens.movieUpcaming.label1, value: "1" },
    { label: t.movieScreens.movieUpcaming.label2, value: "2" },
    { label: t.movieScreens.movieUpcaming.label3, value: "3" },
    { label: t.movieScreens.movieUpcaming.label4, value: "12" },
    { label: t.movieScreens.movieUpcaming.label5, value: "24" },
    { label: t.movieScreens.movieUpcaming.label6, value: "36" },
  ];

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
    setLoadingUpcoming(true);
    try {
      const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=${language}&primary_release_date.gte=${formatDate(today)}&primary_release_date.lte=${calculatedDate}&region=${language == "tr-TR" ? "tr" : "us"}&page=${pageUpcoming}&sort_by=popularity.desc`; // API'den filmleri çekmek için URL
      const headers = {
        Authorization: API_KEY,
      };

      const response = await axios.get(url, { headers });
      setMoviesUpcoming(response.data.results); // Filmleri ekrana yazdır
    } catch (err) {
      console.error("Yakında çıkacak filmleri çekerken hata:", err.message);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  useEffect(() => {
    addTimeToDate(valueUpcoming);
    fetchMovieUpcoming();
  }, [language, pageUpcoming, valueUpcoming, calculatedDate]);

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

  return (
    <MovieContext.Provider
      value={{
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
        valueUpcoming,
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
        fetchMoviNowPlaying,
        fetchMovieUpcoming,
        fetchMoviesByGenres,
      }}
    >
      {children}
    </MovieContext.Provider>
  );
};
