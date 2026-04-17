import React, { useCallback, useState, useRef, useEffect, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
  Keyboard,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SearchSkeleton } from "../../components/Skeleton";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import LottieView from "lottie-react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useFocusEffect } from "@react-navigation/native";
import IconBacground from "../../components/IconBacground";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// Grid: 3 sütun
const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_HPAD = 16;
const GRID_ITEM_W =
  (width - GRID_HPAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_ITEM_H = GRID_ITEM_W * 1.52;

// Row poster boyutu
const ROW_PHOTO_W = 80;
const ROW_PHOTO_H = 120;

// ─── Popülerlik rengi ─────────────────────────────────────────────────────────
const getPopularityColor = (p) => {
  if (p >= 100) return "#29b864";
  if (p >= 30) return "#f5c518";
  if (p >= 10) return "#ff6400";
  return "#eb3737";
};

// ─── Basma animasyonu hook'u ──────────────────────────────────────────────────
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

// ─── Giriş animasyonu hook'u ──────────────────────────────────────────────────
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
const ActorRowItem = memo(
  ({ item, navigation, imageQuality, theme, index }) => {
    const { scale, onIn, onOut } = usePressAnim();
    const { opacity, translateY } = useEnterAnim(index);
    const popularity = item.popularity ?? 0;
    const popColor = getPopularityColor(popularity);
    const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;

    const knownForMovies = (item.known_for || [])
      .filter((k) => k.poster_path)
      .slice(0, 3);

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
            navigation.navigate("ActorViewScreen", { personId: item.id });
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
            {/* Fotoğraf */}
            {item.profile_path ? (
              <View style={styles.rowPhotoWrapper}>
                <Image
                  source={{ uri: `${IMAGE_URL}${item.profile_path}` }}
                  style={styles.rowPhoto}
                />
              </View>
            ) : (
              <View
                style={[styles.rowNoPhoto, { backgroundColor: theme.primary }]}
              >
                <FontAwesome
                  name="user"
                  size={36}
                  color={theme.text?.muted ?? "#555"}
                />
              </View>
            )}

            {/* Bilgiler */}
            <View style={styles.rowInfo}>
              <Text
                style={[
                  styles.rowName,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
                numberOfLines={1}
              >
                {item.name || "—"}
              </Text>
              <Text
                style={[
                  styles.rowDept,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {item.known_for_department || "Oyuncu"}
              </Text>
              {popularity > 0 && (
                <View style={styles.rowPopRow}>
                  <View
                    style={[
                      styles.popPill,
                      {
                        backgroundColor: popColor + "22",
                        borderColor: popColor + "55",
                      },
                    ]}
                  >
                    <Ionicons name="flame" size={11} color={popColor} />
                    <Text style={[styles.popText, { color: popColor }]}>
                      {" "}
                      {popularity.toFixed(0)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Bilinen filmler — küçük posterler */}
            {knownForMovies.length > 0 && (
              <View style={styles.knownForWrapper}>
                {knownForMovies.map((k, i) => (
                  <Image
                    key={i}
                    source={{ uri: `${IMAGE_URL}${k.poster_path}` }}
                    style={styles.knownPoster}
                  />
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ─── GRID KART ────────────────────────────────────────────────────────────────
const ActorGridItem = memo(
  ({ item, navigation, imageQuality, theme, index }) => {
    const { scale, onIn, onOut } = usePressAnim();
    const { opacity, translateY } = useEnterAnim(index);
    const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;

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
            navigation.navigate("ActorViewScreen", { personId: item.id });
          }}
        >
          <View style={styles.gridCard}>
            {item.profile_path ? (
              <Image
                source={{ uri: `${IMAGE_URL}${item.profile_path}` }}
                style={styles.gridPhoto}
              />
            ) : (
              <View
                style={[
                  styles.gridNoPhoto,
                  { backgroundColor: theme.secondary },
                ]}
              >
                <FontAwesome
                  name="user"
                  size={32}
                  color={theme.text?.muted ?? "#555"}
                />
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.92)"]}
              locations={[0.35, 1]}
              style={styles.gridGradient}
            />
            <View style={styles.gridFooter}>
              <Text style={styles.gridName} numberOfLines={2}>
                {item.name || "—"}
              </Text>
              {item.known_for_department && (
                <Text style={styles.gridDept}>{item.known_for_department}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ─── Keşfet Bölümü ────────────────────────────────────────────────────────────
const DiscoverSection = memo(
  ({ navigation, imageQuality, theme, language, API_KEY, viewMode }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [popular, setPopular] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loadingDiscover, setLoading] = useState(true);
    const tabAnim = useRef(new Animated.Value(0)).current;
    const TABS = ["Popüler", "Trend"];
    const TAB_W = (width - 32) / 2;

    useEffect(() => {
      const fetchAll = async () => {
        try {
          const lang = language === "tr" ? "tr-TR" : "en-US";
          const headers = { Authorization: API_KEY };
          const [pop, trend] = await Promise.all([
            axios.get("https://api.themoviedb.org/3/person/popular", {
              params: { language: lang, page: 1 },
              headers,
            }),
            axios.get("https://api.themoviedb.org/3/trending/person/week", {
              params: { language: lang },
              headers,
            }),
          ]);
          setPopular(
            pop.data.results
              .filter((p) => p.known_for_department === "Acting")
              .slice(0, 18),
          );
          setTrending(
            trend.data.results
              .filter((p) => p.known_for_department === "Acting")
              .slice(0, 18),
          );
        } catch (e) {
          console.error("Actor discover fetch:", e);
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

    const renderGridItem = useCallback(
      ({ item, index }) => (
        <ActorGridItem
          item={item}
          navigation={navigation}
          imageQuality={imageQuality}
          theme={theme}
          index={index}
        />
      ),
      [navigation, imageQuality, theme],
    );

    const activeData = [popular, trending][activeTab];

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
                      inputRange: [0, 1],
                      outputRange: [4, TAB_W + 4],
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
          <FlatList
            key={`row-${activeTab}`}
            data={activeData}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.discoverRowList}
            renderItem={({ item, index }) => (
              <View style={styles.discoverRowItem}>
                <ActorRowItem
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

// ─── Son Arama Chip'i ─────────────────────────────────────────────────────────
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

// ─── Layout Toggle ────────────────────────────────────────────────────────────
const LayoutToggle = memo(({ viewMode, onToggle, theme }) => {
  const toggle = useCallback(() => {
    onToggle(viewMode === "row" ? "grid" : "row");
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
export default function ActorSearch({ navigation, route }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSearch, setLastSearch] = useState([]);
  const [viewMode, setViewMode] = useState("row");

  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const { API_KEY, adultContent, imageQuality } = useAppSettings();
  const searchTimeout = useRef(null);
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
      if (route.params?.autoFocus)
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [route.params]),
  );

  const handleSearch = useCallback((text) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim() === "") {
      setResults([]);
      setLoading(false);
    } else if (text.trim().length >= 2) {
      setLoading(true);
      searchTimeout.current = setTimeout(() => fetchResults(text), 500);
    }
  }, []);

  const fetchResults = useCallback(
    async (searchText) => {
      if (!searchText) {
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          "https://api.themoviedb.org/3/search/person",
          {
            params: {
              query: searchText,
              include_adult: adultContent,
              language: language === "tr" ? "tr-TR" : "en-US",
              page: "1",
            },
            headers: { Authorization: API_KEY },
          },
        );
        const sorted = response.data.results
          .filter((p) => p.known_for_department === "Acting")
          .sort((a, b) => b.popularity - a.popularity);
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
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [language, adultContent, API_KEY],
  );

  const handleToggleView = useCallback((next) => setViewMode(next), []);

  const renderRowResult = useCallback(
    ({ item, index }) => (
      <ActorRowItem
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
      <ActorGridItem
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
          source={require("../../LottieJson/search_notfound.json")}
          autoPlay
          loop
        />
        <Text
          style={[styles.emptyHint, { color: theme.text?.secondary ?? "#aaa" }]}
        >
          "{search}" için sonuç bulunamadı
        </Text>
      </View>
    ),
    [search, theme],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <IconBacground opacity={0.3} />

      {/* ── Başlık ─────────────────────────────────────────────────────── */}
      <Animated.Text
        style={[
          styles.pageTitle,
          { color: theme.text?.primary ?? "#fff" },
          titleStyle,
        ]}
      >
        {t.SearchScreen?.searchActrist ?? "Oyuncu Ara"}
      </Animated.Text>

      {/* ── Arama Kutusu + Toggle ──────────────────────────────────────── */}
      <Animated.View style={[styles.searchRow, searchBarStyle]}>
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
            placeholder={t.SearchScreen?.searchActrist ?? "Oyuncu ara..."}
            placeholderTextColor={theme.text?.muted ?? "#666"}
            value={search}
            onChangeText={handleSearch}
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
        <LayoutToggle
          viewMode={viewMode}
          onToggle={handleToggleView}
          theme={theme}
        />
      </Animated.View>

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
        <DiscoverSection
          navigation={navigation}
          imageQuality={imageQuality}
          theme={theme}
          language={language}
          API_KEY={API_KEY}
          viewMode={viewMode}
        />
      ) : viewMode === "grid" ? (
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },

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

  layoutToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  // ── Son aramalar ──────────────────────────────────────────────────────────
  chipsWrapper: { marginBottom: 4 },
  chipsList: { paddingHorizontal: 16, alignItems: "center", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  // ── ROW KART ──────────────────────────────────────────────────────────────
  rowList: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },
  rowCard: {
    height: 120,
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  rowPhotoWrapper: {
    width: ROW_PHOTO_W,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  rowPhoto: {
    width: ROW_PHOTO_W,
    height: ROW_PHOTO_H,
    borderRadius: 16,
    marginTop: -(ROW_PHOTO_H - 120) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  rowNoPhoto: {
    width: ROW_PHOTO_W + 8,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  rowInfo: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 14,
    justifyContent: "center",
    gap: 4,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  rowDept: { fontSize: 12 },
  rowPopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  popPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  popText: { fontSize: 11, fontWeight: "600" },

  // Bilinen filmler — sağ taraf
  knownForWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingRight: 10,
    paddingVertical: 10,
  },
  knownPoster: {
    width: 48,
    height: 72,
    borderRadius: 6,
    backgroundColor: "#222",
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
  gridPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: "cover",
  },
  gridNoPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  gridGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  gridFooter: {
    padding: 8,
    gap: 2,
  },
  gridName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  gridDept: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
  },

  // ── Discover ──────────────────────────────────────────────────────────────
  discoverWrapper: { flex: 1 },
  discoverLoadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  discoverRowList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
  },
  discoverRowItem: { marginBottom: 12 },

  // ── Tab çubuğu ────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    height: 44,
    position: "relative",
    overflow: "hidden",
  },
  tabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 10,
  },
  tabBtn: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: "500" },

  // ── Ortak ─────────────────────────────────────────────────────────────────
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyHint: { fontSize: 14, textAlign: "center", marginTop: 8 },
  errorText: { fontSize: 14, textAlign: "center", marginTop: 12 },

  // Rating/puan pill (rowCard'da kullanılır)
  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  ratingText: { fontSize: 12, fontWeight: "600" },
  voteCount: { fontSize: 11 },
});
