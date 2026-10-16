import { normalizeAppLanguage } from "../../../utils/appLanguages";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
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

export default function AccountConnectionsScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
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

  const refresh = () => setRevision((value) => value + 1);

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
          text1: tr ? "Google hesabı bağlandı" : es ? "Cuenta de Google vinculada" : "Google account connected",
        });
      }
    } catch (error) {
      if (error?.code === GoogleAuthCode.CANCELLED) return;
      appAlert(
        tr ? "Google hesabı bağlanamadı" : es ? "No se pudo vincular Google" : "Could not connect Google",
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
        tr ? "Bağlantı kaldırılamaz" : es ? "No se puede desvincular" : "Cannot disconnect",
        tr ? "Google şu anda hesabındaki tek giriş yöntemi. Kaldırılırsa hesabına bir daha giriş yapamazsın." : es ? "Google es el único método de inicio de sesión de tu cuenta. Si lo quitas, te quedarás sin acceso." : "Google is the only sign-in method on your account. Removing it would lock you out.",
        undefined,
        { type: "warning" }
      );
      return;
    }
    appAlert(
      tr ? "Google bağlantısı kaldırılsın mı?" : es ? "¿Desvincular Google?" : "Disconnect Google?",
      tr ? "Google ile giriş artık kullanılamayacak." : es ? "Ya no podrás iniciar sesión con Google." : "You will no longer be able to sign in with Google.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : es ? "Desvincular" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("google");
            try {
              await unlinkGoogleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Google bağlantısı kaldırıldı" : es ? "Google desvinculado" : "Google disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : es ? "La acción ha fallado" : "Action failed",
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
        tr ? "Bağlantı kaldırılamaz" : es ? "No se puede desvincular" : "Cannot disconnect",
        tr ? "Apple şu anda hesabındaki tek giriş yöntemi. Kaldırılırsa hesabına bir daha giriş yapamazsın." : es ? "Apple es el único método de inicio de sesión de tu cuenta. Si lo quitas, te quedarás sin acceso." : "Apple is the only sign-in method on your account. Removing it would lock you out.",
        undefined,
        { type: "warning" },
      );
      return;
    }
    appAlert(
      tr ? "Apple bağlantısı kaldırılsın mı?" : es ? "¿Desvincular Apple?" : "Disconnect Apple?",
      tr ? "Apple ile giriş artık bu Seelogd hesabında kullanılamayacak." : es ? "Iniciar sesión con Apple dejará de funcionar para esta cuenta de Seelogd." : "Sign in with Apple will no longer work for this Seelogd account.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : es ? "Desvincular" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("apple");
            try {
              await unlinkAppleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Apple bağlantısı kaldırıldı" : es ? "Apple desvinculado" : "Apple disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : es ? "La acción ha fallado" : "Action failed",
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
      tr ? "Apple hesabını bağla" : es ? "Vincular cuenta de Apple" : "Connect Apple account",
      tr ? "Devam edersen Apple hesabındaki kimlik bilgilerini mevcut Seelogd profilinle ilişkilendirmeyi onaylarsın. Profilin ve mevcut verilerin korunur." : es ? "Al continuar, aceptas asociar tu identidad de Apple a tu perfil de Seelogd actual. Tu perfil y tus datos no cambian." : "By continuing, you consent to associating your Apple identity with your existing Seelogd profile. Your profile and existing data stay intact.",
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: tr ? "Devam et" : es ? "Continuar" : "Continue",
          onPress: async () => {
            setBusyAction("apple");
            try {
              await linkAppleAccount();
              Toast.show({
                type: "success",
                text1: tr ? "Apple hesabı bağlandı" : es ? "Cuenta de Apple vinculada" : "Apple account connected",
              });
            } catch (error) {
              if (error?.code === AppleAuthCode.CANCELLED) return;
              appAlert(
                tr ? "Apple hesabı bağlanamadı" : es ? "No se pudo vincular Apple" : "Could not connect Apple",
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
        text1: tr ? "Parola ile giriş etkinleştirildi" : es ? "Inicio de sesión con contraseña activado" : "Password sign-in enabled",
        text2: tr ? "Artık e-posta adresin ve parolanla da giriş yapabilirsin." : es ? "Ahora también puedes iniciar sesión con tu correo y tu contraseña." : "You can now also sign in with your email and password.",
      });
    } catch (error) {
      appAlert(
        tr ? "Parola eklenemedi" : es ? "No se pudo añadir la contraseña" : "Could not add password",
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
      tr ? "Parolanı değiştir" : es ? "Cambia tu contraseña" : "Change your password",
      tr ? `${user?.email || ""} adresine güvenli parola yenileme bağlantısı gönderilecek.` : es ? `Se enviará un enlace seguro para restablecer la contraseña a ${user?.email || "tu correo"}.` : `A secure password reset link will be sent to ${user?.email || "your email"}.`,
      [
        { text: tr ? "Vazgeç" : es ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı gönder" : es ? "Enviar enlace" : "Send link",
          onPress: async () => {
            setBusyAction("reset");
            try {
              await sendCurrentUserPasswordReset();
              Toast.show({
                type: "success",
                text1: tr ? "Parola yenileme e-postası gönderildi" : es ? "Correo de restablecimiento enviado" : "Password reset email sent",
              });
            } catch (error) {
              appAlert(
                tr ? "E-posta gönderilemedi" : es ? "No se pudo enviar el correo" : "Could not send email",
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
      <ActivityIndicator size="small" color={C.accent} />
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
      title={tr ? "Hesap bağlantıları" : es ? "Cuentas vinculadas" : "Account connections"}
    >
      <SectionLabel color={C.muted}>
        {tr ? "HESABIN" : es ? "TU CUENTA" : "YOUR ACCOUNT"}
      </SectionLabel>
      <View
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
            {user?.displayName || (tr ? "Seelogd hesabı" : es ? "Cuenta de Seelogd" : "Seelogd account")}
          </Text>
          <Text style={[styles.identityEmail, { color: C.muted }]} numberOfLines={1}>
            {user?.email || (tr ? "E-posta bilgisi yok" : es ? "Sin correo electrónico" : "No email available")}
          </Text>
          <View style={styles.identityMeta}>
            <View style={[styles.miniBadge, { backgroundColor: C.iconGreen }]}>
              <AppIcon family="Ionicons" name="shield-checkmark" size={10} color={C.green} />
              <Text style={[styles.miniBadgeText, { color: C.green }]}>
                {user?.emailVerified
                  ? tr ? "Doğrulandı" : es ? "Verificado" : "Verified"
                  : tr ? "Oturum açık" : es ? "Sesión iniciada" : "Signed in"}
              </Text>
            </View>
            <Text style={[styles.methodCount, { color: C.muted }]}>
              {tr ? `${providerCount} giriş yöntemi` : es ? `${providerCount} ${providerCount === 1 ? "método" : "métodos"} de inicio de sesión` : `${providerCount} sign-in ${providerCount === 1 ? "method" : "methods"}`}
            </Text>
          </View>
        </View>
      </View>

      <SectionLabel color={C.muted}>
        {tr ? "GİRİŞ YÖNTEMLERİ" : es ? "MÉTODOS DE INICIO DE SESIÓN" : "SIGN-IN METHODS"}
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
              ? tr ? `${providerDetails["google.com"]?.email || user?.email || "Google hesabı"} · bağlı` : es ? `${providerDetails["google.com"]?.email || user?.email || "Cuenta de Google"} · vinculada` : `${providerDetails["google.com"]?.email || user?.email || "Google account"} · connected`
              : tr ? "Daha hızlı ve güvenli giriş yap" : es ? "Inicia sesión más rápido y de forma segura" : "Sign in faster and securely"
          }
          onPress={googleLinked ? disconnectGoogle : connectGoogle}
          right={
            statusPill(googleLinked, "google", {
              linked: tr ? "Bağlı" : es ? "Vinculado" : "Connected",
              unlinked: tr ? "Bağla" : es ? "Vincular" : "Connect",
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
              ? tr ? `${providerDetails["apple.com"]?.email || user?.email || "Apple hesabı"} · bağlı` : es ? `${providerDetails["apple.com"]?.email || user?.email || "Cuenta de Apple"} · vinculada` : `${providerDetails["apple.com"]?.email || user?.email || "Apple account"} · connected`
              : tr
              ? appleAvailable
                ? "Apple hesabını bağla"
                : "Apple bağlantısı iPhone veya iPad üzerinden yapılabilir"
              : appleAvailable
                ? "Connect your Apple account"
                : "Apple can be connected from an iPhone or iPad"
          }
          onPress={appleLinked ? disconnectApple : appleAvailable ? connectApple : undefined}
          right={statusPill(appleLinked, "apple", {
            linked: tr ? "Bağlı" : es ? "Vinculado" : "Connected",
            unlinked: appleAvailable
              ? tr ? "Bağla" : es ? "Vincular" : "Connect"
              : Platform.OS === "ios" ? tr ? "Kullanılamıyor" : es ? "No disponible" : "Unavailable" : tr ? "iOS gerekli" : es ? "Requiere iOS" : "iOS required",
          })}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="mail-outline"
          title={tr ? "E-posta ve şifre" : es ? "Correo y contraseña" : "Email and password"}
          subtitle={
            passwordLinked
              ? tr ? "Etkin" : es ? "Activo" : "Active"
              : tr ? "Ayarlı değil" : es ? "Sin configurar" : "Not configured"
          }
          onPress={togglePasswordPanel}
          last={!passwordOpen}
          right={
            statusPill(passwordLinked, passwordLinked ? "reset" : "password", {
              linked: tr ? "Değiştir" : es ? "Cambiar" : "Change",
              unlinked: tr ? "Parola ekle" : es ? "Añadir contraseña" : "Add password",
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
              {tr ? "E-posta ile girişi etkinleştir" : es ? "Activar el inicio de sesión con correo" : "Enable email sign-in"}
            </Text>
            <Text style={[styles.passwordDescription, { color: C.muted }]}>
              {tr ? `${user?.email || "Hesabın"} için bir parola oluştur. Google bağlantın korunur; iki yöntem de aynı profile açılır.` : es ? `Crea una contraseña para ${user?.email || "tu cuenta"}. Google sigue vinculado y ambos métodos abren el mismo perfil.` : `Create a password for ${user?.email || "your account"}. Google stays connected and both methods open the same profile.`}
            </Text>

            <View style={[styles.inputShell, { borderColor: C.border, backgroundColor: C.card }]}>
              <AppIcon family="Ionicons" name="lock-closed-outline" size={15} color={C.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                maxLength={128}
                placeholder={tr ? "Yeni parola" : es ? "Contraseña nueva" : "New password"}
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
            </View>
            <View style={[styles.inputShell, { borderColor: C.border, backgroundColor: C.card }]}>
              <AppIcon family="Ionicons" name="checkmark-circle-outline" size={15} color={C.muted} />
              <TextInput
                value={passwordAgain}
                onChangeText={setPasswordAgain}
                maxLength={128}
                placeholder={tr ? "Parolayı tekrar yaz" : es ? "Repite la contraseña" : "Repeat password"}
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={submitPassword}
                style={[styles.input, { color: C.text }]}
              />
            </View>

            <View style={styles.passwordRules}>
              <Rule
                ok={password.length >= 6}
                text={tr ? "En az 6 karakter" : es ? "Mínimo 6 caracteres" : "At least 6 characters"}
                colors={C}
              />
              <Rule
                ok={password.length > 0 && password === passwordAgain}
                text={tr ? "Parolalar eşleşiyor" : es ? "Las contraseñas coinciden" : "Passwords match"}
                colors={C}
              />
            </View>

            <TouchableOpacity
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <AppIcon family="Ionicons" name="key-outline" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {tr ? "Parolayı ekle" : es ? "Añadir contraseña" : "Add password"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Text style={[styles.note, { color: C.muted }]}>
        {tr ? "Bağlı giriş yöntemlerinden herhangi biriyle aynı Seelogd profiline erişebilirsin. Tek giriş yöntemi, hesaba erişimini kaybetmemen için kaldırılamaz." : es ? "Cualquier método vinculado abre el mismo perfil de Seelogd. Tu único método de inicio de sesión no se puede quitar, para proteger el acceso a tu cuenta." : "Any connected method opens the same Seelogd profile. Your only sign-in method cannot be removed to protect account access."}
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
