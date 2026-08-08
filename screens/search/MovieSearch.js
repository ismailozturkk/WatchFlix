import { Image } from "expo-image";
import React, { useCallback, useState, useRef, useEffect, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
  Keyboard
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SearchSkeleton } from "../../components/Skeleton";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import { useAppSettings, useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useFocusEffect } from "@react-navigation/native";
import ListBadges from "../../components/ListBadges";
import { SafeAreaView } from "react-native-safe-area-context";
import IconBacground from "../../components/IconBacground";
import { LinearGradient } from "expo-linear-gradient";
import { i18nText } from "../../utils/i18nText";
import { searchMediaWithFuzzyFallback } from "../../services/fuzzyMediaSearch";
import ScreenSnow from "../../components/ScreenSnow";


const { width } = Dimensions.get("window");

// Poster grid: 3 sütun, eşit boşluklar
const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_HPAD = 16;
const GRID_ITEM_W =
  (width - GRID_HPAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_ITEM_H = GRID_ITEM_W * 1.52;

// Row kart poster boyutu
const ROW_POSTER_W = 100;
const ROW_POSTER_H = 152;

// ─── Yardımcı: puan rengi ─────────────────────────────────────────────────────
const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

// ─── Ortak basma animasyonu hook'u ────────────────────────────────────────────
const usePressAnim = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 0.95,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }).start(),
    [],
  );
  const onOut = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 1,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }).start(),
    [],
  );
  return { scale, onIn, onOut };
};

// ─── Ortak giriş animasyonu hook'u ───────────────────────────────────────────
const useEnterAnim = (index) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    const delay = Math.min(index * 55, 380);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 14,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, translateY };
};
// ─── ROW KART ─────────────────────────────────────────────────────────────────
const MovieRowItem = memo(
  ({ item, navigation, imageQuality, theme, index }) => {
    const { getTmdbUrl } = useImageQualitySettings();
    const { posterBadges } = useListLayoutSettings();
    const { scale, onIn, onOut } = usePressAnim();
    const { opacity, translateY } = useEnterAnim(index);
    const rating = item.vote_average ?? 0;
    const ratingColor = getRatingColor(rating);

    return (
      <Animated.View
        style={{ opacity, transform: [{ translateY }, { scale }] }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onIn}
          onPressOut={onOut}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate("MovieDetails", { id: item.id });
          }}
        >
          <View
            style={[
              styles.rowCard,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            {/* Backdrop */}
            {item.backdrop_path && (
              <>
                <Image
                  source={{
                    uri: getTmdbUrl(item.backdrop_path, 'poster', 200),
                  }}
                  style={styles.rowBackdrop}
                />
                <LinearGradient
                  colors={["rgba(0,0,0,0)", theme.secondary]}
                  start={{ x: 0.25, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                />
              </>
            )}
            {/* Poster */}
            {item.poster_path ? (
              <View style={styles.rowPosterWrapper}>
                <Image
                  source={{
                    uri: getTmdbUrl(item.poster_path, 'poster', 200),
                  }}
                  style={styles.rowPoster}
                />
              </View>
            ) : (
              <View
                style={[styles.rowNoPoster, { backgroundColor: theme.primary }]}
              >
                <Ionicons
                  name="film-outline"
                  size={32}
                  color={theme.text?.muted ?? "#555"}
                />
              </View>
            )}
            {/* Bilgiler */}
            <View style={styles.rowInfo}>
              <Text
                style={[
                  styles.rowTitle,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
                numberOfLines={2}
              >
                {item.title || i18nText("autoI18n.isimsiz", "İsimsiz")}
              </Text>
              {posterBadges?.releaseDate !== false && (
                <Text
                  style={[
                    styles.rowYear,
                    { color: theme.text?.secondary ?? "#aaa" },
                  ]}
                >
                  {item.release_date
                    ? new Date(item.release_date).getFullYear()
                    : "—"}
                </Text>
              )}
              {(posterBadges?.tmdbRating !== false || posterBadges?.voteCount !== false) && rating > 0 && (
                <View style={styles.rowRatingRow}>
                  {posterBadges?.tmdbRating !== false && (
                    <View
                      style={[
                        styles.ratingPill,
                        {
                          backgroundColor: ratingColor + "22",
                          borderColor: ratingColor + "55",
                        },
                      ]}
                    >
                      <Text style={[styles.ratingText, { color: ratingColor }]}>
                        ★ {rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {posterBadges?.voteCount !== false && item.vote_count > 0 && (
                    <Text
                      style={[
                        styles.voteCount,
                        { color: theme.text?.secondary ?? "#aaa" },
                      ]}
                    >
                      {item.vote_count >= 1000
                        ? `${(item.vote_count / 1000).toFixed(1)}K oy`
                        : `${item.vote_count} oy`}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {/* Rozetler */}
            <ListBadges
              mediaId={item.id}
              mediaType="movie"
              theme={theme}
              variant="chip"
              vertical
              iconSize={8}
              chipSize={15}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ─── GRID POSTER KART ─────────────────────────────────────────────────────────
const MovieGridItem = memo(
  ({ item, navigation, imageQuality, theme, index }) => {
    const { getTmdbUrl } = useImageQualitySettings();
    const { posterBadges } = useListLayoutSettings();
    const { scale, onIn, onOut } = usePressAnim();
    const { opacity, translateY } = useEnterAnim(index);
    const rating = item.vote_average ?? 0;
    const ratingColor = getRatingColor(rating);

    return (
      <Animated.View
        style={{ opacity, transform: [{ translateY }, { scale }] }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onIn}
          onPressOut={onOut}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate("MovieDetails", { id: item.id });
          }}
        >
          <View style={styles.gridCard}>
            {/* Poster */}
            {item.poster_path ? (
              <Image
                source={{
                  uri: getTmdbUrl(item.poster_path, 'poster', 200),
                }}
                style={styles.gridPoster}
              />
            ) : (
              <View
                style={[
                  styles.gridNoPoster,
                  { backgroundColor: theme.secondary },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={24}
                  color={theme.text?.muted ?? "#555"}
                />
              </View>
            )}
            {/* Puan rozeti – sağ üst */}
            {posterBadges?.tmdbRating !== false && rating > 0 && (
              <View
                style={[
                  styles.gridRatingBadge,
                  { backgroundColor: ratingColor + "ee" },
                ]}
              >
                <Text style={styles.gridRatingText}>★ {rating.toFixed(1)}</Text>
              </View>
            )}
            <ListBadges
              mediaId={item.id}
              mediaType="movie"
              theme={theme}
              variant="chip"
              vertical
              side="left"
              verticalAlign="bottom"
              iconSize={8}
              chipSize={15}
              style={styles.gridBadgeColumn}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ─── Keşfet Bölümü (arama boşken) ────────────────────────────────────────────
const DiscoverSection = memo(
  ({ navigation, imageQuality, theme, language, API_KEY, viewMode }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [popular, setPopular] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [topRated, setTopRated] = useState([]);
    const [loadingDiscover, setLoading] = useState(true);
    const tabAnim = useRef(new Animated.Value(0)).current;
    const TABS = [i18nText("autoI18n.populer", "Popüler"), i18nText("autoI18n.yakinda", "Yakında"), i18nText("autoI18n.en_iyi", "En İyi")];
    const TAB_W = (width - 32) / 3;

    useEffect(() => {
      const fetchAll = async () => {
        try {
          const lang = language === "tr" ? "tr-TR" : "en-US";
          const headers = { Authorization: API_KEY };
          const [pop, up, top] = await Promise.all([
            axios.get("https://api.themoviedb.org/3/movie/popular", {
              params: { language: lang, page: 1 },
              headers,
            }),
            axios.get("https://api.themoviedb.org/3/movie/upcoming", {
              params: { language: lang, page: 1 },
              headers,
            }),
            axios.get("https://api.themoviedb.org/3/movie/top_rated", {
              params: { language: lang, page: 1 },
              headers,
            }),
          ]);
          setPopular(pop.data.results.slice(0, 18));
          setUpcoming(up.data.results.slice(0, 18));
          setTopRated(top.data.results.slice(0, 18));
        } catch (e) {
          console.error("Discover fetch:", e);
        } finally {
          setLoading(false);
        }
      };
      fetchAll();
    }, [language, API_KEY]);

    const switchTab = useCallback(
      (i) => {
        setActiveTab(i);
        Animated.spring(tabAnim, {
          toValue: i,
          speed: 16,
          bounciness: 5,
          useNativeDriver: true,
        }).start();
      },
      [tabAnim],
    );

    // ⚠️ Tüm hook'lar erken return'den ÖNCE — Rules of Hooks
    const renderGridItem = useCallback(
      ({ item, index }) => (
        <MovieGridItem
          item={item}
          navigation={navigation}
          imageQuality={imageQuality}
          theme={theme}
          index={index}
        />
      ),
      [navigation, imageQuality, theme],
    );

    const renderRowItem = useCallback(
      ({ item, index }) => (
        <MovieRowItem
          item={item}
          navigation={navigation}
          imageQuality={imageQuality}
          theme={theme}
          index={index}
        />
      ),
      [navigation, imageQuality, theme],
    );

    const activeData = [popular, upcoming, topRated][activeTab];

    if (loadingDiscover) {
      return (
        <View style={styles.discoverLoadingBox}>
          <ActivityIndicator size="small" color={theme.text?.muted ?? "#666"} />
        </View>
      );
    }

    return (
      <View style={styles.discoverWrapper}>
        {/* Sekme çubuğu */}
        <View style={[styles.tabBar, { backgroundColor: theme.secondary }]}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: TAB_W - 8,
                backgroundColor: theme.primary,
                transform: [
                  {
                    translateX: tabAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [4, TAB_W + 4, TAB_W * 2 + 4],
                    }),
                  },
                ],
              },
            ]}
          />
          {TABS.map((label, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.tabBtn, { width: TAB_W }]}
              onPress={() => switchTab(i)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      activeTab === i
                        ? (theme.text?.primary ?? "#fff")
                        : (theme.text?.secondary ?? "#aaa"),
                  },
                  activeTab === i && { fontWeight: "700" },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid modu */}
        {viewMode === "grid" ? (
          <FlatList
            key={`grid-${activeTab}`}
            data={activeData}
            keyExtractor={(item) => item.id.toString()}
            numColumns={GRID_COLS}
            renderItem={renderGridItem}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          /*  */
          <FlatList
            key={`row-${activeTab}`}
            data={activeData}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.discoverRowList}
            renderItem={({ item, index }) => (
              <View style={styles.discoverRowItem}>
                <MovieRowItem
                  item={item}
                  navigation={navigation}
                  imageQuality={imageQuality}
                  theme={theme}
                  index={index}
                />
              </View>
            )}
          />
        )}
      </View>
    );
  },
);

// ─── Son Arama Rozeti ─────────────────────────────────────────────────────────
const RecentChip = memo(({ label, onPress, theme }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.chip, { backgroundColor: theme.secondary }]}>
      <Ionicons
        name="time-outline"
        size={12}
        color={theme.text?.secondary ?? "#aaa"}
        style={{ marginRight: 5 }}
      />
      <Text style={[styles.chipText, { color: theme.text?.primary ?? "#fff" }]}>
        {label}
      </Text>
    </View>
  </TouchableOpacity>
));

// ─── Layout Toggle Butonu ─────────────────────────────────────────────────────
const LayoutToggle = memo(({ viewMode, onToggle, theme }) => {
  const anim = useRef(new Animated.Value(viewMode === "grid" ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const next = viewMode === "row" ? "grid" : "row";
    Animated.spring(anim, {
      toValue: next === "grid" ? 1 : 0,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onToggle(next);
  }, [viewMode, onToggle]);

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      style={[styles.layoutToggleBtn, { backgroundColor: theme.secondary }]}
    >
      <Ionicons
        name={viewMode === "row" ? "grid-outline" : "list-outline"}
        size={18}
        color={theme.text?.primary ?? "#fff"}
      />
    </TouchableOpacity>
  );
});

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function MovieSearch({ navigation, route, isUnified, unifiedQuery, unifiedViewMode }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSearch, setLastSearch] = useState([]);
  const [internalViewMode, setInternalViewMode] = useState("row"); // "row" | "grid"
  const viewMode = isUnified && unifiedViewMode ? unifiedViewMode : internalViewMode;
  
  const Container = isUnified ? View : SafeAreaView;

  const handleToggleView = useCallback(() => {
    setInternalViewMode((prev) => (prev === "row" ? "grid" : "row"));
  }, []);

  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const { API_KEY, adultContent, imageQuality } = useAppSettings();
  const searchTimeout = useRef(null);
  const searchRequestRef = useRef(0);
  const inputRef = useRef(null);

  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.autoFocus)
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [route?.params]),
  );

  useEffect(() => {
    if (isUnified && unifiedQuery !== undefined) {
      handleSearch(unifiedQuery);
    }
  }, [unifiedQuery, isUnified]);

  const routeName = route?.params?.name;
  useEffect(() => {
    if (routeName) {
      setSearch(routeName);
      fetchResults(routeName);
    }
  }, [routeName]);

  const fetchResults = useCallback(
    async (searchText) => {
      if (!searchText) {
        setLoading(false);
        return;
      }
      const requestId = ++searchRequestRef.current;
      try {
        const { results: foundResults, usedFuzzyFallback } =
          await searchMediaWithFuzzyFallback({
            mediaType: "movie",
            query: searchText,
            adultContent,
            language: language === "tr" ? "tr-TR" : "en-US",
            API_KEY,
          });
        if (requestId !== searchRequestRef.current) return;
        const sorted = usedFuzzyFallback
          ? foundResults
          : [...foundResults].sort((a, b) => b.vote_count - a.vote_count);
        setResults(sorted);
        setError(null);
        setLastSearch((prev) => {
          const updated = [searchText, ...prev];
          const filtered = updated.filter(
            (s, i, arr) =>
              arr.findIndex(
                (x) =>
                  x.toLowerCase().includes(s.toLowerCase()) ||
                  s.toLowerCase().includes(x.toLowerCase()),
              ) === i,
          );
          return filtered.slice(0, 5);
        });
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;
        setError(err.message);
        Toast.show({ type: "error", text1: i18nText("autoI18n.hata_2", "Hata: ") + err.message });
      } finally {
        if (requestId === searchRequestRef.current) setLoading(false);
      }
    },
    [language, adultContent, API_KEY],
  );

  // NOT: handleSearch, fetchResults'tan SONRA tanımlı olmalı — bağımlılık dizisi
  // render sırasında değerlendiği için yukarıda tanımlanırsa fetchResults
  // okunamaz. Boş deps ile bırakılırsa ilk render'ın fetchResults'ı kalıcı
  // olarak kapanıyor ve dil / yetişkin içerik ayarı değişse bile debounce'lu
  // yazma yolu eski değerlerle istek atmaya devam ediyordu.
  const handleSearch = useCallback(
    (text) => {
      searchRequestRef.current += 1;
      setSearch(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (text.trim().length >= 2) {
        setError(null);
        setLoading(true);
        searchTimeout.current = setTimeout(() => fetchResults(text), 500);
      } else {
        // Boş veya 1 karakter: bekleyen istek iptal edildi. loading/error'ı
        // burada sıfırlamazsak ekran skeleton'da ya da eski hatada takılı kalır
        // (2+ karakterden geri silme senaryosu).
        setResults([]);
        setLoading(false);
        setError(null);
      }
    },
    [fetchResults],
  );

  // Arama sonuçları renderlar
  const renderRowResult = useCallback(
    ({ item, index }) => (
      <MovieRowItem
        item={item}
        navigation={navigation}
        imageQuality={imageQuality}
        theme={theme}
        index={index}
      />
    ),
    [navigation, imageQuality, theme],
  );

  const renderGridResult = useCallback(
    ({ item, index }) => (
      <MovieGridItem
        item={item}
        navigation={navigation}
        imageQuality={imageQuality}
        theme={theme}
        index={index}
      />
    ),
    [navigation, imageQuality, theme],
  );

  const titleStyle = {
    opacity: titleAnim,
    transform: [
      {
        translateY: titleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 0],
        }),
      },
    ],
  };
  const searchBarStyle = {
    opacity: searchBarAnim,
    transform: [
      {
        translateY: searchBarAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const EmptySearch = useCallback(
    () => (
      <View style={styles.centerBox}>
        <LottieView
          style={{ width: 280, height: 280 }}
          source={require("@lottie/search_notfound.json")}
          autoPlay
          loop
        />
        <Text
          style={[styles.emptyHint, { color: theme.text?.secondary ?? "#aaa" }]}
        >
          "{search}{i18nText("autoI18n.icin_sonuc_bulunamadi", "\" için sonuç bulunamadı")}</Text>
      </View>
    ),
    [search, theme],
  );

  return (
    <Container
      style={[styles.container, !isUnified && { backgroundColor: theme.primary }]}
    >
      {!isUnified && <IconBacground opacity={0.3} />}
      <ScreenSnow />

      {/* ── Başlık ─────────────────────────────────────────────────────── */}
      {!isUnified && <Animated.Text
        style={[
          styles.pageTitle,
          { color: theme.text?.primary ?? "#fff" },
          titleStyle,
        ]}
      >
        {t.SearchScreen?.searchMovies ?? i18nText("autoI18n.film_ara", "Film Ara")}
      </Animated.Text>}

      {/* ── Arama Kutusu + Toggle ──────────────────────────────────────── */}
      {!isUnified && <Animated.View style={[styles.searchRow, searchBarStyle]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.secondary, flex: 1 },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={theme.text?.muted ?? "#666"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={inputRef}
            style={[
              styles.searchInput,
              { color: theme.text?.primary ?? "#fff" },
            ]}
            placeholder={t.SearchScreen?.searchMovies ?? i18nText("autoI18n.film_ara_2", "Film ara...")}
            placeholderTextColor={theme.text?.muted ?? "#666"}
            value={search}
            onChangeText={handleSearch}
            maxLength={80}
            returnKeyType="search"
            onSubmitEditing={() =>
              search.trim().length >= 2 && fetchResults(search)
            }
          />
          {loading ? (
            <ActivityIndicator
              size="small"
              color={theme.text?.muted ?? "#666"}
            />
          ) : search.length > 0 ? (
            <TouchableOpacity
              onPress={() => handleSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.text?.muted ?? "#666"}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Layout toggle butonu */}
        <LayoutToggle
          viewMode={viewMode}
          onToggle={handleToggleView}
          theme={theme}
        />
      </Animated.View>}

      {/* ── Son Aramalar ───────────────────────────────────────────────── */}
      {lastSearch.length > 0 && (
        <Animated.View style={[styles.chipsWrapper, searchBarStyle]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsList}
          >
            {lastSearch.map((s, i) => (
              <RecentChip
                key={i}
                label={s}
                onPress={() => handleSearch(s)}
                theme={theme}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── İçerik ────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.centerBox}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.text?.muted ?? "#555"}
          />
          <Text
            style={[
              styles.errorText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {error}
          </Text>
        </View>
      ) : loading ? (
        <SearchSkeleton />
      ) : search === "" ? (
        /* Keşfet bölümü — viewMode prop ile grid/row bilgisini alıyor */
        <DiscoverSection
          navigation={navigation}
          imageQuality={imageQuality}
          theme={theme}
          language={language}
          API_KEY={API_KEY}
          viewMode={viewMode}
        />
      ) : viewMode === "grid" ? (
        /* Arama sonuçları — GRID */
        <FlatList
          key="search-grid"
          data={results}
          keyExtractor={(item) => item.id.toString()}
          numColumns={GRID_COLS}
          renderItem={renderGridResult}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={search.length > 1 ? <EmptySearch /> : null}
        />
      ) : (
        /* Arama sonuçları — ROW */
        <FlatList
          key="search-row"
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRowResult}
          contentContainerStyle={styles.rowList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={search.length > 1 ? <EmptySearch /> : null}
        />
      )}
    </Container>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop:10 },

  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 14,
    marginTop: 4,
  },

  // ── Arama satırı ──────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 16,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },

  // Layout toggle
  layoutToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  // ── Son aramalar ──────────────────────────────────────────────────────────
  chipsWrapper: { marginBottom: 10 },
  chipsList: { paddingHorizontal: 16, alignItems: "center", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  // ── ROW KART ─────────────────────────────────────────────────────────────
  rowList: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 30,
  },
  rowCard: {
    height: 130,
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 26,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  rowBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.28,
    borderRadius: 16,
    contentFit: "cover",
  },
  rowPosterWrapper: {
    width: ROW_POSTER_W + 8,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  rowPoster: {
    width: ROW_POSTER_W,
    height: ROW_POSTER_H,
    borderRadius: 12,
    marginTop: -(ROW_POSTER_H - 130) / 2,
    marginLeft: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  rowNoPoster: {
    width: ROW_POSTER_W + 8,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  rowInfo: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 12,
    justifyContent: "center",
    gap: 5,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  rowYear: { fontSize: 13 },
  rowRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },

  // ── GRID KART ─────────────────────────────────────────────────────────────
  gridList: { paddingHorizontal: GRID_HPAD, paddingTop: 8, paddingBottom: 30 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCard: {
    width: GRID_ITEM_W,
    height: GRID_ITEM_H,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    justifyContent: "flex-end",
    backgroundColor: "#111",
  },
  gridPoster: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    contentFit: "cover",
  },
  gridNoPoster: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  gridRatingBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridRatingText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  gridBadgeColumn: { left: 3, bottom: 4 },

  // ── Paylaşılan ────────────────────────────────────────────────────────────
  ratingPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  ratingText: { fontSize: 12, fontWeight: "700" },
  voteCount: { fontSize: 11 },

  // ── Keşfet ────────────────────────────────────────────────────────────────
  discoverWrapper: { flex: 1 },
  discoverLoadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  discoverRowList: { paddingHorizontal: 16, gap: 12, paddingVertical: 20 },
  discoverRowItem: { width: width * 0.92 },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
    position: "relative",
    height: 42,
    alignItems: "center",
  },
  tabIndicator: {
    position: "absolute",
    height: 34,
    borderRadius: 10,
    top: 4,
    left: 0,
  },
  tabBtn: {
    justifyContent: "center",
    alignItems: "center",
    height: 34,
    zIndex: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: "500" },

  // ── Boş / Hata ────────────────────────────────────────────────────────────
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 20,
  },
  errorText: { fontSize: 14, textAlign: "center", marginTop: 12 },
  emptyHint: { fontSize: 14, textAlign: "center", marginTop: -10 },
});
