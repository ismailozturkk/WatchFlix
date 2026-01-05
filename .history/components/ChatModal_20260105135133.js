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
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
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
  const [message, setMessage] = useState(""); // Mesaj için state
  const [sendMessage, setSendMessage] = useState(""); // Mesaj için state
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(false);
  const [array, setArray] = useState([]);
  const { t, language, toggleLanguage } = useLanguage();
  const [conversationHistory, setConversationHistory] = useState([]);
  const { selectedTheme, changeTheme, theme } = useTheme();
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
  const FetchData = async () => {
    if (genres?.length <= 0 && genresTv?.length <= 0 && message.trim() === "")
      return; // Boş mesaj gönderme

    setLoading(true);
    try {
      const apiKey = "AIzaSyCzAbcBtUz7eSmYkHSli-U4vWpcVnBlGFY"; // API anahtarınızı buraya ekleyin
      // Eğer modelin tam adı 'gemini-3.0-flash' ise:
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`; //!----------------------------------------------------------------

      // Kullanıcının mesajını önce geçmişe ekleyelim
      const updatedHistory = [
        ...conversationHistory,
        { role: "user", text: message },
      ];
      setConversationHistory(updatedHistory);
      const formattedHistory = conversationHistory
        .map((msg) => `${msg.role}: ${msg.text}`)
        .join("\n");
      //!----------------------------------------------------------------

      const data = {
        contents: [
          {
            parts: [
              {
                text:
                  genres.length > 0
                    ? `${genres} Recommend Movie According to These Types` +
                      message
                    : genresTv.length > 0
                    ? `${genresTv} Recommended Tv series According to These Types` +
                      message
                    : message,
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
              //text: `You are a film and TV series information assistant. Provide users with details such as the plot, cast, director, release date, and IMDb rating of movies and TV series. Additionally, offer suggestions for similar titles and inform about available streaming platforms. Always provide recommendations based solely on the information provided by the user. If a user simply asks for a film or series recommendation without providing additional details, generate a recommendation on your own without asking for further information.If there are previous messages, continue in a natural way based on previous messages. If a user asks about anything unrelated to films, TV series, or watchable content, respond with 'I cannot answer questions unrelated to films, TV series, or watchable content.' Respond in ${language}.`,
              text: `You are a film and TV series information assistant. Provide users with details such as the plot, cast, director, release date, and IMDb rating of movies and TV series. Additionally, offer suggestions for similar titles and inform about available streaming platforms. Always provide recommendations based solely on the information provided by the user. If a user simply asks for a film or series recommendation without providing additional details, generate a recommendation on your own without asking for further information. If there are previous messages, continue in a natural way based on previous messages. If a user asks about anything unrelated to films, TV series, or watchable content, respond with 'I cannot answer questions unrelated to films, TV series, or watchable content.' When mentioning or recommending a TV series, always format its name as < name >, and for movies, always format its name as -- name --. Respond in ${language}.`,
            },
          ],
        },
      };

      const result = await axios.post(url, data, {
        headers: { "Content-Type": "application/json" },
      });
      //!----------------------------------------------------------------
      const botResponse = JSON.stringify(
        FormatMessage(result.data.candidates[0].content.parts[0].text)
      );

      // Bot yanıtını geçmişe ekleyelim
      setConversationHistory((prevHistory) => [
        ...prevHistory,
        { role: "assistant", text: botResponse },
      ]);
      //!----------------------------------------------------------------

      setResponse(
        JSON.stringify(result.data.candidates[0].content.parts[0].text)
      );
      FormatMatchMessage(
        JSON.stringify(result.data.candidates[0].content.parts[0].text)
      );
      setSendMessage(message);
      setMessage("");
      setLoading(false);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  function FormatMessage(response) {
    if (response !== null) {
      return response
        .replace(/\\n/g, "\n") // \n yerine gerçek satır sonu koy
        .replace(/"/g, " ") // \n yerine gerçek satır sonu koy
        .replace(/\\\"/g, '"') // Kaçışlı tırnakları düzelt
        .replace(/\\/g, '"') // Kaçışlı tırnakları düzelt
        .replace(/\n\n/g, "\n") // Gereksiz boşlukları temizle
        .replace(/[<>]/g, "")
        .replace(/--/g, "")
        .trim();
      //.replace(/\*(.*?)\*/g, "$1") // Tek yıldızlı yazıları temizle
      //.replace(/\*\*(.*?)\*\*/g, "$1") // Kalın yazıları temizle // Başındaki ve sonundaki boşlukları kaldır
    } else {
      return response;
    }
  }
  const [movies, setMovies] = useState([]);
  const [tv, setTv] = useState([]);

  function FormatMatchMessage(response) {
    // Regex ile < > içindeki isimleri bul
    const extractedTv =
      response.match(/<([^>]+)>/g)?.map((name) => name.replace(/[<>]/g, "")) ||
      [];
    const extractedMovies =
      response.match(/--([^--]+)--/g)?.map((name) => name.replace(/--/g, "")) ||
      [];

    // Set ile tekrar edenleri kaldır ve diziye çevir
    const uniqueMovies = Array.from(new Set(extractedMovies));
    const uniqueTv = Array.from(new Set(extractedTv));

    // Önceki filmlerle birleştirip tekrar edenleri yine kaldır
    setTv((prevMovies) => Array.from(new Set([...prevMovies, ...uniqueTv])));
    setMovies((prevMovies) =>
      Array.from(new Set([...prevMovies, ...uniqueMovies]))
    );
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
      animation.setValue(0); // animasyonu başa sar
      loop = Animated.loop(
        Animated.timing(animation, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        })
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
      "#00FF00",
      "#0000FF",
      "#4B0082",
      "#EE82EE",
      "#FF0000",
      "#FFA500",
      "#FFFF00",
      "#00FF00",
    ],
  });

  return (
    <View>
      {!modalVisible && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              //backgroundColor: theme.ai,
              //borderColor: theme.border,
              //shadowColor: theme.shadow,
            },
          ]}
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
          {/*<MaterialCommunityIcons
          name="star-four-points-outline"
          size={24}
          color={theme.text.primary}
        />*/}
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
        <View style={styles.modalContainer}>
          <View style={{ flex: 1, width: "100%" }}></View>

          <TouchableOpacity
            onPress={() => {
              setModalVisible(false),
                setSettingsVisible(false),
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
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.secondary,
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
              experimentalBlurMethod="dimezisBlurView" // Android için sihirli kod
              style={StyleSheet.absoluteFill}
            />
            {!history ? (
              <View style={{ zIndex: 15 }}>
                {response !== null && response !== "" && (
                  <View
                    style={{
                      width: "100%",
                      maxHeight: 460,
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

                    <View
                      style={{
                        //height: "100%",
                        maxHeight: 360,
                        flexDirection: "row",
                        maxWidth: "100%",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                      }}
                    >
                      <Text
                        selectable={true}
                        style={{
                          maxWidth: "100%",
                          backgroundColor: theme.border,
                          padding: 5,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          color: theme.text.primary,
                        }}
                      >
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          <Markdown
                            style={{
                              body: {
                                width: "100%",
                                padding: 0,
                                color: theme.text.primary,
                              },
                              strong: {
                                fontWeight: "bold",
                                color: theme.bold,
                              },
                              em: {
                                fontStyle: "italic",
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
                              paragraph: {
                                marginVertical: 6,
                                flexWrap: "wrap",
                                flexDirection: "row",
                                width: "100%",
                              },

                              // Satır Sonları
                              hardbreak: {
                                width: "100%",
                                height: 1,
                              },
                              blockquote: {
                                backgroundColor: "#EFEFEF",
                                borderLeftWidth: 4,
                                borderLeftColor: "#888",
                                paddingHorizontal: 10,
                                marginVertical: 5,
                              },

                              // Listeler
                              bullet_list: {
                                paddingLeft: 10,
                              },
                              ordered_list: {
                                paddingLeft: 10,
                              },
                              list_item: {
                                flexDirection: "row",
                                alignItems: "flex-start",
                                marginBottom: 3,
                              },
                              bullet_list_icon: {
                                marginRight: 8,
                              },
                              ordered_list_icon: {
                                marginRight: 8,
                              },

                              // Tablolar
                              table: {
                                borderWidth: 1,
                                borderColor: "#444",
                                borderRadius: 5,
                                marginVertical: 10,
                              },
                              th: {
                                backgroundColor: "#DDD",
                                fontWeight: "bold",
                                padding: 8,
                              },
                              tr: {
                                borderBottomWidth: 1,
                                borderColor: "#CCC",
                                flexDirection: "row",
                              },
                              td: {
                                padding: 8,
                              },
                            }}
                          >
                            {FormatMessage(response)}
                          </Markdown>
                        </ScrollView>
                      </Text>
                      <View style={{ flexDirection: "column" }}>
                        <TouchableOpacity onPress={() => setHistory(true)}>
                          <MaterialIcons
                            name="history"
                            size={28}
                            color={theme.text.between}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setMovies([]), setTv([]), setResponse(null);
                          }}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={28}
                            color={theme.text.between}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      data={tv}
                      keyExtractor={(item, index) => index.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={{
                            height: 35,
                            marginHorizontal: 5,
                            paddingVertical: 3,
                            paddingHorizontal: 10,
                            backgroundColor: theme.border,
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
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={movies}
                      keyExtractor={(item, index) => index.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={{
                            height: 35,
                            marginHorizontal: 5,
                            paddingVertical: 3,
                            paddingHorizontal: 10,
                            backgroundColor: theme.border,
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
                  </View>
                )}
                {themeVisible && (
                  <View
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 15,
                      width: "100%",
                      flexDirection: "row",
                      gap: 10,
                      //justifyContent: "space-around",
                      alignItems: "center",
                      //backgroundColor: "red",
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
                      onPress={() => {
                        changeTheme("black");
                      }}
                    >
                      <Text style={[styles.themeText, { color: "#fff" }]}>
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
                      onPress={() => {
                        changeTheme("light");
                      }}
                    >
                      <Text style={[styles.themeText, { color: "black" }]}>
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
                      onPress={() => {
                        changeTheme("gray");
                      }}
                    >
                      <Text style={[styles.themeText, { color: "#999" }]}>
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
                      onPress={() => {
                        changeTheme("blue");
                      }}
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
                          backgroundColor: "rgb(255, 204, 183)",
                          borderColor: "rgb(242, 151, 63)",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => {
                        changeTheme("orange");
                      }}
                    >
                      <Text
                        style={[
                          styles.themeText,
                          { color: "rgb(240, 85, 13)" },
                        ]}
                      >
                        turuncu
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
                      onPress={() => {
                        changeTheme("green");
                      }}
                    >
                      <Text
                        style={[styles.themeText, { color: "rgb(28, 79, 78)" }]}
                      >
                        yeşil
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {settingsVisible && (
                  <View
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 15,
                      gap: 10,
                      width: "100%",
                      flexDirection: "row",
                      //justifyContent: "center",
                      alignItems: "center",
                      //backgroundColor: "red",
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.languageButton,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={() => {
                        toggleLanguage(language === "tr" ? "en" : "tr");
                      }}
                    >
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
                      onPress={() => setThemeVisible(!themeVisible)}
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
                      <Text
                        style={[
                          styles.themeText,
                          { color: theme.text.primary },
                        ]}
                      >
                        İzlediğin En Çok Film Türleri
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
                      <Text
                        style={[
                          styles.themeText,
                          { color: theme.text.primary },
                        ]}
                      >
                        İzlediğin En Çok Dizi Türleri
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Animated.View
                  style={[
                    {
                      borderRadius: 18,
                      zIndex: -1,
                      borderWidth: 2,
                      borderColor: interpolateColor,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      width: "100%",
                      justifyContent: "space-between",
                      alignItems: "center",
                      //backgroundColor: theme.secondary,
                      borderRadius: 17,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setSettingsVisible(!settingsVisible),
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
                        style={[
                          {
                            backgroundColor: theme.between,
                            //borderColor: "rgb(28, 79, 78)",
                            //borderWidth: 1,
                            //width: 40,
                            height: 35,
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 10,
                            justifyContent: "center",
                            alignItems: "center",
                            zIndex: 1,
                          },
                        ]}
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
                        FetchData();
                        AddToArray(message);
                      }}
                      disabled={loading} // Yükleniyorsa butonu devre dışı bırak
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
                    Height: 200,
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
                      style={{
                        maxHeight: 500,
                      }}
                      data={array}
                      keyExtractor={(item, index) => index.toString()}
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
                          <Text style={{ color: theme.text.primary }}>
                            {item}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  ) : (
                    <Text style={{ height: 150, color: theme.text.primary }}>
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
          </View>
        </View>
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
    //borderWidth: 1,
    //shadowOffset: {
    //  width: 0,
    //  height: 8,
    //},
    //shadowOpacity: 0.94,
    //shadowRadius: 10.32,
    //elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  modalContent: {
    width: "95%",
    backgroundColor: "#fff",
    borderRadius: 20,
    bottom: 10,
    //paddingVertical: 10,
    //paddingHorizontal: 15,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5, // Android için gölge
    shadowColor: "#000", // iOS için gölge
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
    width: 50,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1,
  },
  themeBlue: {
    width: 40,
    height: 35,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  genresStyle: {
    width: 60,
    height: 35,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  languageButtonText: {
    fontSize: 14,
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
  characterCount: {
    marginBottom: 10,
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
