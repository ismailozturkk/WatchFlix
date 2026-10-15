import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import useTabBarScrollSync from "../../hooks/useTabBarScrollSync";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import ProfileLists from "./profile/ProfileLists";
import { useAuth } from "../../context/AuthContext";
import { useFriends } from "../../context/FriendsContext";
import { useUnreadMessages } from "../../context/UnreadMessagesContext";
import { AvatarSkeleton } from "../../components/Skeleton";
import UserAvatar from "../../components/common/UserAvatar";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import NotesCard from "./profile/NotesCard";
import RemindersPreviewButton from "./profile/RemindersPreviewButton";
import MyActivityButton from "./profile/MyActivityButton";
import FriendsActionBar from "../../components/profile/FriendsActionBar";
import {
  CircularProgressBase,
} from "react-native-circular-progress-indicator";
import ScreenDecor from "../../components/ScreenDecor";
// BackButton bilinçli olarak yok: profil sekme kökü olarak render edilir
// (TabScreenNavigator), stack'e push edilmez — buton yalnızca üstteki ekrandan
// dönerken "hayalet" olarak belirip kalıyordu.
import StatisticsSection from "./profile/StatisticsSection";
import { useUserProfile } from "../../context/UserProfileContext";
import { propagateProfileChange } from "../../services/profilePropagation";
import { i18nText } from "../../utils/i18nText";
import * as Haptics from "../../services/hapticsService";
import ProfileAvatarPickerModal from "../../components/profile/ProfileAvatarPickerModal";
import AvatarPreviewModal from "../../components/profile/AvatarPreviewModal";
import ProfileIdentityBlock from "../../components/profile/ProfileIdentityBlock";
import WatchBadgeStrip from "../../components/profile/WatchBadgeStrip";
import { useWatchProgressContext } from "../../context/WatchProgressContext";
import { odulAdi, odulBasligi } from "../../components/badges/badgeMeta";
import { PERDE_ADLARI } from "../../utils/watchScoring";
import { toast } from "../../components/AppToast";
import ProfileStoryModal from "../../components/storyShare/ProfileStoryModal";
import { getIdentityBadges } from "../../components/badges/badgeCatalog";
import { usePremium } from "../../context/PremiumContext";

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için kaydırma
// görünümünü sekme ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js).
// Modül kapsamında: render içinde kurulursa içerik her render'da sökülür.
const MarkedScrollView = markTabScroll(ScrollView);

const ProfileScreen = ({ navigation }) => {
  const { contentBottom } = useTabBarLayout();
  const onTabBarScroll = useTabBarScrollSync();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isPremium, isUnlimited } = usePremium();
  const isFounder = Boolean(profile?.badges?.founder);
  const identityBadges = useMemo(
    () => getIdentityBadges({ founder: isFounder, isPremium, isUnlimited }),
    [isFounder, isPremium, isUnlimited]
  );
  const profileUsername = String(profile?.username || "")
    .trim()
    .replace(/^@/, "");
  const {
    avatar,
    selectAvatarIndex,
    modalVisible,
    setModalVisible,
    isloadingAvatar,
    selectAvatar,
  } = useProfileUi();
  const [showStoryExport, setShowStoryExport] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const {
    watchedMovieCount,
    totalWatchedTime,
    watchedTvCount,
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
    borderColorMovie,
    rankNameTv,
    rankNameMovie,
    // Film+dizi dakikalarının TOPLAMINDAN türeyen birleşik renk — avatarın
    // etrafındaki TEK halkayı besler.
    borderColor,
    borderColor2,
  } = useProfileStats();
  // İzleme puanı (Kare) + Perde + 81 rozet. Yeni Firestore listener AÇMAZ —
  // yukarıdaki useProfileStats verisinden türetilir (hooks/useWatchProgress.js).
  // Context'ten okunur, hook DOĞRUDAN çağrılmaz: WatchBadgesScreen de aynı veriyi
  // istiyor ve stack'te profil mount'ta kaldığı için iki çağrı iki defter
  // mutabakatı effect'i demekti (context/WatchProgressContext.js).
  const watchProgress = useWatchProgressContext() || { loading: true };
  // Profil başlığındaki WatchBadgeStrip memo'lu; yönlendirme referansını sabit
  // tutarak ilgisiz profil render'larında şeridi yeniden çizdirmiyoruz.
  const acRozetler = useCallback(
    () => navigation.navigate("WatchBadgesScreen"),
    [navigation]
  );

  // Rozet/Perde kutlaması. Push bildirimi YOK (bir izleme rozeti telefonu
  // titretmeyi hak etmez) ve ilk tohumlamada hiç tetiklenmez — mevcut kullanıcı
  // 30 rozetlik bir bildirim yağmuruna tutulmaz (docs §6.1).
  const { kutlama, kutlamayiKapat } = watchProgress;
  useEffect(() => {
    if (!kutlama) return;
    // Ad çözümü KATALOG DIŞINI da kapsar: koleksiyon, dönem mührü ve prestij
    // basamakları da defterde normal rozet gibi durur ama WATCH_BADGE_BY_ID'de
    // yoktur — düz katalog aramasıyla bu üçünün kutlaması hiç oynamıyordu.
    const lang = language === "en" ? "en" : "tr";
    const ilkId = kutlama.rozetler?.[0] || null;
    const ilkAd = ilkId ? odulAdi(ilkId, lang) : null;
    if (ilkAd) {
      const ek =
        kutlama.rozetler.length > 1 ? ` +${kutlama.rozetler.length - 1}` : "";
      toast.success(odulBasligi(ilkId, lang), ilkAd + ek);
    } else if (kutlama.perdeAtladi) {
      toast.success(
        i18nText(
          "autoI18n.perde_atlandi",
          `Perde ${kutlama.yeniPerde}'e yükseldin`,
          { n: kutlama.yeniPerde }
        ),
        PERDE_ADLARI[kutlama.yeniPerde - 1] || ""
      );
    } else if (kutlama.makaraAtladi) {
      // Makara ayrı bildirilir: zirvedeki kullanıcının Perdesi değişmiyor,
      // "Perde 20'e yükseldin" demek yanlış olurdu.
      toast.success(
        i18nText("autoI18n.makara_atlandi", `${kutlama.yeniMakara}. Makara`, {
          n: kutlama.yeniMakara,
        }),
        PERDE_ADLARI[PERDE_ADLARI.length - 1]
      );
    }
    kutlamayiKapat();
  }, [kutlama, kutlamayiKapat, language]);



  const props = {
    activeStrokeWidth: 11,
    inActiveStrokeWidth: 11,
    inActiveStrokeOpacity: 0.05,
  };
  // Film + dizi izleme dakikaları TEK bir toplamda birleşiyor — avatarın
  // etrafında artık film/dizi için ayrı iki halka değil, ikisinin toplamına
  // göre dolan TEK bir halka var (bkz. ProfileStatsContext.rankInfo).
  const totalMinutesCombined = (totalMinutesTime ?? 0) + (totalMinutesTimeTv ?? 0);
  const rawProgress = (totalMinutesCombined % 10080) / 10080;
  const safeProgress = parseInt(
    Math.min(Math.max(rawProgress, 0), 1).toFixed(3) * 100
  );
  const friendsState = useFriends();
  const friendCount =
    friendsState?.friends?.length ?? profile?.friendsCount ?? 0;
  const receivedCount =
    friendsState?.incomingRequests?.length ??
    profile?.pendingRequestsInCount ??
    0;

  // Mesajlar butonundaki okunmamış rozeti — gelen kutusu index'indeki
  // unreadCount toplamı (ChatScreen sohbet açılınca sıfırlar). Tek listener
  // context/UnreadMessagesContext'te; uygulama simgesi rozeti de oradan besleniyor.
  const { unreadMessages } = useUnreadMessages();

  const goEditProfile = useCallback(
    () => navigation.navigate("EditProfileScreen"),
    [navigation]
  );
  const openStoryExport = useCallback(() => setShowStoryExport(true), []);
  const closeStoryExport = useCallback(() => setShowStoryExport(false), []);
  // Şerit kartları memo'lu; yönlendirme referanslarını sabit tutarak ilgisiz
  // profil render'larında dört kartı yeniden çizdirmiyoruz.
  const goSearch = useCallback(
    () => navigation.navigate("SearchFriendsScreen"),
    [navigation]
  );
  const goFriends = useCallback(
    () => navigation.navigate("FriendsListScreen"),
    [navigation]
  );
  const goMessages = useCallback(
    () => navigation.navigate("MessagesScreen"),
    [navigation]
  );
  const goRequests = useCallback(
    () => navigation.navigate("FriendRequestsScreen"),
    [navigation]
  );

  const handleAvatarSelect = useCallback(
    async (index) => {
      const changed = index !== selectAvatarIndex;
      try {
        const saved = await selectAvatar(index);
        if (saved && changed && user?.uid) {
          propagateProfileChange(user.uid, { avatarIndex: index }).catch(
            () => {}
          );
        }
      } catch {
        // Context seçimi geri alır ve kullanıcıya kalıcılık hatasını gösterir.
      }
    },
    [selectAvatarIndex, selectAvatar, user?.uid]
  );

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <ScreenDecor scope="profile" iconOpacity={0.3} />

      <MarkedScrollView
        contentContainerStyle={{ paddingBottom: contentBottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: "transparent" }]}
        >
          <View style={styles.images}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(true);
              }}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowAvatarPreview(true);
              }}
              delayLongPress={220}
              activeOpacity={0.85}
              style={styles.profilImageTouch}
            >
              {isloadingAvatar ? (
                <AvatarSkeleton />
              ) : (
                <View style={styles.avatarProgressWrapper}>
                  <View style={styles.circularProgress}>
                    {!modalVisible && (
                      <CircularProgressBase
                        {...props}
                        value={safeProgress}
                        maxValue={100}
                        radius={78}
                        inActiveStrokeColor={borderColor2 || "#C25AFF"}
                        activeStrokeColor={borderColor || "#C25AFF"}
                        activeStrokeSecondaryColor={borderColor2 || "#C25AFF"}
                        duration={500}
                        showProgressValue={false}
                      />
                    )}
                  </View>
                  <View
                    style={[
                      styles.avatarShadowWrapper,
                      {
                        backgroundColor: theme.primary,
                      },
                    ]}
                  >
                    <UserAvatar
                      source={avatar}
                      fallbackSource={require("../../assets/avatar/3.png")}
                      isCustomPhoto={selectAvatarIndex === -1}
                      size={128}
                      style={{ backgroundColor: theme.primary }}
                      priority="high"
                      cachePolicy="memory-disk"
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>
            <ProfileIdentityBlock
              theme={theme}
              language={language}
              displayName={profile?.displayName || user?.displayName}
              username={profileUsername}
              badges={identityBadges}
              email={user?.email}
              emailVerified={Boolean(user?.emailVerified)}
              // user, çıkış anındaki render'da null olabilir — doğrudan erişim çökertir
              verifyHint={
                user && !user.emailVerified ? t.profileScreen.emailVerified : ""
              }
              joinedAt={user?.metadata?.createdAt}
              onEdit={goEditProfile}
              onShare={openStoryExport}
            />
          </View>
          <View style={styles.profileBadgeStrip}>
            <WatchBadgeStrip
              progress={watchProgress}
              onPress={acRozetler}
              compact
            />
          </View>
          {/* ── Arkadaş aksiyonları ── */}
          <FriendsActionBar
            theme={theme}
            friendCount={friendCount}
            unreadMessages={unreadMessages}
            incomingRequests={receivedCount}
            onSearch={goSearch}
            onFriends={goFriends}
            onMessages={goMessages}
            onRequests={goRequests}
          />

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
          <RemindersPreviewButton navigation={navigation} />
          <NotesCard navigation={navigation} />
          <ProfileAvatarPickerModal
            visible={modalVisible}
            selectedIndex={selectAvatarIndex}
            saving={isloadingAvatar}
            onSelect={handleAvatarSelect}
            onClose={() => setModalVisible(false)}
          />
          <AvatarPreviewModal
            visible={showAvatarPreview}
            onClose={() => setShowAvatarPreview(false)}
            source={avatar || require("../../assets/avatar/3.png")}
            isCustomPhoto={selectAvatarIndex === -1}
            displayName={profile?.name || user?.displayName || ""}
            username={profileUsername}
          />
          <ProfileStoryModal
            visible={showStoryExport}
            onClose={closeStoryExport}
            name={profile?.displayName || user?.displayName || ""}
            username={profileUsername}
            avatar={avatar}
            isCustomPhoto={selectAvatarIndex === -1}
            badges={identityBadges}
            bio={profile?.bio}
            joinedAt={user?.metadata?.createdAt || user?.metadata?.creationTime}
          />
        </SafeAreaView>
      </MarkedScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //paddingTop: 0,
    alignItems: "center",
    backgroundColor: "#000",
  },
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
  editProfileButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profilImage: {
    width: "100%",
    height: "100%",
    borderRadius: 58,
  },
  profilImageCover: {
    width: "100%",
    height: "100%",
    borderRadius: 64,
  },
  profilImageIcon: {
    width: 88,
    height: 88,
  },
  // Halka radius=78 (SVG'de dış çap = radius*2, bkz.
  // react-native-circular-progress-indicator/progressCircle) → 156x156.
  // Avatar fotoğrafı 128x128'e büyüdü, aradaki boşluk (156-128)/2 = 14px —
  // eskisi gibi dar bir boşluk, halka artık avatara çok daha yakın oturuyor.
  avatarProgressWrapper: {
    width: 156,
    height: 156,
    borderRadius: 78,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarShadowWrapper: {
    width: 128,
    height: 128,
    borderRadius: 64,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarInnerContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  profilImageTouch: {
    width: 156,
    height: 156,
    borderRadius: 78,
    justifyContent: "center",
    alignItems: "center",
  },
  images: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 14,
  },
  profileBadgeStrip: {
    alignSelf: "stretch",
    paddingHorizontal: 16,
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
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  watchStatsView: {
    width: "43%",
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
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
    padding: 5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  settingText: {
    fontSize: 16,
  },
  // Çıkış onayı artık ConfirmSheet'te; eski merkez modal stilleri kalktı.
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
