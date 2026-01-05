import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";

const FILTERS = [
  { key: "popular", label: "Popüler" },
  { key: "voted", label: "En Çok Oy Alan" },
  { key: "rated", label: "En Yüksek Puan" },
  { key: "upcoming", label: "Yakında" },
  { key: "latest", label: "En Yeni" },
];

// Ortak MediaCard bileşeni (animasyonlu)
const MediaCard = ({ item, onPress, theme }) => {
  const [scale] = useState(new Animated.Value(1));

  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const imageUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : null;

  return (
    <TouchableOpacity
      key={item.id}
      style={styles.cardContainer}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require("../../assets/image/no_image.png")
          }
          style={[styles.cardImage, { shadowColor: theme.shadow }]}
          resizeMode="cover"
        />
        <Text
          style={[styles.cardTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.title || item.name}
        </Text>
        <View
          style={[
            styles.ratingContainer,
            { backgroundColor: theme.secondaryt },
          ]}
        >
          <Text style={[styles.ratingText, { color: theme.colors.orange }]}>
            {item.vote_average?.toFixed(1) || "0.0"}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const applyFilterForList = (list, filter, type) => {
  if (!list) return [];
  const now = new Date();

  switch (filter) {
    case "popular":
      return [...list].sort((a, b) => b.popularity - a.popularity);
    case "voted":
      return [...list].sort((a, b) => b.vote_count - a.vote_count);
    case "rated":
      return [...list].sort((a, b) => b.vote_average - a.vote_average);
    case "upcoming":
      if (type === "movie") {
        return list.filter((m) => new Date(m.release_date) > now);
      }
      return list;
    case "latest":
    default:
      if (type === "movie") {
        return [...list].sort(
          (a, b) => new Date(b.release_date) - new Date(a.release_date)
        );
      } else if (type === "tv") {
        return [...list].sort(
          (a, b) => new Date(b.first_air_date) - new Date(a.first_air_date)
        );
      }
      return list;
  }
};

const ActorViewScreen = ({ route, navigation }) => {
  const { personId } = route.params;
  const { theme } = useTheme();
  const { API_KEY } = useAppSettings();
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const [filter, setFilter] = useState("popular");
  const [tvFilter, setTvFilter] = useState("popular");

  useEffect(() => {
    const fetchActorDetails = async () => {
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/person/${personId}`,
          {
            params: {
              language: language,
              append_to_response: "movie_credits,tv_credits",
            },
            headers: {
              Authorization: API_KEY,
            },
          }
        );
        setActor(response.data);
      } catch (err) {
        console.error("API Hatası:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActorDetails();
  }, [personId]);

  if (loading) {
    return (
      <View
        style={[styles.loaderContainer, { backgroundColor: theme.primary }]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.primary }]}>
        <Text style={{ color: theme.text.primary }}>{error}</Text>
      </View>
    );
  }

  const filteredMovies = applyFilterForList(
    actor?.movie_credits?.cast,
    filter,
    "movie"
  );
  const filteredTvShows = applyFilterForList(
    actor?.tv_credits?.cast,
    tvFilter,
    "tv"
  );
  const uniqueFilteredTvShows = Array.from(
    new Map(filteredTvShows.map((item) => [item.id, item])).values()
  );
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.primary }]}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      {/* Profil ve İsim */}
      <View style={{ alignItems: "center", paddingTop: 20, marginBottom: 50 }}>
        <Image
          source={{
            uri: "https://image.tmdb.org/t/p/w500" + actor.profile_path,
          }}
          style={{ width: 200, height: 300, borderRadius: 25 }}
        />
        <View
          style={{
            position: "absolute",
            top: 215,
            right: 90,
            left: 90,
            paddingTop: 100,
            backgroundColor: theme.secondary,
            padding: 10,
            borderRadius: 20,
            alignItems: "center",
            zIndex: -1,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "bold",
              color: theme.text.primary,
              marginTop: 10,
            }}
          >
            {actor.name}
          </Text>
        </View>
      </View>

      {/* Biyografi */}
      {actor.biography ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.text.primary,
            }}
          >
            Biyografi
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.text.secondary,
              marginTop: 5,
            }}
            numberOfLines={10}
          >
            {actor.biography}
          </Text>
        </View>
      ) : null}

      {/* Doğum Bilgileri */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text
          style={{ fontSize: 18, fontWeight: "600", color: theme.text.primary }}
        >
          Doğum Bilgileri
        </Text>
        <Text
          style={{ fontSize: 14, color: theme.text.secondary, marginTop: 5 }}
        >
          {actor.birthday} ({actor.place_of_birth})
        </Text>
      </View>

      {/* Film Filtreleme Butonları */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    f.key === filter ? theme.accent : theme.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    f.key === filter
                      ? theme.text.secondary
                      : theme.text.primary,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Film Listesi */}
      <FlatList
        horizontal
        data={filteredMovies}
        keyExtractor={(item) => `${item.media_type || ""}_${item.id}`}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            theme={theme}
            onPress={() => navigation.navigate("MovieDetails", { id: item.id })}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 15 }}
      />

      {/* Dizi Filtreleme Butonları */}
      <View style={[styles.filterRow, { marginTop: 20 }]}>
        <TouchableOpacity
          onPress={() => setTvFilter("popular")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                tvFilter === "popular" ? theme.accent : theme.secondary,
            },
          ]}
        >
          <Text
            style={{
              color:
                tvFilter === "popular"
                  ? theme.text.secondary
                  : theme.text.primary,
            }}
          >
            Popüler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTvFilter("top_rated")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                tvFilter === "top_rated" ? theme.accent : theme.secondary,
            },
          ]}
        >
          <Text
            style={{
              color:
                tvFilter === "top_rated"
                  ? theme.text.secondary
                  : theme.text.primary,
            }}
          >
            En Beğenilen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTvFilter("latest")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                tvFilter === "latest" ? theme.accent : theme.secondary,
            },
          ]}
        >
          <Text
            style={{
              color:
                tvFilter === "latest"
                  ? theme.text.secondary
                  : theme.text.primary,
            }}
          >
            En Yeni
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dizi Listesi */}
      <FlatList
        horizontal
        data={uniqueFilteredTvShows}
        keyExtractor={(item) => `${item.media_type || ""}_${item.id}`}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            theme={theme}
            onPress={() =>
              navigation.navigate("TvShowsDetails", { id: item.id })
            }
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 15, marginTop: 10 }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    marginVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  cardContainer: {
    marginRight: 15,
    width: 120,
  },
  cardImage: {
    width: 120,
    height: 180,
    borderRadius: 10,
    backgroundColor: "#222",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    marginTop: 5,
    fontSize: 14,
  },
  ratingContainer: {
    position: "absolute",
    top: 155,
    right: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderRadius: 8,
    marginTop: 4,
  },
  ratingText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default ActorViewScreen;
