import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import useTabBarScrollSync from "../../hooks/useTabBarScrollSync";
import useScreenSections from "../../hooks/useSectionVisibility";
import SectionsHiddenNotice from "../../components/home/SectionsHiddenNotice";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useFriends } from "../../context/FriendsContext";
import { useUnreadMessages } from "../../context/UnreadMessagesContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import MyActivityButton from "./profile/MyActivityButton";
import FriendsActionBar from "../../components/profile/FriendsActionBar";
import ScreenDecor from "../../components/ScreenDecor";
// BackButton bilinçli olarak yok: profil sekme kökü olarak render edilir
// (TabScreenNavigator), stack'e push edilmez — buton yalnızca üstteki ekrandan
// dönerken "hayalet" olarak belirip kalıyordu.
import StatisticsSection from "./profile/StatisticsSection";
import { useUserProfile } from "../../context/UserProfileContext";
import { propagateProfileChange } from "../../services/profilePropagation";
import * as Haptics from "../../services/hapticsService";
import ProfileAvatarPickerModal from "../../components/profile/ProfileAvatarPickerModal";
import AvatarPreviewModal from "../../components/profile/AvatarPreviewModal";
import ProfileIdentityBlock from "../../components/profile/ProfileIdentityBlock";
import ProfileAvatarHalo from "../../components/profile/ProfileAvatarHalo";
import WatchBadgeStrip from "../../components/profile/WatchBadgeStrip";
import { useWatchProgressContext } from "../../context/WatchProgressContext";
import ProfileStoryModal from "../../components/storyShare/ProfileStoryModal";
import { getIdentityBadges } from "../../components/badges/badgeCatalog";
import { usePremium } from "../../context/PremiumContext";
import { readProfileFavorites } from "../../utils/fourFavorites";
import SocialLinksRow from "../../components/profile/SocialLinksRow";
import ProfileLogoutButton from "../../components/profile/ProfileLogoutButton";
import ProfileNotificationsButton from "../../components/profile/ProfileNotificationsButton";
import ImportantInvitesBar from "../../components/profile/ImportantInvitesBar";
import { hasAnySocialLinks, readProfileSocialLinks } from "../../utils/socialLinks";

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için kaydırma
// görünümünü sekme ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js).
// Modül kapsamında: render içinde kurulursa içerik her render'da sökülür.
const MarkedScrollView = markTabScroll(ScrollView);

const ProfileScreen = ({ navigation }) => {
  const { contentBottom } = useTabBarLayout();
  const onTabBarScroll = useTabBarScrollSync();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  // Ayarlar > Kişiselleştirme > Ekran bölümleri'nde gizlenen bölümler
  // (utils/sectionVisibility.js "profile"). Kimlik bloğu (avatar + ad) her zaman görünür.
  const { isVisible: showSection, allHidden: allSectionsHidden } = useScreenSections("profile");
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
  // "Profili paylaş" kartı dört favoriyi de gösterebilir (Users/{uid}.fourFavorites).
  const storyFavorites = useMemo(
    () => readProfileFavorites(profile),
    // Yalnız favori alanı değişince; profilin diğer alanları kartı yeniden hesaplatmasın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.fourFavorites]
  );
  // Sosyal hesap şeridi (Users/{uid}.socialLinks; Profili Düzenle'den girilir).
  const socialLinks = useMemo(
    () => readProfileSocialLinks(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.socialLinks]
  );
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

  // Rozet/Perde kutlaması ARTIK burada değil: WatchProgressProvider içinde, profil
  // sekmesi hiç açılmamış olsa da oynar (hooks/useBadgeCelebration.js).



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
  // Ayarlar artık sekme değil: bu dişli düğmesinden açılır (App.js "SettingsScreen").
  const goSettings = useCallback(
    () => navigation.navigate("SettingsScreen"),
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

  // Halka bileşeni memo'lu; işleyici referanslarını sabit tutarak ilgisiz
  // profil render'larında yeniden çizdirmiyoruz.
  const openAvatarPicker = useCallback(
    () => setModalVisible(true),
    [setModalVisible]
  );
  const openAvatarPreview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAvatarPreview(true);
  }, []);

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
          <ImportantInvitesBar navigation={navigation} />
          <View style={styles.images}>
            <ProfileAvatarHalo
              source={avatar}
              isCustomPhoto={selectAvatarIndex === -1}
              loading={isloadingAvatar}
              progress={safeProgress}
              ringColor={borderColor}
              ringColor2={borderColor2}
              ringHidden={modalVisible}
              backgroundColor={theme.primary}
              onPress={openAvatarPicker}
              onLongPress={openAvatarPreview}
            />
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
              // Ayarlar girişi: adın sağındaki dişli (App.js "SettingsScreen").
              onSettings={goSettings}
              settingsLabel={t.settings}
              // Bildirim kutusu: Düzenle'nin yanında ikon düğmesi (okunmamış rozetiyle).
              notificationsAction={<ProfileNotificationsButton navigation={navigation} />}
              // Yıllık hedef halkası düğmesi (Düzenle / Paylaş'ın yanında). Ayarlar > Ekran
              // bölümleri > Profil > "Yıllık izleme hedefi" ile gizlenir.
              showGoal={showSection("goal")}
            />
          </View>
          {hasAnySocialLinks(socialLinks) && (
            <SocialLinksRow
              links={socialLinks}
              theme={theme}
              language={language}
              style={styles.socialLinks}
            />
          )}
          {showSection("badges") && (
            <View style={styles.profileBadgeStrip}>
              <WatchBadgeStrip
                progress={watchProgress}
                onPress={acRozetler}
                compact
              />
            </View>
          )}
          {/* ── Arkadaş aksiyonları ── */}
          {showSection("friends") && (
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
          )}

          {showSection("stats") && (
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
          )}
          {/* Listeler, Hatırlatmalar ve Notlar Kütüphane sekmesine taşındı
              (screens/tabs/LibraryScreen.js). */}
          {showSection("activity") && <MyActivityButton navigation={navigation} />}
          {allSectionsHidden && (
            <SectionsHiddenNotice navigation={navigation} screen="profile" />
          )}
          {/* Çıkış: tehlikeli işlem sayfanın en altında (Ayarlar'dan taşındı). */}
          <ProfileLogoutButton navigation={navigation} theme={theme} />
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
            favorites={storyFavorites}
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
  avatarInnerContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  socialLinks: {
    alignSelf: "stretch",
    paddingHorizontal: 16,
    paddingBottom: 6,
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
