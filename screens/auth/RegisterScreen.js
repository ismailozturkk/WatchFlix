// Kayıt ekranı — IslamicGuide auth tasarım diline göre sadeleştirildi:
// dikeyde ortalanmış düzen, rozetli başlık bloğu, solid yüzeyli tek kart,
// dolgulu input kabukları ve solid accent ana buton. Blur/gradyan yok.
import {
  ActivityIndicator,
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
import React, { useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import * as Haptics from "@services/hapticsService";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
  updateProfile,
} from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createUserProfile,
  isUsernameAvailable,
  UserProfileErrorCode,
} from "../../services/userService";
import ScreenDecor from "../../components/ScreenDecor";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import { alpha } from "../../theme/colors";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  signInWithGoogle as authenticateWithGoogle,
} from "../../services/googleAuthService";
import { i18nText } from "../../utils/i18nText";
import { randomAvatarIndex } from "../../utils/avatars";

const SUCCESS = "rgb(37, 211, 102)";
const ERROR = "rgb(189, 8, 28)";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export default function RegisterScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = selectedTheme === "light" || selectedTheme === "green";
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
  const { t, language } = useLanguage();

  const [passwordCorrect, setPasswordCorrect] = useState(null);
  const [passwordCorrectAgain, setPasswordCorrectAgain] = useState(null);

  // Klavye akışı: isim → soyisim → kullanıcı adı → e-posta → şifre → tekrar
  const lastnameRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const passwordAgainRef = useRef(null);

  // Basit e-posta biçim kontrolü (boşken nötr)
  const emailValid = email.length === 0 ? null : /^\S+@\S+\.\S+$/.test(email);
  const usernameChecking = username.length >= 3 && usernameAvailable === null;
  const canSubmit =
    name.trim().length > 0 &&
    lastname.trim().length > 0 &&
    username.length >= 3 &&
    usernameAvailable !== false &&
    emailValid === true &&
    passwordCorrect === true &&
    passwordCorrectAgain === true;

  // ref: düz değişken her render'da sıfırlanıyordu → debounce hiç iptal
  // edilmiyor, her tuş vuruşu ayrı Firestore sorgusu atıyor ve en son DÖNEN
  // (en son YAZILAN değil) yanıt kazanıyordu. reqId eski yanıtı düşürür.
  const usernameTimeoutRef = useRef(null);
  const usernameReqRef = useRef(0);

  const checkUsername = async (name) => {
    const reqId = ++usernameReqRef.current;
    try {
      // Atomic check via Usernames/{lower} doc presence
      const available = await isUsernameAvailable(name);
      if (reqId === usernameReqRef.current) setUsernameAvailable(available);
    } catch (e) {
      // Offline vs. — spinner'da (null) takılı bırakma; kayıt anında
      // createUserProfile zaten atomik kontrol yapıyor.
      if (reqId === usernameReqRef.current) setUsernameAvailable(true);
    }
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
    if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current);
    usernameTimeoutRef.current = setTimeout(() => {
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
    if (isloading) return; // çift dokunma koruması
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
    let createdUser = null;
    let profileCreated = false;
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      createdUser = user;
      const displayName = `${name.trim()} ${lastname.trim()}`;
      await updateProfile(user, {
        displayName,
      });

      // Atomic profile + username reservation (transaction).
      // Çakışırsa createUserProfile throw eder → catch'e düşer, user'a hata.
      await createUserProfile({
        uid: user.uid,
        username,
        email,
        displayName,
        // Yeni hesaba rastgele avatar: herkes 0 numaralı görselle başlamasın.
        // Kullanıcı Profil ekranından dilediği zaman değiştirebiliyor.
        avatarIndex: randomAvatarIndex(),
        method: "email",
      });
      profileCreated = true;

      // Profil olusmadan once verification gondermiyoruz. Profil transaction'i
      // duserse Auth kullanicisini silebilir ve e-postayi kilitlemeyiz.
      let verificationSent = true;
      try {
        await sendEmailVerification(user);
      } catch {
        verificationSent = false;
      }

      // Kayit ekrani Firebase'de otomatik oturum acar. Kullanici emailini
      // dogrulamadan uygulamaya sizmasin; basarili kayittan sonra giris ekranina
      // temiz bir oturumla don.
      await signOut(auth);

      Toast.show({
        type: verificationSent ? "success" : "info",
        text1: verificationSent
          ? i18nText("autoI18n.registration_success_verify_email", "{{username}} olarak kayıt başarılı! Email doğrulaması gönderildi: {{email}}", {
              username,
              email,
            })
          : language === "tr"
          ? "Hesabın oluşturuldu. Doğrulama e-postasını giriş ekranından yeniden gönderebilirsin."
          : "Your account was created. You can resend verification from the sign-in screen.",
      });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (error) {
      // Auth olustu ama profil transaction'i tamamlanmadiysa yetim hesabi sil.
      // Aksi halde ayni e-posta sonraki denemelerde kalici olarak "kullanimda"
      // gorunur. deleteUser yeni giris oldugu icin recent-login kosulunu saglar.
      if (createdUser && !profileCreated) {
        await deleteUser(createdUser).catch(() => signOut(getAuth()).catch(() => {}));
      }
      const message =
        error?.code === "auth/email-already-in-use"
          ? language === "tr"
            ? "Bu e-posta ile zaten bir hesap var. Mevcut giriş yöntemini kullan; Google hesabıysan Google ile giriş yap."
            : "An account already uses this email. Use its existing sign-in method; if it is a Google account, sign in with Google."
          : error?.code === UserProfileErrorCode.USERNAME_TAKEN
          ? language === "tr"
            ? "Bu kullanıcı adı az önce alındı. Başka bir kullanıcı adı dene."
            : "That username was just taken. Try another username."
          : error?.code === "auth/invalid-email"
          ? language === "tr"
            ? "Geçerli bir e-posta adresi gir."
            : "Enter a valid email address."
          : error?.code === "auth/weak-password"
          ? language === "tr"
            ? "Daha güçlü bir şifre belirle."
            : "Choose a stronger password."
          : language === "tr"
          ? "Kayıt tamamlanamadı. Bağlantını kontrol edip tekrar dene."
          : "Registration could not be completed. Check your connection and try again.";
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.kayit_sirasinda_hata_olustu", "Kayıt sırasında hata oluştu"),
        text2: message,
      });
    } finally {
      setIsloading(false);
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const signInWithGoogle = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      const result = await authenticateWithGoogle();
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

  const fieldSurface = theme.between;

  // Input kabuğu arka planı: odaktayken hafif accent tonu
  const shellBg = (field) =>
    focusedField === field ? alpha(accent, 0.08) : fieldSurface;

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <ScreenDecor iconOpacity={isLightTheme ? 0.05 : 0.08} />


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
          {/* Başlık bloğu */}
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
              <Ionicons name="person-add-outline" size={28} color={accent} />
            </View>
            <Text allowFontScaling={false} style={[styles.brandTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.yeni_hesap_olustur", "Yeni hesap oluştur")}
            </Text>
            <Text allowFontScaling={false} style={[styles.brandSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.profilini_olusturup_listelerine_basla", "Profilini oluşturup listelerine başla.")}
            </Text>
          </View>

          {/* Kart */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.secondary, borderColor: hairline },
            ]}
          >
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: theme.text.primary }]}>
              {t.RegisterScreen.registerButton}
            </Text>
            <Text allowFontScaling={false} style={[styles.cardSub, { color: theme.text.muted }]}>
              {i18nText("autoI18n.hesap_bilgilerini_tamamla", "Hesap bilgilerini tamamla.")}
            </Text>

            {/* İsim + Soyisim — yan yana */}
            <View style={styles.rowInputs}>
              <View
                style={[
                  styles.inputShell,
                  styles.halfInput,
                  {
                    backgroundColor: shellBg("name"),
                    borderColor: getBorderColor("name", null),
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={getIconColor("name", null)}
                />
                <TextInput
                  allowFontScaling={false}
                  style={[styles.textInput, { color: theme.text.primary }]}
                  placeholder={t.RegisterScreen.name}
                  placeholderTextColor={theme.text.muted}
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastnameRef.current?.focus()}
                  onChangeText={setName}
                  maxLength={30}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View
                style={[
                  styles.inputShell,
                  styles.halfInput,
                  {
                    backgroundColor: shellBg("lastname"),
                    borderColor: getBorderColor("lastname", null),
                  },
                ]}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color={getIconColor("lastname", null)}
                />
                <TextInput
                  ref={lastnameRef}
                  allowFontScaling={false}
                  style={[styles.textInput, { color: theme.text.primary }]}
                  placeholder={t.RegisterScreen.lastName}
                  placeholderTextColor={theme.text.muted}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  onChangeText={setLastname}
                  maxLength={30}
                  onFocus={() => setFocusedField("lastname")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Kullanıcı adı */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: shellBg("username"),
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
              />
              <TextInput
                ref={usernameRef}
                allowFontScaling={false}
                style={[
                  styles.textInput,
                  {
                    color:
                      usernameAvailable === false ? ERROR : theme.text.primary,
                    textDecorationLine:
                      usernameAvailable === false ? "line-through" : "none",
                  },
                ]}
                placeholderTextColor={theme.text.muted}
                placeholder={i18nText("autoI18n.kullanici_adi", "Kullanıcı Adı")}
                onChangeText={handleUsernameChange}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                textContentType="username"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
              />
              {usernameChecking && (
                <ActivityIndicator size="small" color={accent} />
              )}
              {usernameAvailable === true && (
                <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
              )}
              {usernameAvailable === false && (
                <Ionicons name="close-circle" size={18} color={ERROR} />
              )}
            </View>
            {usernameAvailable === null &&
              username.length > 0 &&
              username.length < 3 && (
                <Text style={[styles.hintText, { color: theme.text.muted }]}>{i18nText("autoI18n.en_az_3_karakter_yalnizca_a_z_0_9", "En az 3 karakter · yalnızca a–z, 0–9, _")}</Text>
              )}

            {/* E-posta */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: shellBg("email"),
                  borderColor: getBorderColor("email", emailValid),
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={getIconColor("email", emailValid)}
              />
              <TextInput
                ref={emailRef}
                allowFontScaling={false}
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholderTextColor={theme.text.muted}
                placeholder={t.RegisterScreen.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                onChangeText={setEmail}
                maxLength={254}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
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
                  backgroundColor: shellBg("password"),
                  borderColor: getBorderColor("password", passwordCorrect),
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={getIconColor("password", passwordCorrect)}
              />
              <TextInput
                ref={passwordRef}
                allowFontScaling={false}
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholderTextColor={theme.text.muted}
                placeholder={t.RegisterScreen.password}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordAgainRef.current?.focus()}
                onChangeText={inputPassword}
                maxLength={128}
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
                styles.inputShell,
                {
                  backgroundColor: shellBg("passwordAgain"),
                  borderColor: getBorderColor(
                    "passwordAgain",
                    passwordCorrectAgain,
                  ),
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={getIconColor("passwordAgain", passwordCorrectAgain)}
              />
              <TextInput
                ref={passwordAgainRef}
                allowFontScaling={false}
                style={[styles.textInput, { color: theme.text.primary }]}
                placeholderTextColor={theme.text.muted}
                placeholder={t.RegisterScreen.passwordAgain}
                secureTextEntry={!showPasswordAgain}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSubmit) createAccount();
                }}
                onChangeText={inputPasswordAgain}
                maxLength={128}
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

            {/* Şifre eşleşme uyarısı — yalnız renkle değil metinle de bildir */}
            {passwordCorrectAgain === false && (
              <Text style={[styles.hintText, { color: ERROR }]}>
                {i18nText("autoI18n.sifreler_eslesmiyor", "Şifreler eşleşmiyor")}
              </Text>
            )}

            {/* Şifre gücü göstergesi */}
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

            {/* Kayıt ol butonu — solid accent */}
            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.primaryButton,
                { backgroundColor: accent, shadowColor: accent },
                !canSubmit && { opacity: 0.55 },
              ]}
              onPress={() => {
                buzz();
                createAccount();
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
                    {t.RegisterScreen.registerButton}
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

            {/* Google ile kayıt */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                { backgroundColor: fieldSurface, borderColor: hairline },
              ]}
              onPress={() => {
                buzz();
                signInWithGoogle();
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
                  >{i18nText("autoI18n.google_ile_kayit_ol", "Google ile kayıt ol")}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Giriş yap */}
            <View style={styles.footerRow}>
              <Text allowFontScaling={false} style={[styles.footerText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.zaten_hesabin_var_mi", "Zaten hesabın var mı?")}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate("LoginScreen")}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text allowFontScaling={false} style={[styles.footerLink, { color: accent }]}>
                  {t.RegisterScreen.loginButton}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Geri — sabit sol üst */}
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

  // ── Başlık bloğu ──
  heroMark: {
    alignItems: "center",
    gap: 8,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  brandSub: {
    maxWidth: 320,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
  },

  // ── Kart ──
  card: {
    width: "100%",
    maxWidth: 440,
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
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
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
  hintText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: -6,
    marginLeft: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -4,
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
