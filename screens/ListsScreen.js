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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import React, { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import SwipeCard from "../modules/SwipeCard";
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
  const [shooseRandomlyModalVisible, setChooseRandomlyModalVisible] =
    useState(false);
  const [value, setValue] = useState("");

  const handleChange = (text) => {
    // Sadece rakamları al
    const numericValue = text.replace(/[^0-9]/g, "");
    setValue(numericValue - 1);
  };
  const [tvShowStatus, setTvShowStatus] = useState(null);

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
      (item.name || "").toLowerCase().includes(searchQuery.toLowerCase())
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
                0
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
                0
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
  const chooseRandomly = (type) => {
    if (filteredItems.length === 0) {
      // Hiç içerik yoksa
      Toast.show({
        type: "warning",
        text1: "İzleme listesi boş lütfen içerik ekleyiniz",
      });
      return;
    }
    const chooseItem = filteredItems.filter((item) => item.type == type);
    if (chooseItem.length === 0) {
      // İstenen türde içerik yoksa
      Toast.show({
        type: "warning",
        text1: `${type === "movie" ? "Hiç film yok!" : "Hiç dizi yok!"} `,
      });
      return;
    }
    const randomIndex = Math.floor(Math.random() * chooseItem.length);
    setListModalItems([chooseItem[randomIndex]]);
    setModalVisible(true);
  };
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <Text style={[styles.header, { color: theme.text.primary }]}>
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
        <Text style={[styles.emptyText, { color: theme.text.muted }]}>
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
            <View style={{ flexDirection: "row", marginBottom: 5, gap: 10 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: theme.notesColor.greenBackground,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 5,
                  marginBottom: 5,
                }}
                onPress={() => {
                  chooseRandomly("tv");
                }}
              >
                <Text style={{ color: theme.text.primary }}>Rastgele Dizi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: theme.notesColor.blueBackground,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 5,
                  marginBottom: 5,
                }}
                onPress={() => {
                  chooseRandomly("movie");
                }}
              >
                <Text style={{ color: theme.text.primary }}>Rastgele Film</Text>
              </TouchableOpacity>
            </View>
          )}
          {listName == "watchedTv" && (
            <View style={{ flexDirection: "row", marginBottom: 5, gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setTvShowStatus(null);
                }}
                style={{
                  backgroundColor:
                    tvShowStatus === null ? theme.colors.blue : theme.border,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    color: tvShowStatus === null ? "black" : theme.text.primary,
                  }}
                >
                  Bütün Diziler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setTvShowStatus(true);
                }}
                style={{
                  backgroundColor:
                    tvShowStatus === true ? theme.colors.green : theme.border,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    color: tvShowStatus === true ? "black" : theme.text.primary,
                  }}
                >
                  Bitirlen diziler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setTvShowStatus(false);
                }}
                style={{
                  backgroundColor:
                    tvShowStatus === false ? theme.colors.orange : theme.border,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    color:
                      tvShowStatus === false ? "black" : theme.text.primary,
                  }}
                >
                  Devam edilen diziler
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
                    (i) => i.id === item.id
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
                        { id: item.id }
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
                                0
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
                              uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
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
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={() => setModalVisible(false)}
          />
          <LinearGradient
            colors={["transparent", theme.shadow, theme.shadow]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: -1,
            }}
          />
          <View
            style={{
              width: "100%",
              //height: 200,
              padding: 5,
              borderRadius: 15,
              backgroundColor: theme.secondary,
            }}
          >
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
                    renderItem={({ item }) => {
                      return listName !== "watchList" ? (
                        <View style={[styles.infoContainer, {}]}>
                          <TouchableOpacity
                            onPress={() => {
                              setModalVisible(false),
                                navigation.navigate("TvShowsDetails", {
                                  id: item.id,
                                });
                            }}
                            style={styles.itemTvShow}
                          >
                            <Image
                              source={
                                item.imagePath
                                  ? {
                                      uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
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
                                        setModalVisible(false),
                                          navigation.navigate("SeasonDetails", {
                                            showId: item.id,
                                            seasonNumber: season.seasonNumber,
                                          });
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
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setModalVisible(false),
                              navigation.navigate(
                                item.type === "movie"
                                  ? "MovieDetails"
                                  : "TvShowsDetails",
                                {
                                  id: item.id,
                                }
                              );
                          }}
                          style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Image
                            source={
                              item.imagePath
                                ? {
                                    uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
                                    cache: "force-cache",
                                  }
                                : require("../assets/image/no_image.png")
                            }
                            style={styles.imageSelected}
                          />
                          <View style={{ gap: 5 }}>
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
                              Tür: {item.type}
                            </Text>
                            {item.dateAdded && (
                              <Text
                                style={[
                                  styles.detail,
                                  { color: theme.text.secondary },
                                ]}
                              >
                                eklenme tarihi: {formatDate(item.dateAdded)}
                              </Text>
                            )}
                            <View style={{ flexDirection: "row", gap: 5 }}>
                              {item.genres.map((genres) => (
                                <Text
                                  key={genres}
                                  style={[
                                    styles.detailGenres,
                                    {
                                      color: theme.text.secondary,
                                      backgroundColor: theme.primary,
                                    },
                                  ]}
                                >
                                  {genres}
                                </Text>
                              ))}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={reorderModalVisible}
        onRequestClose={() => setReorderModalVisible(false)}
      >
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
        <LinearGradient
          colors={["transparent", theme.shadow, theme.shadow, "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
            zIndex: -1,
          }}
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
              backgroundColor: theme.secondary,
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
                      uri: `https://image.tmdb.org/t/p/w500${reorderItems.imagePath}`,
                    }
                  : require("../assets/image/no_image.png")
              }
              style={styles.image}
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
    paddingTop: 40,
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
    justifyContent: "flex-end",
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
    maxHeight: 250,
    flexDirection: "row",
    paddingTop: 15,
    borderTopRightRadius: 15,
    borderTopLeftRadius: 15,
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
});
