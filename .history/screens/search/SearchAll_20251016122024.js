import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Image,
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
import Toast from "react-native-toast-message";
import { useAppSettings } from "../../context/AppSettingsContext";

export default function SearchAll({ navigation }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const searchTimeout = useRef(null);
  const [lastSearch, setLastSearch] = useState([]);
  const { showSnow, API_KEY, adultContent } = useAppSettings();
  const [selectedType, setSelectedType] = useState("movie"); // movie | tv | person
  const [scaleValues, setScaleValues] = useState({});

  // Scale animasyonlarını yönet
  useEffect(() => {
    const newScaleValues = {};
    results.forEach((item) => {
      newScaleValues[item.id] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [results]);

  const onPressIn = (id) => {
    if (!scaleValues[id]) return;
    Animated.timing(scaleValues[id], {
      toValue: 0.9,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = (id) => {
    if (!scaleValues[id]) return;
    Animated.timing(scaleValues[id], {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handleSearch = useCallback((text) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length >= 2) {
      setLoading(true);
      searchTimeout.current = setTimeout(() => fetchResults(text), 500);
    } else {
      setResults([]);
      setLoading(false);
    }
  }, []);

  const fetchResults = useCallback(
    async (query) => {
      if (!query) return;
      try {
        const url = `https://api.themoviedb.org/3/search/multi`;
        const params = {
          query,
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
        };
        const headers = { Authorization: API_KEY };
        const res = await axios.get(url, { params, headers });
        setResults(res.data.results || []);
        setError(null);

        setLastSearch((prev) => {
          const updated = [query, ...prev.filter((s) => s !== query)];
          return updated.slice(0, 5);
        });
      } catch (err) {
        setError(err.message);
        Toast.show({ type: "error", text1: "Arama hatası: " + err.message });
      } finally {
        setLoading(false);
      }
    },
    [language]
  );

  const renderItem = ({ item }) => {
    const type = item.media_type;

    if (!item.poster_path && !item.profile_path) return null;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        onPress={() => {
          Keyboard.dismiss();
          if (type === "movie")
            navigation.navigate("MovieDetails", { id: item.id });
          else if (type === "tv")
            navigation.navigate("TvShowsDetails", { id: item.id });
          else if (type === "person")
            navigation.navigate("ActorDetails", { id: item.id });
        }}
      >
        <Animated.View
          style={[
            styles.item,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/w500${
                item.poster_path || item.profile_path
              }`,
            }}
            style={styles.poster}
          />
          <View style={styles.info}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {item.title || item.name}
            </Text>
            <Text style={{ color: theme.text.secondary, fontSize: 13 }}>
              {type === "movie" ? t.movie : type === "tv" ? t.tvShow : t.actor}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const filteredResults = results.filter((r) => r.media_type === selectedType);

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay
        loop
      />

      <Text style={[styles.header, { color: theme.text.primary }]}>
        {t.searchAll || "Arama"}
      </Text>

      {/* 🔍 Arama Çubuğu */}
      <View
        style={[styles.searchContainer, { backgroundColor: theme.secondary }]}
      >
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder="Film, dizi veya oyuncu ara..."
          placeholderTextColor={theme.text.muted}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-outline" size={30} color={theme.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 🔄 Son Aramalar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.lastSearchContainer}
      >
        {lastSearch.map((s, i) => (
          <TouchableOpacity key={i} onPress={() => handleSearch(s)}>
            <View
              style={[
                styles.lastSearchItem,
                { backgroundColor: theme.secondary },
              ]}
            >
              <Text style={{ color: theme.text.primary }}>{s}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 🎬 Sekmeler */}
      <View style={styles.tabContainer}>
        {[
          { key: "movie", label: "Filmler" },
          { key: "tv", label: "Diziler" },
          { key: "person", label: "Oyuncular" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setSelectedType(tab.key)}
            style={[
              styles.tab,
              {
                backgroundColor:
                  selectedType === tab.key ? theme.accent : theme.secondary,
              },
            ]}
          >
            <Text
              style={{
                color:
                  selectedType === tab.key
                    ? theme.text.onAccent
                    : theme.text.primary,
                fontWeight: "bold",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 🧾 Liste */}
      {error ? (
        <Text style={[styles.errorText, { color: theme.text.primary }]}>
          {error}
        </Text>
      ) : loading ? (
        <SearchSkeleton />
      ) : search === "" ? (
        <View style={styles.emptyContainer}>
          <LottieView
            style={{ width: 350, height: 350 }}
            source={require("../../LottieJson/search12.json")}
            autoPlay
            loop
          />
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LottieView
                style={{ width: 300, height: 300 }}
                source={require("../../LottieJson/search_notfound.json")}
                autoPlay
                loop
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 45 },
  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },
  header: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 7 },
  lastSearchContainer: { height: 40, marginBottom: 10 },
  lastSearchItem: {
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resultsList: { paddingHorizontal: 15, paddingBottom: 30 },
  item: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  poster: {
    width: 100,
    height: 140,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 15,
  },
  title: { fontSize: 18, fontWeight: "bold" },
  errorText: { textAlign: "center", marginTop: 20 },
  emptyContainer: { alignItems: "center", justifyContent: "center", flex: 1 },
});
