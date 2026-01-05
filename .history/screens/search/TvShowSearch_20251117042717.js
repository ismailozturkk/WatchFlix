import React, { useCallback, useState, useRef, useEffect } from "react";
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
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import Toast from "react-native-toast-message";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
//import { API_KEY } from "@env";
import { db } from "../../firebase";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useListStatus } from "../../hooks/useListStatus";
import { useFocusEffect } from "@react-navigation/native";

export default function TvShowSearch({ navigation, route }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const searchTimeout = useRef(null);
  const [lastSearch, setLastSearch] = useState([]);
  const { showSnow } = useAppSettings();
  const { API_KEY, adultContent } = useAppSettings();
  const [scaleValues, setScaleValues] = useState({});

  const inputRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.autoFocus) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }, [route.params])
  );

  useEffect(() => {
    const newScaleValues = {};
    (results || []).forEach((item) => {
      newScaleValues[item.id] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [results]);

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

  const TvShowItem = ({ item, navigation }) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const { inWatchList, inFavorites, isWatched } = useListStatus(
      item.id,
      "tv"
    );

    const updateTvSeriesList = async (listType, type) => {
      if (!user.uid || !item.id) {
        Toast.show({
          type: "error",
          text1: "Kullanıcı veya içerik bilgisi eksik!",
        });
        return;
      }

      const docRef = doc(db, "Lists", user.uid);

      try {
        // Mevcut dökümanı getir
        const docSnap = await getDoc(docRef);

        let data = {
          watchedTv: [],
          favorites: [],
          watchList: [],
          watchedMovies: [],
        };

        if (docSnap.exists()) {
          data = docSnap.data();
        } else {
          await setDoc(docRef, data);
        }

        // Güncellenecek listeyi seç
        let selectedList = data[listType] || [];

        // **Type'a göre filtreleme**: Aynı ID'li ancak farklı türdeki içerikler karışmasın
        const movieIndex = selectedList.findIndex(
          (tv) => tv.id === item.id && tv.type === type
        );

        if (movieIndex !== -1) {
          // İçerik varsa, kaldır
          selectedList.splice(movieIndex, 1);
          Toast.show({
            type: "warning",
            text1: `${
              type === "tv" ? "Dizi" : "Film"
            } ${listType} listesinden kaldırıldı!`,
          });
        } else {
          // İçerik yoksa, ekle
          const newMovie = {
            id: item.id,
            imagePath: item.poster_path,
            name: item.name,
            type: type, // **Burada type kaydediyoruz!**
          };
          selectedList.push(newMovie);
          Toast.show({
            type: "success",
            text1: `${
              type === "tv" ? "Dizi" : "Film"
            } ${listType} listesine eklendi!`,
          });
        }

        // Firestore'u güncelle
        await updateDoc(docRef, { [listType]: selectedList });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Hata: " + error.message,
        });
      }
    };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => {
          onPressIn(item.id);
        }}
        onPressOut={() => {
          onPressOut(item.id);
        }}
        onPress={() => {
          Keyboard.dismiss();
          navigation.navigate("TvShowsDetails", {
            id: item.id,
          });
        }}
      >
        <Animated.View
          style={[
            styles.item,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          {item.backdrop_path && (
            <Image
              source={{
                uri: `https://image.tmdb.org/t/p/w500${item.backdrop_path}`,
              }}
              style={[styles.backDrop, { shadowColor: theme.shadow }]}
            />
          )}
          {item.poster_path ? (
            <Image
              source={{
                uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
              }}
              style={[styles.posterTvRating, { shadowColor: theme.shadow }]}
            />
          ) : (
            <View
              style={[
                styles.noImageContainer,
                { backgroundColor: theme.secondary },
              ]}
            >
              <Ionicons name="image" size={80} color={theme.text.muted} />
            </View>
          )}
          <View style={styles.seriesInfo}>
            <Text style={[styles.showName, { color: theme.text.primary }]}>
              {item.name || "İsimsiz"}
            </Text>
            <Text style={[styles.showDate, { color: theme.text.secondary }]}>
              {item.first_air_date
                ? new Date(item.first_air_date).getFullYear()
                : "Tarih yok"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.voteAverage, { color: theme.accent }]}>
                {item.vote_average ? item.vote_average.toFixed(1) : "0.0"}
              </Text>
              <Text style={[styles.voteCount, { color: theme.text.secondary }]}>
                ({item.vote_count || 0})
              </Text>
            </View>
          </View>
          <View style={[styles.stats]}>
            <View
              style={{
                gap: 5,
                backgroundColor: theme.secondaryt,
                paddingVertical: 5,
                paddingHorizontal: 2,

                borderRadius: 7,
              }}
            >
              {inWatchList && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("watchList", "tv");
                  }}
                >
                  <Ionicons
                    name="bookmark"
                    size={16}
                    color={theme.colors.blue}
                  />
                </TouchableOpacity>
              )}
              {isWatched && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("watchedTv", "tv");
                  }}
                >
                  <Ionicons name="eye" size={16} color={theme.colors.green} />
                </TouchableOpacity>
              )}
              {inFavorites && (
                <TouchableOpacity
                  onPress={() => {
                    //updateTvSeriesList("favorites", "tv");
                  }}
                >
                  <Ionicons name="heart" size={16} color={theme.colors.red} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (route.params !== undefined) {
    const { name } = route.params;
    useEffect(() => {
      if (name) {
        setSearch(name);
        fetchResults(name);
      }
    }, [name]);
  }
  const handleSearch = useCallback((text) => {
    setSearch(text);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim() === "") {
      setResults([]);
      setLoading(false);
    } else if (text.trim().length >= 2) {
      setLoading(true);
      searchTimeout.current = setTimeout(() => {
        fetchResults(text);
      }, 500);
    }
  }, []);

  const fetchResults = useCallback(
    async (searchText) => {
      if (!searchText) {
        setLoading(false);
        return;
      }

      try {
        const url = `https://api.themoviedb.org/3/search/tv`;
        const params = {
          query: searchText,
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
        };
        const headers = {
          Authorization: API_KEY,
        };

        const response = await axios.get(url, { params, headers });
        //oy sayısına göre
        const sortedResults = response.data.results.sort(
          (a, b) => b.vote_count - a.vote_count
        );
        // Tarihe göre sıralama
        const sortedByDate = results.sort(
          (a, b) => new Date(b.release_date) - new Date(a.release_date)
        );

        // İsme göre sıralama
        const sortedByName = results.sort((a, b) =>
          a.title.localeCompare(b.title)
        );
        setResults(sortedResults);

        // Benzerlik kontrolü ve son gelen kelimeyi ekleyip eskiyi silme
        setLastSearch((prevSearches) => {
          // Yeni kelimeyi ekle
          const updatedSearches = [searchText, ...prevSearches];

          // Benzer olanları filtrele, son geleni tut
          const filteredSearches = updatedSearches.filter(
            (search, index, self) =>
              self.findIndex(
                (s) =>
                  s.toLowerCase().includes(search.toLowerCase()) ||
                  search.toLowerCase().includes(s.toLowerCase())
              ) === index
          );

          // Son 5 aramayı tut
          return filteredSearches.slice(0, 5);
        });

        setError(null);
      } catch (err) {
        setError(err.message);
        Toast.show({
          type: "error",
          text1: "error:" + err,
        });
      } finally {
        setLoading(false);
      }
    },
    [language]
  );

  if (loading && !search) {
    return <SearchSkeleton />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <Text
        style={{
          color: theme.text.primary,
          fontSize: 24,
          textAlign: "center",
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        {t.searchTvShows}
      </Text>
      <View
        style={[styles.searchContainer, { backgroundColor: theme.secondary }]}
      >
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder={t.searchTvShows}
          placeholderTextColor={theme.text.muted}
          value={search}
          onChangeText={handleSearch}
        />
        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-outline" size={30} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.searchContainer1}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {lastSearch.map((search, index) => (
            <TouchableOpacity key={index} onPress={() => handleSearch(search)}>
              <View
                key={index}
                style={[
                  styles.searchItem1,
                  { alignSelf: "flex-start", backgroundColor: theme.secondary },
                ]}
              >
                <Text
                  style={[styles.searchText1, { color: theme.text.primary }]}
                >
                  {search}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text.primary }]}>
            {error}
          </Text>
        </View>
      ) : loading ? (
        <SearchSkeleton />
      ) : search === "" ? (
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <LottieView
            style={{ width: 350, height: 350 }}
            source={require("../../LottieJson/search12.json")}
            autoPlay
            loop
          />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={({ item }) => (
            <TvShowItem item={item} navigation={navigation} />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled" // veya "always"
          ListEmptyComponent={
            search?.length > 1 && (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <LottieView
                  style={{ width: 350, height: 350 }}
                  source={require("../../LottieJson/search_notfound.json")}
                  autoPlay
                  loop
                />
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 45,
  },
  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 7,
  },
  loading: {
    marginLeft: 10,
  },
  resultsList: {
    marginVertical: 15,
    paddingHorizontal: 15,
  },
  item: {
    width: "100%",
    height: 150,
    flexDirection: "row",
    borderRadius: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 40,
    marginBottom: 30,
    borderWidth: 1,
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  backDrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  posterTvRating: {
    top: -20,
    left: 5,
    width: 110,
    height: 170,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  noImageContainer: {
    width: 80,
    height: 120,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  stats: {
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 3,
    top: 3,
    bottom: 3,
  },
  seriesInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: "center",
  },
  showName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  showDate: {
    fontSize: 14,
    marginBottom: 5,
  },
  voteAverage: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 5,
  },
  voteCount: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  noResults: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  noResultsText: {
    fontSize: 16,
  },
  searchContainer1: {
    height: 40,
  },
  searchItem1: {
    height: 35,
    marginLeft: 15,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  searchText1: {
    fontSize: 12,
  },
});
