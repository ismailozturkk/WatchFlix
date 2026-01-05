import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
export default function ListsTvShowScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { user } = useAuth();
  const [watchedTv, setWatchedTv] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedShows, setExpandedShows] = useState({});
  const [isLoading, setIsLoading] = useState(false); // 🟢 Yükleme durumu eklendi
  const [tvShowStatus, setTvShowStatus] = useState(true);

  useEffect(() => {
    if (!user.uid) return;
    setIsLoading(true);
    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const newData = docSnap.data().watchedTv || [];
        setWatchedTv((prevData) =>
          JSON.stringify(prevData) !== JSON.stringify(newData)
            ? newData
            : prevData
        );
      }
    });
    setIsLoading(false);
    return () => unsubscribe();
  }, [user.uid]);

  const filteredTvShows = watchedTv.filter((tv) => {
    const searchLower = searchQuery.toLowerCase();

    // Dizi adında arama
    const matchesShowName = tv.name.toLowerCase().includes(searchLower);

    // Bölüm adında arama
    const matchesEpisodeName = tv.seasons?.some((season) =>
      season.episodes?.some((episode) =>
        episode.episodeName.toLowerCase().includes(searchLower)
      )
    );

    return matchesShowName || matchesEpisodeName;
  });

  const toggleSeasonDetails = useCallback((showId, season = null) => {
    setExpandedShows((prev) => ({
      ...prev,
      [showId]: prev[showId]?.showSeasonDetails
        ? { showSeasonDetails: false, selectedSeason: null }
        : { showSeasonDetails: true, selectedSeason: season },
    }));
  }, []);
  const chunkArray = (array, size) => {
    if (!array) return [];
    return array.reduce((acc, _, index) => {
      if (index % size === 0) acc.push(array.slice(index, index + size));
      return acc;
    }, []);
  };
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <Text style={[styles.header, { color: theme.text.primary }]}>
        İzlenen Diziler
      </Text>

      {watchedTv.length > 3 && (
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

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          style={{
            width: "35%",

            paddingVertical: 5,
            paddingHorizontal: 10,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
          }}
          onPress={() => {
            setTvShowStatus(true);
          }}
        >
          <Text
            style={[
              styles.detail,
              { color: theme.text.secondary, textAlign: "center" },
            ]}
          >
            Bitirilen diziler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            width: "35%",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
          }}
          onPress={() => {
            setTvShowStatus(false);
          }}
        >
          <Text
            style={[
              styles.detail,
              { color: theme.primary, textAlign: "center" },
            ]}
          >
            Devam eden diziler
          </Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator />
      ) : filteredTvShows.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.text.muted }]}>
          {searchQuery ? "Sonuç bulunamadı." : "Henüz izlenmiş bir dizi yok."}
        </Text>
      ) : (
        <FlatList
          data={filteredTvShows}
          keyExtractor={(item) => item.id.toString()}
          initialNumToRender={10} // Başlangıçta 10 öğe yükler
          windowSize={5} // Performans için pencere boyutunu ayarla
          removeClippedSubviews={true} // Görünmeyen elemanları kaldır
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const showData = expandedShows[item.id] || {
              showSeasonDetails: false,
              selectedSeason: null,
            };
            if (item.episodeCount === item.showEpisodeCount && !tvShowStatus) {
              return null; // Eğer eşitse, hiçbir şey render etme
            } else if (
              item.episodeCount !== item.showEpisodeCount &&
              tvShowStatus
            ) {
              return null;
            }

            return (
              <View style={styles.infoContainer}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("TvShowsDetails", { id: item.id })
                  }
                  style={styles.item}
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
                    style={styles.image}
                  />
                  <Text style={[styles.title, { color: theme.text.primary }]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.detail, { color: theme.text.secondary }]}
                  >
                    Sezon: {item.showSeasonCount} - Bölüm:{" "}
                    {item.showEpisodeCount}
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: "colum",
                    flexShrink: 1,
                  }}
                >
                  <View>
                    {showData.showSeasonDetails ? (
                      <TouchableOpacity
                        onPress={() => toggleSeasonDetails(item.id, null)}
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "center",
                            backgroundColor: theme.secondary,
                            paddingLeft: 5,
                            paddingRight: 10,
                            marginBottom: 3,
                            marginRight: 5,
                            borderRadius: 10,
                          }}
                        >
                          <MaterialIcons
                            name="keyboard-arrow-left"
                            size={20}
                            color="white"
                          />
                          <Text
                            style={[
                              styles.detail,
                              {
                                color: theme.text.secondary,
                                marginBottom: 2,
                                marginLeft: 5,
                                textAlign: "center",
                              },
                            ]}
                          >
                            sezon {showData.selectedSeason.seasonNumber}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <Text
                        style={[
                          styles.detail,
                          {
                            color: theme.text.secondary,
                            marginBottom: 5,
                            marginLeft: 10,
                          },
                        ]}
                      >
                        İzlenen Sezonlar
                      </Text>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {showData.showSeasonDetails
                      ? // Bölümleri göster (Sezon seçildiğinde)
                        chunkArray(
                          showData.selectedSeason?.episodes || [],
                          3
                        ).map((column, columnIndex) => (
                          <View
                            key={columnIndex}
                            style={{
                              flexDirection: "column",
                              marginRight: 5,
                            }}
                          >
                            {column.map((episode) => (
                              <TouchableOpacity
                                key={episode.episodeNumber}
                                onPress={() => {
                                  navigation.navigate("EpisodeDetails", {
                                    showId: item.id,
                                    showName: item.name,
                                    seasonNumber:
                                      showData.selectedSeason.seasonNumber,
                                    episodeNumber: episode.episodeNumber,
                                    seasonEpisodes:
                                      showData.selectedSeason.seasonEpisodes,
                                    seasonPosterPath:
                                      showData.selectedSeason.seasonPosterPath,
                                    episodePosterPath:
                                      episode.episodePosterPath,
                                    showEpisodeCount: item.showEpisodeCount,
                                    showSeasonCount: item.showSeasonCount,
                                    showPosterPath: item.imagePath,
                                  });
                                }}
                              >
                                <View
                                  style={[
                                    styles.episodeBox,
                                    {
                                      backgroundColor: theme.secondary,
                                      borderColor: "green",
                                    },
                                  ]}
                                >
                                  {/* <Image
                                    source={{
                                      uri: `https://image.tmdb.org/t/p/original${episode.episodePosterPath}`,
                                    }}
                                    style={{
                                      width: 90,
                                      height: 60,
                                      borderRadius: 7,
                                    }}
                                  /> */}
                                  <Text
                                    style={[
                                      styles.detail,
                                      { color: theme.text.secondary },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {episode.episodeNumber}.bölüm
                                  </Text>
                                  <Text
                                    style={[
                                      styles.detail,
                                      { color: theme.text.secondary },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {episode.episodeName}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.detail,
                                      { color: theme.text.secondary },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {episode.episodeMinutes} dakika - rating:{" "}
                                    {episode.episodeRatings}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.detail,
                                      { color: theme.text.secondary },
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    izleme tarihi: {episode.episodeWatchTime}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ))
                      : // Sezonları göster
                        chunkArray(item.seasons, 5).map(
                          (column, columnIndex) => (
                            <View
                              key={columnIndex}
                              style={{
                                flexDirection: "column",
                                marginRight: 5,
                                gap: 0,
                              }}
                            >
                              {column.map((season) => (
                                <TouchableOpacity
                                  key={season.seasonNumber}
                                  onPress={() =>
                                    toggleSeasonDetails(item.id, season)
                                  }
                                >
                                  <View
                                    style={[
                                      styles.seasonBox,
                                      {
                                        borderColor:
                                          season.episodes?.length ===
                                          season.seasonEpisodes
                                            ? "green"
                                            : "orange",
                                        backgroundColor: theme.secondary,
                                      },
                                    ]}
                                  >
                                    {/* <Image
                                      source={{
                                        uri: `https://image.tmdb.org/t/p/original${season.seasonPosterPath}`,
                                      }}
                                      style={{
                                        width: 50,
                                        height: 75,
                                        borderRadius: 5,
                                      }}
                                    /> */}
                                    <Text
                                      style={[
                                        styles.detail,
                                        {
                                          color:
                                            season.episodes?.length ===
                                            season.seasonEpisodes
                                              ? [
                                                  "dark",
                                                  "gray",
                                                  "blue",
                                                ].includes(selectedTheme)
                                                ? "lightgreen"
                                                : theme.text.primary
                                              : [
                                                    "dark",
                                                    "gray",
                                                    "blue",
                                                  ].includes(selectedTheme)
                                                ? "orange"
                                                : theme.text.primary,
                                        },
                                      ]}
                                    >
                                      {season.seasonNumber}.sezon
                                    </Text>
                                    <Text
                                      style={[
                                        styles.detail,
                                        {
                                          color:
                                            season.episodes?.length ===
                                            season.seasonEpisodes
                                              ? [
                                                  "dark",
                                                  "gray",
                                                  "blue",
                                                ].includes(selectedTheme)
                                                ? "lightgreen"
                                                : theme.text.primary
                                              : [
                                                    "dark",
                                                    "gray",
                                                    "blue",
                                                  ].includes(selectedTheme)
                                                ? "orange"
                                                : theme.text.primary,
                                        },
                                      ]}
                                    >
                                      {season.seasonEpisodeCount} /
                                      {season.seasonEpisodes}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )
                        )}
                  </ScrollView>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  emptyText: { fontSize: 16, textAlign: "center", marginTop: 20 },
  item: {
    justifyContent: "space-between",
    gap: 3,
    width: 125,
    marginRight: 10,
  },
  image: {
    width: 120,
    height: 180,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  infoContainer: {
    height: 250,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "bold" },
  detail: { fontSize: 12 },
  seasonBox: {
    backgroundColor: "#ccc",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    marginBottom: 5,
  },
  episodeBox: {
    width: 150,
    backgroundColor: "#ccc",
    borderWidth: 1,
    //gap: 5,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    marginBottom: 5,
  },
  skeletonImage: {
    width: 120,
    height: 180,
    borderRadius: 10,
    backgroundColor: "#ccc",
  },
  skeletonText: {
    width: 100,
    height: 15,
    marginTop: 8,
    backgroundColor: "#ccc",
    borderRadius: 4,
  },
  skeletonTextSmall: {
    width: 80,
    height: 12,
    marginTop: 5,
    backgroundColor: "#ccc",
    borderRadius: 4,
  },
});
