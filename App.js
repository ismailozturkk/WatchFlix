import React, { useEffect, useRef, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";

// Production'da gereksiz console çıktılarını kapat
// console.error korunuyor → Sentry/Crashlytics için kullanılabilir
if (!__DEV__) {
  console.log  = () => {};
  console.info = () => {};
  console.warn = () => {};
}
import {
  Animated,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LogBox,
  InteractionManager,
  DeviceEventEmitter,
} from "react-native";

import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import TabScreen from "@screens/navigation/TabScreen";
import TvShowsDetails from "./screens/tv/TvShowsDetails";
import SeasonDetails from "./screens/tv/SeasonDetails";
import EpisodeDetails from "./screens/tv/EpisodeDetails";
import MovieDetails from "./screens/movie/MovieDetail";
import SeeAllScreen from "./screens/shared/SeeAllScreen";
import TvGraphDetailScreen from "./screens/tv/TvGraphDetailScreen";
import StoryShareScreen from "@screens/story/StoryShareScreen";
import StoryDraftsScreen from "@screens/story/StoryDraftsScreen";
import MovieSearch from "./screens/search/MovieSearch";
import TvShowSearch from "./screens/search/TvShowSearch";
import LoginScreen from "./screens/auth/LoginScreen";
import RegisterScreen from "./screens/auth/RegisterScreen";
import ForgotPasswordScreen from "./screens/auth/ForgotPasswordScreen";
import GoogleProfileCompletionScreen from "./screens/auth/GoogleProfileCompletionScreen";
import OnboardingScreen from "./screens/onboarding/OnboardingScreen";
import LottieView from "lottie-react-native";
import { useTheme } from "./context/ThemeContext";
import { SnowProvider, useSnow } from "./context/SnowContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { ConnectivityProvider } from "./context/ConnectivityContext";
import { PetProvider } from "./context/PetContext";
import { ListStatusProvider } from "./context/ListStatusContext";
import { MediaActivityProvider } from "./context/MediaActivityContext";
import { SharedListsProvider } from "./context/SharedListsContext";
import SharedListScreen from "@screens/lists/SharedListScreen";
import { auth, db } from "./firebase";
import ProfileScreen from "./screens/tabs/ProfileScreen";
import Toast from "react-native-toast-message";
import { toastConfig } from "@components/AppToast";
import { AppAlertHost } from "@components/AppAlert";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import ListsScreen from "@screens/lists/ListsScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ListsViewScreen from "@screens/lists/ListsViewScreen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import SwipeView from "@screens/chat/SwipeView";
import { ProfileStatsProvider }     from "./context/ProfileStatsContext";
import { WatchProgressProvider }    from "./context/WatchProgressContext";
import { ProfileNotesProvider }     from "./context/ProfileNotesContext";
import { ProfileRemindersProvider } from "./context/ProfileRemindersContext";
import { ProfileUiProvider }        from "./context/ProfileUiContext";
import { UserProfileProvider }      from "./context/UserProfileContext";
import { FriendsProvider }          from "./context/FriendsContext";
import { NotificationsProvider }    from "./context/NotificationsContext";
import { DeviceNotificationsProvider } from "./context/DeviceNotificationsContext";
import { PostsProvider }            from "./context/PostsContext";
import { TvShowProvider } from "./context/TvShowContex";
import ActorSearch from "./screens/search/ActorSearch";
import ActorViewScreen from "./screens/actor/ActorViewScreen";
import MovieStatisticsScreen from "./screens/tabs/profile/MovieStatisticsScreen";
import TvStatisticsScreen from "./screens/tabs/profile/TvStatisticsScreen";
import WrappedScreen from "@screens/wrapped/WrappedScreen";
import TabScreenNavigator from "@screens/navigation/TabScreenNavigator";
import SearchAll from "./screens/search/SearchAll";
import FriendsListScreen from "./screens/tabs/profile/FriendsListScreen";
import FriendProfileScreen from "./screens/tabs/profile/FriendProfileScreen";
import RemindersScreen from "./screens/tabs/profile/RemindersScreen";
import NotesScreen from "./screens/tabs/profile/NotesScreen";
import EditProfileScreen from "./screens/tabs/profile/EditProfileScreen";
import MyPostsScreen from "./screens/tabs/MyPostsScreen";
import MyActivityScreen from "./screens/tabs/profile/MyActivityScreen";
import SearchFriendsScreen from "./screens/search/SearchFriendsScreen";
import SearchScreen from "./screens/tabs/SearchScreen";
import FriendRequestsScreen from "./screens/tabs/profile/FriendRequestsScreen";
import PrivacySettingsScreen from "./screens/tabs/profile/PrivacySettingsScreen";
import ReminderNotificationsScreen from "./screens/tabs/settings/ReminderNotificationsScreen";
import SocialNotificationsScreen from "./screens/tabs/settings/SocialNotificationsScreen";
import PersonalizationScreen from "./screens/tabs/settings/PersonalizationScreen";
import PosterSettingsScreen from "./screens/tabs/settings/PosterSettingsScreen";
import PermissionsDataScreen from "./screens/tabs/settings/PermissionsDataScreen";
import OpenSourceLicensesScreen from "./screens/tabs/settings/OpenSourceLicensesScreen";
import AccountConnectionsScreen from "./screens/tabs/settings/AccountConnectionsScreen";
import AboutAppScreen from "./screens/tabs/settings/AboutAppScreen";
import PremiumScreen from "./screens/premium/PremiumScreen";
import { PremiumProvider } from "./context/PremiumContext";
import ChatScreen from "@screens/chat/ChatScreen";
import CreateGroupScreen from "@screens/chat/CreateGroupScreen";
import GroupsListScreen from "@screens/chat/GroupsListScreen";
import MessagesScreen from "@screens/chat/MessagesScreen";
import PostDetailScreen from "@screens/social/PostDetailScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableFreeze } from "react-native-screens";
import Comment from "./components/Comment";
import MovieSearchScreen from "./screens/search/MovieSearchScreen";
import SplashPosterWave from "./components/SplashPosterWave";
import CalendarScreen from "@screens/calendar/CalendarScreen";
import { CalendarProvider } from "./context/CalendarContext";
import OnGoingSeries from "./screens/tv/OnGoingSeries";
import SceneGuessGameScreen from "./screens/game/SceneGuessGameScreen";
import GameHubScreen from "./screens/game/GameHubScreen";
import TournamentScreen from "./screens/tournament/TournamentScreen";
import ShareContentScreen from "./screens/tabs/ShareContentScreen";
import SceneGameDetailScreen from "./screens/game/SceneGameDetailScreen";
import SceneGameSetupScreen from "./screens/game/SceneGameSetupScreen";
import SceneGamePlayScreen from "./screens/game/SceneGamePlayScreen";
import SceneGameResultScreen from "./screens/game/SceneGameResultScreen";
import GameLeaderboardScreen from "./screens/game/GameLeaderboardScreen";
import GameStatsScreen from "./screens/game/GameStatsScreen";
import GameAchievementsScreen from "./screens/game/GameAchievementsScreen";
import WatchBadgesScreen from "./screens/tabs/profile/WatchBadgesScreen";
import CustomThemeScreen from "./screens/tabs/setting/CustomThemeScreen";
import { preloadAllCache } from "./utils/apiCache";
import { installAxiosDataCache } from "./utils/axiosDataCache";
import { hydrateAutoDataCacheSetting } from "./utils/dataCacheSettings";
import { startPresence, stopPresence } from "./services/presenceService";
import { initCrashReporting, captureError, setCrashUser, wrapRoot } from "./services/crashReporting";
import {
  USER_PROPERTIES,
  setAnalyticsUser,
  setAnalyticsUserProperty,
  trackScreen,
} from "./services/analytics";
import { setSnapshotErrorReporter } from "./utils/firestoreError";
import { deviceTier } from "./services/deviceTier";
import * as ExpoSplashScreen from "expo-splash-screen";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Feather from "@expo/vector-icons/Feather";
import Octicons from "@expo/vector-icons/Octicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
// Sentry kurulumu bilerek burada DEĞİL: tek kaynak services/crashReporting.js
// (aşağıdaki initCrashReporting). Sihirbazın buraya eklediği ikinci Sentry.init
// PII'yi ve %10 oturumda ekran kaydını açıyordu; sarmalayıcıdaki KVKK/GDPR
// kararını eziyordu.

enableFreeze(true);
installAxiosDataCache();
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Hata raporlama İLK iş: bundan sonra çalışan her şeyin (cache preload, font
// yükleme, provider'lar) hatası yakalanabilsin. DSN yoksa sessiz no-op.
initCrashReporting();
// Sessizce yutulan Firestore snapshot hatalarını raporlayıcıya bağla
// (utils/firestoreError.js saf kalsın diye enjeksiyonla).
setSnapshotErrorReporter((error, label) =>
  captureError(error, { tags: { source: "firestore_snapshot", label } }),
);
// Cihaz sınıfı kullanıcı özelliği: crash ve performans verisini düşük/orta/üst
// katmana göre ayırabilmek için (utils/deviceTier.js).
setAnalyticsUserProperty(USER_PROPERTIES.DEVICE_TIER, deviceTier);

// Bildirime dokunulduğunda yönlendirme için global navigation ref.
const navigationRef = createNavigationContainerRef();
// Ana ekran widget'larının dokunma hedefleri. Android tarafındaki karşılıkları:
// ReminderWidgetProvider (reminders), ListsWidgetProvider (lists/…),
// StatsWidgetProvider (stats/…). Yol adları değişirse widget'lar sessizce
// açılış ekranına düşer — iki tarafı birlikte güncelle.
const linking = {
  prefixes: ["seelogd://"],
  config: {
    screens: {
      RemindersScreen: "reminders",
      ListsViewScreen: "lists",
      ListsScreen: "lists/:listName",
      MovieStatisticsScreen: "stats/movies",
      TvStatisticsScreen: "stats/tv",
    },
  },
};

const preloadIconFont = (IconSet) => {
  if (typeof IconSet?.loadFont === "function") {
    return IconSet.loadFont();
  }
  return Promise.resolve();
};

// Uygulama modülü yüklendiği anda cache ve ikon font preload'u başlat.
// Provider'lar mount olmadan önce cache belleğe alınır; tab ikonları da
// ilk TV ekranı açıldıktan sonra font beklemez.
const startupPreloadPromise = Promise.allSettled([
  hydrateAutoDataCacheSetting(),
  preloadAllCache(),
  preloadIconFont(Ionicons),
  preloadIconFont(MaterialCommunityIcons),
  preloadIconFont(FontAwesome),
  preloadIconFont(Feather),
  preloadIconFont(Octicons),
  preloadIconFont(MaterialIcons),
]);

// Daha sonra stack/tab navigator'larında otomatik etkili olur

// Splash arka planı (theme.primary) koyuysa status bar ikonları açık renk
// basılmalı. expo-status-bar "barStyle" değil "style" prop'u tanır; cihaz
// temasına düşen "auto" yerine gerçek arka plan parlaklığından türetiyoruz.
const isDarkHexColor = (hex) => {
  if (typeof hex !== "string") return true;
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

const SplashScreen = () => {
  const { theme } = useTheme();
  const { showSnow } = useSnow();

  return (
    <View style={[styles.splashContainer, { backgroundColor: theme.primary }]}>
      <SplashPosterWave />

      {showSnow && (
        <LottieView
          style={styles.lottie}
          source={require("@lottie/snow.json")}
          autoPlay={true}
          loop
        />
      )}
      <StatusBar style={isDarkHexColor(theme.primary) ? "light" : "dark"} />
    </View>
  );
};

function AppContent() {
  const Stack = createNativeStackNavigator();
  const [showChatModal, setShowChatModal] = useState(false); // State for modal visibility
  const [swipeViewReady, setSwipeViewReady] = useState(false);
  const { user, initialRoute, loading, needsProfileCompletion } = useAuth();

  useEffect(() => {
    // Profil tamamlanmadan Lists/{uid} YAZMA. Google kullanıcısı tamamlama
    // ekranındayken oturumu açıktır; burada yazarsak ve kullanıcı "Başka hesap
    // kullan" derse hesap silinir, doküman sahipsiz kalır — kural isOwner(uid)
    // bir daha doğru olamayacağı için kalıcı olarak erişilemez çöp olur.
    if (user && !needsProfileCompletion) {
      const createList = async () => {
        const docRef = doc(db, "Lists", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            await setDoc(docRef, {
              watchedTv: [],
              favorites: [],
              watchList: [],
              watchedMovies: [],
            });
          }
        } catch (e) {
          Toast.show({
            type: "error",
            text1: `Error fetching or creating document: ${e?.message || e}`,
          });
        }
      };
      createList();
    }
    // needsProfileCompletion bağımlılıkta: profil tamamlanınca kapı açılır ve
    // liste o an oluşturulur (yeni bir açılış beklemeden).
  }, [user, needsProfileCompletion]);
  useEffect(() => {
    if (user) {
      setShowChatModal(true);
    } else if (!loading && !user) {
      setShowChatModal(false);
      // Emit APP_READY if user is not logged in, as TvShowScreen won't load
      DeviceEventEmitter.emit("APP_READY");
    }
  }, [user, loading]);

  useEffect(() => {
    if (!showChatModal) {
      setSwipeViewReady(false);
      return undefined;
    }

    let timer = null;
    const task = InteractionManager.runAfterInteractions(() => {
      // ChatModal (AI sohbet host'u) ~1400 satırlık ağır bir ağaç; 1,2 sn'de
      // mount edilince splash sonrası donma penceresine denk geliyordu.
      // Kullanıcının ilk saniyelerde ihtiyaç duymadığı bu katmanı daha geç kur.
      timer = setTimeout(() => setSwipeViewReady(true), 3800);
    });

    return () => {
      task.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, [showChatModal]);

  if (loading) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onStateChange={(state) => {
        // state resmi tipte undefined olabilir — guard olmadan crash riski.
        const routeName = state?.routes?.[state.index]?.name;
        if (!routeName) return;
        // Ekran görüntüleme: huni analizinin (onboarding → paywall → satın alma)
        // temeli. Firebase otomatik screen_view'ı React Navigation'ı görmez.
        trackScreen(routeName);
        // Control modal visibility based on the current screen
        if (
          routeName === "OnboardingScreen" ||
          routeName === "ForgotPasswordScreen" || // Examples - Add other screens where you want to show the chat modal
          routeName === "RegisterScreen" ||
          routeName === "LoginScreen" ||
          routeName === "GoogleProfileCompletionScreen"
        ) {
          setShowChatModal(false);
        } else {
          setShowChatModal(true);
        }
        // Not: showBackButton state'i kaldırıldı — hiçbir yerde tüketilmiyordu
        // ve karşılaştırdığı "TabScreenNavigator" adı kayıtlı rota adı
        // ("TabScreen") ile hiç eşleşmiyordu; her rota değişiminde gereksiz
        // render tetikliyordu.
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={({ navigation }) => ({
          contentStyle: { backgroundColor: "#1a1a1a" },
          //animation: "fade", // iOS benzeri geçiş
          animation: "slide_from_right", // iOS benzeri geçiş
          gestureEnabled: true, // swipe-back gibi hareketleri açar
          gestureDirection: "horizontal", // yatay hareket yönü
        })}
      >
        <Stack.Screen
          name="OnboardingScreen"
          component={OnboardingScreen}
          options={{
            headerShown: false,
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="LoginScreen"
          component={LoginScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="GoogleProfileCompletionScreen"
          component={GoogleProfileCompletionScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="TabScreen"
          component={TabScreenNavigator} // The component is correct
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TournamentScreen"
          component={TournamentScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="TvShowsDetails"
          component={TvShowsDetails}
          options={{
            headerShown: false,
            presentation: "transparentModal",
          }}
        />
        <Stack.Screen
          name="SeasonDetails"
          component={SeasonDetails}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="EpisodeDetails"
          component={EpisodeDetails}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MovieDetails"
          component={MovieDetails}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SeeAllScreen"
          component={SeeAllScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="TvGraphDetailScreen"
          component={TvGraphDetailScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="StoryShareScreen"
          component={StoryShareScreen}
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="StoryDraftsScreen"
          component={StoryDraftsScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="UnifiedSearch"
          component={SearchScreen}
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="ActorViewScreen"
          component={ActorViewScreen}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="RegisterScreen"
          component={RegisterScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ForgotPasswordScreen"
          component={ForgotPasswordScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ProfileScreen"
          options={{
            headerShown: false,
          }}
        >
          {(props) => (
            <CalendarProvider>
              <ProfileScreen {...props} />
            </CalendarProvider>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="ListsScreen"
          component={ListsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ListsViewScreen"
          component={ListsViewScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SharedListScreen"
          component={SharedListScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MovieStatisticsScreen"
          component={MovieStatisticsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TvStatisticsScreen"
          component={TvStatisticsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="WrappedScreen"
          component={WrappedScreen}
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="RemindersScreen"
          component={RemindersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NotesScreen"
          component={NotesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditProfileScreen"
          component={EditProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyPostsScreen"
          component={MyPostsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyActivityScreen"
          component={MyActivityScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FriendsListScreen"
          component={FriendsListScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="FriendProfileScreen"
          component={FriendProfileScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ChatScreen"
          component={ChatScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MessagesScreen"
          component={MessagesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupsListScreen"
          component={GroupsListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateGroupScreen"
          component={CreateGroupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SearchFriendsScreen"
          component={SearchFriendsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="FriendRequestsScreen"
          component={FriendRequestsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PrivacySettingsScreen"
          component={PrivacySettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReminderNotificationsScreen"
          component={ReminderNotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SocialNotificationsScreen"
          component={SocialNotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersonalizationScreen"
          component={PersonalizationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PosterSettingsScreen"
          component={PosterSettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PermissionsDataScreen"
          component={PermissionsDataScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccountConnectionsScreen"
          component={AccountConnectionsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OpenSourceLicensesScreen"
          component={OpenSourceLicensesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AboutAppScreen"
          component={AboutAppScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PremiumScreen"
          component={PremiumScreen}
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="Comment"
          component={Comment}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PostDetailScreen"
          component={PostDetailScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MovieSearchScreen"
          component={MovieSearchScreen}
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="CalendarScreen"
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        >
          {(props) => (
            <CalendarProvider>
              <CalendarScreen {...props} />
            </CalendarProvider>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="OnGoingSeries"
          component={OnGoingSeries}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="SceneGuessGameScreen"
          component={SceneGuessGameScreen}
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="ShareContentScreen"
          component={ShareContentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GameHubScreen"
          component={GameHubScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGameDetailScreen"
          component={SceneGameDetailScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGameSetupScreen"
          component={SceneGameSetupScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGamePlayScreen"
          component={SceneGamePlayScreen}
          options={{ headerShown: false, animation: "slide_from_bottom", gestureEnabled: false }}
        />
        <Stack.Screen
          name="SceneGameResultScreen"
          component={SceneGameResultScreen}
          options={{ headerShown: false, animation: "fade" }}
        />
        <Stack.Screen
          name="GameLeaderboardScreen"
          component={GameLeaderboardScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="GameStatsScreen"
          component={GameStatsScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="GameAchievementsScreen"
          component={GameAchievementsScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="WatchBadgesScreen"
          component={WatchBadgesScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="CustomThemeScreen"
          component={CustomThemeScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack.Navigator>

      {showChatModal && swipeViewReady && <SwipeView />}
      <Toast
        config={toastConfig}
        position="top"
        topOffset={54}
        visibilityTime={3000}
      />
      <AppAlertHost />
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default wrapRoot(function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Özel Lottie splash screen'imiz render edildiğinde yerel (beyaz) splash'i kapat.
    ExpoSplashScreen.hideAsync().catch(() => {});

    // Preload zaten modül yüklenirken başladı (yukarıda).
    // Minimum 600 ms göster; preload bitince (genellikle < 50 ms) kapat.
    const MIN_MS = 600;
    const startedAt = Date.now();
    let preloadDone = false;
    let dataReady = false;
    let timeoutFinished = false;

    const checkReady = () => {
      if (preloadDone && dataReady && !timeoutFinished) {
        timeoutFinished = true;
        hideSplash();
      }
    };

    const hideSplash = () => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => setSplashVisible(false));
    };

    startupPreloadPromise.then(() => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_MS - elapsed);
      setTimeout(() => {
        preloadDone = true;
        checkReady();
      }, wait);
    });

    const sub = DeviceEventEmitter.addListener("APP_READY", () => {
      dataReady = true;
      checkReady();
    });

    // Fallback: forcefully hide after 10 seconds just in case
    const fallbackTimer = setTimeout(() => {
      if (!timeoutFinished) {
        timeoutFinished = true;
        hideSplash();
      }
    }, 10000);

    return () => {
      sub.remove();
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Presence (RTDB onDisconnect + AppState) — presenceService halleder.
  useEffect(() => {
    const authUnsubscribe = auth.onAuthStateChanged((u) => {
      if (u?.uid) {
        startPresence(u.uid);
      } else {
        stopPresence();
      }
      // Ölçüm kimliği: crash raporunda hangi kullanıcı, analytics'te hangi
      // huni. Çıkışta null ile temizlenir — sonraki hesabın verisine sızmasın.
      setAnalyticsUser(u?.uid || null);
      setCrashUser(u?.uid || null);
    });
    return () => {
      authUnsubscribe();
      stopPresence();
    };
  }, []);
  return (
    <ErrorBoundary>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <ConnectivityProvider>
          <AppSettingsProvider>
          <LanguageProvider>
            <ThemeProvider>
              <SnowProvider>
                <AuthProvider>
                  <PremiumProvider>
                  <UserProfileProvider>
                  <FriendsProvider>
                  <NotificationsProvider>
                  <ListStatusProvider>
                  <MediaActivityProvider>
                  <SharedListsProvider>
                    <ProfileStatsProvider>
                      {/* ProfileStatsProvider'ın İÇİNDE olmalı: izleme puanı
                          onun verisinden türüyor ve yeni listener açmıyor.
                          Sağlayıcı, hook'un iki ekranda birden çalışıp defter
                          mutabakatını ikiye katlamasını engelliyor. */}
                      <WatchProgressProvider>
                      <ProfileNotesProvider>
                        <ProfileRemindersProvider>
                          <ProfileUiProvider>
                            <PostsProvider>
                        <TvShowProvider>
                          <PetProvider>
                            <DeviceNotificationsProvider navigationRef={navigationRef}>
                              <AppContent />
                            </DeviceNotificationsProvider>
                          </PetProvider>
                            {splashVisible && (
                              <Animated.View
                                style={[
                                  StyleSheet.absoluteFill,
                                  { opacity: fadeAnim, zIndex: 9999 },
                                ]}
                                pointerEvents="none"
                              >
                                <SplashScreen />
                              </Animated.View>
                            )}
                        </TvShowProvider>
                            </PostsProvider>
                          </ProfileUiProvider>
                        </ProfileRemindersProvider>
                      </ProfileNotesProvider>
                      </WatchProgressProvider>
                    </ProfileStatsProvider>
                  </SharedListsProvider>
                  </MediaActivityProvider>
                  </ListStatusProvider>
                  </NotificationsProvider>
                  </FriendsProvider>
                  </UserProfileProvider>
                  </PremiumProvider>
                </AuthProvider>
              </SnowProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AppSettingsProvider>
          </ConnectivityProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  lottie: {
    position: "absolute",
    top: 0,
    height: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  toastError: {
    position: "absolute",
    top: -50,
    width: "100%",
    backgroundColor: "rgba(255, 50, 50,1)",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
  },
  toastWarning: {
    position: "absolute",
    top: -50,
    width: "100%",
    backgroundColor: "rgb(255, 124, 37)",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
  },
  toastSuccess: {
    position: "absolute",
    top: -50,
    width: "100%",
    backgroundColor: "rgb(100, 255, 100)",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
  },
  toastText: {
    color: "black",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
});
