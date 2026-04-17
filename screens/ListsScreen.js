import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import SwipeCard from "../modules/SwipeCard";
import { BlurView } from "expo-blur";
import { useAppSettings } from "../context/AppSettingsContext";
import CaseOpeningModal from "../components/CaseOpeningModal";
import Feather from "@expo/vector-icons/Feather";
const { width, height } = Dimensions.get("window");
export default function ListsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { listName } = route.params;
  const [listItems, setListItems] = useState([]);
  const [listModalItems, setListModalItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); // Arama için state
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [reorderItems, setReorderItems] = useState(null);
  const [randomModalVisible, setRandomModalVisible] = useState(false);
  const [filterType, setFilterType] = useState("mixed");
  // Gesture tracking removed in favor of a cleaner 3-way segmented toggle.
  const [value, setValue] = useState("");
  const { imageQuality } = useAppSettings();

  const handleChange = (text) => {
    // Sadece rakamları al
    const numericValue = text.replace(/[^0-9]/g, "");
    setValue(numericValue - 1);
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
    const newScaleValues = {};
    if (listItems && listItems.length > 0) {
      listItems.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
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
    if (!user.uid || !listName) return;
    setIsLoading(true);
    const docRef = doc(db, "Lists", user.uid);

    // Firestore'dan veriyi dinamik olarak çek
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setListItems(data[listName] || []);
      } else {
        setListItems([]);
      }
    });
    setIsLoading(false);
    return () => unsubscribe();
  }, [user.uid, listName]);

  const reorderWatchedTv = async (fromIndex, toIndex, listName) => {
    try {
      const docRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn("Belge bulunamadı.");
        return;
      }

      const data = docSnap.data();
      let listReorder = data[listName] || [];

      if (
        fromIndex < 0 ||
        fromIndex >= listReorder.length ||
        toIndex < 0 ||
        toIndex >= listReorder.length
      ) {
        Toast.show({
          type: "error",
          text1: `Lütfen 1 ile ${listReorder.length} arasında indeksler girin.`,
        });
        return;
      }

      const item = listReorder.splice(fromIndex, 1)[0]; // Elemanı çıkar
      listReorder.splice(toIndex, 0, item); // Yeni index'e yerleştir

      await updateDoc(docRef, { [listName]: listReorder });
      setIndex(toIndex);
      Toast.show({
        type: "success",
        text1: `${reorderItems.name} başarıyla ${toIndex + 1}. sıraya taşındı.`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: `${error.message}`,
      });
    }
  };
  // Arama filtresi
  const filteredItems = listItems
    .filter((item) =>
      (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .filter((item) => {
      if (tvShowStatus === null)
        return true; // Show all items if tvShowStatus is null
      else if (tvShowStatus === true) {
        return (
          ((Array.isArray(item.seasons)
            ? item.seasons.reduce(
                (acc, season) =>
                  acc + (season.episodes ? season.episodes.length : 0),
                0,
              )
            : 0) ===
            item.showEpisodeCount) ===
          tvShowStatus
        );
      } else {
        return (
          ((Array.isArray(item.seasons)
            ? item.seasons.reduce(
                (acc, season) =>
                  acc + (season.episodes ? season.episodes.length : 0),
                0,
              )
            : 0) ===
            item.showEpisodeCount) ===
          tvShowStatus
        );
      }
    });

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
            ? "Listede hiç film yok!"
            : selectedType === "tv"
              ? "Listede hiç dizi yok!"
              : "Liste boş, lütfen içerik ekleyiniz",
      });
      return;
    }
    setFilterType(selectedType);
    setRandomModalVisible(true);
  };

  // List counts
  const movieCount = filteredItems.filter((i) => i.type === "movie").length;
  const tvCount = filteredItems.filter((i) => i.type === "tv").length;
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.header, { color: theme.text.primary }]}
      >
        {listName == "watchedMovies"
          ? "İzlenen Filmler"
          : listName == "watchedTv"
            ? "İzlenen Diziler"
            : listName == "favorites"
              ? "Favoriler"
              : listName == "watchList"
                ? "İzlenecekler"
                : listName}
      </Text>

      {/* 15'ten fazla öğe varsa arama çubuğunu göster */}

      {isLoading ? (
        renderSkeleton()
      ) : listItems.length === 0 ? (
        <Text
          allowFontScaling={false}
          style={[styles.emptyText, { color: theme.text.muted }]}
        >
          Bu liste boş.
        </Text>
      ) : (
        <>
          {listItems.length > 12 && (
            <TextInput
              style={[
                styles.searchInput,
                { backgroundColor: theme.secondary, color: theme.text.primary },
              ]}
              placeholder="Ara..."
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          )}
          {listName == "watchList" && (
            <View style={{ marginBottom: 95, marginHorizontal: 15 }}>
              {/* Interactive 3-Way Random Selector & Stats */}
              <SwipeCard
                leftButton={{
                  label: "📺 Sadece\nDizi",
                  color: "#8847ff",
                  onPress: () => chooseRandomly("tv"),
                }}
                rightButton={{
                  label: "🎬 Sadece\nFilm",
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
                      >
                        Rastgele Ne İzlesem?
                      </Text>
                      <Text
                        style={{
                          color: "#3983e4aa",
                          fontSize: 10,
                          marginTop: 2,
                          fontWeight: "500",
                        }}
                      >
                        Karışık için bas, Dizi/Film için kaydır
                      </Text>
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
                      >
                        FİLM
                      </Text>
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
                        TOPLAM
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
                      >
                        DİZİ
                      </Text>
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
                >
                  Tümü
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
                  Bitirilen
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
                  Devam Eden
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            key={listName}
            data={filteredItems}
            initialNumToRender={12} // Başlangıçta 10 öğe yükler
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            numColumns={3}
            contentContainerStyle={{
              alignItems: "center",
              paddingBottom: 40,
            }}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPressIn={() => onPressIn(item.id)}
                onPressOut={() => onPressOut(item.id)}
                onLongPress={() => {
                  setReorderModalVisible(true);
                  const originalIndex = listItems.findIndex(
                    (i) => i.id === item.id,
                  );
                  setIndex(originalIndex);
                  setReorderItems(item);
                }}
                onPress={() => {
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
                style={styles.item}
              >
                <SwipeCard>
                  <Animated.View
                    style={[
                      {
                        margin: 3,
                        transform: [{ scale: scaleValues[item.id] || 1 }],
                      },
                      item.type === "movie"
                        ? { borderWidth: 0 }
                        : item.showEpisodeCount ===
                            (Array.isArray(item.seasons)
                              ? item.seasons.reduce(
                                  (acc, season) =>
                                    acc +
                                    (season.episodes
                                      ? season.episodes.length
                                      : 0),
                                  0,
                                )
                              : 0)
                          ? item.showEpisodeCount && {
                              borderWidth: 1, // Border kalınlığını artırdım
                              borderTopColor: theme.primary,
                              borderLeftColor: theme.primary,
                              borderRightColor: theme.primary,
                              borderBottomColor: theme.colors.green,
                              borderRadius: 11,
                            }
                          : item.showEpisodeCount && {
                              borderWidth: 1, // Border kalınlığını artırdım
                              borderTopColor: theme.primary,
                              borderLeftColor: theme.primary,
                              borderRightColor: theme.primary,
                              borderBottomColor: theme.colors.orange,

                              borderRadius: 11,
                            },
                    ]}
                  >
                    <Image
                      source={
                        item.imagePath
                          ? {
                              uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.imagePath}`,
                            }
                          : require("../assets/image/no_image.png")
                      }
                      style={styles.image}
                    />
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
                        {calculateTotalDuration(item)}
                      </Text>
                    )}
                  </Animated.View>
                </SwipeCard>
              </TouchableOpacity>
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
            : listModalItems.length > 0 && (
                <FlatList
                  data={listModalItems}
                  keyExtractor={(item) => item.id.toString()}
                  initialNumToRender={8} // Başlangıçta 10 öğe yükler
                  //windowSize={5} // Performans için pencere boyutunu ayarla
                  removeClippedSubviews={true} // Görünmeyen elemanları kaldır
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingVertical: 20,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  renderItem={({ item }) => {
                    return (
                      <View style={[styles.infoContainer, {}]}>
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
                        <TouchableOpacity
                          onPress={() => {
                            (setModalVisible(false),
                              navigation.navigate("TvShowsDetails", {
                                id: item.id,
                              }));
                          }}
                          style={styles.itemTvShow}
                        >
                          <Image
                            source={
                              item.imagePath
                                ? {
                                    uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.imagePath}`,
                                    cache: "force-cache",
                                  }
                                : require("../assets/image/no_image.png")
                            }
                            style={styles.imageSelected}
                          />
                          <Text
                            style={[
                              styles.title,
                              { color: theme.text.primary },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.detail,
                              { color: theme.text.secondary },
                            ]}
                          >
                            Sezon: {item.showSeasonCount} - Bölüm:{" "}
                            {item.showEpisodeCount}
                          </Text>
                        </TouchableOpacity>
                        <View
                          style={{ flexDirection: "column", flexShrink: 1 }}
                        >
                          <ScrollView
                            contentContainerStyle={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                            }}
                            showsVerticalScrollIndicator={false}
                          >
                            {item.seasons && item.seasons.length > 0 ? (
                              item.seasons.map((season) => (
                                <View
                                  key={season.seasonNumber}
                                  style={{
                                    padding: 3,
                                    //backgroundColor: "red",
                                  }}
                                >
                                  <TouchableOpacity
                                    onPress={() => {
                                      (setModalVisible(false),
                                        navigation.navigate("SeasonDetails", {
                                          showId: item.id,
                                          seasonNumber: season.seasonNumber,
                                        }));
                                    }}
                                  >
                                    <View
                                      style={[
                                        styles.seasonBox,
                                        {
                                          borderColor:
                                            season.episodes?.length ===
                                            season.seasonEpisodes
                                              ? theme.colors.green
                                              : theme.colors.orange,
                                          backgroundColor: theme.primary,
                                        },
                                      ]}
                                    >
                                      <Image
                                        source={{
                                          uri: `https://image.tmdb.org/t/p/original${season.seasonPosterPath}`,
                                          cache: "force-cache",
                                        }}
                                        style={{
                                          width: 50,
                                          height: 75,
                                          borderRadius: 7,
                                          marginBottom: 2,
                                          shadowColor: "#000",
                                          shadowOffset: {
                                            width: 0,
                                            height: 8,
                                          },
                                          shadowOpacity: 0.94,
                                          shadowRadius: 10.32,
                                          elevation: 5,
                                        }}
                                      />
                                      <Text
                                        style={[
                                          styles.detailSeason,
                                          {
                                            color:
                                              season.episodes?.length ===
                                              season.seasonEpisodes
                                                ? theme.colors.green
                                                : theme.colors.orange,
                                          },
                                        ]}
                                      >
                                        {season.seasonNumber}. sezon
                                      </Text>
                                      <Text
                                        style={[
                                          styles.detailSeason,
                                          {
                                            color:
                                              season.episodes?.length ===
                                              season.seasonEpisodes
                                                ? theme.colors.green
                                                : theme.colors.orange,
                                          },
                                        ]}
                                      >
                                        {season.episodes.length} /{" "}
                                        {season.seasonEpisodes}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                </View>
                              ))
                            ) : (
                              <Text
                                style={{
                                  color: theme.text.muted,
                                  textAlign: "center",
                                }}
                              >
                                Bu dizi boş.
                              </Text>
                            )}
                          </ScrollView>
                        </View>
                      </View>
                    );
                  }}
                />
              )}
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
        onRequestClose={() => setReorderModalVisible(false)}
      >
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
          onPress={() => setReorderModalVisible(false)}
        />

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 200,
              //height: 320,
              borderRadius: 30,
              justifyContent: "center",
              alignItems: "center",
              //backgroundColor: theme.secondary,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: theme.text.primary,
                fontWeight: "bold",
                fontSize: 12,
              }}
            ></Text>
            <Image
              source={
                reorderItems?.imagePath
                  ? {
                      uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${reorderItems.imagePath}`,
                    }
                  : require("../assets/image/no_image.png")
              }
              style={styles.imageReorder}
            />
            <Text
              style={{
                color: theme.text.primary,
                fontWeight: "bold",
                fontSize: 12,
              }}
            >
              {reorderItems?.name}
            </Text>
            <Text
              style={{
                color: theme.text.primary,
                fontWeight: "bold",
                fontSize: 12,
              }}
            >
              {index + 1}. sırada
            </Text>
            <TextInput
              value={value}
              onChangeText={handleChange}
              keyboardType="numeric"
              placeholder={`1 ile ${listItems.length} arasında taşıyın`}
              placeholderTextColor={theme.text.muted}
              style={{
                width: 150,
                color: theme.text.primary,
                backgroundColor: theme.primary,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 10,
              }}
            />
            <TouchableOpacity
              onPress={() => {
                reorderWatchedTv(index, value, listName);
              }}
              style={{
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: theme.text.primary,
                  fontWeight: "bold",
                  textAlign: "center",
                  backgroundColor: theme.between,
                  paddingVertical: 10,
                  paddingHorizontal: 30,
                  borderRadius: 15,
                }}
              >
                Taşı
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    width: "95%",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
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
  imageReorder: {
    width: width * 0.4,
    height: height * 0.3,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
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
