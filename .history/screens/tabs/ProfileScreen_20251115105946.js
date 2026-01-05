import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  ScrollView,
  Animated,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
//import {} from "react-native-safe-area-context";
import { useSnow } from "../../context/SnowContext";
import LottieView from "lottie-react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth } from "firebase/auth";
import ProfileLists from "./profile/ProfileLists";
import { useAuth } from "../../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { AvatarSkeleton, WatchedInfoSkeleton } from "../../components/Skeleton";
import { useProfileScreen } from "../../context/ProfileScreenContext";
import * as Progress from "react-native-progress";
import ProfileNotes from "./profile/ProfileNotes";
import ProfileReminders from "./profile/ProfileReminders";
import { useAppSettings } from "../../context/AppSettingsContext";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import CircularProgress, {
  CircularProgressBase,
} from "react-native-circular-progress-indicator";
import { auth, db } from "../../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import UserAvatar from "./profile/UserAvatar";
import Avatar from "./profile/Avatar";
const ProfileScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { showSnow } = useAppSettings();
  const [isloading, setIsLoading] = useState(false);
  const [modalVisibleLogout, setModalVisibleLogout] = useState(false);
  const { user } = useAuth();
  const {
    avatar,
    avatars,
    modalVisible,
    setModalVisible,
    watchedMovieCount,
    totalWatchedTime,
    watchedTvCount,
    totalSeasonsCount,
    totalEpisodesCount,
    totalWatchedTimeTv,
    totalMinutesTime,
    totalMinutesTimeTv,
    borderColor,
    borderColor2,
    shadowColor,
    isloadingAvatar,
    isloadingShowInfo,
    isloadingMovieInfo,
    timeDisplayMode,
    // Fonksiyonlar
    setSelectAvatarIndex,
    handleTimeClick,
    formatTotalDurationTime,

    borderColorTv,
    shadowColorTv,
    borderColor2Tv,
    borderColorMovie,
    shadowColorMovie,
    borderColor2Movie,

    rankNameTv,
    rankLevelTv,
    rankNameMovie,
    rankLevelMovie,
  } = useProfileScreen();
  const SingOut = async () => {
    setIsLoading(true);

    const auth = getAuth();
    try {
      await auth.signOut();
      handleLogout();
    } catch (error) {
      alert(error.message);
      setIsLoading(false);
    }
  };
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "LoginScreen" }],
    });
  };

  const convertTimestampToDate = (timestamp) => {
    const date = new Date(Number(timestamp)); // Timestamp'i Date objesine çevir
    return date.toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const scaleAnimTv = useRef(new Animated.Value(1)).current;
  const scaleAnimMovie = useRef(new Animated.Value(1)).current;

  const onPressIn = (item) => {
    Animated.timing(item === "tv" ? scaleAnimTv : scaleAnimMovie, {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (item) => {
    Animated.timing(item === "tv" ? scaleAnimTv : scaleAnimMovie, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  const props = {
    activeStrokeWidth: 10,
    inActiveStrokeWidth: 10,
    inActiveStrokeOpacity: 0.05,
  };
  const totalTime = totalMinutesTime ?? 0;
  const totalTimeTv = totalMinutesTimeTv ?? 0;
  const rawProgressTv = (totalTimeTv % 10080) / 10080;
  const rawProgressMovie = (totalTime % 10080) / 10080;
  const safeProgressTv = parseInt(
    Math.min(Math.max(rawProgressTv, 0), 1).toFixed(3) * 100
  );
  const safeProgressMovie = parseInt(
    Math.min(Math.max(rawProgressMovie, 0), 1).toFixed(3) * 100
  );
  //console.log("safeProgressTv:", safeProgressMovie);
  const [friendCount, setFriendCount] = useState();
  const [receivedCount, setReceivedCount] = useState();
  const [sendCount, setSendCount] = useState();

  const currentUser = auth.currentUser;
  const currentUserRef = doc(db, "Users", currentUser.uid);
  useEffect(() => {
    const unsubscribe = onSnapshot(currentUserRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const count = data.friends.length;
        const receivedCount = data.friendRequests.receivedRequest.length;
        const sendCount = data.friendRequests.sendRequest.length;
        setFriendCount(count);
        setReceivedCount(receivedCount);
        setSendCount(sendCount);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primary }]}
      >
        <LottieView
          style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
          source={require("../../LottieJson/snow.json")}
          autoPlay={true}
          loop
        />
        <View style={styles.images}>
          <TouchableOpacity
            onPress={() => {
              setModalVisible(true);
            }}
            style={[
              styles.profilImageTouch,
              {
                borderColor: borderColor || "#000",
                shadowColor: shadowColor || "#000",
                padding: 9,
              },
            ]}
          >
            {isloadingAvatar ? (
              <AvatarSkeleton />
            ) : (
              <View
                style={{
                  shadowColor: shadowColorTv,
                  //borderColor: borderColor,
                  borderWidth: 0,
                  borderRadius: 75,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 5,
                  elevation: 15, // Android için gölge
                }}
              >
                <View style={styles.circularProgress}>
                  {!modalVisible && !modalVisibleLogout && (
                    <CircularProgressBase
                      {...props}
                      value={safeProgressMovie}
                      maxValue={100}
                      radius={70}
                      inActiveStrokeColor={borderColor2Movie || "#C25AFF"}
                      activeStrokeColor={borderColorMovie || "#C25AFF"}
                      activeStrokeSecondaryColor={
                        borderColor2Movie || "#C25AFF"
                      }
                      duration={500}
                      showProgressValue={false}
                    >
                      <CircularProgressBase
                        {...props}
                        value={safeProgressTv}
                        maxValue={100}
                        radius={80}
                        duration={500}
                        showProgressValue={false}
                        inActiveStrokeColor={borderColor2Tv || "#C25AFF"}
                        activeStrokeColor={borderColorTv || "#C25AFF"}
                        activeStrokeSecondaryColor={borderColor2Tv || "#C25AFF"}
                      />
                    </CircularProgressBase>
                  )}
                </View>
                <Image
                  source={avatar || require("../../assets/avatar/man_6.jpg")}
                  style={[styles.profilImage, { backgroundColor: borderColor }]}
                />
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flexDirection: "column", width: "50%" }}>
            <Text style={[styles.textName, { color: theme.text.primary }]}>
              {user?.displayName}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Text style={[styles.textEmail, { color: theme.text.primary }]}>
                {user?.email}
              </Text>

              <MaterialIcons
                name="verified"
                size={14}
                color={
                  user?.emailVerified ? "rgb(29, 161, 242)" : "rgb(229, 20, 0)"
                }
              />
            </View>
            {!user.emailVerified && (
              <Text style={[styles.textVerified, { color: "rgb(229, 20, 0)" }]}>
                {t.profileScreen.emailVerified}
              </Text>
            )}
            {user && user.metadata && (
              <Text style={[styles.textDate, { color: theme.text.primary }]}>
                Katılma tarihi:{" "}
                {convertTimestampToDate(user.metadata.createdAt)}
              </Text>
            )}
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
              width: "30%",
              paddingHorizontal: 6,
              paddingVertical: 6,
              borderTopLeftRadius: 10,
              borderBottomLeftRadius: 10,
              backgroundColor: theme.secondary,
            }}
            onPress={() => navigation.navigate("SearchFriendsScreen")}
          >
            <Text style={{ color: theme.text.secondary }}>Arama</Text>
            <Text style={{ color: theme.text.secondary }}></Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
              width: "30%",
              paddingHorizontal: 6,
              paddingVertical: 12,
              backgroundColor: theme.secondary,
            }}
            onPress={() => navigation.navigate("FriendsListScreen")}
          >
            <Text style={{ color: theme.text.secondary }}>Arkadaşlar</Text>
            <Text style={{ color: theme.text.secondary }}>{friendCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,

              borderTopRightRadius: 10,
              borderBottomRightRadius: 10,
              width: "30%",
              paddingHorizontal: 6,
              paddingVertical: 12,
              backgroundColor: theme.secondary,
            }}
            onPress={() => navigation.navigate("FriendRequestsScreen")}
          >
            <Text style={{ color: theme.text.secondary }}>İstekler</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: theme.text.secondary }}>
                {receivedCount}
              </Text>
              <MaterialCommunityIcons
                name="arrow-bottom-left"
                size={14}
                color="#70ffb0ff"
              />
              <Text style={{ color: theme.text.secondary }}>{sendCount}</Text>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={14}
                color="#70baffff"
              />
            </View>
          </TouchableOpacity>
        </View>
        {/* <Avatar /> */}
        <TouchableOpacity
          onPress={() => handleTimeClick()}
          activeOpacity={0.8}
          style={[
            styles.totalDurationContainer,
            {
              backgroundColor: theme.primary,
              shadowColor: theme.shadow,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.durationItem}>
            <Ionicons
              name="time-outline"
              size={18}
              color={theme.text.secondary}
            />
            <View>
              <Text style={[styles.durationValue, { color: theme.accent }]}>
                {formatTotalDurationTime(
                  (totalMinutesTimeTv || 0) + (totalMinutesTime || 0),
                  timeDisplayMode
                )}
              </Text>
              <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
                {t.profileScreen.totalDuration}
              </Text>
            </View>
          </View>
          <View style={styles.durationItem}>
            <Ionicons
              name="film-outline"
              size={18}
              color={theme.text.secondary}
            />
            <View>
              <Text style={[styles.durationValue, { color: borderColorMovie }]}>
                {formatTotalDurationTime(
                  totalMinutesTime || 0,
                  timeDisplayMode
                )}
              </Text>
              <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
                {t.movies} {rankNameMovie}
              </Text>
            </View>
          </View>
          <View style={styles.durationItem}>
            <Ionicons
              name="tv-outline"
              size={18}
              color={theme.text.secondary}
            />
            <View>
              <Text style={[styles.durationValue, { color: borderColorTv }]}>
                {formatTotalDurationTime(
                  totalMinutesTimeTv || 0,
                  timeDisplayMode
                )}
              </Text>
              <Text style={[styles.durationLabel, { color: theme.text.muted }]}>
                {t.tvShows} {rankNameTv}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
            {t.profileScreen.movieStatistics}
          </Text>
          {isloadingShowInfo ? (
            <WatchedInfoSkeleton />
          ) : (
            <Animated.View style={{ transform: [{ scale: scaleAnimMovie }] }}>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("MovieStatisticsScreen");
                }}
                onPressIn={() => onPressIn("movie")}
                onPressOut={() => onPressOut("movie")}
                activeOpacity={0.8}
                style={[
                  styles.watchStats,
                  {
                    backgroundColor: theme.border,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View
                  style={[
                    styles.watchStatsView,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.textSecondary,
                      {
                        color: theme.text.secondary,
                      },
                    ]}
                  >
                    {watchedMovieCount}
                  </Text>
                  <Text
                    style={[
                      styles.textMuted,
                      {
                        color: theme.text.muted,
                      },
                    ]}
                  >
                    {t.profileScreen.movieWatched}
                  </Text>
                </View>
                <View
                  style={[
                    styles.watchStatsView2,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTime?.years}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.years}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTime?.months}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.months}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTime?.days}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.days}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTime?.hours}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.hours}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTime?.minutes}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.minutes}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
            {t.profileScreen.tvShowStatistics}
          </Text>
          {isloadingMovieInfo ? (
            <WatchedInfoSkeleton />
          ) : (
            <Animated.View style={{ transform: [{ scale: scaleAnimTv }] }}>
              <TouchableOpacity
                onPressIn={() => onPressIn("tv")}
                onPressOut={() => onPressOut("tv")}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate("TvStatisticsScreen");
                }}
                style={[
                  styles.watchStats,
                  {
                    backgroundColor: theme.border,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View
                  style={[
                    styles.watchStatsView,
                    {
                      flexDirection: "row",
                      justifyContent: "space-around",
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {watchedTvCount}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.tvShowCount}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalEpisodesCount}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.tvShowEpisodetotalCount}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.watchStatsView2,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTimeTv?.years}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.years}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTimeTv?.months}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.months}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTimeTv?.days}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.days}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTimeTv?.hours}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.hours}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.textSecondary,
                        {
                          color: theme.text.secondary,
                        },
                      ]}
                    >
                      {totalWatchedTimeTv?.minutes}
                    </Text>
                    <Text
                      style={[
                        styles.textMuted,
                        {
                          color: theme.text.muted,
                        },
                      ]}
                    >
                      {t.profileScreen.minutes}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
        <ProfileLists navigation={navigation} />
        <ProfileReminders navigation={navigation} />
        <ProfileNotes navigation={navigation} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
            {t.logout}
          </Text>
          <TouchableOpacity
            onPress={() => setModalVisibleLogout(true)}
            style={[
              styles.logout,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
              {t.logout}
            </Text>
            <Ionicons
              name={"log-out-outline"}
              size={24}
              color={theme.text.primary}
            />
          </TouchableOpacity>
        </View>
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(false);
          }}
        >
          <View style={styles.modalContainer}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: theme.secondary },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                {t.profileScreen.selectAvatar}
              </Text>
              <FlatList
                data={avatars || []}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity onPress={() => setSelectAvatarIndex(index)}>
                    {item && <Image source={item} style={styles.avatarImage} />}
                  </TouchableOpacity>
                )}
                numColumns={3}
              />

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                }}
                style={[styles.closeButton, { backgroundColor: theme.accent }]}
              >
                <Text
                  style={[
                    styles.closeButtonText,
                    { color: theme.text.primary },
                  ]}
                >
                  {t.profileScreen.close}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisibleLogout}
          onRequestClose={() => setModalVisibleLogout(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.positionStyle}
              onPress={() => setModalVisibleLogout(false)}
            />
            <LinearGradient
              colors={["transparent", theme.shadow, "transparent"]}
              style={[styles.positionStyle, { zIndex: -1 }]}
            />
            <View
              style={[styles.modalView, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.modalText, { color: theme.text.primary }]}>
                {t.profileScreen.logoutMessage}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={() => setModalVisibleLogout(false)}
                >
                  <Text style={styles.textStyle}>{t.profileScreen.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonConfirm]}
                  onPress={() => {
                    SingOut();
                    setModalVisibleLogout(false);
                  }}
                >
                  <Text style={styles.textStyle}>
                    {t.profileScreen.confirm}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    marginBottom: 100,
    alignItems: "center",
    backgroundColor: "#000",
  },
  positionStyle: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  circularProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -2,
    justifyContent: "center",
    alignItems: "center",
  },
  textName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  textEmail: {
    fontSize: 14,
    gap: 10,
    color: "#000",
  },
  textVerified: {
    fontSize: 10,
    gap: 10,
    color: "#000",
  },
  textDate: {
    fontSize: 12,
    gap: 10,
    color: "#000",
  },
  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },
  profilImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    margin: 10,
  },
  profilImageTouch: {
    borderRadius: 100,
    //borderWidth: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 25,
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    margin: 10,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#007bff",
    borderRadius: 5,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  images: {
    width: "100%",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  section: {
    width: "90%",
    //marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  logout: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  watchStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 5,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    //borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10, // Android için güçlü gölge efekti
  },
  watchStatsView: {
    width: "43%",
    justifyContent: "center",
    alignItems: "center",

    //borderWidth: 1,
    padding: 5,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10, // Android için güçlü gölge efekti
  },
  textSecondary: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
  },
  textMuted: { textAlign: "center", fontSize: 12 },
  watchStatsView2: {
    width: "55%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",

    //borderWidth: 1,
    padding: 5,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10, // Android için güçlü gölge efekti
  },
  settingText: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: "45%",
    alignItems: "center",
  },
  buttonCancel: {
    backgroundColor: "#f44336",
  },
  buttonConfirm: {
    backgroundColor: "#4CAF50",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  totalDurationContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "90%",
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 12,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  durationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationValue: {
    fontSize: 13,
    fontWeight: "bold",
  },
  durationLabel: {
    fontSize: 10,
    textTransform: "uppercase",
  },
});

export default ProfileScreen;
