import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  unlinkAccountProvider,
} from "../../../services/accountConnectionsService";
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
  const [busyAction, setBusyAction] = useState(null);
  const [revision, setRevision] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const connectGoogle = async () => {
    if (busy || googleLinked) return;
    setBusyAction("google");
    try {
      const result = await linkGoogleAccount();
      if (!result.cancelled) {
        Toast.show({
          type: "success",
          text1: tr ? "Google hesabı bağlandı" : "Google account connected",
        });
      }
    } catch (error) {
      if (error?.code === GoogleAuthCode.CANCELLED) return;
      appAlert(
        tr ? "Google hesabı bağlanamadı" : "Could not connect Google",
        describeGoogleAuthError(error, tr),
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
        tr ? "Bağlantı kaldırılamaz" : "Cannot disconnect",
        tr
          ? "Google şu anda hesabındaki tek giriş yöntemi. Kaldırılırsa hesabına bir daha giriş yapamazsın."
          : "Google is the only sign-in method on your account. Removing it would lock you out.",
        undefined,
        { type: "warning" }
      );
      return;
    }
    appAlert(
      tr ? "Google bağlantısı kaldırılsın mı?" : "Disconnect Google?",
      tr
        ? "Google ile giriş artık kullanılamayacak."
        : "You will no longer be able to sign in with Google.",
      [
        { text: tr ? "Vazgeç" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("google");
            try {
              await unlinkGoogleAccount();
              Toast.show({
                type: "success",
                text1: tr
                  ? "Google bağlantısı kaldırıldı"
                  : "Google disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : "Action failed",
                describeGoogleAuthError(error, tr),
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
    appAlert(
      tr ? "Apple bağlantısı kaldırılsın mı?" : "Disconnect Apple?",
      tr
        ? "Apple ile giriş artık bu Seelogd hesabında kullanılamayacak."
        : "Sign in with Apple will no longer work for this Seelogd account.",
      [
        { text: tr ? "Vazgeç" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı kaldır" : "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusyAction("apple");
            try {
              await unlinkAccountProvider("apple.com");
              Toast.show({
                type: "success",
                text1: tr ? "Apple bağlantısı kaldırıldı" : "Apple disconnected",
              });
            } catch (error) {
              appAlert(
                tr ? "İşlem başarısız" : "Action failed",
                describeAccountConnectionError(error, tr),
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
        text1: tr ? "Parola ile giriş etkinleştirildi" : "Password sign-in enabled",
        text2: tr
          ? "Artık e-posta adresin ve parolanla da giriş yapabilirsin."
          : "You can now also sign in with your email and password.",
      });
    } catch (error) {
      appAlert(
        tr ? "Parola eklenemedi" : "Could not add password",
        describeAccountConnectionError(error, tr),
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
      tr ? "Parolanı değiştir" : "Change your password",
      tr
        ? `${user?.email || ""} adresine güvenli parola yenileme bağlantısı gönderilecek.`
        : `A secure password reset link will be sent to ${user?.email || "your email"}.`,
      [
        { text: tr ? "Vazgeç" : "Cancel", style: "cancel" },
        {
          text: tr ? "Bağlantıyı gönder" : "Send link",
          onPress: async () => {
            setBusyAction("reset");
            try {
              await sendCurrentUserPasswordReset();
              Toast.show({
                type: "success",
                text1: tr ? "Parola yenileme e-postası gönderildi" : "Password reset email sent",
              });
            } catch (error) {
              appAlert(
                tr ? "E-posta gönderilemedi" : "Could not send email",
                describeAccountConnectionError(error, tr),
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
      title={tr ? "Hesap bağlantıları" : "Account connections"}
    >
      <SectionLabel color={C.muted}>
        {tr ? "HESABIN" : "YOUR ACCOUNT"}
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
            {user?.displayName || (tr ? "Seelogd hesabı" : "Seelogd account")}
          </Text>
          <Text style={[styles.identityEmail, { color: C.muted }]} numberOfLines={1}>
            {user?.email || (tr ? "E-posta bilgisi yok" : "No email available")}
          </Text>
          <View style={styles.identityMeta}>
            <View style={[styles.miniBadge, { backgroundColor: C.iconGreen }]}>
              <AppIcon family="Ionicons" name="shield-checkmark" size={10} color={C.green} />
              <Text style={[styles.miniBadgeText, { color: C.green }]}>
                {user?.emailVerified
                  ? tr ? "Doğrulandı" : "Verified"
                  : tr ? "Oturum açık" : "Signed in"}
              </Text>
            </View>
            <Text style={[styles.methodCount, { color: C.muted }]}>
              {tr
                ? `${providerCount} giriş yöntemi`
                : `${providerCount} sign-in ${providerCount === 1 ? "method" : "methods"}`}
            </Text>
          </View>
        </View>
      </View>

      <SectionLabel color={C.muted}>
        {tr ? "GİRİŞ YÖNTEMLERİ" : "SIGN-IN METHODS"}
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
              ? tr
                ? `${providerDetails["google.com"]?.email || user?.email || "Google hesabı"} · bağlı`
                : `${providerDetails["google.com"]?.email || user?.email || "Google account"} · connected`
              : tr
              ? "Daha hızlı ve güvenli giriş yap"
              : "Sign in faster and securely"
          }
          onPress={googleLinked ? disconnectGoogle : connectGoogle}
          right={
            statusPill(googleLinked, "google", {
              linked: tr ? "Bağlı" : "Connected",
              unlinked: tr ? "Bağla" : "Connect",
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
              ? tr
                ? `${providerDetails["apple.com"]?.email || user?.email || "Apple hesabı"} · bağlı`
                : `${providerDetails["apple.com"]?.email || user?.email || "Apple account"} · connected`
              : tr
              ? "Bu hesapta bağlı değil"
              : "Not connected to this account"
          }
          onPress={appleLinked ? disconnectApple : undefined}
          right={statusPill(appleLinked, "apple", {
            linked: tr ? "Bağlı" : "Connected",
            unlinked: tr ? "Bağlı değil" : "Not linked",
          })}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="mail-outline"
          title={tr ? "E-posta ve şifre" : "Email and password"}
          subtitle={
            passwordLinked
              ? tr
                ? "Etkin"
                : "Active"
              : tr
              ? "Ayarlı değil"
              : "Not configured"
          }
          onPress={togglePasswordPanel}
          last={!passwordOpen}
          right={
            statusPill(passwordLinked, passwordLinked ? "reset" : "password", {
              linked: tr ? "Değiştir" : "Change",
              unlinked: tr ? "Parola ekle" : "Add password",
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
              {tr ? "E-posta ile girişi etkinleştir" : "Enable email sign-in"}
            </Text>
            <Text style={[styles.passwordDescription, { color: C.muted }]}>
              {tr
                ? `${user?.email || "Hesabın"} için bir parola oluştur. Google bağlantın korunur; iki yöntem de aynı profile açılır.`
                : `Create a password for ${user?.email || "your account"}. Google stays connected and both methods open the same profile.`}
            </Text>

            <View style={[styles.inputShell, { borderColor: C.border, backgroundColor: C.card }]}>
              <AppIcon family="Ionicons" name="lock-closed-outline" size={15} color={C.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                maxLength={128}
                placeholder={tr ? "Yeni parola" : "New password"}
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
                placeholder={tr ? "Parolayı tekrar yaz" : "Repeat password"}
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
                text={tr ? "En az 6 karakter" : "At least 6 characters"}
                colors={C}
              />
              <Rule
                ok={password.length > 0 && password === passwordAgain}
                text={tr ? "Parolalar eşleşiyor" : "Passwords match"}
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
                    {tr ? "Parolayı ekle" : "Add password"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {!appleLinked ? (
        <Text style={[styles.appleNote, { color: C.muted }]}>
          {tr
            ? "Apple bağlantısı, Apple ile giriş daha önce bu hesaba bağlandıysa burada yönetilebilir. Bu sürümde yeni Apple bağlantısı başlatılmıyor."
            : "An existing Sign in with Apple connection can be managed here. This build does not start a new Apple connection."}
        </Text>
      ) : null}

      <Text style={[styles.note, { color: C.muted }]}>
        {tr
          ? "Bağlı giriş yöntemlerinden herhangi biriyle aynı Seelogd profiline erişebilirsin. Tek giriş yöntemi, hesaba erişimini kaybetmemen için kaldırılamaz."
          : "Any connected method opens the same Seelogd profile. Your only sign-in method cannot be removed to protect account access."}
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
  appleNote: { fontSize: 10.5, lineHeight: 15, paddingHorizontal: 5, marginTop: 9 },
  note: { fontSize: 11.5, lineHeight: 17, paddingHorizontal: 5, marginTop: 12 },
});
