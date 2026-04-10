import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from "react-native";

if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
import Reanimated, { LinearTransition, FadeInDown, FadeOutDown, FadeIn, FadeOut } from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useProfileScreen } from "../context/ProfileScreenContext";
import { BlurView } from "expo-blur";

export const ChatModal = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [themeVisible, setThemeVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  // ✅ DÜZELTME: response artık düz string, JSON.stringify yok
  const [response, setResponse] = useState(null);

  const [error, setError] = useState(null);
  const [history, setHistory] = useState(false);
  const [array, setArray] = useState([]);
  const { t, language, toggleLanguage } = useLanguage();
  const [conversationHistory, setConversationHistory] = useState([]);
  const { selectedTheme, changeTheme, theme } = useTheme();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const {
    mostWatchedGenre,
    secondWatchedGenre,
    threeWatchedGenre,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
  } = useProfileScreen();
  const [genres, setGenres] = useState([]);
  const [genresTv, setGenresTv] = useState([]);
  const [movies, setMovies] = useState([]);
  const [tv, setTv] = useState([]);

  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const chooseGenres = () => {
    if (genres.length > 0) {
      setGenres([]);
    } else {
      setGenresTv([]);
      setGenres([mostWatchedGenre, secondWatchedGenre, threeWatchedGenre]);
    }
  };

  const chooseGenresTv = () => {
    if (genresTv.length > 0) {
      setGenresTv([]);
    } else {
      setGenres([]);
      setGenresTv([
        mostWatchedGenreTv,
        secondWatchedGenreTv,
        thirdWatchedGenreTv,
      ]);
    }
  };

  // ✅ DÜZELTME: StyleSheet.create yerine düz obje — react-native-markdown-display
  // StyleSheet.create ile oluşturulan stilleri bazen doğru işlemiyor
  const markdownStyles = {
    body: {
      color: theme.text.secondary,
      fontSize: 14,
      lineHeight: 20,
    },
    heading1: {
      color: theme.text.primary,
      fontSize: 20,
      fontWeight: "800",
      marginVertical: 8,
    },
    heading2: {
      color: theme.text.primary,
      fontSize: 17,
      fontWeight: "700",
      marginVertical: 6,
    },
    heading3: {
      color: theme.text.secondary,
      fontSize: 15,
      fontWeight: "600",
      marginVertical: 4,
    },
    paragraph: {
      marginVertical: 4,
      flexWrap: "wrap",
      flexDirection: "row",
      alignItems: "flex-start",
    },
    // ✅ DÜZELTME: strong ve em mutlaka tanımlanmalı, yoksa ** görünür
    strong: {
      fontWeight: "bold",
      color: theme.text.primary,
    },
    em: {
      fontStyle: "italic",
      color: theme.text.secondary,
    },
    s: {
      textDecorationLine: "line-through",
    },
    link: {
      color: theme.bold,
      textDecorationLine: "underline",
    },
    blocklink: {
      flex: 1,
      borderBottomWidth: 1,
      borderColor: theme.bold,
    },
    hardbreak: {
      width: "100%",
      height: 1,
    },
    blockquote: {
      backgroundColor: theme.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.text.secondary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginVertical: 6,
      borderRadius: 4,
    },
    bullet_list: {
      paddingLeft: 8,
      marginVertical: 4,
    },
    ordered_list: {
      paddingLeft: 8,
      marginVertical: 4,
    },
    list_item: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    bullet_list_icon: {
      marginRight: 8,
      marginTop: 4,
      color: theme.text.secondary,
    },
    ordered_list_icon: {
      marginRight: 8,
      marginTop: 4,
      color: theme.text.secondary,
    },
    code_inline: {
      backgroundColor: theme.border,
      color: theme.text.primary,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: 13,
    },
    code_block: {
      backgroundColor: theme.border,
      color: theme.text.primary,
      padding: 10,
      borderRadius: 8,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: 13,
      marginVertical: 6,
    },
    fence: {
      backgroundColor: theme.border,
      color: theme.text.primary,
      padding: 10,
      borderRadius: 8,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontSize: 13,
      marginVertical: 6,
    },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      marginVertical: 8,
    },
    thead: {},
    tbody: {},
    th: {
      backgroundColor: theme.between,
      fontWeight: "bold",
      padding: 8,
      color: theme.text.primary,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
    },
    td: {
      padding: 8,
      color: theme.text.primary,
    },
    hr: {
      backgroundColor: theme.border,
      height: 1,
      marginVertical: 8,
    },
  };

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const FetchData = async () => {
    if (genres?.length <= 0 && genresTv?.length <= 0 && message.trim() === "") {
      return;
    }

    setLoading(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      console.log(
        "Gemini API Key Length:",
        apiKey ? apiKey.length : "UNDEFINED",
      );
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      console.log("Request URL:", url);

      const updatedHistory = [
        ...conversationHistory,
        { role: "user", text: message },
      ];
      setConversationHistory(updatedHistory);

      const requestText =
        genres.length > 0
          ? `${genres} Recommend Movie According to These Types ` + message
          : genresTv.length > 0
            ? `${genresTv} Recommended Tv series According to These Types ` +
              message
            : message;

      const data = {
        contents: [
          {
            parts: [
              {
                text: requestText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain",
        },
        safetySettings: [],
        systemInstruction: {
          parts: [
            {
              // ✅ DÜZELTME: Yeni format — <SERİ: isim> ve <FİLM: isim>
              // Eski < name > ve -- name -- formatları markdown ile çakışıyordu
              // Yeni format hem ayırt edici hem markdown-safe
              text: `You are a film and TV series information assistant. Provide users with details such as the plot, cast, director, release date, and IMDb rating of movies and TV series. Additionally, offer suggestions for similar titles and inform about available streaming platforms. Always provide recommendations based solely on the information provided by the user. If a user simply asks for a film or series recommendation without providing additional details, generate a recommendation on your own without asking for further information. If there are previous messages, continue in a natural way based on previous messages. If a user asks about anything unrelated to films, TV series, or watchable content, respond with 'I cannot answer questions unrelated to films, TV series, or watchable content.' When mentioning or recommending a TV series, always format its name exactly as <SERIES: name> (example: <SERIES: Breaking Bad>), and for movies, always format its name exactly as <MOVIE: name> (example: <MOVIE: Inception>). Always use these exact tags. Respond in ${language}.`,
            },
          ],
        },
      };

      const responseObj = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!responseObj.ok) {
        const errorText = await responseObj.text();
        console.error("Fetch API error:", responseObj.status, errorText);
        throw new Error(`API Error: ${responseObj.status} - ${errorText}`);
      }

      const responseData = await responseObj.json();

      // ✅ DÜZELTME: Ham string'i al — JSON.stringify KULLANMA
      const rawText = responseData.candidates[0].content.parts[0].text;

      // Bot yanıtını geçmişe düz string olarak ekle
      setConversationHistory((prevHistory) => [
        ...prevHistory,
        { role: "assistant", text: rawText },
      ]);

      // ✅ DÜZELTME: State'e ham string koy
      setResponse(rawText);

      // ✅ DÜZELTME: Ham string üzerinde regex çalıştır
      FormatMatchMessage(rawText);

      setSendMessage(message);
      setMessage("");
      setLoading(false);
    } catch (err) {
      console.error("API Error in ChatModal:", err.message);
      setError(err);
      setLoading(false);
    }
  };

  // ✅ DÜZELTME: FormatMessage sadeleştirildi
  // Önceki replace(/"/g, " ") ve replace(/\\/g, '"') markdown'ı bozuyordu — kaldırıldı
  function FormatMessage(text) {
    if (!text) return text;
    return text
      .replace(/<MOVIE:\s*([^>]+)>/gi, "**$1**") // <MOVIE: Inception> -> **Inception** (Markdown Kalın)
      .replace(/<SERIES:\s*([^>]+)>/gi, "**$1**") // <SERIES: Breaking Bad> -> **Breaking Bad** (Markdown Kalın)
      .replace(/\r\n/g, "\n") // Windows satır sonlarını normalize et
      .replace(/\n{3,}/g, "\n\n") // 3+ boş satırı 2'ye indir
      .trim();
  }

  // ✅ DÜZELTME: Yeni sistem prompt ile uyumlu regex
  // <SERIES: Breaking Bad> → "Breaking Bad"
  // <MOVIE: Inception> → "Inception"
  function FormatMatchMessage(text) {
    if (!text) return;

    const extractedTv =
      text.match(/<SERIES:\s*([^>]+)>/gi)?.map((m) =>
        m
          .replace(/<SERIES:\s*/i, "")
          .replace(">", "")
          .trim(),
      ) || [];

    const extractedMovies =
      text.match(/<MOVIE:\s*([^>]+)>/gi)?.map((m) =>
        m
          .replace(/<MOVIE:\s*/i, "")
          .replace(">", "")
          .trim(),
      ) || [];

    const uniqueTv = Array.from(new Set(extractedTv));
    const uniqueMovies = Array.from(new Set(extractedMovies));

    setTv((prev) => Array.from(new Set([...prev, ...uniqueTv])));
    setMovies((prev) => Array.from(new Set([...prev, ...uniqueMovies])));
  }

  const AddToArray = (text) => {
    if (text.trim() !== "") {
      setArray([...array, text]);
    }
  };

  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop;
    if (modalVisible) {
      animation.setValue(0);
      loop = Animated.loop(
        Animated.timing(animation, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: false,
        }),
      );
      loop.start();
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [modalVisible]);

  const interpolateColor = animation.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: [
      "#00FF0030",
      "#0000FF30",
      "#4B008230",
      "#EE82EE30",
      "#FF000030",
      "#FFA50030",
      "#FFFF0030",
      "#00FF0030",
    ],
  });

  return (
    <View>
      {!modalVisible && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setModalVisible(true);
          }}
        >
          <LottieView
            style={{
              width: 48,
              height: 48,
              zIndex: 10,
            }}
            source={require("../LottieJson/gemini.json")}
            autoPlay
            loop
          />
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={["transparent", theme.shadow, theme.shadow]}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
            zIndex: 4,
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
          keyboardVerticalOffset={0}
        >
          <View style={{ flex: 1, width: "100%" }} />

          <TouchableOpacity
            onPress={() => {
              animateLayout();
              setModalVisible(false);
              setSettingsVisible(false);
              setThemeVisible(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 5,
            }}
          />

          <Reanimated.View
            layout={LinearTransition.springify()}
            style={[
              styles.modalContent,
              {
                backgroundColor: "transparent",
                zIndex: 11,
                shadowColor: theme.shadow,
                overflow: "hidden",
              },
            ]}
          >
            <BlurView
              tint="dark"
              intensity={50}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            {!history ? (
              <View style={{ zIndex: 15 }}>
                {response !== null && response !== "" && (
                  <View
                    style={{
                      width: "100%",
                      maxHeight: isKeyboardVisible ? 460 : 800,
                      gap: 10,
                      paddingHorizontal: 15,
                      paddingVertical: 10,
                    }}
                  >
                    {sendMessage !== "" && (
                      <TouchableOpacity onPress={() => setMessage(sendMessage)}>
                        <View
                          style={{
                            justifyContent: "center",
                            alignItems: "flex-end",
                          }}
                        >
                          <Text
                            selectable={true}
                            style={{
                              maxWidth: "90%",
                              padding: 5,
                              backgroundColor: theme.border,
                              paddingHorizontal: 10,
                              borderRadius: 10,
                              color: theme.text.primary,
                            }}
                          >
                            {sendMessage}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <Reanimated.View
                      layout={LinearTransition.springify()}
                      style={{
                        maxHeight: isKeyboardVisible ? 300 : 600,
                        flexDirection: "row",
                        maxWidth: "100%",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: theme.secondary,
                          padding: 5,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                        }}
                      >
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          {/* ✅ DÜZELTME: response artık düz string, doğrudan FormatMessage'a ver */}
                          <Markdown style={markdownStyles}>
                            {FormatMessage(response)}
                          </Markdown>
                        </ScrollView>
                      </View>

                      <View style={{ flexDirection: "column", marginLeft: 6 }}>
                        <TouchableOpacity onPress={() => setHistory(true)}>
                          <MaterialIcons
                            name="history"
                            size={28}
                            color={theme.text.between}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setMovies([]);
                            setTv([]);
                            setResponse(null);
                          }}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={28}
                            color={theme.text.between}
                          />
                        </TouchableOpacity>
                      </View>
                    </Reanimated.View>

                    {tv.length > 0 && (
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        data={tv}
                        keyExtractor={(item, index) => `tv-${index}`}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={{
                              marginHorizontal: 5,
                              paddingVertical: 3,
                              paddingHorizontal: 10,
                              backgroundColor: theme.primary,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              navigation.navigate("TvShowSearch", {
                                name: item,
                              });
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: theme.notesColor.green,
                              }}
                            >
                              {t.ChatModal.series}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: theme.text.primary,
                              }}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    )}

                    {movies.length > 0 && (
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        data={movies}
                        keyExtractor={(item, index) => `movie-${index}`}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={{
                              marginHorizontal: 5,
                              paddingVertical: 3,
                              paddingHorizontal: 10,
                              backgroundColor: theme.primary,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              navigation.navigate("MovieSearch", {
                                name: item,
                              });
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: theme.notesColor.blue,
                              }}
                            >
                              {t.ChatModal.movie}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: theme.text.primary,
                              }}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}

                {themeVisible && (
                  <Reanimated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutDown.duration(200)}
                    layout={LinearTransition.springify()}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 15,
                      width: "100%",
                      flexDirection: "row",
                      justifyContent: "space-around",
                      alignItems: "center",
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.themeBlue,
                        {
                          backgroundColor: "black",
                          borderColor: "#444",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => changeTheme("black")}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.themeText, { color: "#fff" }]}
                      >
                        siyah
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.themeBlue,
                        {
                          backgroundColor: "#ddd",
                          borderColor: "#444",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => changeTheme("light")}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.themeText, { color: "black" }]}
                      >
                        beyaz
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.themeBlue,
                        {
                          backgroundColor: "#444",
                          borderColor: "#222",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => changeTheme("gray")}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.themeText, { color: "#999" }]}
                      >
                        gri
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.themeBlue,
                        {
                          backgroundColor: "rgb(20, 28, 51)",
                          borderColor: "rgb(83, 116, 172)",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => changeTheme("blue")}
                    >
                      <Text
                        style={[
                          styles.themeText,
                          { color: "rgb(102, 129, 175)" },
                        ]}
                      >
                        mavi
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.themeBlue,
                        {
                          backgroundColor: "rgb(169,189,187)",
                          borderColor: "rgb(28, 79, 78)",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => changeTheme("green")}
                    >
                      <Text
                        style={[styles.themeText, { color: "rgb(28, 79, 78)" }]}
                      >
                        yeşil
                      </Text>
                    </TouchableOpacity>
                  </Reanimated.View>
                )}

                {settingsVisible && (
                  <Reanimated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutDown.duration(200)}
                    layout={LinearTransition.springify()}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 15,
                      gap: 10,
                      width: "100%",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.languageButton,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={() =>
                        toggleLanguage(language === "tr" ? "en" : "tr")
                      }
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: theme.notesColor.greenBackground,
                          borderRadius: 20,
                          paddingVertical: 2,
                          paddingHorizontal: 4,
                        }}
                      >
                        <MaterialIcons
                          name="translate"
                          size={12}
                          color={theme.notesColor.green}
                        />
                      </View>
                      <Text
                        style={[
                          styles.languageButtonText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {language.toUpperCase()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.genresStyle,
                        {
                          backgroundColor: theme.between,
                          borderColor: theme.border,
                          borderWidth: 1,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        },
                      ]}
                      onPress={() => {
                        animateLayout();
                        setThemeVisible(!themeVisible);
                      }}
                    >
                      <Text
                        style={[
                          styles.themeText,
                          { color: theme.text.primary },
                        ]}
                      >
                        Temalar
                      </Text>
                      {themeVisible ? (
                        <MaterialIcons
                          name="keyboard-arrow-down"
                          size={18}
                          color={theme.text.primary}
                        />
                      ) : (
                        <MaterialIcons
                          name="keyboard-arrow-up"
                          size={18}
                          color={theme.text.primary}
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.genresStyle,
                        {
                          backgroundColor: theme.between,
                          borderColor: theme.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={chooseGenres}
                    >
                      <MaterialCommunityIcons
                        name="movie-outline"
                        size={18}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.themeText,
                          { color: theme.text.primary },
                        ]}
                      >
                        İzlediğin türler
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.genresStyle,
                        {
                          backgroundColor: theme.between,
                          borderColor: theme.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={chooseGenresTv}
                    >
                      <Ionicons
                        name="tv-outline"
                        size={18}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.themeText,
                          { color: theme.text.primary },
                        ]}
                      >
                        İzlediğin türler
                      </Text>
                    </TouchableOpacity>
                  </Reanimated.View>
                )}

                <Animated.View
                  style={[
                    {
                      borderRadius: 20,
                      zIndex: -1,
                      backgroundColor: interpolateColor,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      width: "100%",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        animateLayout();
                        setSettingsVisible(!settingsVisible);
                        setThemeVisible(false);
                      }}
                      style={{
                        marginRight:
                          genres?.length > 0 || genresTv?.length > 0 ? 5 : 0,
                      }}
                    >
                      <Feather
                        name="settings"
                        size={24}
                        color={
                          settingsVisible
                            ? theme.text.primary
                            : theme.text.secondary
                        }
                      />
                    </TouchableOpacity>

                    {genres?.length > 0 || genresTv?.length > 0 ? (
                      <TouchableOpacity
                        style={{
                          backgroundColor: theme.between,
                          height: 35,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 10,
                          justifyContent: "center",
                          alignItems: "center",
                          zIndex: 1,
                        }}
                        onPress={
                          genres?.length > 0 ? chooseGenres : chooseGenresTv
                        }
                      >
                        {genres?.map((gen) => (
                          <Text
                            key={gen}
                            style={[
                              styles.themeText,
                              { color: theme.text.primary },
                            ]}
                          >
                            {gen}
                          </Text>
                        ))}
                        {genresTv?.map((gen) => (
                          <Text
                            key={gen}
                            style={[
                              styles.themeText,
                              { color: theme.text.primary },
                            ]}
                          >
                            {gen}
                          </Text>
                        ))}
                      </TouchableOpacity>
                    ) : null}

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text.primary,
                          width:
                            genres?.length > 0 || genresTv?.length > 0
                              ? "60%"
                              : "80%",
                        },
                      ]}
                      placeholder={
                        genres?.length > 0
                          ? t.ChatModal.placeholderGenresMovies
                          : genresTv?.length > 0
                            ? t.ChatModal.placeholderGenresTv
                            : t.ChatModal.placeholder
                      }
                      placeholderTextColor={theme.text.muted}
                      value={message}
                      onChangeText={setMessage}
                    />

                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        { backgroundColor: theme.border },
                      ]}
                      onPress={() => {
                        if (
                          message.trim() === "" &&
                          genres?.length <= 0 &&
                          genresTv?.length <= 0
                        ) {
                          return;
                        }
                        FetchData();
                        AddToArray(message);
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Ionicons
                          name="send"
                          size={24}
                          color={
                            message.length > 0
                              ? theme.text.primary
                              : theme.text.secondary
                          }
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            ) : (
              <>
                <View
                  style={{
                    width: "100%",
                    paddingVertical: 10,
                    paddingHorizontal: 15,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setHistory(false)}
                    style={styles.bacHistorykButton}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={32}
                      color={theme.text.primary}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.modalTitle, { color: theme.text.primary }]}
                  >
                    {t.ChatModal.history}
                  </Text>
                </View>

                <View>
                  {array.length > 0 ? (
                    <FlatList
                      style={{ maxHeight: 500 }}
                      data={array}
                      keyExtractor={(item, index) => `history-${index}`}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            setMessage(item);
                            setHistory(false);
                          }}
                          style={[
                            styles.item,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.primary,
                            },
                          ]}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{ color: theme.text.primary }}
                          >
                            {item}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  ) : (
                    <Text
                      allowFontScaling={false}
                      style={{ height: 150, color: theme.text.primary }}
                    >
                      {t.ChatModal.historyText}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => setArray([])}
                    style={styles.deleteButton}
                  >
                    <MaterialCommunityIcons
                      name="delete"
                      size={32}
                      color={theme.text.primary}
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Reanimated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 85,
    right: 25,
    borderRadius: 40,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  modalContent: {
    width: "95%",
    borderRadius: 20,
    bottom: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  item: {
    width: "95%",
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "gray",
    margin: 5,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 70,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1,
  },
  themeBlue: {
    width: 60,
    height: 35,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  genresStyle: {
    flexDirection: "row",
    alignItems: "center",
    height: 35,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    gap: 5,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  themeText: {
    fontSize: 8,
    fontWeight: "500",
    textAlign: "center",
  },
  input: {
    borderColor: "#ccc",
    borderRadius: 15,
    padding: 10,
  },
  sendButton: {
    backgroundColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 10,
    alignItems: "center",
  },
  deleteButton: {
    position: "absolute",
    bottom: 10,
    right: 0,
    left: 0,
    padding: 10,
    alignItems: "center",
  },
  bacHistorykButton: {
    position: "absolute",
    top: 0,
    left: 0,
    padding: 10,
    alignItems: "center",
    zIndex: 6,
  },
});
