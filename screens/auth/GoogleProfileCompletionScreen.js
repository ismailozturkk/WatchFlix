import { normalizeAppLanguage } from "../../utils/appLanguages";
import { isLightSurface } from "../../utils/colorUtils";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import LensLoader from "../../components/LensLoader";
import { Keys, remove } from "../../services/storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { deleteUser, signOut, updateProfile } from "firebase/auth";
import Toast from "@components/AppToast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import {
  createUserProfile,
  formatUsernameInput,
  isUsernameAvailable,
  isValidUsername,
  normalizeUsername,
  UserProfileErrorCode,
} from "../../services/userService";
import {
  cancelGoogleRegistration,
} from "../../services/googleAuthService";
import { cancelAppleRegistration } from "../../services/appleAuthService";
import { randomAvatarIndex } from "../../utils/avatars";
import { canRegister, MIN_REGISTER_AGE, syncAgeRestriction } from "../../utils/ageGate";
import { i18nText } from "../../utils/i18nText";
import ScreenDecor from "../../components/ScreenDecor";
import BirthDateField from "../../components/auth/BirthDateField";
import LegalConsentNotice from "../../components/auth/LegalConsentNotice";
import GlassTouchable from "../../components/common/GlassTouchable";
import GlassBox from "../../components/common/GlassBox";

export default function GoogleProfileCompletionScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { markProfileCompleted } = useAuth();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const isAppleUser = user?.providerData?.some(
    (provider) => provider.providerId === "apple.com",
  );
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  // E-posta kaydıyla aynı kural: doğum tarihi burada da zorunlu, yoksa Google
  // yolu yaş kapısının etrafından dolaşırdı.
  const [birthDate, setBirthDate] = useState(null);
  const checkId = useRef(0);
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const isLight = isLightSurface(theme.primary);

  useEffect(() => {
    const normalized = normalizeUsername(username);
    const currentCheck = ++checkId.current;
    if (!isValidUsername(normalized)) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        // excludeUid: kendi rezervasyonun sana "alınmış" görünmemeli — yeniden
        // deneme akışında kullanıcı kendi username'ine takılıp kalıyordu.
        const result = await isUsernameAvailable(normalized, {
          excludeUid: user?.uid,
        });
        if (checkId.current === currentCheck) setAvailable(result);
      } catch {
        if (checkId.current === currentCheck) setAvailable(null);
      } finally {
        if (checkId.current === currentCheck) setChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, user?.uid]);

  const usernameNormalized = normalizeUsername(username);
  const usernameValid = isValidUsername(usernameNormalized);

  const canSave = useMemo(
    () =>
      !!user &&
      displayName.trim().length >= 2 &&
      usernameValid &&
      available === true &&
      // E-posta kaydıyla aynı kural: 13 altı hesap açamaz
      // (utils/ageGate.js → MIN_REGISTER_AGE).
      canRegister(birthDate) &&
      !saving,
    [available, birthDate, displayName, saving, user, usernameValid]
  );

  /**
   * 13 altı reddi. Google girişi Auth hesabını ZATEN AÇMIŞ oldu; profil
   * yazılmadığı için ortada yetim bir Auth kaydı kalır. E-posta kaydındaki
   * yetim-hesap temizliğinin aynısı: sil, silinemezse en azından çıkış yap
   * (aksi halde kullanıcı bir daha bu ekrana düşer ve kilitli kalırdı).
   * deleteUser recent-login ister; giriş az önce olduğu için koşul sağlanıyor.
   */
  const rejectUnderage = async () => {
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
    const current = auth.currentUser;
    if (current) {
      await deleteUser(current).catch(() => signOut(auth).catch(() => {}));
    }
    remove(Keys.googleProfilePendingUid);
  };

  const completeProfile = async () => {
    if (!canSave) return;
    // Yaş sınırı ikinci kapı: buton zaten kilitli ama tarih bu arada
    // değişmiş olabilir.
    if (!canRegister(birthDate)) {
      await rejectUnderage();
      return;
    }
    setSaving(true);
    try {
      const cleanName = displayName.trim();
      await createUserProfile({
        uid: user.uid,
        username: usernameNormalized,
        email: user.email,
        displayName: cleanName,
        birthDate,
        // E-posta kaydıyla aynı davranış: yeni hesap rastgele avatarla başlar.
        avatarIndex: randomAvatarIndex(),
        method: isAppleUser ? "apple" : "google",
      });
      // Bu akış oturumu KAPATMIYOR — kullanıcı buradan doğrudan uygulamaya
      // giriyor. Kısıtı profil dinleyicisinin ilk anlık görüntüsüne bırakmak,
      // 18 altı bir hesabın ilk saniyelerini korumasız bırakırdı.
      syncAgeRestriction(birthDate);
      // Profil yazıldı → kapıyı HEMEN aç. Bunu updateProfile'dan sonraya
      // bırakmak, o ağ çağrısı hata aldığında kullanıcıyı tamamlanmış bir
      // profille bu ekrana kalıcı olarak kilitliyordu.
      remove(Keys.googleProfilePendingUid);
      // onAuthStateChanged bu noktada yeniden tetiklenmez; AuthContext'e
      // profilin hazır olduğunu biz söylüyoruz (Lists/{uid} kapısını da açar).
      markProfileCompleted();
      // Auth displayName kozmetik — asıl kaynak Firestore'daki profil.
      // Başarısız olması akışı bloklamamalı.
      updateProfile(user, { displayName: cleanName }).catch(() => {});
      Toast.show({
        type: "success",
        text1: tr ? "Profilin hazır. Hoş geldin!" : es ? "Tu perfil está listo. ¡Te damos la bienvenida!" : pt ? "Seu perfil está pronto. Boas-vindas!" : de ? "Dein Profil ist bereit. Willkommen!" : language === "it" ? "Il tuo profilo è pronto. Benvenuto!" : language === "fr" ? "Ton profil est prêt. Bienvenue !" : language === "ja" ? "プロフィールの準備ができました。ようこそ!" : "Your profile is ready. Welcome!",
      });
      navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
    } catch (error) {
      // Metne regex atmak yerine koda bak; ham Firebase metni ("FirebaseError:
      // Missing or insufficient permissions.") kullanıcıya gösterilmez.
      const taken = error?.code === UserProfileErrorCode.USERNAME_TAKEN;
      if (taken) setAvailable(false);
      Toast.show({
        type: "error",
        text1: tr ? "Profil oluşturulamadı" : es ? "No se pudo crear el perfil" : pt ? "Não foi possível criar o perfil" : de ? "Profil konnte nicht erstellt werden" : language === "it" ? "Impossibile creare il profilo" : language === "fr" ? "Impossible de créer le profil" : language === "ja" ? "プロフィールを作成できませんでした" : "Could not create profile",
        text2: taken
          ? tr ? "Bu kullanıcı adı az önce alındı, başka bir tane dene." : es ? "Alguien acaba de usar ese nombre de usuario; prueba con otro." : pt ? "Alguém acabou de usar esse nome de usuário; tente outro." : de ? "Dieser Benutzername wurde gerade vergeben, versuche einen anderen." : language === "it" ? "Quel nome utente è stato appena preso, provane un altro." : language === "fr" ? "Ce nom d'utilisateur vient d'être pris, essaie-en un autre." : language === "ja" ? "そのユーザー名はたった今使われました。別の名前をお試しください。" : "That username was just taken, try another."
          : tr ? "Bağlantını kontrol edip tekrar dene." : es ? "Revisa tu conexión e inténtalo de nuevo." : pt ? "Verifique sua conexão e tente novamente." : de ? "Prüfe deine Verbindung und versuche es erneut." : language === "it" ? "Controlla la connessione e riprova." : language === "fr" ? "Vérifie ta connexion et réessaie." : language === "ja" ? "接続を確認して、もう一度お試しください。" : "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      if (isAppleUser) await cancelAppleRegistration();
      else await cancelGoogleRegistration();
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="auth" iconOpacity={isLight ? 0.05 : 0.08} />
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.icon,
              { backgroundColor: alpha(theme.accent, 0.14) },
            ]}
          >
            <Ionicons
              name="person-add-outline"
              size={30}
              color={theme.accent}
            />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {tr ? "Seelogd profilini tamamla" : es ? "Completa tu perfil de Seelogd" : pt ? "Complete seu perfil do Seelogd" : de ? "Vervollständige dein Seelogd-Profil" : language === "it" ? "Completa il tuo profilo Seelogd" : language === "fr" ? "Complète ton profil Seelogd" : language === "ja" ? "Seelogdのプロフィールを完成させよう" : "Complete your Seelogd profile"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {tr ? `${isAppleUser ? "Apple" : "Google"} hesabın doğrulandı. Uygulamada görünecek bilgilerini bir kez belirle.` : es ? `Tu cuenta de ${isAppleUser ? "Apple" : "Google"} está verificada. Elige los datos que se mostrarán en la app.` : pt ? `Sua conta ${isAppleUser ? "Apple" : "Google"} está verificada. Escolha os dados que serão mostrados no app.` : de ? `Dein ${isAppleUser ? "Apple" : "Google"}-Konto ist bestätigt. Lege die Angaben fest, die in der App angezeigt werden.` : language === "it" ? `Il tuo account ${isAppleUser ? "Apple" : "Google"} è verificato. Scegli i dettagli visualizzati nell'app.` : language === "fr" ? `Ton compte ${isAppleUser ? "Apple" : "Google"} est vérifié. Choisis les informations affichées dans l'app.` : language === "ja" ? `${isAppleUser ? "Apple" : "Google"}アカウントが確認されました。アプリに表示する情報を選んでください。` : `Your ${isAppleUser ? "Apple" : "Google"} account is verified. Choose the details shown in the app.`}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.googleAccount, { backgroundColor: theme.between }]}
            >
              <View
                style={[
                  styles.googleBadge,
                  isAppleUser && { backgroundColor: "#111111" },
                ]}
              >
                {isAppleUser ? (
                  <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                ) : (
                  <Text style={styles.googleLetter}>G</Text>
                )}
              </View>
              <View style={styles.flex}>
                <Text
                  numberOfLines={1}
                  style={[styles.accountName, { color: theme.text.primary }]}
                >
                  {user?.displayName ||
                    (isAppleUser
                      ? tr ? "Apple hesabı" : es ? "Cuenta de Apple" : pt ? "Conta Apple" : de ? "Apple-Konto" : language === "it" ? "Account Apple" : language === "fr" ? "Compte Apple" : language === "ja" ? "Appleアカウント" : "Apple account"
                      : tr ? "Google hesabı" : es ? "Cuenta de Google" : pt ? "Conta Google" : de ? "Google-Konto" : language === "it" ? "Account Google" : language === "fr" ? "Compte Google" : language === "ja" ? "Googleアカウント" : "Google account")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.accountEmail, { color: theme.text.muted }]}
                >
                  {user?.email}
                </Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={21}
                color={isAppleUser ? theme.accent : "#34A853"}
              />
            </View>

            <Text style={[styles.label, { color: theme.text.muted }]}>
              {tr ? "GÖRÜNEN AD" : es ? "NOMBRE VISIBLE" : pt ? "NOME EXIBIDO" : de ? "ANZEIGENAME" : language === "it" ? "NOME VISUALIZZATO" : language === "fr" ? "NOM AFFICHÉ" : language === "ja" ? "表示名" : "DISPLAY NAME"}
            </Text>
            <GlassBox role="field"
              style={[
                styles.inputShell,
                { backgroundColor: theme.between, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={theme.text.muted}
              />
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={40}
                style={[styles.input, { color: theme.text.primary }]}
                placeholder={tr ? "Adın ve soyadın" : es ? "Tu nombre" : pt ? "Seu nome" : de ? "Dein Name" : language === "it" ? "Il tuo nome" : language === "fr" ? "Ton nom" : language === "ja" ? "あなたの名前" : "Your name"}
                placeholderTextColor={theme.text.muted}
                returnKeyType="next"
              />
            </GlassBox>

            <Text style={[styles.label, { color: theme.text.muted }]}>
              {tr ? "DOĞUM TARİHİ" : es ? "FECHA DE NACIMIENTO" : pt ? "DATA DE NASCIMENTO" : de ? "GEBURTSDATUM" : language === "it" ? "DATA DI NASCITA" : language === "fr" ? "DATE DE NAISSANCE" : language === "ja" ? "生年月日" : "DATE OF BIRTH"}
            </Text>
            <BirthDateField
              value={birthDate}
              onChange={setBirthDate}
              theme={theme}
              accent={theme.accent}
              fieldSurface={theme.between}
            />

            <Text style={[styles.label, { color: theme.text.muted }]}>
              {tr ? "KULLANICI ADI" : es ? "NOMBRE DE USUARIO" : pt ? "NOME DE USUÁRIO" : de ? "BENUTZERNAME" : language === "it" ? "NOMEUTENTE" : language === "fr" ? "NOM D'UTILISATEUR" : language === "ja" ? "ユーザー名" : "USERNAME"}
            </Text>
            <GlassBox role="field"
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.between,
                  borderColor:
                    available === true
                      ? "#34A853"
                      : available === false
                      ? theme.colors.red
                      : theme.border,
                },
              ]}
            >
              <Ionicons name="at-outline" size={18} color={theme.text.muted} />
              <TextInput
                value={username}
                onChangeText={(text) => setUsername(formatUsernameInput(text))}
                style={[styles.input, { color: theme.text.primary }]}
                placeholder={tr ? "benzersiz_kullanici_adi" : es ? "usuario_unico" : pt ? "usuario_unico" : de ? "unique_username" : language === "it" ? "nome_utente_univoco" : language === "fr" ? "nom_unique" : language === "ja" ? "unique_username" : "unique_username"}
                placeholderTextColor={theme.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={completeProfile}
              />
              {checking ? (
                <LensLoader size="small" color={theme.accent} />
              ) : available !== null ? (
                <Ionicons
                  name={available ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={available ? "#34A853" : theme.colors.red}
                />
              ) : null}
            </GlassBox>
            <Text
              style={[
                styles.hint,
                {
                  color:
                    available === false ||
                    (username.length >= 3 && !usernameValid)
                      ? theme.colors.red
                      : available === true
                        ? "#34A853"
                        : theme.text.muted,
                },
              ]}
            >
              {username.length > 0 && username.length < 3
                ? tr ? "En az 3 karakter · yalnızca a–z, 0–9, _" : es ? "Mínimo 3 caracteres · solo a–z, 0–9, _" : pt ? "Mínimo de 3 caracteres · somente a–z, 0–9, _" : de ? "Mindestens 3 Zeichen · nur a–z, 0–9, _" : language === "it" ? "Almeno 3 caratteri · solo a–z, 0–9, _" : language === "fr" ? "Au moins 3 caractères · uniquement a–z, 0–9, _" : language === "ja" ? "3文字以上 · a–z、0–9、_ のみ" : "At least 3 characters · only a–z, 0–9, _"
                : username.length >= 3 && !usernameValid && /^[0-9_]+$/.test(username)
                ? tr ? "Kullanıcı adı sadece rakamlardan veya alt çizgiden oluşamaz (en az bir harf içermelidir)." : es ? "El nombre de usuario no puede ser solo números o guiones bajos (debe contener al menos una letra)." : pt ? "O nome de usuário não pode ser só números ou sublinhados (deve conter pelo menos uma letra)." : de ? "Der Benutzername darf nicht nur aus Zahlen oder Unterstrichen bestehen (mindestens ein Buchstabe ist nötig)." : language === "it" ? "Il nome utente non può essere composto solo da numeri o trattini bassi (deve contenere almeno una lettera)." : language === "fr" ? "Le nom d'utilisateur ne peut pas être composé uniquement de chiffres ou de tirets bas (il doit contenir au moins une lettre)." : language === "ja" ? "ユーザー名を数字やアンダースコアだけにはできません(英字を1文字以上含めてください)。" : "Username cannot be only numbers or underscores (must contain at least one letter)."
                : username.length >= 3 && !usernameValid
                ? tr ? "3–20 karakter; yalnızca küçük harf, sayı ve alt çizgi (en az bir harf)." : es ? "De 3 a 20 caracteres; solo minúsculas, números y guion bajo (al menos una letra)." : pt ? "De 3 a 20 caracteres; somente letras minúsculas, números e sublinhado (pelo menos uma letra)." : de ? "3–20 Zeichen; nur Kleinbuchstaben, Zahlen und Unterstrich (mindestens ein Buchstabe)." : language === "it" ? "3–20 caratteri; solo lettere minuscole, numeri e trattino basso (almeno una lettera)." : language === "fr" ? "3 à 20 caractères ; uniquement des minuscules, chiffres et tirets bas (au moins une lettre)." : language === "ja" ? "3〜20文字。小文字の英字、数字、アンダースコアのみ(英字を1文字以上)。" : "3–20 characters; only lowercase letters, numbers, and underscore (at least one letter)."
                : available === false
                ? tr ? "Bu kullanıcı adı alınmış." : es ? "Este nombre de usuario ya está en uso." : pt ? "Este nome de usuário já está em uso." : de ? "Dieser Benutzername ist vergeben." : language === "it" ? "Questo nome utente è già utilizzato." : language === "fr" ? "Ce nom d'utilisateur est déjà pris." : language === "ja" ? "このユーザー名は使われています。" : "This username is taken."
                : available === true
                ? tr ? "Kullanıcı adı kullanılabilir." : es ? "El nombre de usuario está disponible." : pt ? "O nome de usuário está disponível." : de ? "Benutzername ist verfügbar." : language === "it" ? "Il nome utente è disponibile." : language === "fr" ? "Le nom d'utilisateur est disponible." : language === "ja" ? "このユーザー名は使えます。" : "Username is available."
                : tr ? "3–20 karakter; yalnızca küçük harf, sayı ve alt çizgi (en az bir harf)." : es ? "De 3 a 20 caracteres; solo minúsculas, números y guion bajo (al menos una letra)." : pt ? "De 3 a 20 caracteres; somente letras minúsculas, números e sublinhado (pelo menos uma letra)." : de ? "3–20 Zeichen; nur Kleinbuchstaben, Zahlen und Unterstrich (mindestens ein Buchstabe)." : language === "it" ? "3–20 caratteri; solo lettere minuscole, numeri e trattino basso (almeno una lettera)." : language === "fr" ? "3 à 20 caractères ; uniquement des minuscules, chiffres et tirets bas (au moins une lettre)." : language === "ja" ? "3〜20文字。小文字の英字、数字、アンダースコアのみ(英字を1文字以上)。" : "3–20 characters; only lowercase letters, numbers, and underscore (at least one letter)."}
            </Text>

            {/* Yasal bilgilendirme — e-posta kaydıyla aynı: bu ekran da bir
                kayıt tamamlama noktası, bağlantılar burada da görünmeli. */}
            <LegalConsentNotice theme={theme} accent={theme.accent} />

            <GlassTouchable
              disabled={!canSave}
              onPress={completeProfile}
              style={[
                styles.primary,
                { backgroundColor: theme.accent },
                !canSave && styles.disabled,
              ]}
            >
              {saving ? (
                <LensLoader tone="mono" color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryText}>
                    {tr ? "Profili oluştur" : es ? "Crear perfil" : pt ? "Criar perfil" : de ? "Profil erstellen" : language === "it" ? "Crea profilo" : language === "fr" ? "Créer le profil" : language === "ja" ? "プロフィールを作成" : "Create profile"}
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </>
              )}
            </GlassTouchable>
            <TouchableOpacity
              disabled={saving}
              onPress={cancel}
              style={styles.cancel}
            >
              <Text style={[styles.cancelText, { color: theme.text.muted }]}>
                {tr ? "Başka hesap kullan" : es ? "Usar otra cuenta" : pt ? "Usar outra conta" : de ? "Anderes Konto verwenden" : language === "it" ? "Utilizza un altro account" : language === "fr" ? "Utiliser un autre compte" : language === "ja" ? "別のアカウントを使う" : "Use another account"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    alignItems: "center",
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  googleAccount: {
    minHeight: 62,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  googleBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLetter: { color: "#4285F4", fontSize: 18, fontWeight: "900" },
  accountName: { fontSize: 14, fontWeight: "800" },
  accountEmail: { fontSize: 11.5, marginTop: 2 },
  label: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 5,
    marginLeft: 3,
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
  input: { flex: 1, fontSize: 14.5, fontWeight: "700", paddingVertical: 12 },
  hint: { fontSize: 11, fontWeight: "600", marginLeft: 4 },
  primary: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cancel: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 13, fontWeight: "700" },
});
