import { Image } from "expo-image";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import PosterImage from "@components/PosterImage";
import { useTheme } from "@context/ThemeContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useListStatusContext } from "@context/ListStatusContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import * as Progress from "react-native-progress";
import Toast from "react-native-toast-message";
import SwipeCard from "@components/SwipeCard";
import { BlurView } from "expo-blur";
import { useImageQualitySettings, useListLayoutSettings } from "@context/AppSettingsContext";
import CaseOpeningModal from "@components/modals/CaseOpeningModal";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "@utils/i18nText";
import { reorderWatchedShows } from "../../services/watchedTvService";
import {
  reorderList,
  PREDEFINED_MOVIE_LISTS,
} from "../../services/listItemsService";

const { width, height } = Dimensions.get("window");
const GRID_SIDE_PADDING = 12;
const GRID_COLUMN_GAP = 8;
const POSTER_ASPECT_RATIO = 1.52;

// Diziyi `size`'lık satırlara böler (elle grid için — Android'de dinamik
// numColumns'lu FlatList "addViewAt: failed to insert view" çökmesine yol açıyor).
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function ListsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { listName } = route.params;
  const [listItems, setListItems] = useState([]);
  const [listModalItems, setListModalItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); // Arama için state
  // ── Sıralama & filtreleme ───────────────────────────────────────────────
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState("default"); // default | dateAdded | name | minutes
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [typeFilter, setTypeFilter] = useState("all"); // all | movie | tv
  const [dateRange, setDateRange] = useState("all"); // all | 7 | 30 | 365
  const [genreFilter, setGenreFilter] = useState([]); // seçili tür isimleri
  const [filtering, setFiltering] = useState(false); // sıralama/filtre yükleniyor
  const filterFirstRef = useRef(true);
  // ── Görünüm ayarları — uygulama açılışında hidrate edilen ortak ayardan gelir
  // (yerel depoya kaydedilir, Ayarlar ekranıyla paylaşılır) ───────────────────
  const {
    listsGridColumns: gridColumns,
    changeListsGridColumns: changeGridColumns,
    listsPosterRadius: posterRadius,
    changeListsPosterRadius: changePosterRadius,
  } = useListLayoutSettings();
  // Sütun sayısına göre afiş boyutu. Genişlik, sabit kolon boşluğu üzerinden
  // hesaplanır; space-between kalan alanı şişirip poster aralarını açmasın.
  const posterW =
    (width - GRID_SIDE_PADDING * 2 - GRID_COLUMN_GAP * (gridColumns - 1)) /
    gridColumns;
  const posterH = posterW * POSTER_ASPECT_RATIO;
  // Görünür vurgu rengi (theme.between bazı temalarda tanımsız/kontrastsız olabilir)
  const accent = theme.between || theme.accent || "#4b69ff";
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const {
    allLists,
    combinedLists,
    watchedTvMap,
    watchedTvLoaded,
    loading: listsLoading,
  } = useListStatusContext();
  const [isLoading, setIsLoading] = useState(listsLoading);
  const [modalVisible, setModalVisible] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [reorderItems, setReorderItems] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const suppressNextPressRef = useRef(false);
  const [randomModalVisible, setRandomModalVisible] = useState(false);
  const [filterType, setFilterType] = useState("mixed");
  // Gesture tracking removed in favor of a cleaner 3-way segmented toggle.
  const [value, setValue] = useState("");
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  const handleChange = (text) => {
    // Sadece rakamları al
    const numericValue = text.replace(/[^0-9]/g, "");
    setValue(numericValue);
  };

  const closeReorderModal = () => {
    if (isReordering) return;
    suppressNextPressRef.current = false;
    setReorderModalVisible(false);
    setValue("");
  };

  const stepTargetPosition = (delta) => {
    const current = Number(value) || index + 1;
    const next = Math.min(Math.max(current + delta, 1), listItems.length);
    setValue(String(next));
    Haptics.selectionAsync().catch(() => {});
  };
  const [tvShowStatus, setTvShowStatus] = useState(null);

  // ── Tab pill boyutları (mesafe hesabı) ─────────────────────────────────────
  const TAB_PADDING = 3;
  const [tabPillWidth, setTabPillWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let toValue = 0;
    if (tvShowStatus === true) toValue = 1;
    if (tvShowStatus === false) toValue = 2;
    slideAnim.setValue(toValue);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTvTabPress = useCallback(
    (status) => {
      setTvShowStatus(status);
      let toValue = 0;
      if (status === true) toValue = 1;
      if (status === false) toValue = 2;
      Animated.spring(slideAnim, {
        toValue,
        useNativeDriver: true,
        speed: 18,
        bounciness: 0,
      }).start();
    },
    [setTvShowStatus, slideAnim],
  );

  const sliderTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabPillWidth / 3, (tabPillWidth / 3) * 2],
  });

  // Animated import'unun eklendiğinden emin olun
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const [scaleValues, setScaleValues] = useState({});
  useEffect(() => {
    if (!listItems?.length) return;
    setScaleValues((prev) => {
      let changed = false;
      const next = { ...prev };
      listItems.forEach((item) => {
        if (!next[item.id]) {
          next[item.id] = new Animated.Value(1);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [listItems]);

  const onPressIn = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const sourceLoading =
      listsLoading || (listName === "watchedTv" && !watchedTvLoaded);
    setIsLoading(sourceLoading);
    if (!sourceLoading) {
      // İzlenen diziler subcollection'da (gömülü seasons); diğer listeler kök doc'ta.
      if (listName === "watchedTv") {
        setListItems(
          Object.entries(watchedTvMap || {})
            .map(([docId, s]) => ({
              ...s,
              id: s.id ?? docId,
              dateAdded: s.dateAdded ?? s.addedShowDate ?? null,
            }))
            .sort((a, b) => {
              const aHasOrder = Number.isFinite(a.listOrder);
              const bHasOrder = Number.isFinite(b.listOrder);
              if (aHasOrder && bHasOrder) {
                const orderDiff = a.listOrder - b.listOrder;
                if (orderDiff !== 0) return orderDiff;
              } else if (aHasOrder !== bHasOrder) {
                return aHasOrder ? -1 : 1;
              }

              const aDate = new Date(a.dateAdded || 0).getTime() || 0;
              const bDate = new Date(b.dateAdded || 0).getTime() || 0;
              return aDate - bDate || String(a.id).localeCompare(String(b.id));
            }),
        );
      } else {
        // Öntanımlı film listeleri subcollection'dan (combinedLists), özel
        // listeler kök-array'den (Part B'ye kadar). listOrder → dateAdded sırala.
        const source = (combinedLists?.[listName] || []).slice();
        const isCustomRootList = !PREDEFINED_MOVIE_LISTS.includes(listName);
        // Özel (kök-array) listelerde Firestore dizisinin DOĞAL sırası esas:
        // öğelerde listOrder yok ve dateAdded gün hassasiyetli olduğundan
        // sort, kullanıcının elle verdiği sırayı (reorder) görünmez kılıyordu.
        const items = isCustomRootList
          ? source
          : source.sort((a, b) => {
              const aHasOrder = Number.isFinite(a.listOrder);
              const bHasOrder = Number.isFinite(b.listOrder);
              if (aHasOrder && bHasOrder) {
                const orderDiff = a.listOrder - b.listOrder;
                if (orderDiff !== 0) return orderDiff;
              } else if (aHasOrder !== bHasOrder) {
                return aHasOrder ? -1 : 1;
              }
              const aDate = new Date(a.dateAdded || 0).getTime() || 0;
              const bDate = new Date(b.dateAdded || 0).getTime() || 0;
              return aDate - bDate || String(a.id).localeCompare(String(b.id));
            });
        setListItems(items);
      }
    }
  }, [
    allLists,
    combinedLists,
    watchedTvMap,
    watchedTvLoaded,
    listName,
    listsLoading,
  ]);

  const reorderWatchedTv = async (fromIndex, toIndex, listName) => {
    const targetIndex = Number(toIndex) - 1;
    const currentItems = [...listItems];

    if (
      fromIndex < 0 ||
      fromIndex >= currentItems.length ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= currentItems.length
    ) {
      Toast.show({
        type: "error",
        text1: i18nText(
          "autoI18n.enter_index_range",
          "Lütfen 1 ile {{count}} arasında indeksler girin.",
          { count: currentItems.length },
        ),
      });
      return;
    }

    const movedItem = currentItems.splice(fromIndex, 1)[0];
    currentItems.splice(targetIndex, 0, movedItem);

    Keyboard.dismiss();
    setIsReordering(true);
    try {
      if (listName === "watchedTv") {
        // Snapshot gelene kadar kartın yeni yerini anında göster.
        setListItems(currentItems);
        await reorderWatchedShows(
          user.uid,
          currentItems,
          fromIndex,
          targetIndex,
        );
      } else if (PREDEFINED_MOVIE_LISTS.includes(listName)) {
        // Yeni model: her öğe ayrı doküman → listOrder batch.
        setListItems(currentItems);
        await reorderList(user.uid, listName, currentItems, fromIndex, targetIndex);
      } else {
        // Özel liste — eski kök-array (Part B'de reorderCustomList).
        const docRef = doc(db, "Lists", user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.warn(
            i18nText("autoI18n.belge_bulunamadi", "Belge bulunamadı."),
          );
          return;
        }

        // currentItems görüntüdeki İSTENEN nihai sıradır. Ham diziye görüntü
        // indeksleriyle splice uygulamak (eski kod) sıralar farklıyken yanlış
        // öğeyi taşıyordu — ham öğeleri id eşleyerek görüntü sırasına diz.
        const data = docSnap.data();
        const rawById = new Map(
          (data[listName] || []).map((it) => [String(it?.id), it]),
        );
        const ordered = [];
        for (const it of currentItems) {
          const raw = rawById.get(String(it?.id));
          if (raw) {
            ordered.push(raw);
            rawById.delete(String(it?.id));
          }
        }
        rawById.forEach((leftover) => ordered.push(leftover));
        setListItems(currentItems);
        await updateDoc(docRef, { [listName]: ordered });
      }

      setIndex(targetIndex);
      suppressNextPressRef.current = false;
      setReorderModalVisible(false);
      setValue("");
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.item_moved_to_position", "{{name}} başarıyla {{position}}. sıraya taşındı.", {
          name: reorderItems.name,
          position: targetIndex + 1,
        }),
      });
    } catch (error) {
      // Optimistik güncellemeyi geri al (watchedTv + öntanımlı film listeleri).
      if (listName === "watchedTv" || PREDEFINED_MOVIE_LISTS.includes(listName))
        setListItems(listItems);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      Toast.show({
        type: "error",
        text1: `${error.message}`,
      });
    } finally {
      setIsReordering(false);
    }
  };
  // Listede mevcut türler (genre) ve tarihli öğe var mı?
  const availableGenres = useMemo(() => {
    const set = new Set();
    listItems.forEach((it) => (it.genres || []).forEach((g) => g && set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, language));
  }, [listItems, language]);
  const hasDates = useMemo(
    () => listItems.some((it) => it.dateAdded),
    [listItems],
  );

  // Aktif filtre/sıralama göstergesi
  const sortActive = sortBy !== "default";
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (genreFilter.length > 0 ? 1 : 0);

  // Bir öğenin toplam süresi (dk): film → runtime, dizi → bölüm sürelerinin toplamı.
  const getItemMinutes = (item) => {
    if (item.type === "movie") return item.minutes || 0;
    if (typeof item.totalMinutes === "number") return item.totalMinutes;
    const seasons = item.seasons;
    if (!seasons) return 0;
    let total = 0;
    for (const sk in seasons) {
      const eps = seasons[sk]?.episodes;
      for (const ek in eps) {
        const m = eps[ek]?.episodeMinutes;
        if (typeof m === "number") total += m;
      }
    }
    return total;
  };

  // Arama + filtre + sıralama — TEK geçiş, yalnız girdiler değişince yeniden
  // hesaplanır (her render'da değil). Eskiden 5 ayrı .filter() + sort kopyası
  // her render'da çalışıyordu; ana yavaşlık buydu.
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const watchedCountOf = (item) =>
      Array.isArray(item.seasons)
        ? item.seasons.reduce(
            (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
            0,
          )
        : 0;

    const now = Date.now();
    const rangeMs = dateRange === "all" ? 0 : Number(dateRange) * 86400000;

    const out = listItems.filter((item) => {
      if (q && !(item.name || "").toLowerCase().includes(q)) return false;
      if (
        tvShowStatus !== null &&
        (watchedCountOf(item) === item.showEpisodeCount) !== tvShowStatus
      )
        return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (dateRange !== "all") {
        if (!item.dateAdded) return false;
        const ts = new Date(item.dateAdded).getTime();
        if (isNaN(ts) || ts < now - rangeMs) return false;
      }
      if (
        genreFilter.length > 0 &&
        !(item.genres || []).some((g) => genreFilter.includes(g))
      )
        return false;
      return true;
    });

    if (sortBy === "default") return out;

    return out.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = (a.name || "").localeCompare(b.name || "", language);
      } else if (sortBy === "minutes") {
        cmp = getItemMinutes(a) - getItemMinutes(b);
      } else {
        const ta = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const tb = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        cmp = (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listItems,
    searchQuery,
    tvShowStatus,
    typeFilter,
    dateRange,
    genreFilter,
    sortBy,
    sortDir,
    language,
  ]);

  // Filtrelenmiş öğeleri sütun sayısına göre satırlara böl (elle grid).
  const gridRows = useMemo(
    () => chunk(filteredItems, gridColumns),
    [filteredItems, gridColumns],
  );

  const resetFilters = () => {
    setSortBy("default");
    setSortDir("desc");
    setTypeFilter("all");
    setDateRange("all");
    setGenreFilter([]);
  };

  const toggleGenre = (g) =>
    setGenreFilter((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  // Sıralama/filtre değişince kısa bir "yükleniyor" göster — donma hissi olmasın.
  // (Arama hariç; o anlık ve her tuşta spinner istemiyoruz.)
  useEffect(() => {
    if (filterFirstRef.current) {
      filterFirstRef.current = false;
      return;
    }
    setFiltering(true);
    const id = setTimeout(() => setFiltering(false), 280);
    return () => clearTimeout(id);
  }, [tvShowStatus, typeFilter, dateRange, genreFilter, sortBy, sortDir]);

  const renderSkeleton = () => (
    <SkeletonPlaceholder>
      <View style={{ flexDirection: "row", marginBottom: 10 }}>
        {[...Array(3)].map((_, index) => (
          <View key={index} style={{ marginRight: 10 }}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonText} />
            <View style={styles.skeletonTextSmall} />
          </View>
        ))}
      </View>
    </SkeletonPlaceholder>
  );
  function calculateTotalDuration(item) {
    let totalMinutes = 0;

    const seasons = item.seasons;

    for (const seasonKey in seasons) {
      const season = seasons[seasonKey];
      const episodes = season.episodes;

      for (const episodeKey in episodes) {
        const episode = episodes[episodeKey];
        if (episode && typeof episode.episodeMinutes === "number") {
          totalMinutes += episode.episodeMinutes;
        }
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours} saat ${minutes} dakika`;
  }
  const chooseRandomly = (selectedType) => {
    const pool =
      selectedType === "mixed"
        ? filteredItems
        : filteredItems.filter((item) => item.type === selectedType);
    if (pool.length === 0) {
      Toast.show({
        type: "warning",
        text1:
          selectedType === "movie"
            ? i18nText("autoI18n.listede_hic_film_yok", "Listede hiç film yok!")
            : selectedType === "tv"
              ? i18nText("autoI18n.listede_hic_dizi_yok", "Listede hiç dizi yok!")
              : i18nText("autoI18n.liste_bos_lutfen_icerik_ekleyiniz", "Liste boş, lütfen içerik ekleyiniz"),
      });
      return;
    }
    setFilterType(selectedType);
    setRandomModalVisible(true);
  };

  // List counts
  const movieCount = useMemo(
    () => filteredItems.filter((i) => i.type === "movie").length,
    [filteredItems],
  );
  const tvCount = useMemo(
    () => filteredItems.filter((i) => i.type === "tv").length,
    [filteredItems],
  );

  // İzlenen bölüm sayısı ve toplam süre: renderItem içinde her çizimde
  // reduce/loop çalıştırmak yerine öğe başına bir kez hesaplanır.
  const { watchedCountById, durationTextById } = useMemo(() => {
    const counts = {};
    const durations = {};
    listItems.forEach((item) => {
      counts[item.id] = Array.isArray(item.seasons)
        ? item.seasons.reduce(
            (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
            0,
          )
        : 0;
      durations[item.id] = calculateTotalDuration(item);
    });
    return { watchedCountById: counts, durationTextById: durations };
  }, [listItems]);
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.header, { color: theme.text.primary }]}
      >
        {listName == "watchedMovies"
          ? i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler")
          : listName == "watchedTv"
            ? i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler")
            : listName == "favorites"
              ? "Favoriler"
              : listName == "watchList"
                ? i18nText("autoI18n.izlenecekler", "İzlenecekler")
                : listName}
      </Text>

      {/* 15'ten fazla öğe varsa arama çubuğunu göster */}

      {isLoading ? (
        renderSkeleton()
      ) : listItems.length === 0 ? (
        <Text
          allowFontScaling={false}
          style={[styles.emptyText, { color: theme.text.muted }]}
        >{i18nText("autoI18n.bu_liste_bos", "Bu liste boş.")}</Text>
      ) : (
        <>
          {listItems.length > 12 && (
            <View style={styles.searchRow}>
              <TextInput
                style={[
                  styles.searchInput,
                  styles.searchInputFlex,
                  { backgroundColor: theme.secondary, color: theme.text.primary },
                ]}
                placeholder={i18nText("autoI18n.ara", "Ara...")}
                placeholderTextColor={theme.text.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                maxLength={80}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterModalVisible(true)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: theme.secondary,
                    borderColor:
                      sortActive || activeFilterCount > 0 ? accent : theme.border,
                  },
                ]}
              >
                {filtering ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Feather name="sliders" size={18} color={theme.text.primary} />
                )}
                {!filtering && (sortActive || activeFilterCount > 0) ? (
                  <View style={[styles.filterDot, { backgroundColor: accent }]}>
                    <Text style={styles.filterDotText}>
                      {activeFilterCount + (sortActive ? 1 : 0)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          )}
          {listName == "watchList" && (
            <View style={{ marginBottom: 95, marginHorizontal: 15 }}>
              {/* Interactive 3-Way Random Selector & Stats */}
              <SwipeCard
                leftButton={{
                  label: i18nText("autoI18n.sadece_dizi", "📺 Sadece\nDizi"),
                  color: "#8847ff",
                  onPress: () => chooseRandomly("tv"),
                }}
                rightButton={{
                  label: i18nText("autoI18n.sadece_film", "🎬 Sadece\nFilm"),
                  color: "#4b69ff",
                  onPress: () => chooseRandomly("movie"),
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => chooseRandomly("mixed")}
                  style={{
                    width: "100%",
                    height: 90,
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    borderWidth: 1,
                    borderRadius: 24,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={["#396fe415", "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Main Call to Action */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 22,
                        backgroundColor: "#3961e433",
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "#3961e466",
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>🎲</Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          color: "#3983e4ff",
                          fontSize: 14,
                          fontWeight: "bold",
                          letterSpacing: 0.5,
                        }}
                      >{i18nText("autoI18n.rastgele_ne_izlesem", "Rastgele Ne İzlesem?")}</Text>
                      <Text
                        style={{
                          color: "#3983e4aa",
                          fontSize: 10,
                          marginTop: 2,
                          fontWeight: "500",
                        }}
                      >{i18nText("autoI18n.karisik_icin_bas_dizi_film_icin_kaydir", "Karışık için bas, Dizi/Film için kaydır")}</Text>
                    </View>
                  </View>

                  {/* Context Stats (Count chips) wrapped inside */}
                  <View
                    style={{
                      flexDirection: "row",
                      width: "100%",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <View
                      style={[
                        styles.countChip,
                        {
                          flex: 1,
                          paddingVertical: 3,
                          borderColor: "#4b69ff44",
                          backgroundColor: "#4b69ff15",
                        },
                      ]}
                    >
                      <Feather name="chevron-left" size={14} color="#4b69ff" />
                      <Text
                        style={[styles.countChipTextBlue, { fontSize: 14 }]}
                      >
                        {movieCount}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#4b69ff88",
                          fontWeight: "600",
                          marginTop: 2,
                        }}
                      >{i18nText("autoI18n.film_2", "FİLM")}</Text>
                    </View>

                    <View
                      style={[
                        styles.countChip,
                        {
                          flex: 1,
                          paddingVertical: 3,
                          borderColor: "#e4ae3944",
                          backgroundColor: "#e4ae3915",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.countChipTextGold, { fontSize: 14 }]}
                      >
                        ∑ {filteredItems.length}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#e4ae3988",
                          fontWeight: "600",
                          marginTop: 2,
                        }}
                      >
                        {i18nText("autoI18n.toplam_upper", "TOPLAM")}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.countChip,
                        {
                          flex: 1,
                          paddingVertical: 3,
                          borderColor: "#8847ff44",
                          backgroundColor: "#8847ff15",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.countChipTextPurple, { fontSize: 14 }]}
                      >
                        📺 {tvCount}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#8847ff88",
                          fontWeight: "600",
                          marginTop: 2,
                        }}
                      >{i18nText("autoI18n.dizi_2", "DİZİ")}</Text>
                      <Feather name="chevron-right" size={14} color="#8847ff" />
                    </View>
                  </View>
                </TouchableOpacity>
              </SwipeCard>
            </View>
          )}
          {listName == "watchedTv" && (
            <View
              style={{
                flexDirection: "row",
                marginHorizontal: 15,
                marginBottom: 12,
                borderRadius: 14,
                borderWidth: 1,
                overflow: "hidden",
                position: "relative",
                padding: TAB_PADDING,
                height: 40,
                backgroundColor: theme.secondary,
                borderColor: theme.border,
              }}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width - TAB_PADDING * 2;
                if (tabPillWidth !== w) setTabPillWidth(w);
              }}
            >
              {/* Sliding indicator – translateX ile kasma yok */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: TAB_PADDING,
                  bottom: TAB_PADDING,
                  left: TAB_PADDING,
                  width: "33.33%",
                  borderRadius: 11,
                  zIndex: 0,
                  backgroundColor: theme.accent,
                  transform: [{ translateX: sliderTranslateX }],
                }}
              />

              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  zIndex: 1,
                  borderRadius: 11,
                }}
                onPress={() => handleTvTabPress(null)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: tvShowStatus === null ? "#fff" : theme.text.muted,
                  }}
                >{i18nText("autoI18n.tumu", "Tümü")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  zIndex: 1,
                  borderRadius: 11,
                }}
                onPress={() => handleTvTabPress(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: tvShowStatus === true ? "#fff" : theme.text.muted,
                  }}
                >
                  {i18nText("autoI18n.bitirilen", "Bitirilen")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  zIndex: 1,
                  borderRadius: 11,
                }}
                onPress={() => handleTvTabPress(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: tvShowStatus === false ? "#fff" : theme.text.muted,
                  }}
                >
                  {i18nText("autoI18n.devam_eden", "Devam Eden")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={gridRows}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            // Android'de dinamik numColumns'lu FlatList "addViewAt: failed to insert
            // view" çökmesine yol açtığından, çok sütunlu görünüm numColumns yerine
            // elle satırlara bölünüp tek sütunlu listede render edilir.
            removeClippedSubviews={false}
            keyExtractor={(row, i) => `${row[0] ? row[0].id : "r"}-${i}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: GRID_SIDE_PADDING,
              paddingBottom: 40,
            }}
            renderItem={({ item: row }) => (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-start",
                  gap: GRID_COLUMN_GAP,
                  width: "100%",
                  marginBottom: 12,
                }}
              >
                {row.map((item) => (
                  <TouchableOpacity
                    key={String(item.id)}
                activeOpacity={0.8}
                onPressIn={() => onPressIn(item.id)}
                onPressOut={() => {
                  onPressOut(item.id);
                }}
                onLongPress={() => {
                  suppressNextPressRef.current = true;
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Medium,
                  ).catch(() => {});
                  setReorderModalVisible(true);
                  const originalIndex = listItems.findIndex(
                    (i) => String(i.id) === String(item.id),
                  );
                  setIndex(originalIndex);
                  setReorderItems(item);
                  setValue(String(originalIndex + 1));
                }}
                onPress={() => {
                  if (suppressNextPressRef.current) {
                    suppressNextPressRef.current = false;
                    return;
                  }
                  listName !== "watchedTv"
                    ? navigation.navigate(
                        item.type === "movie"
                          ? "MovieDetails"
                          : "TvShowsDetails",
                        { id: item.id },
                      )
                    : setModalVisible(true);
                  setListModalItems([item]); // Tek bir öğeyi modalda göstermek için diziye sarın
                }}
                style={[styles.item, { width: posterW }]}
              >
                <SwipeCard>
                  <Animated.View
                    style={{
                      // Alta yapışık ilerleme çubuğu poster köşesinden taşmasın
                      // diye köşe yarıçapıyla kırpılır.
                      overflow: "hidden",
                      borderRadius: posterRadius,
                      transform: [{ scale: scaleValues[item.id] || 1 }],
                    }}
                  >
                    <PosterImage
                      path={item.imagePath}
                      type={item.type}
                      size={200}
                      style={[
                        styles.image,
                        { width: posterW, height: posterH, borderRadius: posterRadius },
                      ]}
                    />
                    {/* İzlenme ilerlemesi — poster altına yapışık tam genişlik
                        bar (yeşil=bitti, turuncu=devam ediyor) */}
                    {listName === "watchedTv" && item.showEpisodeCount ? (
                      <>
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.80)"]}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: posterH * 0.4,
                            borderBottomLeftRadius: posterRadius,
                            borderBottomRightRadius: posterRadius,
                          }}
                        />
                        <View style={styles.posterProgress}>
                          <Progress.Bar
                            progress={Math.min(
                              (watchedCountById[item.id] || 0) /
                                item.showEpisodeCount,
                              1,
                            )}
                            width={posterW}
                            height={3}
                            borderWidth={0}
                            borderRadius={2}
                            color={
                              item.showEpisodeCount ===
                              (watchedCountById[item.id] || 0)
                                ? theme.colors.green
                                : theme.colors.orange
                            }
                            unfilledColor="rgba(255,255,255,0.2)"
                          />
                        </View>
                      </>
                    ) : null}
                    {listName !== "watchedTv" &&
                    listName !== "watchedMovies" ? (
                      <Text
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor:
                              item.type == "movie"
                                ? theme.notesColor.blueBackground
                                : theme.notesColor.greenBackground,
                          },
                        ]}
                      >
                        {item.type == "movie" ? t.typeMovies : t.typeTvSeries}
                      </Text>
                    ) : null}
                    {listName !== "watchedTv" ? (
                      item.minutes ? (
                        <Text
                          style={[
                            styles.minutesBadge,
                            {
                              backgroundColor: theme.secondaryt,
                              color: theme.text.primary,
                            },
                          ]}
                        >
                          {item.minutes + " " + t.minutes}
                        </Text>
                      ) : null
                    ) : (
                      <Text
                        style={[
                          styles.nameBadge,
                          { backgroundColor: theme.secondaryt },
                        ]}
                      >
                        {durationTextById[item.id]}
                      </Text>
                    )}
                  </Animated.View>
                </SwipeCard>
                  </TouchableOpacity>
                ))}
                {row.length < gridColumns
                  ? Array.from({ length: gridColumns - row.length }).map((_, i) => (
                      <View key={`sp-${i}`} style={{ width: posterW }} />
                    ))
                  : null}
              </View>
            )}
          />
        </>
      )}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <BlurView
            tint="dark"
            intensity={50}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          {isLoading
            ? renderSkeleton()
            : listModalItems.length > 0 &&
              (() => {
                const item = listModalItems[0];
                const watchedEps = (item.seasons || []).reduce(
                  (acc, s) => acc + (s.episodes?.length || 0),
                  0,
                );
                const totalEps = item.showEpisodeCount || 0;
                const pct =
                  totalEps > 0 ? Math.min(watchedEps / totalEps, 1) : 0;
                const completed = totalEps > 0 && watchedEps >= totalEps;
                const accent = completed
                  ? theme.colors.green
                  : theme.colors.orange;
                const sortedSeasons = [...(item.seasons || [])].sort(
                  (a, b) => a.seasonNumber - b.seasonNumber,
                );
                const posterSource = item.imagePath
                  ? {
                      uri: getTmdbUrl(item.imagePath, "poster", 200),
                      cache: "force-cache",
                    }
                  : null;

                return (
                  <View
                    style={[styles.sheet, { backgroundColor: theme.secondary }]}
                  >
                    {/* ── Hero: bulanık poster zemin üstünde dizi bilgisi ── */}
                    <View style={styles.sheetHero}>
                      {posterSource && (
                        <Image
                          source={posterSource}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          blurRadius={30}
                        />
                      )}
                      <LinearGradient
                        colors={["rgba(0,0,0,0.30)", theme.secondary]}
                        style={StyleSheet.absoluteFill}
                      />

                      <View style={styles.sheetHandle} />
                      <TouchableOpacity
                        style={styles.sheetClose}
                        onPress={() => setModalVisible(false)}
                        hitSlop={10}
                      >
                        <Feather name="x" size={16} color="#fff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.heroRow}
                        activeOpacity={0.8}
                        onPress={() => {
                          setModalVisible(false);
                          navigation.navigate("TvShowsDetails", {
                            id: item.id,
                          });
                        }}
                      >
                        <PosterImage
                          path={item.imagePath}
                          type="tv"
                          size={200}
                          style={styles.heroPoster}
                        />
                        <View style={styles.heroInfo}>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.heroTitle,
                              { color: theme.text.primary },
                            ]}
                          >
                            {item.name}
                          </Text>

                          <View style={styles.heroChips}>
                            <View style={styles.heroChip}>
                              <Feather
                                name="layers"
                                size={10}
                                color="rgba(255,255,255,0.85)"
                              />
                              <Text style={styles.heroChipText}>
                                {item.showSeasonCount}{" "}
                                {i18nText("autoI18n.sezon", "sezon")}
                              </Text>
                            </View>
                            <View style={styles.heroChip}>
                              <Feather
                                name="tv"
                                size={10}
                                color="rgba(255,255,255,0.85)"
                              />
                              <Text style={styles.heroChipText}>
                                {item.showEpisodeCount}{" "}
                                {i18nText("autoI18n.bolum_4", "bölüm")}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.heroChip,
                                {
                                  backgroundColor: accent + "33",
                                  borderColor: accent + "77",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.heroStatusDot,
                                  { backgroundColor: accent },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.heroChipText,
                                  { color: accent },
                                ]}
                              >
                                {completed
                                  ? i18nText(
                                      "autoI18n.tamamlandi",
                                      "Tamamlandı",
                                    )
                                  : i18nText(
                                      "autoI18n.devam_ediyor",
                                      "Devam ediyor",
                                    )}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.heroProgressRow}>
                            <View style={styles.heroProgressTrack}>
                              <View
                                style={{
                                  width: `${pct * 100}%`,
                                  height: "100%",
                                  borderRadius: 3,
                                  backgroundColor: accent,
                                }}
                              />
                            </View>
                            <Text
                              style={[
                                styles.heroProgressPct,
                                { color: accent },
                              ]}
                            >
                              %{Math.round(pct * 100)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.heroProgressDetail,
                              { color: theme.text.muted },
                            ]}
                          >
                            {watchedEps}/{totalEps}{" "}
                            {i18nText(
                              "autoI18n.bolum_izlendi",
                              "bölüm izlendi",
                            )}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* ── Gövde: CTA + sezonlar ── */}
                    <View style={styles.sheetBody}>
                      <View style={[styles.sectionRow, { marginTop: 0 }]}>
                        <Text
                          style={[
                            styles.sectionLabel,
                            { color: theme.text.muted },
                          ]}
                        >
                          {i18nText("autoI18n.sezonlar_upper", "SEZONLAR")}
                        </Text>
                        <View
                          style={[
                            styles.sectionCount,
                            { backgroundColor: theme.primary },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sectionCountText,
                              { color: theme.text.secondary },
                            ]}
                          >
                            {sortedSeasons.length}
                          </Text>
                        </View>
                      </View>

                      <ScrollView
                        style={{ maxHeight: height * 0.36 }}
                        contentContainerStyle={styles.seasonGrid}
                        showsVerticalScrollIndicator={false}
                      >
                        {sortedSeasons.length > 0 ? (
                          sortedSeasons.map((season) => {
                            const sw = season.episodes?.length || 0;
                            const st = season.seasonEpisodes || 0;
                            const sPct = st > 0 ? Math.min(sw / st, 1) : 0;
                            const sComplete = st > 0 && sw >= st;
                            const sColor = sComplete
                              ? theme.colors.green
                              : theme.colors.orange;
                            return (
                              <TouchableOpacity
                                key={season.seasonNumber}
                                activeOpacity={0.85}
                                onPress={() => {
                                  setModalVisible(false);
                                  navigation.navigate("SeasonDetails", {
                                    showId: item.id,
                                    seasonNumber: season.seasonNumber,
                                  });
                                }}
                                style={[
                                  styles.seasonCard,
                                  {
                                    backgroundColor: theme.primary,
                                    borderColor: theme.border,
                                  },
                                ]}
                              >
                                <View style={styles.seasonPosterWrap}>
                                  <PosterImage
                                    path={season.seasonPosterPath}
                                    type="tv"
                                    size={200}
                                    style={styles.seasonPoster}
                                    cachePolicy="memory-disk"
                                  />
                                  <LinearGradient
                                    colors={[
                                      "transparent",
                                      "rgba(0,0,0,0.75)",
                                    ]}
                                    style={styles.seasonPosterShade}
                                  />
                                  <View style={styles.seasonNoBadge}>
                                    <Text style={styles.seasonNoText}>
                                      S{season.seasonNumber}
                                    </Text>
                                  </View>
                                  {sComplete && (
                                    <View
                                      style={[
                                        styles.seasonCheck,
                                        {
                                          backgroundColor: theme.colors.green,
                                        },
                                      ]}
                                    >
                                      <Feather
                                        name="check"
                                        size={10}
                                        color="#fff"
                                      />
                                    </View>
                                  )}
                                  <View style={styles.seasonMiniTrack}>
                                    <View
                                      style={{
                                        width: `${sPct * 100}%`,
                                        height: "100%",
                                        backgroundColor: sColor,
                                      }}
                                    />
                                  </View>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.seasonName,
                                    { color: theme.text.primary },
                                  ]}
                                >
                                  {i18nText("autoI18n.n_sezon", "{{n}}. Sezon", { n: season.seasonNumber })}
                                </Text>
                                <Text
                                  style={[
                                    styles.seasonEpText,
                                    { color: sColor },
                                  ]}
                                >
                                  {sw}/{st}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <Text
                            style={{
                              color: theme.text.muted,
                              textAlign: "center",
                              paddingVertical: 24,
                              width: "100%",
                            }}
                          >
                            {i18nText("autoI18n.bu_dizi_bos", "Bu dizi boş.")}
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  </View>
                );
              })()}
        </View>
      </Modal>
      <CaseOpeningModal
        visible={randomModalVisible}
        onClose={() => setRandomModalVisible(false)}
        items={filteredItems}
        filterType={filterType}
        onNavigate={(item) => {
          navigation.navigate(
            item.type === "movie" ? "MovieDetails" : "TvShowsDetails",
            { id: item.id },
          );
        }}
      />
      <Modal
        animationType="fade"
        transparent={true}
        visible={reorderModalVisible}
        statusBarTranslucent
        onRequestClose={closeReorderModal}
      >
        <BlurView
          tint="dark"
          intensity={65}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          disabled={isReordering}
          onPress={closeReorderModal}
        />

        <View style={styles.reorderOverlay} pointerEvents="box-none">
          <View
            style={[
              styles.reorderCard,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[styles.reorderHandle, { backgroundColor: theme.border }]}
            />

            <View style={styles.reorderHeader}>
              <View
                style={[
                  styles.reorderIcon,
                  { backgroundColor: `${accent}20` },
                ]}
              >
                <Feather name="move" size={18} color={accent} />
              </View>
              <View style={styles.reorderHeaderText}>
                <Text
                  style={[styles.reorderTitle, { color: theme.text.primary }]}
                >
                  {i18nText("autoI18n.sirayi_degistir", "Sırayı değiştir")}
                </Text>
                <Text
                  style={[styles.reorderSubtitle, { color: theme.text.muted }]}
                >
                  {i18nText(
                    "autoI18n.yeni_konumu_sec",
                    "Dizinin listedeki yeni konumunu seçin",
                  )}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeReorderModal}
                disabled={isReordering}
                style={[
                  styles.reorderClose,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Feather name="x" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.reorderPreview,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              <PosterImage
                path={reorderItems?.imagePath}
                type={reorderItems?.type}
                size={200}
                style={styles.imageReorder}
                contentFit="cover"
              />
              <View style={styles.reorderPreviewInfo}>
                <Text
                  numberOfLines={2}
                  style={[styles.reorderName, { color: theme.text.primary }]}
                >
                  {reorderItems?.name}
                </Text>
                <View
                  style={[
                    styles.currentPositionChip,
                    { backgroundColor: `${accent}18` },
                  ]}
                >
                  <Feather name="list" size={12} color={accent} />
                  <Text
                    style={[styles.currentPositionText, { color: accent }]}
                  >
                    {i18nText("autoI18n.mevcut_sira", "Mevcut sıra")}: {index + 1}
                    /{listItems.length}
                  </Text>
                </View>
              </View>
            </View>

            <Text
              style={[styles.targetLabel, { color: theme.text.secondary }]}
            >
              {i18nText("autoI18n.hedef_sira", "Hedef sıra")}
            </Text>

            <View style={styles.positionRow}>
              <TouchableOpacity
                onPress={() => stepTargetPosition(-1)}
                disabled={isReordering || Number(value) <= 1}
                style={[
                  styles.positionStep,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.border,
                    opacity: Number(value) <= 1 ? 0.45 : 1,
                  },
                ]}
              >
                <Feather name="minus" size={20} color={theme.text.primary} />
              </TouchableOpacity>

              <View
                style={[
                  styles.positionInputWrap,
                  { backgroundColor: theme.primary, borderColor: accent },
                ]}
              >
                <TextInput
                  value={value}
                  onChangeText={handleChange}
                  editable={!isReordering}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={String(listItems.length).length}
                  style={[styles.positionInput, { color: theme.text.primary }]}
                />
                <Text
                  style={[styles.positionTotal, { color: theme.text.muted }]}
                >
                  / {listItems.length}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => stepTargetPosition(1)}
                disabled={
                  isReordering || Number(value) >= listItems.length
                }
                style={[
                  styles.positionStep,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.border,
                    opacity: Number(value) >= listItems.length ? 0.45 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={20} color={theme.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.quickPositionRow}>
              <TouchableOpacity
                onPress={() => {
                  setValue("1");
                  Haptics.selectionAsync().catch(() => {});
                }}
                disabled={isReordering}
                style={[
                  styles.quickPositionButton,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <Feather name="chevrons-up" size={14} color={theme.text.muted} />
                <Text
                  style={[styles.quickPositionText, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.ilk_sira", "İlk sıra")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setValue(String(listItems.length));
                  Haptics.selectionAsync().catch(() => {});
                }}
                disabled={isReordering}
                style={[
                  styles.quickPositionButton,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <Feather
                  name="chevrons-down"
                  size={14}
                  color={theme.text.muted}
                />
                <Text
                  style={[styles.quickPositionText, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.son_sira", "Son sıra")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.reorderActions}>
              <TouchableOpacity
                onPress={closeReorderModal}
                disabled={isReordering}
                style={[
                  styles.reorderCancel,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <Text
                  style={[styles.reorderCancelText, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.iptal", "İptal")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => reorderWatchedTv(index, value, listName)}
                disabled={
                  isReordering ||
                  !Number.isInteger(Number(value)) ||
                  Number(value) < 1 ||
                  Number(value) > listItems.length ||
                  Number(value) === index + 1
                }
                style={[
                  styles.reorderSubmit,
                  {
                    backgroundColor: accent,
                    opacity:
                      isReordering ||
                      !Number.isInteger(Number(value)) ||
                      Number(value) < 1 ||
                      Number(value) > listItems.length ||
                      Number(value) === index + 1
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {isReordering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="move" size={16} color="#fff" />
                )}
              <Text
                  style={styles.reorderSubmitText}
                >
                  {isReordering
                    ? i18nText("autoI18n.tasiniyor", "Taşınıyor...")
                    : i18nText("autoI18n.tasi", "Taşı")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sıralama & Filtreleme modalı ── */}
      <Modal
        animationType="slide"
        transparent
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View
            style={[
              fStyles.sheet,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            <View style={[fStyles.handle, { backgroundColor: theme.border }]} />

            <View style={fStyles.headerRow}>
              <Text style={[fStyles.title, { color: theme.text.primary }]}>{i18nText("autoI18n.sirala_filtrele", "Sırala & Filtrele")}</Text>
              <TouchableOpacity onPress={resetFilters} hitSlop={8}>
                <Text style={[fStyles.reset, { color: theme.between }]}>{i18nText("autoI18n.sifirla", "Sıfırla")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {/* Sıralama */}
              <Text style={[fStyles.section, { color: theme.text.muted }]}>
                {i18nText("autoI18n.siralama_upper", "SIRALAMA")}
              </Text>
              {[
                { key: "default", label: i18nText("autoI18n.varsayilan_liste_sirasi", "Varsayılan (liste sırası)"), icon: "list" },
                { key: "dateAdded", label: "Eklenme tarihi", icon: "calendar" },
                { key: "name", label: i18nText("autoI18n.isim", "İsim"), icon: "type" },
                { key: "minutes", label: i18nText("autoI18n.sure", "Süre"), icon: "clock" },
              ].map((opt) => {
                const selected = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (opt.key === "default") setSortBy("default");
                      else if (selected)
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else setSortBy(opt.key);
                    }}
                    style={[
                      fStyles.sortRow,
                      {
                        backgroundColor: selected
                          ? theme.between + "18"
                          : theme.secondary,
                        borderColor: selected ? theme.between : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={16}
                      color={selected ? theme.between : theme.text.secondary}
                    />
                    <Text
                      style={[
                        fStyles.sortLabel,
                        { color: selected ? theme.text.primary : theme.text.secondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {selected && opt.key !== "default" ? (
                      <View style={fStyles.dirWrap}>
                        <Feather
                          name={sortDir === "asc" ? "arrow-up" : "arrow-down"}
                          size={15}
                          color={theme.between}
                        />
                        <Text style={[fStyles.dirText, { color: theme.between }]}>
                          {sortDir === "asc" ? "Artan" : "Azalan"}
                        </Text>
                      </View>
                    ) : selected ? (
                      <Feather name="check" size={16} color={theme.between} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {/* Görünüm — sütun sayısı & köşe yuvarlaklığı */}
              <Text style={[fStyles.section, { color: theme.text.muted }]}>
                {i18nText("autoI18n.gorunum", "GÖRÜNÜM")}
              </Text>
              <View style={fStyles.segRow}>
                {[
                  { key: 3, label: i18nText("autoI18n.uclu_dizilim", "3'lü") },
                  { key: 4, label: i18nText("autoI18n.dortlu_dizilim", "4'lü") },
                ].map((opt) => {
                  const sel = gridColumns === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      activeOpacity={0.8}
                      onPress={() => changeGridColumns(opt.key)}
                      style={[
                        fStyles.segBtn,
                        {
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 7,
                          backgroundColor: sel ? theme.between : theme.secondary,
                          borderColor: sel ? theme.between : theme.border,
                        },
                      ]}
                    >
                      <Feather
                        name="grid"
                        size={15}
                        color={sel ? "#fff" : theme.text.secondary}
                      />
                      <Text
                        style={[
                          fStyles.segText,
                          { color: sel ? "#fff" : theme.text.secondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[fStyles.segRow, { marginTop: 8 }]}>
                {[
                  { key: 2, label: i18nText("autoI18n.kose_koseli", "Köşeli"), r: 3 },
                  { key: 10, label: i18nText("autoI18n.kose_normal", "Normal"), r: 8 },
                  { key: 20, label: i18nText("autoI18n.kose_yuvarlak", "Yuvarlak"), r: 14 },
                ].map((opt) => {
                  const sel = posterRadius === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      activeOpacity={0.8}
                      onPress={() => changePosterRadius(opt.key)}
                      style={[
                        fStyles.segBtn,
                        {
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 7,
                          backgroundColor: sel ? theme.between : theme.secondary,
                          borderColor: sel ? theme.between : theme.border,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 15,
                          height: 19,
                          borderRadius: opt.r,
                          borderWidth: 1.6,
                          borderColor: sel ? "#fff" : theme.text.secondary,
                        }}
                      />
                      <Text
                        style={[
                          fStyles.segText,
                          { color: sel ? "#fff" : theme.text.secondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tür (yalnız karışık listelerde) */}
              {listName !== "watchedMovies" && listName !== "watchedTv" ? (
                <>
                  <Text style={[fStyles.section, { color: theme.text.muted }]}>{i18nText("autoI18n.tur", "TÜR")}</Text>
                  <View style={fStyles.segRow}>
                    {[
                      { key: "all", label: "Hepsi" },
                      { key: "movie", label: t.typeMovies || i18nText("autoI18n.film", "Film") },
                      { key: "tv", label: t.typeTvSeries || i18nText("autoI18n.dizi", "Dizi") },
                    ].map((opt) => {
                      const sel = typeFilter === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          activeOpacity={0.8}
                          onPress={() => setTypeFilter(opt.key)}
                          style={[
                            fStyles.segBtn,
                            {
                              backgroundColor: sel ? theme.between : theme.secondary,
                              borderColor: sel ? theme.between : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fStyles.segText,
                              { color: sel ? "#fff" : theme.text.secondary },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Eklenme tarihi aralığı */}
              {hasDates ? (
                <>
                  <Text style={[fStyles.section, { color: theme.text.muted }]}>{i18nText("autoI18n.eklenme_tarihi", "EKLENME TARİHİ")}</Text>
                  <View style={fStyles.chipsWrap}>
                    {[
                      { key: "all", label: i18nText("autoI18n.tumu", "Tümü") },
                      { key: "7", label: i18nText("autoI18n.son_7_gun", "Son 7 gün") },
                      { key: "30", label: i18nText("autoI18n.son_30_gun", "Son 30 gün") },
                      { key: "365", label: i18nText("autoI18n.son_1_yil", "Son 1 yıl") },
                    ].map((opt) => {
                      const sel = dateRange === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          activeOpacity={0.8}
                          onPress={() => setDateRange(opt.key)}
                          style={[
                            fStyles.chip,
                            {
                              backgroundColor: sel
                                ? theme.between + "22"
                                : theme.secondary,
                              borderColor: sel ? theme.between : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fStyles.chipText,
                              { color: sel ? theme.between : theme.text.secondary },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Türler (genre) */}
              {availableGenres.length > 0 ? (
                <>
                  <Text style={[fStyles.section, { color: theme.text.muted }]}>{i18nText("autoI18n.turler", "TÜRLER")}</Text>
                  <View style={fStyles.chipsWrap}>
                    {availableGenres.map((g) => {
                      const sel = genreFilter.includes(g);
                      return (
                        <TouchableOpacity
                          key={g}
                          activeOpacity={0.8}
                          onPress={() => toggleGenre(g)}
                          style={[
                            fStyles.chip,
                            {
                              backgroundColor: sel
                                ? theme.between + "22"
                                : theme.secondary,
                              borderColor: sel ? theme.between : theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              fStyles.chipText,
                              { color: sel ? theme.between : theme.text.secondary },
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setFilterModalVisible(false)}
              style={[fStyles.applyBtn, { backgroundColor: accent }]}
            >
              {filtering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={fStyles.applyText}>
                  {filteredItems.length}{i18nText("autoI18n.sonuc_goster", "sonuç göster")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //paddingTop: 0,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontWeight: "bold",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchRow: {
    width: "95%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  searchInputFlex: { flex: 1 },
  filterBtn: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterDotText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },

  itemTvShow: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
  },

  minutesBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    fontSize: 9,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  typeBadge: {
    position: "absolute",
    top: 3,
    left: 3,
    fontSize: 9,
    backgroundColor: "#555",
    color: "#fff",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  nameBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    left: 3,
    fontSize: 9,
    textAlign: "center",
    backgroundColor: "#555",
    color: "#fff",
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  reorderCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 16,
  },
  reorderHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
    opacity: 0.8,
  },
  reorderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  reorderIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderHeaderText: { flex: 1, marginHorizontal: 11 },
  reorderTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  reorderSubtitle: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  reorderClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderPreview: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1,
    padding: 8,
    marginBottom: 17,
  },
  reorderPreviewInfo: { flex: 1, marginLeft: 12, gap: 9 },
  reorderName: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  currentPositionChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  currentPositionText: { fontSize: 11, fontWeight: "700" },
  targetLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 9,
    textTransform: "uppercase",
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  positionStep: {
    width: 46,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  positionInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  positionInput: {
    minWidth: 36,
    paddingVertical: 0,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  positionTotal: { fontSize: 13, fontWeight: "600", marginLeft: 3 },
  quickPositionRow: { flexDirection: "row", gap: 8, marginTop: 9 },
  quickPositionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
  },
  quickPositionText: { fontSize: 11.5, fontWeight: "700" },
  reorderActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  reorderCancel: {
    flex: 0.8,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderCancelText: { fontSize: 14, fontWeight: "700" },
  reorderSubmit: {
    flex: 1.35,
    minHeight: 48,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reorderSubmitText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  skeletonImage: {
    width: 120,
    height: 180,
    borderRadius: 10,
    margin: 5,
  },
  skeletonText: {
    width: 100,
    height: 20,
    borderRadius: 10,
    marginTop: 5,
  },
  skeletonTextSmall: {
    width: 60,
    height: 15,
    borderRadius: 10,
    marginTop: 5,
  },
  infoContainer: {
    paddingTop: 15,
    borderTopRightRadius: 15,
    borderTopLeftRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: width * 0.3,
    height: height * 0.22,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  posterProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  imageReorder: {
    width: 68,
    height: 102,
    borderRadius: 12,
    backgroundColor: "#252525",
  },
  imageSelected: {
    width: 100,
    height: 150,
    borderRadius: 10,
    margin: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
  detail: {
    fontSize: 12,
    textAlign: "center",
    marginVertical: 3,
    marginHorizontal: 3,
  },
  detailGenres: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  detailSeason: {
    fontSize: 11,
    textAlign: "center",
  },
  seasonBox: {
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    //borderTopWidth: 0,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },

  // ── İzlenen dizi modalı (modern bottom sheet) ─────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetHero: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginBottom: 14,
  },
  sheetClose: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroRow: { flexDirection: "row", gap: 14 },
  heroPoster: {
    width: 96,
    height: 144,
    borderRadius: 14,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroInfo: { flex: 1, justifyContent: "center", gap: 8, paddingRight: 4 },
  heroTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  heroChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  heroStatusDot: { width: 6, height: 6, borderRadius: 3 },
  heroProgressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroProgressPct: {
    fontSize: 12,
    fontWeight: "800",
    minWidth: 36,
    textAlign: "right",
  },
  heroProgressDetail: { fontSize: 11, fontWeight: "600" },

  sheetBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
  },
  ctaText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  sectionCount: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionCountText: { fontSize: 10, fontWeight: "800" },

  seasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  seasonCard: {
    width: (width - 60) / 3,
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    gap: 6,
  },
  seasonPosterWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#2a2a2a",
  },
  seasonPoster: { width: "100%", height: "100%" },
  seasonPosterShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
  },
  seasonNoBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  seasonNoText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  seasonCheck: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  seasonMiniTrack: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  seasonName: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  seasonEpText: { fontSize: 10, fontWeight: "800" },

  // Count chips
  countRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  countChipTextBlue: { color: "#4b69ff", fontWeight: "700", fontSize: 12 },
  countChipTextPurple: { color: "#8847ff", fontWeight: "700", fontSize: 12 },
  countChipTextGold: { color: "#e4ae39", fontWeight: "700", fontSize: 12 },

  // Interactive Segmented Buttons
  segmentContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 24,
    padding: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
  },
  segmentBtnCenter: {
    flex: 1.4,
    marginHorizontal: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

// ── Sıralama & filtreleme modalı stilleri ──────────────────────────────────
const fStyles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: height * 0.82,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  reset: { fontSize: 14, fontWeight: "700" },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 9,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sortLabel: { flex: 1, fontSize: 14.5, fontWeight: "600" },
  dirWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  dirText: { fontSize: 12, fontWeight: "700" },
  segRow: { flexDirection: "row", gap: 8 },
  segBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  segText: { fontSize: 13.5, fontWeight: "700" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  applyBtn: {
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  applyText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
