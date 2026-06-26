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
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
  createUserProfile,
  isUsernameAvailable,
} from "../../services/userService";
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
import { i18nText } from "../../utils/i18nText";


WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const { width, height } = Dimensions.get("window");

const SUCCESS = "rgb(37, 211, 102)";
const ERROR = "rgb(189, 8, 28)";

export default function RegisterScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { showSnow } = useSnow();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = selectedTheme === "light" || selectedTheme === "green";
  const surface = isLightTheme ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.055)";
  const elevatedSurface = isLightTheme ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.075)";
  const fieldSurface = isLightTheme ? "rgba(255,255,255,0.66)" : "rgba(0,0,0,0.18)";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordAgain, setShowPasswordAgain] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { t } = useLanguage();

  const [passwordCorrect, setPasswordCorrect] = useState(null);
  const [passwordCorrectAgain, setPasswordCorrectAgain] = useState(null);

  let usernameTimeout;

  const checkUsername = async (name) => {
    // Atomic check via Usernames/{lower} doc presence
    const available = await isUsernameAvailable(name);
    setUsernameAvailable(available);
  };

  const validateUsername = (text) => {
    const regex = /^[a-z0-9_]+$/;
    return regex.test(text);
  };

  const handleUsernameChange = (text) => {
    setUsername(text);
    if (!text || text.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    if (text.length > 20 || !validateUsername(text)) {
      setUsernameAvailable(false);
      return;
    }
    setUsernameAvailable(null);
    if (usernameTimeout) clearTimeout(usernameTimeout);
    usernameTimeout = setTimeout(() => {
      checkUsername(text.toLowerCase());
    }, 500);
  };

  const inputPassword = (text) => {
    if (text.length === 0) setPasswordCorrect(null);
    else if (text.length >= 6) setPasswordCorrect(true);
    else setPasswordCorrect(false);
    setPassword(text);
    if (passwordAgain) {
      setPasswordCorrectAgain(text === passwordAgain || passwordAgain === "");
    }
  };

  const inputPasswordAgain = (text) => {
    if (text.length === 0) setPasswordCorrectAgain(null);
    else setPasswordCorrectAgain(text === password);
    setPasswordAgain(text);
  };

  const createAccount = async () => {
    if (!username || username.length < 3) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.lutfen_kullanici_adini_duzenleyiniz", "Lütfen kullanıcı adını düzenleyiniz!"),
      });
      return;
    }
    if (usernameAvailable === false) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.bu_kullanici_adi_alinmis", "Bu kullanıcı adı alınmış!") });
      return;
    }
    if (!name || !lastname) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.lutfen_isim_ve_soyisim_giriniz", "Lütfen isim ve soyisim giriniz!") });
      return;
    }
    if (password !== passwordAgain) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.sifreler_eslesmiyor", "Şifreler eşleşmiyor!") });
      return;
    }
    setIsloading(true);
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      await updateProfile(user, {
        displayName: name + " " + lastname,
        username,
      });
      await sendEmailVerification(user);

      // Atomic profile + username reservation (transaction).
      // Çakışırsa createUserProfile throw eder → catch'e düşer, user'a hata.
      await createUserProfile({
        uid: user.uid,
        username,
        email,
        displayName: user.displayName,
        avatarIndex: 0,
      });

      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.registration_success_verify_email", "{{username}} olarak kayıt başarılı! Email doğrulaması gönderildi: {{email}}", {
          username,
          email,
        }),
      });
      navigation.navigate("LoginScreen");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.kayit_sirasinda_hata_olustu", "Kayıt sırasında hata oluştu: ") + error.message,
      });
    } finally {
      setIsloading(false);
    }
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
        // Google'dan gelen email prefix'i username olarak dene; çakışırsa
        // _XXXX random ekle (basit retry).
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

  const signInWithGoogle = () => {
    promptAsync();
  };

  const getBorderColor = (field, validState) => {
    const isFocused = focusedField === field;
    if (validState === true) return SUCCESS;
    if (validState === false) return ERROR;
    if (isFocused) return accent;
    return hairline;
  };

  const getIconColor = (field, validState) => {
    if (validState === true) return SUCCESS;
    if (validState === false) return ERROR;
    if (focusedField === field) return accent;
    return theme.text.muted;
  };

  const getUsernameBorderColor = () => {
    if (usernameAvailable === true) return SUCCESS;
    if (usernameAvailable === false) return ERROR;
    if (focusedField === "username") return accent;
    return hairline;
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
            alpha(accent, isLightTheme ? 0.2 : 0.3),
            alpha(theme.bold, isLightTheme ? 0.09 : 0.15),
            "transparent",
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.shapeLayer} pointerEvents="none">
        <View
          style={[
            styles.colorShape,
            styles.shapeOne,
            { backgroundColor: alpha(accent, isLightTheme ? 0.2 : 0.26) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeTwo,
            { backgroundColor: alpha(theme.colors.purple, isLightTheme ? 0.12 : 0.18) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeThree,
            { backgroundColor: alpha(theme.colors.orange, isLightTheme ? 0.16 : 0.22) },
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
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              top: insets.top + 8,
              backgroundColor: theme.secondary,
              borderColor: hairline,
            },
          ]}
          onPress={() => navigation.navigate("LoginScreen")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </TouchableOpacity>

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
            <Ionicons name="sparkles-outline" size={15} color={accent} />
            <Text style={[styles.brandPillText, { color: theme.text.primary }]}>
              WATCHFLIX
            </Text>
          </View>
          <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.yeni_hesap_olustur", "Yeni hesap oluştur")}
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.profilini_olusturup_listelerine_basla", "Profilini oluşturup listelerine başla.")}
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
              colors={[alpha(accent, 0.18), "transparent"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <LottieView
            source={require("@lottie/register.json")}
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
              <Ionicons name="person-add-outline" size={14} color={accent} />
              <Text style={[styles.statusChipText, { color: accent }]}>
                {i18nText("autoI18n.profil_kurulumu", "Profil kurulumu")}
              </Text>
            </View>
            <View style={[styles.stepBadge, { borderColor: alpha(accent, 0.28) }]}>
              <Text style={[styles.stepBadgeText, { color: theme.text.secondary }]}>1/1</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {t.RegisterScreen.registerButton}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText("autoI18n.hesap_bilgilerini_tamamla", "Hesap bilgilerini tamamla.")}
          </Text>

          {/* Section: Kimlik */}
          <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.kisisel_bilgiler", "KİŞİSEL BİLGİLER")}</Text>

          {/* İsim + Soyisim - yan yana */}
          <View style={styles.rowInputs}>
            <View
              style={[
                styles.inputWrapper,
                styles.halfInput,
                {
                  backgroundColor: fieldSurface,
                  borderColor: getBorderColor("name", null),
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={getIconColor("name", null)}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholder={t.RegisterScreen.name}
                placeholderTextColor={theme.text.muted}
                onChangeText={setName}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <View
              style={[
                styles.inputWrapper,
                styles.halfInput,
                {
                  backgroundColor: fieldSurface,
                  borderColor: getBorderColor("lastname", null),
                },
              ]}
            >
              <Ionicons
                name="person"
                size={18}
                color={getIconColor("lastname", null)}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholder={t.RegisterScreen.lastName}
                placeholderTextColor={theme.text.muted}
                onChangeText={setLastname}
                onFocus={() => setFocusedField("lastname")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Section: Hesap */}
          <Text
            style={[
              styles.sectionLabel,
              { color: theme.text.muted, marginTop: 8 },
            ]}
          >{i18nText("autoI18n.hesap_bilgileri", "HESAP BİLGİLERİ")}</Text>

          {/* Kullanıcı adı */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: fieldSurface,
                borderColor: getUsernameBorderColor(),
              },
            ]}
          >
            <Ionicons
              name="at-outline"
              size={18}
              color={
                usernameAvailable === true
                  ? SUCCESS
                  : usernameAvailable === false
                    ? ERROR
                    : focusedField === "username"
                      ? accent
                      : theme.text.muted
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  color:
                    usernameAvailable === false ? ERROR : theme.text.primary,
                  textDecorationLine:
                    usernameAvailable === false ? "line-through" : "none",
                  flex: 1,
                },
              ]}
              placeholderTextColor={theme.text.muted}
              placeholder={i18nText("autoI18n.kullanici_adi", "Kullanıcı Adı")}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
            />
            {usernameAvailable === true && (
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
              </View>
            )}
            {usernameAvailable === false && (
              <View style={styles.statusBadge}>
                <Ionicons name="close-circle" size={18} color={ERROR} />
              </View>
            )}
          </View>
          {usernameAvailable === null &&
            username.length > 0 &&
            username.length < 3 && (
              <Text style={[styles.hintText, { color: theme.text.muted }]}>{i18nText("autoI18n.en_az_3_karakter_yalnizca_a_z_0_9", "En az 3 karakter · yalnızca a–z, 0–9, _")}</Text>
            )}

          {/* Email */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: fieldSurface,
                borderColor: getBorderColor("email", null),
              },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={getIconColor("email", null)}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text.primary }]}
              placeholderTextColor={theme.text.muted}
              placeholder={t.RegisterScreen.email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={setEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Şifre */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: fieldSurface,
                borderColor: getBorderColor("password", passwordCorrect),
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={getIconColor("password", passwordCorrect)}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text.primary }]}
              placeholderTextColor={theme.text.muted}
              placeholder={t.RegisterScreen.password}
              secureTextEntry={!showPassword}
              onChangeText={inputPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>

          {/* Şifre Tekrar */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: fieldSurface,
                borderColor: getBorderColor(
                  "passwordAgain",
                  passwordCorrectAgain,
                ),
              },
            ]}
          >
            <Ionicons
              name="lock-closed"
              size={18}
              color={getIconColor("passwordAgain", passwordCorrectAgain)}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text.primary }]}
              placeholderTextColor={theme.text.muted}
              placeholder={t.RegisterScreen.passwordAgain}
              secureTextEntry={!showPasswordAgain}
              onChangeText={inputPasswordAgain}
              onFocus={() => setFocusedField("passwordAgain")}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity
              onPress={() => setShowPasswordAgain(!showPasswordAgain)}
              style={styles.eyeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPasswordAgain ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>

          {/* Password strength indicator */}
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              {[...Array(4)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        password.length >= (i + 1) * 3
                          ? i < 2
                            ? ERROR
                            : i < 3
                              ? "#f39c12"
                              : SUCCESS
                          : hairline,
                    },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: theme.text.muted }]}>
                {password.length < 6
                  ? i18nText("autoI18n.zayif", "Zayıf")
                  : password.length < 9
                    ? i18nText("autoI18n.orta", "Orta")
                    : password.length < 12
                      ? i18nText("autoI18n.iyi", "İyi")
                      : i18nText("autoI18n.guclu", "Güçlü")}
              </Text>
            </View>
          )}

          {/* Register button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              { shadowColor: accent },
              usernameAvailable === false && { opacity: 0.5 },
            ]}
            onPress={createAccount}
            disabled={usernameAvailable === false}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[accent, theme.bold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.registerGradient}
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
                  <Text
                    allowFontScaling={false}
                    style={styles.registerButtonText}
                  >
                    {t.RegisterScreen.registerButton}
                  </Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login link */}
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
            onPress={signInWithGoogle}
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
                <View style={styles.googleIconWrapper}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.googleButtonText,
                    { color: theme.text.primary },
                  ]}
                >{i18nText("autoI18n.google_ile_kayit_ol", "Google ile kayıt ol")}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <TouchableOpacity
            style={[
              styles.loginLink,
              {
                borderColor: hairline,
                backgroundColor: fieldSurface,
              },
            ]}
            onPress={() => navigation.navigate("LoginScreen")}
            activeOpacity={0.75}
          >
            <Text
              style={[styles.loginLinkText, { color: theme.text.secondary }]}
            >{i18nText("autoI18n.zaten_hesabin_var_mi", "Zaten hesabın var mı?")}{" "}
            </Text>
            <Text
              style={[
                styles.loginLinkText,
                { color: accent, fontWeight: "700" },
              ]}
            >
              {t.RegisterScreen.loginButton}
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
    width: 178,
    height: 72,
    top: height * 0.18,
    right: -48,
    transform: [{ rotate: "18deg" }],
  },
  shapeTwo: {
    width: 122,
    height: 90,
    top: height * 0.34,
    left: -28,
    transform: [{ rotate: "-20deg" }],
  },
  shapeThree: {
    width: 218,
    height: 52,
    top: height * 0.51,
    left: width * 0.34,
    transform: [{ rotate: "9deg" }],
  },
  backButton: {
    position: "absolute",
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
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
    height: 72,
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
    width: 108,
    height: 108,
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
  stepBadge: {
    minWidth: 40,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "800",
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
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 8,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  halfInput: {
    flex: 1,
    marginBottom: 0,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 47,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 9,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    fontWeight: "600",
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
  },
  hintText: {
    fontSize: 11,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -4,
    marginBottom: 12,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    marginLeft: 4,
    minWidth: 32,
  },
  registerButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  registerGradient: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0,
  },
  loginLink: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginLinkText: {
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
