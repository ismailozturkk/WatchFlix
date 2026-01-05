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
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../context/ThemeContext";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useFocusEffect } from "@react-navigation/native";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

const ActorSearch = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef(null);
  const { t } = useLanguage();
  const { API_KEY, language, adultContent } = useAppSettings(); // language ekledik
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
    (actors || []).forEach((item) => {
      newScaleValues[item.id] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [actors]);

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
  const handleSearchActor = useCallback(
    (text) => {
      setQuery(text);

      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      if (text.trim() === "") {
        setActors([]);
        setLoading(false);
      } else if (text.trim().length >= 2) {
        setLoading(true);
        searchTimeout.current = setTimeout(() => {
          fetchActorResults(text);
        }, 500);
      }
    },
    [fetchActorResults]
  );
  const fetchActorResults = useCallback(
    async (searchText) => {
      try {
        const url = `https://api.themoviedb.org/3/search/person`;
        const params = {
          query: searchText,
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
          sort_by: "popularity.desc",
        };
        const headers = {
          Authorization: API_KEY,
        };

        const response = await axios.get(url, { params, headers });

        const results = response.data.results;

        // İsme göre sıralama
        //const sortedByName = results.sort((a, b) =>
        //  a.name.localeCompare(b.name)
        //);

        setActors(
          results.filter((person) => person.known_for_department === "Acting")
        );
      } catch (err) {
        console.error("Actor search error:", err.message);
      } finally {
        setLoading(false);
      }
    },
    [API_KEY, language]
  );

  const renderActor = ({ item }) => (
    <TouchableOpacity
      onPressIn={() => {
        Keyboard.dismiss();
        onPressIn(item.id);
      }}
      onPressOut={() => {
        onPressOut(item.id);
      }}
      key={item.id}
      onPress={() => {
        navigation.navigate("ActorViewScreen", { personId: item.id });
      }}
      activeOpacity={0.8}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderColor: theme.border,
          transform: [{ scale: scaleValues[item.id] || 1 }],
        }}
      >
        <View
          style={{
            borderRadius: 8,
            marginRight: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {item.profile_path ? (
            <Image
              source={{
                uri: `${IMAGE_URL}${item.profile_path}`,
              }}
              style={{
                width: 70,
                height: 105,
                borderRadius: 20,
              }}
            />
          ) : (
            <FontAwesome name="user" size={72} color={theme.secondary} />
          )}
        </View>
        <View>
          <Text
            style={{
              color: theme.text.primary,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {item.name}
          </Text>
          <Text style={{ color: theme.text.secondary, marginTop: 4 }}>
            Bilinen: {item.known_for_department || "Bilinmiyor"}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            gap: 3,
          }}
        >
          {item.known_for.map((known_for, index) => (
            <Image
              key={index}
              source={{
                uri: `${IMAGE_URL}${known_for.poster_path}`,
              }}
              style={{
                width: 50,
                height: 75,
                borderRadius: 10,
              }}
            />
          ))}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

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
        {t.SearchScreen.searchActrist}
      </Text>
      <View
        style={{
          backgroundColor: theme.secondary,
          borderRadius: 10,
          color: theme.text.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
        }}
      >
        <Ionicons name="search" size={20} color={theme.text.muted} />
        <TextInput
          ref={inputRef}
          placeholder={t.SearchScreen.searchActrist}
          placeholderTextColor={theme.text.secondary}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 7,
            color: theme.text.primary,
            flex: 1,
          }}
          value={query}
          onChangeText={handleSearchActor}
        />
        <TouchableOpacity onPress={() => setQuery("")}>
          <Ionicons name="close-outline" size={30} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#f1c40f" />
      ) : query === "" ? (
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
          data={actors}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={renderActor}
          keyboardShouldPersistTaps="handled" // veya "always"
        />
      )}
    </View>
  );
};

export default ActorSearch;
