import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Platform,
  Pressable,
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
import { getDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Toast from "react-native-toast-message";
import SeasonItem from "./SeasonItem";
import * as Progress from "react-native-progress";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Entypo from "@expo/vector-icons/Entypo";
import { useAppSettings } from "../../context/AppSettingsContext";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ListViewTv from "../../components/ListViewTv";
import { BlurView } from "expo-blur";
import { useListStatus } from "../../modules/UseListStatus";
import YoutubePlayer from "react-native-youtube-iframe";
import { useListStatusContext } from "../../context/ListStatusContext";
import IconBacground from "../../components/IconBacground";

const { height, width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);

/* ─── Section header (aynı MovieDetails stili) ── */
const SectionHeader = ({ title, right, theme }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {right}
  </View>
);

/* ─── Benzer dizi kartı ── */
const SimilarTvShow = ({
  item,
  navigation,
  scaleValues,
  onPressIn,
  onPressOut,
  imageQuality,
  theme,
}) => {
  const { inWatchList, inFavorites, isWatched, isInOtherLists } = useListStatus(
    item.id,
    "tv",
  );
  const isInAnyList = inWatchList || isWatched || inFavorites || isInOtherLists;

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleValues[item.id] || 1 }] }}
    >
      <TouchableOpacity
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        activeOpacity={0.9}
        style={styles.similarItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
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
        <View
          style={[styles.ratingPill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
        >
          <Ionicons name="star" size={9} color="#FFD700" />
          <Text allowFontScaling={false} style={styles.ratingPillText}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
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

/* ─── Ana bileşen ── */
export default function TvShowsDetails({ route, navigation }) {
  const { id } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { API_KEY, showSnow, imageQuality } = useAppSettings();
  const { allLists } = useListStatusContext();

  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const overviewHeightAnim = useRef(new Animated.Value(80)).current;
  const overviewOpacity = useRef(new Animated.Value(1)).current;
  const HALF_W = (width - 30 - 10) / 2;
  const FULL_W = width - 30;
  const overviewWidthAnim = useRef(new Animated.Value(HALF_W)).current;

  const toggleOverview = () => {
    const opening = !overviewExpanded;
    setOverviewExpanded(opening);
    Animated.parallel([
      Animated.timing(overviewHeightAnim, {
        toValue: opening ? 500 : 80,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(overviewWidthAnim, {
        toValue: opening ? FULL_W : HALF_W,
        duration: 280,
        useNativeDriver: false,
      }),
    ]).start();
  };
  const [listStates, setListStates] = useState({});
  const [scaleValues, setScaleValues] = useState({});
  const [isSeasonWatched, setIsSeasonWatched] = useState(0);
  const [showEpisodeCount, setShowEpisodeCount] = useState();
  const [showEpisodes, setShowEpisodes] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [reviewLength, setReviewLength] = useState(5);
  const [reviewTextLength, setReviewTextLength] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [PosterModalVisible, setPosterModalVisible] = useState(false);
  const [backdropModalVisible, setBacdropModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  /* ── Format helpers ── */
  const formatDate = (ts) => {
    if (!ts) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ts));
  };
  const formatDateSave = (ts) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ── Press animasyonları ── */
  const onPressIn = (id) => {
    if (!scaleValues[id]) return;
    Animated.timing(scaleValues[id], {
      toValue: 0.93,
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

  /* ── listStates ── */
  useEffect(() => {
    if (!allLists) {
      setListStates({});
      return;
    }
    const s = {};
    Object.entries(allLists).forEach(([k, v]) => {
      s[k] = Array.isArray(v)
        ? v.some((i) => i.id === id && i.type === "tv")
        : false;
    });
    setListStates(s);
  }, [allLists, id]);

  /* ── scaleValues ── */
  useEffect(() => {
    if (!details) return;
    const vals = {};
    [
      ...(details.recommendations?.results || []).slice(0, 20),
      ...(details.similar?.results || []).slice(0, 20),
    ].forEach((item) => {
      if (item?.id) vals[item.id] = new Animated.Value(1);
    });
    setScaleValues(vals);
  }, [details]);

  /* ── Fetch details ── */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/tv/${id}`,
          params: {
            language: language === "tr" ? "tr-TR" : "en-US",
            append_to_response:
              "account_states,alternative_titles,changes,credits,external_ids,images,keywords,lists,recommendations,release_dates,reviews,similar,translations,videos,watch/providers",
          },
          headers: { accept: "application/json", Authorization: API_KEY },
        });
        setDetails(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, language]);

  /* ── İzlenme kontrolü ── */
  const checkIfWatched = () => {
    if (!allLists) {
      setShowEpisodeCount();
      setShowEpisodes();
      setIsSeasonWatched(0);
      return;
    }
    const tvShow = (allLists.watchedTv || []).find((s) => s.id === id);
    if (tvShow) {
      const total = tvShow.showEpisodeCount;
      const watched = Array.isArray(tvShow.seasons)
        ? tvShow.seasons.reduce((a, s) => a + (s.episodes?.length || 0), 0)
        : 0;
      setShowEpisodeCount(total);
      setShowEpisodes(watched);
      setIsSeasonWatched(total && watched ? watched / total : 0);
    } else {
      setShowEpisodeCount();
      setShowEpisodes();
      setIsSeasonWatched(0);
    }
  };
  useEffect(() => {
    checkIfWatched();
  }, [allLists, id]);

  /* ── updateTvSeriesList ── */
  const updateTvSeriesList = async (listType, type) => {
    if (!user.uid || !details) return;
    const ref = doc(db, "Lists", user.uid);
    try {
      const snap = await getDoc(ref);
      let data = snap.exists()
        ? snap.data()
        : { watchedTv: [], favorites: [], watchList: [], watchedMovies: [] };
      if (!snap.exists()) await setDoc(ref, data);
      let list = data[listType] || [];
      const idx = list.findIndex((i) => i.id === details.id && i.type === type);
      const getName = (l) =>
        ({
          favorites: t.tvShowsDetails?.favorites,
          watchList: t.tvShowsDetails?.watchList,
          watchedMovies: t.tvShowsDetails?.watched,
          watchedTv: t.tvShowsDetails?.watchedTv,
        })[l] || l;
      if (idx !== -1) {
        list.splice(idx, 1);
        Toast.show({
          type: "warning",
          text1: `Dizi ${getName(listType)} listesinden kaldırıldı!`,
        });
      } else {
        list.push({
          id: details.id,
          dateAdded: formatDateSave(new Date()),
          imagePath: details.poster_path,
          name: details.name,
          type,
          genres: details.genres?.map((g) => g.name) || [],
        });
        Toast.show({
          type: "success",
          text1: `Dizi ${getName(listType)} listesine eklendi!`,
        });
      }
      await updateDoc(ref, { [listType]: list });
    } catch (e) {
      Toast.show({ type: "error", text1: "Hata: " + e.message });
    }
  };

  /* ── Modal helpers ── */
  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (date) => {
    setSelectedDate(date);
    addShowToFirestore(date);
    hideDatePicker();
  };
  const showReleaseDateTime = new Date(details?.first_air_date);
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
  /* ── addShowToFirestore ── */
  const addShowToFirestore = async (selDate = null) => {
    if (!user || !details || !details.seasons || !selDate) return;
    try {
      setIsLoading(true);
      closeModal();
      const ref = doc(db, "Lists", user.uid);
      const snap = await getDoc(ref);
      let data = snap.exists() ? snap.data() : { watchedTv: [] };
      let wTv = data.watchedTv || [];
      const idx = wTv.findIndex((s) => s.id === details.id);
      const eDate = formatDateSave(selDate);
      if (idx !== -1) {
        wTv.splice(idx, 1);
        await updateDoc(ref, { watchedTv: wTv });
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
        addedShowDate: eDate,
        genres: details.genres?.map((g) => g.name) || [],
        seasons: [],
      };
      for (const seasonObj of details.seasons) {
        if (!seasonObj.season_number || seasonObj.episode_count === 0) continue;
        const res = await axios.get(
          `https://api.themoviedb.org/3/tv/${details.id}/season/${seasonObj.season_number}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        const sd = {
          seasonNumber: seasonObj.season_number,
          seasonPosterPath: seasonObj.poster_path || null,
          seasonEpisodes: seasonObj.episode_count,
          addedSeasonDate: eDate,
          episodes: [],
        };
        for (const ep of res.data.episodes) {
          sd.episodes.push({
            episodeNumber: ep.episode_number,
            episodePosterPath: ep.still_path || null,
            episodeName: ep.name || "Unknown",
            episodeRatings: ep.vote_average?.toFixed(1) ?? 0,
            episodeMinutes: ep.runtime || 0,
            episodeWatchTime: eDate,
          });
        }
        newShow.seasons.push(sd);
      }
      wTv.push(newShow);
      await updateDoc(ref, { watchedTv: wTv });
      Toast.show({
        type: "success",
        text1: "Dizi bölümleri izlendi olarak işaretlendi",
      });
      checkIfWatched();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── renderVideo ── */
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
        style={{
          flex: 1,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.text.primary }}>{t.loading}</Text>
      </View>
    );

  const watchedColor =
    isSeasonWatched === 1
      ? theme.colors.green
      : showEpisodes
        ? theme.colors.orange
        : theme.colors.blue;

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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HERO / BACKDROP ── */}
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
              <Ionicons name="tv-outline" size={64} color={theme.text.muted} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)", theme.primary]}
            locations={[0.3, 0.65, 1]}
            style={styles.heroGradient}
          />

          {/* Geri butonu */}
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
            details.seasons.map(
              (se, i) =>
                ((i + 4) % 4 === 0 || i < 4) && (
                  <LottieView
                    key={se.season_number}
                    style={[
                      styles.lottie,
                      { top: 1000 * Math.floor(i < 4 ? i : i / 4) },
                    ]}
                    source={require("../../LottieJson/snow.json")}
                    autoPlay
                    loop
                  />
                ),
            )}
        </View>

        {/* ── POSTER + INFO HEADER ── */}
        <View style={styles.infoHeader}>
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

          <View style={styles.titleBlock}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {details.name}
            </Text>
            {details.tagline ? (
              <Text
                allowFontScaling={false}
                style={[styles.tagline, { color: theme.accent }]}
                numberOfLines={2}
              >
                "{details.tagline}"
              </Text>
            ) : null}
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
            <View style={styles.ratingRow}>
              {details.vote_average > 0 && (
                <RatingStars rating={details.vote_average} />
              )}
              <Text style={[styles.ratingNum, { color: theme.colors.orange }]}>
                {details.vote_average > 0
                  ? details.vote_average.toFixed(1)
                  : t.tvShowsDetails?.notYetRated}
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

        {/* ── BODY ── */}
        <View style={styles.body}>
          {/* ListViewTv + progress bar */}
          <View style={{ marginBottom: 8 }}>
            <ListViewTv
              isSeasonWatched={isSeasonWatched}
              navigation={navigation}
              updateList={updateTvSeriesList}
              openModal={openModal}
              addShowToFirestore={addShowToFirestore}
              isLoading={isLoading}
              listStates={listStates}
              type="tv"
            />
            <View
              style={{ marginTop: -12, marginHorizontal: 4, marginBottom: 8 }}
            >
              <Progress.Bar
                progress={isSeasonWatched || 0}
                width={width - 30}
                height={3}
                borderWidth={0}
                borderRadius={2}
                animationConfig={{ bounciness: 10 }}
                color={watchedColor}
                unfilledColor={theme.border}
              />
            </View>
          </View>

          {/* ── STAT KARTLARI ── */}
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
                  name="layers-outline"
                  size={16}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statVal, { color: theme.text.primary }]}
              >
                {details.number_of_seasons || 0}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.seasons}
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
                  name="play-circle-outline"
                  size={16}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.statVal, { color: theme.text.primary }]}
                >
                  {details.number_of_episodes || 0}
                </Text>
                {showEpisodes !== undefined && (
                  <Text
                    allowFontScaling={false}
                    style={[styles.statValSub, { color: theme.text.muted }]}
                  >
                    /{showEpisodes}
                  </Text>
                )}
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.episode}
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
                  name="calendar-outline"
                  size={16}
                  color={theme.colors?.green || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.statVal,
                  { color: theme.text.primary, fontSize: 13 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatDate(details.first_air_date)}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLbl, { color: theme.text.muted }]}
              >
                {t.tvShowsDetails?.airDate}
              </Text>
            </View>
          </View>

          {/* ── TV SHOW ITEM ── */}
          <View style={styles.section}>
            <TVShowItem item={details} navigation={navigation} />
          </View>

          {/* ── SEZON GRAFİK KARTI ── */}
          {details.seasons.filter((s) => s.season_number > 0).length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.seasons} theme={theme} />
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("TvGraphDetailScreen", { id })
                }
                activeOpacity={0.88}
                style={[styles.graphCard, { borderColor: theme.border }]}
              >
                {details.backdrop_path && (
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
                    }}
                    style={styles.graphBackdrop}
                    blurRadius={2}
                  />
                )}
                <LinearGradient
                  colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.graphContent}>
                  {details.poster_path && (
                    <Image
                      source={{
                        uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${details.poster_path}`,
                      }}
                      style={styles.graphPoster}
                    />
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text
                      allowFontScaling={false}
                      style={[styles.graphTitle, { color: "#fff" }]}
                    >
                      {details.name}
                    </Text>
                    <View style={styles.graphStats}>
                      {[
                        {
                          icon: "layers-outline",
                          val: details.number_of_seasons,
                          lbl: t.seasons,
                        },
                        {
                          icon: "play-circle-outline",
                          val: details.number_of_episodes,
                          lbl: t.episode,
                        },
                        {
                          icon: "star-outline",
                          val: details.vote_count,
                          lbl: t.votes,
                        },
                      ].map(({ icon, val, lbl }) => (
                        <View key={lbl} style={styles.graphStatItem}>
                          <Ionicons
                            name={icon}
                            size={14}
                            color="rgba(255,255,255,0.7)"
                          />
                          <Text
                            allowFontScaling={false}
                            style={styles.graphStatVal}
                          >
                            {val || 0}
                          </Text>
                          <Text
                            allowFontScaling={false}
                            style={styles.graphStatLbl}
                          >
                            {lbl}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.graphChevron]}>
                      <Ionicons
                        name="bar-chart-outline"
                        size={13}
                        color="rgba(255,255,255,0.7)"
                      />
                      <Text
                        allowFontScaling={false}
                        style={styles.graphChevronText}
                      >
                        Detaylı İstatistikler
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="rgba(255,255,255,0.6)"
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
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

          {/* ── SEZONLAR LİSTESİ ── */}
          <View style={styles.section}>
            <SectionHeader title={t.seasons} theme={theme} />
            {details.seasons.filter((s) => s.season_number > 0).length > 0 ? (
              details.seasons
                .filter((s) => s.season_number > 0)
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
                  styles.emptyCard,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={28}
                  color={theme.text.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.emptyText, { color: theme.text.muted }]}
                >
                  {t.noSeasonInfo}
                </Text>
              </View>
            )}
          </View>

          {/* ── ÖNERİLEN DİZİLER ── */}
          {details.recommendations?.results.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.recommendedTvShows} theme={theme} />
              <FlatList
                data={details.recommendations.results.slice(0, 20)}
                renderItem={({ item }) => (
                  <SimilarTvShow
                    item={item}
                    navigation={navigation}
                    scaleValues={scaleValues}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    imageQuality={imageQuality}
                    theme={theme}
                  />
                )}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
              />
            </View>
          )}

          {/* ── BENZER DİZİLER ── */}
          {details.similar?.results.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t.similarTvShows} theme={theme} />
              <FlatList
                data={details.similar.results.slice(0, 20)}
                renderItem={({ item }) => (
                  <SimilarTvShow
                    item={item}
                    navigation={navigation}
                    scaleValues={scaleValues}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    imageQuality={imageQuality}
                    theme={theme}
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
                      {new Date(review.created_at).toLocaleDateString()}
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
                  style={styles.expandBtn}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={
                      reviewLength > 5
                        ? "keyboard-arrow-up"
                        : "keyboard-arrow-down"
                    }
                    size={20}
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

      {/* ═══ MODALS ═══ */}

      {/* Video */}
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
              Bu diziyi ne zaman izlediniz?
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
                  {selectedDate ? formatDateSave(selectedDate) : "Tarih Seç"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateOption,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => {
                  setSelectedDate(new Date());
                  addShowToFirestore(new Date());
                }}
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
                onPress={() => {
                  setSelectedDate(showReleaseDateTime);
                  addShowToFirestore(showReleaseDateTime);
                }}
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
                  <MaterialCommunityIcons
                    name="movie-play-outline"
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
                  {formatDate(showReleaseDateTime)}
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              onConfirm={handleConfirm}
              onCancel={hideDatePicker}
              minimumDate={showReleaseDateTime}
              maximumDate={new Date()}
            />
          </View>
        </View>
      </Modal>

      {/* Poster / Backdrop */}
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
  lottie: {
    position: "absolute",
    height: 1000,
    left: -120,
    right: -120,
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
  poster: { width: 110, height: 165, borderRadius: 14, borderWidth: 1.5 },
  noPoster: {
    width: 110,
    height: 165,
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
  statValSub: { fontSize: 11, marginBottom: 2 },
  statLbl: { fontSize: 11 },
  statDivider: { width: 1, height: 44, opacity: 0.4 },

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

  /* Graph card */
  graphCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    height: 160,
  },
  graphBackdrop: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  graphContent: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    gap: 12,
    alignItems: "center",
  },
  graphPoster: { width: 80, height: 120, borderRadius: 10 },
  graphTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  graphStats: { flexDirection: "row", gap: 16 },
  graphStatItem: { alignItems: "center", gap: 2 },
  graphStatVal: { color: "#fff", fontSize: 14, fontWeight: "700" },
  graphStatLbl: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  graphChevron: { flexDirection: "row", alignItems: "center", gap: 5 },
  graphChevronText: { color: "rgba(255,255,255,0.65)", fontSize: 12, flex: 1 },

  /* Overview */
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

  /* Empty */
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },

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
  listDots: {
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
