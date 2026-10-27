import { tmdbLanguageOf, tmdbRegionOf } from "../../utils/appLanguages";
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
  useWindowDimensions,
  Animated,
    ActivityIndicator,
  Keyboard,
} from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import BackButton from "../../components/BackButton";
import PosterImage from "@components/PosterImage";
import { useTheme } from "@context/ThemeContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "@components/AppToast";
import ListPosterCard from "@components/lists/ListPosterCard";
import ModalBlurBackdrop from "../../components/common/ModalBlurBackdrop";
import useSheetTransition from "@hooks/useSheetTransition";
import {
  useApiSettings,
  useContentSettings,
  useImageQualitySettings,
  useListLayoutSettings,
  useStreamingProviderSettings,
} from "@context/AppSettingsContext";
import useProviderWatch from "@hooks/useProviderWatch";
import PlatformFilterSection from "@components/lists/PlatformFilterSection";
import { classifyTitle, planPlatformFilter } from "@utils/providerWatch";
import { getProviderWatchCopy } from "@utils/providerWatchCopy";
import { trackEvent, ANALYTICS_EVENTS } from "@services/analytics";
import WatchPickerEntry from "@components/lists/WatchPickerEntry";
import WatchPickerSheet from "@components/lists/WatchPickerSheet";
import { getWatchPickerCopy } from "@utils/watchPickerCopy";
import DatePickerModal from "@components/modals/DatePickerModal";
import ListSearchBar from "@components/lists/ListSearchBar";
import GlobalSearchResults from "@components/lists/GlobalSearchResults";
import ListItemActionsSheet from "@components/lists/ListItemActionsSheet";
import GlassIconButton from "@components/common/GlassIconButton";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import { buildListShare } from "@utils/chatShare";
import ListSortFilterSheet from "@components/lists/ListSortFilterSheet";
import { getListSortFilterCopy } from "@utils/listSortFilterCopy";
import { MyPosterActivityBadge } from "@components/PosterActivityBadge";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "@utils/i18nText";
import { buildGenreMap } from "@utils/genreLabels";
import { todayListDate } from "@utils/mediaFacts";
import {
  buildListKeySet,
  GLOBAL_SEARCH_MIN_CHARS,
  LIST_SEARCH_MODE,
  listRequiresWatchDate,
  matchesListQuery,
  topListGenres,
} from "@utils/listSearch";
import {
  addMediaToList,
  fetchSuggestionsForList,
  searchForList,
} from "@services/listQuickAdd";
import { reorderWatchedShows } from "../../services/watchedTvService";
import { removeFromListAny, reorderCustomList } from "../../services/libraryActions";
import { showLibraryError, showWatchSpreadNotice } from "../../utils/libraryErrorText";
import { refreshShowMeta } from "../../services/refreshShowMeta";
import { cachedTmdb } from "../../utils/cachedRead";
import ScreenDecor from "@components/ScreenDecor";
import StaggerItem from "@components/StaggerItem";
import GlassCloseButton from "@components/common/GlassCloseButton";
import useEntranceGate from "@hooks/useEntranceGate";
import { gridEntranceIndex } from "@utils/entranceGate";
import {
  reorderList,
  PREDEFINED_MOVIE_LISTS,
} from "../../services/listItemsService";

import ModalToastHost from "@components/toast/ModalToastHost";
import {
  GRID_COLUMN_GAP,
  GRID_SIDE_PADDING,
  initialRowsFor,
  posterHeightFor,
  posterKeyOf,
  posterWidthFor,
  rowHeightFor,
} from "@utils/listPosterLayout";
import GlassTouchable from "../../components/common/GlassTouchable";
import GlassBox from "../../components/common/GlassBox";
import usePosterUri from "../../hooks/usePosterUri";
const { width, height } = Dimensions.get("window");
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
  const [shareVisible, setShareVisible] = useState(false);
  const [listModalItems, setListModalItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); // iki kipte de ORTAK sorgu
  // ── Arama kipi ────────────────────────────────────────────────────────────
  // "list"   → aşağıdaki ızgarayı süzer
  // "global" → TMDB'de arar, sonuç bu listeye eklenir (aşağıdaki blok)
  const [searchMode, setSearchMode] = useState(LIST_SEARCH_MODE.IN_LIST);
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [addingKey, setAddingKey] = useState(null); // eklenmekte olan eser
  // İzlenenler listelerinde ekleme tarih ister; seçim yapılana kadar eser burada bekler.
  const [pendingMedia, setPendingMedia] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  // ── Sıralama & filtreleme ───────────────────────────────────────────────
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState("default"); // default | dateAdded | name | minutes
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [typeFilter, setTypeFilter] = useState("all"); // all | movie | tv
  const [dateRange, setDateRange] = useState("all"); // all | 7 | 30 | 365
  const [genreFilter, setGenreFilter] = useState([]); // seçili tür isimleri
  const [platformOnly, setPlatformOnly] = useState(false); // yalnız platformlarımda izlenebilenler (izleme listesi)
  const [filtering, setFiltering] = useState(false); // sıralama/filtre yükleniyor
  const filterFirstRef = useRef(true);
  // ── Görünüm ayarları — uygulama açılışında hidrate edilen ortak ayardan gelir
  // (yerel depoya kaydedilir, Ayarlar ekranıyla paylaşılır) ───────────────────
  const {
    listsGridColumns: gridColumns,
    changeListsGridColumns: changeGridColumns,
    listsPosterRadius: posterRadius,
    changeListsPosterRadius: changePosterRadius,
    listPosterInfo,
    changeListPosterInfo,
  } = useListLayoutSettings();
  // Sütun sayısına göre afiş boyutu — PENCERE genişliğinden (dönme / katlanır ekran / bölünmüş pencerede
  // güncel kalır; eskiden modül yüklenirken bir kez okunan Dimensions.get idi). Ölçü kararları saf
  // çekirdekte: utils/listPosterLayout.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const posterW = posterWidthFor({ windowWidth, columns: gridColumns });
  const posterH = posterHeightFor(posterW);
  // Görünür vurgu rengi (theme.between bazı temalarda tanımsız/kontrastsız olabilir)
  const accent = theme.between || theme.accent || "#4b69ff";
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { API_KEY } = useApiSettings();
  const { adultContent } = useContentSettings();
  // "Platformlarımda" süzgeci YALNIZ izleme listesinde: sunucu snapshot'ı (ProviderWatch) yalnız o listeyi
  // kapsıyor. Dinleyici diğer listelerde açılmaz.
  const isWatchList = listName === "watchList";
  const { streamingProviderIds } = useStreamingProviderSettings();
  const { snapshot: providerSnapshot } = useProviderWatch({ active: isWatchList });
  const providerCopy = getProviderWatchCopy(language);
  // Tür id → ad tablosu: global aramadan eklenen öğe tür adlarını KAYDEDENİN
  // dilinde alsın (TMDB arama sonucu yalnız id taşıyor).
  const genreMap = useMemo(() => buildGenreMap(), [language]);
  const {
    allLists,
    combinedLists,
    watchedTvMap,
    watchedTvLoaded,
    loading: listsLoading,
  } = useListStatusContext();
  const [isLoading, setIsLoading] = useState(listsLoading);
  // `listItems` gerçekten kaynaktan okundu mu? Boş dizi tek başına "liste boş"
  // demek değil, "henüz okumadım" da olabilir; kip otomatiği bu ikisini
  // ayırt etmek zorunda (bkz. autoModeRef effect'i).
  const [itemsReady, setItemsReady] = useState(false);
  // Posterler YALNIZ ilk yüklemede kademeli girer; sonradan arama/filtreyle
  // yeniden bağlanan satırlar animasyonsuz çizilir (bkz. hooks/useEntranceGate).
  const shouldAnimateEntrance = useEntranceGate(itemsReady);
  const [modalVisible, setModalVisible] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  // İki alt sayfa: blur yerinde solar, sayfa kayar
  // (bkz. hooks/useSheetTransition.js). `modalVisible` = izlenen dizi kartı.
  const watchedSheet = useSheetTransition(modalVisible);
  const [index, setIndex] = useState(0);
  const [reorderItems, setReorderItems] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const suppressNextPressRef = useRef(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState("mixed");
  const [value, setValue] = useState("");
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();

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

  const removeSelectedItem = async () => {
    if (!reorderItems || !user?.uid || isReordering) return;
    setIsReordering(true);
    try {
      // Hangi liste olduğuna göre DOĞRU geri alma yolunu libraryActions seçer:
      // izlenen film/dizide tüm izleme kaydı + istatistik + izlendi bayrağı,
      // favori/izlenecekte üyelik, özel listede dizi girdisi.
      await removeFromListAny({
        uid: user.uid,
        listName,
        type: reorderItems.type,
        id: reorderItems.id,
      });
      setListItems((current) =>
        current.filter(
          (item) =>
            !(
              String(item.id) === String(reorderItems.id) &&
              item.type === reorderItems.type
            ),
        ),
      );
      setReorderModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.listeden_kaldirildi", "Listeden kaldırıldı"),
      });
    } catch (error) {
      showLibraryError(error, { source: "lists_remove_item" });
    } finally {
      setIsReordering(false);
    }
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

  // watchedTv modalı açıldığında, TMDB'deki güncel sezon/bölüm sayısını kontrol et
  // ve yeni sezonlar çıkmışsa modalı, listeyi ve Firestore kaydını sessizce güncelle.
  useEffect(() => {
    if (!modalVisible || !listModalItems?.length || listName !== "watchedTv") return;
    const item = listModalItems[0];
    if (!item?.id || !API_KEY || !user?.uid) return;

    let active = true;
    (async () => {
      try {
        const { data } = await cachedTmdb(
          `https://api.themoviedb.org/3/tv/${item.id}?language=${tmdbLanguageOf(language)}`,
          { headers: { accept: "application/json", Authorization: API_KEY } },
          { maxAge: 6 * 60 * 60 * 1000, category: "tvContent" },
        );
        if (!active || !data) return;
        const newEpCount = data.number_of_episodes || 0;
        const newSeasonCount = data.number_of_seasons || 0;
        if (
          newEpCount > (item.showEpisodeCount || 0) ||
          newSeasonCount > (item.showSeasonCount || 0)
        ) {
          await refreshShowMeta(user.uid, item.id, data, item);
          if (!active) return;
          const updatedFields = {
            showEpisodeCount: Math.max(item.showEpisodeCount || 0, newEpCount),
            showSeasonCount: Math.max(item.showSeasonCount || 0, newSeasonCount),
          };
          setListModalItems((prev) => {
            if (!prev?.length || String(prev[0].id) !== String(item.id)) return prev;
            return [{ ...prev[0], ...updatedFields }];
          });
          setListItems((prev) =>
            prev.map((i) =>
              String(i.id) === String(item.id) ? { ...i, ...updatedFields } : i,
            ),
          );
        }
      } catch (err) {
        if (__DEV__) console.log("[ListsScreen] modal refreshShowMeta error:", err?.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [modalVisible, listModalItems, listName, API_KEY, user?.uid, language]);

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

  useEffect(() => {
    const sourceLoading =
      listsLoading || (listName === "watchedTv" && !watchedTvLoaded);
    setIsLoading(sourceLoading);
    // Aşağıdaki setListItems çağrılarıyla AYNI toplu güncellemeye girer; böylece
    // sonraki render'da "okundu" bayrağı ile öğeler birlikte tazedir.
    setItemsReady(!sourceLoading);
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
        // Özel liste (kök dokümandaki dizi): ekrandaki nihai sırayı libraryActions
        // transaction içinde uygular; ekranın görmediği (başka cihazda eklenen)
        // öğeler silinmez, noktalı liste adları bozulmaz.
        setListItems(currentItems);
        await reorderCustomList({ uid: user.uid, listName, orderedItems: currentItems });
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
      // Optimistik güncellemeyi geri al (her kolda sıra yazımdan ÖNCE ekrana uygulanır).
      setListItems(listItems);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      // Beklenmeyen hata Sentry'ye, kullanıcıya sınıflanmış (yerelleştirilmiş) neden.
      showLibraryError(error, { source: "lists_reorder" });
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

  // "Platformlarımda": sayılar HAM listeden (diğer süzgeçlerden bağımsız) hesaplanır ki çipteki sayı
  // süzgeç değiştikçe oynamasın. Veri kullanılamıyorsa (belge yok, bölge farklı…) süzgeç etkisizdir.
  const platformPlan = useMemo(
    () =>
      isWatchList
        ? planPlatformFilter({
            snapshot: providerSnapshot,
            myProviderIds: streamingProviderIds,
            region: tmdbRegionOf(language),
            items: listItems,
          })
        : null,
    [isWatchList, providerSnapshot, streamingProviderIds, language, listItems],
  );
  const platformActive = platformOnly && platformPlan?.state === "ready";

  // Aktif filtre/sıralama göstergesi
  const sortActive = sortBy !== "default";
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (genreFilter.length > 0 ? 1 : 0) +
    (platformActive ? 1 : 0);

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
    // Sorgu YALNIZ liste içi kipte süzer: kullanıcı global aramaya geçtiğinde
    // alttaki liste (ve ondan beslenen sayaçlar/rastgele seçici) daralmasın.
    const listQuery =
      searchMode === LIST_SEARCH_MODE.IN_LIST ? searchQuery : "";

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
      if (!matchesListQuery(item, listQuery)) return false;
      if (
        tvShowStatus !== null &&
        (watchedCountOf(item) === item.showEpisodeCount) !== tvShowStatus
      )
        return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (platformActive && classifyTitle(providerSnapshot, item, streamingProviderIds) !== "yes") return false;
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
    searchMode,
    tvShowStatus,
    typeFilter,
    dateRange,
    genreFilter,
    platformActive,
    providerSnapshot,
    streamingProviderIds,
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
    setPlatformOnly(false);
  };

  const togglePlatformOnly = () => {
    const next = !platformOnly;
    setPlatformOnly(next);
    if (next) {
      trackEvent(ANALYTICS_EVENTS.WATCHLIST_PLATFORM_FILTER, {
        yes: platformPlan?.counts.yes ?? 0,
        unknown: platformPlan?.counts.unknown ?? 0,
        total: platformPlan?.counts.total ?? 0,
      });
    }
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
  }, [tvShowStatus, typeFilter, dateRange, genreFilter, platformActive, sortBy, sortDir]);

  // ── Global arama (TMDB) ────────────────────────────────────────────────────
  // Bu listede zaten olan eserler sonuçta "tik"le işaretlenir; anahtar tip+id
  // olduğundan aynı id'li film ve dizi karışmaz.
  const existingKeys = useMemo(
    () =>
      buildListKeySet(listItems, {
        fallbackType: listName === "watchedTv" ? "tv" : "movie",
      }),
    [listItems, listName],
  );

  // Eskimiş yanıt taze sonucun üstüne yazmasın (SearchAll deseni).
  const globalReqRef = useRef(0);
  useEffect(() => {
    if (searchMode !== LIST_SEARCH_MODE.GLOBAL) {
      // Kip değişti: debounce timer'ı cleanup ile iptal oluyor ama zaten
      // set edilmiş globalLoading kimse tarafından kapatılmıyordu (finally
      // hiç çalışmıyor). Sonuç: ListSearchBar'da temizle (X) düğmesinin
      // yerinde sonsuz spinner. Uçuştaki isteği de geçersiz kıl.
      globalReqRef.current += 1;
      setGlobalLoading(false);
      setGlobalError(false);
      return undefined;
    }
    const q = searchQuery.trim();
    if (q.length < GLOBAL_SEARCH_MIN_CHARS) {
      // Uçuştaki isteği geçersiz kıl: 2 karakterin altına inince ekran
      // "öneriler"e döner, gecikmiş yanıt onu ezmemeli.
      globalReqRef.current += 1;
      setGlobalResults([]);
      setGlobalLoading(false);
      setGlobalError(false);
      return undefined;
    }

    const reqId = ++globalReqRef.current;
    setGlobalLoading(true);
    setGlobalError(false);
    const timer = setTimeout(async () => {
      try {
        const found = await searchForList({
          listName,
          query: q,
          apiKey: API_KEY,
          language,
          adultContent,
        });
        if (reqId !== globalReqRef.current) return;
        setGlobalResults(found);
      } catch {
        if (reqId !== globalReqRef.current) return;
        setGlobalResults([]);
        setGlobalError(true);
      } finally {
        if (reqId === globalReqRef.current) setGlobalLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchMode, searchQuery, listName, API_KEY, language, adultContent]);

  // Öneriler listenin KENDİ türlerinden gelsin: bu listede en çok geçen 3 tür
  // (yoksa boş → servis popülere düşer).
  const suggestionGenres = useMemo(
    () => topListGenres(listItems, { limit: 3 }),
    [listItems],
  );

  // Sorgu yokken gösterilen öneriler — cache'li. Anahtar liste ADI + TÜR ÜÇLÜSÜ:
  // liste değişince olduğu gibi, listeye ekleme yapılıp baskın türler değişince
  // de öneriler tazelenir; türler aynı kaldıkça (olağan durum) ağa çıkılmaz.
  const suggestionsRef = useRef(null);
  useEffect(() => {
    if (searchMode !== LIST_SEARCH_MODE.GLOBAL || !API_KEY) return undefined;
    const cacheKey = `${listName}|${suggestionGenres.join(",")}`;
    if (suggestionsRef.current === cacheKey) return undefined;
    suggestionsRef.current = cacheKey;
    let alive = true;
    fetchSuggestionsForList({
      listName,
      apiKey: API_KEY,
      language,
      genreNames: suggestionGenres,
    })
      .then((items) => {
        if (alive) setSuggestions(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [searchMode, listName, API_KEY, language, suggestionGenres]);

  // Boş listede kip doğrudan global açılır: ekranda eklenecek bir şey yokken
  // "Bu liste boş" yazıp kullanıcıyı başka ekrana göndermenin anlamı yok.
  //
  // DİKKAT — `isLoading` ile korumak YETMEZ: bu ekrana zaten yüklü bir liste
  // listesinden geliniyor, yani `listsLoading` mount anında çoğunlukla false ve
  // `isLoading` da false başlıyor. İlk render'da `listItems` ise henüz `[]`
  // (yükleme effect'i çalışmadı). Eski koşul bu yüzden DOLU listelerde de
  // tetikleniyor, `autoModeRef` mandalı kapanıyor ve her liste "Tüm içerikler"
  // kipinde açılıyordu. Bunun yerine, verinin gerçekten okunduğunu bildiren
  // `itemsReady` beklenir: o bayrak `setListItems` ile AYNI effect'te
  // ayarlandığı için sonraki render'da ikisi birlikte doğru olur.
  // Kip HER İKİ YÖNDE de açıkça kurulur: aynı ekran başka bir `listName` ile
  // yeniden kullanılırsa (route param değişimi) önceki listeden kalan global kip
  // dolu listeye taşınmasın. Mandal liste başına bir kez düşer, sonrasında
  // kullanıcının seçimine karışılmaz. `ListSearchBar` yalnız yükleme bittikten
  // sonra çizildiği için (yukarıda `isLoading ? renderSkeleton()`), bu ilk
  // kurulum kullanıcının erken bir dokunuşunu ezemez.
  const autoModeRef = useRef(null);
  useEffect(() => {
    if (!itemsReady || autoModeRef.current === listName) return;
    autoModeRef.current = listName;
    setSearchMode(
      listItems.length === 0
        ? LIST_SEARCH_MODE.GLOBAL
        : LIST_SEARCH_MODE.IN_LIST,
    );
  }, [itemsReady, listItems.length, listName]);

  const openMediaDetails = useCallback(
    (media) => {
      Keyboard.dismiss();
      navigation.navigate(
        media.type === "movie" ? "MovieDetails" : "TvShowsDetails",
        { id: media.id },
      );
    },
    [navigation],
  );

  const runAdd = useCallback(
    async (media, watchDate) => {
      setAddingKey(media.key);
      try {
        const addResult = await addMediaToList({
          uid: user.uid,
          listName,
          media,
          apiKey: API_KEY,
          language,
          genreMap,
          watchDate,
        });
        const { status } = addResult;

        if (status === "empty-show") {
          Toast.show({
            type: "warning",
            text1: i18nText(
              "autoI18n.bolum_bilgisi_bulunamadi",
              "Bu dizinin bölüm bilgisi bulunamadı.",
            ),
          });
          return;
        }
        if (status === "duplicate") {
          Toast.show({
            type: "info",
            text1: i18nText("autoI18n.zaten_listede", "Bu içerik zaten listede."),
          });
          return;
        }
        // Yayınlanmamış / tarihi bilinmeyen içerik izlendi olarak yazılamaz —
        // istatistik, rozet ve Wrapped hesapları bundan besleniyor.
        if (status === "unreleased" || status === "unknown-release") {
          Toast.show({
            type: "warning",
            text1:
              status === "unreleased"
                ? i18nText("autoI18n.henuz_yayinlanmadi", "Henüz yayınlanmadı")
                : i18nText(
                    "autoI18n.yayin_tarihi_bilinmiyor",
                    "Yayın tarihi bilinmiyor",
                  ),
            text2: i18nText(
              "autoI18n.izlendi_olarak_eklenemez",
              "İzlendi olarak eklenemez.",
            ),
          });
          return;
        }

        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        if (!showWatchSpreadNotice(addResult)) {
          Toast.show({
            type: "success",
            text1: i18nText("autoI18n.listeye_eklendi", "Listeye eklendi"),
            text2: media.title,
          });
        }
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        // Başlık "Eklenemedi", neden yerelleştirilmiş: çevrimdışı / yayınlanmamış / …
        showLibraryError(error, {
          source: "lists_add_media",
          title: i18nText("autoI18n.eklenemedi", "Eklenemedi"),
        });
      } finally {
        setAddingKey(null);
      }
    },
    [user?.uid, listName, API_KEY, language, genreMap],
  );

  const handleAddMedia = useCallback(
    (media) => {
      if (!user?.uid) {
        Toast.show({
          type: "warning",
          text1: i18nText("autoI18n.once_giris_yap", "Önce giriş yapmalısın."),
        });
        return;
      }
      if (addingKey || existingKeys.has(media.key)) return;
      Keyboard.dismiss();
      // İzlenenler listelerinde `dateAdded` istatistik/rozet hesabına giren
      // gerçek izleme tarihidir — "bugün" varsayılamaz, sorulur.
      if (listRequiresWatchDate(listName)) {
        setPendingMedia(media);
        setDatePickerVisible(true);
        return;
      }
      runAdd(media, null);
    },
    [user?.uid, addingKey, existingKeys, listName, runAdd],
  );

  const closeDatePicker = useCallback(() => {
    setDatePickerVisible(false);
    setPendingMedia(null);
  }, []);

  const confirmWatchDate = useCallback(
    (value) => {
      const media = pendingMedia;
      setDatePickerVisible(false);
      setPendingMedia(null);
      if (!media) return;
      const iso =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
          ? value.slice(0, 10)
          : todayListDate(new Date(value || Date.now()));
      runAdd(media, iso);
    },
    [pendingMedia, runAdd],
  );

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
  // ── Sırala ve filtrele sayfasının içeriği ────────────────────────────────────
  const sortFilterCopy = getListSortFilterCopy(language);
  const sortOptions = [
    { key: "default", label: i18nText("autoI18n.liste_sirasi", "Liste sırası"), icon: "list" },
    { key: "dateAdded", label: i18nText("autoI18n.eklenme_tarihi", "Eklenme tarihi"), icon: "calendar" },
    { key: "name", label: i18nText("autoI18n.isim", "İsim"), icon: "type" },
    { key: "minutes", label: i18nText("autoI18n.sure", "Süre"), icon: "clock" },
  ];
  const filterSections = [];
  // Tür süzgeci karışık listelerde anlamlı (izlenen filmler / diziler tek türdür).
  if (listName !== "watchedMovies" && listName !== "watchedTv") {
    filterSections.push({
      id: "type",
      kind: "segment",
      title: i18nText("autoI18n.tur", "TÜR"),
      value: typeFilter,
      onChange: setTypeFilter,
      options: [
        { key: "all", label: i18nText("autoI18n.hepsi", "Hepsi") },
        { key: "movie", label: t.typeMovies || i18nText("autoI18n.film", "Film") },
        { key: "tv", label: t.typeTvSeries || i18nText("autoI18n.dizi", "Dizi") },
      ],
    });
  }
  // Platformlarım (yalnız izleme listesi; sunucu snapshot'ı) — kendi başlığını ve durum notlarını çizer.
  if (isWatchList && platformPlan) {
    filterSections.push({
      id: "platform",
      kind: "node",
      node: (
        <PlatformFilterSection
          plan={platformPlan}
          selected={platformOnly}
          onToggle={togglePlatformOnly}
          copy={providerCopy}
          theme={theme}
          accent={accent}
        />
      ),
    });
  }
  if (hasDates) {
    filterSections.push({
      id: "date",
      kind: "chips",
      title: i18nText("autoI18n.eklenme_tarihi", "EKLENME TARİHİ"),
      value: dateRange,
      onChange: setDateRange,
      options: [
        { key: "all", label: i18nText("autoI18n.tumu", "Tümü") },
        { key: "7", label: i18nText("autoI18n.son_7_gun", "Son 7 gün") },
        { key: "30", label: i18nText("autoI18n.son_30_gun", "Son 30 gün") },
        { key: "365", label: i18nText("autoI18n.son_1_yil", "Son 1 yıl") },
      ],
    });
  }
  if (availableGenres.length > 0) {
    filterSections.push({
      id: "genre",
      kind: "multi",
      title: i18nText("autoI18n.turler", "TÜRLER"),
      options: availableGenres,
      value: genreFilter,
      onToggle: toggleGenre,
      moreLabel: sortFilterCopy.moreChips,
      lessLabel: sortFilterCopy.lessChips,
    });
  }

  // "Ne izlesem?": havuz, o an görünen (arama / süzgeç uygulanmış) liste. Tür seçimi sayfanın içinde.
  const pickerCopy = useMemo(() => getWatchPickerCopy(language), [language]);
  const pickerFiltered =
    activeFilterCount > 0 ||
    (searchMode === LIST_SEARCH_MODE.IN_LIST && searchQuery.trim().length > 0);
  const openPicker = (type = "mixed") => {
    if (filteredItems.length === 0) {
      Toast.info(pickerCopy.entry.empty);
      return;
    }
    setPickerType(type);
    setPickerVisible(true);
  };
  const openPickedItem = (item) => {
    navigation.navigate(item.type === "movie" ? "MovieDetails" : "TvShowsDetails", { id: item.id });
  };

  // İzlenen bölüm sayısı ve toplam süre (dk): öğe başına bir kez hesaplanır, anahtar TÜR+id (karışık listede film
  // ve dizi aynı TMDB id'sini paylaşabilir; eskiden yalnız id idi ve biri ötekinin verisini gösterebilirdi).
  const { watchedCountByKey, durationMinutesByKey } = useMemo(() => {
    const counts = {};
    const durations = {};
    listItems.forEach((item) => {
      const key = posterKeyOf(item);
      counts[key] = Array.isArray(item.seasons)
        ? item.seasons.reduce(
            (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
            0,
          )
        : 0;
      durations[key] = getItemMinutes(item);
    });
    return { watchedCountByKey: counts, durationMinutesByKey: durations };
  }, [listItems]);

  // Poster kartı işleyicileri: kararlı kimlik → memo'lu kart gereksiz yere yeniden çizilmez.
  const typeLabels = useMemo(() => ({ movie: t.typeMovies, tv: t.typeTvSeries }), [t]);
  const handlePosterPress = useCallback(
    (item) => {
      if (suppressNextPressRef.current) {
        suppressNextPressRef.current = false;
        return;
      }
      if (listName !== "watchedTv") {
        navigation.navigate(item.type === "movie" ? "MovieDetails" : "TvShowsDetails", { id: item.id });
      } else {
        setModalVisible(true);
      }
      setListModalItems([item]); // Tek bir öğeyi modalda göstermek için diziye sarın
    },
    [listName, navigation],
  );
  const handlePosterLongPress = useCallback(
    (item) => {
      suppressNextPressRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setReorderModalVisible(true);
      const originalIndex = listItems.findIndex(
        (i) => i.type === item.type && String(i.id) === String(item.id),
      );
      setIndex(originalIndex);
      setReorderItems(item);
      setValue(String(originalIndex + 1));
    },
    [listItems],
  );
  const rowHeight = rowHeightFor({ posterWidth: posterW, showTitle: !!listPosterInfo.title });

  // Başlık: öntanımlı dört liste çevrilmiş ad, özel listede kullanıcının adı.
  const listTitle =
    listName == "watchedMovies"
      ? i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler")
      : listName == "watchedTv"
        ? i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler")
        : listName == "favorites"
          ? i18nText("autoI18n.favoriler", "Favoriler")
          : listName == "watchList"
            ? i18nText("autoI18n.izlenecekler", "İzlenecekler")
            : listName;

  // Sohbete gönderilecek gövde: TÜM liste (arama/filtre değil), ekranda görülen
  // sırada. Dizi izlenenlerinde `type` alanı olmayan eski kayıtlar için yedek tür.
  const shareablePayload = useMemo(
    () =>
      buildListShare({
        title: listTitle,
        items: listItems,
        listKey: listName,
        fallbackType: listName === "watchedTv" ? "tv" : "movie",
        source: "profile",
      }),
    [listTitle, listItems, listName],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="lists" iconOpacity={0.25} />
      <View style={styles.headerRow}>
        <View style={styles.headerSide}>
          <BackButton absolute={false} />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.header, { color: theme.text.primary }]}
        >
          {listTitle}
        </Text>
        <View style={styles.headerSide}>
          {/* Listeyi sohbete / gruba gönder: alıcı seçilir, ChatScreen listeyi
              zengin bir balon olarak yazar (utils/chatShare.js). */}
          {!isLoading && shareablePayload ? (
            <GlassIconButton
              icon="paper-plane-outline"
              iconSize={20}
              size={40}
              onPress={() => setShareVisible(true)}
              accessibilityLabel={i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
            />
          ) : null}
        </View>
      </View>
      <ShareToChatSheet
        visible={shareVisible}
        share={shareablePayload}
        onClose={() => setShareVisible(false)}
      />

      {isLoading ? (
        renderSkeleton()
      ) : (
        <>
          {/* Arama artık öğe sayısından BAĞIMSIZ olarak hep açık: eski
              "12'den fazlaysa göster" eşiği, küçük ve boş listeleri hem
              aramasız hem sıralama/filtresiz bırakıyordu. */}
          <ListSearchBar
            theme={theme}
            accent={accent}
            listName={listName}
            mode={searchMode}
            onModeChange={setSearchMode}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onOpenFilters={() => setFilterModalVisible(true)}
            activeFilterCount={activeFilterCount + (sortActive ? 1 : 0)}
            filtering={filtering}
            inListCount={filteredItems.length}
            globalCount={globalResults.length}
            globalLoading={globalLoading}
          />

          {searchMode === LIST_SEARCH_MODE.GLOBAL ? (
            <GlobalSearchResults
              theme={theme}
              accent={accent}
              listName={listName}
              query={searchQuery}
              results={globalResults}
              suggestions={suggestions}
              loading={globalLoading}
              error={globalError}
              existingKeys={existingKeys}
              addingKey={addingKey}
              genreMap={genreMap}
              onAdd={handleAddMedia}
              onOpen={openMediaDetails}
            />
          ) : listItems.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="albums-outline"
                size={40}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.emptyText, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.bu_liste_bos", "Bu liste boş.")}
              </Text>
              <GlassTouchable
                activeOpacity={0.85}
                onPress={() => setSearchMode(LIST_SEARCH_MODE.GLOBAL)}
                style={[styles.emptyCta, { backgroundColor: accent }]}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyCtaText}>
                  {i18nText("autoI18n.icerik_ekle", "İçerik ekle")}
                </Text>
              </GlassTouchable>
            </View>
          ) : (
        <>
          {listName == "watchList" && (
            <WatchPickerEntry
              theme={theme}
              copy={pickerCopy}
              filtered={pickerFiltered}
              items={filteredItems}
              onPick={openPicker}
            />
          )}
          {listName == "watchedTv" && (
            <>
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
            </>
          )}
          <FlatList
            data={gridRows}
            // Satırlar eşit yükseklikte (başlık tek satır, sabit lineHeight): FlatList kaydırmada ölçmez.
            getItemLayout={(_, i) => ({ length: rowHeight, offset: rowHeight * i, index: i })}
            initialNumToRender={initialRowsFor({ windowHeight, rowHeight })}
            maxToRenderPerBatch={6}
            windowSize={7}
            // Android'de dinamik numColumns'lu FlatList "addViewAt: failed to insert
            // view" çökmesine yol açtığından, çok sütunlu görünüm numColumns yerine
            // elle satırlara bölünüp tek sütunlu listede render edilir.
            removeClippedSubviews={false}
            keyExtractor={(row, i) => `${row[0] ? posterKeyOf(row[0]) : "r"}-${i}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: GRID_SIDE_PADDING,
              paddingBottom: 40,
            }}
            renderItem={({ item: row, index: rowIndex }) => (
              <View style={{ flexDirection: "row", justifyContent: "flex-start", gap: GRID_COLUMN_GAP, width: "100%", height: rowHeight }}>
                {row.map((item, colIndex) => (
                  <StaggerItem
                    key={posterKeyOf(item)}
                    index={gridEntranceIndex(rowIndex, colIndex, gridColumns)}
                    animate={shouldAnimateEntrance()}
                    step={40}
                    maxStaggered={12}
                    style={{ width: posterW }}
                  >
                    <ListPosterCard
                      item={item}
                      posterWidth={posterW}
                      radius={posterRadius}
                      info={listPosterInfo}
                      listName={listName}
                      theme={theme}
                      durationMinutes={durationMinutesByKey[posterKeyOf(item)]}
                      watchedCount={watchedCountByKey[posterKeyOf(item)]}
                      totalCount={item.showEpisodeCount}
                      typeLabels={typeLabels}
                      onPress={handlePosterPress}
                      onLongPress={handlePosterLongPress}
                    />
                  </StaggerItem>
                ))}
                {row.length < gridColumns
                  ? Array.from({ length: gridColumns - row.length }).map((_, i) => (
                      <View key={`sp-${i}`} style={{ width: posterW }} />
                    ))
                  : null}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.noMatchWrap}>
                <Ionicons
                  name="search-outline"
                  size={34}
                  color={theme.text.muted}
                />
                <Text
                  style={[styles.emptyText, { color: theme.text.muted }]}
                >
                  {i18nText(
                    "autoI18n.listede_eslesme_yok",
                    "Bu listede eşleşen içerik yok.",
                  )}
                </Text>
                <GlassTouchable
                  activeOpacity={0.85}
                  onPress={() => setSearchMode(LIST_SEARCH_MODE.GLOBAL)}
                  style={[styles.emptyCta, { backgroundColor: accent }]}
                >
                  <Ionicons name="planet-outline" size={15} color="#fff" />
                  <Text style={styles.emptyCtaText}>
                    {i18nText(
                      "autoI18n.tum_iceriklerde_ara",
                      "Tüm içeriklerde ara",
                    )}
                  </Text>
                </GlassTouchable>
              </View>
            }
          />
        </>
          )}
        </>
      )}
      <Modal
        animationType="none"
        transparent={true}
        visible={watchedSheet.mounted}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={styles.modalContainer}
          onLayout={watchedSheet.onOverlayLayout}
        >
          {/* Blur YERİNDE solar — sayfayla birlikte kaymaz. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: watchedSheet.backdropOpacity },
            ]}
          >
            <ModalBlurBackdrop intensity={50} />
          </Animated.View>
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
                // Gövde yüksekliği sezon sayısına göre esner: satır başına
                // kompakt kart yüksekliği (poster 2:3 + iç boşluk), ekranın
                // %55'i ile sınırlı — az sezonda kısa, çok sezonda uzun modal.
                const seasonCardW = (width - 60) / 3;
                const seasonCardH = (seasonCardW - 12) * 1.5 + 12;
                const seasonRows = Math.max(1, Math.ceil(sortedSeasons.length / 3));
                const seasonGridH =
                  seasonRows * seasonCardH + (seasonRows - 1) * 10;
                const posterSource = posterUri("tv", item.id, item.imagePath)
                  ? {
                      uri: posterUri("tv", item.id, item.imagePath),
                      cache: "force-cache",
                    }
                  : null;

                return (
                  <Animated.View
                    onLayout={watchedSheet.onSheetLayout}
                    style={[
                      styles.sheet,
                      { backgroundColor: theme.secondary },
                      watchedSheet.sheetStyle,
                    ]}
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
                      <GlassCloseButton
                        onImage
                        size={30}
                        fallbackRadius={15}
                        iconSize={16}
                        backgroundColor="rgba(0,0,0,0.4)"
                        style={styles.sheetClose}
                        hitSlop={10}
                        onPress={() => setModalVisible(false)}
                      />

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
                          mediaId={item.id}
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
                        style={{ maxHeight: Math.min(height * 0.55, seasonGridH + 4) }}
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
                                  // Dizi üstverisi de taşınır: SeasonDetails
                                  // bunları başlıkta ve yorum sayfasında
                                  // (mediaTitle/mediaPoster → "Etkinliklerim →
                                  // Yorumlarım" satırı) kullanır. Eksik
                                  // geçilirse yorum kaydı adsız/postersiz kalır.
                                  navigation.navigate("SeasonDetails", {
                                    showId: item.id,
                                    seasonNumber: season.seasonNumber,
                                    showName: item.name,
                                    showPosterPath: item.imagePath || null,
                                    showEpisodeCount: item.showEpisodeCount || 0,
                                    showSeasonCount:
                                      item.showSeasonCount || sortedSeasons.length,
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
                                      "rgba(0,0,0,0.82)",
                                    ]}
                                    style={styles.seasonPosterShade}
                                  />
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
                                  {/* Sezon adı + bölüm sayısı poster üstünde
                                      (alt gölge okunurluğu sağlar) */}
                                  <View style={styles.seasonOverlay}>
                                    <Text
                                      numberOfLines={1}
                                      style={styles.seasonName}
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
                                  </View>
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
                  </Animated.View>
                );
              })()}
        </View>
        <ModalToastHost visible={modalVisible} />
      </Modal>
      <WatchPickerSheet
        visible={pickerVisible}
        initialType={pickerType}
        onClose={() => setPickerVisible(false)}
        items={filteredItems}
        filtered={pickerFiltered}
        onOpen={openPickedItem}
      />
      <ListItemActionsSheet
        visible={reorderModalVisible}
        item={reorderItems}
        currentIndex={index}
        itemCount={listItems.length}
        accent={accent}
        busy={isReordering}
        onClose={closeReorderModal}
        onMove={(targetIndex) =>
          reorderWatchedTv(index, String(targetIndex + 1), listName)
        }
        onDelete={removeSelectedItem}
      />
      <Modal
        animationType="fade"
        transparent={true}
        visible={false}
        statusBarTranslucent
        onRequestClose={closeReorderModal}
      >
        <ModalBlurBackdrop intensity={65} />
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
              <GlassCloseButton
                size={34}
                fallbackRadius={12}
                disabled={isReordering}
                onPress={closeReorderModal}
              />
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
                mediaId={reorderItems?.id}
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
              <GlassTouchable
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
              </GlassTouchable>

              <GlassBox role="field"
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
              </GlassBox>

              <GlassTouchable
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
              </GlassTouchable>
            </View>

            <View style={styles.quickPositionRow}>
              <GlassTouchable
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
              </GlassTouchable>
              <GlassTouchable
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
              </GlassTouchable>
            </View>

            <View style={styles.reorderActions}>
              <GlassTouchable
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
              </GlassTouchable>

              <GlassTouchable
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
              </GlassTouchable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sırala ve filtrele (ortak kompakt sayfa; bkz. components/lists/ListSortFilterSheet) ── */}
      <ListSortFilterSheet
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        theme={theme}
        accent={accent}
        copy={sortFilterCopy}
        resultCount={filteredItems.length}
        filtering={filtering}
        activeCount={activeFilterCount + (sortActive ? 1 : 0)}
        onReset={resetFilters}
        sort={{
          options: sortOptions,
          value: sortBy,
          dir: sortDir,
          supportsDir: true,
          onChange: ({ key, dir }) => {
            setSortBy(key);
            setSortDir(dir);
          },
        }}
        sections={filterSections}
        view={{
          columns: gridColumns,
          onColumns: changeGridColumns,
          radius: posterRadius,
          onRadius: changePosterRadius,
          posterInfo: listPosterInfo,
          onPosterInfo: changeListPosterInfo,
          showAddedBy: false,
        }}
      />

      {/* ── İzleme tarihi — global aramadan izlenenler listesine ekleme ── */}
      <DatePickerModal
        visible={datePickerVisible}
        value={todayListDate()}
        onConfirm={confirmWatchDate}
        onClose={closeDatePicker}
        title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
        subtitle={
          listName === "watchedTv"
            ? i18nText(
                "autoI18n.tum_bolumler_bu_tarihle",
                "Tüm bölümler bu tarihle izlendi işaretlenecek",
              )
            : i18nText(
                "autoI18n.bu_filmi_ne_zaman_izlediniz",
                "Bu filmi ne zaman izlediniz?",
              )
        }
        confirmLabel={i18nText("autoI18n.tarihi_onayla", "Tarihi Onayla")}
        maxDate={new Date()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //paddingTop: 0,
    paddingHorizontal: 0,
    alignItems: "center",
    // flex-start ZORUNLU: "center" iken içerik kısa olduğunda (boş liste,
    // yükleme iskeleti, iki öğelik liste) TÜM sütun dikeyde ortalanıyor ve
    // başlık ile arama çubuğu ekranın ortasına kayıyordu — liste doldukça
    // yukarı zıplıyorlardı. Ayrıca içerik ekrandan uzun olduğunda "center"
    // taşmayı iki uca bölüştürdüğü için ÜST kırpılıyordu. Başlık ve arama
    // çubuğu artık her durumda aynı yerde duruyor.
    justifyContent: "flex-start",
  },
  headerRow: {
    width: "100%",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  headerSide: { width: 40, height: 40 },
  header: {
    flex: 1,
    fontWeight: "bold",
    fontSize: 22,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  // Arama satırı ve kip seçici components/lists/ListSearchBar.js'te.
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyWrap: {
    // Kapsayıcı artık flex-start olduğu için boş durum blokunun kalan alanı
    // kendisi kaplaması gerekiyor; aksi halde arama çubuğuna yapışıp altında
    // koca bir boşluk bırakırdı. Böylece başlık/arama üstte SABİT kalırken
    // "Bu liste boş" mesajı eskisi gibi ortada durur.
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  noMatchWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 40,
    width: width - GRID_SIDE_PADDING * 2,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCtaText: { color: "#fff", fontSize: 13, fontWeight: "700" },


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
  imageReorder: {
    width: 68,
    height: 102,
    borderRadius: 12,
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
  },
  heroRow: { flexDirection: "row", gap: 14 },
  heroPoster: {
    width: 96,
    height: 144,
    borderRadius: 14,
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
    // Üstüne bindirilen sezon adı/bölüm sayısı okunsun diye yüksek gölge
    height: "55%",
  },
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
  // Poster üstü bilgi satırı: solda sezon adı, sağda izlenen/toplam bölüm
  seasonOverlay: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  seasonName: { flex: 1, color: "#fff", fontSize: 10, fontWeight: "700" },
  seasonEpText: { fontSize: 9, fontWeight: "800" },

  // Interactive Segmented Buttons
});

// ── Sıralama & filtreleme modalı stilleri ──────────────────────────────────
