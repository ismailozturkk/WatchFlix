import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  Animated,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { BlurView } from "expo-blur";
import IconBacground from "../../components/IconBacground";
import CalendarWidget from "../../components/profile/CalendarWidget";
import StatisticsSection from "./profile/StatisticsSection";
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
    Math.min(Math.max(rawProgressTv, 0), 1).toFixed(3) * 100,
  );
  const safeProgressMovie = parseInt(
    Math.min(Math.max(rawProgressMovie, 0), 1).toFixed(3) * 100,
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
        const count = data.friends?.length || 0;
        const receivedCount = data.friendRequests?.receivedRequest?.length || 0;
        const sendCount = data.friendRequests?.sendRequest?.length || 0;
        setFriendCount(count);
        setReceivedCount(receivedCount);
        setSendCount(sendCount);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: "transparent" }]}
        >
          {showSnow && (
            <>
              <LottieView
                style={styles.lottie}
                source={require("../../LottieJson/snow.json")}
                autoPlay={true}
                loop
              />
              <LottieView
                style={styles.lottie1}
                source={require("../../LottieJson/snow.json")}
                autoPlay={true}
                loop
              />
            </>
          )}
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
                          activeStrokeSecondaryColor={
                            borderColor2Tv || "#C25AFF"
                          }
                        />
                      </CircularProgressBase>
                    )}
                  </View>
                  <View
                    style={{
                      overflow: "hidden",
                      borderRadius: 100,
                      padding: 10,
                      margin: 10,
                      backgroundColor: theme.primary,
                    }}
                  >
                    <Image
                      source={avatar || require("../../assets/avatar/3.png")}
                      style={[
                        styles.profilImage,
                        { backgroundColor: borderColor },
                      ]}
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flexDirection: "column", width: "50%" }}>
              <Text
                allowFontScaling={false}
                style={[styles.textName, { color: theme.text.primary }]}
              >
                {user?.displayName}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.textEmail, { color: theme.text.primary }]}
                >
                  {user?.email}
                </Text>

                <MaterialIcons
                  name="verified"
                  size={14}
                  color={
                    user?.emailVerified
                      ? "rgb(29, 161, 242)"
                      : "rgb(229, 20, 0)"
                  }
                />
              </View>
              {!user.emailVerified && (
                <Text
                  style={[styles.textVerified, { color: "rgb(229, 20, 0)" }]}
                >
                  {t.profileScreen.emailVerified}
                </Text>
              )}
              {user && user.metadata && (
                <Text
                  allowFontScaling={false}
                  style={[styles.textDate, { color: theme.text.primary }]}
                >
                  Katılma tarihi:{" "}
                  {convertTimestampToDate(user.metadata.createdAt)}
                </Text>
              )}
            </View>
          </View>
          {/* ── Arkadaş aksiyonları ── */}
          {/* ── Arkadaş aksiyonları ── */}
          <View
            style={[styles.friendBar, { backgroundColor: theme.secondary }]}
          >
            {/* Arkadaş Ara */}
            <TouchableOpacity
              style={styles.friendBarBtnCompact}
              onPress={() => navigation.navigate("SearchFriendsScreen")}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.friendBarIconWrap,
                  { backgroundColor: theme.accent + "15" },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >
                Ara
              </Text>
            </TouchableOpacity>

            {/* Dikey ayraç */}
            <View
              style={[
                styles.friendBarDivider,
                { backgroundColor: theme.text.secondary + "20" },
              ]}
            />

            {/* Arkadaşlar — yatay */}
            <TouchableOpacity
              style={styles.friendBarBtnWide}
              onPress={() => navigation.navigate("FriendsListScreen")}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.friendBarIconWrap,
                  { backgroundColor: "#64b4ff15" },
                ]}
              >
                <Ionicons name="people-outline" size={18} color="#64b4ff" />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >
                Arkadaşlar
              </Text>
              {friendCount > 0 && (
                <View
                  style={[styles.friendBarPill, { backgroundColor: "#64b4ff" }]}
                >
                  <Text
                    allowFontScaling={false}
                    style={styles.friendBarPillText}
                  >
                    {friendCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Dikey ayraç */}
            <View
              style={[
                styles.friendBarDivider,
                { backgroundColor: theme.text.secondary + "20" },
              ]}
            />

            {/* İstekler — yatay */}
            <TouchableOpacity
              style={styles.friendBarBtnWide}
              onPress={() => navigation.navigate("FriendRequestsScreen")}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.friendBarIconWrap,
                  { backgroundColor: "#29b86415" },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color="#29b864" />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >
                İstekler
              </Text>
              {(receivedCount > 0 || sendCount > 0) && (
                <View style={styles.friendBarPillRow}>
                  {receivedCount > 0 && (
                    <View
                      style={[
                        styles.friendBarPill,
                        { backgroundColor: "#29b864" },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={styles.friendBarPillText}
                      >
                        {receivedCount}
                      </Text>
                    </View>
                  )}
                  {sendCount > 0 && (
                    <View
                      style={[
                        styles.friendBarPill,
                        { backgroundColor: "#64b4ff" },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={styles.friendBarPillText}
                      >
                        {sendCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
          {/* todo <Avatar /> */}
          <StatisticsSection
            theme={theme}
            isloadingShowInfo={isloadingShowInfo}
            isloadingMovieInfo={isloadingMovieInfo}
            watchedMovieCount={watchedMovieCount}
            watchedTvCount={watchedTvCount}
            totalEpisodesCount={totalEpisodesCount}
            totalWatchedTime={totalWatchedTime}
            totalWatchedTimeTv={totalWatchedTimeTv}
            totalMinutesTime={totalMinutesTime}
            totalMinutesTimeTv={totalMinutesTimeTv}
            timeDisplayMode={timeDisplayMode}
            rankNameMovie={rankNameMovie}
            rankNameTv={rankNameTv}
            borderColorMovie={borderColorMovie}
            borderColorTv={borderColorTv}
            formatTotalDurationTime={formatTotalDurationTime}
            onNavigateMovieStats={() =>
              navigation.navigate("MovieStatisticsScreen")
            }
            onNavigateTvStats={() => navigation.navigate("TvStatisticsScreen")}
            onTimeClick={handleTimeClick}
            t={t}
          />
          <ProfileLists navigation={navigation} />
          <CalendarWidget navigation={navigation} />
          <ProfileReminders navigation={navigation} />
          <ProfileNotes navigation={navigation} />
          <View style={styles.section}>
            <Text
              allowFontScaling={false}
              style={[styles.sectionTitle, { color: theme.text.muted }]}
            >
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
              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
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
              <BlurView
                tint="dark"
                intensity={50}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.modalContent, { marginVertical: 80 }]}>
                <Text
                  style={[styles.modalTitle, { color: theme.text.primary }]}
                >
                  {t.profileScreen.selectAvatar}
                </Text>
                <FlatList
                  data={avatars || []}
                  keyExtractor={(item, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      onPress={() => setSelectAvatarIndex(index)}
                    >
                      {item && (
                        <Image source={item} style={styles.avatarImage} />
                      )}
                    </TouchableOpacity>
                  )}
                  numColumns={4}
                />

                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                  }}
                  style={[
                    styles.closeButton,
                    { backgroundColor: theme.accent },
                  ]}
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
              <BlurView
                tint="dark"
                intensity={50}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />

              <View
                style={[styles.modalView, { backgroundColor: theme.primary }]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.modalText, { color: theme.text.primary }]}
                >
                  {t.profileScreen.logoutMessage}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonCancel]}
                    onPress={() => setModalVisibleLogout(false)}
                  >
                    <Text allowFontScaling={false} style={styles.textStyle}>
                      {t.profileScreen.cancel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonConfirm]}
                    onPress={() => {
                      SingOut();
                      setModalVisibleLogout(false);
                    }}
                  >
                    <Text allowFontScaling={false} style={styles.textStyle}>
                      {t.profileScreen.confirm}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Arkadaş bar ───────────────────────────────────────────────────────────
  friendBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    paddingVertical: 4,
  },

  // Ara butonu — dikey (kompakt)
  friendBarBtnCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 7,
  },

  // Arkadaşlar & İstekler — yatay (icon sol, label+badge sağ)
  friendBarBtnWide: {
    flex: 1,
    flexDirection: "row", // ← yatay düzen
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 7,
  },

  friendBarDivider: {
    width: 1,
    height: 32,
    borderRadius: 1,
  },
  friendBarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  friendBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  friendBarPillRow: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  friendBarPill: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  friendBarPillText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  // ───────────────────────────────────────────────────────────────────────────

  container: {
    flex: 1,
    //paddingTop: 0,
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
    top: -750,
    left: -60,
    right: -60,
    bottom: -250,
    zIndex: 0,
  },
  lottie1: {
    position: "absolute",
    top: 1150,
    left: -60,
    right: -60,
    bottom: -250,
    zIndex: 0,
  },
  profilImage: {
    width: 100,
    height: 100,
    borderRadius: 0,
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
    margin: 5,
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
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  watchStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 5,
    borderRadius: 18,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: "bold",
  },
  durationLabel: {
    fontSize: 10,
    textTransform: "uppercase",
  },
});

export default ProfileScreen;
