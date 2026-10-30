import { isLightSurface } from "./utils/colorUtils";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";

// Production'da gereksiz console çıktılarını kapat
// console.error korunuyor → Sentry/Crashlytics için kullanılabilir
if (!__DEV__) {
  console.log  = () => {};
  console.info = () => {};
  console.warn = () => {};
}
import {
    AppState,
    StyleSheet,
      View,
    InteractionManager,
  DeviceEventEmitter,
} from "react-native";
import { flushSnapshotWrites } from "./services/snapshotCache";
import UserDataSyncHost from "./components/UserDataSyncHost";
import ExternalEntryHost from "./components/ExternalEntryHost";
import { wrapGetStateFromPath } from "./utils/externalEntry";
import {
  BLUR_SCOPES,
  BlurTargetProvider,
  BlurTargetSurface,
} from "./components/common/BlurTarget";

import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  getStateFromPath,
} from "@react-navigation/native";
import { rootNavigationRef } from "./services/rootNavigation";
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
import { auth } from "./firebase";
import { i18nText } from "./utils/i18nText";
import { toast } from "@components/AppToast";
import ToastHost from "@components/toast/ToastHost";
import ConnectivityToast from "@components/toast/ConnectivityToast";
import { AppAlertHost } from "@components/AppAlert";
import { PremiumUpsellHost } from "@components/premium/PremiumUpsellSheet";
import { ensureListsRoot } from "./services/listItemsService";
import { LIBRARY_ERROR, classifyLibraryError } from "./utils/libraryCore";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ProfileStatsProvider }     from "./context/ProfileStatsContext";
import { WatchProgressProvider }    from "./context/WatchProgressContext";
import { ProfileNotesProvider }     from "./context/ProfileNotesContext";
import { MediaNotesProvider }       from "./context/MediaNotesContext";
import { ProfileRemindersProvider } from "./context/ProfileRemindersContext";
import { ProfileUiProvider }        from "./context/ProfileUiContext";
import { UserProfileProvider }      from "./context/UserProfileContext";
import { FriendsProvider }          from "./context/FriendsContext";
import { NotificationsProvider }    from "./context/NotificationsContext";
import { UnreadMessagesProvider }   from "./context/UnreadMessagesContext";
import { reconcileAppIconWithSystem } from "./services/appIconService";
import { DeviceNotificationsProvider } from "./context/DeviceNotificationsContext";
import { PostsProvider }            from "./context/PostsContext";
import { TvShowProvider } from "./context/TvShowContex";
import TabScreenNavigator from "@screens/navigation/TabScreenNavigator";
import { PremiumProvider } from "./context/PremiumContext";
import PremiumTopBannerLayout from "./components/premium/PremiumTopBannerLayout";
import { PosterChoicesProvider } from "./context/PosterChoicesProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableFreeze } from "react-native-screens";
import SplashPosterWave from "./components/SplashPosterWave";
import { FALLBACK_EXIT_MS, MIN_VISIBLE_MS } from "./utils/splashMotion";
import { CalendarProvider } from "./context/CalendarContext";
import { installAxiosDataCache } from "./utils/axiosDataCache";
import { installTmdbAdultGuard } from "./utils/tmdbAdultGuard";
import { installTmdbTitleFallback } from "./utils/tmdbTitleFallback";
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
// Baslik secimi filtre uygulamaz: uygulama dili -> Ingilizce -> ozgun ad.
// Ham cevap once cache'e yazilir, yetiskin filtresi uygulanir, en son yalniz
// gosterilecek title/name alani ortak kuralla cozulur.
installTmdbTitleFallback();
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});
// Yerel splash anında değil kısa bir çapraz solmayla çekilir (Android varsayılanı
// zaten solar, iOS'ta `fade` açılmalı). Yerel ve JS splash'in logosu aynı boyutta
// ve aynı yerde (utils/splashMotion LOGO_SIZE ↔ app.json ios.imageWidth), bu
// yüzden çapraz solma "iki logo üst üste" değil, tek logonun etrafında halkaların
// belirmesi gibi görünür. `setOptions`ı bilmeyen eski bir yerel derlemede
// fırlayabilir; sessizce yutulur.
try {
  ExpoSplashScreen.setOptions({ fade: true, duration: 320 });
} catch {
  // eski native binary — varsayılan davranış
}

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
// Kök ref services/rootNavigation'da: ekran olmayan yerler de yönlendirebilsin.
const navigationRef = rootNavigationRef;
// Modül seviyesinde: AppContent her render'da yeni bir navigator bileşeni
// üretirse React ağacı ekran kimliklerini kaybedip stack'i remount edebilir.
const Stack = createNativeStackNavigator();
// Ana ekran widget'larının dokunma hedefleri. Android tarafındaki karşılıkları:
// ReminderWidgetProvider (reminders), ListsWidgetProvider (lists/…),
// StatsWidgetProvider (stats/…). Yol adları değişirse widget'lar sessizce
// açılış ekranına düşer — iki tarafı birlikte güncelle.
//
// Paylaş menüsü (expo-share-intent) iOS'ta uygulamayı `seelogd://dataUrl=…` ile açar; bu bir ekran yolu değil,
// paylaşım kancasının okuduğu adres. Ekran eşlemesine sokulmaz (bkz. utils/externalEntry.wrapGetStateFromPath).
const linking = {
  prefixes: ["seelogd://"],
  getStateFromPath: wrapGetStateFromPath(getStateFromPath),
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


// Açılış ekranı: tüm hareket (giriş, döngü, çıkış) SplashPosterWave'de. Burası
// yalnız tema/kar bağlamlarını ona taşır. `exiting` true olunca çıkış başlar,
// bitince `onExited` çağrılır (overlay o zaman sökülür).
const SplashScreen = ({ exiting, onExited, onIntroStart }) => {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const light = isLightSurface(theme.primary);

  return (
    <SplashPosterWave
      backgroundColor={theme.primary}
      light={light}
      exiting={exiting}
      onExited={onExited}
      onIntroStart={onIntroStart}
    >
      {showSnow && (
        <LottieView
          style={styles.lottie}
          source={require("@lottie/snow.json")}
          autoPlay={true}
          loop
        />
      )}
      <StatusBar style={light ? "dark" : "light"} />
    </SplashPosterWave>
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
  const { theme } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = isLightSurface(theme.primary) ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accent,
        background: theme.primary,
        card: theme.secondary,
        text: theme.text.primary,
        border: theme.border,
        notification: theme.colors.red,
      },
    };
  }, [theme]);
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
        try {
          // Transaction: eski "getDoc → yoksa merge'siz setDoc" kalıbı, arada başka
          // bir yazım (ilk ekleme, başka cihaz) kök dokümanı yarattıysa onu SIFIRLARDI.
          await ensureListsRoot(user.uid);
        } catch (e) {
          // Çevrimdışı açılış olağan: kök doküman bir sonraki yazımda zaten
          // oluşturuluyor (tüm servisler merge ile yazar). Her çevrimdışı açılışta
          // hata toast'ı + rapor basmak gürültüydü.
          if (classifyLibraryError(e).code === LIBRARY_ERROR.OFFLINE) return;
          // Ham hata metni kullanıcıya değil Sentry'ye: ekranda yerelleştirilmiş
          // genel mesaj kalır, teşhis için gereken ayrıntı raporlamaya gider.
          captureError(e, { tags: { source: "app_create_user_lists" } });
          toast.error(i18nText("autoI18n.islem_tamamlanamadi", "İşlem tamamlanamadı"));
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
      theme={navigationTheme}
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
        // Free kullanıcıda her ekranın üstünde "Premium'a geç" şeridi; kurallar
        // utils/premiumTopBanner.js (gizlenen rotalar, Premium'da kalkar).
        screenLayout={({ route, children }) => (
          <PremiumTopBannerLayout routeName={route.name}>{children}</PremiumTopBannerLayout>
        )}
        screenOptions={({ navigation }) => ({
          contentStyle: { backgroundColor: theme.primary },
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
            // `transparentModal` iOS'ta UIModalPresentationOverFullScreen olur:
            // bu bir modal sunumdur, push değil; kenardan kaydırarak geri
            // gitme hareketi (interactivePopGestureRecognizer) çalışmaz.
            // Ekran zaten opak (theme.primary) olduğundan şeffaflığa ihtiyacı
            // yok; MovieDetails ile aynı şekilde normal push olarak açılır.
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
          name="DiscoverFilters"
          getComponent={() => require("./screens/shared/DiscoverFiltersScreen").default}
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
            // Tam ekran SAYFA (push): `presentation: "modal"` iOS'ta sayfa
            // sheet'i açıp ekranı kısaltıyor, güvenli alanı değiştiriyor ve
            // aşağı çekerek kapatma jestini tuvaldeki blok sürüklemeyle ve ayar
            // sayfasındaki kaydırmalarla çakıştırıyordu.
            animation: "slide_from_right",
            // Tuval sürüklemesi ekran kenarına kadar gider; kenardan geri
            // kaydırma jesti bloğu tutarken ekranı kapatırdı. Geri: başlıktaki
            // ok / Android geri tuşu (açık ayar sayfasını önce kapatır).
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
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
            // Normal yığın geçişi (diğer ekranlarla aynı); eski düğmeden genişleme
            // geçişi (transparentModal + JS animasyonu) takılıyordu.
            animation: "slide_from_right",
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
            // Tam ekran: `presentation: "modal"` iOS'ta sayfa sheet'i açıp
            // üstte ~60pt boşluk bırakıyordu; ekran ayrıca kök güvenli alan
            // (`insets.top`) değerini yine ekleyip içeriği sheet'in kendi
            // üst kenarından ~70pt aşağı itiyordu. Bu hikâye ekranı bütün
            // pencereyi kaplar; kapatma sağ üstteki çarpıdan.
            presentation: "fullScreenModal",
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
        {/* Ayarlar sekme değil: Profil'in dişli düğmesinden açılır (ProfileScreen). */}
        <Stack.Screen
          name="NotificationsScreen"
          getComponent={() => require("./screens/tabs/profile/NotificationsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SettingsScreen"
          getComponent={() => require("./screens/tabs/SettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacySettingsScreen"
          getComponent={() => require("./screens/tabs/profile/PrivacySettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ListVisibilityScreen"
          getComponent={() => require("./screens/tabs/profile/ListVisibilityScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BlockedUsersScreen"
          getComponent={() => require("./screens/tabs/profile/BlockedUsersScreen").default}
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
          name="DecorScopesScreen"
          getComponent={() => require("./screens/tabs/settings/DecorScopesScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SectionVisibilityScreen"
          getComponent={() => require("./screens/tabs/settings/SectionVisibilityScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PremiumUsageScreen"
          getComponent={() => require("./screens/tabs/settings/PremiumUsageScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReferralScreen"
          getComponent={() => require("./screens/tabs/settings/ReferralScreen").default}
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
          name="FeedbackScreen"
          getComponent={() => require("./screens/tabs/settings/FeedbackScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BackupSettingsScreen"
          getComponent={() => require("./screens/tabs/settings/BackupSettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ShareSettingsScreen"
          getComponent={() => require("./screens/tabs/settings/ShareSettingsScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LibraryExportScreen"
          getComponent={() => require("./screens/tabs/settings/LibraryExportScreen").default}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AISettingsScreen"
          getComponent={() => require("./screens/tabs/settings/AISettingsScreen").default}
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
          name="CineSwipeScreen"
          getComponent={() => require("./screens/cineswipe/CineSwipeScreen").default}
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
          name="QuickGameScreen"
          getComponent={() => require("./screens/game/QuickGameScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="Top100Screen"
          getComponent={() => require("./screens/fun/Top100Screen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="OlderGameScreen"
          getComponent={() => require("./screens/game/OlderGameScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="FilmChainScreen"
          getComponent={() => require("./screens/game/FilmChainScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="CinemaBingoScreen"
          getComponent={() => require("./screens/bingo/CinemaBingoScreen").default}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="GameLeaderboardScreen"
          getComponent={() => require("./screens/game/GameLeaderboardScreen").default}
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
        <Stack.Screen
          name="UsageDebugScreen"
          getComponent={() => require("./screens/tabs/UsageDebugScreen").default}
          options={{ headerShown: true, title: "Debug", animation: "slide_from_right" }}
        />
      </Stack.Navigator>

      {showChatModal && swipeViewReady && <SwipeViewHost />}
      <ToastHost />
      <ConnectivityToast />
      <AppAlertHost />
      {/* Premium yükseltme sayfası: kapılar (hooks/usePremiumGate.js) bunu açar.
          PremiumProvider içinde olmak zorunda (mağaza fiyatını okur). */}
      <PremiumUpsellHost />
      {/* Paylaş menüsünden gelen bağlantı + simge uzun basma kısayolları. */}
      <ExternalEntryHost />
      <StatusBar style={isLightSurface(theme.primary) ? "dark" : "light"} />
    </NavigationContainer>
  );
}

export default wrapRoot(function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  // Çıkış animasyonu SplashPosterWave'in içinde; burada yalnız tetikleyici durur.
  const [splashExiting, setSplashExiting] = useState(false);
  // Splash girişi, afişler çözülünce başlar (SplashPosterWave). En kısa görünme
  // süresi o andan sayılır; yoksa hızlı açılışta splash afişler görünmeden kapanırdı.
  const splashIntro = useRef(null);
  if (!splashIntro.current) {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    splashIntro.current = { promise, resolve: () => resolve(Date.now()) };
  }

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

  // Uygulama içi logoların kaynağı (appIconStore, MMKV önbelleği) sistemin GERÇEK
  // simgesiyle eşitlenir: yeniden kurulum ya da sistem tarafı değişiklik sonrası
  // giriş/splash/paylaşım logoları launcher'daki simgeyle aynı kalsın. Göçten
  // sonra çalışır — önbellek göçle gelen değeri okumuş olmalı.
  useEffect(() => {
    if (!storageReady) return;
    reconcileAppIconWithSystem();
  }, [storageReady]);

  useEffect(() => {
    // Göç sürerken yerel splash açık kalsın — arkasında boş bir ekran görünmesin.
    if (!storageReady) return;
    // Özel splash'imiz render edildiğinde yerel splash'i kapat (çapraz solma için
    // bkz. dosya başındaki setOptions).
    ExpoSplashScreen.hideAsync().catch(() => {});

    // Preload zaten modül yüklenirken başladı (yukarıda).
    // Splash en az MIN_VISIBLE_MS görünür: giriş animasyonu (halkaların
    // çiçeklenmesi) bitmeden çıkışa geçmek onu yarıda keserdi. Veri geç geliyorsa
    // splash zaten APP_READY'ye kadar kalır — bu sabit yalnız "her şey hazırken"
    // ödenen tabandır (utils/splashMotion.js).
    const MIN_MS = MIN_VISIBLE_MS;
    let preloadDone = false;
    let dataReady = false;
    let timeoutFinished = false;

    const checkReady = () => {
      if (preloadDone && dataReady && !timeoutFinished) {
        timeoutFinished = true;
        hideSplash();
      }
    };

    const hideSplash = () => setSplashExiting(true);

    Promise.all([splashIntro.current.promise, startupPreloadPromise]).then(([introAt]) => {
      const elapsed = Date.now() - introAt;
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

    // Fallback: APP_READY gelmezse zorla çıkış
    const fallbackTimer = setTimeout(() => {
      if (!timeoutFinished) {
        timeoutFinished = true;
        hideSplash();
      }
    }, FALLBACK_EXIT_MS);

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
                  {/* Yerel-öncelikli veri katmanı (notlar, medya notları,
                      hatırlatıcılar): giriş/öne gelme/ağ dönüşünde bekleyen
                      yazımları buluta boşaltır, kopyası olmayan alanları TEK
                      SEFER indirir. Görsel çıktısı yok; context'lerden ÖNCE
                      mount olur ki ilk indirme onları beklemesin. */}
                  <UserDataSyncHost />
                  {/* UserProfile DIŞTA: PremiumProvider sunucu planını
                      (Users/{uid}.entitlements) profilden okur. */}
                  <UserProfileProvider>
                  <PremiumProvider>
                  <FriendsProvider>
                  <NotificationsProvider>
                  <UnreadMessagesProvider>
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
                      <MediaNotesProvider>
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
                              {/* Özel afiş seçimleri: çizim anında uygulanır;
                                  planı okuduğu için PremiumProvider'ın İÇİNDE. */}
                              <PosterChoicesProvider>
                              <MediaQuickActionsProvider>
                                <AppContent />
                              </MediaQuickActionsProvider>
                              </PosterChoicesProvider>
                            </DeviceNotificationsProvider>
                          </PetProvider>
                            {splashVisible && (
                              <View
                                style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
                                pointerEvents="none"
                              >
                                <SplashScreen
                                  exiting={splashExiting}
                                  onExited={() => setSplashVisible(false)}
                                  onIntroStart={splashIntro.current.resolve}
                                />
                              </View>
                            )}
                        </TvShowProvider>
                            </PostsProvider>
                          </ProfileUiProvider>
                        </ProfileRemindersProvider>
                      </MediaNotesProvider>
                      </ProfileNotesProvider>
                      </WatchProgressProvider>
                    </ProfileStatsProvider>
                  </SharedListsProvider>
                  </MediaActivityProvider>
                  </ListStatusProvider>
                  </UnreadMessagesProvider>
                  </NotificationsProvider>
                  </FriendsProvider>
                  </PremiumProvider>
                  </UserProfileProvider>
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
