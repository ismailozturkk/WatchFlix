import { normalizeAppLanguage } from "../../../utils/appLanguages";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LensLoader from "../../../components/LensLoader";
import Toast from "@components/AppToast";
import { auth } from "../../../firebase";
import AppIcon from "../../../components/AppIcon";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import { appAlert } from "../../../components/AppAlert";
import { alpha } from "../../../theme/colors";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from "../../../services/googleAuthService";
import {
  addPasswordSignIn,
  describeAccountConnectionError,
  sendCurrentUserPasswordReset,
} from "../../../services/accountConnectionsService";
import {
  AppleAuthCode,
  describeAppleAuthError,
  isAppleAuthenticationAvailable,
  linkAppleAccount,
  unlinkAppleAccount,
} from "../../../services/appleAuthService";
import {
  SettingsSubScreen,
  SectionLabel,
  SettingRow,
  buildUiColors,
  ui,
} from "./settingsUi";
import { fetchFreshProviderPhotos } from "../../../services/avatarPhotoSync";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassBox from "../../../components/common/GlassBox";

export default function AccountConnectionsScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const [busyAction, setBusyAction] = useState(null);
  const [revision, setRevision] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const user = auth.currentUser;
  const providers = useMemo(
    () => user?.providerData.map((item) => item.providerId) || [],
    [revision, user]
  );
  const providerDetails = useMemo(
    () =>
      Object.fromEntries(
        (user?.providerData || []).map((item) => [item.providerId, item]),
      ),
    [revision, user],
  );
  const googleLinked = providers.includes("google.com");
  const appleLinked = providers.includes("apple.com");
  const passwordLinked = providers.includes("password");
  const busy = !!busyAction;
  const passwordReady = password.length >= 6 && password === passwordAgain;
  const providerCount = providers.length;

  // Bağlama/kaldırma `user` nesnesini yerinde değiştirir: fotoğraf deposu da
  // tazelenir ki bağlanan hesabın fotoğrafı avatar seçicide hemen çıksın,
  // kaldırılan hesabın fotoğrafı avatarsa hazır avatara dönülsün
  // (services/avatarPhotoSync.js).
  const refresh = () => {
    setRevision((value) => value + 1);
    fetchFreshProviderPhotos({ force: true }).catch(() => {});
  };

  useEffect(() => {
    isAppleAuthenticationAvailable().then(setAppleAvailable);
  }, []);

  const connectGoogle = async () => {
    if (busy || googleLinked) return;
    setBusyAction("google");
    try {
      const result = await linkGoogleAccount();
      if (!result.cancelled) {
        Toast.show({
          type: "success",
          text1: tr ? "Google hesabı bağlandı" : es ? "Cuenta de Google vinculada" : pt ? "Conta do Google vinculada" : de ? "Google-Konto verknüpft" : language === "it" ? "Account Google collegato" : language === "fr" ? "Compte Google connecté" : language === "ja" ? "Googleアカウントを連携しました" : "Google account connected",
        });
      }
    } catch (error) {
      if (error?.code === GoogleAuthCode.CANCELLED) return;
      appAlert(
        tr ? "Google hesabı bağlanamadı" : es ? "No se pudo vincular Google" : pt ? "Não foi possível vincular o Google" : de ? "Google konnte nicht verknüpft werden" : language === "it" ? "Impossibile connettere Google" : language === "fr" ? "Impossible de connecter Google" : language === "ja" ? "Googleを連携できませんでした" : "Could not connect Google",
        describeGoogleAuthError(error, language),
        undefined,
        { type: "error" }
      );
    } finally {
      // refresh() finally'de: bağlama sunucuda başarılı olup sonraki adım hata
      // alsa bile satır "Bağlı"ya dönmeli. Yalnızca başarı yolunda tazelemek,
      // hesap bağlıyken UI'ı kalıcı olarak "Bağla"da bırakıyordu — ve
      // `if (busy || googleLinked) return` guard'ı da bayat değeri gördüğü için
      // kullanıcı tekrar tekrar bağlamayı deneyebiliyordu.
      refresh();
      setBusyAction(null);
    }
  };

  const disconnectGoogle = () => {
    if (busy || !googleLinked) return;
    if (providers.length <= 1) {
      // NOT: Burada "önce e-posta ve şifre ekle" DEMİYORUZ — uygulamada şifre
      // ekleme akışı yok, o metin kullanıcıyı çıkmaz sokağa gönderiyordu.
      appAlert(
        tr ? "Bağlantı kaldırılamaz" : es ? "No se puede desvincular" : pt ? "Não é possível desvincular" : de ? "Trennen nicht möglich" : language === "it" ? "Impossibile disconnettersi" : language === "fr" ? "Déconnexion impossible" : language === "ja" ? "連携を解除できません" : "Cannot disconnect",
        tr ? "Google şu anda hesabındaki tek giriş yöntemi. Kaldırılırsa hesabına bir daha giriş yapamazsın." : es ? "Google es el único método de inicio de sesión de tu cuenta. Si lo quitas, te quedarás sin acceso." : pt ? "O Google é o único método de login da sua conta. Se você removê-lo, ficará sem acesso." : de ? "Google ist die einzige Anmeldemethode deines Kontos. Wenn du es entfernst, sperrst du dich aus." : language === "it" ? "Google è l'unico metodo di accesso al tuo account. Se lo rimuovessi, verresti bloccato." : language === "fr" ? "Google est la seule méthode de connexion de ton compte. Le retirer t'empêcherait d'y accéder." : language === "ja" ? "Googleはこのアカウントで唯一のサインイン方法です。解除するとサインインできなくなります。" : "Google is the only sign-in method on your account. Removing it would lock you out.",
        undefined,
        { type: "warning" }
      );
      return;
    }
    appAlert(
      tr ? "Google bağlantısı kaldırılsın mı?" : es ? "¿Desvincular Google?" : pt ? "Desvincular o Google?" : de ? "Google trennen?" : language === "it" ? "Disconnettere Google?" : language === "fr" ? "Déconnecter Google ?" : language === "ja" ? "Googleの連携を解除しますか?" : "Disconnect Google?",
      tr ? "Google ile giriş artık kullanılamayacak." : es ? "Ya no podrás iniciar sesión con Google." : pt ? "Você não poderá mais entrar com o Google." : de ? "Du kannst dich nicht mehr mit Google anmelden." : language === "it" ? "Non sarai più in grado di accedere con Google." : language === "fr" ? "Tu ne pourras plus te connecter avec Google." : language === "ja" ? "Googleでサインインできなくなります。" : "You will no longer be able to sign in with Google.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : pt ? "Cancelar" : de ? "Abbrechen" : language === "it" ? "Annulla" : language === "fr" ? "Annuler" : language === "ja" ? "キャンセル" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : es ? "Desvincular" : pt ? "Desvincular" : de ? "Trennen" : language === "it" ? "Disconnettersi" : language === "fr" ? "Déconnecter" : language === "ja" ? "連携を解除" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("google");
            try {
              await unlinkGoogleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Google bağlantısı kaldırıldı" : es ? "Google desvinculado" : pt ? "Google desvinculado" : de ? "Google getrennt" : language === "it" ? "Google disconnesso" : language === "fr" ? "Google déconnecté" : language === "ja" ? "Googleの連携を解除しました" : "Google disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : es ? "La acción ha fallado" : pt ? "A ação falhou" : de ? "Aktion fehlgeschlagen" : language === "it" ? "Azione fallita" : language === "fr" ? "L'action a échoué" : language === "ja" ? "操作に失敗しました" : "Action failed",
                describeGoogleAuthError(error, language),
                undefined,
                { type: "error" }
              );
            } finally {
              refresh();
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const disconnectApple = () => {
    if (busy || !appleLinked) return;
    if (providers.length <= 1) {
      appAlert(
        tr ? "Bağlantı kaldırılamaz" : es ? "No se puede desvincular" : pt ? "Não é possível desvincular" : de ? "Trennen nicht möglich" : language === "it" ? "Impossibile disconnettersi" : language === "fr" ? "Déconnexion impossible" : language === "ja" ? "連携を解除できません" : "Cannot disconnect",
        tr ? "Apple şu anda hesabındaki tek giriş yöntemi. Kaldırılırsa hesabına bir daha giriş yapamazsın." : es ? "Apple es el único método de inicio de sesión de tu cuenta. Si lo quitas, te quedarás sin acceso." : pt ? "A Apple é o único método de login da sua conta. Se você removê-la, ficará sem acesso." : de ? "Apple ist die einzige Anmeldemethode deines Kontos. Wenn du es entfernst, sperrst du dich aus." : language === "it" ? "Apple è l'unico metodo di accesso al tuo account. Rimuoverlo ti bloccherebbe fuori." : language === "fr" ? "Apple est la seule méthode de connexion de ton compte. Le retirer t'empêcherait d'y accéder." : language === "ja" ? "Appleはこのアカウントで唯一のサインイン方法です。解除するとサインインできなくなります。" : "Apple is the only sign-in method on your account. Removing it would lock you out.",
        undefined,
        { type: "warning" },
      );
      return;
    }
    appAlert(
      tr ? "Apple bağlantısı kaldırılsın mı?" : es ? "¿Desvincular Apple?" : pt ? "Desvincular a Apple?" : de ? "Apple trennen?" : language === "it" ? "Disconnetti Apple?" : language === "fr" ? "Déconnecter Apple ?" : language === "ja" ? "Appleの連携を解除しますか?" : "Disconnect Apple?",
      tr ? "Apple ile giriş artık bu Seelogd hesabında kullanılamayacak." : es ? "Iniciar sesión con Apple dejará de funcionar para esta cuenta de Seelogd." : pt ? "Entrar com a Apple deixará de funcionar para esta conta do Seelogd." : de ? "Die Anmeldung mit Apple funktioniert für dieses Seelogd-Konto nicht mehr." : language === "it" ? "Accedi con Apple non funzionerà più per questo account Seelogd." : language === "fr" ? "Se connecter avec Apple ne fonctionnera plus pour ce compte Seelogd." : language === "ja" ? "このSeelogdアカウントでAppleでサインインが使えなくなります。" : "Sign in with Apple will no longer work for this Seelogd account.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : pt ? "Cancelar" : de ? "Abbrechen" : language === "it" ? "Annulla" : language === "fr" ? "Annuler" : language === "ja" ? "キャンセル" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : es ? "Desvincular" : pt ? "Desvincular" : de ? "Trennen" : language === "it" ? "Disconnettersi" : language === "fr" ? "Déconnecter" : language === "ja" ? "連携を解除" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("apple");
            try {
              await unlinkAppleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Apple bağlantısı kaldırıldı" : es ? "Apple desvinculado" : pt ? "Apple desvinculada" : de ? "Apple getrennt" : language === "it" ? "Apple disconnesso" : language === "fr" ? "Apple déconnecté" : language === "ja" ? "Appleの連携を解除しました" : "Apple disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : es ? "La acción ha fallado" : pt ? "A ação falhou" : de ? "Aktion fehlgeschlagen" : language === "it" ? "Azione fallita" : language === "fr" ? "L'action a échoué" : language === "ja" ? "操作に失敗しました" : "Action failed",
                describeAppleAuthError(error, language),
                undefined,
                { type: "error" },
              );
            } finally {
              refresh();
              setBusyAction(null);
            }
          },
        },
      ],
    );
  };

  const connectApple = () => {
    if (busy || appleLinked || !appleAvailable) return;
    appAlert(
      tr ? "Apple hesabını bağla" : es ? "Vincular cuenta de Apple" : pt ? "Vincular conta da Apple" : de ? "Apple-Konto verknüpfen" : language === "it" ? "Connetti account Apple" : language === "fr" ? "Connecter un compte Apple" : language === "ja" ? "Appleアカウントを連携" : "Connect Apple account",
      tr ? "Devam edersen Apple hesabındaki kimlik bilgilerini mevcut Seelogd profilinle ilişkilendirmeyi onaylarsın. Profilin ve mevcut verilerin korunur." : es ? "Al continuar, aceptas asociar tu identidad de Apple a tu perfil de Seelogd actual. Tu perfil y tus datos no cambian." : pt ? "Ao continuar, você aceita associar sua identidade da Apple ao seu perfil atual do Seelogd. Seu perfil e seus dados não mudam." : de ? "Wenn du fortfährst, stimmst du zu, deine Apple-Identität mit deinem bestehenden Seelogd-Profil zu verknüpfen. Dein Profil und deine vorhandenen Daten bleiben unverändert." : language === "it" ? "Continuando, acconsenti ad associare la tua identità Apple al tuo profilo Seelogd esistente. Il tuo profilo e i dati esistenti rimangono intatti." : language === "fr" ? "En continuant, tu acceptes d'associer ton identité Apple à ton profil Seelogd existant. Ton profil et tes données restent intacts." : language === "ja" ? "続けると、Appleのアカウント情報を既存のSeelogdプロフィールに関連付けることに同意したことになります。プロフィールと既存のデータはそのままです。" : "By continuing, you consent to associating your Apple identity with your existing Seelogd profile. Your profile and existing data stay intact.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : pt ? "Cancelar" : de ? "Abbrechen" : language === "it" ? "Annulla" : language === "fr" ? "Annuler" : language === "ja" ? "キャンセル" : "Cancel", style: "cancel" },
        {
          text: tr ? "Devam et" : es ? "Continuar" : pt ? "Continuar" : de ? "Weiter" : language === "it" ? "Continua" : language === "fr" ? "Continuer" : language === "ja" ? "続ける" : "Continue",
          onPress: async () => {
            setBusyAction("apple");
            try {
              await linkAppleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Apple hesabı bağlandı" : es ? "Cuenta de Apple vinculada" : pt ? "Conta da Apple vinculada" : de ? "Apple-Konto verknüpft" : language === "it" ? "Account Apple connesso" : language === "fr" ? "Compte Apple connecté" : language === "ja" ? "Appleアカウントを連携しました" : "Apple account connected",
              });
            } catch (error) {
              if (error?.code === AppleAuthCode.CANCELLED) return;
              appAlert(
                tr ? "Apple hesabı bağlanamadı" : es ? "No se pudo vincular Apple" : pt ? "Não foi possível vincular a Apple" : de ? "Apple konnte nicht verknüpft werden" : language === "it" ? "Impossibile connettere Apple" : language === "fr" ? "Impossible de connecter Apple" : language === "ja" ? "Appleを連携できませんでした" : "Could not connect Apple",
                describeAppleAuthError(error, language),
                undefined,
                { type: "error" },
              );
            } finally {
              refresh();
              setBusyAction(null);
            }
          },
        },
      ],
    );
  };

  const submitPassword = async () => {
    if (busy || !passwordReady) return;
    setBusyAction("password");
    try {
      await addPasswordSignIn({ password, confirmation: passwordAgain });
      setPassword("");
      setPasswordAgain("");
      setPasswordOpen(false);
      refresh();
      Toast.show({
        type: "success",
        text1: tr ? "Parola ile giriş etkinleştirildi" : es ? "Inicio de sesión con contraseña activado" : pt ? "Login com senha ativado" : de ? "Passwort-Anmeldung aktiviert" : language === "it" ? "Accesso tramite password abilitato" : language === "fr" ? "Connexion par mot de passe activée" : language === "ja" ? "パスワードでのサインインを有効にしました" : "Password sign-in enabled",
        text2: tr ? "Artık e-posta adresin ve parolanla da giriş yapabilirsin." : es ? "Ahora también puedes iniciar sesión con tu correo y tu contraseña." : pt ? "Agora você também pode entrar com seu e-mail e sua senha." : de ? "Du kannst dich jetzt auch mit deiner E-Mail-Adresse und deinem Passwort anmelden." : language === "it" ? "Ora puoi anche accedere con il tuo indirizzo email e la tua password." : language === "fr" ? "Tu peux désormais aussi te connecter avec ton e-mail et ton mot de passe." : language === "ja" ? "メールアドレスとパスワードでもサインインできるようになりました。" : "You can now also sign in with your email and password.",
      });
    } catch (error) {
      appAlert(
        tr ? "Parola eklenemedi" : es ? "No se pudo añadir la contraseña" : pt ? "Não foi possível adicionar a senha" : de ? "Passwort konnte nicht hinzugefügt werden" : language === "it" ? "Impossibile aggiungere la password" : language === "fr" ? "Impossible d'ajouter le mot de passe" : language === "ja" ? "パスワードを追加できませんでした" : "Could not add password",
        describeAccountConnectionError(error, language),
        undefined,
        { type: "error" },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const offerPasswordReset = () => {
    if (busy || !passwordLinked) return;
    appAlert(
      tr ? "Parolanı değiştir" : es ? "Cambia tu contraseña" : pt ? "Altere sua senha" : de ? "Passwort ändern" : language === "it" ? "Cambia password" : language === "fr" ? "Changer ton mot de passe" : language === "ja" ? "パスワードを変更" : "Change your password",
      tr ? `${user?.email || ""} adresine güvenli parola yenileme bağlantısı gönderilecek.` : es ? `Se enviará un enlace seguro para restablecer la contraseña a ${user?.email || "tu correo"}.` : pt ? `Um link seguro para redefinir a senha será enviado para ${user?.email || "seu e-mail"}.` : de ? `Ein sicherer Link zum Zurücksetzen des Passworts wird an ${user?.email || "deine E-Mail-Adresse"} gesendet.` : language === "it" ? `Un collegamento sicuro per la reimpostazione della password verrà inviato a ${user?.email || "your email"}.` : language === "fr" ? `Un lien sécurisé de réinitialisation du mot de passe sera envoyé à ${user?.email || "ton e-mail"}.` : language === "ja" ? `安全なパスワード再設定リンクを${user?.email || "あなたのメールアドレス"}に送信します。` : `A secure password reset link will be sent to ${user?.email || "your email"}.`,
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : pt ? "Cancelar" : de ? "Abbrechen" : language === "it" ? "Annulla" : language === "fr" ? "Annuler" : language === "ja" ? "キャンセル" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı gönder" : es ? "Enviar enlace" : pt ? "Enviar link" : de ? "Link senden" : language === "it" ? "Invia collegamento" : language === "fr" ? "Envoyer le lien" : language === "ja" ? "リンクを送信" : "Send link",
          onPress: async () => {
            setBusyAction("reset");
            try {
              await sendCurrentUserPasswordReset();
              Toast.show({
                type: "success",
                text1: tr ? "Parola yenileme e-postası gönderildi" : es ? "Correo de restablecimiento enviado" : pt ? "E-mail de redefinição enviado" : de ? "E-Mail zum Zurücksetzen des Passworts gesendet" : language === "it" ? "Email per la reimpostazione della password inviata" : language === "fr" ? "E-mail de réinitialisation envoyé" : language === "ja" ? "パスワード再設定メールを送信しました" : "Password reset email sent",
              });
            } catch (error) {
              appAlert(
                tr ? "E-posta gönderilemedi" : es ? "No se pudo enviar el correo" : pt ? "Não foi possível enviar o e-mail" : de ? "E-Mail konnte nicht gesendet werden" : language === "it" ? "Impossibile inviare e-mail" : language === "fr" ? "Impossible d'envoyer l'e-mail" : language === "ja" ? "メールを送信できませんでした" : "Could not send email",
                describeAccountConnectionError(error, language),
                undefined,
                { type: "error" },
              );
            } finally {
              setBusyAction(null);
            }
          },
        },
      ],
    );
  };

  const togglePasswordPanel = () => {
    if (busy) return;
    if (passwordLinked) {
      offerPasswordReset();
      return;
    }
    setPasswordOpen((value) => !value);
  };

  const statusPill = (linked, action, labels) =>
    busyAction === action ? (
      <LensLoader size="small" color={C.accent} />
    ) : (
      <View
        style={[
          styles.status,
          { backgroundColor: linked ? C.iconGreen : C.accentDim },
        ]}
      >
        <Text style={[styles.statusText, { color: linked ? C.green : C.accent }]}>
          {linked ? labels.linked : labels.unlinked}
        </Text>
      </View>
    );

  return (
    <SettingsSubScreen
      title={tr ? "Hesap bağlantıları" : es ? "Cuentas vinculadas" : pt ? "Contas vinculadas" : de ? "Kontoverknüpfungen" : language === "it" ? "Connessioni all'account" : language === "fr" ? "Comptes connectés" : language === "ja" ? "アカウント連携" : "Account connections"}
    >
      <SectionLabel color={C.muted}>
        {tr ? "HESABIN" : es ? "TU CUENTA" : pt ? "SUA CONTA" : de ? "DEIN KONTO" : language === "it" ? "IL TUO ACCOUNT" : language === "fr" ? "TON COMPTE" : language === "ja" ? "あなたのアカウント" : "YOUR ACCOUNT"}
      </SectionLabel>
      <GlassBox role="card"
        style={[
          styles.identityCard,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <View style={[styles.identityIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="person" size={22} color={C.accent} />
        </View>
        <View style={styles.identityText}>
          <Text style={[styles.identityName, { color: C.text }]} numberOfLines={1}>
            {user?.displayName || (tr ? "Seelogd hesabı" : es ? "Cuenta de Seelogd" : pt ? "Conta do Seelogd" : de ? "Seelogd-Konto" : language === "it" ? "Account Seelogd" : language === "fr" ? "Compte Seelogd" : language === "ja" ? "Seelogdアカウント" : "Seelogd account")}
          </Text>
          <Text style={[styles.identityEmail, { color: C.muted }]} numberOfLines={1}>
            {user?.email || (tr ? "E-posta bilgisi yok" : es ? "Sin correo electrónico" : pt ? "Sem e-mail" : de ? "Keine E-Mail-Adresse verfügbar" : language === "it" ? "Nessuna email disponibile" : language === "fr" ? "Aucun e-mail disponible" : language === "ja" ? "メールアドレスがありません" : "No email available")}
          </Text>
          <View style={styles.identityMeta}>
            <View style={[styles.miniBadge, { backgroundColor: C.iconGreen }]}>
              <AppIcon family="Ionicons" name="shield-checkmark" size={10} color={C.green} />
              <Text style={[styles.miniBadgeText, { color: C.green }]}>
                {user?.emailVerified
                  ? tr ? "Doğrulandı" : es ? "Verificado" : pt ? "Verificado" : de ? "Bestätigt" : language === "it" ? "Verificato" : language === "fr" ? "Vérifié" : language === "ja" ? "確認済み" : "Verified"
                  : tr ? "Oturum açık" : es ? "Sesión iniciada" : pt ? "Sessão iniciada" : de ? "Angemeldet" : language === "it" ? "Accesso effettuato" : language === "fr" ? "Connecté" : language === "ja" ? "サインイン済み" : "Signed in"}
              </Text>
            </View>
            <Text style={[styles.methodCount, { color: C.muted }]}>
              {tr ? `${providerCount} giriş yöntemi` : es ? `${providerCount} ${providerCount === 1 ? "método" : "métodos"} de inicio de sesión` : pt ? `${providerCount} ${providerCount === 1 ? "método" : "métodos"} de login` : de ? `${providerCount} ${providerCount === 1 ? "Anmeldemethode" : "Anmeldemethoden"}` : language === "it" ? `${providerCount} accesso ${providerCount === 1 ? "method" : "methods"}` : language === "fr" ? `${providerCount} ${providerCount === 1 ? "méthode" : "méthodes"} de connexion` : language === "ja" ? `サインイン${providerCount === 1 ? "方法" : "方法"}:${providerCount}` : `${providerCount} sign-in ${providerCount === 1 ? "method" : "methods"}`}
            </Text>
          </View>
        </View>
      </GlassBox>

      <SectionLabel color={C.muted}>
        {tr ? "GİRİŞ YÖNTEMLERİ" : es ? "MÉTODOS DE INICIO DE SESIÓN" : pt ? "MÉTODOS DE LOGIN" : de ? "ANMELDEMETHODEN" : language === "it" ? "METODI DI ACCESSO" : language === "fr" ? "MÉTHODES DE CONNEXION" : language === "ja" ? "サインイン方法" : "SIGN-IN METHODS"}
      </SectionLabel>
      <View
        style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}
      >
        <SettingRow
          colors={C}
          iconBg="#FFFFFF"
          iconColor="#4285F4"
          iconName="logo-google"
          title="Google"
          subtitle={
            googleLinked
              ? tr ? `${providerDetails["google.com"]?.email || user?.email || "Google hesabı"} · bağlı` : es ? `${providerDetails["google.com"]?.email || user?.email || "Cuenta de Google"} · vinculada` : pt ? `${providerDetails["google.com"]?.email || user?.email || "Conta do Google"} · vinculada` : de ? `${providerDetails["google.com"]?.email || user?.email || "Google-Konto"} · verknüpft` : language === "it" ? `${providerDetails["google.com"]?.email || user?.email || "Google account"} · connesso` : language === "fr" ? `${providerDetails["google.com"]?.email || user?.email || "Compte Google"} · connecté` : language === "ja" ? `${providerDetails["google.com"]?.email || user?.email || "Googleアカウント"} · 連携済み` : `${providerDetails["google.com"]?.email || user?.email || "Google account"} · connected`
              : tr ? "Daha hızlı ve güvenli giriş yap" : es ? "Inicia sesión más rápido y de forma segura" : pt ? "Entre mais rápido e com segurança" : de ? "Melde dich schneller und sicher an" : language === "it" ? "Accedi in modo più rapido e sicuro" : language === "fr" ? "Connecte-toi plus vite et en toute sécurité" : language === "ja" ? "より速く安全にサインイン" : "Sign in faster and securely"
          }
          onPress={googleLinked ? disconnectGoogle : connectGoogle}
          right={
            statusPill(googleLinked, "google", {
              linked: tr ? "Bağlı" : es ? "Vinculado" : pt ? "Vinculado" : de ? "Verknüpft" : language === "it" ? "Connesso" : language === "fr" ? "Connecté" : language === "ja" ? "連携済み" : "Connected",
              unlinked: tr ? "Bağla" : es ? "Vincular" : pt ? "Vincular" : de ? "Verknüpfen" : language === "it" ? "Connetti" : language === "fr" ? "Connecter" : language === "ja" ? "連携" : "Connect",
            })
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.text}
          iconColor={C.bg}
          iconName="logo-apple"
          title="Apple"
          subtitle={
            appleLinked
              ? tr ? `${providerDetails["apple.com"]?.email || user?.email || "Apple hesabı"} · bağlı` : es ? `${providerDetails["apple.com"]?.email || user?.email || "Cuenta de Apple"} · vinculada` : pt ? `${providerDetails["apple.com"]?.email || user?.email || "Conta da Apple"} · vinculada` : de ? `${providerDetails["apple.com"]?.email || user?.email || "Apple-Konto"} · verknüpft` : language === "it" ? `${providerDetails["apple.com"]?.email || user?.email || "Apple account"} · connesso` : language === "fr" ? `${providerDetails["apple.com"]?.email || user?.email || "Compte Apple"} · connecté` : language === "ja" ? `${providerDetails["apple.com"]?.email || user?.email || "Appleアカウント"} · 連携済み` : `${providerDetails["apple.com"]?.email || user?.email || "Apple account"} · connected`
              : appleAvailable
                ? tr ? "Apple hesabını bağla" : es ? "Conecta tu cuenta de Apple" : pt ? "Conecte sua conta da Apple" : de ? "Verknüpfe dein Apple-Konto" : language === "it" ? "Connetti il ​​tuo account Apple" : language === "fr" ? "Connecte ton compte Apple" : language === "ja" ? "Appleアカウントを連携" : "Connect your Apple account"
                : tr ? "Apple bağlantısı iPhone veya iPad üzerinden yapılabilir" : es ? "Apple se puede conectar desde un iPhone o un iPad" : pt ? "A Apple pode ser conectada em um iPhone ou iPad" : de ? "Apple lässt sich von einem iPhone oder iPad aus verknüpfen" : language === "it" ? "Apple può essere connesso da un iPhone o iPad" : language === "fr" ? "Apple peut être connecté depuis un iPhone ou un iPad" : language === "ja" ? "AppleはiPhoneまたはiPadから連携できます" : "Apple can be connected from an iPhone or iPad"
          }
          onPress={appleLinked ? disconnectApple : appleAvailable ? connectApple : undefined}
          right={statusPill(appleLinked, "apple", {
            linked: tr ? "Bağlı" : es ? "Vinculado" : pt ? "Vinculado" : de ? "Verknüpft" : language === "it" ? "Connesso" : language === "fr" ? "Connecté" : language === "ja" ? "連携済み" : "Connected",
            unlinked: appleAvailable
              ? tr ? "Bağla" : es ? "Vincular" : pt ? "Vincular" : de ? "Verknüpfen" : language === "it" ? "Connetti" : language === "fr" ? "Connecter" : language === "ja" ? "連携" : "Connect"
              : Platform.OS === "ios" ? tr ? "Kullanılamıyor" : es ? "No disponible" : pt ? "Indisponível" : de ? "Nicht verfügbar" : language === "it" ? "Non disponibile" : language === "fr" ? "Indisponible" : language === "ja" ? "利用不可" : "Unavailable" : tr ? "iOS gerekli" : es ? "Requiere iOS" : pt ? "Requer iOS" : de ? "iOS erforderlich" : language === "it" ? "iOS richiesto" : language === "fr" ? "iOS requis" : language === "ja" ? "iOSが必要です" : "iOS required",
          })}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="mail-outline"
          title={tr ? "E-posta ve şifre" : es ? "Correo y contraseña" : pt ? "E-mail e senha" : de ? "E-Mail und Passwort" : language === "it" ? "E-mail e password" : language === "fr" ? "E-mail et mot de passe" : language === "ja" ? "メールアドレスとパスワード" : "Email and password"}
          subtitle={
            passwordLinked
              ? tr ? "Etkin" : es ? "Activo" : pt ? "Ativo" : de ? "Aktiv" : language === "it" ? "Attivo" : language === "fr" ? "Actif" : language === "ja" ? "有効" : "Active"
              : tr ? "Ayarlı değil" : es ? "Sin configurar" : pt ? "Não configurado" : de ? "Nicht eingerichtet" : language === "it" ? "Non configurato" : language === "fr" ? "Non configuré" : language === "ja" ? "未設定" : "Not configured"
          }
          onPress={togglePasswordPanel}
          last={!passwordOpen}
          right={
            statusPill(passwordLinked, passwordLinked ? "reset" : "password", {
              linked: tr ? "Değiştir" : es ? "Cambiar" : pt ? "Alterar" : de ? "Ändern" : language === "it" ? "Modifica" : language === "fr" ? "Changer" : language === "ja" ? "変更" : "Change",
              unlinked: tr ? "Parola ekle" : es ? "Añadir contraseña" : pt ? "Adicionar senha" : de ? "Passwort hinzufügen" : language === "it" ? "Aggiungi password" : language === "fr" ? "Ajouter un mot de passe" : language === "ja" ? "パスワードを追加" : "Add password",
            })
          }
        />
        {passwordOpen && !passwordLinked ? (
          <View
            style={[
              styles.passwordPanel,
              { backgroundColor: C.cardAlt, borderTopColor: C.borderMuted },
            ]}
          >
            <Text style={[styles.passwordTitle, { color: C.text }]}>
              {tr ? "E-posta ile girişi etkinleştir" : es ? "Activar el inicio de sesión con correo" : pt ? "Ativar o login com e-mail" : de ? "E-Mail-Anmeldung aktivieren" : language === "it" ? "Abilita l'accesso tramite posta elettronica" : language === "fr" ? "Activer la connexion par e-mail" : language === "ja" ? "メールでのサインインを有効にする" : "Enable email sign-in"}
            </Text>
            <Text style={[styles.passwordDescription, { color: C.muted }]}>
              {tr ? `${user?.email || "Hesabın"} için bir parola oluştur. Google bağlantın korunur; iki yöntem de aynı profile açılır.` : es ? `Crea una contraseña para ${user?.email || "tu cuenta"}. Google sigue vinculado y ambos métodos abren el mismo perfil.` : pt ? `Crie uma senha para ${user?.email || "sua conta"}. O Google continua vinculado e os dois métodos abrem o mesmo perfil.` : de ? `Erstelle ein Passwort für ${user?.email || "dein Konto"}. Google bleibt verknüpft und beide Methoden öffnen dasselbe Profil.` : language === "it" ? `Crea una password per ${user?.email || "your account"}. Google rimane connesso ed entrambi i metodi aprono lo stesso profilo.` : language === "fr" ? `Crée un mot de passe pour ${user?.email || "ton compte"}. Google reste connecté et les deux méthodes ouvrent le même profil.` : language === "ja" ? `${user?.email || "あなたのアカウント"}のパスワードを作成します。Googleは連携されたままで、どちらの方法でも同じプロフィールが開きます。` : `Create a password for ${user?.email || "your account"}. Google stays connected and both methods open the same profile.`}
            </Text>

            <GlassBox role="field" style={[styles.inputShell, { borderColor: C.border, backgroundColor: C.card }]}>
              <AppIcon family="Ionicons" name="lock-closed-outline" size={15} color={C.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                maxLength={128}
                placeholder={tr ? "Yeni parola" : es ? "Contraseña nueva" : pt ? "Nova senha" : de ? "Neues Passwort" : language === "it" ? "Nuova password" : language === "fr" ? "Nouveau mot de passe" : language === "ja" ? "新しいパスワード" : "New password"}
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                style={[styles.input, { color: C.text }]}
              />
              <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                <AppIcon
                  family="Ionicons"
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={17}
                  color={C.muted}
                />
              </TouchableOpacity>
            </GlassBox>
            <GlassBox role="field" style={[styles.inputShell, { borderColor: C.border, backgroundColor: C.card }]}>
              <AppIcon family="Ionicons" name="checkmark-circle-outline" size={15} color={C.muted} />
              <TextInput
                value={passwordAgain}
                onChangeText={setPasswordAgain}
                maxLength={128}
                placeholder={tr ? "Parolayı tekrar yaz" : es ? "Repite la contraseña" : pt ? "Repita a senha" : de ? "Passwort wiederholen" : language === "it" ? "Ripeti la password" : language === "fr" ? "Répète le mot de passe" : language === "ja" ? "パスワードを再入力" : "Repeat password"}
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={submitPassword}
                style={[styles.input, { color: C.text }]}
              />
            </GlassBox>

            <View style={styles.passwordRules}>
              <Rule
                ok={password.length >= 6}
                text={tr ? "En az 6 karakter" : es ? "Mínimo 6 caracteres" : pt ? "Mínimo de 6 caracteres" : de ? "Mindestens 6 Zeichen" : language === "it" ? "Almeno 6 caratteri" : language === "fr" ? "Au moins 6 caractères" : language === "ja" ? "6文字以上" : "At least 6 characters"}
                colors={C}
              />
              <Rule
                ok={password.length > 0 && password === passwordAgain}
                text={tr ? "Parolalar eşleşiyor" : es ? "Las contraseñas coinciden" : pt ? "As senhas coincidem" : de ? "Passwörter stimmen überein" : language === "it" ? "Le password corrispondono" : language === "fr" ? "Les mots de passe correspondent" : language === "ja" ? "パスワードが一致しています" : "Passwords match"}
                colors={C}
              />
            </View>

            <GlassTouchable
              disabled={!passwordReady || busy}
              activeOpacity={0.75}
              onPress={submitPassword}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: passwordReady ? C.accent : alpha(C.muted, 0.2),
                  opacity: busy && busyAction !== "password" ? 0.6 : 1,
                },
              ]}
            >
              {busyAction === "password" ? (
                <LensLoader tone="mono" size="small" color="#fff" />
              ) : (
                <>
                  <AppIcon family="Ionicons" name="key-outline" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {tr ? "Parolayı ekle" : es ? "Añadir contraseña" : pt ? "Adicionar senha" : de ? "Passwort hinzufügen" : language === "it" ? "Aggiungi password" : language === "fr" ? "Ajouter un mot de passe" : language === "ja" ? "パスワードを追加" : "Add password"}
                  </Text>
                </>
              )}
            </GlassTouchable>
          </View>
        ) : null}
      </View>

      <Text style={[styles.note, { color: C.muted }]}>
        {tr ? "Bağlı giriş yöntemlerinden herhangi biriyle aynı Seelogd profiline erişebilirsin. Tek giriş yöntemi, hesaba erişimini kaybetmemen için kaldırılamaz." : es ? "Cualquier método vinculado abre el mismo perfil de Seelogd. Tu único método de inicio de sesión no se puede quitar, para proteger el acceso a tu cuenta." : pt ? "Qualquer método vinculado abre o mesmo perfil do Seelogd. Seu único método de login não pode ser removido, para proteger o acesso à sua conta." : de ? "Jede verknüpfte Methode öffnet dasselbe Seelogd-Profil. Deine einzige Anmeldemethode kann nicht entfernt werden, um den Kontozugriff zu schützen." : language === "it" ? "Qualsiasi metodo connesso apre lo stesso profilo Seelogd. Il tuo unico metodo di accesso non può essere rimosso per proteggere l'accesso all'account." : language === "fr" ? "Toute méthode connectée ouvre le même profil Seelogd. Ta seule méthode de connexion ne peut pas être retirée afin de protéger l'accès au compte." : language === "ja" ? "連携したどの方法でも同じSeelogdプロフィールが開きます。アカウントへのアクセスを守るため、唯一のサインイン方法は解除できません。" : "Any connected method opens the same Seelogd profile. Your only sign-in method cannot be removed to protect account access."}
      </Text>
    </SettingsSubScreen>
  );
}

function Rule({ ok, text, colors }) {
  return (
    <View style={styles.rule}>
      <AppIcon
        family="Ionicons"
        name={ok ? "checkmark-circle" : "ellipse-outline"}
        size={13}
        color={ok ? colors.green : colors.muted}
      />
      <Text style={[styles.ruleText, { color: ok ? colors.green : colors.muted }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  identityIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1 },
  identityName: { fontSize: 15, fontWeight: "700" },
  identityEmail: { fontSize: 11.5, marginTop: 3 },
  identityMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniBadgeText: { fontSize: 9.5, fontWeight: "700" },
  methodCount: { fontSize: 10.5 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "800" },
  passwordPanel: {
    padding: 14,
    borderTopWidth: 1,
  },
  passwordTitle: { fontSize: 13.5, fontWeight: "700" },
  passwordDescription: { fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 12 },
  inputShell: {
    minHeight: 45,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 9,
  },
  input: { flex: 1, fontSize: 13, paddingVertical: 10 },
  passwordRules: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 1 },
  rule: { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleText: { fontSize: 10.5 },
  primaryButton: {
    minHeight: 43,
    borderRadius: 12,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryButtonText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  note: { fontSize: 11.5, lineHeight: 17, paddingHorizontal: 5, marginTop: 12 },
});
