import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from "react-native";
import React, { useState, useEffect } from "react";
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
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import IconBacground from "../../components/IconBacground";
import { LinearGradient } from "expo-linear-gradient";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

const GREEN = "#1a6b3c";
const GREEN_LIGHT = "#1e8449";
const SUCCESS = "rgb(37, 211, 102)";
const ERROR = "rgb(189, 8, 28)";

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
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

  let border = theme.border;
  const [passwordCorrect, setPasswordCorrect] = useState(null);
  const [passwordCorrectAgain, setPasswordCorrectAgain] = useState(null);

  let usernameTimeout;

  const checkUsername = async (name) => {
    const q = query(collection(db, "Users"), where("username", "==", name));
    const snapshot = await getDocs(q);
    setUsernameAvailable(snapshot.empty);
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
        text1: "Lütfen kullanıcı adını düzenleyiniz!",
      });
      return;
    }
    if (usernameAvailable === false) {
      Toast.show({ type: "error", text1: "Bu kullanıcı adı alınmış!" });
      return;
    }
    if (!name || !lastname) {
      Toast.show({ type: "error", text1: "Lütfen isim ve soyisim giriniz!" });
      return;
    }
    if (password !== passwordAgain) {
      Toast.show({ type: "error", text1: "Şifreler eşleşmiyor!" });
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
      const userRef = doc(db, "Users", user.uid);
      await setDoc(userRef, {
        username,
        email,
        displayName: user.displayName,
        avatar: null,
        createdAt: new Date(),
        friends: [],
        friendRequests: { sendRequest: [], receivedRequest: [] },
      });
      Toast.show({
        type: "success",
        text1: `${username} olarak kayıt başarılı! Email doğrulaması gönderildi: ${email}`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Kayıt sırasında hata oluştu: " + error.message,
      });
    } finally {
      setIsloading(false);
      navigation.navigate("LoginScreen");
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // ⚠️ clientId değerlerini kendi Google Cloud Console'unuzdan alın
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      handleGoogleCredential(id_token);
    }
  }, [response]);

  const handleGoogleCredential = async (idToken) => {
    setIsGoogleLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const auth = getAuth();
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const userRef = doc(db, "Users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const emailPrefix = user.email?.split("@")[0] || "user";
        await setDoc(userRef, {
          username: emailPrefix,
          email: user.email,
          displayName: user.displayName,
          avatar: user.photoURL,
          createdAt: new Date(),
          friends: [],
          friendRequests: { sendRequest: [], receivedRequest: [] },
        });
      }

      Toast.show({
        type: "success",
        text1: "Hoş geldin, " + (user.displayName || user.email),
      });
      navigation.navigate("TabScreen", user);
    } catch (error) {
      Toast.show({ type: "error", text1: "Google ile giriş başarısız." });
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
    if (isFocused) return GREEN;
    return "rgba(255,255,255,0.07)";
  };

  const getIconColor = (field, validState) => {
    if (validState === true) return SUCCESS;
    if (validState === false) return ERROR;
    if (focusedField === field) return GREEN;
    return theme.text.muted;
  };

  const getUsernameBorderColor = () => {
    if (usernameAvailable === true) return SUCCESS;
    if (usernameAvailable === false) return ERROR;
    if (focusedField === "username") return GREEN;
    return "rgba(255,255,255,0.07)";
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={0.08} />

      {/* Ambient blob */}
      <View style={styles.gradientBlob} pointerEvents="none">
        <LinearGradient
          colors={["rgba(26,107,60,0.3)", "transparent"]}
          style={{ width: 280, height: 280, borderRadius: 140 }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: theme.secondary,
              borderColor: "rgba(255,255,255,0.08)",
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
            source={require("../../LottieJson/snow.json")}
            autoPlay
            loop
          />
        )}

        {/* Logo */}
        <View style={styles.logoContainer}>
          <LottieView
            source={require("../../LottieJson/register.json")}
            style={{ width: 180, height: 180 }}
            autoPlay
            loop
          />
        </View>

        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.secondary,
              borderColor: "rgba(255,255,255,0.07)",
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {t.RegisterScreen.registerButton}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            Yeni bir hesap oluşturun
          </Text>

          {/* Section: Kimlik */}
          <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>
            KİŞİSEL BİLGİLER
          </Text>

          {/* İsim + Soyisim - yan yana */}
          <View style={styles.rowInputs}>
            <View
              style={[
                styles.inputWrapper,
                styles.halfInput,
                {
                  backgroundColor: theme.primary,
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
                  backgroundColor: theme.primary,
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
          >
            HESAP BİLGİLERİ
          </Text>

          {/* Kullanıcı adı */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.primary,
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
                      ? GREEN
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
              placeholder="Kullanıcı Adı"
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
              <Text style={[styles.hintText, { color: theme.text.muted }]}>
                En az 3 karakter · yalnızca a–z, 0–9, _
              </Text>
            )}

          {/* Email */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.primary,
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
                backgroundColor: theme.primary,
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
                backgroundColor: theme.primary,
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
                          : "rgba(255,255,255,0.1)",
                    },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: theme.text.muted }]}>
                {password.length < 6
                  ? "Zayıf"
                  : password.length < 9
                    ? "Orta"
                    : password.length < 12
                      ? "İyi"
                      : "Güçlü"}
              </Text>
            </View>
          )}

          {/* Register button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              usernameAvailable === false && { opacity: 0.5 },
            ]}
            onPress={createAccount}
            disabled={usernameAvailable === false}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[GREEN_LIGHT, GREEN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.registerGradient}
            >
              {isloading ? (
                <LottieView
                  source={require("../../LottieJson/loading15.json")}
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
                { backgroundColor: "rgba(255,255,255,0.08)" },
              ]}
            />
            <Text style={[styles.orText, { color: theme.text.muted }]}>
              veya
            </Text>
            <View
              style={[
                styles.orLine,
                { backgroundColor: "rgba(255,255,255,0.08)" },
              ]}
            />
          </View>

          {/* Google Sign-In button */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: theme.primary,
                borderColor: "rgba(255,255,255,0.1)",
              },
            ]}
            onPress={signInWithGoogle}
            activeOpacity={0.8}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <LottieView
                source={require("../../LottieJson/loading15.json")}
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
                >
                  Google ile kayıt ol
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <TouchableOpacity
            style={[
              styles.loginLink,
              { borderColor: "rgba(255,255,255,0.09)" },
            ]}
            onPress={() => navigation.navigate("LoginScreen")}
            activeOpacity={0.75}
          >
            <Text
              style={[styles.loginLinkText, { color: theme.text.secondary }]}
            >
              Zaten hesabın var mı?{" "}
            </Text>
            <Text
              style={[
                styles.loginLinkText,
                { color: GREEN, fontWeight: "700" },
              ]}
            >
              {t.RegisterScreen.loginButton}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    paddingTop: 60,
  },
  gradientBlob: {
    position: "absolute",
    top: -40,
    right: -60,
    zIndex: 0,
  },
  backButton: {
    position: "absolute",
    top: 52,
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
  logoContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  card: {
    width: width - 32,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  halfInput: {
    flex: 1,
    marginBottom: 0,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
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
    marginBottom: 16,
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
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 12,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  registerGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  loginLink: {
    height: 48,
    borderRadius: 14,
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
    letterSpacing: 0.5,
  },
  googleButton: {
    height: 52,
    borderRadius: 14,
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
    fontWeight: "600",
  },
});
