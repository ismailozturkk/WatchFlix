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
import React, { useState, useEffect, useRef } from "react";
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
import {
  useAuthRequest,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const { t, language, toggleLanguage } = useLanguage();
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
        date: new Date().toLocaleString("tr-TR"),
      };
      let updatedUsers = [newUser, ...recentUsers];
      updatedUsers = updatedUsers.filter(
        (u, i, arr) => arr.findIndex((x) => x.email === u.email) === i,
      );
      if (updatedUsers.length > 3) updatedUsers.pop();
      await AsyncStorage.setItem("recentUsers", JSON.stringify(updatedUsers));
      setRecentUsers(updatedUsers);
    } catch (e) {
      console.error("Kullanıcı kaydedilemedi", e);
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
      navigation.navigate("TabScreen", userCredentials.user);
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
        text1: "Bu kullanıcı için parola kayıtlı değil.",
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={0.08} />

      {/* Ambient gradient blob */}
      <View style={styles.gradientBlob} pointerEvents="none">
        <LinearGradient
          colors={["rgba(26,107,60,0.35)", "transparent"]}
          style={{ width: 320, height: 320, borderRadius: 160 }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Language toggle */}
        <TouchableOpacity
          style={[
            styles.languageButton,
            {
              backgroundColor: theme.secondary,
              borderColor: "rgba(255,255,255,0.08)",
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
            source={require("../../LottieJson/snow.json")}
            autoPlay
            loop
          />
        )}

        {/* Logo area */}
        <View style={styles.logoContainer}>
          <LottieView
            source={require("../../LottieJson/login.json")}
            style={{ width: 200, height: 200 }}
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
          {/* Heading */}
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {t.LoginScreen.loginButton}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            Hesabınıza giriş yapın
          </Text>

          {/* Recent users */}
          {recentUsers.length > 0 && (
            <View style={styles.recentContainer}>
              <Text style={[styles.recentTitle, { color: theme.text.muted }]}>
                Son giriş yapanlar
              </Text>
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
                        backgroundColor: theme.primary,
                        borderColor: "rgba(255,255,255,0.08)",
                      },
                    ]}
                    onPress={() => handleUserPress(user)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.recentAvatar,
                        { backgroundColor: "rgba(26,107,60,0.25)" },
                      ]}
                    >
                      <Text
                        style={[styles.recentAvatarText, { color: "#1a6b3c" }]}
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
                  { backgroundColor: "rgba(255,255,255,0.06)" },
                ]}
              >
                <Text style={[styles.dividerText, { color: theme.text.muted }]}>
                  veya e-posta ile giriş yap
                </Text>
              </View>
            </View>
          )}

          {/* Email input */}
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.primary,
                borderColor: emailFocused
                  ? "#1a6b3c"
                  : "rgba(255,255,255,0.07)",
              },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={emailFocused ? "#1a6b3c" : theme.text.muted}
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
                backgroundColor: theme.primary,
                borderColor: passwordFocused
                  ? "#1a6b3c"
                  : "rgba(255,255,255,0.07)",
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={passwordFocused ? "#1a6b3c" : theme.text.muted}
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
                color={isChecked ? "#1a6b3c" : undefined}
              />
              <Text
                allowFontScaling={false}
                style={[styles.rememberText, { color: theme.text.secondary }]}
              >
                Beni Hatırla
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPasswordScreen")}
            >
              <Text allowFontScaling={false} style={styles.forgotText}>
                {t.LoginScreen.forgotPassword}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => signIn()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#1e8449", "#1a6b3c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginGradient}
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
            onPress={() => promptAsync()}
            activeOpacity={0.8}
            disabled={!request || isGoogleLoading}
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
                >
                  Google ile giriş yap
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Register button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              { borderColor: "rgba(255,255,255,0.1)" },
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
            >
              Hesabın yok mu?{" "}
            </Text>
            <Text
              style={[
                styles.registerButtonText,
                { color: "#1a6b3c", fontWeight: "700" },
              ]}
            >
              {t.LoginScreen.registerButton}
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
    top: -60,
    left: -80,
    zIndex: 0,
    pointerEvents: "none",
  },
  languageButton: {
    position: "absolute",
    top: 52,
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
    letterSpacing: 1,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 8,
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
    marginBottom: 24,
  },
  recentContainer: {
    marginBottom: 20,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
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
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 14,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    borderRadius: 6,
    width: 18,
    height: 18,
  },
  rememberText: {
    fontSize: 14,
  },
  forgotText: {
    fontSize: 14,
    color: "#1a6b3c",
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#1a6b3c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  loginGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  registerButton: {
    height: 48,
    borderRadius: 14,
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
