import { normalizeAppLanguage } from "../../../utils/appLanguages";
import { isLightSurface } from "@utils/colorUtils";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useAuth } from "../../../context/AuthContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import { useProfileUi } from "../../../context/ProfileUiContext";
import {
  clampAvatarIndex,
  CUSTOM_AVATAR_INDEX,
} from "../../../utils/avatars";
import {
  formatUsernameInput,
  isValidUsername,
  isUsernameAvailable,
  normalizeUsername,
} from "../../../services/userService";
import {
  DeleteAccountCode,
  deleteAccount,
  getSignInMethods,
  reauthenticateForDeletion,
} from "../../../services/accountService";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
} from "../../../services/googleAuthService";
import {
  AppleAuthCode,
  describeAppleAuthError,
} from "../../../services/appleAuthService";
import { propagateProfileChange } from "../../../services/profilePropagation";
import { i18nText } from "../../../utils/i18nText";
import ScreenDecor from "../../../components/ScreenDecor";
import BirthDateField from "../../../components/auth/BirthDateField";
import { MIN_ADULT_AGE, calculateAge, syncAgeRestriction } from "../../../utils/ageGate";
import {
  isNearLimit,
  isProfileEditDirty,
  usernameFieldState,
} from "../../../utils/profileEdit";
import {
  AUTH_ERROR,
  AUTH_SUCCESS,
  AUTH_WARN,
  AuthBackdrop,
  AuthField,
  AuthSectionLabel,
  Reveal,
  authColumn,
} from "../../../components/auth/AuthKit";
import {
  DangerRow,
  DeleteAccountSheet,
  EditHeader,
  FieldBlock,
  FieldHint,
  FieldLabel,
  FormSection,
  ProfileHero,
} from "../../../components/profile/EditProfileKit";
import ProfileAvatarPickerModal from "../../../components/profile/ProfileAvatarPickerModal";
import FavoritesEditor from "../../../components/favorites/FavoritesEditor";
import { getFavoritesCopy } from "../../../utils/favoritesCopy";
import {
  countFavorites,
  emptyFavorites,
  favoritesEqual,
  readProfileFavorites,
  toProfilePayload,
} from "../../../utils/fourFavorites";
import { ANALYTICS_EVENTS, trackEvent } from "../../../services/analytics";


const BIO_MAX = 160;
const NAME_MAX = 40;
const USERNAME_MAX = 20;

export default function EditProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const { user } = useAuth();
  const { profile, loading, updateField, changeUsername } = useUserProfile();
  const { selectAvatarIndex, selectAvatar } = useProfileUi();

  const socialPhotoURL = profile?.photoURL || user?.photoURL || null;

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  // Bu alan sonradan eklendi: eski hesaplarda boş gelir ve boş bırakılabilir —
  // kaydetmeyi zorunlu kılmak, yalnızca bio'sunu düzeltmek isteyeni kilitlerdi.
  const [birthDate, setBirthDate] = useState(null);
  const [avatarIndex, setAvatarIndex] = useState(0);
  // Dört favori (film/dizi/oyuncu, her biri 0–4). Taslak burada; Kaydet ile
  // Users/{uid}.fourFavorites'e yazılır (utils/fourFavorites.js).
  const [favorites, setFavorites] = useState(emptyFavorites);
  const favCopy = getFavoritesCopy(language);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle|same|invalid|checking|available|taken
  const [saving, setSaving] = useState(false);
  // Form profilden doldurulana kadar "değişiklik var mı" hesabı yapılmaz.
  const [ready, setReady] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);

  // Klavyede "ileri" tuşu alanlar arasında gezdirir.
  const usernameRef = useRef(null);
  const bioRef = useRef(null);

  // Hesap silme. Onay sayfası ortak BottomSheetModal: şifre kutusu klavyeyi
  // açınca sayfa klavyenin üstüne çıkar ve içerik küçülüp kayar, Vazgeç / Hesabı
  // sil düğmeleri görünür kalır (eskiden ortalanmış kutu klavyenin altında kalıyordu).
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Yeniden doğrulama, hesabın sağlayıcısına göre değişir: parolası olanlar
  // şifresini yazar, yalnızca Google ile açılmış hesaplar hesap seçiciyi açar.
  // Sağlayıcılar modal her açıldığında okunur — arada Ayarlar'dan Google
  // bağlanmış/kaldırılmış olabilir.
  const [signInMethods, setSignInMethods] = useState({
    hasPassword: false,
    hasGoogle: false,
    hasApple: false,
  });
  const [providerVerified, setProviderVerified] = useState(false);
  const [appleAuthorizationCode, setAppleAuthorizationCode] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const verificationProvider = signInMethods.hasApple
    ? "apple"
    : !signInMethods.hasPassword && signInMethods.hasGoogle
      ? "google"
      : null;
  const usesPassword = !verificationProvider && signInMethods.hasPassword;
  const deleteBlocked =
    deleting || verifying || (!!verificationProvider && !providerVerified);

  const initRef = useRef(false);

  // Profil yüklenince alanları doldur
  useEffect(() => {
    if (profile && !initRef.current) {
      setDisplayName(profile.displayName || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setBirthDate(profile.birthDate || null);
      setFavorites(readProfileFavorites(profile));
      setAvatarIndex(
        clampAvatarIndex(
          typeof profile.avatarIndex === "number"
            ? profile.avatarIndex
            : selectAvatarIndex,
        ),
      );
      initRef.current = true;
      setReady(true);
    }
  }, [profile, selectAvatarIndex]);

  // Kullanıcı adı: format + müsaitlik (debounce)
  useEffect(() => {
    if (!initRef.current) return;
    const u = normalizeUsername(username);
    if (u === normalizeUsername(profile?.username || "")) {
      setUsernameStatus("same");
      return;
    }
    if (!isValidUsername(u)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const id = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(u);
        setUsernameStatus(ok ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(id);
  }, [username, profile?.username]);

  const usernameBlocked =
    usernameStatus === "invalid" ||
    usernameStatus === "taken" ||
    usernameStatus === "checking";

  // Kaydet yalnız değiştirilecek bir şey varken açılır. Başlangıç avatarı,
  // formun profilden aldığı değerle AYNI formülle hesaplanır (yukarıdaki
  // doldurma efekti) — profilde avatarIndex yoksa seçili avatar kullanılır.
  const dirty = isProfileEditDirty({
    ready,
    saved: profile
      ? {
          displayName: profile.displayName || "",
          username: normalizeUsername(profile.username || ""),
          bio: profile.bio || "",
          avatarIndex: clampAvatarIndex(
            typeof profile.avatarIndex === "number" ? profile.avatarIndex : selectAvatarIndex,
          ),
          birthDate: profile.birthDate || null,
          fourFavorites: readProfileFavorites(profile),
        }
      : null,
    draft: {
      displayName,
      username: normalizeUsername(username),
      bio,
      avatarIndex,
      birthDate,
      fourFavorites: favorites,
    },
  });
  const canSave = dirty && !usernameBlocked;

  const onSave = async () => {
    if (saving) return;
    const dn = displayName.trim();
    const un = normalizeUsername(username);
    const bo = bio.trim();

    if (!dn) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.isim_bos_olamaz", "İsim boş olamaz") });
      return;
    }
    const usernameChanged =
      un !== normalizeUsername(profile?.username || "");
    if (usernameChanged && !isValidUsername(un)) {
      const isAllDigits = /^[0-9]+$/.test(un);
      Toast.show({
        type: "error",
        text1: isAllDigits
          ? (tr ? "Kullanıcı adı sadece rakamlardan oluşamaz (en az bir harf içermelidir)." : es ? "El nombre de usuario no puede ser solo números (debe contener al menos una letra)." : pt ? "O nome de usuário não pode ser só números (deve conter pelo menos uma letra)." : de ? "Der Benutzername darf nicht nur aus Zahlen bestehen (mindestens ein Buchstabe ist nötig)." : "Username cannot consist only of numbers (must contain at least one letter).")
          : i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)"),
      });
      return;
    }
    if (usernameChanged && usernameStatus !== "available") {
      if (usernameStatus === "checking") {
        Toast.show({
          type: "info",
          text1: tr ? "Kullanıcı adı kontrol ediliyor, lütfen bekleyin…" : es ? "Comprobando la disponibilidad del nombre de usuario, espera un momento…" : pt ? "Verificando a disponibilidade do nome de usuário, aguarde um instante…" : de ? "Verfügbarkeit des Benutzernamens wird geprüft, bitte warten…" : "Checking username availability, please wait…",
        });
        return;
      }
      if (usernameStatus === "taken") {
        Toast.show({ type: "error", text1: i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış") });
        return;
      }
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)"),
      });
      return;
    }

    setSaving(true);
    try {
      if (usernameChanged) {
        await changeUsername(un);
      }
      const patch = {};
      if (dn !== (profile?.displayName || "")) patch.displayName = dn;
      if (bo !== (profile?.bio || "")) patch.bio = bo;
      // Kayıtlı tarihi DEĞİŞTİRMEYE çalışma: kural reddeder ve tüm patch
      // (isim/bio dahil) tek yazımda düşerdi. Alan zaten salt-okunur; bu
      // kontrol bayat yerel duruma karşı ikinci kapı.
      const birthChanged =
        !profile?.birthDate && !!birthDate && birthDate !== (profile?.birthDate || null);
      if (birthChanged) patch.birthDate = birthDate;
      // Favoriler yalnız değiştiyse yazılır; hepsini kaldırmak da bir değişikliktir
      // (boş yapı yazılır, alan silinmez — tanıtımdan gelen eski seçimler geri
      // sızmasın diye "alan var" bilgisi korunur, bkz. adoptPendingFavorites).
      if (!favoritesEqual(favorites, readProfileFavorites(profile))) {
        patch.fourFavorites = toProfilePayload(favorites);
      }
      if (Object.keys(patch).length) await updateField(patch);
      if (patch.fourFavorites) {
        trackEvent(ANALYTICS_EVENTS.FOUR_FAVORITES_SAVED, {
          movies: countFavorites(favorites, "movies"),
          shows: countFavorites(favorites, "shows"),
          people: countFavorites(favorites, "people"),
          total: countFavorites(favorites),
        });
      }

      // Yaş kısıtını BEKLETMEDEN tazele. Profil dinleyicisi zaten tetiklenecek
      // ama bu yazma yetişkin içerik kapısını doğrudan etkiliyor; kullanıcı
      // kaydeder kaydetmez doğru durumda olmalı.
      if (birthChanged) syncAgeRestriction(birthDate);

      const avatarChanged = avatarIndex !== clampAvatarIndex(profile?.avatarIndex);
      if (avatarChanged) {
        await selectAvatar(avatarIndex);
      }

      // İstemcinin izinli oldugu kopyalari hemen tazele. Tum sosyal yuzeylerin
      // yetkili fan-out'u Users/{uid} degisimini dinleyen Cloud Function'dadir.
      const nameChanged = patch.displayName !== undefined;
      if ((nameChanged || usernameChanged || avatarChanged) && profile?.uid) {
        propagateProfileChange(profile.uid, {
          displayName: nameChanged ? dn : undefined,
          username: usernameChanged ? un : undefined,
          avatarIndex: avatarChanged ? avatarIndex : undefined,
        }).catch(() => {});
      }

      Toast.show({ type: "success", text1: i18nText("autoI18n.profil_guncellendi", "Profil güncellendi") });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: "error", text1: e?.message || i18nText("autoI18n.guncellenemedi", "Güncellenemedi") });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = () => {
    setDeletePassword("");
    setProviderVerified(false);
    setAppleAuthorizationCode(null);
    setSignInMethods(getSignInMethods());
    setShowDelete(true);
  };

  // Sosyal hesaplar için ayrı doğrulama adımı: sağlayıcı seçicisi açılır. Apple
  // ayrıca hesap silme öncesi yetki iptali için authorization code döndürür.
  // Silme yine kırmızı butona basılınca olur —
  // seçiciden çıkmak hesabı silmemeli.
  const onVerifyWithProvider = async () => {
    if (verifying || deleting) return;
    setVerifying(true);
    try {
      const { cancelled, appleAuthorizationCode: authorizationCode } =
        await reauthenticateForDeletion();
      if (cancelled) return;
      setAppleAuthorizationCode(authorizationCode || null);
      setProviderVerified(true);
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.kimligin_dogrulandi", "Kimliğin doğrulandı"),
      });
    } catch (e) {
      if (
        e?.code === GoogleAuthCode.CANCELLED ||
        e?.code === AppleAuthCode.CANCELLED
      ) return; // iptal hata değil
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.dogrulama_basarisiz", "Doğrulama başarısız"),
        text2:
          verificationProvider === "apple"
            ? describeAppleAuthError(e, language)
            : describeGoogleAuthError(e, language),
      });
    } finally {
      setVerifying(false);
    }
  };

  const onDeleteAccount = async () => {
    if (deleting || verifying) return;
    if (usesPassword && !deletePassword) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.devam_etmek_icin_sifreni_gir", "Devam etmek için şifreni gir") });
      return;
    }
    if (verificationProvider && !providerVerified) {
      Toast.show({
        type: "error",
        text1:
          verificationProvider === "apple"
            ? (tr ? "Önce Apple ile doğrula" : es ? "Verifica primero con Apple" : pt ? "Verifique primeiro com a Apple" : de ? "Bestätige zuerst mit Apple" : "Verify with Apple first")
            : i18nText("autoI18n.once_google_ile_dogrula", "Önce Google ile doğrula"),
      });
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAccount({
        password: usesPassword ? deletePassword : undefined,
        // Sosyal akışta doğrulama az önce yapıldı; seçiciyi tekrar açma.
        reauthenticated: providerVerified,
        appleAuthorizationCode,
      });
      if (result?.cancelled) {
        setDeleting(false);
        return;
      }
      // Başarılı: Firebase oturumu kapattı. Login'e dön.
      Toast.show({ type: "success", text1: i18nText("autoI18n.hesabin_silindi", "Hesabın silindi") });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (e) {
      const code = e?.code || "";
      let msg = e?.message || i18nText("autoI18n.hesap_silinemedi", "Hesap silinemedi");
      if (
        usesPassword &&
        (code === "auth/wrong-password" || code === "auth/invalid-credential")
      ) {
        msg = i18nText("autoI18n.sifre_yanlis", "Şifre yanlış");
      } else if (code === DeleteAccountCode.NO_SESSION) {
        msg = i18nText("autoI18n.oturum_bulunamadi_tekrar_giris", "Oturum bulunamadı. Lütfen tekrar giriş yap");
      } else if (code === DeleteAccountCode.NEEDS_PASSWORD) {
        msg = i18nText("autoI18n.devam_icin_sifre_gir", "Devam etmek için şifreni gir");
      } else if (code === "auth/too-many-requests") {
        msg = i18nText("autoI18n.cok_fazla_deneme", "Çok fazla deneme. Biraz sonra tekrar dene");
      } else if (code === "auth/requires-recent-login") {
        // Doğrulama bayatladı. Sosyal akışta kullanıcıyı doğrulama adımına
        // geri gönder; parola akışında şifreyi yeniden göndermesi yeterli.
        setProviderVerified(false);
        setAppleAuthorizationCode(null);
        msg = i18nText(
          "autoI18n.guvenlik_icin_kimligini_yeniden_dogrula",
          "Güvenlik için kimliğini yeniden doğrula",
        );
      } else if (typeof code === "string" && code.startsWith("google/")) {
        if (code === GoogleAuthCode.CANCELLED) {
          setDeleting(false);
          return;
        }
        setProviderVerified(false);
        msg = describeGoogleAuthError(e, language);
      } else if (typeof code === "string" && code.startsWith("apple/")) {
        if (code === AppleAuthCode.CANCELLED) {
          setDeleting(false);
          return;
        }
        setProviderVerified(false);
        setAppleAuthorizationCode(null);
        msg = describeAppleAuthError(e, language);
      }
      Toast.show({ type: "error", text1: msg });
      setDeleting(false);
    }
  };

  const usernameHint = () => {
    const un = normalizeUsername(username);
    switch (usernameStatus) {
      case "invalid":
        if (un.length > 0 && un.length < 3) {
          return {
            text: i18nText("autoI18n.en_az_3_karakter_yalnizca_a_z_0_9", "En az 3 karakter · yalnızca a–z, 0–9, _"),
            color: theme.colors.red,
          };
        }
        if (un.length >= 3 && /^[0-9_]+$/.test(un)) {
          return {
            text: tr ? "Kullanıcı adı sadece rakamlardan veya alt çizgiden oluşamaz (en az bir harf içermelidir)." : es ? "El nombre de usuario no puede ser solo números o guiones bajos (debe contener al menos una letra)." : pt ? "O nome de usuário não pode ser só números ou sublinhados (deve conter pelo menos uma letra)." : de ? "Der Benutzername darf nicht nur aus Zahlen oder Unterstrichen bestehen (mindestens ein Buchstabe ist nötig)." : "Username cannot be only numbers or underscores (must contain at least one letter).",
            color: theme.colors.red,
          };
        }
        return {
          text: i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "3-20 karakter · yalnızca a-z, 0-9, _ (en az bir harf)"),
          color: theme.colors.red,
        };
      case "checking":
        return { text: i18nText("autoI18n.kontrol_ediliyor", "Kontrol ediliyor…"), color: theme.text.muted };
      case "taken":
        return { text: i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış"), color: theme.colors.red };
      case "available":
        return { text: i18nText("autoI18n.kullanilabilir", "Kullanılabilir"), color: theme.colors.green };
      default:
        return null;
    }
  };
  const hint = usernameHint();
  const birthAge = calculateAge(birthDate);
  // Kayıtlı tarih varsa alan kilitli — kural ikinci yazımı zaten reddediyor.
  const birthLocked = !!profile?.birthDate;

  if (loading && !profile) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.primary }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const accent = theme.accent;
  const lightTheme = isLightSurface(theme.primary);
  const fieldSurface = theme.between;
  const socialSelected = !!socialPhotoURL && avatarIndex === CUSTOM_AVATAR_INDEX;

  // Kullanıcı adı durum satırı: alanın kenar tonuyla (AuthField) aynı renkler.
  const hintColor = hint
    ? usernameStatus === "available"
      ? AUTH_SUCCESS
      : usernameStatus === "checking"
        ? theme.text.muted
        : AUTH_ERROR
    : null;
  const hintIcon =
    usernameStatus === "available"
      ? "checkmark-circle-outline"
      : usernameStatus === "checking"
        ? "time-outline"
        : "alert-circle-outline";

  const usernameRight =
    usernameStatus === "checking" ? (
      <ActivityIndicator size="small" color={theme.text.muted} />
    ) : usernameStatus === "available" ? (
      <Ionicons name="checkmark-circle" size={19} color={AUTH_SUCCESS} />
    ) : usernameStatus === "taken" ? (
      <Ionicons name="close-circle" size={19} color={AUTH_ERROR} />
    ) : null;

  // Doğum tarihi alt satırı: kilitli / henüz girilmemiş / 18 altı / tamam.
  const birthHint = birthLocked
    ? {
        icon: "lock-closed-outline",
        color: theme.text.muted,
        text: i18nText(
          "autoI18n.dogum_tarihi_kilitli",
          "Doğum tarihi bir kez kaydedilir. Yanlışsa Ayarlar → Uygulama Hakkında'dan destekle iletişime geç.",
        ),
      }
    : birthAge === null
      ? {
          icon: "eye-off-outline",
          color: theme.text.muted,
          text: i18nText(
            "autoI18n.dogum_tarihi_profil_alt",
            "Profilinde gösterilmez; yalnızca yetişkin içerik ayarı için kullanılır.",
          ),
        }
      : birthAge < MIN_ADULT_AGE
        ? {
            icon: "information-circle-outline",
            color: AUTH_WARN,
            text: i18nText(
              "autoI18n.yas_alti_yetiskin_kapali",
              "{{age}} yaşındasın — yetişkin içerik kapalı kalacak.",
              { age: birthAge },
            ),
          }
        : {
            icon: "checkmark-circle-outline",
            color: theme.text.muted,
            text: i18nText("autoI18n.yas_bilgisi", "{{age}} yaşındasın.", { age: birthAge }),
          };

  // Hesap silme sayfasının metinleri (dil dallanması burada kalır).
  const deleteDescription = verificationProvider
    ? verificationProvider === "apple"
      ? (tr ? "Bu işlem geri alınamaz. Devam etmek ve Apple yetkisini iptal etmek için Apple hesabınla doğrula." : es ? "No se puede deshacer. Verifica con Apple para que también se pueda revocar su autorización." : pt ? "Isso não pode ser desfeito. Verifique com a Apple para que a autorização dela também possa ser revogada." : de ? "Das kann nicht rückgängig gemacht werden. Bestätige mit Apple, damit auch dessen Autorisierung widerrufen werden kann." : "This cannot be undone. Verify with Apple so its authorization can also be revoked.")
      : i18nText(
          "autoI18n.bu_islem_geri_alinamaz_devam_etmek_icin_google_ile_dogrula",
          "Bu işlem geri alınamaz. Devam etmek için Google hesabınla doğrula.",
        )
    : i18nText("autoI18n.bu_islem_geri_alinamaz_devam_etmek_icin_sifreni_gi", "Bu işlem geri alınamaz. Devam etmek için şifreni gir.");
  const verifyLabel =
    verificationProvider === "apple"
      ? (tr ? "Apple ile doğrula" : es ? "Verificar con Apple" : pt ? "Verificar com a Apple" : de ? "Mit Apple bestätigen" : "Verify with Apple")
      : i18nText("autoI18n.google_ile_dogrula", "Google ile doğrula");

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <AuthBackdrop accent={accent} isLightTheme={lightTheme} />
      <ScreenDecor scope="profile" iconOpacity={lightTheme ? 0.07 : 0.12} />
      <StatusBar barStyle={lightTheme ? "dark-content" : "light-content"} />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <EditHeader
          theme={theme}
          title={i18nText("autoI18n.profili_duzenle", "Profili Düzenle")}
          onBack={() => navigation.goBack()}
          onSave={onSave}
          canSave={canSave}
          saving={saving}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          >
            {/* Avatar + canlı önizleme */}
            <Reveal>
              <ProfileHero
                theme={theme}
                avatarIndex={avatarIndex}
                photoURL={socialPhotoURL}
                name={displayName}
                username={username}
                social={socialSelected}
                onPress={() => setAvatarSheet(true)}
              />
            </Reveal>

            {/* Profil bilgileri */}
            <Reveal delay={70} style={authColumn}>
              <FormSection
                theme={theme}
                icon="person-circle-outline"
                title={i18nText("autoI18n.profil_bilgileri", "Profil bilgileri")}
              >
                <FieldBlock>
                  <FieldLabel
                    theme={theme}
                    label={i18nText("autoI18n.isim", "İsim")}
                    counter={`${displayName.length}/${NAME_MAX}`}
                  />
                  <AuthField
                    theme={theme}
                    accent={accent}
                    fieldSurface={fieldSurface}
                    icon="person-outline"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={i18nText("autoI18n.adin", "Adın")}
                    maxLength={NAME_MAX}
                    returnKeyType="next"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </FieldBlock>

                <FieldBlock>
                  <FieldLabel
                    theme={theme}
                    label={i18nText("autoI18n.kullanici_adi_2", "Kullanıcı adı")}
                    counter={`${username.length}/${USERNAME_MAX}`}
                  />
                  <AuthField
                    ref={usernameRef}
                    theme={theme}
                    accent={accent}
                    fieldSurface={fieldSurface}
                    icon="at"
                    state={usernameFieldState(usernameStatus)}
                    value={username}
                    onChangeText={(v) => setUsername(formatUsernameInput(v))}
                    placeholder={i18nText("autoI18n.kullanici_adi_ornegi", "kullanici_adi")}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={USERNAME_MAX}
                    returnKeyType="next"
                    onSubmitEditing={() => bioRef.current?.focus()}
                    blurOnSubmit={false}
                    right={usernameRight}
                  />
                  {hint ? (
                    <FieldHint icon={hintIcon} color={hintColor}>
                      {hint.text}
                    </FieldHint>
                  ) : null}
                </FieldBlock>

                <FieldBlock>
                  <FieldLabel
                    theme={theme}
                    label={i18nText("autoI18n.hakkinda", "Hakkında")}
                    counter={`${bio.length}/${BIO_MAX}`}
                    warn={isNearLimit(bio.length, BIO_MAX)}
                  />
                  <AuthField
                    ref={bioRef}
                    theme={theme}
                    accent={accent}
                    fieldSurface={fieldSurface}
                    icon="chatbubble-ellipses-outline"
                    value={bio}
                    onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
                    placeholder={i18nText("autoI18n.kendinden_bahset", "Kendinden bahset…")}
                    multiline
                    maxLength={BIO_MAX}
                    containerStyle={styles.bioShell}
                    inputStyle={styles.bioInput}
                  />
                </FieldBlock>
              </FormSection>
            </Reveal>

            {/* Dört favori: arkadaşların profilinde görünür, önerileri de besler. */}
            <Reveal delay={100} style={authColumn}>
              <FormSection
                theme={theme}
                icon="heart-circle-outline"
                title={favCopy.section.title}
              >
                <FavoritesEditor value={favorites} onChange={setFavorites} />
                <FieldHint icon="eye-outline" color={theme.text.muted}>
                  {favCopy.section.hint}
                </FieldHint>
              </FormSection>
            </Reveal>

            {/* Yalnız kullanıcıya görünen bilgi. Doğum tarihi yetişkin içerik
                ayarının kapısı; kaydedilmişse salt-okunur (kural da tek yazıma
                izin veriyor — firestore.rules → birthDateKept). */}
            <Reveal delay={130} style={authColumn}>
              <FormSection
                theme={theme}
                icon="lock-closed-outline"
                title={i18nText("autoI18n.profil_sadece_sana_gorunur", "Sadece sana görünür")}
              >
                <FieldBlock>
                  <FieldLabel theme={theme} label={i18nText("autoI18n.dogum_tarihi", "Doğum tarihi")} />
                  <BirthDateField
                    value={birthDate}
                    onChange={setBirthDate}
                    theme={theme}
                    accent={accent}
                    fieldSurface={fieldSurface}
                    showHint={false}
                    disabled={birthLocked}
                    chipIcon
                    shellStyle={styles.birthShell}
                  />
                  <FieldHint icon={birthHint.icon} color={birthHint.color}>
                    {birthHint.text}
                  </FieldHint>
                </FieldBlock>
              </FormSection>
            </Reveal>

            {/* Tehlikeli bölge */}
            <Reveal delay={190} style={authColumn}>
              <View style={styles.dangerBlock}>
                <AuthSectionLabel theme={theme} accent={theme.colors.red}>
                  {i18nText("autoI18n.tehlikeli_bolge", "Tehlikeli bölge")}
                </AuthSectionLabel>
                <DangerRow
                  theme={theme}
                  title={i18nText("autoI18n.hesabi_sil", "Hesabı Sil")}
                  description={i18nText(
                    "autoI18n.hesabin_listelerin_hatirlaticilarin_notlarin_gonde",
                    "Hesabın, listelerin, hatırlatıcıların, notların, gönderilerin ve arkadaşlık bağların kalıcı olarak silinir. Bu işlem geri alınamaz.",
                  )}
                  onPress={openDeleteModal}
                />
              </View>
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Avatar seçici: seçim yalnız forma yazılır, Kaydet ile kalıcı olur. */}
      <ProfileAvatarPickerModal
        visible={avatarSheet}
        selectedIndex={avatarIndex}
        saving={false}
        onSelect={(index) => {
          setAvatarIndex(index);
          setAvatarSheet(false);
        }}
        onClose={() => setAvatarSheet(false)}
      />

      {/* Hesap silme onayı */}
      <DeleteAccountSheet
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        theme={theme}
        deleting={deleting}
        verifying={verifying}
        title={i18nText("autoI18n.hesabi_sil_2", "Hesabı sil")}
        description={deleteDescription}
        provider={verificationProvider}
        verified={providerVerified}
        verifyLabel={verifyLabel}
        verifiedLabel={i18nText("autoI18n.kimligin_dogrulandi", "Kimliğin doğrulandı")}
        password={deletePassword}
        onPasswordChange={setDeletePassword}
        onVerify={onVerifyWithProvider}
        onConfirm={onDeleteAccount}
        confirmDisabled={deleteBlocked}
        cancelLabel={i18nText("autoI18n.vazgec", "Vazgeç")}
        confirmLabel={i18nText("autoI18n.hesabi_sil_2", "Hesabı sil")}
        passwordLabel={i18nText("autoI18n.sifre", "Şifre")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },

  bioShell: { alignItems: "flex-start", paddingTop: 12, paddingBottom: 6 },
  bioInput: {
    minHeight: 92,
    maxHeight: 170,
    textAlignVertical: "top",
    paddingTop: 7,
  },
  birthShell: { minHeight: 58, borderRadius: 18 },
  dangerBlock: { gap: 12 },
});
