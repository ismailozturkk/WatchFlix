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
      View,
    InteractionManager,
  DeviceEventEmitter,
} from "react-native";
import { flushSnapshotWrites } from "./services/snapshotCache";
import {
  BLUR_SCOPES,
  BlurTargetProvider,
  BlurTargetSurface,
} from "./components/common/BlurTarget";

import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
// EKRAN İMPORTLARI BİLEREK YOK: ekranlar Stack.Screen üzerinde
// getComponent={() => require("...").default} ile İLK NAVİGASYONDA yüklenir.
// Üstten import edilen bir ekran, tüm bağımlılık ağacıyla birlikte daha splash
// ekranındayken çalıştırılır — ~60 ekranda bu, açılışı saniyeler mertebesinde
// uzatıyordu. Yeni ekran eklerken aynı deseni kullan. Aşağıdaki dördü açık
// kalıyor çünkü olası İLK rotalar (auth kapısı initialRoute'u bunlardan seçer).
import LoginScreen from "./screens/auth/LoginScreen";
import GoogleProfileCompletionScreen from "./screens/auth/GoogleProfileCompletionScreen";
import OnboardingScreen from "./screens/onboarding/OnboardingScreen";
import LottieView from "lottie-react-native";
import { useTheme } from "./context/ThemeContext";
import { SnowProvider, useSnow } from "./context/SnowContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { TypographyProvider } from "./context/TypographyContext";
import { ConnectivityProvider } from "./context/ConnectivityContext";
import { PetProvider } from "./context/PetContext";
import { ListStatusProvider } from "./context/ListStatusContext";
import { MediaActivityProvider } from "./context/MediaActivityContext";
import { SharedListsProvider } from "./context/SharedListsContext";
import { MediaQuickActionsProvider } from "./context/MediaQuickActionsContext";
import { auth, db } from "./firebase";
import Toast from "react-native-toast-message";
import { toastConfig } from "@components/AppToast";
import { AppAlertHost } from "@components/AppAlert";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
import TabScreenNavigator from "@screens/navigation/TabScreenNavigator";
import { PremiumProvider } from "./context/PremiumContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableFreeze } from "react-native-screens";
import SplashPosterWave from "./components/SplashPosterWave";
import { CalendarProvider } from "./context/CalendarContext";
import { installAxiosDataCache } from "./utils/axiosDataCache";
import { installTmdbAdultGuard } from "./utils/tmdbAdultGuard";
import { isMigrated, runStorageMigration } from "./services/storage";
import { startPresence, stopPresence } from "./services/presenceService";
import {
  initCrashReporting,
  captureError,
  registerNavigationContainer,
  setCrashUser,
  wrapRoot,
} from "./services/crashReporting";
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
// SIRA: önbellekten SONRA kurulmalı — önbelleğe ham cevap yazılsın, yetişkin
// süzmesi hem taze hem önbellekten gelen cevaba uygulansın.
installTmdbAdultGuard();
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
// Modül seviyesinde: AppContent her render'da yeni bir navigator bileşeni
// üretirse React ağacı ekran kimliklerini kaybedip stack'i remount edebilir.
const Stack = createNativeStackNavigator();
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
      UpNextScreen: "upnext",
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

// Uygulama modülü yüklendiği anda ikon font preload'u başlat.
//
// Splash yalnız AÇILIŞ YOLUNUN kullandığı iki seti bekler: sekme çubuğu ve ana
// ekran rayları sadece Ionicons (AppIcon varsayılanı) + MaterialCommunityIcons
// çiziyor. Kalan dört set daha derin ekranlarda gerekiyor; preload'ları kısa
// bir gecikmeyle arka plana atıldı — çok erken bir navigasyonda en kötü
// ihtimal ikon bir karelik gecikmeyle gelir (loadFont zaten idempotent).
//
// MMKV GEÇİŞİ: buradaki iki depolama adımı (`hydrateAutoDataCacheSetting` ve
// `preloadAllCache`) kalktı. İkisi de "AsyncStorage async olduğu için açılışta
// belleğe al" işiydi; MMKV senkron okuduğundan ikisinin de karşılığı yok.
const startupPreloadPromise = Promise.allSettled([
  preloadIconFont(Ionicons),
  preloadIconFont(MaterialCommunityIcons),
]);

setTimeout(() => {
  Promise.allSettled([
    preloadIconFont(FontAwesome),
    preloadIconFont(Feather),
    preloadIconFont(Octicons),
    preloadIconFont(MaterialIcons),
  ]);
}, 1200);

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

// ChatModal host'u (SwipeView) ancak swipeViewReady=true olunca (açılıştan
// ~3,8 sn sonra) çizilir; require'ı da o ana erteliyoruz ki ChatModal'ın
// ~1400 satırlık modül ağacı açılış yürütmesinden tamamen çıksın.
const SwipeViewHost = () => {
  const SwipeView = require("@screens/chat/SwipeView").default;
  return <SwipeView />;
};

function AppContent() {
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
      // Sentry ekran geçiş/TTID izlemesi container kaydıyla başlar (no-op
      // eğer Sentry kapalıysa) — bkz. services/crashReporting.js.
      onReady={() => registerNavigationContainer(navigationRef)}
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
          getComponent={() => require("./screens/tournament/TournamentScreen").default}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="TvShowsDetails"
          getComponent={() => require("./screens/tv/TvShowsDetails").default}
          options={{
            headerShown: false,
            presentation: "transparentModal",
          }}
        />
        <Stack.Screen
          name="SeasonDetails"
          getComponent={() => require("./screens/tv/SeasonDetails").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="EpisodeDetails"
          getComponent={() => require("./screens/tv/EpisodeDetails").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MovieDetails"
          getComponent={() => require("./screens/movie/MovieDetail").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SeeAllScreen"
          getComponent={() => require("./screens/shared/SeeAllScreen").default}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="TvGraphDetailScreen"
          getComponent={() => require("./screens/tv/TvGraphDetailScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="StoryShareScreen"
          getComponent={() => require("@screens/story/StoryShareScreen").default}
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="StoryDraftsScreen"
          getComponent={() => require("@screens/story/StoryDraftsScreen").default}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="UnifiedSearch"
          getComponent={() => require("./screens/tabs/SearchScreen").default}
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="ActorViewScreen"
          getComponent={() => require("./screens/actor/ActorViewScreen").default}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="RegisterScreen"
          getComponent={() => require("./screens/auth/RegisterScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ForgotPasswordScreen"
          getComponent={() => require("./screens/auth/ForgotPasswordScreen").default}
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
          {(props) => {
            // Render anında require: modül sekme navigatörü (TabScreen'in
            // Profil sekmesi) yüzünden bu noktada zaten yüklüdür.
            const ProfileScreen = require("./screens/tabs/ProfileScreen").default;
            return (
              <CalendarProvider>
                <ProfileScreen {...props} />
              </CalendarProvider>
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name="ListsScreen"
          getComponent={() => require("@screens/lists/ListsScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ListsViewScreen"
          getComponent={() => require("@screens/lists/ListsViewScreen").default}
          options={{
            headerShown: false,
          }}
        />
        {/* Sıradaki: sekme çubuğundan çıkarıldı, TV ana ekranındaki
            "Devam Eden Dizilerim" rayının "Tümü" düğmesinden açılıyor. */}
        <Stack.Screen
          name="UpNextScreen"
          getComponent={() => require("@screens/tabs/UpNextScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SharedListScreen"
          getComponent={() => require("@screens/lists/SharedListScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MovieStatisticsScreen"
          getComponent={() => require("./screens/tabs/profile/MovieStatisticsScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TvStatisticsScreen"
          getComponent={() => require("./screens/tabs/profile/TvStatisticsScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="WrappedScreen"
          getComponent={() => require("@screens/wrapped/WrappedScreen").default}
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="RemindersScreen"
          getComponent={() => require("./screens/tabs/profile/RemindersScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NotesScreen"
          getComponent={() => require("./screens/tabs/profile/NotesScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditProfileScreen"
          getComponent={() => require("./screens/tabs/profile/EditProfileScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyPostsScreen"
          getComponent={() => require("./screens/tabs/MyPostsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyActivityScreen"
          getComponent={() => require("./screens/tabs/profile/MyActivityScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FriendsListScreen"
          getComponent={() => require("./screens/tabs/profile/FriendsListScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="FriendProfileScreen"
          getComponent={() => require("./screens/tabs/profile/FriendProfileScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ChatScreen"
          getComponent={() => require("@screens/chat/ChatScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MessagesScreen"
          getComponent={() => require("@screens/chat/MessagesScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GroupsListScreen"
          getComponent={() => require("@screens/chat/GroupsListScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateGroupScreen"
          getComponent={() => require("@screens/chat/CreateGroupScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SearchFriendsScreen"
          getComponent={() => require("./screens/search/SearchFriendsScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="FriendRequestsScreen"
          getComponent={() => require("./screens/tabs/profile/FriendRequestsScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PrivacySettingsScreen"
          getComponent={() => require("./screens/tabs/profile/PrivacySettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReminderNotificationsScreen"
          getComponent={() => require("./screens/tabs/settings/ReminderNotificationsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SocialNotificationsScreen"
          getComponent={() => require("./screens/tabs/settings/SocialNotificationsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersonalizationScreen"
          getComponent={() => require("./screens/tabs/settings/PersonalizationScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PosterSettingsScreen"
          getComponent={() => require("./screens/tabs/settings/PosterSettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PermissionsDataScreen"
          getComponent={() => require("./screens/tabs/settings/PermissionsDataScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccountConnectionsScreen"
          getComponent={() => require("./screens/tabs/settings/AccountConnectionsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OpenSourceLicensesScreen"
          getComponent={() => require("./screens/tabs/settings/OpenSourceLicensesScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AboutAppScreen"
          getComponent={() => require("./screens/tabs/settings/AboutAppScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WidgetSettingsScreen"
          getComponent={() => require("./screens/tabs/settings/WidgetSettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PremiumScreen"
          getComponent={() => require("./screens/premium/PremiumScreen").default}
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="Comment"
          getComponent={() => require("./components/Comment").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PostDetailScreen"
          getComponent={() => require("@screens/social/PostDetailScreen").default}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="CalendarScreen"
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        >
          {(props) => {
            // İlk navigasyonda require edilir (getComponent ile aynı desen;
            // CalendarProvider sarmalayıcısı yüzünden children biçiminde).
            const CalendarScreen = require("@screens/calendar/CalendarScreen").default;
            return (
              <CalendarProvider>
                <CalendarScreen {...props} />
              </CalendarProvider>
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name="SceneGuessGameScreen"
          getComponent={() => require("./screens/game/SceneGuessGameScreen").default}
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="ShareContentScreen"
          getComponent={() => require("./screens/tabs/ShareContentScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GameHubScreen"
          getComponent={() => require("./screens/game/GameHubScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGameDetailScreen"
          getComponent={() => require("./screens/game/SceneGameDetailScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGameSetupScreen"
          getComponent={() => require("./screens/game/SceneGameSetupScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="SceneGamePlayScreen"
          getComponent={() => require("./screens/game/SceneGamePlayScreen").default}
          options={{ headerShown: false, animation: "slide_from_bottom", gestureEnabled: false }}
        />
        <Stack.Screen
          name="SceneGameResultScreen"
          getComponent={() => require("./screens/game/SceneGameResultScreen").default}
          options={{ headerShown: false, animation: "fade" }}
        />
        <Stack.Screen
          name="GameLeaderboardScreen"
          getComponent={() => require("./screens/game/GameLeaderboardScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="GameStatsScreen"
          getComponent={() => require("./screens/game/GameStatsScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="GameAchievementsScreen"
          getComponent={() => require("./screens/game/GameAchievementsScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="WatchBadgesScreen"
          getComponent={() => require("./screens/tabs/profile/WatchBadgesScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="CustomThemeScreen"
          getComponent={() => require("./screens/tabs/setting/CustomThemeScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack.Navigator>

      {showChatModal && swipeViewReady && <SwipeViewHost />}
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

  // AsyncStorage → MMKV göç kapısı.
  //
  // Provider'lar ayarları SENKRON okuyor; göç bitmeden mount olurlarsa boş
  // depodan varsayılanları alır ve kullanıcının teması/dili bir kez sıfırlanmış
  // görünürdü. `isMigrated()` senkron olduğu için bu kapı ilk güncelleme
  // açılışı DIŞINDA hiçbir maliyet getirmez: sonraki her açılışta başlangıç
  // değeri zaten `true`, ekstra render bile olmaz.
  const [storageReady, setStorageReady] = useState(() => isMigrated());

  useEffect(() => {
    if (storageReady) return undefined;
    let alive = true;
    runStorageMigration().finally(() => {
      if (alive) setStorageReady(true);
    });
    return () => {
      alive = false;
    };
  }, [storageReady]);

  useEffect(() => {
    // Göç sürerken yerel splash açık kalsın — arkasında boş bir ekran görünmesin.
    if (!storageReady) return;
    // Özel Lottie splash screen'imiz render edildiğinde yerel (beyaz) splash'i kapat.
    ExpoSplashScreen.hideAsync().catch(() => {});

    // Preload zaten modül yüklenirken başladı (yukarıda).
    // Minimum 250 ms göster; preload bitince (genellikle < 50 ms) kapat.
    // (600 ms'ti; 350 ms'lik fade ile birlikte her açılışa ~1 sn yapay bekleme
    // ekliyordu. Veri geç geliyorsa splash zaten APP_READY'ye kadar kalır —
    // bu sabit yalnız "her şey hazırken" ödenen tabandır.)
    const MIN_MS = 250;
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
        duration: 200,
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
  }, [storageReady]);

  // Anlık görüntü yazımları erteleniyor (art arda gelen snapshot'lar tek yazıma
  // birleşsin diye). Uygulama arka plana geçerken süreç dondurulabilir; bekleyen
  // yazım o pencerede kaybolursa kullanıcı bir sonraki açılışta bir ÖNCEKİ hâli
  // görür. Burada zorla diske indiriyoruz.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (durum) => {
      if (durum === "background" || durum === "inactive") flushSnapshotWrites();
    });
    return () => sub.remove();
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

  // Göç bitene kadar provider ağacı hiç mount edilmez. Yerel splash hâlâ açık
  // (hideAsync yukarıda `storageReady` kapısının arkasında), bu yüzden kullanıcı
  // yalnızca splash görür. Sadece güncelleme sonrası İLK açılışta yaşanır.
  if (!storageReady) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          {/* Modal arka planlarının bulanıklaştırdığı yüzey: sekme çubuğu ve
              üstteki her şey dahil TÜM uygulama. Android'de RN Modal ayrı bir
              pencereye çizildiği için modal içeriği bu yüzeyin native çocuğu
              olmaz — hedefleyebilmesinin sebebi bu (bkz. BlurTarget.js).
              Android 12 altında ve iOS'ta düz bir View'dır, maliyeti yok. */}
          <BlurTargetProvider>
          <BlurTargetSurface name={BLUR_SCOPES.root} style={styles.blurRoot}>
          <ConnectivityProvider>
          <TypographyProvider>
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
                              {/* Postere basılı tutunca açılan hızlı eylem
                                  sayfası. Listeler + puan + izlenme durumunu
                                  okuduğu için ListStatus/SharedLists/Auth
                                  sağlayıcılarının İÇİNDE olmak zorunda. */}
                              <MediaQuickActionsProvider>
                                <AppContent />
                              </MediaQuickActionsProvider>
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
          </TypographyProvider>
          </ConnectivityProvider>
          </BlurTargetSurface>
          </BlurTargetProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  // Modal arka planlarının hedefi; sağlayıcı ağacının kapladığı alanın aynısı.
  blurRoot: {
    flex: 1,
  },
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
