import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Linking,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import axios from "axios";
import { DetailsSkeleton } from "../../components/Skeleton";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSnow } from "../../context/SnowContext";
import Toast from "react-native-toast-message";
import { getDoc, doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ListView from "../../components/ListView";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";
import RatingStars from "../../components/RatingStars";
import Reminder from "../../components/Reminder";

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Comment from "../../components/Comment";
const { width, height } = Dimensions.get("window");

export default function MovieDetails({ navigation, route }) {
  const { id } = route.params;
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullCast, setShowFullCast] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [reviewLenght, setReviewLenght] = useState(5);
  const [reviewTextLenght, setReviewTextLenght] = useState(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const { API_KEY, showSnow } = useAppSettings();

  // Modal ve tarih seçici state'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // Modal aç
  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };

  // Tarih seçici aç/kapat
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  // Tarih seçilince
  const handleConfirm = (date) => {
    setSelectedDate(formatDateSave(date));
    updateMovieList("watchedMovies", "movie", formatDateSave(date));
    hideDatePicker();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const calculateDateDifference = (airDate) => {
    if (!airDate) return null;

    const airDateTime = new Date(airDate).getTime();
    const currentTime = Date.now();
    const difference = airDateTime - currentTime;

    // If air date is in the past
    if (difference < 0) {
      return {
        text: formatDate(airDate),
        isRemaining: false,
      };
    }

    // If air date is in the future
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;

    let text;
    if (months > 0) {
      text =
        remainingDays > 0
          ? `${months} ${months === 1 ? t.month : t.month} ${remainingDays} ${remainingDays === 1 ? t.days : t.days}`
          : `${months} ${months === 1 ? t.month : t.month}`;
    } else if (days > 0) {
      text = `${days} ${days === 1 ? t.days : t.days}`;
    } else {
      text = t.today;
    }

    return {
      text,
      isRemaining: true,
    };
  };
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};

    // Tüm önerilen ve benzer filmleri birleştir
    const recommended = details?.recommendations?.results || [];
    const similar = details?.similar?.results || [];
    const allMovies = [...recommended.slice(0, 20), ...similar.slice(0, 20)];

    allMovies.forEach((item) => {
      if (item && item.id) {
        newScaleValues[item.id] = new Animated.Value(1);
      }
    });

    setScaleValues(newScaleValues);
  }, [details]);
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
    const fetchDetails = async () => {
      setLoading(true);
      const options = {
        method: "GET",
        url: `https://api.themoviedb.org/3/movie/${id}`,
        params: {
          language: language === "tr" ? "tr-TR" : "en-US",
          append_to_response:
            "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,release_dates,reviews,similar,translations,videos,watch/providers",
        },
        headers: {
          accept: "application/json",
          Authorization: API_KEY,
        },
      };

      try {
        const response = await axios.request(options);
        setDetails(response.data);
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "error:" + error,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, language]);
  //!

  const [isReminderSet, setIsReminderSet] = useState(false);
  const uid = user?.uid;
  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!user.uid || !id) return;

    const docRef = doc(db, "Reminders", user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const movieReminders = data.movieReminders || [];
        setIsReminderSet(
          movieReminders.some(
            (movie) => movie.movieId === id && movie.type === "movie"
          )
        );
      } else {
        setIsReminderSet(false);
      }
    });

    return () => unsubscribe();
  }, [user.uid, id]);

  const addReminder = async () => {
    try {
      if (!user) return;

      const reminderRef = doc(db, "Reminders", uid);
      const reminderDoc = await getDoc(reminderRef);

      // Movie için
      const movieData = {
        movieId: details.id || "",
        movieName: details.title || "",
        releaseDate: details.release_date || "",
        movieMinutes: details.runtime || 0,
        posterPath: details.poster_path || null,
        type: "movie",
        createdAt: formatDateSave(new Date()),
      };

      let movieReminders = [];
      if (reminderDoc.exists()) {
        movieReminders = reminderDoc.data().movieReminders || [];
      }

      const movieIndex = movieReminders.findIndex(
        (item) => item.movieId === details.id
      );

      if (movieIndex === -1 && !isReminderSet) {
        movieReminders.push(movieData);
      } else if (movieIndex !== -1 && isReminderSet) {
        movieReminders.splice(movieIndex, 1);
      }

      if (!reminderDoc.exists()) {
        await setDoc(reminderRef, {
          tvReminders: [],
          movieReminders,
          updatedAt: formatDateSave(new Date()),
        });
      } else {
        await updateDoc(reminderRef, {
          movieReminders,
          updatedAt: formatDateSave(new Date()),
        });
      }

      setIsReminderSet(!isReminderSet);
      Toast.show({
        type: isReminderSet ? "warning" : "success",
        text1: isReminderSet
          ? "Hatırlatma kaldırıldı"
          : "Hatırlatma başarıyla eklendi",
      });
    } catch (error) {
      console.error("Error adding reminder:", error);
      Toast.show({
        type: "error",
        text1: "Hatırlatma eklenirken bir hata oluştu",
      });
    }
  };
  //!
  const updateMovieList = async (listType, type, date = null) => {
    if (!user.uid || !details) {
      Toast.show({
        type: "error",
        text1: "Kullanıcı veya içerik bilgisi eksik!",
      });
      return;
    }

    const docRef = doc(db, "Lists", user.uid);

    try {
      closeModal();

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

      let selectedList = data[listType] || [];

      const movieIndex = selectedList.findIndex(
        (item) => item.id === details.id && item.type === type
      );
      const getListTypeName = (list) => {
        switch (list) {
          case "favorites":
            return t.favorites;
          case "watchList":
            return t.watchList;
          case "watchedMovies":
            return t.watchedMovies;
          case "watchedTv":
            return t.watchedTv;
          default:
            return listType;
        }
      };
      if (movieIndex !== -1) {
        selectedList.splice(movieIndex, 1);
        Toast.show({
          type: "warning",
          text1: `${
            type === "movie" ? "Film" : "Dizi"
          } ${getListTypeName(listType)} listesinden kaldırıldı!`,
        });
      } else {
        // Tarih seçilmeden ekleme yapılmasın
        if (!date) {
          Toast.show({
            type: "warning",
            text1: "Lütfen bir tarih seçin.",
          });
          return;
        }
        const newItem = {
          id: details.id,
          imagePath: details.poster_path,
          dateAdded: date, // <-- Tarih burada kaydediliyor
          name: type === "movie" ? details.title : details.name,
          minutes: type === "movie" ? details.runtime : undefined,
          type: type,
          genres: details.genres ? details.genres.map((g) => g.name) : [], // <-- EKLENDİ
        };
        selectedList.push(newItem);
        Toast.show({
          type: "success",
          text1: `${
            type === "movie" ? "Film" : "Dizi"
          } ${getListTypeName(listType)} listesine eklendi!`,
        });
      }
      await updateDoc(docRef, { [listType]: selectedList });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Hata: " + error.message,
      });
    }
  };
  //?--------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------
  //!bir özellik eklemek için kullanırsın
  // const updateGenres = async ({ showId, genres }) => {
  //   try {
  //     const userRef = doc(db, "Lists", user.uid);
  //     const docSnap = await getDoc(userRef);

  //     let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
  //     let watchedMovies = data.watchedMovies || [];

  //     let tvShowIndex = watchedMovies.findIndex((show) => show.id === showId);
  //     console.log("tvShowIndex", tvShowIndex);
  //     console.log("showId", showId);

  //     // Eğer dizi içinde show bulunursa güncelle
  //     if (tvShowIndex !== -1) {
  //       watchedMovies[tvShowIndex].genres = genres
  //         ? genres.map((g) => g.name)
  //         : [];
  //     } else {
  //       // Yoksa yeni bir kayıt olarak ekle
  //       watchedMovies.push({
  //         id: showId,
  //         genres: genres ? genres.map((g) => g.name) : [],
  //       });
  //     }

  //     await updateDoc(userRef, { watchedMovies });
  //   } catch (error) {
  //     console.error("Hata:", error);
  //   }
  // };
  //?--------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------

  const [listStates, setListStates] = useState({});

  useEffect(() => {
    if (!user.uid || !id) return;

    const docRef = doc(db, "Lists", user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const newStates = {};

        Object.entries(data).forEach(([listName, listItems]) => {
          newStates[listName] = Array.isArray(listItems)
            ? listItems.some((item) => item.id === id && item.type === "movie")
            : false;
        });

        setListStates(newStates);
      } else {
        setListStates({});
      }
    });

    return () => unsubscribe();
  }, [user.uid, id]);

  const renderCastMember = ({ item }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => {
        navigation.navigate("ActorViewScreen", {
          personId: item.id,
        });
      }}
    >
      <View style={styles.castItem}>
        <Image
          source={
            item.profile_path
              ? { uri: `https://image.tmdb.org/t/p/w500${item.profile_path}` }
              : require("../../assets/image/user.png")
          }
          style={[styles.castImage, { shadowColor: theme.shadow }]}
        />
        <Text style={[styles.castName, { color: theme.text.primary }]}>
          {item.name}
        </Text>
        <Text style={[styles.castCharacter, { color: theme.text.muted }]}>
          {item.character}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSimilarMovie = ({ item }) => (
    <Animated.View
      style={{ transform: [{ scale: scaleValues[item.id] || 1 }] }}
    >
      <TouchableOpacity
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        activeOpacity={0.8}
        style={styles.similarItem}
        onPress={() => navigation.push("MovieDetails", { id: item.id })}
      >
        <Image
          source={
            item.poster_path
              ? { uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }
              : require("../../assets/image/no_image.png")
          }
          style={[styles.similarPoster, { shadowColor: theme.shadow }]}
        />
        <Text
          style={[styles.similarTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View
          style={[styles.similarRating, { backgroundColor: theme.secondaryt }]}
        >
          <Text style={styles.similarRatingText}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderVideo = ({ item }) => (
    <TouchableOpacity
      style={styles.videoItem}
      onPress={() => setSelectedVideo(item.key)}
    >
      <View style={[styles.videoThumbnail, { shadowColor: theme.shadow }]}>
        <Image
          source={{
            uri: `https://img.youtube.com/vi/${item.key}/hqdefault.jpg`,
          }}
          style={styles.videoImage}
        />
        <View style={styles.playIconContainer}>
          <LottieView
            style={{ width: 80, height: 80 }}
            source={require("../../LottieJson/play")}
            opacity={0.4}
            autoPlay
            loop
          />
        </View>
      </View>
      <Text
        style={[styles.videoTitle, { color: theme.text.primary }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Text style={[styles.videoType, { color: theme.text.muted }]}>
        {item.type}
      </Text>
    </TouchableOpacity>
  );

  const renderExternalLink = (url, icon, name) => {
    if (!url) return null;
    return (
      <TouchableOpacity
        style={[styles.externalLink, { backgroundColor: theme.accent }]}
        onPress={() => Linking.openURL(url)}
      >
        <FontAwesome5 name={icon} size={20} color="#fff" />
        <Text style={styles.externalLinkText}>{name}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <DetailsSkeleton />;
  }
  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text.primary }]}>
          Yükleniyor...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.primary }]}
        nestedScrollEnabled={true}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.headerContainer}>
          {details.backdrop_path ? (
            <TouchableOpacity onPress={() => setBacdropModalVisible(true)}>
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                }}
                style={styles.backdrop}
              />
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.noImageContainer,
                { backgroundColor: theme.secondary },
              ]}
            >
              <Ionicons name="image" size={180} color={theme.text.muted} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", theme.primary]}
            style={styles.gradient}
          />
        </View>
        <View style={[styles.content, { backgroundColor: theme.primary }]}>
          <LottieView
            style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
            source={require("../../LottieJson/snow.json")}
            autoPlay={true}
            loop
          />
          <LottieView
            style={[styles.lottie0, { display: showSnow ? "flex" : "none" }]}
            source={require("../../LottieJson/snow.json")}
            autoPlay={true}
            loop
          />
          <LottieView
            style={[styles.lottie1, { display: showSnow ? "flex" : "none" }]}
            source={require("../../LottieJson/snow.json")}
            autoPlay={true}
            loop
          />
          <LottieView
            style={[styles.lottie2, { display: showSnow ? "flex" : "none" }]}
            source={require("../../LottieJson/snow.json")}
            autoPlay={true}
            loop
          />
          <View style={styles.header}>
            <View style={[styles.posterView, { shadowColor: theme.shadow }]}>
              {details.poster_path ? (
                <TouchableOpacity onPress={() => setPosterModalVisible(true)}>
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
                    }}
                    style={[
                      styles.poster,
                      {
                        borderColor: theme.border,
                        borderWidth: 1,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.noPosterContainer,
                    { backgroundColor: theme.secondary },
                  ]}
                >
                  <Ionicons name="image" size={80} color={theme.text.muted} />
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {details.title}
              </Text>
              {details.alternative_titles?.titles?.length > 0 && (
                <Text
                  style={[
                    styles.alternativeTitle,
                    { color: theme.text.secondary },
                  ]}
                >
                  {details.alternative_titles.titles[0].title}
                </Text>
              )}
              <Text style={[styles.tagline, { color: theme.text.secondary }]}>
                {details.tagline || "Slogan bulunmuyor"}
              </Text>
              <View style={styles.genres}>
                {details.genres.map((genre) => (
                  <View
                    key={genre.id}
                    style={[styles.genreTag, { backgroundColor: theme.accent }]}
                  >
                    <Text
                      style={[styles.genreText, { color: theme.text.primary }]}
                    >
                      {genre.name}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.mainRating}>
                <RatingStars rating={details.vote_average} />
                <Text
                  style={[styles.ratingText, { color: theme.colors.orange }]}
                >
                  {" "}
                  {details.vote_average.toFixed(1)}{" "}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "baseline",
                    gap: 3,
                  }}
                >
                  <FontAwesome
                    name="user"
                    size={14}
                    color={theme.colors.blue}
                  />
                  <Text
                    style={[styles.ratingText, { color: theme.colors.blue }]}
                  >
                    {" "}
                    {details.vote_count || 0}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={{ top: -90 }}>
            <ListView
              isRemaining={
                calculateDateDifference(details.release_date)?.isRemaining
              }
              isReminderSet={isReminderSet}
              updateList={updateMovieList}
              updateWatchedList={openModal}
              addReminder={addReminder}
              navigation={navigation}
              listStates={listStates}
              type={"movie"}
            />

            <View
              style={[
                styles.stats,
                { backgroundColor: theme.secondary, shadowColor: theme.shadow },
              ]}
            >
              <View style={styles.statItem}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  {/* Tarih kontrolü eklendi */}
                  {details.release_date &&
                  calculateDateDifference(details.release_date) ? (
                    <>
                      <Text
                        style={[
                          styles.statValue,
                          { color: theme.text.primary },
                        ]}
                      >
                        {calculateDateDifference(details.release_date).text}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[styles.statValue, { color: theme.text.primary }]}
                    >
                      {t.dateUnknown || "Tarih belirsiz"}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.statLabel, { color: theme.text.secondary }]}
                >
                  {t.date}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {details.runtime}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.text.secondary }]}
                >
                  {t.duration}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {details.revenue > 0
                    ? `${(details.revenue / 1000000).toFixed(1)}M$`
                    : "?"}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.text.secondary }]}
                >
                  {t.revenue}
                </Text>
              </View>
            </View>

            {details.external_ids && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.externalLinks}>
                  {renderExternalLink(
                    details.external_ids.imdb_id
                      ? `https://www.imdb.com/title/${details.external_ids.imdb_id}`
                      : null,
                    "imdb",
                    "IMDb"
                  )}
                  {renderExternalLink(
                    details.external_ids.facebook_id
                      ? `https://www.facebook.com/${details.external_ids.facebook_id}`
                      : null,
                    "facebook",
                    "Facebook"
                  )}
                  {renderExternalLink(
                    details.external_ids.instagram_id
                      ? `https://www.instagram.com/${details.external_ids.instagram_id}`
                      : null,
                    "instagram",
                    "Instagram"
                  )}
                  {renderExternalLink(
                    details.external_ids.twitter_id
                      ? `https://twitter.com/${details.external_ids.twitter_id}`
                      : null,
                    "twitter",
                    "Twitter"
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: theme.text.primary }]}
              >
                {t.overview}
              </Text>
              <Text style={[styles.overview, { color: theme.text.secondary }]}>
                {details.overview || "Özet bulunmuyor."}
              </Text>
            </View>
            {"watch/providers" in details &&
              details["watch/providers"].results.TR && (
                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.text.primary }]}
                  >
                    {t.watchProviders}
                  </Text>
                  <View style={styles.watchProviders}>
                    {details["watch/providers"].results.TR.flatrate?.map(
                      (provider) => (
                        <View
                          key={provider.provider_id}
                          style={styles.providerItem}
                        >
                          <Image
                            source={{
                              uri: `https://image.tmdb.org/t/p/original${provider.logo_path}`,
                            }}
                            style={styles.providerLogo}
                          />
                          <Text
                            style={[
                              styles.providerName,
                              { color: theme.text.primary },
                            ]}
                          >
                            {provider.provider_name}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}
            {details.videos?.results.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text.primary }]}
                >
                  {t.videos}
                </Text>

                <FlatList
                  data={details.videos.results.filter(
                    (video) => video.site === "YouTube"
                  )}
                  renderItem={renderVideo}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.videosList}
                />
              </View>
            )}

            {details.credits?.cast.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.text.primary }]}
                  >
                    {t.cast}
                  </Text>
                  {details.credits.cast.length > 6 && (
                    <TouchableOpacity
                      onPress={() => setShowFullCast(!showFullCast)}
                    >
                      <Text
                        style={[
                          styles.expandButton,
                          { color: theme.text.primary },
                        ]}
                      >
                        {showFullCast ? t.collapse : t.showAll}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={
                    showFullCast
                      ? details.credits.cast
                      : details.credits.cast.slice(0, 6)
                  }
                  renderItem={renderCastMember}
                  keyExtractor={(item) => item.id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castList}
                />
              </View>
            )}

            {details.keywords?.keywords.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text.primary }]}
                >
                  {t.keywords}
                </Text>
                <View style={styles.keywords}>
                  {details.keywords.keywords.map((keyword, index) =>
                    index < 10 ? (
                      <View
                        key={keyword.id}
                        style={[
                          styles.keywordTag,
                          { backgroundColor: theme.accent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.keywordText,
                            { color: theme.text.primary },
                          ]}
                        >
                          {keyword.name}
                        </Text>
                      </View>
                    ) : (
                      showAllKeywords && (
                        <View
                          key={keyword.id}
                          style={[
                            styles.keywordTag,
                            { backgroundColor: theme.accent },
                          ]}
                        >
                          <Text
                            style={[
                              styles.keywordText,
                              { color: theme.text.primary },
                            ]}
                          >
                            {keyword.name}
                          </Text>
                        </View>
                      )
                    )
                  )}
                </View>
                {details.keywords?.keywords.length > 10 && (
                  <TouchableOpacity
                    onPress={() => setShowAllKeywords(!showAllKeywords)}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    {showAllKeywords ? (
                      <MaterialIcons
                        name="keyboard-arrow-up"
                        size={40}
                        color={theme.text.primary}
                        style={{
                          width: 40,
                          backgroundColor: theme.secondary,
                          borderRadius: 15,
                          shadowColor: theme.shadow,
                          shadowOffset: {
                            width: 0,
                            height: 8,
                          },
                          shadowOpacity: 0.94,
                          shadowRadius: 10.32,
                          elevation: 5,
                        }}
                      />
                    ) : (
                      <MaterialIcons
                        name="keyboard-arrow-down"
                        size={40}
                        color={theme.text.primary}
                        style={{
                          width: 40,
                          backgroundColor: theme.secondary,
                          borderRadius: 15,
                          shadowColor: theme.shadow,
                          shadowOffset: {
                            width: 0,
                            height: 8,
                          },
                          shadowOpacity: 0.94,
                          shadowRadius: 10.32,
                          elevation: 5,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
            {details.recommendations?.results.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text.primary }]}
                >
                  {t.recommendedMovies}
                </Text>
                <FlatList
                  data={details.recommendations.results.slice(0, 20)}
                  renderItem={renderSimilarMovie}
                  keyExtractor={(item) => item.id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.similarList}
                />
              </View>
            )}
            {details.similar?.results.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text.primary }]}
                >
                  {t.similarMovies}
                </Text>
                <FlatList
                  data={details.similar.results.slice(0, 20)}
                  renderItem={renderSimilarMovie}
                  keyExtractor={(item) => item.id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.similarList}
                />
              </View>
            )}

            {details.reviews?.results.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.text.primary }]}
                >
                  {t.reviews}
                </Text>
                {details.reviews.results
                  .slice(0, reviewLenght)
                  .map((review) => (
                    <View
                      key={review.id}
                      style={[
                        styles.reviewItem,
                        {
                          backgroundColor: theme.secondary,
                          shadowColor: theme.shadow,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          setReviewTextLenght(
                            review.id == reviewTextLenght ? null : review.id
                          )
                        }
                      >
                        <View style={styles.reviewHeader}>
                          <Text
                            style={[
                              styles.reviewAuthor,
                              { color: theme.text.primary },
                            ]}
                          >
                            {review.author}
                          </Text>
                          <Text
                            style={[
                              styles.reviewDate,
                              { color: theme.text.secondary },
                            ]}
                          >
                            {review.created_at &&
                            !isNaN(new Date(review.created_at).getTime())
                              ? new Date(review.created_at).toLocaleDateString()
                              : ""}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.reviewContent,
                            { color: theme.text.secondary },
                          ]}
                          numberOfLines={
                            review.id === reviewTextLenght ? null : 2
                          }
                        >
                          {review.content}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                {details.reviews?.results.length > 5 ? (
                  <TouchableOpacity
                    onPress={() =>
                      setReviewLenght(
                        details.reviews?.results.length === reviewLenght
                          ? 5
                          : details.reviews?.results.length
                      )
                    }
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    {reviewLenght > 5 ? (
                      <MaterialIcons
                        name="keyboard-arrow-up"
                        size={40}
                        color={theme.text.primary}
                        style={{
                          width: 40,
                          backgroundColor: theme.secondary,
                          borderRadius: 15,
                          shadowColor: theme.shadow,
                          shadowOffset: {
                            width: 0,
                            height: 8,
                          },
                          shadowOpacity: 0.94,
                          shadowRadius: 10.32,
                          elevation: 5,
                        }}
                      />
                    ) : (
                      <MaterialIcons
                        name="keyboard-arrow-down"
                        size={40}
                        color={theme.text.primary}
                        style={{
                          width: 40,
                          backgroundColor: theme.secondary,
                          borderRadius: 15,
                          shadowColor: theme.shadow,
                          shadowOffset: {
                            width: 0,
                            height: 8,
                          },
                          shadowOpacity: 0.94,
                          shadowRadius: 10.32,
                          elevation: 5,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </View>
        //!------------------------------------------------------------------------------------------------------------------
        <Modal animationType="slide" transparent={true} visible={modalVisible}>
          <KeyboardAvoidingView
            style={{
              flex: 1,
              justifyContent: "flex-end",
            }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity style={{ flex: 1 }} onPress={closeModal} />
            <Comment contextId={id} />
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>

      <Modal
        visible={selectedVideo !== null}
        onRequestClose={() => setSelectedVideo(null)}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainerVideo}>
          <LinearGradient
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0)",
            ]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          />
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
            onPress={() => setSelectedVideo(null)}
          />
          <View style={styles.modalContentVideo}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedVideo(null)}
            >
              <FontAwesome5 name="times" size={24} color="#fff" />
            </TouchableOpacity>
            {selectedVideo && (
              <WebView
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                source={{
                  uri: `https://www.youtube.com/embed/${selectedVideo}?rel=0&autoplay=1`,
                }}
                allowsFullscreenVideo={true}
              />
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={modalVisible} // artık state'e bağlı
        onRequestClose={closeModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0.7)",
              "rgba(0,0,0,0.9)",
            ]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          />
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
            onPress={closeModal}
          />
          <View
            style={[styles.modalContent, { backgroundColor: theme.secondary }]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 5,
              }}
            >
              {/* İleride başka seçenekler de ekleyebilirsin */}
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={showDatePicker}
              >
                <Ionicons
                  name="calendar-outline"
                  size={48}
                  color={theme.text.primary}
                />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  {selectedDate
                    ? formatDateSave(selectedDate)
                    : "Tarih seçiniz"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={() =>
                  updateMovieList(
                    "watchedMovies",
                    "movie",
                    formatDateSave(new Date())
                  )
                }
              >
                <Entypo name="stopwatch" size={48} color={theme.text.primary} />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  Şimdi
                </Text>
                <Text
                  style={[
                    styles.inputTextDate,
                    { color: theme.text.secondary },
                  ]}
                >
                  {formatDate(new Date())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={() =>
                  updateMovieList(
                    "watchedMovies",
                    "movie",
                    formatDateSave(new Date(details.release_date))
                  )
                }
              >
                <MaterialCommunityIcons
                  name="movie-play-outline"
                  size={48}
                  color={theme.text.primary}
                />
                <Text style={[styles.inputText, { color: theme.text.primary }]}>
                  Yayınlanma Tarih
                </Text>
                <Text
                  style={[
                    styles.inputTextDate,
                    { color: theme.text.secondary },
                  ]}
                >
                  {formatDate(details.release_date)}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                minimumDate={new Date(details.release_date)} // 1 Ocak 2000'den önce seçilemez
                maximumDate={new Date()} // Bugünden ileri seçilemez
              />

              {/* Buraya başka butonlar veya seçenekler ekleyebilirsin */}
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={PosterModalVisible || backdropModalVisible} // artık state'e bağlı
        onRequestClose={() => {
          setPosterModalVisible(false), setBacdropModalVisible(false);
        }}
        animationType="fade"
        transparent={true}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.8)",
            "rgba(0,0,0,0.8)",
            "rgba(0,0,0,0.8)",
            "rgba(0,0,0,0.8)",
            "rgba(0,0,0,0.8)",
            "rgba(0,0,0,0.8)",
            "transparent",
          ]}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
          }}
        />
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: 0,
            bottom: 0,
          }}
          onPress={() => {
            setPosterModalVisible(false), setBacdropModalVisible(false);
          }}
        />
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Image
            source={
              PosterModalVisible
                ? {
                    uri: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
                  }
                : {
                    uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                  }
            }
            style={[
              {
                width: PosterModalVisible ? 360 : 380,
                height: PosterModalVisible ? 540 : 300,
                borderRadius: 20,
              },
            ]}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  headerContainer: {
    height: 300,
    position: "relative",
  },
  backdrop: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie0: {
    position: "absolute",
    height: 1000,
    top: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie1: {
    position: "absolute",
    height: 1000,
    top: 2000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie2: {
    position: "absolute",
    height: 1000,
    top: 3000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  header: {
    flexDirection: "row",
    top: -100,
    left: 0,
    right: 0,
  },
  posterView: {
    width: 120,
    height: 180,
    marginRight: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  poster: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 10,
  },
  noPosterContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  tagline: {
    fontSize: 14,
    marginBottom: 10,
  },
  genres: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 5,
  },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  genreText: {
    fontSize: 12,
  },
  mainRating: {
    alignItems: "center",
    flexDirection: "row",
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "500",
  },
  voteCount: {
    fontSize: 14,
    marginTop: 5,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,

    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  expandButton: {
    fontSize: 14,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
  },
  keywords: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  keywordTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  keywordText: {
    fontSize: 12,
  },
  castList: {
    paddingVertical: 10,
  },
  castItem: {
    width: width * 0.25,
    marginRight: 15,
    alignItems: "center",
  },
  castImage: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
    marginBottom: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  castName: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 2,
  },
  castCharacter: {
    color: "#999",
    fontSize: 11,
    textAlign: "center",
  },
  similarList: {
    paddingVertical: 10,
  },
  similarItem: {
    width: width * 0.3,
    marginRight: 10,
  },
  similarPoster: {
    width: width * 0.3,
    height: width * 0.45,
    borderRadius: 10,
    marginBottom: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 5,
  },
  similarRating: {
    position: "absolute",
    bottom: 45,
    right: 5,
    width: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  reviewItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  reviewAuthor: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  reviewDate: {
    color: "#999",
    fontSize: 12,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewContent: {
    color: "#bbb",
    fontSize: 13,
    lineHeight: 18,
  },
  alternativeTitle: {
    color: "#999",
    fontSize: 14,
    marginBottom: 5,
  },
  videosList: {
    paddingVertical: 10,
  },
  videoItem: {
    height: height * 0.2,
    width: width * 0.5,
    marginRight: 15,
  },
  videoThumbnail: {
    position: "relative",
    width: "100%",
    height: "65%",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  videoImage: {
    width: "100%",
    height: "100%",
  },
  playIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  videoTitle: {
    color: "#fff",
    fontSize: 14,
    marginTop: 5,
  },
  videoType: {
    color: "#999",
    fontSize: 12,
    marginTop: 2,
  },
  externalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  externalLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#333",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  externalLinkText: {
    color: "#fff",
    fontSize: 14,
  },
  watchProviders: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  providerItem: {
    alignItems: "center",
    width: width * 0.2,
  },
  providerLogo: {
    width: width * 0.15,
    height: width * 0.15,
    borderRadius: 10,
  },
  providerName: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
  modalContainerVideo: {
    flex: 1,
    //backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
  },
  modalContentVideo: {
    height: width * 0.5625, // 16:9 aspect ratio
    backgroundColor: "#000",
    position: "relative",
  },
  webview: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: -40,
    right: 10,
    zIndex: 1,
    padding: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#222",
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    padding: 18,

    alignItems: "center",
  },
  input: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    minWidth: 100,
    gap: 5,
    alignItems: "center",
  },

  inputText: {
    fontSize: 14,
    color: "#fff",
  },
  inputTextDate: {
    fontSize: 12,
    color: "#999",
  },
});
