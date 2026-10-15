import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  useApiSettings,
  useStreamingProviderSettings,
} from "./AppSettingsContext";
import { useLanguage } from "./LanguageContext";
import axios from "axios";
// `getCachedValue` hâlâ kullanılıyor: sağlayıcı/tür/oscar/koleksiyon
// listelerinin TTL'i 24 saat ile 7 gün arası, yani her açılışta ağ beklemeye
// yol açmıyorlar. Sağlayıcı okumasının önbellek isabetinde ayrıca YAN ETKİSİ
// var (bir sağlayıcı seçip içeriğini çekiyor); SWR'a çevirmek o isteği
// ikiye katlardı.
import {
  getCachedValue,
  getSwr,
  seedList,
  setCachedValue,
  TTL,
} from "../utils/apiCache";
import { setIfChanged, setListIfChanged } from "../utils/sameData";
import { adultScoped, dropAdult } from "../utils/homeContentSettings";
import { useHomeDataSettings } from "../hooks/useHomeContentSettings";
import { i18nText } from "../utils/i18nText";
import {
  getOscarConfig,
  fetchOscarByCategory,
  fetchOscarByYear,
  OSCAR_CATEGORIES,
  DEFAULT_OSCAR_CATEGORY,
} from "../services/oscarService";


const MovieContext = createContext();
export const useMovie = () => useContext(MovieContext);

// `sameJson`/`setIfChanged` buradan utils/sameData.js'e taşındı: aynı iki satır
// bu dosyada, TvShowContex'te, ListStatusContext'te ve MediaActivityContext'te
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
// append/replace + dedup mantığını tek yerde toplar. Her bölüm yalnızca
// kendi cacheKey'ini ve `request`'ini verir.
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
  startupSnapshot = false,
  forceRefresh = false,
}) => {
  // `arkaPlan`: ekranda zaten (bayat) veri var, tazeleme sessizce yapılıyor.
  // TMDB aynı listeyi her istekte biraz farklı `popularity` ondalığıyla
  // döndürdüğü için tam karşılaştırma, kullanıcı için hiçbir fark olmadığı
  // hâlde tüm rayı yeniden çizdirirdi — kimlik bazında karşılaştırıyoruz.
  const apply = (results, totalPages, { arkaPlan = false } = {}) => {
    if (isStale?.()) return;
    if (setTotal) setTotal(totalPages || 1);
    if (append) setData((prev) => mergeUniqueById(prev, results));
    else if (arkaPlan) setListIfChanged(setData, results);
    else setIfChanged(setData, results);
  };

  // BAYAT GÖSTER, ARKA PLANDA TAZELE. TTL 24 saat olduğu için gün içinde
  // cache hep taze sayılır ve ağ isteği yapılmaz. forceRefresh (pull-to-refresh)
  // bu kontrolü bypass eder ve ağdan yeniden çeker.
  const cached = getSwr(cacheKey, { maxAge: ttl });
  const cachedData = cached.data;
  if (cachedData) {
    apply(cachedData.results ?? cachedData, cachedData.total_pages ?? 1);
    (append ? setLoadingMore : setLoading)(false);
    if (cached.fresh && !forceRefresh) return;
  } else {
    (append ? setLoadingMore : setLoading)(true);
  }

  try {
    const { results, total_pages } = await request();
    apply(results, total_pages, { arkaPlan: Boolean(cachedData) });
    setCachedValue(
      cacheKey,
      { results, total_pages },
      { startupSnapshot: startupSnapshot && !append },
    );
  } catch (error) {
    if (__DEV__) console.error("loadPage:", error?.message || error);
  } finally {
    if (!cachedData) (append ? setLoadingMore : setLoading)(false);
  }
};

export const MovieProvider = ({ children }) => {
  const { API_KEY } = useApiSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  // Veriyi değiştiren ayarlar (yetişkin içerik, platform üyelikleri) — ana ekran
  // listeleri bunlara göre yeniden çekilir (bkz. utils/homeContentSettings.js).
  const { adultContent, providersKey } = useHomeDataSettings();
  // `/discover` tabanlı listelerin önbellek anahtarı yetişkin izniyle kapsamlanır.
  // trending/now_playing gibi uçlar ayardan bağımsız; onlar `dropAdult` ile süzülür.
  const adultKey = (key) => adultScoped(key, adultContent);
  const { language, t } = useLanguage();
  const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
  const tmdbRegion = language === "tr" ? "TR" : "US";
  const [activeSections, setActiveSections] = useState({});

  // ── AÇILIŞ TOHUMLARI ──────────────────────────────────────────────────────
  //
  // Son oturumda görülen listeler MMKV'den SENKRON okunuyor, yani İLK KAREDE
  // çiziliyor. Eskiden state `[]` + `loading:true` ile başlıyordu; önbellek
  // DOLU olsa bile veri ancak efekt çalıştıktan sonra geldiği için kullanıcı
  // her açılışta bir kare iskelet görüyordu.
  //
  // `useMemo(..., [])`: tohum yalnız ilk render için. Kategori/dil değişimini
  // ilgili efekt zaten yeniden çekiyor.
  const trendsSeed = useMemo(
    () =>
      seedList(`movie_trends_${tmdbLanguage}_week_trending`, {
        maxAge: TTL.TREND,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const bestsSeed = useMemo(
    () =>
      seedList(adultKey(`movie_bests_${tmdbLanguage}_vote_count.desc_page_1`), {
        maxAge: TTL.TREND,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Bölüm başına istek jenerasyonu: fresh (sayfa 1) fetch jenerasyonu artırır,
  // append aynı jenerasyonda kalır. Kategori/dil değişince eski in-flight
  // isteklerin sonuçları stale sayılır ve state'e uygulanmaz.
  const requestGenRef = useRef({});
  const beginFreshRequest = (key) => {
    requestGenRef.current[key] = (requestGenRef.current[key] || 0) + 1;
    return requestGenRef.current[key];
  };
  const currentGen = (key) => requestGenRef.current[key] || 0;

  const activateMovieSection = useCallback((section) => {
    setActiveSections((current) => {
      if (current[section]) return current;
      return { ...current, [section]: true };
    });
  }, []);

  const [totalPagesBest, setTotalPagesBest] = useState(bestsSeed.totalPages);
  const [pageBest, setPageBest] = useState(1);
  const [loadingBests, setLoadingBests] = useState(!bestsSeed.hasCache);
  const [loadingMoreBests, setLoadingMoreBests] = useState(false);
  const [movieBests, setMoviesBests] = useState(bestsSeed.list);
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

  const fetchMoviesBests = (page = 1, append = false, forceRefresh = false) => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const gen = append ? currentGen("bests") : beginFreshRequest("bests");
    return loadPage({
      cacheKey: adultKey(`movie_bests_${lang}_${selectedCategoryBests}_page_${page}`),
      ttl: TTL.TREND,
      append,
      forceRefresh,
      isStale: () => currentGen("bests") !== gen,
      setData: setMoviesBests,
      setTotal: setTotalPagesBest,
      setLoading: setLoadingBests,
      setLoadingMore: setLoadingMoreBests,
      startupSnapshot: true,
      request: async () => {
        const response = await axios.request({
          method: "GET",
          url: "https://api.themoviedb.org/3/discover/movie",
          params: {
            include_null_first_air_dates: "false",
            language: lang,
            page,
            sort_by: selectedCategoryBests,
            "vote_count.gte": "100",
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
    if (!activeSections.bests) return;
    setPageBest(1);
    fetchMoviesBests(1, false);
  }, [activeSections.bests, selectedCategoryBests, language, adultContent]);

  const loadMoreBests = () => {
    if (loadingBests || loadingMoreBests || pageBest >= totalPagesBest) return;
    const next = pageBest + 1;
    setPageBest(next);
    fetchMoviesBests(next, true);
  };

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

  // Eski cache sürümleri spacer kaydı içerebiliyor; tohumu da normalize et.
  const [movieTrends, setMovieTrends] = useState(() =>
    mergeTrendItems([], trendsSeed.list),
  );
  const [loadingTrends, setLoadingTrends] = useState(!trendsSeed.hasCache);
  const [loadingMoreTrends, setLoadingMoreTrends] = useState(false);
  const [pageTrends, setPageTrends] = useState(1);
  // Tohumla açıldığında "daha fazla yükle" hemen çalışabilsin; gerçek değeri
  // ilk istek yazacak.
  const [totalPagesTrends, setTotalPagesTrends] = useState(
    trendsSeed.hasCache ? 1000 : 1,
  );
  const [selectedCategoryTrends, setSelectedCategoryTrends] = useState("week");
  const [selectedCategoryTrendsMovie, setSelectedCategoryTrendsMovie] =
    useState("trending");

  const fetchSeriesTrends = async (page = 1, append = false, forceRefresh = false) => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const gen = append ? currentGen("trends") : beginFreshRequest("trends");
    const isStale = () => currentGen("trends") !== gen;
    const baseKey = `movie_trends_${lang}_${selectedCategoryTrends}_${selectedCategoryTrendsMovie}`;
    const cacheKey = page === 1 ? baseKey : `${baseKey}_p${page}`;

    // Bayat göster, arka planda tazele — bkz. loadPage'deki aynı desen.
    const swr = getSwr(cacheKey, { maxAge: TTL.TREND });
    const cached = swr.data;
    if (cached) {
      if (isStale()) return;
      if (append) {
        setMovieTrends((prev) => mergeTrendItems(prev, cached.results ?? cached));
        setLoadingMoreTrends(false);
      } else {
        // Eski spacer'lı cache kayıtlarını da okurken temizle.
        setIfChanged(setMovieTrends, mergeTrendItems([], cached.results ?? cached));
        setLoadingTrends(false);
        // toplam sayfa önbellekte yok → loadMore'a izin vermek için üst sınır
        setTotalPagesTrends((p) => (p > 1 ? p : 1000));
      }
      if (swr.fresh && !forceRefresh) return;
    } else {
      (append ? setLoadingMoreTrends : setLoadingTrends)(true);
    }

    try {
      const response = await axios.request({
        method: "GET",
        url: `https://api.themoviedb.org/3/${selectedCategoryTrendsMovie}/movie/${selectedCategoryTrends}`,
        params: {
          include_null_first_air_dates: "false",
          language: lang,
          page,
        },
        headers: { accept: "application/json", Authorization: API_KEY },
      });
      const results = response.data.results || [];
      // Cache doğru anahtara yazılabilir; yalnızca state güncellemesi stale'de atlanır.
      setCachedValue(append ? cacheKey : baseKey, results, {
        startupSnapshot: !append,
      });
      if (isStale()) return;
      setTotalPagesTrends(response.data.total_pages || 1);
      if (append) {
        setMovieTrends((prev) => mergeTrendItems(prev, results));
      } else if (cached) {
        // Arka plan tazelemesi: yalnız içerik gerçekten değiştiyse rayı
        // yeniden çiz (bkz. loadPage'deki `arkaPlan` açıklaması).
        setListIfChanged(setMovieTrends, mergeTrendItems([], results));
      } else {
        setIfChanged(setMovieTrends, mergeTrendItems([], results));
      }
    } catch (error) {
      if (__DEV__) console.error("fetchSeriesTrends:", error?.message || error);
    } finally {
      if (!cached) (append ? setLoadingMoreTrends : setLoadingTrends)(false);
    }
  };
  useEffect(() => {
    if (!activeSections.trends) return;
    setPageTrends(1);
    fetchSeriesTrends(1, false);
  }, [activeSections.trends, selectedCategoryTrends, selectedCategoryTrendsMovie, language]);

  const loadMoreTrends = () => {
    if (loadingTrends || loadingMoreTrends || pageTrends >= totalPagesTrends) return;
    const next = pageTrends + 1;
    setPageTrends(next);
    fetchSeriesTrends(next, true);
  };

  //!--------------------------- movie oscar --------------
  const [oscarMode, setOscarMode] = useState("category"); // "category" | "year"
  const [selectedOscarCategory, setSelectedOscarCategory] = useState(DEFAULT_OSCAR_CATEGORY);
  const [selectedOscarYear, setSelectedOscarYear] = useState(2026);
  const [moviesOscar, setMoviesOscar] = useState([]);
  const [moviesOscarYear, setMoviesOscarYear] = useState([]);
  const [loadingOscar, setLoadingOscar] = useState(true);
  const [loadingOscarYear, setLoadingOscarYear] = useState(false);
  const [loadingMoreOscar, setLoadingMoreOscar] = useState(false);
  const [hasMoreOscar, setHasMoreOscar] = useState(true);
  const [errorOscar, setErrorOscar] = useState(null);
  const oscarConfigRef = useRef(null);
  const oscarPageRef = useRef(0);
  const loadingMoreOscarRef = useRef(false);

  const mergeOscarItems = (prev, next) => {
    if (!Array.isArray(next)) return prev;
    const seen = new Set(
      (Array.isArray(prev) ? prev : [])
        .map((x) => (x ? `${x.year}-${x.categoryKey || "best_picture"}` : null))
        .filter(Boolean),
    );
    return [
      ...(Array.isArray(prev) ? prev : []),
      ...next.filter((x) => {
        if (!x) return false;
        const key = `${x.year}-${x.categoryKey || "best_picture"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  };

  const fetchMoviesOscar = useCallback(async (catKey = selectedOscarCategory, forceRefresh = false) => {
    setLoadingOscar(true);
    setErrorOscar(null);
    oscarPageRef.current = 0;
    try {
      const config = await getOscarConfig({ forceRefresh });
      oscarConfigRef.current = config?.items || [];

      const res = await fetchOscarByCategory({
        configItems: oscarConfigRef.current,
        categoryKey: catKey,
        page: 0,
        pageSize: 10,
        language,
        apiKey: API_KEY,
      });

      setIfChanged(setMoviesOscar, res.items);
      setHasMoreOscar(res.hasMore);
      oscarPageRef.current = res.nextPage;
    } catch (err) {
      setErrorOscar(err.message);
    } finally {
      setLoadingOscar(false);
    }
  }, [selectedOscarCategory, language, API_KEY]);

  const loadMoreOscar = useCallback(async () => {
    if (
      loadingMoreOscarRef.current ||
      !hasMoreOscar ||
      !oscarConfigRef.current
    ) {
      return;
    }
    loadingMoreOscarRef.current = true;
    setLoadingMoreOscar(true);
    const nextPage = oscarPageRef.current;
    try {
      const res = await fetchOscarByCategory({
        configItems: oscarConfigRef.current,
        categoryKey: selectedOscarCategory,
        page: nextPage,
        pageSize: 10,
        language,
        apiKey: API_KEY,
      });

      if (res.items?.length) {
        setMoviesOscar((prev) => mergeOscarItems(prev, res.items));
        setHasMoreOscar(res.hasMore);
        oscarPageRef.current = res.nextPage;
      } else {
        setHasMoreOscar(false);
      }
    } catch (err) {
      if (__DEV__) console.warn("loadMoreOscar error:", err?.message);
    } finally {
      loadingMoreOscarRef.current = false;
      setLoadingMoreOscar(false);
    }
  }, [hasMoreOscar, selectedOscarCategory, language, API_KEY]);

  const fetchMoviesOscarByYear = useCallback(async (year = selectedOscarYear, forceRefresh = false) => {
    setLoadingOscarYear(true);
    try {
      const config = await getOscarConfig({ forceRefresh });
      oscarConfigRef.current = config?.items || [];

      const results = await fetchOscarByYear({
        configItems: oscarConfigRef.current,
        year,
        language,
        apiKey: API_KEY,
      });

      setIfChanged(setMoviesOscarYear, results);
    } catch (err) {
      if (__DEV__) console.warn("fetchMoviesOscarByYear error:", err?.message);
    } finally {
      setLoadingOscarYear(false);
    }
  }, [selectedOscarYear, language, API_KEY]);

  const changeOscarCategory = useCallback((catKey) => {
    if (catKey === selectedOscarCategory) return;
    setSelectedOscarCategory(catKey);
  }, [selectedOscarCategory]);

  const changeOscarYear = useCallback((year) => {
    const numYear = Number(year);
    if (numYear === selectedOscarYear) return;
    setSelectedOscarYear(numYear);
  }, [selectedOscarYear]);

  const changeOscarMode = useCallback((mode) => {
    setOscarMode(mode);
    if (mode === "year" && (!moviesOscarYear || moviesOscarYear.length === 0)) {
      fetchMoviesOscarByYear(selectedOscarYear);
    }
  }, [moviesOscarYear, selectedOscarYear, fetchMoviesOscarByYear]);

  useEffect(() => {
    if (!activeSections.oscar) return;
    if (oscarMode === "category") {
      fetchMoviesOscar(selectedOscarCategory);
    } else {
      fetchMoviesOscarByYear(selectedOscarYear);
    }
  }, [activeSections.oscar, language, oscarMode, selectedOscarCategory, selectedOscarYear, fetchMoviesOscar, fetchMoviesOscarByYear]);
  //!------------------ movie collection --------------

  const moviesCollectionList = [
    // ── Kullanıcının küratörlü listesi ──
    "10", // Star Wars
    "1241", // Harry Potter
    "86311", // The Avengers
    "748", // X-Men
    "263", // The Dark Knight
    "9485", // The Fast and the Furious
    "119", // The Lord of the Rings
    "121938", // The Hobbit
    "87359", // Mission: Impossible
    "556", // Spider-Man
    "531241", // Spider-Man (Home / MCU)
    "295", // Pirates of the Caribbean
    "645", // James Bond
    "2344", // The Matrix
    "8650", // Transformers
    "131635", // The Hunger Games
    "328", // Jurassic Park
    "8354", // Ice Age
    "14740", // Twilight
    // ── Ek popüler seri filmler (TMDB'den doğrulandı) ──
    "10194", // Toy Story
    "86066", // Despicable Me
    "2150", // Shrek
    "528", // The Terminator
    "1575", // Rocky
    "230", // The Godfather
    "8091", // Alien
    "399", // Predator
    "264", // Back to the Future
    "84", // Indiana Jones
    "31562", // The Bourne
    "404609", // John Wick
    "656", // Saw
    "8945", // Mad Max
    "87118", // Cars
    "77816", // Kung Fu Panda
    "89137", // How to Train Your Dragon
    "313086", // The Conjuring
    "1570", // Die Hard
    "304", // Ocean's
    "4246", // Scary Movie
    "391860", // Kingsman
    "448150", // Deadpool
    "284433", // Guardians of the Galaxy
    "137697", // Finding Nemo
    "386382", // Frozen
    "5547", // RoboCop
  ]; // koleksiyon ID'leri

  const [moviesCollection, setMoviesCollection] = useState([]);
  const [loadingCollection, setLoadingCollection] = useState(true);
  const [errorCollection, setErrorCollection] = useState(null);

  // Bir koleksiyon kimliği listesini /collection/{id} ile detaya çevirir.
  const fetchCollectionsByIds = async (ids, lang) => {
    const results = await Promise.all(
      ids.map((id) =>
        axios
          .get(`https://api.themoviedb.org/3/collection/${id}`, {
            params: { language: lang },
            headers: { Authorization: API_KEY },
          })
          .then((r) => r.data || null)
          .catch(() => null),
      ),
    );
    return results.filter(
      (c) =>
        c &&
        c.poster_path &&
        Array.isArray(c.parts) &&
        c.parts.some((p) => p && p.poster_path),
    );
  };

  const fetchMoviesCollection = async () => {
    const lang = language === "tr" ? "tr-TR" : "en-US";
    const cacheKey = `movie_collection_${lang}`;
    const cached = await getCachedValue(cacheKey, TTL.COLLECTION);
    if (cached && cached.length) {
      setIfChanged(setMoviesCollection, cached);
      setErrorCollection(null);
      setLoadingCollection(false);
      return;
    }

    setLoadingCollection(true);
    try {
      // Küratörlü sabit koleksiyon listesi (popüler seri filmler).
      const collections = await fetchCollectionsByIds(moviesCollectionList, lang);
      setIfChanged(setMoviesCollection, collections);
      setErrorCollection(null);
      if (collections.length) setCachedValue(cacheKey, collections);
    } catch (err) {
      const message =
        err.response?.data?.status_message || err.message || i18nText("autoI18n.bilinmeyen_hata", "Bilinmeyen hata");
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
  const [loadingMoreProvider, setLoadingMoreProvider] = useState(false);
  const [pageProvider, setPageProvider] = useState(1);
  const [totalPagesProvider, setTotalPagesProvider] = useState(1);

  // `providersKey`: dizi kimliği değil İÇERİK — aynı küme yeniden yazılınca
  // kullanıcının elle seçtiği sağlayıcı sıfırlanmasın.
  useEffect(() => {
    if (!activeSections.providers) return;
    fetchProviders();
  }, [activeSections.providers, language, providersKey]);

  // Yetişkin izni değişince sağlayıcı listesi aynı kalır ama seçili sağlayıcının
  // filmleri (`/discover`) değişir. fetchProviders'ı çağırmak kullanıcının seçimini
  // "ilk abone olunan sağlayıcı"ya sıfırlardı; yalnız seçili olanı yeniden çekiyoruz.
  const lastAdultRef = useRef(adultContent);
  useEffect(() => {
    if (lastAdultRef.current === adultContent) return;
    lastAdultRef.current = adultContent;
    if (activeSections.providers && selectedProvider != null) {
      fetchMoviesByProvider(selectedProvider);
    }
  }, [adultContent]);

  const fetchProviders = async () => {
    const cacheKey = `movie_providers_${tmdbLanguage}_${tmdbRegion}`;
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
      const url = `https://api.themoviedb.org/3/watch/providers/movie?language=${tmdbLanguage}&watch_region=${tmdbRegion}`;
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

  // Seçilen sağlayıcıya göre filmleri çek (sayfalı)
  const fetchMoviesByProvider = (providerId, page = 1, append = false) => {
    if (!append) {
      setSelectedProvider(providerId);
      setPageProvider(1);
    }
    const gen = append ? currentGen("provider") : beginFreshRequest("provider");
    return loadPage({
      cacheKey: adultKey(`movie_provider_${tmdbLanguage}_${tmdbRegion}_${providerId}_p${page}`),
      ttl: TTL.PROVIDERS,
      append,
      isStale: () => currentGen("provider") !== gen,
      setData: setMoviesProvider,
      setTotal: setTotalPagesProvider,
      setLoading: setLoadingMovieProvider,
      setLoadingMore: setLoadingMoreProvider,
      request: async () => {
        const url = `https://api.themoviedb.org/3/discover/movie?language=${tmdbLanguage}&watch_region=${tmdbRegion}&with_watch_providers=${providerId}&sort_by=vote_count.desc&page=${page}`;
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
      loadingMovieProvider ||
      loadingMoreProvider ||
      !selectedProvider ||
      pageProvider >= totalPagesProvider
    )
      return;
    const next = pageProvider + 1;
    setPageProvider(next);
    fetchMoviesByProvider(selectedProvider, next, true);
  };

  const [moviesNowPlaying, setMoviesNowPlaying] = useState([]);
  const [loadingNowPlaying, setLoadingNowPlaying] = useState(false);
  const [loadingMoreNowPlaying, setLoadingMoreNowPlaying] = useState(false);
  const [pageNowPlaying, setPageNowPlaying] = useState(1);
  const [totalPagesNowPlaying, setTotalPagesNowPlaying] = useState(1);

  useEffect(() => {
    if (!activeSections.nowPlaying) return;
    setPageNowPlaying(1);
    fetchMoviNowPlaying(1, false);
  }, [activeSections.nowPlaying, language]);

  const fetchMoviNowPlaying = (page = 1, append = false, forceRefresh = false) => {
    const gen = append ? currentGen("nowPlaying") : beginFreshRequest("nowPlaying");
    return loadPage({
      cacheKey: `movie_now_playing_${tmdbLanguage}_${tmdbRegion}_p${page}`,
      ttl: TTL.NOW_PLAYING,
      append,
      forceRefresh,
      isStale: () => currentGen("nowPlaying") !== gen,
      setData: setMoviesNowPlaying,
      setTotal: setTotalPagesNowPlaying,
      setLoading: setLoadingNowPlaying,
      setLoadingMore: setLoadingMoreNowPlaying,
      request: async () => {
        const url = `https://api.themoviedb.org/3/movie/now_playing?language=${tmdbLanguage}&region=${tmdbRegion}&page=${page}`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };

  const loadMoreNowPlaying = () => {
    if (loadingNowPlaying || loadingMoreNowPlaying || pageNowPlaying >= totalPagesNowPlaying) return;
    const next = pageNowPlaying + 1;
    setPageNowPlaying(next);
    fetchMoviNowPlaying(next, true);
  };

  const [genres, setGenres] = useState([]); // Başlangıç değeri boş dizi
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [moviesGenres, setMoviesGenres] = useState([]); // Filmler için yeni durum ekleyin
  const [loadingGenres, setLoadingGenres] = useState(true); // loading durumu ekleyin
  const [loadingMoreGenres, setLoadingMoreGenres] = useState(false);
  const [pageGenres, setPageGenres] = useState(1); // loading durumu ekleyin
  const [totalPagesGenres, setTotalPagesGenres] = useState(1);

  const movieGenres = async () => {
    const cacheKey = `movie_genres_${tmdbLanguage}`;
    const cached = await getCachedValue(cacheKey, TTL.GENRES);
    if (cached) {
      setIfChanged(setGenres, cached);
      setLoadingGenres(false);
      return;
    }

    try {
      const url = `https://api.themoviedb.org/3/genre/movie/list?language=${tmdbLanguage}`;
      const response = await axios.get(url, { headers: { Authorization: API_KEY } });
      setIfChanged(setGenres, response.data.genres);
      setCachedValue(cacheKey, response.data.genres);
    } catch (err) {
      if (__DEV__) console.error(err.message);
    } finally {
      setLoadingGenres(false);
    }
  };
  const fetchMoviesByGenres = (page = 1, append = false, forceRefresh = false) => {
    const genresKey = [...selectedGenres].sort().join(",");
    const gen = append ? currentGen("genres") : beginFreshRequest("genres");
    return loadPage({
      cacheKey: adultKey(`movie_genres_content_${tmdbLanguage}_p${page}_g${genresKey}`),
      ttl: TTL.TREND,
      append,
      forceRefresh,
      isStale: () => currentGen("genres") !== gen,
      setData: setMoviesGenres,
      setTotal: setTotalPagesGenres,
      setLoading: setLoadingGenres,
      setLoadingMore: setLoadingMoreGenres,
      request: async () => {
        let url = `https://api.themoviedb.org/3/discover/movie?language=${tmdbLanguage}&page=${page}`;
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
    movieGenres();
    setPageGenres(1);
    fetchMoviesByGenres(1, false);
  }, [activeSections.genres, language, selectedGenres, adultContent]);

  const loadMoreGenres = () => {
    if (loadingGenres || loadingMoreGenres || pageGenres >= totalPagesGenres) return;
    const next = pageGenres + 1;
    setPageGenres(next);
    fetchMoviesByGenres(next, true);
  };

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
  const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);
  const [pageUpcoming, setPageUpcoming] = useState(1); // loading durumu ekleyin
  const [totalPagesUpcoming, setTotalPagesUpcoming] = useState(1);
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
  const fetchMovieUpcoming = (page = 1, append = false, forceRefresh = false) => {
    if (!calculatedDate) return;
    const gen = append ? currentGen("upcoming") : beginFreshRequest("upcoming");
    return loadPage({
      cacheKey: adultKey(`movie_upcoming_${tmdbLanguage}_${tmdbRegion}_${calculatedDate}_p${page}`),
      ttl: TTL.NOW_PLAYING,
      append,
      forceRefresh,
      isStale: () => currentGen("upcoming") !== gen,
      setData: setMoviesUpcoming,
      setTotal: setTotalPagesUpcoming,
      setLoading: setLoadingUpcoming,
      setLoadingMore: setLoadingMoreUpcoming,
      request: async () => {
        const url = `https://api.themoviedb.org/3/discover/movie?include_video=false&language=${tmdbLanguage}&primary_release_date.gte=${formatDate(today)}&primary_release_date.lte=${calculatedDate}&region=${tmdbRegion}&page=${page}&sort_by=popularity.desc`;
        const response = await axios.get(url, { headers: { Authorization: API_KEY } });
        return {
          results: response.data.results,
          total_pages: response.data.total_pages,
        };
      },
    });
  };

  useEffect(() => {
    if (!activeSections.upcoming) return;
    addTimeToDate(valueUpcoming);
  }, [activeSections.upcoming, valueUpcoming]);

  useEffect(() => {
    if (!activeSections.upcoming || !calculatedDate) return;
    setPageUpcoming(1);
    fetchMovieUpcoming(1, false);
  }, [activeSections.upcoming, language, calculatedDate, adultContent]);

  const loadMoreUpcoming = () => {
    if (loadingUpcoming || loadingMoreUpcoming || pageUpcoming >= totalPagesUpcoming) return;
    const next = pageUpcoming + 1;
    setPageUpcoming(next);
    fetchMovieUpcoming(next, true);
  };

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

  // ── PULL-TO-REFRESH: Tüm aktif bölümleri zorla yenile ──────────────────
  const refreshAllMovies = useCallback(async () => {
    const jobs = [];
    if (activeSections.trends)     jobs.push(fetchSeriesTrends(1, false, true));
    if (activeSections.bests)      jobs.push(fetchMoviesBests(1, false, true));
    if (activeSections.nowPlaying) jobs.push(fetchMoviNowPlaying(1, false, true));
    if (activeSections.upcoming)   jobs.push(fetchMovieUpcoming(1, false, true));
    if (activeSections.genres)     jobs.push(fetchMoviesByGenres(1, false, true));
    if (activeSections.oscar) {
      if (oscarMode === "category") jobs.push(fetchMoviesOscar(selectedOscarCategory, true));
      else jobs.push(fetchMoviesOscarByYear(selectedOscarYear, true));
    }
    if (activeSections.collection) jobs.push(fetchMoviesCollection());
    await Promise.allSettled(jobs);
  }, [
    activeSections,
    fetchSeriesTrends,
    fetchMoviesBests,
    fetchMoviNowPlaying,
    fetchMovieUpcoming,
    fetchMoviesByGenres,
    oscarMode,
    selectedOscarCategory,
    selectedOscarYear,
    fetchMoviesOscar,
    fetchMoviesOscarByYear,
    fetchMoviesCollection,
  ]);

  // Yetişkin izni yokken ekrandaki listelerden `adult:true` kayıtlar ANINDA elenir:
  // ayarı kapatınca ağ isteği ya da yeniden yükleme beklenmez. Süzülecek bir şey
  // yoksa aynı dizi döner, yani kartlar boşuna yeniden çizilmez. `/discover`
  // dışındaki uçlar (trending vb.) bu sayede ayarı önbellek kapsamı olmadan da
  // izliyor.
  const visibleBests = useMemo(() => dropAdult(movieBests, adultContent), [movieBests, adultContent]);
  const visibleTrends = useMemo(() => dropAdult(movieTrends, adultContent), [movieTrends, adultContent]);
  const visibleNowPlaying = useMemo(() => dropAdult(moviesNowPlaying, adultContent), [moviesNowPlaying, adultContent]);
  const visibleGenres = useMemo(() => dropAdult(moviesGenres, adultContent), [moviesGenres, adultContent]);
  const visibleUpcoming = useMemo(() => dropAdult(moviesUpcoming, adultContent), [moviesUpcoming, adultContent]);
  const visibleProvider = useMemo(() => dropAdult(moviesProvider, adultContent), [moviesProvider, adultContent]);

  const contextValue = useMemo(() => ({
    pageBest,
    loadingBests,
    movieBests: visibleBests,
    selectedCategoryTrends,
    categoriesTrends,
    categorieBests,
    movieTrends: visibleTrends,
    loadingTrends,
    selectedCategoryTrendsMovie,
    selectedCategoryBests,
    totalPagesBest,
    moviesOscar,
    loadingOscar,
    loadingMoreOscar,
    hasMoreOscar,
    errorOscar,
    loadMoreOscar,
    selectedProvider,
    providers,
    loadingProvider,
    loadingMovieProvider,
    moviesProvider: visibleProvider,
    moviesNowPlaying: visibleNowPlaying,
    loadingNowPlaying,
    genres,
    loadingGenres,
    moviesGenres: visibleGenres,
    pageGenres,
    selectedGenres,
    dateData,
    moviesUpcoming: visibleUpcoming,
    loadingUpcoming,
    pageUpcoming,
    valueUpcoming,
    isFocusUpcoming,
    moviesCollection,
    loadingCollection,
    errorCollection,

    setTotalPagesBest,
    setPageBest,
    loadMoreBests,
    loadingMoreBests,
    loadMoreGenres,
    loadingMoreGenres,
    totalPagesGenres,
    loadMoreUpcoming,
    loadingMoreUpcoming,
    totalPagesUpcoming,
    loadMoreNowPlaying,
    loadingMoreNowPlaying,
    pageNowPlaying,
    totalPagesNowPlaying,
    loadMoreProvider,
    loadingMoreProvider,
    pageProvider,
    totalPagesProvider,
    loadMoreTrends,
    loadingMoreTrends,
    pageTrends,
    totalPagesTrends,
    oscarMode,
    setOscarMode,
    changeOscarMode,
    selectedOscarCategory,
    setSelectedOscarCategory,
    changeOscarCategory,
    OSCAR_CATEGORIES,
    selectedOscarYear,
    setSelectedOscarYear,
    changeOscarYear,
    moviesOscarYear,
    loadingOscarYear,
    fetchMoviesOscar,
    fetchMoviesOscarByYear,
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
    fetchMoviesCollection,
    fetchProviders,
    fetchMoviNowPlaying,
    fetchMovieUpcoming,
    fetchMoviesByGenres,
    refreshAllMovies,
  }), [
    pageBest, loadingBests, visibleBests, selectedCategoryTrends,
    categoriesTrends, categorieBests, visibleTrends, loadingTrends,
    selectedCategoryTrendsMovie, selectedCategoryBests, totalPagesBest,
    oscarMode, selectedOscarCategory, selectedOscarYear, moviesOscar, moviesOscarYear,
    loadingOscar, loadingOscarYear, loadingMoreOscar, hasMoreOscar, errorOscar,
    changeOscarMode, changeOscarCategory, changeOscarYear, fetchMoviesOscar, loadMoreOscar, fetchMoviesOscarByYear,
    selectedProvider, providers,
    loadingProvider, loadingMovieProvider, visibleProvider, visibleNowPlaying,
    loadingNowPlaying, genres, loadingGenres, visibleGenres, pageGenres,
    selectedGenres, dateData, visibleUpcoming, loadingUpcoming,
    pageUpcoming, valueUpcoming, isFocusUpcoming, moviesCollection,
    loadingCollection, errorCollection, activateMovieSection,
    loadingMoreBests, loadingMoreGenres, totalPagesGenres,
    loadingMoreUpcoming, totalPagesUpcoming,
    loadingMoreNowPlaying, pageNowPlaying, totalPagesNowPlaying,
    loadingMoreProvider, pageProvider, totalPagesProvider,
    loadingMoreTrends, pageTrends, totalPagesTrends,
    refreshAllMovies,
    // Değerdeki yükleyiciler (loadMore*, fetch*) `adultKey`i kapanışla yakalar;
    // ayar değişince bayat kapanış kalmasın diye açıkça bağımlılık.
    adultContent,
  ]);

  return (
    <MovieContext.Provider value={contextValue}>
      {children}
    </MovieContext.Provider>
  );
};
