import { intlLocaleOf, nextAppLanguage } from "../../utils/appLanguages";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";
// Giriş ekranı — ortak auth görsel dili (components/auth/AuthKit.js): accent'ten
// türeyen arka plan ışıması, halkalı marka rozeti, vurgu çizgili tek kart,
// odakta renk geçişi yapan alanlar ve degrade ana düğme. Davranış (Firebase,
// "Beni hatırla", kayıtlı hesap çipleri, Google/Apple) değişmedi — yalnız görünüm.
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@services/hapticsService";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import { useLanguage } from "../../context/LanguageContext";
import { Keys, get, set } from "../../services/storage";
import * as SecureStore from "expo-secure-store";
import ScreenDecor from "../../components/ScreenDecor";
import GlassPillButton from "../../components/common/GlassPillButton";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import {
  AuthAppleButton,
  AuthBackdrop,
  AuthBadge,
  AuthCard,
  AuthCardHeader,
  AuthDivider,
  AuthEyeToggle,
  AuthField,
  AuthFooterLink,
  AuthGoogleButton,
  AuthHero,
  AuthPressable,
  AuthPrimaryButton,
  Reveal,
  authColumn,
  onAccentColor,
} from "../../components/auth/AuthKit";
import { alpha } from "../../theme/colors";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  signInWithGoogle,
} from "../../services/googleAuthService";
import { i18nText } from "../../utils/i18nText";
import {
  AppleAuthCode,
  describeAppleAuthError,
  isAppleAuthenticationAvailable,
  signInWithApple,
} from "../../services/appleAuthService";
import useAppLogo from "@hooks/useAppLogo";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// Kayıtlı hesap çipleri: ekran genişliği - yatay padding - komşu çipin ucu.
// Kaydırma çip genişliği + boşluk aralığına yapışır (snap).
const { width: SCREEN_W } = Dimensions.get("window");
const CHIP_GAP = 10;
const CHIP_W = Math.min(SCREEN_W - 68, 400);

// ── "Beni Hatırla" parolası ───────────────────────────────────────────────────
// Parola AsyncStorage'da DÜZ METİN tutuluyordu; Android'de bu, uygulamanın
// SQLite dosyasında okunabilir hâlde durur (adb yedeği / root'lu cihaz). Artık
// Keychain (iOS) / Keystore (Android) üstünden SecureStore'a yazılıyor.
//
// SecureStore anahtarları yalnız [A-Za-z0-9._-] kabul ediyor; e-postadaki "@"
// ve diğer karakterler geçmediği için anahtar kodlanıyor.
const secureKeyFor = (email) =>
  `pw_${String(email).replace(/[^A-Za-z0-9._-]/g, "_")}`;

const readSavedPassword = async (email) => {
  try {
    return await SecureStore.getItemAsync(secureKeyFor(email));
  } catch {
    return null;
  }
};

const writeSavedPassword = async (email, value) => {
  try {
    await SecureStore.setItemAsync(secureKeyFor(email), value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e) {
    // Cihazda güvenli depo yoksa parola SAKLANMAZ — düz metne geri düşmüyoruz.
    if (__DEV__) console.warn("SecureStore yazılamadı:", e?.message);
  }
};

const deleteSavedPassword = async (email) => {
  try {
    await SecureStore.deleteItemAsync(secureKeyFor(email));
  } catch {
    // sessizce geç
  }
};

// NOT: diskte duran düz metin parolaların (`password_*`) temizliği artık
// AsyncStorage → MMKV göçünün parçası (services/storage/migration.js). Eskiden
// yalnız BU EKRAN açıldığında koşuyordu; oturumu açık olup giriş ekranını hiç
// görmeyen kullanıcılarda sızıntı yerinde kalıyordu.

export default function LoginScreen({ navigation }) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const { theme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = isLightSurface(theme.primary);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [isChecked, setChecked] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // Klavye akışı: e-posta → şifre → giriş
  const passwordRef = useRef(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const parsed = get(Keys.recentUsers);
        if (Array.isArray(parsed) && parsed.length) setRecentUsers(parsed);
      } catch (e) {
        // Bozuk kayıt: hızlı giriş çipleri yüklenmesin ama ekran çalışsın.
        if (__DEV__) console.warn("recentUsers okunamadı:", e?.message);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    isAppleAuthenticationAvailable().then(setIsAppleAvailable);
  }, []);

  const storeUser = async (email) => {
    try {
      const newUser = {
        email,
        date: new Date().toLocaleString(intlLocaleOf(language)),
      };
      let updatedUsers = [newUser, ...recentUsers];
      updatedUsers = updatedUsers.filter(
        (u, i, arr) => arr.findIndex((x) => x.email === u.email) === i,
      );
      if (updatedUsers.length > 3) updatedUsers.pop();
      set(Keys.recentUsers, updatedUsers);
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
      // Android klavye otomatik tamamlaması e-postanın sonuna boşluk bırakabiliyor;
      // Firebase bunu `invalid-email` sayıp "yanlış parola" gibi görünen hataya düşürür.
      const userEmail = (selectedUser ? selectedUser.email : email).trim();
      const userPassword = selectedUser ? selectedUser.password : password;

      const userCredentials = await signInWithEmailAndPassword(
        auth,
        userEmail,
        userPassword,
      );

      if (isChecked) {
        await storeUser(userEmail);
        await writeSavedPassword(userEmail, userPassword);
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
    const savedPass = await readSavedPassword(user.email);
    if (savedPass) {
      setEmail(user.email);
      setPassword(savedPass);
      signIn({ email: user.email, password: savedPass });
    } else {
      // Düz metin kayıtları silindiği için eski kurulumlarda bir kez buraya
      // düşülür: e-posta doldurulur, kullanıcı parolasını bir kez daha yazar.
      setEmail(user.email);
      setPassword("");
      passwordRef.current?.focus();
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
      set(Keys.recentUsers, updated);
      await deleteSavedPassword(user.email);
    } catch (e) {
      // sessizce geç
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isAppleLoading) return;
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
        text2: describeGoogleAuthError(error, language),
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isAppleLoading || isGoogleLoading) return;
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result.cancelled) return;
      const { user, needsProfileCompletion } = result;
      if (needsProfileCompletion) {
        navigation.reset({
          index: 0,
          routes: [{ name: "GoogleProfileCompletionScreen" }],
        });
      } else {
        Toast.show({
          type: "success",
          text1:
            i18nText("autoI18n.hos_geldin", "Hoş geldin, ") +
            (user.displayName || user.email || (language === "tr" ? "Apple kullanıcısı" : language === "es" ? "Usuario de Apple" : language === "pt" ? "Usuário da Apple" : language === "de" ? "Apple-Nutzer" : "Apple user")),
        });
        navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
      }
    } catch (error) {
      if (error?.code === AppleAuthCode.CANCELLED) return;
      Toast.show({
        type: "error",
        text1: language === "tr" ? "Apple ile giriş başarısız" : language === "es" ? "No se pudo iniciar sesión con Apple" : language === "pt" ? "Não foi possível entrar com a Apple" : language === "de" ? "Anmeldung mit Apple fehlgeschlagen" : "Sign in with Apple failed",
        text2: describeAppleAuthError(error, language),
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const fieldSurface = theme.between;
  const socialBusy = isAppleLoading || isGoogleLoading;
  // Onay işareti / çip oku accent üstünde okunur olsun (sarı temalarda beyaz kaybolur)
  const onAccent = onAccentColor(accent);
  const accentGradient = [accent, shiftLightness(accent, -14)];

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <AuthBackdrop accent={accent} isLightTheme={isLightTheme} />
      <ScreenDecor scope="auth" iconOpacity={isLightTheme ? 0.05 : 0.08} />

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
            { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 36 },
          ]}
        >
          {/* Marka bloğu */}
          <Reveal>
            <AuthHero
              theme={theme}
              titleSize={32}
              badge={
                <AuthBadge accent={accent} surface={theme.secondary} size={68}>
                  <Image source={appLogo} style={styles.heroIconImage} resizeMode="contain" />
                </AuthBadge>
              }
              title={
                <>
                  See<Text style={{ color: accent }}>logd</Text>
                </>
              }
              subtitle={i18nText(
                "autoI18n.izleme_listelerin_ve_sosyal_akisin_hazir",
                "İzleme listelerin ve sosyal akışın hazır.",
              )}
            />
          </Reveal>

          {/* Kayıtlı hesap çipleri — en son giriş en başta, yapışmalı (snap) yatay kaydırma */}
          {recentUsers.length > 0 && (
            <Reveal delay={60} style={styles.savedBleed}>
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
                {recentUsers.map((user) => (
                  <AuthPressable
                    key={user.email}
                    disabled={isloading}
                    onPress={() => handleUserPress(user)}
                    onLongPress={() => removeRecentUser(user)}
                    pressedScale={0.98}
                    style={[
                      styles.savedChip,
                      {
                        backgroundColor: alpha(accent, isLightTheme ? 0.07 : 0.1),
                        borderColor: alpha(accent, 0.32),
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={accentGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.savedAvatar}
                    >
                      <Text style={[styles.savedAvatarText, { color: onAccent }]}>
                        {getInitials(user.email)}
                      </Text>
                    </LinearGradient>
                    <View style={styles.savedTextArea}>
                      <Text
                        allowFontScaling={false}
                        style={[styles.savedLabel, { color: theme.text.muted }]}
                      >
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
                      <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                    </TouchableOpacity>
                    <LinearGradient
                      colors={accentGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.savedGo}
                    >
                      <Ionicons name="arrow-forward" size={16} color={onAccent} />
                    </LinearGradient>
                  </AuthPressable>
                ))}
              </ScrollView>
            </Reveal>
          )}

          {/* Kart */}
          <Reveal delay={110} style={authColumn}>
            <AuthCard theme={theme} accent={accent}>
              <AuthCardHeader
                theme={theme}
                title={i18nText("autoI18n.giris_kart_baslik", "Tekrar hoş geldin")}
                subtitle={i18nText(
                  "autoI18n.giris_kart_alt_baslik",
                  "E-posta, Google veya Apple ile hızlıca giriş yap.",
                )}
              />

              {/* E-posta */}
              <AuthField
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="mail-outline"
                placeholder={t.LoginScreen.email}
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
              />

              {/* Hızlı e-posta soneki önerileri */}
              <EmailSuffixRow
                email={email}
                onApply={setEmail}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
              />

              {/* Şifre */}
              <AuthField
                ref={passwordRef}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="lock-closed-outline"
                placeholder={t.LoginScreen.password}
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
                right={
                  <AuthEyeToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    theme={theme}
                  />
                }
              />

              {/* Beni hatırla + Şifremi unuttum */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  style={styles.rememberRow}
                  onPress={() => setChecked(!isChecked)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isChecked
                        ? { backgroundColor: accent, borderColor: accent }
                        : { borderColor: alpha(theme.text.muted, 0.7) },
                    ]}
                  >
                    {isChecked ? (
                      <Ionicons name="checkmark" size={14} color={onAccent} />
                    ) : null}
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
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

              {/* Giriş butonu */}
              <AuthPrimaryButton
                label={t.LoginScreen.loginButton}
                accent={accent}
                enabled={canSubmit}
                loading={isloading}
                onPress={() => {
                  buzz();
                  signIn();
                }}
              />

              {/* veya */}
              <AuthDivider theme={theme} label={i18nText("autoI18n.veya", "veya")} />

              <View style={styles.socialStack}>
                {isAppleAvailable ? (
                  <AuthAppleButton
                    label={i18nText("autoI18n.apple_ile_giris_yap", "Apple ile giriş yap")}
                    theme={theme}
                    loading={isAppleLoading}
                    disabled={socialBusy}
                    onPress={() => {
                      buzz();
                      handleAppleSignIn();
                    }}
                  />
                ) : null}

                {/* Google ile giriş */}
                <AuthGoogleButton
                  label={i18nText("autoI18n.google_ile_giris_yap", "Google ile giriş yap")}
                  theme={theme}
                  loading={isGoogleLoading}
                  disabled={socialBusy}
                  onPress={() => {
                    buzz();
                    handleGoogleSignIn();
                  }}
                />
              </View>
            </AuthCard>
          </Reveal>

          {/* Kayıt ol */}
          <Reveal delay={180}>
            <AuthFooterLink
              theme={theme}
              accent={accent}
              text={i18nText("autoI18n.hesabin_yok_mu", "Hesabın yok mu?")}
              link={t.LoginScreen.registerButton}
              onPress={() => navigation.navigate("RegisterScreen")}
            />
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dil değiştirici — sabit sağ üst */}
      <GlassPillButton
        label={language.toUpperCase()}
        icon="globe-outline"
        iconSize={15}
        fontSize={13}
        height={42}
        paddingHorizontal={15}
        gap={6}
        fallbackRadius={21}
        color={theme.text.primary}
        fallbackStyle={{
          backgroundColor: theme.secondary,
          borderColor: hairline,
          borderWidth: 1,
        }}
        style={[styles.languageButton, { top: insets.top + 8 }]}
        onPress={() => toggleLanguage(nextAppLanguage(language))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 20,
  },
  languageButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },

  // ── Marka bloğu ──
  heroIconImage: {
    width: 44,
    height: 44,
  },

  // ── Kayıtlı hesap çipleri ──
  savedBleed: {
    // Yatay kaydırıcı ekran kenarlarına taşar; içerik padding'i hizayı korur.
    // Negatif kenar boşluğu SARMALAYICIDA: içteki kaydırıcı tam genişlikte kalır,
    // Android'de ebeveyn sınırı dışına taşan dokunma kaybı yaşanmaz.
    marginHorizontal: -22,
  },
  // Basılan cam çip kesilmesin: dikey pay GLASS_PRESS_ROOM (dolgu + eşit negatif dış boşluk).
  savedList: {
    flexGrow: 0,
    marginVertical: -GLASS_PRESS_ROOM,
  },
  savedListContent: {
    paddingHorizontal: 22,
    paddingVertical: GLASS_PRESS_ROOM,
    gap: CHIP_GAP,
  },
  savedChip: {
    width: CHIP_W,
    minHeight: 62,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
  },
  savedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  savedAvatarText: {
    fontSize: 17,
    fontWeight: "800",
  },
  savedTextArea: {
    flex: 1,
    minWidth: 0,
  },
  savedLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  savedName: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  savedRemove: {
    padding: 2,
  },
  savedGo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Kart içi ──
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rememberRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  forgotText: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: "700",
  },
  socialStack: {
    gap: 10,
  },
});
