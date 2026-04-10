import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LogBox,
} from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import TabScreen from "./screens/TabScreen";
import TvShowsDetails from "./screens/tv/TvShowsDetails";
import SeasonDetails from "./screens/tv/SeasonDetails";
import EpisodeDetails from "./screens/tv/EpisodeDetails";
import MovieDetails from "./screens/movie/MovieDetail";
import TvGraphDetailScreen from "./screens/tv/TvGraphDetailScreen";
import MovieSearch from "./screens/search/MovieSearch";
import TvShowSearch from "./screens/search/TvShowSearch";
import LoginScreen from "./screens/auth/LoginScreen";
import RegisterScreen from "./screens/auth/RegisterScreen";
import ForgotPasswordScreen from "./screens/auth/ForgotPasswordScreen";
import LottieView from "lottie-react-native";
import { useTheme } from "./context/ThemeContext";
import { SnowProvider, useSnow } from "./context/SnowContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { ListStatusProvider } from "./context/ListStatusContext";
import { auth, db } from "./firebase";
import ProfileScreen from "./screens/tabs/ProfileScreen";
import Toast from "react-native-toast-message";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import ListsScreen from "./screens/ListsScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ListsViewScreen from "./screens/ListsViewScreen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import SwipeView from "./screens/SwipeView";
import { ProfileScreenProvider } from "./context/ProfileScreenContext";
import { TvShowProvider } from "./context/TvShowContex";
import { MovieProvider } from "./context/MovieContex";
import ActorSearch from "./screens/search/ActorSearch";
import ActorViewScreen from "./screens/actor/ActorViewScreen";
import MovieStatisticsScreen from "./screens/tabs/profile/MovieStatisticsScreen";
import TvStatisticsScreen from "./screens/tabs/profile/TvStatisticsScreen";
import TabScreenNavigator from "./screens/TabScreenNavigator";
import SearchAll from "./screens/search/SearchAll";
import FriendsListScreen from "./screens/tabs/profile/FriendsListScreen";
import SearchFriendsScreen from "./screens/search/SearchFriendsScreen";
import FriendRequestsScreen from "./screens/tabs/profile/FriendRequestsScreen";
import ChatScreen from "./screens/ChatScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Comment from "./components/Comment";
import MovieSearchScreen from "./screens/search/MovieSearchScreen";
import IconBacground from "./components/IconBacground";
import CalendarScreen from "./screens/CalendarScreen";
import { CalendarProvider } from "./context/CalendarContext";
import OnGoingSeries from "./screens/tv/OnGoingSeries";

// Daha sonra stack/tab navigator'larında otomatik etkili olur

const SplashScreen = () => {
  const { theme } = useTheme();
  const { showSnow } = useSnow();

  return (
    <View style={[styles.splashContainer, { backgroundColor: theme.primary }]}>
      <IconBacground opacity={0.5} />

      {showSnow && (
        <LottieView
          style={styles.lottie}
          source={require("./LottieJson/snow.json")}
          autoPlay={true}
          loop
        />
      )}
      <LottieView
        style={{ width: 350, height: 350 }}
        source={require("./LottieJson/splash.json")} // Lottie dosyanızın yolu
        autoPlay
        loop
      />
      <StatusBar
        //backgroundColor={theme.primary} // Arka plan rengini RGB olarak ayarlayın
        barStyle="dark-content" // Metin ve simgelerin rengini ayarlayın (light-content veya dark-content)
      />
    </View>
  );
};

function AppContent() {
  const Stack = createNativeStackNavigator();
  const [showChatModal, setShowChatModal] = useState(false); // State for modal visibility
  const [showBackButton, setShowBackButton] = useState(false);
  const { user, initialRoute, loading } = useAuth();

  useEffect(() => {
    if (user) {
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
            type: "success",
            text1: `Error fetching or creating document:, ${e}`,
          });
        }
      };
      createList();
    }
  }, [user]);
  const toastConfig = {
    error: ({ text1, props }) => (
      <View style={styles.toastError}>
        <Text allowFontScaling={false} style={styles.toastText}>
          {text1}
        </Text>
      </View>
    ),
    warning: ({ text1, props }) => (
      <View style={styles.toastWarning}>
        <Text allowFontScaling={false} style={styles.toastText}>
          {text1}
        </Text>
      </View>
    ),
    success: ({ text1, props }) => (
      <View style={styles.toastSuccess}>
        <Text allowFontScaling={false} style={styles.toastText}>
          {text1}
        </Text>
      </View>
    ),
  };
  useEffect(() => {
    if (user) {
      setShowChatModal(true);
    } else {
      setShowChatModal(false);
    }
  }, [user]);

  if (loading) return null;

  return (
    <NavigationContainer
      onStateChange={(state) => {
        // Get the current route name
        const routeName = state.routes[state.index].name;
        // Control modal visibility based on the current screen
        if (
          routeName === "ForgotPasswordScreen" || // Examples - Add other screens where you want to show the chat modal
          routeName === "RegisterScreen" ||
          routeName === "LoginScreen"
        ) {
          setShowChatModal(false);
        } else {
          setShowChatModal(true);
        }
        if (
          routeName === "ForgotPasswordScreen" || // Examples - Add other screens where you want to show the chat modal
          routeName === "RegisterScreen" ||
          routeName === "LoginScreen" ||
          routeName === "TabScreenNavigator"
        ) {
          setShowBackButton(false);
        } else {
          setShowBackButton(true);
        }
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
          name="TabScreen"
          component={TabScreenNavigator} // The component is correct
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TvShowsDetails"
          component={TvShowsDetails}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
            presentation: "transparentModal",
          }}
        />
        <Stack.Screen
          name="SeasonDetails"
          component={SeasonDetails}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="EpisodeDetails"
          component={EpisodeDetails}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="MovieDetails"
          component={MovieDetails}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="TvGraphDetailScreen"
          component={TvGraphDetailScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="MovieSearch"
          component={MovieSearch}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="TvShowSearch"
          component={TvShowSearch}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="ActorSearch"
          component={ActorSearch}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="SearchAll"
          component={SearchAll}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ActorViewScreen"
          component={ActorViewScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />

        <Stack.Screen
          name="RegisterScreen"
          component={RegisterScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ForgotPasswordScreen"
          component={ForgotPasswordScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ProfileScreen"
          component={ProfileScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ListsScreen"
          component={ListsScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ListsViewScreen"
          component={ListsViewScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="MovieStatisticsScreen"
          component={MovieStatisticsScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="TvStatisticsScreen"
          component={TvStatisticsScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="FriendsListScreen"
          component={FriendsListScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ChatScreen"
          component={ChatScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="SearchFriendsScreen"
          component={SearchFriendsScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="FriendRequestsScreen"
          component={FriendRequestsScreen}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="Comment"
          component={Comment}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
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
          component={CalendarScreen}
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="OnGoingSeries"
          component={OnGoingSeries}
          options={{
            headerTransparent: true,
            headerTintColor: "#fff",
            headerTitle: "",
            headerShadowVisible: false,
            animation: "slide_from_right",
          }}
        />
      </Stack.Navigator>

      {showChatModal && <SwipeView />}
      <Toast visibilityTime={5000} config={toastConfig} position="top" />
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setSplashVisible(false));
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // // Çevrimiçi/Çevrimdışı durumu yönetimi
  // useEffect(() => {
  //   let currentUserUID = null;

  //   const updateStatus = async (isOnline) => {
  //     if (currentUserUID) {
  //       const userRef = doc(db, "Users", currentUserUID);
  //       try {
  //         await updateDoc(userRef, { isOnline });
  //       } catch (error) {
  //         console.error("Kullanıcı durumu güncellenirken hata:", error);
  //       }
  //     }
  //   };

  //   // Kullanıcı giriş/çıkış yaptığında dinle
  //   const authUnsubscribe = auth.onAuthStateChanged((user) => {
  //     if (user) {
  //       currentUserUID = user.uid;
  //       updateStatus(true);
  //     } else if (currentUserUID) {
  //       // Kullanıcı çıkış yaptıysa
  //       updateStatus(false);
  //       currentUserUID = null;
  //     }
  //   });

  //   // Uygulama durumunu dinle (aktif, arka plan, vb.)
  //   const appStateSubscription = AppState.addEventListener(
  //     "change",
  //     (nextAppState) => {
  //       if (nextAppState === "active") {
  //         updateStatus(true);
  //       } else {
  //         updateStatus(false);
  //       }
  //     }
  //   );

  //   // Component kaldırıldığında (unmount) tüm listener'ları temizle
  //   return () => {
  //     authUnsubscribe();
  //     appStateSubscription.remove();
  //     // Son bir kez offline olarak işaretle
  //     updateStatus(false);
  //   };
  // }, []);
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <SnowProvider>
              <AppSettingsProvider>
                <AuthProvider>
                  <ListStatusProvider>
                    <ProfileScreenProvider>
                      <CalendarProvider>
                        <TvShowProvider>
                          <MovieProvider>
                            <AppContent />
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
                          </MovieProvider>
                        </TvShowProvider>
                      </CalendarProvider>
                    </ProfileScreenProvider>
                  </ListStatusProvider>
                </AuthProvider>
              </AppSettingsProvider>
            </SnowProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

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
