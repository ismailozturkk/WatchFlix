import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Checkbox from "expo-checkbox";
import AsyncStorage from "@react-native-async-storage/async-storage";
import IconBacground from "../../components/IconBacground";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { alpha } from "../../theme/colors";
import {
  useAuthRequest,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { createUserProfile } from "../../services/userService";
import { i18nText } from "../../utils/i18nText";


WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { showSnow } = useSnow();
  const { t, language, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = selectedTheme === "light" || selectedTheme === "green";
  const surface = isLightTheme ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.055)";
  const elevatedSurface = isLightTheme ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.075)";
  const fieldSurface = isLightTheme ? "rgba(255,255,255,0.66)" : "rgba(0,0,0,0.18)";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [isChecked, setChecked] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const stored = await AsyncStorage.getItem("recentUsers");
      if (stored) setRecentUsers(JSON.parse(stored));
    };
    loadUsers();
  }, []);

  const storeUser = async (email) => {
    try {
      const newUser = {
        email,
        date: new Date().toLocaleString(language === "tr" ? "tr-TR" : "en-US"),
      };
      let updatedUsers = [newUser, ...recentUsers];
      updatedUsers = updatedUsers.filter(
        (u, i, arr) => arr.findIndex((x) => x.email === u.email) === i,
      );
      if (updatedUsers.length > 3) updatedUsers.pop();
      await AsyncStorage.setItem("recentUsers", JSON.stringify(updatedUsers));
      setRecentUsers(updatedUsers);
    } catch (e) {
      console.error(i18nText("autoI18n.kullanici_kaydedilemedi", "Kullanıcı kaydedilemedi"), e);
    }
  };

  const signIn = async (selectedUser) => {
    setIsloading(true);
    try {
      const auth = getAuth();
      const userEmail = selectedUser ? selectedUser.email : email;
      const userPassword = selectedUser ? selectedUser.password : password;

      const userCredentials = await signInWithEmailAndPassword(
        auth,
        userEmail,
        userPassword,
      );

      if (isChecked) {
        await storeUser(userEmail);
        await AsyncStorage.setItem(`password_${userEmail}`, userPassword);
      }

      let userName = userCredentials.user.displayName || userEmail;
      Toast.show({
        type: "success",
        text1: t.LoginScreen.loginToast + " " + userName,
      });
      navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t.LoginScreen.loginToast1,
      });
    } finally {
      setIsloading(false);
    }
  };

  const handleUserPress = async (user) => {
    const savedPass = await AsyncStorage.getItem(`password_${user.email}`);
    if (savedPass) {
      setEmail(user.email);
      setPassword(savedPass);
      signIn({ email: user.email, password: savedPass });
    } else {
      Toast.show({
        type: "info",
        text1: i18nText("autoI18n.bu_kullanici_icin_parola_kayitli_degil", "Bu kullanıcı için parola kayıtlı değil."),
      });
    }
  };

  const getInitials = (email) => {
    return email ? email[0].toUpperCase() : "?";
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId:
        "427087836931-in7lreg3vjgnvudn5h8gauradaeo58kc.apps.googleusercontent.com",
      scopes: ["openid", "profile", "email"],
      responseType: ResponseType.Token,
      redirectUri: makeRedirectUri({ scheme: "watchify" }),
    },
    GOOGLE_DISCOVERY,
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { access_token } = response.params;
      handleGoogleCredential(access_token);
    }
  }, [response]);

  const handleGoogleCredential = async (accessToken) => {
    setIsGoogleLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(null, accessToken);
      const auth = getAuth();
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const userRef = doc(db, "Users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const base = (user.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "");
        let attemptUsername = base;
        for (let i = 0; i < 5; i++) {
          try {
            await createUserProfile({
              uid: user.uid,
              username: attemptUsername,
              email: user.email,
              displayName: user.displayName,
              avatarIndex: 0,
            });
            break;
          } catch (e) {
            if (/alınmış/.test(e.message)) {
              attemptUsername = `${base}_${Math.floor(Math.random() * 9999)}`;
            } else {
              throw e;
            }
          }
        }
      }

      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.hos_geldin", "Hoş geldin, ") + (user.displayName || user.email),
      });
      navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
    } catch (error) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.google_ile_giris_basarisiz", "Google ile giriş başarısız.") });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={isLightTheme ? 0.05 : 0.08} />
      <View style={styles.backdropWash} pointerEvents="none">
        <LinearGradient
          colors={[
            alpha(accent, isLightTheme ? 0.22 : 0.34),
            alpha(theme.bold, isLightTheme ? 0.1 : 0.16),
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.shapeLayer} pointerEvents="none">
        <View
          style={[
            styles.colorShape,
            styles.shapeOne,
            { backgroundColor: alpha(accent, isLightTheme ? 0.22 : 0.28) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeTwo,
            { backgroundColor: alpha(theme.colors.orange, isLightTheme ? 0.18 : 0.24) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeThree,
            { backgroundColor: alpha(theme.colors.green, isLightTheme ? 0.14 : 0.18) },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        {/* Language toggle */}
        <TouchableOpacity
          style={[
            styles.languageButton,
            {
              top: insets.top + 8,
              backgroundColor: theme.secondary,
              borderColor: hairline,
            },
          ]}
          onPress={() => toggleLanguage(language === "tr" ? "en" : "tr")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="globe-outline"
            size={14}
            color={theme.text.secondary}
          />
          <Text
            style={[styles.languageButtonText, { color: theme.text.primary }]}
          >
            {language.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Snow */}
        {showSnow && (
          <LottieView
            style={styles.lottie}
            source={require("@lottie/snow.json")}
            autoPlay
            loop
          />
        )}

        <View style={styles.heroHeader}>
          <View
            style={[
              styles.brandPill,
              {
                backgroundColor: elevatedSurface,
                borderColor: alpha(accent, 0.28),
              },
            ]}
          >
            <Ionicons name="play-circle" size={15} color={accent} />
            <Text style={[styles.brandPillText, { color: theme.text.primary }]}>
              WATCHFLIX
            </Text>
          </View>
          <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.hesabina_devam_et", "Hesabına devam et")}
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.izleme_listelerin_ve_sosyal_akisin_hazir", "İzleme listelerin ve sosyal akışın hazır.")}
          </Text>
        </View>

        <View
          style={[
            styles.logoContainer,
            {
              backgroundColor: surface,
              borderColor: alpha(accent, 0.2),
            },
          ]}
        >
          <View style={styles.heroAccent} pointerEvents="none">
            <LinearGradient
              colors={[alpha(accent, 0.2), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <LottieView
            source={require("@lottie/login.json")}
            style={styles.heroAnimation}
            autoPlay
            loop
          />
        </View>

        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isLightTheme
                ? "rgba(255,255,255,0.18)"
                : "rgba(18,18,18,0.28)",
              borderColor: alpha(accent, isLightTheme ? 0.18 : 0.28),
              shadowColor: accent,
            },
          ]}
        >
          <BlurView
            tint="dark"
            intensity={50}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardEyebrowRow}>
            <View style={[styles.statusChip, { backgroundColor: alpha(accent, 0.12) }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={accent} />
              <Text style={[styles.statusChipText, { color: accent }]}>
                {i18nText("autoI18n.guvenli_oturum", "Güvenli oturum")}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: accent }]} />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {t.LoginScreen.loginButton}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText("autoI18n.e_posta_veya_google_ile_hizlica_giris_yap", "E-posta veya Google ile hızlıca giriş yap.")}
          </Text>

          {/* Recent users */}
          {recentUsers.length > 0 && (
            <View style={styles.recentContainer}>
              <Text style={[styles.recentTitle, { color: theme.text.muted }]}>{i18nText("autoI18n.son_giris_yapanlar", "Son giriş yapanlar")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {recentUsers.map((user, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.recentUser,
                      {
                        backgroundColor: fieldSurface,
                        borderColor: hairline,
                      },
                    ]}
                    onPress={() => handleUserPress(user)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.recentAvatar,
                        { backgroundColor: alpha(accent, 0.2) },
                      ]}
                    >
                      <Text
                        style={[styles.recentAvatarText, { color: accent }]}
                      >
                        {getInitials(user.email)}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.recentEmail,
                          { color: theme.text.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {user.email.split("@")[0]}
                      </Text>
                      <Text
                        style={[styles.recentDate, { color: theme.text.muted }]}
                      >
                        {user.date}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Divider */}
              <View
                style={[
                  styles.divider,
                  { backgroundColor: hairline },
                ]}
              >
                <Text style={[styles.dividerText, { color: theme.text.muted }]}>{i18nText("autoI18n.veya_e_posta_ile_giris_yap", "veya e-posta ile giriş yap")}</Text>
              </View>
            </View>
          )}

          {/* Email input */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: emailFocused ? alpha(accent, 0.1) : fieldSurface,
                borderColor: emailFocused
                  ? alpha(accent, 0.85)
                  : hairline,
              },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={emailFocused ? accent : theme.text.muted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text.primary }]}
              placeholder={t.LoginScreen.email}
              placeholderTextColor={theme.text.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={setEmail}
              value={email}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password input */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: passwordFocused ? alpha(accent, 0.1) : fieldSurface,
                borderColor: passwordFocused
                  ? alpha(accent, 0.85)
                  : hairline,
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={passwordFocused ? accent : theme.text.muted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text.primary }]}
              placeholder={t.LoginScreen.password}
              placeholderTextColor={theme.text.muted}
              secureTextEntry={!showPassword}
              onChangeText={setPassword}
              value={password}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>

          {/* Remember me + Forgot password row */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setChecked(!isChecked)}
              activeOpacity={0.7}
            >
              <Checkbox
                style={styles.checkbox}
                value={isChecked}
                onValueChange={setChecked}
                color={isChecked ? accent : undefined}
              />
              <Text
                allowFontScaling={false}
                style={[styles.rememberText, { color: theme.text.secondary }]}
              >{i18nText("autoI18n.beni_hatirla", "Beni Hatırla")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPasswordScreen")}
            >
              <Text allowFontScaling={false} style={[styles.forgotText, { color: accent }]}>
                {t.LoginScreen.forgotPassword}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginButton, { shadowColor: accent }]}
            onPress={() => signIn()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[accent, theme.bold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginGradient}
            >
              {isloading ? (
                <LottieView
                  source={require("@lottie/loading15.json")}
                  style={{ width: 36, height: 36 }}
                  autoPlay
                  loop
                />
              ) : (
                <>
                  <Text allowFontScaling={false} style={styles.loginButtonText}>
                    {t.LoginScreen.loginButton}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* OR divider */}
          <View style={styles.orRow}>
            <View
              style={[
                styles.orLine,
                { backgroundColor: hairline },
              ]}
            />
            <Text style={[styles.orText, { color: theme.text.muted }]}>
              {i18nText("autoI18n.veya", "veya")}
            </Text>
            <View
              style={[
                styles.orLine,
                { backgroundColor: hairline },
              ]}
            />
          </View>

          {/* Google Sign-In button */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: fieldSurface,
                borderColor: hairline,
              },
            ]}
            onPress={() => promptAsync()}
            activeOpacity={0.8}
            disabled={!request || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <LottieView
                source={require("@lottie/loading15.json")}
                style={{ width: 28, height: 28 }}
                autoPlay
                loop
              />
            ) : (
              <>
                {/* Google "G" logo SVG inline */}
                <View style={styles.googleIconWrapper}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.googleButtonText,
                    { color: theme.text.primary },
                  ]}
                >{i18nText("autoI18n.google_ile_giris_yap", "Google ile giriş yap")}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Register button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              {
                borderColor: hairline,
                backgroundColor: fieldSurface,
              },
            ]}
            onPress={() => navigation.navigate("RegisterScreen")}
            activeOpacity={0.75}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.registerButtonText,
                { color: theme.text.secondary },
              ]}
            >{i18nText("autoI18n.hesabin_yok_mu", "Hesabın yok mu?")}{" "}
            </Text>
            <Text
              style={[
                styles.registerButtonText,
                { color: accent, fontWeight: "700" },
              ]}
            >
              {t.LoginScreen.registerButton}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  backdropWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.46,
    zIndex: 0,
    pointerEvents: "none",
  },
  shapeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  colorShape: {
    position: "absolute",
    borderRadius: 18,
  },
  shapeOne: {
    width: 170,
    height: 76,
    top: height * 0.2,
    left: -48,
    transform: [{ rotate: "-18deg" }],
  },
  shapeTwo: {
    width: 132,
    height: 92,
    top: height * 0.32,
    right: -34,
    transform: [{ rotate: "21deg" }],
  },
  shapeThree: {
    width: 210,
    height: 54,
    top: height * 0.49,
    left: width * 0.36,
    transform: [{ rotate: "-10deg" }],
  },
  languageButton: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 10,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
  },
  heroHeader: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 8,
    marginBottom: 8,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  brandPillText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    paddingHorizontal: 10,
  },
  logoContainer: {
    width: Math.min(width - 104, 240),
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAnimation: {
    width: 116,
    height: 116,
  },
  card: {
    width: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    marginBottom: 24,
    overflow: "hidden",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardEyebrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  recentContainer: {
    marginBottom: 14,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  recentUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 140,
    maxWidth: 180,
  },
  recentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  recentAvatarText: {
    fontSize: 15,
    fontWeight: "800",
  },
  recentEmail: {
    fontSize: 13,
    fontWeight: "600",
  },
  recentDate: {
    fontSize: 10,
    marginTop: 1,
  },
  divider: {
    marginTop: 20,
    height: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dividerText: {
    fontSize: 12,
    marginTop: -9,
    paddingHorizontal: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontWeight: "600",
  },
  eyeButton: {
    paddingHorizontal: 14,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    borderRadius: 6,
    width: 19,
    height: 19,
  },
  rememberText: {
    fontSize: 14,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  loginGradient: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0,
  },
  registerButton: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  registerButtonText: {
    fontSize: 15,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  googleButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  googleIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4285F4",
    lineHeight: 16,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
