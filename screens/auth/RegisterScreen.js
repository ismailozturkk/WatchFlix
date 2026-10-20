import { isLightSurface } from "../../utils/colorUtils";
// Kayıt ekranı — ortak auth görsel dili (components/auth/AuthKit.js): accent'ten
// türeyen arka plan ışıması, halkalı rozet, vurgu çizgili tek kart, bölüm
// etiketleriyle gruplanmış alanlar (kişisel / hesap / güvenlik) ve degrade ana
// düğme. Doğrulama, Firebase ve klavye akışı değişmedi — yalnız görünüm.
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React, { useEffect, useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "@services/hapticsService";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
  updateProfile,
} from "firebase/auth";
import Toast from "@components/AppToast";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createUserProfile,
  formatUsernameInput,
  isUsernameAvailable,
  isValidUsername,
  normalizeUsername,
  UserProfileErrorCode,
} from "../../services/userService";
import ScreenDecor from "../../components/ScreenDecor";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import BirthDateField from "../../components/auth/BirthDateField";
import LegalConsentNotice from "../../components/auth/LegalConsentNotice";
import {
  AUTH_ERROR as ERROR,
  AUTH_SUCCESS as SUCCESS,
  AUTH_WARN,
  AuthAppleButton,
  AuthBackButton,
  AuthBackdrop,
  AuthBadge,
  AuthCard,
  AuthDivider,
  AuthEyeToggle,
  AuthField,
  AuthFooterLink,
  AuthGoogleButton,
  AuthHero,
  AuthPrimaryButton,
  AuthSectionLabel,
  Reveal,
  authColumn,
} from "../../components/auth/AuthKit";
import { canRegister, MIN_REGISTER_AGE } from "../../utils/ageGate";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  signInWithGoogle as authenticateWithGoogle,
} from "../../services/googleAuthService";
import { i18nText } from "../../utils/i18nText";
import { randomAvatarIndex } from "../../utils/avatars";
import {
  AppleAuthCode,
  describeAppleAuthError,
  isAppleAuthenticationAvailable,
  signInWithApple,
} from "../../services/appleAuthService";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// Parola gücü: yalnız uzunluğa bakan eski ölçüt aynen korunuyor; fark, yanan
// çubukların HEPSİNİN etiketle aynı renkte olması (eskiden "Orta" iki kırmızı
// çubukla gösteriliyordu).
const strengthOf = (length) => {
  if (length < 6) {
    return { level: 1, color: ERROR, label: i18nText("autoI18n.zayif", "Zayıf") };
  }
  if (length < 9) {
    return { level: 2, color: AUTH_WARN, label: i18nText("autoI18n.orta", "Orta") };
  }
  if (length < 12) {
    return { level: 3, color: "#8BC34A", label: i18nText("autoI18n.iyi", "İyi") };
  }
  return { level: 4, color: SUCCESS, label: i18nText("autoI18n.guclu", "Güçlü") };
};

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = theme.accent;
  const isLightTheme = isLightSurface(theme.primary);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  // Doğum tarihi — seçici yalnız var olan tarihleri üretiyor, ayrıca biçim
  // doğrulaması gerekmiyor: değer ya null ya geçerli bir ISO.
  const [birthDate, setBirthDate] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordAgain, setShowPasswordAgain] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const { t, language } = useLanguage();

  const [passwordCorrect, setPasswordCorrect] = useState(null);
  const [passwordCorrectAgain, setPasswordCorrectAgain] = useState(null);

  useEffect(() => {
    isAppleAuthenticationAvailable().then(setIsAppleAvailable);
  }, []);

  // Klavye akışı: isim → soyisim → kullanıcı adı → e-posta → şifre → tekrar.
  // Doğum tarihi bu zincirin dışında: klavyeyle değil dokunmayla açılan bir
  // sayfa; "ileri" tuşunun altından modal açmak akışı kesip şaşırtıyor.
  const lastnameRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const passwordAgainRef = useRef(null);

  // Basit e-posta biçim kontrolü (boşken nötr)
  const emailValid = email.length === 0 ? null : /^\S+@\S+\.\S+$/.test(email);
  const usernameValid = isValidUsername(username);
  const usernameChecking =
    username.length >= 3 && usernameValid && usernameAvailable === null;
  const canSubmit =
    name.trim().length > 0 &&
    lastname.trim().length > 0 &&
    // 18 altı olmak kaydı ENGELLEMEZ (yalnız yetişkin içerik kapanır), ama
    // 13 altı engeller — bkz. utils/ageGate.js → MIN_REGISTER_AGE.
    canRegister(birthDate) &&
    usernameValid &&
    usernameAvailable === true &&
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

  const handleUsernameChange = (text) => {
    const clean = formatUsernameInput(text);
    setUsername(clean);
    if (!clean || clean.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    if (!isValidUsername(clean)) {
      setUsernameAvailable(false);
      return;
    }
    setUsernameAvailable(null);
    if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current);
    usernameTimeoutRef.current = setTimeout(() => {
      checkUsername(clean);
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
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername || cleanUsername.length < 3) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.lutfen_kullanici_adini_duzenleyiniz", "Lütfen kullanıcı adını düzenleyiniz!"),
      });
      return;
    }
    if (!isValidUsername(cleanUsername)) {
      const isAllDigits = /^[0-9]+$/.test(cleanUsername);
      Toast.show({
        type: "error",
        text1: isAllDigits
          ? (language === "tr" ? "Kullanıcı adı sadece rakamlardan oluşamaz (en az bir harf içermelidir)." : language === "es" ? "El nombre de usuario no puede ser solo números (debe contener al menos una letra)." : language === "pt" ? "O nome de usuário não pode ser só números (deve conter pelo menos uma letra)." : language === "de" ? "Der Benutzername darf nicht nur aus Zahlen bestehen (mindestens ein Buchstabe ist nötig)." : "Username cannot consist only of numbers (must contain at least one letter).")
          : i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)"),
      });
      return;
    }
    if (usernameChecking || usernameAvailable === null) {
      Toast.show({
        type: "info",
        text1: language === "tr" ? "Kullanıcı adı kontrol ediliyor, lütfen bekleyin..." : language === "es" ? "Comprobando la disponibilidad del nombre de usuario, espera un momento..." : language === "pt" ? "Verificando a disponibilidade do nome de usuário, aguarde um instante..." : language === "de" ? "Verfügbarkeit des Benutzernamens wird geprüft, bitte warten..." : "Checking username availability, please wait...",
      });
      return;
    }
    if (usernameAvailable !== true) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.bu_kullanici_adi_alinmis", "Bu kullanıcı adı alınmış!") });
      return;
    }
    if (!name || !lastname) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.lutfen_isim_ve_soyisim_giriniz", "Lütfen isim ve soyisim giriniz!") });
      return;
    }
    if (!birthDate) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.dogum_tarihini_sec", "Doğum tarihini seç"),
      });
      return;
    }
    // Metin SUÇLAYICI DEĞİL: kullanıcı bir kural çiğnemedi, uygulama onun yaş
    // grubuna uygun değil. Yaşı da tekrarlamıyoruz.
    if (!canRegister(birthDate)) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.yas_siniri_basligi", "Bu uygulama {{age}} yaş ve üzeri için", {
          age: MIN_REGISTER_AGE,
        }),
        text2: i18nText(
          "autoI18n.yas_siniri_aciklama",
          "Girdiğin doğum tarihiyle hesap açılamıyor.",
        ),
      });
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
        username: cleanUsername,
        email,
        displayName,
        birthDate,
        // Yeni hesaba rastgele avatar: herkes 0 numaralı görselle başlamasın.
        // Kullanıcı Profil ekranından dilediği zaman değiştirebiliyor.
        avatarIndex: randomAvatarIndex(),
        method: "email",
      });
      profileCreated = true;
      // NOT: yaş kısıtı burada UYGULANMAZ. Bu akış birkaç satır aşağıda
      // signOut'a gidiyor, o da oturum deposunu (dolayısıyla kısıt bayrağını)
      // temizliyor. Kısıt, kullanıcı gerçekten giriş yaptığında profilden
      // türetiliyor — bkz. context/UserProfileContext.js.

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
          : language === "tr" ? "Hesabın oluşturuldu. Doğrulama e-postasını giriş ekranından yeniden gönderebilirsin." : language === "es" ? "Tu cuenta se ha creado. Puedes reenviar la verificación desde la pantalla de inicio de sesión." : language === "pt" ? "Sua conta foi criada. Você pode reenviar a verificação pela tela de login." : language === "de" ? "Dein Konto wurde erstellt. Du kannst die Bestätigung auf dem Anmeldebildschirm erneut senden." : "Your account was created. You can resend verification from the sign-in screen.",
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
          ? language === "tr" ? "Bu e-posta ile zaten bir hesap var. Mevcut giriş yöntemini kullan; Google hesabıysan Google ile giriş yap." : language === "es" ? "Ya existe una cuenta con este correo. Usa su método de inicio de sesión actual; si es una cuenta de Google, inicia sesión con Google." : language === "pt" ? "Já existe uma conta com este e-mail. Use o método de login atual dela; se for uma conta do Google, entre com o Google." : language === "de" ? "Ein Konto verwendet diese E-Mail-Adresse bereits. Nutze die bisherige Anmeldemethode; bei einem Google-Konto melde dich mit Google an." : "An account already uses this email. Use its existing sign-in method; if it is a Google account, sign in with Google."
          : error?.code === UserProfileErrorCode.USERNAME_TAKEN
          ? language === "tr" ? "Bu kullanıcı adı az önce alındı. Başka bir kullanıcı adı dene." : language === "es" ? "Alguien acaba de usar ese nombre de usuario. Prueba con otro." : language === "pt" ? "Alguém acabou de usar esse nome de usuário. Tente outro." : language === "de" ? "Dieser Benutzername wurde gerade vergeben. Versuche einen anderen." : "That username was just taken. Try another username."
          : error?.code === "auth/invalid-email"
          ? language === "tr" ? "Geçerli bir e-posta adresi gir." : language === "es" ? "Introduce un correo electrónico válido." : language === "pt" ? "Digite um e-mail válido." : language === "de" ? "Gib eine gültige E-Mail-Adresse ein." : "Enter a valid email address."
          : error?.code === "auth/weak-password"
          ? language === "tr" ? "Daha güçlü bir şifre belirle." : language === "es" ? "Elige una contraseña más segura." : language === "pt" ? "Escolha uma senha mais segura." : language === "de" ? "Wähle ein stärkeres Passwort." : "Choose a stronger password."
          : language === "tr" ? "Kayıt tamamlanamadı. Bağlantını kontrol edip tekrar dene." : language === "es" ? "No se pudo completar el registro. Revisa tu conexión e inténtalo de nuevo." : language === "pt" ? "Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente." : language === "de" ? "Die Registrierung konnte nicht abgeschlossen werden. Prüfe deine Verbindung und versuche es erneut." : "Registration could not be completed. Check your connection and try again.";
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
    if (isGoogleLoading || isAppleLoading) return;
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
        text2: describeGoogleAuthError(error, language),
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const registerWithApple = async () => {
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
        text1: language === "tr" ? "Apple ile kayıt başarısız" : language === "es" ? "No se pudo registrar con Apple" : language === "pt" ? "Não foi possível cadastrar com a Apple" : language === "de" ? "Registrierung mit Apple fehlgeschlagen" : "Sign up with Apple failed",
        text2: describeAppleAuthError(error, language),
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const fieldSurface = theme.between;
  const socialBusy = isAppleLoading || isGoogleLoading;
  const strength = password.length > 0 ? strengthOf(password.length) : null;
  const goLogin = () => navigation.navigate("LoginScreen");

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
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 36 },
          ]}
        >
          {/* Başlık bloğu */}
          <Reveal>
            <AuthHero
              theme={theme}
              badge={
                <AuthBadge accent={accent} surface={theme.secondary} size={68}>
                  <Ionicons name="person-add-outline" size={30} color={accent} />
                </AuthBadge>
              }
              title={i18nText("autoI18n.yeni_hesap_olustur", "Yeni hesap oluştur")}
              subtitle={i18nText(
                "autoI18n.profilini_olusturup_listelerine_basla",
                "Profilini oluşturup listelerine başla.",
              )}
            />
          </Reveal>

          {/* Kart */}
          <Reveal delay={90} style={authColumn}>
            <AuthCard theme={theme} accent={accent}>
              {/* ── Kişisel bilgiler ── */}
              <AuthSectionLabel theme={theme} accent={accent}>
                {i18nText("autoI18n.kisisel_bilgiler", "KİŞİSEL BİLGİLER")}
              </AuthSectionLabel>

              {/* İsim + Soyisim — yan yana */}
              <View style={styles.rowInputs}>
                <AuthField
                  theme={theme}
                  accent={accent}
                  fieldSurface={fieldSurface}
                  containerStyle={styles.halfInput}
                  placeholder={t.RegisterScreen.name}
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastnameRef.current?.focus()}
                  onChangeText={setName}
                  maxLength={30}
                />
                <AuthField
                  ref={lastnameRef}
                  theme={theme}
                  accent={accent}
                  fieldSurface={fieldSurface}
                  containerStyle={styles.halfInput}
                  placeholder={t.RegisterScreen.lastName}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  onChangeText={setLastname}
                  maxLength={30}
                />
              </View>

              {/* Doğum tarihi — yetişkin içerik kapısı buna bakıyor */}
              <BirthDateField
                value={birthDate}
                onChange={setBirthDate}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                chipIcon
                shellStyle={styles.birthShell}
              />

              {/* ── Hesap bilgileri ── */}
              <AuthSectionLabel theme={theme} accent={accent}>
                {i18nText("autoI18n.hesap_bilgileri", "HESAP BİLGİLERİ")}
              </AuthSectionLabel>

              {/* Kullanıcı adı */}
              <AuthField
                ref={usernameRef}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="at-outline"
                state={usernameAvailable}
                value={username}
                inputStyle={{
                  color: usernameAvailable === false ? ERROR : theme.text.primary,
                  textDecorationLine:
                    usernameAvailable === false && !usernameValid ? "line-through" : "none",
                }}
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
                right={
                  <>
                    {usernameChecking && <ActivityIndicator size="small" color={accent} />}
                    {usernameAvailable === true && (
                      <Ionicons name="checkmark-circle" size={20} color={SUCCESS} />
                    )}
                    {usernameAvailable === false && (
                      <Ionicons name="close-circle" size={20} color={ERROR} />
                    )}
                  </>
                }
              />
              {username.length > 0 && username.length < 3 && (
                <Text style={[styles.hintText, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.en_az_3_karakter_yalnizca_a_z_0_9", "En az 3 karakter · yalnızca a–z, 0–9, _")}
                </Text>
              )}
              {username.length >= 3 && !usernameValid && /^[0-9_]+$/.test(username) && (
                <Text style={[styles.hintText, { color: ERROR }]}>
                  {language === "tr" ? "Kullanıcı adı sadece rakamlardan veya alt çizgiden oluşamaz (en az bir harf içermelidir)." : language === "es" ? "El nombre de usuario no puede ser solo números o guiones bajos (debe contener al menos una letra)." : language === "pt" ? "O nome de usuário não pode ser só números ou sublinhados (deve conter pelo menos uma letra)." : language === "de" ? "Der Benutzername darf nicht nur aus Zahlen oder Unterstrichen bestehen (mindestens ein Buchstabe ist nötig)." : "Username cannot be only numbers or underscores (must contain at least one letter)."}
                </Text>
              )}
              {username.length >= 3 && !usernameValid && !/^[0-9_]+$/.test(username) && (
                <Text style={[styles.hintText, { color: ERROR }]}>
                  {i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)")}
                </Text>
              )}
              {usernameAvailable === false && usernameValid && (
                <Text style={[styles.hintText, { color: ERROR }]}>
                  {i18nText("autoI18n.bu_kullanici_adi_alinmis", "Bu kullanıcı adı alınmış!")}
                </Text>
              )}

              {/* E-posta */}
              <AuthField
                ref={emailRef}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="mail-outline"
                state={emailValid}
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
              />

              {/* Hızlı e-posta soneki önerileri */}
              <EmailSuffixRow
                email={email}
                onApply={setEmail}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
              />

              {/* ── Güvenlik ── */}
              <AuthSectionLabel theme={theme} accent={accent}>
                {i18nText("autoI18n.kayit_bolum_guvenlik", "GÜVENLİK")}
              </AuthSectionLabel>

              {/* Şifre */}
              <AuthField
                ref={passwordRef}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="lock-closed-outline"
                state={passwordCorrect}
                placeholder={t.RegisterScreen.password}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordAgainRef.current?.focus()}
                onChangeText={inputPassword}
                maxLength={128}
                right={
                  <AuthEyeToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    theme={theme}
                  />
                }
              />

              {/* Şifre gücü göstergesi */}
              {strength && (
                <View style={styles.strengthRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i < strength.level ? strength.color : theme.border },
                      ]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}
              {passwordCorrect === false && (
                <Text style={[styles.hintText, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.sifre_en_az_6_karakter", "En az 6 karakter olmalı")}
                </Text>
              )}

              {/* Şifre Tekrar */}
              <AuthField
                ref={passwordAgainRef}
                theme={theme}
                accent={accent}
                fieldSurface={fieldSurface}
                icon="shield-checkmark-outline"
                state={passwordCorrectAgain}
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
                right={
                  <AuthEyeToggle
                    visible={showPasswordAgain}
                    onToggle={() => setShowPasswordAgain(!showPasswordAgain)}
                    theme={theme}
                  />
                }
              />

              {/* Şifre eşleşme uyarısı — yalnız renkle değil metinle de bildir */}
              {passwordCorrectAgain === false && (
                <Text style={[styles.hintText, { color: ERROR }]}>
                  {i18nText("autoI18n.sifreler_eslesmiyor", "Şifreler eşleşmiyor")}
                </Text>
              )}

              {/* Yasal bilgilendirme — kayıt butonunun HEMEN üstünde durmalı
                  (mağaza denetiminde "satın alma/kayıt noktasında görünür" şartı). */}
              <View style={styles.legalWrap}>
                <LegalConsentNotice theme={theme} accent={accent} />
              </View>

              {/* Kayıt ol butonu */}
              <AuthPrimaryButton
                label={t.RegisterScreen.registerButton}
                accent={accent}
                enabled={canSubmit}
                loading={isloading}
                onPress={() => {
                  buzz();
                  createAccount();
                }}
              />

              {/* veya */}
              <AuthDivider theme={theme} label={i18nText("autoI18n.veya", "veya")} />

              <View style={styles.socialStack}>
                {isAppleAvailable ? (
                  <AuthAppleButton
                    label={i18nText("autoI18n.apple_ile_kayit_ol", "Apple ile kayıt ol")}
                    theme={theme}
                    loading={isAppleLoading}
                    disabled={socialBusy}
                    onPress={() => {
                      buzz();
                      registerWithApple();
                    }}
                  />
                ) : null}

                {/* Google ile kayıt */}
                <AuthGoogleButton
                  label={i18nText("autoI18n.google_ile_kayit_ol", "Google ile kayıt ol")}
                  theme={theme}
                  loading={isGoogleLoading}
                  disabled={socialBusy}
                  onPress={() => {
                    buzz();
                    signInWithGoogle();
                  }}
                />
              </View>
            </AuthCard>
          </Reveal>

          {/* Giriş yap */}
          <Reveal delay={170}>
            <AuthFooterLink
              theme={theme}
              accent={accent}
              text={i18nText("autoI18n.zaten_hesabin_var_mi", "Zaten hesabın var mı?")}
              link={t.RegisterScreen.loginButton}
              onPress={goLogin}
            />
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Geri — sabit sol üst */}
      <AuthBackButton onPress={goLogin} theme={theme} top={insets.top + 8} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 22,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  birthShell: {
    minHeight: 58,
    borderRadius: 18,
    paddingLeft: 12,
  },
  hintText: {
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: -8,
    marginLeft: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
    minWidth: 40,
  },
  // LegalConsentNotice kendi alt boşluğunu taşıyor (diğer ekranlarla paylaşımlı);
  // kart satır aralığıyla birleşince fazla açılmasın.
  legalWrap: {
    marginBottom: -10,
  },
  socialStack: {
    gap: 10,
  },
});
