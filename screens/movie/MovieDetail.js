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
  Platform,
} from "react-native";
import axios from "axios";
import { DetailsSkeleton } from "../../components/Skeleton";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSnow } from "../../context/SnowContext";
import Toast from "react-native-toast-message";
import { getDoc, doc, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ListView from "../../components/ListView";
import { useAppSettings } from "../../context/AppSettingsContext";
import RatingStars from "../../components/RatingStars";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Comment from "../../components/Comment";
import SwipeCard from "../../modules/SwipeCard";
import { useListStatus } from "../../modules/UseListStatus";
import YoutubePlayer from "react-native-youtube-iframe";
import { BlurView } from "expo-blur";
import { useListStatusContext } from "../../context/ListStatusContext";
import IconBacground from "../../components/IconBacground";
import { useAuth } from "../../context/AuthContext";
import CommentSheetModal from "../../components/CommentSheetModal";

const { width, height } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);

/* ─────────────────────────────────────────
   SimilarMovieItem
───────────────────────────────────────── */
const SimilarMovieItem = ({ item, navigation, imageQuality }) => {
  const { theme } = useTheme();
  const { inWatchList, inFavorites, isWatched, isInOtherLists } = useListStatus(
    item.id,
    "movie",
  );
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.93,
      friction: 4,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

  const isInAnyList = inWatchList || isWatched || inFavorites || isInOtherLists;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        style={styles.similarItem}
        onPress={() => navigation.push("MovieDetails", { id: item.id })}
      >
        <Image
          source={
            item.poster_path
              ? {
                  uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.poster_path}`,
                }
              : require("../../assets/image/no_image.png")
          }
          style={[styles.similarPoster, { borderColor: theme.border + "55" }]}
        />
        {/* Rating pill */}
        <View
          style={[styles.ratingPill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
        >
          <Ionicons name="star" size={9} color="#FFD700" />
          <Text allowFontScaling={false} style={styles.ratingPillText}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
        {/* List indicators */}
        {isInAnyList && (
          <View style={[styles.stats]}>
            <View
              style={{
                gap: 3,
                backgroundColor: "rgba(0,0,0,0.72)",
                paddingVertical: 4,
                paddingHorizontal: 2,
                borderRadius: 10,
              }}
            >
              {inWatchList && (
                <View>
                  <Ionicons
                    name="bookmark"
                    size={12}
                    color={theme.colors.blue}
                  />
                </View>
              )}
              {isWatched && (
                <View>
                  <Ionicons name="eye" size={12} color={theme.colors.green} />
                </View>
              )}
              {inFavorites && (
                <View>
                  <Ionicons name="heart" size={12} color={theme.colors.red} />
                </View>
              )}
              {isInOtherLists && (
                <View>
                  <Ionicons name="grid" size={12} color={theme.colors.orange} />
                </View>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ─────────────────────────────────────────
   Section header
───────────────────────────────────────── */
const SectionHeader = ({ title, right, theme }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {right}
  </View>
);

/* ─────────────────────────────────────────
   Main screen
───────────────────────────────────────── */
export default function MovieDetails({ navigation, route }) {
  const { id } = route.params;
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullCast, setShowFullCast] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [reviewLength, setReviewLength] = useState(5);
  const [reviewTextLength, setReviewTextLength] = useState(null);
  const [commandModalVisible, setCommentModalVisible] = useState(false);
  const [headerScale] = useState(new Animated.Value(1));

  // Overview accordion (sadece özet, tam genişlik)
  const [expandedCard, setExpandedCard] = useState(null);
  const overviewAnim = React.useRef(new Animated.Value(0)).current;

  const toggleCard = (card) => {
    const isOpening = expandedCard !== card;
    if (isOpening) {
      Animated.timing(overviewAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: false,
      }).start();
      setExpandedCard(card);
    } else {
      Animated.timing(overviewAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
      setExpandedCard(null);
    }
  };

  const { API_KEY, showSnow, imageQuality } = useAppSettings();

  const [modalVisible, setModalVisible] = useState(false);
  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReminderSet, setIsReminderSet] = useState(false);

  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
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
    const diff = new Date(airDate).getTime() - Date.now();
    if (diff < 0) return { text: formatDate(airDate), isRemaining: false };
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(days / 30);
    const rem = days % 30;
    const text =
      months > 0
        ? rem > 0
          ? `${months} ${t.month} ${rem} ${t.days}`
          : `${months} ${t.month}`
        : days > 0
          ? `${days} ${t.days}`
          : t.today;
    return { text, isRemaining: true };
  };

  const handleConfirm = (date) => {
    setSelectedDate(formatDateSave(date));
    updateMovieList("watchedMovies", "movie", formatDateSave(date));
    hideDatePicker();
  };

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/movie/${id}`,
          params: {
            language: language === "tr" ? "tr-TR" : "en-US",
            append_to_response:
              "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,release_dates,reviews,similar,translations,videos,watch/providers",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        setDetails(response.data);
      } catch (error) {
        Toast.show({ type: "error", text1: "error:" + error });
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, language]);

  useEffect(() => {
    if (!user.uid || !id) return;
    const unsub = onSnapshot(doc(db, "Reminders", user.uid), (snap) => {
      if (snap.exists()) {
        const reminders = snap.data().movieReminders || [];
        setIsReminderSet(
          reminders.some((m) => m.movieId === id && m.type === "movie"),
        );
      } else setIsReminderSet(false);
    });
    return () => unsub();
  }, [user.uid, id]);

  const addReminder = async () => {
    try {
      if (!user) return;
      const ref = doc(db, "Reminders", user.uid);
      const snap = await getDoc(ref);
      const movieData = {
        movieId: details.id || "",
        movieName: details.title || "",
        releaseDate: details.release_date || "",
        movieMinutes: details.runtime || 0,
        posterPath: details.poster_path || null,
        type: "movie",
        createdAt: formatDateSave(new Date()),
      };
      let reminders = snap.exists() ? snap.data().movieReminders || [] : [];
      const idx = reminders.findIndex((i) => i.movieId === details.id);
      if (idx === -1 && !isReminderSet) reminders.push(movieData);
      else if (idx !== -1 && isReminderSet) reminders.splice(idx, 1);
      if (!snap.exists())
        await setDoc(ref, {
          tvReminders: [],
          movieReminders: reminders,
          updatedAt: formatDateSave(new Date()),
        });
      else
        await updateDoc(ref, {
          movieReminders: reminders,
          updatedAt: formatDateSave(new Date()),
        });
      setIsReminderSet(!isReminderSet);
      Toast.show({
        type: isReminderSet ? "warning" : "success",
        text1: isReminderSet ? "Hatırlatma kaldırıldı" : "Hatırlatma eklendi",
      });
    } catch (error) {
      Toast.show({ type: "error", text1: "Hata: " + error.message });
    }
  };

  const updateMovieList = async (listType, type, date = null) => {
    setIsLoading(listType === "watchedMovies");
    if (!user.uid || !details) return;
    const ref = doc(db, "Lists", user.uid);
    try {
      closeModal();
      const snap = await getDoc(ref);
      let data = snap.exists()
        ? snap.data()
        : { watchedTv: [], favorites: [], watchList: [], watchedMovies: [] };
      if (!snap.exists()) await setDoc(ref, data);
      let list = data[listType] || [];
      const idx = list.findIndex((i) => i.id === details.id && i.type === type);
      const getName = (l) =>
        ({
          favorites: t.favorites,
          watchList: t.watchList,
          watchedMovies: t.watchedMovies,
          watchedTv: t.watchedTv,
        })[l] || l;
      if (idx !== -1) {
        list.splice(idx, 1);
        Toast.show({
          type: "warning",
          text1: `${type === "movie" ? "Film" : "Dizi"} ${getName(listType)} listesinden kaldırıldı!`,
        });
      } else {
        if (!date) {
          Toast.show({ type: "warning", text1: "Lütfen bir tarih seçin." });
          return;
        }
        list.push({
          id: details.id,
          imagePath: details.poster_path,
          dateAdded: date,
          name: type === "movie" ? details.title : details.name,
          minutes: type === "movie" ? details.runtime : undefined,
          type,
          genres: details.genres?.map((g) => g.name) || [],
        });
        Toast.show({
          type: "success",
          text1: `${type === "movie" ? "Film" : "Dizi"} ${getName(listType)} listesine eklendi!`,
        });
      }
      await updateDoc(ref, { [listType]: list });
      setIsLoading(false);
    } catch (error) {
      Toast.show({ type: "error", text1: "Hata: " + error.message });
    }
  };

  const { allLists } = useListStatusContext();
  const [listStates, setListStates] = useState({});
  useEffect(() => {
    if (!allLists) {
      setListStates({});
      return;
    }
    const s = {};
    Object.entries(allLists).forEach(([k, v]) => {
      s[k] = Array.isArray(v)
        ? v.some((i) => i.id === id && i.type === "movie")
        : false;
    });
    setListStates(s);
  }, [allLists, id]);

  const renderCastMember = ({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("ActorViewScreen", { personId: item.id })
      }
      activeOpacity={0.8}
    >
      <View style={styles.castItem}>
        <Image
          source={
            item.profile_path
              ? {
                  uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.profile_path}`,
                }
              : require("../../assets/image/user.png")
          }
          style={[styles.castImage, { borderColor: theme.border }]}
        />
        <Text
          allowFontScaling={false}
          style={[styles.castName, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.castCharacter, { color: theme.text.muted }]}
          numberOfLines={1}
        >
          {item.character}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderVideo = ({ item }) => (
    <TouchableOpacity
      style={styles.videoItem}
      onPress={() => setSelectedVideo(item.key)}
      activeOpacity={0.88}
    >
      <View style={styles.videoThumbnail}>
        <Image
          source={{
            uri: `https://img.youtube.com/vi/${item.key}/hqdefault.jpg`,
          }}
          style={styles.videoImage}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.playIconContainer}>
          <LottieView
            style={{ width: 56, height: 56 }}
            source={require("../../LottieJson/play")}
            opacity={0.9}
            autoPlay
            loop
          />
        </View>
        <View style={styles.videoTypeBadge}>
          <Text allowFontScaling={false} style={styles.videoTypeBadgeText}>
            {item.type}
          </Text>
        </View>
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.videoTitle, { color: theme.text.primary }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) return <DetailsSkeleton />;
  if (!details)
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.primary,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: theme.text.primary }}>Yükleniyor...</Text>
      </View>
    );

  const dateInfo = calculateDateDifference(details.release_date);

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <IconBacground opacity={0.25} />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        style={styles.container}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO / BACKDROP ─── */}
        <View style={styles.heroContainer}>
          {details.backdrop_path ? (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => setBacdropModalVisible(true)}
            >
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                }}
                style={styles.backdrop}
              />
            </TouchableOpacity>
          ) : (
            <View
              style={[styles.noBackdrop, { backgroundColor: theme.secondary }]}
            >
              <Ionicons
                name="film-outline"
                size={64}
                color={theme.text.muted}
              />
            </View>
          )}
          {/* Deep gradient */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)", theme.primary]}
            locations={[0.3, 0.65, 1]}
            style={styles.heroGradient}
          />
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <BlurView tint="dark" intensity={60} style={styles.backBtnBlur}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </BlurView>
          </TouchableOpacity>

          {showSnow &&
            [0, 1, 2, 3].map((i) => (
              <LottieView
                key={i}
                style={[styles.lottie, { top: i * 1000 }]}
                source={require("../../LottieJson/snow.json")}
                autoPlay
                loop
              />
            ))}
        </View>

        {/* ─── POSTER + INFO HEADER ─── */}
        <View style={styles.infoHeader}>
          {/* Poster */}
          <TouchableOpacity
            style={styles.posterShadow}
            onPress={() => setPosterModalVisible(true)}
            activeOpacity={0.92}
          >
            {details.poster_path ? (
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${details.poster_path}`,
                }}
                style={[styles.poster, { borderColor: theme.border + "80" }]}
              />
            ) : (
              <View
                style={[styles.noPoster, { backgroundColor: theme.secondary }]}
              >
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={theme.text.muted}
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Title block */}
          <View style={styles.titleBlock}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {details.title}
            </Text>
            {details.alternative_titles?.titles?.length > 0 && (
              <Text
                allowFontScaling={false}
                style={[styles.altTitle, { color: theme.text.muted }]}
              >
                {details.alternative_titles.titles[0].title}
              </Text>
            )}
            {details.tagline ? (
              <Text
                allowFontScaling={false}
                style={[styles.tagline, { color: theme.accent }]}
                numberOfLines={2}
              >
                "{details.tagline}"
              </Text>
            ) : null}

            {/* Genres */}
            <View style={styles.genreRow}>
              {details.genres.slice(0, 3).map((g) => (
                <View
                  key={g.id}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: theme.accent + "22",
                      borderColor: theme.accent + "44",
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.genreChipText, { color: theme.accent }]}
                  >
                    {g.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Rating row */}
            <View style={styles.ratingRow}>
              <RatingStars rating={details.vote_average} />
              <Text style={[styles.ratingNum, { color: theme.colors.orange }]}>
                {details.vote_average.toFixed(1)}
              </Text>
              <View style={styles.voteRow}>
                <FontAwesome name="user" size={11} color={theme.colors.blue} />
                <Text style={[styles.voteCount, { color: theme.colors.blue }]}>
                  {details.vote_count?.toLocaleString() || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── BODY ─── */}
        <View style={styles.body}>
          {/* ListView */}
          <ListView
            isRemaining={dateInfo?.isRemaining}
            isReminderSet={isReminderSet}
            updateList={updateMovieList}
            updateWatchedList={openModal}
            addReminder={addReminder}
            navigation={navigation}
            listStates={listStates}
            isLoading={isLoading}
            type={"movie"}
          />

          {/* ── STAT PILLS ── */}
          <View
            style={[
              styles.statRow,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  { backgroundColor: theme.accent + "18" },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {dateInfo?.text || "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.date}
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />

            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor:
                      (theme.colors?.blue || theme.accent) + "18",
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.runtime ? `${details.runtime} dk` : "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.duration}
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />

            <View style={styles.statPill}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor:
                      (theme.colors?.green || theme.accent) + "18",
                  },
                ]}
              >
                <Ionicons
                  name="cash-outline"
                  size={16}
                  color={theme.colors?.green || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.revenue > 0
                  ? `${(details.revenue / 1_000_000).toFixed(0)}M$`
                  : "?"}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.revenue}
              </Text>
            </View>
          </View>

          {/* ── YORUMLAR BUTONU ── */}
          <SwipeCard
            leftButton={{ label: "Sil", color: "#e53935" }}
            rightButton={{ label: "Yanıtla", color: "#5aacf0" }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCommentModalVisible(!commandModalVisible)}
              style={[
                styles.commentsBtn,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.commentsIconWrap,
                  { backgroundColor: theme.accent + "20" },
                ]}
              >
                <AntDesign name="comment" size={18} color={theme.accent} />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.commentsBtnText, { color: theme.text.primary }]}
              >
                {t.comments || "Yorumlar"}
              </Text>
              <View style={styles.commentsRight}>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.text.muted}
                />
              </View>
            </TouchableOpacity>
          </SwipeCard>

          {/* ── EKSTERNAl LİNKLER ── */}
          {details.external_ids && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24 }}
            >
              <View style={styles.externalLinks}>
                {[
                  {
                    key: "imdb_id",
                    url: (v) => `https://www.imdb.com/title/${v}`,
                    icon: "imdb",
                    label: "IMDb",
                  },
                  {
                    key: "facebook_id",
                    url: (v) => `https://www.facebook.com/${v}`,
                    icon: "facebook",
                    label: "Facebook",
                  },
                  {
                    key: "instagram_id",
                    url: (v) => `https://www.instagram.com/${v}`,
                    icon: "instagram",
                    label: "Instagram",
                  },
                  {
                    key: "twitter_id",
                    url: (v) => `https://twitter.com/${v}`,
                    icon: "twitter",
                    label: "Twitter",
                  },
                ].map(({ key, url, icon, label }) =>
                  details.external_ids[key] ? (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.extLink,
                        {
                          backgroundColor: theme.secondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() =>
                        Linking.openURL(url(details.external_ids[key]))
                      }
                      activeOpacity={0.8}
                    >
                      <FontAwesome5
                        name={icon}
                        size={15}
                        color={theme.accent}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.extLinkText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ) : null,
                )}
              </View>
            </ScrollView>
          )}

          {/* ── ÖZET ACCORDION ── */}
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => toggleCard("overview")}
              style={[
                styles.accordionCard,
                {
                  backgroundColor: theme.secondary,
                  borderColor:
                    expandedCard === "overview"
                      ? theme.accent + "88"
                      : theme.border,
                },
              ]}
            >
              <View style={styles.accordionHeader}>
                <View
                  style={[
                    styles.sectionAccent,
                    { backgroundColor: theme.accent },
                  ]}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.accordionTitle, { color: theme.text.primary }]}
                >
                  {t.overview || "Özet"}
                </Text>
                <Ionicons
                  name={
                    expandedCard === "overview" ? "chevron-up" : "chevron-down"
                  }
                  size={14}
                  color={
                    expandedCard === "overview"
                      ? theme.accent
                      : theme.text.muted
                  }
                />
              </View>
              <Animated.View
                style={{
                  maxHeight: overviewAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [52, 400],
                  }),
                  overflow: "hidden",
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.accordionBody,
                    { color: theme.text.secondary },
                  ]}
                  numberOfLines={expandedCard === "overview" ? null : 2}
                >
                  {details.overview || "Özet bulunmuyor."}
                </Text>
              </Animated.View>
              {expandedCard !== "overview" && (
                <Text
                  allowFontScaling={false}
                  style={[styles.accordionMore, { color: theme.accent }]}
                >
                  devamı...
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── İZLEME PLATFORMLARI ── */}
          {"watch/providers" in details &&
            details["watch/providers"].results.TR && (
              <View style={styles.section}>
                <SectionHeader title={t.watchProviders} theme={theme} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.providersRow}>
                    {details["watch/providers"].results.TR.flatrate?.map(
                      (p) => (
                        <View
                          key={p.provider_id}
                          style={[
                            styles.providerCard,
                            {
                              backgroundColor: theme.secondary,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Image
                            source={{
                              uri: `https://image.tmdb.org/t/p/original${p.logo_path}`,
                            }}
                            style={styles.providerLogo}
                          />
                          <Text
                            allowFontScaling={false}
                            style={[
                              styles.providerName,
                              { color: theme.text.secondary },
                            ]}
                            numberOfLines={1}
                          >
                            {p.provider_name}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

          {/* ── VİDEOLAR ── */}
          {details.videos?.results.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.videos} theme={theme} />
              <FlatList
                data={details.videos.results.filter(
                  (v) => v.site === "YouTube",
                )}
                renderItem={renderVideo}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 14 }}
              />
            </View>
          )}

          {/* ── OYUNCULAR ── */}
          {details.credits?.cast.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title={t.cast}
                theme={theme}
                right={
                  details.credits.cast.length > 6 && (
                    <TouchableOpacity
                      onPress={() => setShowFullCast(!showFullCast)}
                      style={styles.seeAllBtn}
                    >
                      <Text
                        style={[styles.seeAllText, { color: theme.accent }]}
                      >
                        {showFullCast ? t.collapse : t.showAll}
                      </Text>
                    </TouchableOpacity>
                  )
                }
              />
              <FlatList
                data={
                  showFullCast
                    ? details.credits.cast
                    : details.credits.cast.slice(0, 10)
                }
                renderItem={renderCastMember}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 12 }}
              />
            </View>
          )}

          {/* ── ÖNERİLEN FİLMLER ── */}
          {details.recommendations?.results.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.recommendedMovies} theme={theme} />
              <FlatList
                data={details.recommendations.results.slice(0, 20)}
                renderItem={({ item }) => (
                  <SimilarMovieItem
                    item={item}
                    navigation={navigation}
                    imageQuality={imageQuality}
                  />
                )}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
              />
            </View>
          )}

          {/* ── BENZER FİLMLER ── */}
          {details.similar?.results.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.similarMovies} theme={theme} />
              <FlatList
                data={details.similar.results.slice(0, 20)}
                renderItem={({ item }) => (
                  <SimilarMovieItem
                    item={item}
                    navigation={navigation}
                    imageQuality={imageQuality}
                  />
                )}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
              />
            </View>
          )}

          {/* ── KRİTİKLER ── */}
          {details.reviews?.results.length > 0 && (
            <View style={[styles.section, { marginBottom: 40 }]}>
              <SectionHeader title={t.reviews} theme={theme} />
              {details.reviews.results.slice(0, reviewLength).map((review) => (
                <TouchableOpacity
                  key={review.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    setReviewTextLength(
                      review.id === reviewTextLength ? null : review.id,
                    )
                  }
                  style={[
                    styles.reviewCard,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.reviewTop}>
                    <View
                      style={[
                        styles.reviewAvatar,
                        { backgroundColor: theme.accent + "28" },
                      ]}
                    >
                      <Ionicons name="person" size={13} color={theme.accent} />
                    </View>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.reviewAuthor,
                        { color: theme.text.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {review.author}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={[styles.reviewDate, { color: theme.text.muted }]}
                    >
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : ""}
                    </Text>
                  </View>
                  <Text
                    allowFontScaling={false}
                    style={[styles.reviewBody, { color: theme.text.secondary }]}
                    numberOfLines={review.id === reviewTextLength ? null : 3}
                  >
                    {review.content}
                  </Text>
                  {review.id !== reviewTextLength && (
                    <Text
                      allowFontScaling={false}
                      style={[styles.readMore, { color: theme.accent }]}
                    >
                      Devamını oku
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
              {details.reviews.results.length > 5 && (
                <TouchableOpacity
                  onPress={() =>
                    setReviewLength(
                      details.reviews.results.length === reviewLength
                        ? 5
                        : details.reviews.results.length,
                    )
                  }
                  style={[styles.expandBtn, { marginTop: 4 }]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={
                      reviewLength > 5
                        ? "keyboard-arrow-up"
                        : "keyboard-arrow-down"
                    }
                    size={22}
                    color={theme.accent}
                  />
                  <Text style={[styles.expandBtnText, { color: theme.accent }]}>
                    {reviewLength > 5 ? "Daha az" : "Tüm yorumlar"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ═══════ MODALS ═══════ */}

      {/* Yorumlar */}
      <Modal
        animationType="none"
        transparent
        visible={commandModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
        statusBarTranslucent
      >
        <CommentSheetModal
          visible={commandModalVisible}
          onClose={() => setCommentModalVisible(false)}
          movieId={id}
          details={details}
        />
      </Modal>

      {/* Video player */}
      <Modal
        visible={selectedVideo !== null}
        onRequestClose={() => setSelectedVideo(null)}
        animationType="fade"
        transparent
      >
        <View style={styles.videoModal}>
          <BlurView
            tint="dark"
            intensity={60}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedVideo(null)}
          />
          <View style={styles.videoModalContent}>
            <TouchableOpacity
              style={styles.videoCloseBtn}
              onPress={() => setSelectedVideo(null)}
            >
              <BlurView
                tint="dark"
                intensity={50}
                style={styles.videoCloseBtnBlur}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
            {selectedVideo && (
              <YoutubePlayer height={220} videoId={selectedVideo} play />
            )}
          </View>
        </View>
      </Modal>

      {/* İzleme tarihi */}
      <Modal
        visible={modalVisible}
        onRequestClose={closeModal}
        animationType="slide"
        transparent
      >
        <View style={styles.dateModalWrap}>
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
          />
          <View
            style={[
              styles.dateSheet,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.border }]}
            />
            <Text
              allowFontScaling={false}
              style={[styles.sheetTitle, { color: theme.text.primary }]}
            >
              İzleme Tarihi
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.sheetSubtitle, { color: theme.text.muted }]}
            >
              Bu filmi ne zaman izlediniz?
            </Text>
            <View style={styles.dateOptions}>
              <TouchableOpacity
                style={[
                  styles.dateOption,
                  {
                    backgroundColor: theme.primary,
                    borderColor: selectedDate ? theme.accent : theme.border,
                  },
                ]}
                onPress={showDatePicker}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.dateOptionIcon,
                    { backgroundColor: theme.accent + "20" },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={24}
                    color={theme.accent}
                  />
                </View>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.dateOptionLabel,
                    { color: selectedDate ? theme.accent : theme.text.primary },
                  ]}
                >
                  {selectedDate || "Tarih Seç"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateOption,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() =>
                  updateMovieList(
                    "watchedMovies",
                    "movie",
                    formatDateSave(new Date()),
                  )
                }
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.dateOptionIcon,
                    {
                      backgroundColor:
                        (theme.colors?.blue || theme.accent) + "20",
                    },
                  ]}
                >
                  <Entypo
                    name="stopwatch"
                    size={24}
                    color={theme.colors?.blue || theme.accent}
                  />
                </View>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.dateOptionLabel,
                    { color: theme.text.primary },
                  ]}
                >
                  Şimdi
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.dateOptionSub, { color: theme.text.muted }]}
                >
                  {formatDate(new Date())}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateOption,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() =>
                  updateMovieList(
                    "watchedMovies",
                    "movie",
                    formatDateSave(new Date(details.release_date)),
                  )
                }
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.dateOptionIcon,
                    {
                      backgroundColor:
                        (theme.colors?.orange || theme.accent) + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name="film-outline"
                    size={24}
                    color={theme.colors?.orange || theme.accent}
                  />
                </View>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.dateOptionLabel,
                    { color: theme.text.primary },
                  ]}
                >
                  Yayın Tarihi
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.dateOptionSub, { color: theme.text.muted }]}
                >
                  {formatDate(details.release_date)}
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              onConfirm={handleConfirm}
              onCancel={hideDatePicker}
              minimumDate={new Date(details.release_date)}
              maximumDate={new Date()}
            />
          </View>
        </View>
      </Modal>

      {/* Poster / Backdrop büyük görüntü */}
      <Modal
        visible={PosterModalVisible || backdropModalVisible}
        onRequestClose={() => {
          setPosterModalVisible(false);
          setBacdropModalVisible(false);
        }}
        animationType="fade"
        transparent
      >
        <BlurView
          tint="dark"
          intensity={60}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setPosterModalVisible(false);
            setBacdropModalVisible(false);
          }}
        />
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Image
            source={
              PosterModalVisible
                ? {
                    uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${details.poster_path}`,
                  }
                : {
                    uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                  }
            }
            style={{
              width: PosterModalVisible ? 300 : 380,
              height: PosterModalVisible ? 450 : 380 * (9 / 16),
              borderRadius: 20,
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

/* ─────────────────────────────────────────
   Styles
───────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Hero */
  heroContainer: { height: BACKDROP_HEIGHT, position: "relative" },
  backdrop: { width: "100%", height: "100%", resizeMode: "cover" },
  noBackdrop: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BACKDROP_HEIGHT * 0.7,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    left: 16,
    zIndex: 10,
  },
  backBtnBlur: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* Lottie snow */
  lottie: {
    position: "absolute",
    height: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },

  /* Info header */
  infoHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: -BACKDROP_HEIGHT * 0.28,
    gap: 14,
    alignItems: "flex-end",
    marginBottom: 20,
  },
  posterShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  poster: { width: 110, height: 110 * 1.5, borderRadius: 14, borderWidth: 1.5 },
  noPoster: {
    width: 110,
    height: 110 * 1.5,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  titleBlock: { flex: 1, paddingBottom: 4, gap: 4 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  altTitle: { fontSize: 12, fontStyle: "italic" },
  tagline: { fontSize: 12, fontStyle: "italic", lineHeight: 17 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  genreChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  genreChipText: { fontSize: 11, fontWeight: "600" },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ratingNum: { fontSize: 16, fontWeight: "700" },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteCount: { fontSize: 12, fontWeight: "500" },

  /* Body */
  body: { paddingHorizontal: 15 },

  /* Stat row */
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statPill: { flex: 1, alignItems: "center", gap: 5 },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 15, fontWeight: "700" },
  statLbl: { fontSize: 11 },
  statDivider: { width: 1, height: 44, opacity: 0.4 },

  /* Comments btn */
  commentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  commentsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  commentsBtnText: { fontSize: 15, fontWeight: "600" },
  commentsRight: { marginLeft: "auto" },

  /* External links */
  externalLinks: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  extLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  extLinkText: { fontSize: 13, fontWeight: "600" },

  /* Sections */
  section: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionAccent: { width: 3, height: 18, borderRadius: 2 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },
  seeAllBtn: { paddingHorizontal: 4 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
  overview: { fontSize: 15, lineHeight: 24 },

  /* Accordion */
  accordionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  accordionTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  accordionBody: { fontSize: 13, lineHeight: 20 },
  accordionMore: { fontSize: 11, fontWeight: "600", marginTop: 6 },

  /* Tags */
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 12, fontWeight: "500" },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  expandBtnText: { fontSize: 13, fontWeight: "600" },

  /* Cast */
  castItem: { width: width * 0.26, alignItems: "center" },
  castImage: {
    width: width * 0.26,
    height: width * 0.26 * 1.5,
    borderRadius: 12,
    marginBottom: 7,
    borderWidth: 1.5,
  },
  castName: {
    fontSize: 11.5,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 15,
  },
  castCharacter: { fontSize: 10.5, textAlign: "center", lineHeight: 14 },

  /* Similar */
  similarItem: { width: width * 0.38 },
  similarPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  ratingPill: {
    position: "absolute",
    bottom: 8,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingPillText: { color: "#FFD700", fontSize: 11, fontWeight: "700" },
  listIndicators: {
    position: "absolute",
    top: 7,
    left: 7,
    flexDirection: "row",
    gap: 4,
  },
  stats: {
    position: "absolute",
    bottom: 8,
    left: 6,
    zIndex: 10,
  },
  /* Videos */
  videoItem: { width: width * 0.62 },
  videoThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
  },
  videoImage: { width: "100%", height: "100%" },
  playIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  videoTypeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  videoTypeBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  videoTitle: { fontSize: 13, marginTop: 9, fontWeight: "600", lineHeight: 18 },

  /* Providers */
  providersRow: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  providerCard: {
    alignItems: "center",
    width: 72,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  providerLogo: { width: 44, height: 44, borderRadius: 10 },
  providerName: { fontSize: 10, textAlign: "center", fontWeight: "500" },

  /* Reviews */
  reviewCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAuthor: { fontSize: 13, fontWeight: "700", flex: 1 },
  reviewDate: { fontSize: 11 },
  reviewBody: { fontSize: 13, lineHeight: 20 },
  readMore: { fontSize: 12, fontWeight: "600", marginTop: 8 },

  /* Video modal */
  videoModal: { flex: 1, justifyContent: "center" },
  videoModalContent: { backgroundColor: "#000", position: "relative" },
  videoCloseBtn: { position: "absolute", top: -52, right: 12, zIndex: 10 },
  videoCloseBtnBlur: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* Date modal */
  dateModalWrap: { flex: 1, justifyContent: "flex-end" },
  dateSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  dateOptions: { flexDirection: "row", gap: 10 },
  dateOption: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  dateOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dateOptionLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  dateOptionSub: { fontSize: 10.5, textAlign: "center" },
});
