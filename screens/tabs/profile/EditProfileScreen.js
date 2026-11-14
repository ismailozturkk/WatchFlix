// screens/tabs/profile/EditProfileScreen.js
//
// "Hesap bilgileri": yalnız sahibine görünen hesap ayarları — doğum tarihi
// (yetişkin içerik kapısı, bir kez yazılır) ve tehlikeli bölge (hesabı sıfırla /
// sil). Ad, kullanıcı adı, hakkında, avatar, favoriler, sosyal hesaplar, vitrin
// rozetleri ve listeler artık PROFİLDE yerinde düzenleniyor (Profil > kalem →
// kendi profil önizlemen > kalem; hooks/useOwnProfileEditor.js). Rota adı geriye
// dönük uyumluluk için aynı kaldı.
//
// Giriş: Ayarlar > Hesap > "Hesap bilgileri" ve profil düzenleme modundaki "Hesap".
//
// (11 Kas) E-posta + doğrulama durumu ve katılma tarihi profil başlığından buraya
// taşındı (components/profile/AccountEmailCard.js); doğrulanmamışsa "tekrar gönder"
// düğmeli uyarı kutusu burada.

import { normalizeAppLanguage } from "../../../utils/appLanguages";
import { isLightSurface } from "@utils/colorUtils";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import LensLoader from "../../../components/LensLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import Toast from "@components/AppToast";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import { useAuth } from "../../../context/AuthContext";
import useEmailVerification from "../../../hooks/useEmailVerification";
import AccountEmailCard from "../../../components/profile/AccountEmailCard";
import {
  DeleteAccountCode,
  deleteAccount,
  getSignInMethods,
  reauthenticateForDeletion,
} from "../../../services/accountService";
import { ResetAccountCode, resetAccount } from "../../../services/accountResetService";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
} from "../../../services/googleAuthService";
import {
  AppleAuthCode,
  describeAppleAuthError,
} from "../../../services/appleAuthService";
import { i18nText } from "../../../utils/i18nText";
import ScreenDecor from "../../../components/ScreenDecor";
import BirthDateField from "../../../components/auth/BirthDateField";
import { MIN_ADULT_AGE, calculateAge, syncAgeRestriction } from "../../../utils/ageGate";
import {
  AUTH_WARN,
  AuthBackdrop,
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
} from "../../../components/profile/EditProfileKit";
import { getDeleteAccountCopy } from "./deleteAccountCopy";
import { getResetAccountCopy } from "./resetAccountCopy";
import ResetScopeList, { buildResetScopeRows } from "../../../components/profile/ResetScopeList";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import { useProfileReminders } from "../../../context/ProfileRemindersContext";
import { intlLocaleOf } from "../../../utils/appLanguages";


// Geri alınamaz işlemlerin onay düğmesi bu kadar BASILI TUTULUNCA çalışır.
const DELETE_HOLD_MS = 2500;
const RESET_HOLD_MS = 2000;

export default function EditProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  // Doğrulama durumu: odakta/öne dönünce tazelenir; "tekrar gönder" 60 sn bekletir.
  const emailVerification = useEmailVerification(user, language);
  const insets = useSafeAreaInsets();
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const { profile, loading, updateField } = useUserProfile();

  // Bu alan sonradan eklendi: eski hesaplarda boş gelir ve boş bırakılabilir —
  // kaydetmeyi zorunlu kılmak, yalnızca bio'sunu düzeltmek isteyeni kilitlerdi.
  const [birthDate, setBirthDate] = useState(null);
  const [saving, setSaving] = useState(false);
  // Form profilden doldurulana kadar "değişiklik var mı" hesabı yapılmaz.
  const [ready, setReady] = useState(false);

  // Hesap silme. Onay sayfası ortak BottomSheetModal: şifre kutusu klavyeyi
  // açınca sayfa klavyenin üstüne çıkar ve içerik küçülüp kayar, Vazgeç / Hesabı
  // sil düğmeleri görünür kalır (eskiden ortalanmış kutu klavyenin altında kalıyordu).
  // Aynı onay sayfası hem silme hem sıfırlama için: hangisinin açık olduğu burada.
  const [dangerMode, setDangerMode] = useState(null); // null | "delete" | "reset"
  const showDelete = dangerMode !== null;
  const isReset = dangerMode === "reset";
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Silme sürerken aşama listesi: { stage, stages } (services/accountService.js onProgress).
  const [deleteProgress, setDeleteProgress] = useState(null);
  const deleteCopy = getDeleteAccountCopy(language);
  const resetCopy = getResetAccountCopy(language);
  // Sıfırlama sayfasında "ne silinecek" özeti: sayılar bellekteki bağlamlardan.
  const resetScopeRows = useResetScopeRows(resetCopy.scope, language);
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

  // Profil yüklenince alanı doldur
  useEffect(() => {
    if (profile && !initRef.current) {
      setBirthDate(profile.birthDate || null);
      initRef.current = true;
      setReady(true);
    }
  }, [profile]);

  // Doğum tarihi bir kez yazılır (firestore.rules → birthDateKept): yalnız henüz
  // kayıtlı değilken girilmesi bir değişikliktir.
  const birthChanged = ready && !profile?.birthDate && !!birthDate;
  const canSave = birthChanged && !saving;

  const onSave = async () => {
    if (saving || !birthChanged) return;
    setSaving(true);
    try {
      await updateField({ birthDate }, { stampIdentity: false });
      // Yaş kısıtını BEKLETMEDEN tazele: yetişkin içerik kapısı bu yazımı bekliyor.
      syncAgeRestriction(birthDate);
      Toast.show({ type: "success", text1: i18nText("autoI18n.profil_guncellendi", "Profil güncellendi") });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: "error", text1: e?.message || i18nText("autoI18n.guncellenemedi", "Güncellenemedi") });
    } finally {
      setSaving(false);
    }
  };

  const openDangerSheet = (mode) => {
    setDeletePassword("");
    setProviderVerified(false);
    setAppleAuthorizationCode(null);
    setSignInMethods(getSignInMethods());
    setDangerMode(mode);
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

  // Basılı tutma BAŞLAMADAN önce (ve onay anında yine) denenen ön koşullar: şifre
  // girildi mi, sosyal hesapta kimlik doğrulandı mı. Eksikse nedenini söyler.
  const validateDanger = () => {
    if (deleting || verifying) return false;
    if (usesPassword && !deletePassword) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.devam_etmek_icin_sifreni_gir", "Devam etmek için şifreni gir") });
      return false;
    }
    if (verificationProvider && !providerVerified) {
      Toast.show({
        type: "error",
        text1:
          verificationProvider === "apple"
            ? (tr ? "Önce Apple ile doğrula" : es ? "Verifica primero con Apple" : pt ? "Verifique primeiro com a Apple" : de ? "Bestätige zuerst mit Apple" : language === "it" ? "Verificare prima con Apple" : language === "fr" ? "Vérifie d'abord avec Apple" : language === "ja" ? "先にAppleで確認してください" : "Verify with Apple first")
            : i18nText("autoI18n.once_google_ile_dogrula", "Önce Google ile doğrula"),
      });
      return false;
    }
    return true;
  };

  // Silme ve sıfırlamanın ortak hata çevirisi. Kullanıcı sağlayıcı penceresini
  // kendisi kapattıysa (iptal) hata değildir: toast gösterilmez.
  const handleDangerFailure = (e) => {
    const code = e?.code || "";
    let msg = e?.message || (isReset ? resetCopy.incomplete : i18nText("autoI18n.hesap_silinemedi", "Hesap silinemedi"));
    let silent = false;
    if (
      usesPassword &&
      (code === "auth/wrong-password" || code === "auth/invalid-credential")
    ) {
      msg = i18nText("autoI18n.sifre_yanlis", "Şifre yanlış");
    } else if (code === DeleteAccountCode.NO_SESSION || code === ResetAccountCode.NO_SESSION) {
      msg = i18nText("autoI18n.oturum_bulunamadi_tekrar_giris", "Oturum bulunamadı. Lütfen tekrar giriş yap");
    } else if (code === DeleteAccountCode.NEEDS_PASSWORD) {
      msg = i18nText("autoI18n.devam_icin_sifre_gir", "Devam etmek için şifreni gir");
    } else if (code === ResetAccountCode.INCOMPLETE) {
      msg = resetCopy.incomplete;
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
      if (code === GoogleAuthCode.CANCELLED) silent = true;
      else {
        setProviderVerified(false);
        msg = describeGoogleAuthError(e, language);
      }
    } else if (typeof code === "string" && code.startsWith("apple/")) {
      if (code === AppleAuthCode.CANCELLED) silent = true;
      else {
        setProviderVerified(false);
        setAppleAuthorizationCode(null);
        msg = describeAppleAuthError(e, language);
      }
    }
    if (!silent) Toast.show({ type: "error", text1: msg });
    setDeleting(false);
    setDeleteProgress(null);
  };

  const onDeleteAccount = async () => {
    if (!validateDanger()) return;
    setDeleting(true);
    setDeleteProgress(null);
    try {
      const result = await deleteAccount({
        password: usesPassword ? deletePassword : undefined,
        // Sosyal akışta doğrulama az önce yapıldı; seçiciyi tekrar açma.
        reauthenticated: providerVerified,
        appleAuthorizationCode,
        onProgress: setDeleteProgress,
      });
      if (result?.cancelled) {
        setDeleting(false);
        setDeleteProgress(null);
        return;
      }
      // Başarılı: Firebase oturumu kapattı. Login'e dön.
      Toast.show({ type: "success", text1: i18nText("autoI18n.hesabin_silindi", "Hesabın silindi") });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (e) {
      handleDangerFailure(e);
    }
  };

  // Hesabı sıfırla: oturum açık kalır, kütüphane + ilerleme silinir (services/accountResetService).
  const onResetAccount = async () => {
    if (!validateDanger()) return;
    setDeleting(true);
    setDeleteProgress(null);
    try {
      const result = await resetAccount({
        password: usesPassword ? deletePassword : undefined,
        reauthenticated: providerVerified,
        onProgress: setDeleteProgress,
      });
      if (result?.cancelled) {
        setDeleting(false);
        setDeleteProgress(null);
        return;
      }
      setDeleting(false);
      setDeleteProgress(null);
      setDangerMode(null);
      Toast.show({ type: "success", text1: resetCopy.done });
      navigation.goBack();
    } catch (e) {
      handleDangerFailure(e);
    }
  };

  const birthAge = calculateAge(birthDate);
  // Kayıtlı tarih varsa alan kilitli — kural ikinci yazımı zaten reddediyor.
  const birthLocked = !!profile?.birthDate;

  if (loading && !profile) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.primary }]}>
        <LensLoader size="screen" color={theme.accent} />
      </View>
    );
  }

  const accent = theme.accent;
  const lightTheme = isLightSurface(theme.primary);
  const fieldSurface = theme.between;

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
      ? (tr ? "Bu işlem geri alınamaz. Devam etmek ve Apple yetkisini iptal etmek için Apple hesabınla doğrula." : es ? "No se puede deshacer. Verifica con Apple para que también se pueda revocar su autorización." : pt ? "Isso não pode ser desfeito. Verifique com a Apple para que a autorização dela também possa ser revogada." : de ? "Das kann nicht rückgängig gemacht werden. Bestätige mit Apple, damit auch dessen Autorisierung widerrufen werden kann." : language === "it" ? "Questa operazione non può essere annullata. Verificare con Apple affinché anche la sua autorizzazione possa essere revocata." : language === "fr" ? "C'est irréversible. Vérifie avec Apple pour que son autorisation puisse aussi être révoquée." : language === "ja" ? "元に戻せません。Appleの認証も取り消せるよう、Appleで確認してください。" : "This cannot be undone. Verify with Apple so its authorization can also be revoked.")
      : i18nText(
          "autoI18n.bu_islem_geri_alinamaz_devam_etmek_icin_google_ile_dogrula",
          "Bu işlem geri alınamaz. Devam etmek için Google hesabınla doğrula.",
        )
    : i18nText("autoI18n.bu_islem_geri_alinamaz_devam_etmek_icin_sifreni_gi", "Bu işlem geri alınamaz. Devam etmek için şifreni gir.");
  const resetDescription = [
    resetCopy.sheetDescription,
    verificationProvider === "apple"
      ? resetCopy.needApple
      : verificationProvider === "google"
        ? resetCopy.needGoogle
        : resetCopy.needPassword,
  ].join(" ");
  const holdMs = isReset ? RESET_HOLD_MS : DELETE_HOLD_MS;
  const verifyLabel =
    verificationProvider === "apple"
      ? (tr ? "Apple ile doğrula" : es ? "Verificar con Apple" : pt ? "Verificar com a Apple" : de ? "Mit Apple bestätigen" : language === "it" ? "Verifica con Apple" : language === "fr" ? "Vérifier avec Apple" : language === "ja" ? "Appleで確認" : "Verify with Apple")
      : i18nText("autoI18n.google_ile_dogrula", "Google ile doğrula");

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <AuthBackdrop accent={accent} isLightTheme={lightTheme} />
      <ScreenDecor scope="profile" iconOpacity={lightTheme ? 0.07 : 0.12} />
      <StatusBar barStyle={lightTheme ? "dark-content" : "light-content"} />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <EditHeader
          theme={theme}
          title={i18nText("autoI18n.hesap_bilgileri_baslik", "Hesap bilgileri")}
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
            {/* Profil bilgileri artık profilde yerinde düzenleniyor: kısa yönlendirme. */}
            <Reveal style={authColumn}>
              <FieldHint icon="information-circle-outline" color={theme.text.muted}>
                {i18nText(
                  "autoI18n.hesap_bilgileri_profil_notu",
                  "Ad, kullanıcı adı, favoriler ve sosyal hesaplar artık profilinde, düzenleme modunda değiştirilir.",
                )}
              </FieldHint>
            </Reveal>

            {/* Hesap: e-posta (+ doğrulama durumu / uyarısı) ve katılma tarihi. */}
            {user ? (
              <Reveal delay={30} style={authColumn}>
                <AccountEmailCard
                  theme={theme}
                  language={language}
                  email={user.email}
                  verified={emailVerification.verified}
                  joinedAt={user.metadata?.createdAt || user.metadata?.creationTime}
                  verifyHint={t?.profileScreen?.emailVerified}
                  resend={{
                    label: emailVerification.resendLabel,
                    onPress: emailVerification.resend,
                    busy: emailVerification.sending,
                    disabled: emailVerification.cooldown > 0,
                  }}
                />
              </Reveal>
            ) : null}

            {/* Yalnız kullanıcıya görünen bilgi. Doğum tarihi yetişkin içerik
                ayarının kapısı; kaydedilmişse salt-okunur (kural da tek yazıma
                izin veriyor — firestore.rules → birthDateKept). */}
            <Reveal delay={60} style={authColumn}>
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
            <Reveal delay={110} style={authColumn}>
              <View style={styles.dangerBlock}>
                <AuthSectionLabel theme={theme} accent={theme.colors.red}>
                  {i18nText("autoI18n.tehlikeli_bolge", "Tehlikeli bölge")}
                </AuthSectionLabel>
                <DangerRow
                  theme={theme}
                  icon="refresh-circle-outline"
                  title={resetCopy.rowTitle}
                  description={resetCopy.rowDescription}
                  onPress={() => openDangerSheet("reset")}
                />
                <DangerRow
                  theme={theme}
                  title={i18nText("autoI18n.hesabi_sil", "Hesabı Sil")}
                  description={i18nText(
                    "autoI18n.hesabin_listelerin_hatirlaticilarin_notlarin_gonde",
                    "Hesabın, listelerin, hatırlatıcıların, notların, gönderilerin ve arkadaşlık bağların kalıcı olarak silinir. Bu işlem geri alınamaz.",
                  )}
                  onPress={() => openDangerSheet("delete")}
                />
              </View>
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Hesap silme / sıfırlama onayı: onay düğmesi BASILI TUTARAK çalışır */}
      <DeleteAccountSheet
        visible={showDelete}
        onClose={() => setDangerMode(null)}
        theme={theme}
        deleting={deleting}
        verifying={verifying}
        progress={deleteProgress}
        progressCopy={isReset ? resetCopy : deleteCopy}
        icon={isReset ? "refresh-circle-outline" : "warning-outline"}
        title={isReset ? resetCopy.sheetTitle : i18nText("autoI18n.hesabi_sil_2", "Hesabı sil")}
        description={isReset ? resetDescription : deleteDescription}
        provider={verificationProvider}
        verified={providerVerified}
        verifyLabel={verifyLabel}
        verifiedLabel={i18nText("autoI18n.kimligin_dogrulandi", "Kimliğin doğrulandı")}
        password={deletePassword}
        onPasswordChange={setDeletePassword}
        onVerify={onVerifyWithProvider}
        onConfirm={isReset ? onResetAccount : onDeleteAccount}
        confirmDisabled={deleteBlocked}
        canStart={validateDanger}
        holdMs={holdMs}
        cancelLabel={i18nText("autoI18n.vazgec", "Vazgeç")}
        confirmLabel={isReset ? resetCopy.hold : deleteCopy.hold}
        holdLabel={isReset ? resetCopy.holdActive : deleteCopy.holdActive}
        holdHint={(isReset ? resetCopy.holdHint : deleteCopy.holdHint).replace(
          "{seconds}",
          String(holdMs / 1000),
        )}
        passwordLabel={i18nText("autoI18n.sifre", "Şifre")}
        summary={isReset ? <ResetScopeList theme={theme} copy={resetCopy.scope} rows={resetScopeRows} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },

  birthShell: { minHeight: 58, borderRadius: 18 },
  dangerBlock: { gap: 12 },
});

/** Sıfırlama özetinin satırları (sayılar bağlamlardan; sağlayıcı yoksa sayısız). */
function useResetScopeRows(copy, language) {
  const stats = useProfileStats() || {};
  const notesCtx = useProfileNotes() || {};
  const remindersCtx = useProfileReminders() || {};
  const { uniqueMovieCount, uniqueTvCount, uniqueEpisodesCount, totalMinutesTime, totalMinutesTimeTv, lists } = stats;
  const notes = notesCtx.notes;
  const reminders = remindersCtx.reminders;
  return useMemo(() => {
    // Liste öğeleri: favoriler, İzleyeceklerim ve özel listeler (izlenenler ayrı satırda).
    const listItems = (Array.isArray(lists) ? lists : []).reduce(
      (sum, [key, items]) =>
        key === "watchedMovies" || key === "watchedTv" || !Array.isArray(items) ? sum : sum + items.length,
      0,
    );
    const size = (v) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);
    const locale = intlLocaleOf(language);
    return buildResetScopeRows(
      {
        movies: uniqueMovieCount,
        shows: uniqueTvCount,
        episodes: uniqueEpisodesCount,
        minutes: (totalMinutesTime || 0) + (totalMinutesTimeTv || 0),
        listItems,
        notes: size(notes),
        reminders: size(reminders?.movieReminders) + size(reminders?.tvReminders),
      },
      copy,
      (n) => n.toLocaleString(locale),
    );
  }, [copy, language, uniqueMovieCount, uniqueTvCount, uniqueEpisodesCount, totalMinutesTime, totalMinutesTimeTv, lists, notes, reminders]);
}
