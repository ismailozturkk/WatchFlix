import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Keyboard,
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import LottieView from "lottie-react-native";

const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

const SearchAll = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { API_KEY, language, adultContent } = useAppSettings();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef(null);
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    results.forEach((item) => {
      newScaleValues[item.id || item.name] = new Animated.Value(1);
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

  const handleSearch = useCallback(
    (text) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (text.trim() === "") {
        setResults([]);
        setLoading(false);
        return;
      }

      if (text.trim().length >= 2) {
        setLoading(true);
        searchTimeout.current = setTimeout(() => {
          fetchResults(text);
        }, 500);
      }
    },
    [fetchResults]
  );

  const fetchResults = useCallback(
    async (searchText) => {
      try {
        const url = `https://api.themoviedb.org/3/search/multi`;
        const params = {
          query: searchText,
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: 1,
        };
        const headers = { Authorization: API_KEY };
        const response = await axios.get(url, { params, headers });
        const filtered = response.data.results.filter(
          (item) => item.media_type !== "unknown"
        );
        const byPopularity = filtered.sort(
          (a, b) => (b.popularity || 0) - (a.popularity || 0)
        );
        setResults(byPopularity);
      } catch (err) {
        console.error("Multi search error:", err.message);
      } finally {
        setLoading(false);
      }
    },
    [API_KEY, language]
  );

  const renderItem = ({ item }) => {
    const type = item.media_type;
    const title = item.title || item.name || "Bilinmiyor";
    const image = item.poster_path || item.profile_path;
    const knownFor =
      type === "person"
        ? `Bilinen: ${item.known_for_department || "Bilinmiyor"}`
        : type === "movie"
          ? "🎬 Film"
          : "📺 Dizi";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        onPress={() => {
          if (type === "movie")
            navigation.navigate("MovieDetailsScreens", { movieId: item.id });
          else if (type === "tv")
            navigation.navigate("TvDetailsScreens", { seriesId: item.id });
          else if (type === "person")
            navigation.navigate("ActorViewScreen", { personId: item.id });
        }}
      >
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: theme.border,
            transform: [{ scale: scaleValues[item.id || item.name] || 1 }],
          }}
        >
          <View
            style={{
              borderRadius: 10,
              marginRight: 12,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {image ? (
              <Image
                source={{ uri: `${IMAGE_URL}${image}` }}
                style={{
                  width: 70,
                  height: 105,
                  borderRadius: 12,
                }}
              />
            ) : (
              <FontAwesome name="image" size={70} color={theme.secondary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.text.primary,
                fontSize: 16,
                fontWeight: "bold",
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={{ color: theme.text.secondary, marginTop: 4 }}>
              {knownFor}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.primary,
        paddingTop: 45,
        paddingHorizontal: 15,
      }}
    >
      <Text
        style={{
          color: theme.text.primary,
          fontSize: 24,
          textAlign: "center",
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        {t.SearchScreen.searchAll || "Tüm Aramalar"}
      </Text>

      {/* 🔍 Search Bar */}
      <View
        style={{
          backgroundColor: theme.secondary,
          borderRadius: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
        }}
      >
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          placeholder="Film, Dizi veya Oyuncu Ara..."
          placeholderTextColor={theme.text.secondary}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 7,
            color: theme.text.primary,
            flex: 1,
          }}
          value={query}
          onChangeText={handleSearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-outline" size={30} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f1c40f" />
      ) : query === "" ? (
        <View style={{ justifyContent: "center", alignItems: "center" }}>
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
          keyExtractor={(item) => `${item.media_type}-${item.id}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

export default SearchAll;
