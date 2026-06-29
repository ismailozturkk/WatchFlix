import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
//import {} from "react-native-safe-area-context";
import { useSnow } from "../../context/SnowContext";
import LottieView from "lottie-react-native";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import { getAuth } from "firebase/auth";
import ProfileLists from "./profile/ProfileLists";
import { useAuth } from "../../context/AuthContext";
import { useFriends } from "../../context/FriendsContext";
import { AvatarSkeleton, WatchedInfoSkeleton } from "../../components/Skeleton";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import * as Progress from "react-native-progress";
import NotesCard from "./profile/NotesCard";
import RemindersPreviewButton from "./profile/RemindersPreviewButton";
import MyActivityButton from "./profile/MyActivityButton";
import { useSnowSettings } from "../../context/AppSettingsContext";
import CircularProgress, {
  CircularProgressBase,
} from "react-native-circular-progress-indicator";
import UserAvatar from "./profile/UserAvatar";
import Avatar from "./profile/Avatar";
import { BlurView } from "expo-blur";
import IconBacground from "../../components/IconBacground";
import BackButton from "../../components/BackButton";
import CalendarWidget from "../../components/profile/CalendarWidget";
import StatisticsSection from "./profile/StatisticsSection";
import { useUserProfile } from "../../context/UserProfileContext";
import { propagateProfileChange } from "../../services/profilePropagation";
import { i18nText } from "../../utils/i18nText";
import ProfileAvatarPickerModal from "../../components/profile/ProfileAvatarPickerModal";

const ProfileScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { showSnow } = useSnowSettings();
  const [isloading, setIsLoading] = useState(false);
  const [modalVisibleLogout, setModalVisibleLogout] = useState(false);
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const {
    avatar,
    selectAvatarIndex,
    modalVisible,
    setModalVisible,
    isloadingAvatar,
    selectAvatar,
  } = useProfileUi();
  const {
    watchedMovieCount,
    totalWatchedTime,
    watchedTvCount,
    totalSeasonsCount,
    totalEpisodesCount,
    totalWatchedTimeTv,
    totalMinutesTime,
    totalMinutesTimeTv,
    isloadingShowInfo,
    isloadingMovieInfo,
    timeDisplayMode,
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
  } = useProfileStats();
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
  const friendsState = useFriends();
  const friendCount = friendsState?.friends?.length ?? profile?.friendsCount ?? 0;
  const receivedCount =
    friendsState?.incomingRequests?.length ?? profile?.pendingRequestsInCount ?? 0;
  const sendCount =
    friendsState?.outgoingRequests?.length ?? profile?.pendingRequestsOutCount ?? 0;

  const handleAvatarSelect = useCallback(
    async (index) => {
      const changed = index !== selectAvatarIndex;
      try {
        const saved = await selectAvatar(index);
        if (saved && changed && user?.uid) {
          propagateProfileChange(user.uid, { avatarIndex: index }).catch(() => {});
        }
      } catch {
        // Context seçimi geri alır ve kullanıcıya kalıcılık hatasını gösterir.
      }
    },
    [selectAvatarIndex, selectAvatar, user?.uid],
  );

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
          <View style={styles.images}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(true);
              }}
              style={[
                styles.profilImageTouch,
                {
                  borderColor: borderColorMovie || "#000",
                  shadowColor: shadowColorMovie || "#000",
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
                      style={[styles.profilImage]}
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
                {profile?.displayName || user?.displayName}
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

                <AppIcon
                  family="MaterialIcons"
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
                >{i18nText("autoI18n.katilma_tarihi", "Katılma tarihi:")}{" "}
                  {convertTimestampToDate(user.metadata.createdAt)}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate("EditProfileScreen")}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  alignSelf: "flex-start",
                  marginTop: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  borderWidth: 1,
                  backgroundColor: theme.accent + "1f",
                  borderColor: theme.accent,
                }}
              >
                <AppIcon
                  family="Ionicons"
                  name="create-outline"
                  size={13}
                  color={theme.accent}
                />
                <Text
                  allowFontScaling={false}
                  style={{ color: theme.accent, fontSize: 12, fontWeight: "700" }}
                >{i18nText("autoI18n.profili_duzenle", "Profili Düzenle")}</Text>
              </TouchableOpacity>
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
                <AppIcon
                  family="Ionicons"
                  name="search-outline"
                  size={18}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >{i18nText("autoI18n.ara_2", "Ara")}</Text>
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
                <AppIcon family="Ionicons" name="people-outline" size={18} color="#64b4ff" />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >{i18nText("autoI18n.arkadaslar", "Arkadaşlar")}</Text>
              {friendCount > 0 && (
                <View style={styles.friendBarPillRow}>
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

            {/* Mesajlar — yatay (arkadaşlardan ayrı sohbet/grup alanı) */}
            <TouchableOpacity
              style={styles.friendBarBtnWide}
              onPress={() => navigation.navigate("MessagesScreen")}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.friendBarIconWrap,
                  { backgroundColor: "#6C63FF15" },
                ]}
              >
                <AppIcon family="Ionicons" name="chatbubble-ellipses-outline" size={18} color="#6C63FF" />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >{i18nText("autoI18n.mesajlar", "Mesajlar")}</Text>
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
                <AppIcon family="Ionicons" name="mail-outline" size={18} color="#29b864" />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.friendBarLabel, { color: theme.text.secondary }]}
              >{i18nText("autoI18n.istekler", "İstekler")}</Text>
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
                        { backgroundColor: "#ff9650" },
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
          <MyActivityButton navigation={navigation} />
          <CalendarWidget navigation={navigation} />
          <RemindersPreviewButton navigation={navigation} />
          <NotesCard navigation={navigation} />
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
                style={[styles.settingText, { color: theme.colors.red }]}
              >
                {t.logout}
              </Text>
              <AppIcon
                family="Ionicons"
                name={"log-out-outline"}
                size={24}
                color={theme.colors.red}
              />
            </TouchableOpacity>
          </View>
          <ProfileAvatarPickerModal
            visible={modalVisible}
            selectedIndex={selectAvatarIndex}
            saving={isloadingAvatar}
            onSelect={handleAvatarSelect}
            onClose={() => setModalVisible(false)}
          />
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

      {/* Kar: scroll içinde 2 dev Lottie yerine tek sabit overlay (MovieScreen paterni) */}
      {showSnow && (
        <View style={styles.snowOverlay} pointerEvents="none">
          <LottieView
            style={{ flex: 1 }}
            source={require("@lottie/snow.json")}
            autoPlay
            loop
          />
        </View>
      )}

      <BackButton />
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

  // Tüm bar butonları — DİKEY kolon (icon üst, label alt). 4 buton sığsın diye
  // yatay düzenden kolona geçildi (yatayda label'lar sarıp kayıyordu).
  friendBarBtnCompact: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 5,
    position: "relative",
  },
  friendBarBtnWide: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 5,
    position: "relative",
  },

  friendBarDivider: {
    width: 1,
    height: 36,
    borderRadius: 1,
  },
  friendBarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  friendBarLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  // Rozet(ler) — butonun sağ-üst köşesinde (icon üstünde)
  friendBarPillRow: {
    position: "absolute",
    top: 2,
    right: 8,
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
  snowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
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
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
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
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
  },
  gameCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,165,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  gameCardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  gameCardDesc: {
    fontSize: 11,
    fontWeight: "500",
  },
});

export default ProfileScreen;
