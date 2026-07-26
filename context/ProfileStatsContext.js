import React, {
  createContext, useContext, useEffect, useState, useMemo,
} from "react";
import { doc, collection, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { Animated } from "react-native";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useListStatusContext } from "./ListStatusContext";
import Toast from "react-native-toast-message";
import { snapshotErrorHandler } from "../utils/firestoreError";
import { dedupeWatchedTvEntries } from "../services/watchedTvService";
import {
  clearListsWidget,
  syncListsWidget,
} from "../services/listsWidgetService";
import {
  clearStatsWidget,
  syncStatsWidget,
} from "../services/statsWidgetService";
import { i18nText } from "../utils/i18nText";
import useStartupGate from "../hooks/useStartupGate";
import {
  flattenMovieWatchEntries,
  flattenTvEpisodeWatchEntries,
  materializeTvWatchState,
  mostRewatched,
} from "../utils/watchHistory";


const ProfileStatsContext = createContext();
export const useProfileStats = () => useContext(ProfileStatsContext);

// ─── Pure helpers (stable — defined outside component) ───────────────────────

const formatTime = (minutes) => {
  const years  = Math.floor(minutes / (365 * 24 * 60));
  const months = Math.floor((minutes % (365 * 24 * 60)) / (30 * 24 * 60));
  const days   = Math.floor((minutes % (30 * 24 * 60)) / (24 * 60));
  const hours  = Math.floor((minutes % (24 * 60)) / 60);
  const mins   = minutes % 60;
  return { years, months, days, hours, minutes: mins };
};

const parseDate = (date) => {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    return new Date(date);
  if (date?.seconds) return new Date(date.seconds * 1000);
  return new Date(date);
};

const groupByDate = (items) => {
  const groups = {};
  items.forEach((item) => {
    const dateStr =
      typeof item.dateAdded === "string"
        ? item.dateAdded
        : item.dateAdded?.seconds
        ? new Date(item.dateAdded.seconds * 1000).toISOString().slice(0, 10)
        : "";
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(item);
  });
  return Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([date, data]) => ({ title: date, data }));
};

const groupByDateFlatTv = (items) => {
  const groups = {};
  items.forEach((item) => {
    let dateStr = null;
    if (item.episodeWatchTime?.seconds)
      dateStr = new Date(item.episodeWatchTime.seconds * 1000)
        .toISOString()
        .slice(0, 10);
    else if (typeof item.episodeWatchTime === "string")
      dateStr = item.episodeWatchTime.slice(0, 10);
    if (!dateStr) return;
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(item);
  });
  return Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([date, data]) => ({ title: date, data }));
};

// Avatar halkalarını, hero gradyanını ve istatistik ekranlarının accent'ini
// besleyen türetilmiş renk. `step` = 10.080 dakikalık (1 hafta) izleme adımı.
//
// ETİKET DEĞİŞTİ, RENK ÜRETİMİ AYNI: eskiden "Rank 7" yazıyordu ve bu, profildeki
// asıl ilerleme göstergesi olan **Perde** ile (components/profile/WatchLevelCard.js)
// aynı anlama gelen ikinci bir "seviye" gibi okunuyordu — uygulamada üç ayrı
// ilerleme sayısı görünüyordu (Rank, Perde, oyun Seviyesi). Artık ölçtüğü şeyi
// söylüyor: "7 hafta". Renk mantığına ve 6 görsel yüzeye DOKUNULMADI; tam
// emeklilik gereksiz bir regresyon yüzeyi olurdu (docs §10.3).
const getDynamicRankColor = (totalMinutes, type) => {
  const step = Math.floor(totalMinutes / 10080);
  const hue  = (step * 35) % 360;
  const c1 = `hsl(${hue}, 80%, 50%)`;
  const c2 = `hsl(${(hue + 20) % 360}, 90%, 60%)`;
  const c3 = `hsla(${(hue + 40) % 360}, 70%, 40%, 0.9)`;
  const label = i18nText("autoI18n.hafta_sayisi", `${step} hafta`, { count: step });
  return type === "movie"
    ? { borderColorMovie: c1, borderColor2Movie: c2, shadowColorMovie: c3, rankLevelMovie: step, rankNameMovie: label }
    : { borderColorTv: c1, borderColor2Tv: c2, shadowColorTv: c3, rankLevelTv: step, rankNameTv: label };
};

const getTopGenreNames = (items, limit = 3) => {
  const counts = {};
  (items || []).forEach((item) =>
    (item.genres || []).forEach((genre) => {
      if (genre) counts[genre] = (counts[genre] || 0) + 1;
    }),
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([genre]) => genre);
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const ProfileStatsProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;

  // Bu context'in tüketicileri (Profil sekmesi, istatistik ekranları, AI sohbet)
  // açılışta mount değil; listener'lar + flatEpisodesTv/groupBy türetmeleri ilk
  // saniyelerde JS thread'i kilitliyordu. Splash sonrası pencerenin dışına ertele.
  const startupReady = useStartupGate(3200);
  const { t, language } = useLanguage();
  // Öntanımlı listeler (favorites/watchList/watchedMovies) artık subcollection'da;
  // kök doc'tan kalkacakları için profil liste kartları combinedLists'ten beslenir.
  const { combinedLists } = useListStatusContext();

  const [lists,              setLists]             = useState([]);
  const [selectedList,       setSelectedList]       = useState(null);
  const [modalDeleteVisible, setModalDeleteVisible] = useState(false);

  const [watchedMovieCount,   setWatchedMovieCount]   = useState(0);
  const [totalWatchedTime,    setTotalWatchedTime]     = useState({});
  const [totalMinutesTime,    setTotalMinutesTime]     = useState(0);
  const [watchedTvCount,      setWatchedTvCount]       = useState(0);
  const [totalSeasonsCount,   setTotalSeasonsCount]    = useState(0);
  const [totalEpisodesCount,  setTotalEpisodesCount]   = useState(0);
  const [totalWatchedTimeTv,  setTotalWatchedTimeTv]   = useState({});
  const [totalMinutesTimeTv,  setTotalMinutesTimeTv]   = useState(0);

  const [isLoading,          setIsLoading]          = useState(false);
  const [loadingTv,          setLoadingTv]          = useState(true);
  const [loadingMovies,      setLoadingMovies]      = useState(true);
  const [isloadingShowInfo,  setIsLoadingShowInfo]  = useState(false);
  const [isloadingMovieInfo, setIsLoadingMovieInfo] = useState(false);

  const [listItems,   setListItems]   = useState([]);
  const [listItemsTv, setListItemsTv] = useState([]);
  const [selectedDate,   setSelectedDate]   = useState(null);
  const [selectedDateTv, setSelectedDateTv] = useState(null);
  const [timeDisplayMode, setTimeDisplayMode] = useState("minutes");
  const [scaleValues,     setScaleValues]     = useState({});

  // ── Logout/hesap değişimi: önceki hesabın verisi yeni hesaba sızmasın ───
  // Listener effect'leri `!uid` iken sadece return ediyor; state'i burada
  // sıfırlamazsak A çıkış yapıp B girince B'nin snapshot'ları gelene dek
  // (legacy kayıtlar içinse kalıcı olarak) A'nın izleme verisi görünür.
  useEffect(() => {
    if (uid) return;
    setListItems([]);
    setListItemsTv([]);
    setLists([]);
  }, [uid]);

  // ── Root doc listener — özel listeler + eski format veri ────────────────
  useEffect(() => {
    if (!uid || !startupReady) return;
    setIsLoadingMovieInfo(true);
    setIsLoadingShowInfo(true);
    setIsLoading(true);
    setLoadingTv(true);

    const unsub = onSnapshot(doc(db, "Lists", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Özel listeler (custom list yönetimi için)
        setLists(Object.entries(data));

        // Film verisi artık YALNIZ subcollection'dan gelir (watchedMovies
        // listener'ı). Eski kök-array merge'i kaldırıldı — migration array'i
        // taşıyıp kök'ten siler (hibrit yok).

        // Eski format dizi verisi — subcollection listener tarafından override edilir
        const oldShows = data?.watchedTv || [];
        setListItemsTv((prev) => {
          const subIds = new Set(prev.filter((s) => s._src === "sub").map((s) => s.id));
          const legacy = oldShows.filter((s) => !subIds.has(s.id));
          const subItems = prev.filter((s) => s._src === "sub");
          return [...subItems, ...legacy];
        });
      } else {
        setLists([]);
      }
      setIsLoadingMovieInfo(false);
      setIsLoadingShowInfo(false);
      setIsLoading(false);
    }, snapshotErrorHandler("Stats/Lists"));
    return () => unsub();
  }, [uid, startupReady]);

  // ── Subcollection listener: watchedMovies ────────────────────────────────
  // `loadingMovies` NEDEN VAR: `isloadingMovieInfo` KÖK dokümanın bayrağıdır,
  // filmlerin geldiği bu subcollection'ın değil. Bayrak olmadan, watchedTv
  // snapshot'ı watchedMovies'ten önce gelirse tüketiciler "veri hazır" sanıp
  // SIFIR filmle hesap yapar. İzleme puanı için bu sessiz bir hata değil:
  // rozet defteri o anki (eksik) durumu "zaten senindi" diye tohumlar, filmler
  // gelince de kullanıcının yıllardır sahip olduğu rozetler YENİ kazanılmış
  // gibi kutlanır (hooks/useWatchProgress.js, docs §6.1).
  useEffect(() => {
    if (!uid || !startupReady) return;
    setLoadingMovies(true);
    const unsub = onSnapshot(collection(db, "Lists", uid, "watchedMovies"), (snap) => {
      // Firestore doc data'sında id alanı OLMAYABILIR — doc.id'yi explicit ekliyoruz.
      // Aksi halde item.id undefined olur, keyExtractor `item.id.toString()` crash eder.
      const subMovies = snap.docs.map((d) => {
        const data = d.data() || {};
        return { ...data, id: data.id ?? d.id, _src: "sub" };
      });
      setListItems((prev) => {
        const subIds = new Set(subMovies.map((m) => m.id));
        const legacy = prev.filter((m) => m._src !== "sub" && !subIds.has(m.id));
        return [...subMovies, ...legacy];
      });
      setLoadingMovies(false);
    }, snapshotErrorHandler("Stats/watchedMovies"));
    return () => unsub();
  }, [uid, startupReady]);

  // ── Subcollection listener: watchedTv ────────────────────────────────────
  useEffect(() => {
    if (!uid || !startupReady) return;
    const unsub = onSnapshot(collection(db, "Lists", uid, "watchedTv"), (snap) => {
      // bare+tv_ ikileme giderme: aynı dizi hem 1399 hem tv_1399 olarak
      // durabilir → dedupeWatchedTvEntries ile tekilleştir.
      //
      // HAM data GEÇİLİR, `id` ÖNCEDEN DOLDURULMAZ. Eskiden burada
      // `id: data.id ?? d.id` yazıyordu ve bu tekilleştirmeyi SESSİZCE
      // BOZUYORDU: dedupe `data.id ?? bareId` diyor, yani id zaten doluysa
      // `tv_` öneki hiç soyulmuyor ve "1399" ile "tv_1399" iki AYRI kayıt
      // oluyordu. Ölçüldü: 73 bölümlük bir dizi 2 kayıt / 83 bölüm görünüyor —
      // profildeki bölüm sayısı, izleme süresi ve izleme puanı birden şişiyor.
      // `id` alanı olmayan kayıt riski yok: dedupe her çıktıya `id` yazıyor.
      const entries = snap.docs.map((d) => [d.id, d.data() || {}]);
      const subShows = dedupeWatchedTvEntries(entries).map((s) => ({ ...s, _src: "sub" }));
      setListItemsTv((prev) => {
        // String()'e normalize ZORUNLU: dedupe artık bare id döndürüyor ve
        // eski format kayıtlarda id sayı olabiliyor. Tip kayması Set eşleşmesini
        // kaçırıp aynı diziyi hem alt koleksiyondan hem kök diziden sayardı.
        const subIds = new Set(subShows.map((s) => String(s.id)));
        const legacy = prev.filter((s) => s._src !== "sub" && !subIds.has(String(s.id)));
        return [...subShows, ...legacy];
      });
      setLoadingTv(false);
    }, snapshotErrorHandler("Stats/watchedTv"));
    return () => unsub();
  }, [uid, startupReady]);

  const movieHistoryItems = useMemo(
    () => flattenMovieWatchEntries(listItems.filter((item) => item.type === "movie")),
    [listItems],
  );

  const tvHistoryStates = useMemo(
    () => (listItemsTv || []).map((show) => ({
      show,
      ...materializeTvWatchState(show),
    })),
    [listItemsTv],
  );

  // ── Film istatistikleri — her izleme occurrence'ını say ─────────────────
  useEffect(() => {
    const totalMin = movieHistoryItems.reduce((acc, movie) => acc + (movie.minutes || 0), 0);
    setWatchedMovieCount(movieHistoryItems.length);
    setTotalMinutesTime(totalMin);
    setTotalWatchedTime(formatTime(totalMin));
  }, [movieHistoryItems]);

  // ── Dizi istatistikleri — tekrarlar bölüm/süreye dahil edilir ───────────
  useEffect(() => {
    const episodeEntries = flattenTvEpisodeWatchEntries(listItemsTv);
    const showCount = tvHistoryStates.reduce((sum, state) => {
      const completeWatches = state.watchEvents.filter((event) => event.scope === "show").length;
      return sum + Math.max(1, completeWatches);
    }, 0);
    const seasonCount = tvHistoryStates.reduce((sum, state) => {
      const base = state.seasons.length;
      const repeatsBySeason = new Map();
      state.watchEvents
        .filter((event) => event.scope === "show" || event.scope === "season")
        .forEach((event) => (event.seasonNumbers || []).forEach((seasonNumber) => {
          repeatsBySeason.set(seasonNumber, (repeatsBySeason.get(seasonNumber) || 0) + 1);
        }));
      const extras = [...repeatsBySeason.values()].reduce(
        (count, watches) => count + Math.max(0, watches - 1),
        0,
      );
      return sum + base + extras;
    }, 0);
    const totalMinTv = episodeEntries.reduce(
      (sum, episode) => sum + (Number(episode.episodeMinutes) || 0),
      0,
    );
    setWatchedTvCount(showCount);
    setTotalSeasonsCount(seasonCount);
    setTotalEpisodesCount(episodeEntries.length);
    setTotalMinutesTimeTv(totalMinTv);
    setTotalWatchedTimeTv(formatTime(totalMinTv));
  }, [listItemsTv, tvHistoryStates]);

  // ── Animation values for movie stats list ────────────────────────────────
  // Only create new Animated.Values for new items — existing ones are preserved
  useEffect(() => {
    if (!movieHistoryItems?.length) return;
    setScaleValues((prev) => {
      let changed = false;
      const next = { ...prev };
      movieHistoryItems.forEach((item) => {
        const key = item.historyId || item.id;
        if (!next[key]) {
          next[key] = new Animated.Value(1);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [movieHistoryItems]);

  const onPressIn = (id) => {
    if (!scaleValues[id]) return;
    Animated.timing(scaleValues[id], { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  };
  const onPressOut = (id) => {
    if (!scaleValues[id]) return;
    Animated.timing(scaleValues[id], { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const handleTimeClick = () =>
    setTimeDisplayMode((p) => p === "minutes" ? "hours" : p === "hours" ? "days" : "minutes");

  const formatTotalDurationTime = (totalMinutes, mode) => {
    const locale = language === "tr" ? "tr-TR" : "en-US";
    const hours = Math.floor(totalMinutes / 60);
    const days  = Math.floor(hours / 24);
    if (mode === "hours") return `${hours.toLocaleString(locale)} ${t.profileScreen.hours}`;
    if (mode === "days")  return `${days.toLocaleString(locale)} ${t.profileScreen.days}`;
    return `${totalMinutes.toLocaleString(locale)} ${t.profileScreen.minutes}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return typeof timestamp === "string" ? timestamp : "Bilinmeyen Tarih";
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const deleteList = async () => {
    if (!selectedList || !uid) return;
    try {
      await updateDoc(doc(db, "Lists", uid), { [selectedList]: deleteField() });
      setModalDeleteVisible(false);
      Toast.show({ type: "success", text1: i18nText("autoI18n.liste_basariyla_silindi", "Liste başarıyla silindi") });
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.silme_hatasi", "Silme hatası: ") + err.message });
    }
  };

  // ── Derived movie stats ──────────────────────────────────────────────────
  const sortedListItems = useMemo(
    () => [...movieHistoryItems].sort((a, b) => parseDate(b.dateAdded) - parseDate(a.dateAdded)),
    [movieHistoryItems],
  );
  const groupedData = useMemo(() => groupByDate(sortedListItems), [sortedListItems]);
  const uniqueDates = useMemo(() => [...new Set(sortedListItems.map((item) => {
    if (typeof item.dateAdded === "string") return item.dateAdded;
    if (item.dateAdded?.seconds) return new Date(item.dateAdded.seconds * 1000).toISOString().slice(0, 10);
    return "";
  }))].filter(Boolean), [sortedListItems]);

  const topMovieGenres = useMemo(() => getTopGenreNames(movieHistoryItems), [movieHistoryItems]);
  const mostWatchedGenre = topMovieGenres[0] || null;
  const secondWatchedGenre = topMovieGenres[1] || "-";
  const threeWatchedGenre = topMovieGenres[2] || "-";

  // ── Derived TV stats ─────────────────────────────────────────────────────
  const flatEpisodesTv = useMemo(
    () => flattenTvEpisodeWatchEntries(listItemsTv),
    [listItemsTv],
  );

  const sortedFlatEpisodesTv = useMemo(() =>
    [...flatEpisodesTv].sort((a, b) => {
      const ts = (t) => t?.seconds ? new Date(t.seconds * 1000) : typeof t === "string" ? new Date(t) : 0;
      return ts(b.episodeWatchTime) - ts(a.episodeWatchTime);
    }),
    [flatEpisodesTv],
  );

  const groupedDataTv = useMemo(() => groupByDateFlatTv(sortedFlatEpisodesTv), [sortedFlatEpisodesTv]);

  const uniqueDatesTv = useMemo(() =>
    [...new Set(sortedFlatEpisodesTv.map((item) => {
      if (item.episodeWatchTime?.seconds) return new Date(item.episodeWatchTime.seconds * 1000).toISOString().slice(0, 10);
      if (typeof item.episodeWatchTime === "string") return item.episodeWatchTime.slice(0, 10);
      return null;
    }).filter(Boolean))].sort((a, b) => new Date(b) - new Date(a)),
    [sortedFlatEpisodesTv],
  );

  const topTvGenres = useMemo(() => getTopGenreNames(flatEpisodesTv), [flatEpisodesTv]);
  const mostWatchedGenreTv = topTvGenres[0] || "-";
  const secondWatchedGenreTv = topTvGenres[1] || "-";
  const thirdWatchedGenreTv = topTvGenres[2] || "-";

  const mostRewatchedMovies = useMemo(
    () => mostRewatched(movieHistoryItems, (item) => item.id),
    [movieHistoryItems],
  );
  const tvFullWatchEntries = useMemo(
    () => tvHistoryStates.flatMap(({ show, watchEvents }) =>
      watchEvents
        .filter((event) => event.scope === "show")
        .map((event) => ({ ...show, watchEvent: event })),
    ),
    [tvHistoryStates],
  );
  const mostRewatchedTv = useMemo(
    () => mostRewatched(tvFullWatchEntries, (item) => item.id),
    [tvFullWatchEntries],
  );

  // ── Rank colors ──────────────────────────────────────────────────────────
  const rankInfo = useMemo(() => ({
    ...getDynamicRankColor(totalMinutesTime, "movie"),
    ...getDynamicRankColor(totalMinutesTimeTv, "tv"),
  }), [totalMinutesTime, totalMinutesTimeTv]);

  // İzlenen diziler artık subcollection'da (Lists/{uid}/watchedTv/{showId}); kök
  // doc'taki watchedTv[] dizisi migration ile boşaltılıyor. Liste ekranlarının (Profile
  // Lists / ListsViewScreen / ListsScreen) gördüğü `lists`'te watchedTv girdisini
  // subcollection show'larıyla (gömülü seasons) override ediyoruz; sıralama için
  // dateAdded ekliyoruz.
  const displayLists = useMemo(() => {
    const tvItems = (listItemsTv || []).map((s) => ({
      ...s,
      dateAdded: s.dateAdded ?? s.addedShowDate ?? null,
    }));
    // Öntanımlı listeler subcollection'dan (combinedLists), watchedTv gömülü
    // seasons'lı listItemsTv'den; özel listeler kök doc entry'lerinden (`lists`).
    const result = [
      ["favorites", combinedLists?.favorites || []],
      ["watchList", combinedLists?.watchList || []],
      ["watchedMovies", combinedLists?.watchedMovies || []],
      ["watchedTv", tvItems],
    ];
    (lists || []).forEach(([k, v]) => {
      if (
        k === "favorites" ||
        k === "watchList" ||
        k === "watchedMovies" ||
        k === "watchedTv" ||
        k === "customLists" ||
        !Array.isArray(v)
      )
        return;
      result.push([k, v]);
    });
    return result;
  }, [lists, listItemsTv, combinedLists]);

  // ── Ana ekran widget'ları ("Listelerim" + "İstatistikler") ────────────────
  // Widget'lar Firestore'a İKİNCİ bir bağlantı açmaz: bu context'in canonical
  // verisinin küçük bir özetini native depoya aktarırız; widget oradan çizilir
  // ve uygulama kapalıyken de son senkronize hali gösterir.
  //
  // Debounce NEDEN VAR: açılışta 3 listener'ın snapshot'ları art arda gelir ve
  // her birinde 12 liste × 36 poster URL'lik payload'u serialize edip köprüden
  // geçirmek boşuna iş. Yazma yalnız veri duraklayınca bir kez yapılır.
  useEffect(() => {
    if (!uid) {
      clearListsWidget();
      return undefined;
    }
    const timer = setTimeout(() => {
      syncListsWidget(displayLists, t?.profileScreen?.ProfileLists, language);
    }, 1200);
    return () => clearTimeout(timer);
  }, [uid, displayLists, t, language]);

  useEffect(() => {
    if (!uid) {
      clearStatsWidget();
      return undefined;
    }
    const timer = setTimeout(() => {
      syncStatsWidget(
        {
          movieCount: watchedMovieCount,
          movieMinutes: totalMinutesTime,
          movieTime: totalWatchedTime,
          movieAccent: rankInfo.borderColorMovie,
          movieRankName: rankInfo.rankNameMovie,
          tvShowCount: watchedTvCount,
          episodeCount: totalEpisodesCount,
          tvMinutes: totalMinutesTimeTv,
          tvTime: totalWatchedTimeTv,
          tvAccent: rankInfo.borderColorTv,
          tvRankName: rankInfo.rankNameTv,
          labels: {
            movies: t?.movies,
            tvShows: t?.tvShows,
            movieWatched: t?.profileScreen?.movieWatched,
            tvShowCount: t?.profileScreen?.tvShowCount,
            tvShowEpisodeCount: t?.profileScreen?.tvShowEpisodetotalCount,
            totalDuration: t?.profileScreen?.totalDuration,
            years: t?.profileScreen?.years,
            months: t?.profileScreen?.months,
            days: t?.profileScreen?.days,
            hours: t?.profileScreen?.hours,
            minutes: t?.profileScreen?.minutes,
          },
        },
        language,
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    uid, language, t, rankInfo,
    watchedMovieCount, totalMinutesTime, totalWatchedTime,
    watchedTvCount, totalEpisodesCount, totalMinutesTimeTv, totalWatchedTimeTv,
  ]);

  const value = useMemo(() => ({
    // Lists / delete
    lists: displayLists, selectedList, setSelectedList, modalDeleteVisible, setModalDeleteVisible, deleteList, isLoading,
    // Movie stats
    watchedMovieCount, totalWatchedTime, totalMinutesTime, listItems, setListItems,
    movieHistoryItems, mostRewatchedMovies,
    isloadingMovieInfo, loadingMovies, groupedData, uniqueDates, selectedDate, setSelectedDate,
    mostWatchedGenre, secondWatchedGenre, threeWatchedGenre, topMovieGenres, scaleValues,
    // TV stats
    watchedTvCount, totalSeasonsCount, totalEpisodesCount, totalWatchedTimeTv, totalMinutesTimeTv,
    listItemsTv, loadingTv, isloadingShowInfo, flatEpisodesTv, groupedDataTv, uniqueDatesTv,
    mostRewatchedTv,
    selectedDateTv, setSelectedDateTv, mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv, topTvGenres,
    // Shared helpers
    timeDisplayMode, handleTimeClick, formatTotalDurationTime, formatDate, onPressIn, onPressOut,
    t,
    // Rank
    ...rankInfo,
  }), [
    displayLists, selectedList, modalDeleteVisible, isLoading,
    watchedMovieCount, totalWatchedTime, totalMinutesTime, listItems,
    movieHistoryItems, mostRewatchedMovies,
    isloadingMovieInfo, loadingMovies, groupedData, uniqueDates, selectedDate,
    mostWatchedGenre, secondWatchedGenre, threeWatchedGenre, topMovieGenres, scaleValues,
    watchedTvCount, totalSeasonsCount, totalEpisodesCount, totalWatchedTimeTv, totalMinutesTimeTv,
    listItemsTv, loadingTv, isloadingShowInfo, flatEpisodesTv, groupedDataTv, uniqueDatesTv,
    mostRewatchedTv,
    selectedDateTv, mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv, topTvGenres,
    timeDisplayMode, rankInfo, t,
  ]);

  return (
    <ProfileStatsContext.Provider value={value}>
      {children}
    </ProfileStatsContext.Provider>
  );
};
