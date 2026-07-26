import { Image } from "expo-image";
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  Animated,
  Keyboard
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAppSettings, useImageQualitySettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import LottieView from "lottie-react-native";
import { i18nText } from "../../utils/i18nText";
import { SearchSkeleton } from "../../components/Skeleton";


const SearchAll = ({ navigation }) => {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { API_KEY, adultContent } = useAppSettings();
  const { getTmdbUrl } = useImageQualitySettings();

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

  // Sorgu değişince eski in-flight yanıtın sonuçları/loading'i ezmemesi için
  // istek kimliği tutulur (handleSearch her çağrıda artırır).
  const searchRequestRef = useRef(0);

  // Not: fetchResults, handleSearch'ün deps dizisinde kullanıldığı için ondan
  // ÖNCE tanımlanmalı — aksi halde deps render sırasında TDZ'ye düşer.
  const fetchResults = useCallback(
    async (searchText) => {
      const requestId = ++searchRequestRef.current;
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
        if (requestId !== searchRequestRef.current) return;
        const filtered = response.data.results.filter(
          (item) => item.media_type !== "unknown",
        );
        const byPopularity = filtered.sort(
          (a, b) => (b.popularity || 0) - (a.popularity || 0),
        );
        setResults(byPopularity);
      } catch (err) {
        console.error("Multi search error:", err.message);
      } finally {
        if (requestId === searchRequestRef.current) setLoading(false);
      }
    },
    [API_KEY, adultContent, language],
  );

  const handleSearch = useCallback(
    (text) => {
      searchRequestRef.current += 1;
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (text.trim().length >= 2) {
        setLoading(true);
        searchTimeout.current = setTimeout(() => {
          fetchResults(text);
        }, 500);
      } else {
        // Boş veya 1 karakter: bekleyen istek iptal edildi; loading'i
        // sıfırlamazsak skeleton takılı kalır.
        setResults([]);
        setLoading(false);
      }
    },
    [fetchResults],
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
            navigation.navigate("MovieDetails", { id: item.id });
          else if (type === "tv")
            navigation.navigate("TvShowsDetails", { id: item.id });
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
                source={{ uri: getTmdbUrl(image, 'poster', 200) }}
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
            <Text
              allowFontScaling={false}
              style={{ color: theme.text.secondary, marginTop: 4 }}
            >
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
        {t.SearchScreen.searchAll || i18nText("autoI18n.tum_aramalar", "Tüm Aramalar")}
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
          placeholder={t.SearchScreen?.searchAllPlaceholder || i18nText("autoI18n.film_dizi_veya_oyuncu_ara", "Film, Dizi veya Oyuncu Ara...")}
          placeholderTextColor={theme.text.secondary}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 7,
            color: theme.text.primary,
            flex: 1,
          }}
          value={query}
          onChangeText={handleSearch}
          maxLength={80}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-outline" size={30} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <SearchSkeleton />
      ) : query === "" ? (
        <View style={{ justifyContent: "center", alignItems: "center" }}>
          <LottieView
            style={{ width: 350, height: 350 }}
            source={require("@lottie/search12.json")}
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
