import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Modal,
  Button,
  Animated,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { DetailsSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import TVShowItem from "../../components/TVShowItem";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSnow } from "../../context/SnowContext";
import {
  collection,
  getDoc,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Toast from "react-native-toast-message";
import ListView from "../../components/ListView";
import SeasonItem from "./SeasonItem";
const { height, width } = Dimensions.get("window");
import * as Progress from "react-native-progress";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import WebView from "react-native-webview";
import Entypo from "@expo/vector-icons/Entypo";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ListViewTv from "../../components/ListViewTv";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";

export default function TvShowsDetails({ route, navigation }) {
  const { id } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [numberOfLines, setNumberOfLines] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [check, setChecked] = useState(false);
  const { user } = useAuth();
  const [watched, setWatched] = useState(false);

  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const { API_KEY, showSnow } = useAppSettings();
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
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
            ? listItems.some((item) => item.id === id && item.type === "tv")
            : false;
        });

        setListStates(newStates);
      } else {
        setListStates({});
      }
    });

    return () => unsubscribe();
  }, [user.uid, id]);

  const updateTvSeriesList = async (listType, type) => {
    if (!user.uid || !details) {
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
        (item) => item.id === details.id && item.type === type
      );
      const getListTypeName = (list) => {
        switch (list) {
          case "favorites":
            return t.tvShowsDetails.favorites;
          case "watchList":
            return t.tvShowsDetails.watchList;
          case "watchedMovies":
            return t.tvShowsDetails.watched;
          case "watchedTv":
            return t.tvShowsDetails.watchedTv;
          default:
            return listType;
        }
      };
      if (movieIndex !== -1) {
        // İçerik varsa, kaldır
        selectedList.splice(movieIndex, 1);
        Toast.show({
          type: "warning",
          text1:
            `${type === "tv" ? "Dizi" : "Film"} ${getListTypeName(listType)} ` +
            t.tvShowsDetails.toastDell,
        });
      } else {
        // İçerik yoksa, ekle
        const newMovie = {
          id: details.id,
          dateAdded: formatDateSave(new Date()),
          imagePath: details.poster_path,
          name: details.name,
          type: type, // **Burada type kaydediyoruz!**
          genres: details.genres ? details.genres.map((g) => g.name) : [], // <-- EKLENDİ,
        };
        selectedList.push(newMovie);
        Toast.show({
          type: "success",
          text1:
            `${type === "tv" ? "Dizi" : "Film"} ${getListTypeName(listType)} ` +
            t.tvShowsDetails.toastAdd,
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

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      const options = {
        method: "GET",
        url: `https://api.themoviedb.org/3/tv/${id}`,
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
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, language]);
  const [isSeasonWatched, setIsSeasonWatched] = useState();
  const [showEpisodeCount, setShowEpisodeCount] = useState();
  const [showEpisodes, setShowEpisodes] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [reviewLenght, setReviewLenght] = useState(5);
  const [reviewTextLenght, setReviewTextLenght] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const checkIfWatched = () => {
    if (!user || !id) return; // 🛑 Hatalı durumları engelle

    const userRef = doc(db, "Lists", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const watchedTv = data.watchedTv || [];
          const tvShow = watchedTv.find((show) => show.id === id);

          if (tvShow) {
            const showEpisodeCount = tvShow.showEpisodeCount;
            // const showEpisodes = tvShow.episodeCount;
            const showEpisodes = Array.isArray(tvShow.seasons)
              ? tvShow.seasons.reduce(
                  (acc, season) =>
                    acc + (season.episodes ? season.episodes.length : 0),
                  0
                )
              : 0;
            setShowEpisodeCount(showEpisodeCount);
            setShowEpisodes(showEpisodes);
            if (showEpisodeCount && showEpisodes) {
              setIsSeasonWatched(showEpisodes / showEpisodeCount);
            } else {
              setIsSeasonWatched(0);
            }
          } else {
            setShowEpisodeCount();
            setShowEpisodes();
            setIsSeasonWatched(0);
          }
        } else {
          console.error("docSnap.exists() false");
        }
      },
      (error) => {
        console.error("Hata:", error);
      }
    );

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = checkIfWatched();
    return () => unsubscribe && unsubscribe();
  }, [user, id]);
  //?--------------------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------------------
  // Modal ve tarih seçici state'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const showReleaseDateTime = new Date(details?.first_air_date);

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
    setSelectedDate(date);
    addShowToFirestore(date);
    hideDatePicker();
  };

  const addShowToFirestore = async (selectedDate = null) => {
    if (!user || !details || !details.seasons || !selectedDate) return;

    try {
      setIsLoading(true);
      closeModal();

      const userRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(userRef);

      let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
      let watchedTv = data.watchedTv || [];
      let tvShowIndex = watchedTv.findIndex((show) => show.id === details.id);

      const episodeDate = formatDateSave(selectedDate);

      if (tvShowIndex !== -1) {
        // Eğer daha önce eklenmişse sil ve çık
        watchedTv.splice(tvShowIndex, 1);
        await updateDoc(userRef, { watchedTv });
        Toast.show({
          type: "warning",
          text1: "Dizi izleme listesinden silindi",
        });
        checkIfWatched();
        return;
      }

      const newShow = {
        id: details.id,
        name: details.name,
        showEpisodeCount: details.number_of_episodes,
        showSeasonCount: details.number_of_seasons,
        imagePath: details.poster_path,
        type: "tv",
        addedShowDate: episodeDate,
        genres: details.genres ? details.genres.map((g) => g.name) : [],
        seasons: [],
      };

      for (const seasonObj of details.seasons) {
        if (!seasonObj.season_number || seasonObj.episode_count === 0) continue;

        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${details.id}/season/${seasonObj.season_number}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: {
              accept: "application/json",
              Authorization: API_KEY,
            },
          }
        );

        const seasonData = {
          seasonNumber: seasonObj.season_number,
          seasonPosterPath: seasonObj.poster_path || null,
          seasonEpisodes: seasonObj.episode_count,
          addedSeasonDate: episodeDate,
          episodes: [],
        };

        for (const episode of response.data.episodes) {
          seasonData.episodes.push({
            episodeNumber: episode.episode_number,
            episodePosterPath: episode.still_path || null,
            episodeName: episode.name || "Unknown",
            episodeRatings: episode.vote_average?.toFixed(1) ?? 0,
            episodeMinutes: episode.runtime || 0,
            episodeWatchTime: episodeDate,
          });
        }

        newShow.seasons.push(seasonData);
      }

      // Tüm dizi yapısını dizinin sonuna ekle
      watchedTv.push(newShow);
      await updateDoc(userRef, { watchedTv });

      Toast.show({
        type: "success",
        text1: "Dizi bölümleri izlendi olarak işaretlendi",
      });

      checkIfWatched();
    } catch (error) {
      console.error("Dizi eklenirken hata oluştu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  //?--------------------------------------------------------------------------------------------
  //!bir özellik eklemekiçin kulanırsın
  // const updateGenres = async ({ showId, genres }) => {
  //   try {
  //     const userRef = doc(db, "Lists", user.uid);
  //     const docSnap = await getDoc(userRef);

  //     let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
  //     let watchedTv = data.watchedTv || [];

  //     let tvShowIndex = watchedTv.findIndex((show) => show.id === showId);
  //     console.log("tvShowIndex", tvShowIndex);
  //     console.log("showId", showId);

  //     // Eğer dizi içinde show bulunursa güncelle
  //     if (tvShowIndex !== -1) {
  //       watchedTv[tvShowIndex].genres = genres ? genres.map((g) => g.name) : [];
  //     } else {
  //       // Yoksa yeni bir kayıt olarak ekle
  //       watchedTv.push({
  //         id: showId,
  //         genres: genres ? genres.map((g) => g.name) : [],
  //       });
  //     }

  //     await updateDoc(userRef, { watchedTv });
  //   } catch (error) {
  //     console.error("Hata:", error);
  //   }
  // };

  //?--------------------------------------------------------------------------------------------
  //?--------------------------------------------------------------------------------------------
  const renderSimilarTvShow = ({ item }) => (
    <Animated.View
      style={{ transform: [{ scale: scaleValues[item.id] || 1 }] }}
    >
      <TouchableOpacity
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        activeOpacity={0.8}
        style={styles.similarItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
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
          {item.name}
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

  if (loading) {
    return <DetailsSkeleton />;
  }
  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text.primary }]}>
          {t.loading}
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      {check && (
        <LottieView
          style={{
            position: "absolute",
            height: 600,
            left: 0,
            right: 0,
            zIndex: 3,
          }}
          source={require("../../LottieJson/confetti_2.json")}
          opacity={1}
          autoPlay={check}
          loop={false}
        />
      )}
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
        {details.seasons.map((se, index) => {
          if ((index + 4) % 4 === 0 || index < 4) {
            return (
              <LottieView
                key={se.season_number}
                style={[
                  styles.lottie,
                  {
                    display: showSnow ? "flex" : "none",
                    top: 1000 * Math.floor(index < 4 ? index : index / 4),
                  },
                ]}
                source={require("../../LottieJson/snow.json")}
                autoPlay={true}
                loop
              />
            );
          }
          return null;
        })}

        <View style={styles.header}>
          <View style={styles.posterView}>
            {details.poster_path ? (
              <TouchableOpacity onPress={() => setPosterModalVisible(true)}>
                <Image
                  source={{
                    uri: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
                  }}
                  style={[
                    styles.poster,
                    { borderColor: theme.border, shadowColor: theme.shadow },
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
            <View style={styles.tvInformation}>
              <View style={styles.Info}>
                <Text style={[styles.title, { color: theme.text.primary }]}>
                  {details.name}
                </Text>
                <Text style={[styles.tagline, { color: theme.text.secondary }]}>
                  {details.tagline || t.tvShowsDetails.noTagline}
                </Text>
              </View>
            </View>

            <View style={styles.genres}>
              {details.genres.length > 0 ? (
                details.genres.map((genre) => (
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
                ))
              ) : (
                <View
                  style={[styles.genreTag, { backgroundColor: theme.accent }]}
                >
                  <Text
                    style={[styles.genreText, { color: theme.text.primary }]}
                  >
                    {t.noGenreInfo}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.mainRating}>
              <Text style={[styles.ratingText, { color: theme.colors.orange }]}>
                {details.vote_average > 0
                  ? `${details.vote_average.toFixed(1)} `
                  : t.tvShowsDetails.notYetRated}
              </Text>
              <Text style={[styles.ratingText, { color: theme.text.primary }]}>
                {details.vote_average > 0 && (
                  <RatingStars rating={details.vote_average} />
                )}{" "}
                •{" "}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "baseline",
                  gap: 3,
                }}
              >
                <FontAwesome name="user" size={14} color={theme.colors.blue} />
                <Text style={[styles.ratingText, { color: theme.colors.blue }]}>
                  {details.vote_count || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ top: -90 }}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {t.tvShowsDetails?.lists}
            </Text>
            <ListViewTv
              isSeasonWatched={isSeasonWatched}
              navigation={navigation}
              updateList={updateTvSeriesList}
              openModal={openModal}
              addShowToFirestore={addShowToFirestore}
              isLoading={isLoading}
              listStates={listStates}
              type={"tv"}
            />
            {true && (
              <View
                style={{
                  position: "absolute",
                  bottom: 20,
                  right: 7,
                  left: 7,
                }}
              >
                <Progress.Bar
                  progress={isSeasonWatched}
                  width={width * 0.89}
                  height={1}
                  borderWidth={0}
                  animationConfig={{ bounciness: 10 }}
                  color={
                    isSeasonWatched === 1
                      ? theme.colors.green
                      : showEpisodes !== undefined
                        ? theme.colors.orange
                        : theme.colors.blue
                  }
                  //style={{ marginBottom: 10 }}
                />
              </View>
            )}
          </View>

          {/* <TouchableOpacity
            onPress={() =>
              updateGenres({ showId: details.id, genres: details.genres })
            }
            style={{
              width: width * 0.9,
              alignSelf: "center",
              marginBottom: 10,
              padding: 10,
              backgroundColor: theme.accent,
              borderRadius: 5,
              shadowColor: theme.shadow,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <Text style={{ color: theme.text.secondary }}>
              genre güncelleme
            </Text>
          </TouchableOpacity> */}
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {t.tvInformation}
          </Text>
          <View
            style={[
              styles.stats,
              { backgroundColor: theme.secondary, shadowColor: theme.shadow },
            ]}
          >
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {details.number_of_seasons || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                {t.seasons}
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {details.number_of_episodes || 0}
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color: theme.text.primary,
                      fontSize: 12,
                      fontWeight: "300",
                    },
                  ]}
                >
                  {showEpisodes ? " /" + showEpisodes : null}
                </Text>
              </View>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                {t.episode}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {formatDate(details.first_air_date)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                {t.tvShowsDetails.airDate}
              </Text>
            </View>
          </View>
          <View style={styles.section}>
            <TVShowItem item={details} navigation={navigation} />
          </View>
          {details.seasons.filter((season) => season.season_number > 0).length >
          0 ? (
            <View style={styles.section}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("TvGraphDetailScreen", { id })
                }
              >
                
                <View style={styles.headerGraph}> 
                  <BlurView
                   tint="dark"
                   intensity={5}
                   experimentalBlurMethod="dimezisBlurView" // Android için sihirli kod
                   style={StyleSheet.absoluteFill}
                  />
                  {details.backdrop_path ? (
                    <Image
                      source={{
                        uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                      }}
                      style={[
                        styles.backdropGraph,
                        { shadowColor: theme.shadow },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.noImageContainerTvGraph,
                        {
                          backgroundColor: theme.secondary,
                          shadowColor: theme.shadow,
                        },
                      ]}
                    />
                  )}
                  <View style={styles.posterViewGraph}>
                    {details.poster_path ? (
                      <Image
                        source={{
                          uri: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
                        }}
                        style={[
                          styles.poster,
                          {
                            borderColor: theme.border,
                            shadowColor: theme.shadow,
                          },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.noPosterContainer,
                          { backgroundColor: theme.secondary },
                        ]}
                      >
                        <Ionicons
                          name="image"
                          size={80}
                          color={theme.text.muted}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.headerInfo}>
                    
                    <Text style={[styles.title, { color: theme.text.primary }]}>
                      {details.name}
                    </Text>
                    <View style={styles.mainRating}>
                      <Text
                        style={[
                          styles.ratingText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {details.vote_average > 0
                          ? `${details.vote_average.toFixed(1)} / 10`
                          : t.tvShowsDetails.notYetRated}
                      </Text>
                      <View>
                        {details.vote_average > 0 && (
                          <RatingStars rating={details.vote_average} />
                        )}
                      </View>
                    </View>
                    <View style={styles.statsGraph}>
                      <View style={styles.statItem}>
                        <Text
                          style={[
                            styles.statValue,
                            { color: theme.text.primary },
                          ]}
                        >
                          {details.number_of_seasons || 0}
                        </Text>
                        <Text
                          style={[
                            styles.statLabel,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {t.seasons}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text
                          style={[
                            styles.statValue,
                            { color: theme.text.primary },
                          ]}
                        >
                          {details.number_of_episodes || 0}
                        </Text>
                        <Text
                          style={[
                            styles.statLabel,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {t.episode}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text
                          style={[
                            styles.statValue,
                            { color: theme.text.primary },
                          ]}
                        >
                          {details.vote_count || 0}
                        </Text>
                        <Text
                          style={[
                            styles.statLabel,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {t.votes}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {t.overview}
            </Text>
            <Text
              style={[styles.overview, { color: theme.text.secondary }]}
              numberOfLines={numberOfLines ? null : 10}
              ellipsizeMode="tail"
              onTextLayout={(event) => {
                const { lines } = event.nativeEvent;
                setLineCount(lines.length); // Satır sayısını güncelle
              }}
            >
              {details.overview || t.tvShowsDetails.noOverviewAvailable}
            </Text>
            {lineCount > 10 ? (
              <TouchableOpacity
                onPress={() => setNumberOfLines(!numberOfLines)}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 10,
                }}
                activeOpacity={0.8}
              >
                {numberOfLines ? (
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
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {t.seasons}
            </Text>
            {details.seasons.filter((season) => season.season_number > 0)
              .length > 0 ? (
              details.seasons
                .filter((season) => season.season_number > 0)
                .map((season) => (
                  <SeasonItem
                    key={season.id}
                    season={season}
                    details={details}
                    navigation={navigation}
                  />
                ))
            ) : (
              <View
                style={[
                  styles.noContentContainer,
                  {
                    backgroundColor: theme.secondary,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <Text
                  style={[styles.noContentText, { color: theme.text.muted }]}
                >
                  {t.noSeasonInfo}
                </Text>
              </View>
            )}
          </View>
          {details.recommendations?.results.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: theme.text.primary }]}
              >
                {t.recommendedTvShows}
              </Text>
              <FlatList
                data={details.recommendations.results.slice(0, 20)}
                renderItem={renderSimilarTvShow}
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
                {t.similarTvShows}
              </Text>
              <FlatList
                data={details.similar.results.slice(0, 20)}
                renderItem={renderSimilarTvShow}
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
              {details.reviews.results.slice(0, reviewLenght).map((review) => (
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
                        {new Date(review.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.reviewContent,
                        { color: theme.text.secondary },
                      ]}
                      numberOfLines={review.id === reviewTextLenght ? null : 2}
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
                  <MaterialIcons
                    name={
                      reviewLenght > 5
                        ? "keyboard-arrow-up"
                        : "keyboard-arrow-down"
                    }
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
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>
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
              "rgba(0,0,0,0.7)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.9)",
              "rgba(0,0,0,0.7)",
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
                allowsFullscreenVideo={true}
                source={{
                  uri: `https://www.youtube.com/embed/${selectedVideo}?rel=0&autoplay=1`,
                }}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
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
                {!selectedDate ? (
                  <Text
                    style={[styles.inputText, { color: theme.text.primary }]}
                  >
                    Tarih seçiniz
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[styles.inputText, { color: theme.text.primary }]}
                    >
                      Seçili Tarih
                    </Text>
                    <Text
                      style={[
                        styles.inputTextDate,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {formatDate(selectedDate)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setSelectedDate(new Date()), addShowToFirestore(new Date());
                }}
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
                onPress={() => {
                  setSelectedDate(showReleaseDateTime),
                    addShowToFirestore(showReleaseDateTime);
                }}
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
                  {formatDate(showReleaseDateTime)}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                minimumDate={new Date(showReleaseDateTime)} // 1 Ocak 2000'den önce seçilemez
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -120,
    right: -120,
    zIndex: 0,
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
  },
  backdropGraph: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
    zIndex:-1,
    resizeMode: "cover",
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
    width: "100%",
    height: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageContainerTvGraph: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
    opacity: 0.5,
    resizeMode: "cover",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  header: {
    top: -100,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  headerGraph: {
    width: "100%",
    maxHeight: 200,
    flexDirection: "row",
    marginBottom: 20,
    padding: 5,
    borderRadius: 15,
    overflow:"hidden"
  },
  posterView: {
    width: 120,
    height: 180,
    marginRight: 15,
  },
  posterViewGraph: {
    width: width * 0.26,
    height: height * 0.18,
    marginRight: 15,
  },
  poster: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
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
  Info: { width: "80%" },
  tvInformation: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 5,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
    borderRadius: 10,
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
  statsGraph: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
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
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
  },

  noContentContainer: {
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  noContentText: {
    fontSize: 14,
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
    width: width * 0.2,
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
    width: width * 0.4,
    height: height * 0.16,
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
  modalContainerVideo: {
    flex: 1,
    //backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
  },
  modalContentVideo: {
    height: 200, // 16:9 aspect ratio
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
