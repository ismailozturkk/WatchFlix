// Giriş ekranı — IslamicGuide auth tasarım diline göre sadeleştirildi:
// dikeyde ortalanmış düzen, rozetli marka bloğu, solid yüzeyli tek kart,
// dolgulu input kabukları ve solid accent ana buton. Blur/gradyan yok.
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import * as Haptics from "@services/hapticsService";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Checkbox from "expo-checkbox";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScreenDecor from "../../components/ScreenDecor";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import { alpha } from "../../theme/colors";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  signInWithGoogle,
} from "../../services/googleAuthService";
import { i18nText } from "../../utils/i18nText";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// Kayıtlı hesap çipleri: ekran genişliği - yatay padding - komşu çipin ucu.
// Kaydırma çip genişliği + boşluk aralığına yapışır (snap).
const { width: SCREEN_W } = Dimensions.get("window");
const CHIP_GAP = 10;
const CHIP_W = Math.min(SCREEN_W - 68, 400);

export default function LoginScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = selectedTheme === "light" || selectedTheme === "green";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [isChecked, setChecked] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Klavye akışı: e-posta → şifre → giriş
  const passwordRef = useRef(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const stored = await AsyncStorage.getItem("recentUsers");
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentUsers(parsed);
      } catch (e) {
        // Bozuk kayıt: hızlı giriş çipleri yüklenmesin ama ekran çalışsın.
        if (__DEV__) console.warn("recentUsers okunamadı:", e?.message);
      }
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
    if (isloading) return; // çift dokunma koruması
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
      } else if (recentUsers.some((u) => u.email === userEmail)) {
        // Zaten kayıtlı bir hesapla girildi: en son giriş listenin başına geçsin
        await storeUser(userEmail);
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

  // Kayıtlı hızlı girişi listeden ve depodan kaldır
  const removeRecentUser = async (user) => {
    try {
      const updated = recentUsers.filter((u) => u.email !== user.email);
      setRecentUsers(updated);
      await AsyncStorage.setItem("recentUsers", JSON.stringify(updated));
      await AsyncStorage.removeItem(`password_${user.email}`);
    } catch (e) {
      // sessizce geç
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) return;
      const { user, needsProfileCompletion } = result;

      if (needsProfileCompletion) {
        navigation.reset({ index: 0, routes: [{ name: "GoogleProfileCompletionScreen" }] });
      } else {
        Toast.show({
          type: "success",
          text1: i18nText("autoI18n.hos_geldin", "Hoş geldin, ") + (user.displayName || user.email),
        });
        navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
      }
    } catch (error) {
      // İptal bir hata değil — sessizce geç.
      if (error?.code === GoogleAuthCode.CANCELLED) return;
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.google_ile_giris_basarisiz", "Google ile giriş başarısız."),
        text2: describeGoogleAuthError(error, language === "tr"),
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const fieldSurface = theme.between;

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <ScreenDecor iconOpacity={isLightTheme ? 0.05 : 0.08} />

      {/* Snow */}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Marka bloğu */}
          <View style={styles.heroMark}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: alpha(accent, 0.12),
                  borderColor: alpha(accent, 0.3),
                },
              ]}
            >
              <Image
                source={require("../../assets/icon.png")}
                style={styles.heroIconImage}
                resizeMode="contain"
              />
            </View>
            <Text allowFontScaling={false} style={[styles.brandTitle, { color: theme.text.primary }]}>
              Watch<Text style={{ color: accent }}>ify</Text>
            </Text>
            <Text allowFontScaling={false} style={[styles.brandSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.izleme_listelerin_ve_sosyal_akisin_hazir", "İzleme listelerin ve sosyal akışın hazır.")}
            </Text>
          </View>

          {/* Kayıtlı hesap çipleri — en son giriş en başta, yapışmalı (snap) yatay kaydırma */}
          {recentUsers.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={recentUsers.length > 1}
              keyboardShouldPersistTaps="handled"
              snapToInterval={CHIP_W + CHIP_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              style={styles.savedList}
              contentContainerStyle={styles.savedListContent}
            >
              {recentUsers.map((user, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.84}
                  disabled={isloading}
                  onPress={() => handleUserPress(user)}
                  onLongPress={() => removeRecentUser(user)}
                  style={[
                    styles.savedChip,
                    {
                      backgroundColor: alpha(accent, isLightTheme ? 0.07 : 0.1),
                      borderColor: alpha(accent, 0.32),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.savedAvatar,
                      {
                        backgroundColor: theme.secondary,
                        borderColor: alpha(accent, 0.26),
                      },
                    ]}
                  >
                    <Text style={[styles.savedAvatarText, { color: accent }]}>
                      {getInitials(user.email)}
                    </Text>
                  </View>
                  <View style={styles.savedTextArea}>
                    <Text allowFontScaling={false} style={[styles.savedLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.kayitli_hesap", "Kayıtlı hesap")}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.savedName, { color: theme.text.primary }]}
                    >
                      {user.email.split("@")[0]}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.savedRemove}
                    onPress={() => removeRecentUser(user)}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={16} color={theme.text.muted} />
                  </TouchableOpacity>
                  <View style={[styles.savedAction, { backgroundColor: theme.secondary }]}>
                    <Text allowFontScaling={false} style={[styles.savedActionText, { color: accent }]}>
                      {t.LoginScreen.loginButton}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color={accent} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Kart */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.secondary, borderColor: hairline },
            ]}
          >
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: theme.text.primary }]}>
              {t.LoginScreen.loginButton}
            </Text>
            <Text allowFontScaling={false} style={[styles.cardSub, { color: theme.text.muted }]}>
              {i18nText("autoI18n.e_posta_veya_google_ile_hizlica_giris_yap", "E-posta veya Google ile hızlıca giriş yap.")}
            </Text>

            {/* E-posta */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: emailFocused ? alpha(accent, 0.08) : fieldSurface,
                  borderColor: emailFocused ? accent : hairline,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailFocused ? accent : theme.text.muted}
              />
              <TextInput
                allowFontScaling={false}
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholder={t.LoginScreen.email}
                placeholderTextColor={theme.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                onChangeText={setEmail}
                value={email}
                maxLength={254}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Hızlı e-posta soneki önerileri */}
            <EmailSuffixRow
              email={email}
              onApply={setEmail}
              theme={theme}
              accent={accent}
              fieldSurface={fieldSurface}
            />

            {/* Şifre */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: passwordFocused ? alpha(accent, 0.08) : fieldSurface,
                  borderColor: passwordFocused ? accent : hairline,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={passwordFocused ? accent : theme.text.muted}
              />
              <TextInput
                ref={passwordRef}
                allowFontScaling={false}
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholder={t.LoginScreen.password}
                placeholderTextColor={theme.text.muted}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) signIn();
                }}
                onChangeText={setPassword}
                value={password}
                maxLength={128}
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
                  size={18}
                  color={theme.text.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Beni hatırla + Şifremi unuttum */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setChecked(!isChecked)}
                activeOpacity={0.8}
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text allowFontScaling={false} style={[styles.forgotText, { color: accent }]}>
                  {t.LoginScreen.forgotPassword}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Giriş butonu — solid accent */}
            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.primaryButton,
                { backgroundColor: accent, shadowColor: accent },
                !canSubmit && { opacity: 0.55 },
              ]}
              onPress={() => {
                buzz();
                signIn();
              }}
              disabled={isloading || !canSubmit}
            >
              {isloading ? (
                <LottieView
                  source={require("@lottie/loading15.json")}
                  style={styles.loadingAnim}
                  autoPlay
                  loop
                />
              ) : (
                <>
                  <Text allowFontScaling={false} style={styles.primaryText}>
                    {t.LoginScreen.loginButton}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* veya */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: hairline }]} />
              <Text style={[styles.orText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.veya", "veya")}
              </Text>
              <View style={[styles.orLine, { backgroundColor: hairline }]} />
            </View>

            {/* Google ile giriş */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                { backgroundColor: fieldSurface, borderColor: hairline },
              ]}
              onPress={() => {
                buzz();
                handleGoogleSignIn();
              }}
              activeOpacity={0.8}
              disabled={isGoogleLoading}
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
                    style={[styles.googleButtonText, { color: theme.text.primary }]}
                  >{i18nText("autoI18n.google_ile_giris_yap", "Google ile giriş yap")}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Kayıt ol */}
            <View style={styles.footerRow}>
              <Text allowFontScaling={false} style={[styles.footerText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.hesabin_yok_mu", "Hesabın yok mu?")}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate("RegisterScreen")}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text allowFontScaling={false} style={[styles.footerLink, { color: accent }]}>
                  {t.LoginScreen.registerButton}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dil değiştirici — sabit sağ üst */}
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
        <Ionicons name="globe-outline" size={14} color={theme.text.secondary} />
        <Text style={[styles.languageButtonText, { color: theme.text.primary }]}>
          {language.toUpperCase()}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 18,
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
  },

  // ── Marka bloğu ──
  heroMark: {
    alignItems: "center",
    gap: 8,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconImage: {
    width: 44,
    height: 44,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  brandSub: {
    maxWidth: 310,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
  },

  // ── Kayıtlı hesap çipleri ──
  savedList: {
    // Yatay kaydırıcı ekran kenarlarına taşar; içerik padding'i hizayı korur
    marginHorizontal: -22,
    flexGrow: 0,
  },
  savedListContent: {
    paddingHorizontal: 22,
    gap: CHIP_GAP,
  },
  savedChip: {
    width: CHIP_W,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  savedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  savedAvatarText: {
    fontSize: 15,
    fontWeight: "900",
  },
  savedTextArea: {
    flex: 1,
    minWidth: 0,
  },
  savedLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  savedName: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  savedRemove: {
    padding: 2,
  },
  savedAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  savedActionText: {
    fontSize: 11,
    fontWeight: "900",
  },

  // ── Kart ──
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  cardSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -6,
    marginBottom: 2,
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 7,
  },
  rememberText: {
    fontSize: 13,
    fontWeight: "700",
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  loadingAnim: {
    width: 36,
    height: 36,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 12,
    fontWeight: "700",
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
    fontSize: 14.5,
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingTop: 2,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "900",
  },
});
