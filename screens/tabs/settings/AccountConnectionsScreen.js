import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { auth } from "../../../firebase";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import { appAlert } from "../../../components/AppAlert";
import {
  describeGoogleAuthError,
  GoogleAuthCode,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from "../../../services/googleAuthService";
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
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const user = auth.currentUser;
  const providers = useMemo(
    () => user?.providerData.map((item) => item.providerId) || [],
    [revision, user]
  );
  const googleLinked = providers.includes("google.com");
  const passwordLinked = providers.includes("password");

  const refresh = () => setRevision((value) => value + 1);

  const connectGoogle = async () => {
    if (busy || googleLinked) return;
    setBusy(true);
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
      setBusy(false);
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
            setBusy(true);
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
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SettingsSubScreen
      title={tr ? "Hesap bağlantıları" : "Account connections"}
    >
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
                ? "Hesabına bağlı"
                : "Connected to your account"
              : tr
              ? "Daha hızlı ve güvenli giriş yap"
              : "Sign in faster and securely"
          }
          onPress={googleLinked ? disconnectGoogle : connectGoogle}
          right={
            busy ? (
              <ActivityIndicator size="small" color={C.accent} />
            ) : (
              <View
                style={[
                  styles.status,
                  { backgroundColor: googleLinked ? C.iconGreen : C.accentDim },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: googleLinked ? C.green : C.accent },
                  ]}
                >
                  {googleLinked
                    ? tr
                      ? "Bağlı"
                      : "Connected"
                    : tr
                    ? "Bağla"
                    : "Connect"}
                </Text>
              </View>
            )
          }
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
          last
          right={
            <View
              style={[
                styles.dot,
                { backgroundColor: passwordLinked ? C.green : C.muted },
              ]}
            />
          }
        />
      </View>
      <Text style={[styles.note, { color: C.muted }]}>
        {tr
          ? "Bağlı giriş yöntemlerinden herhangi biriyle aynı Watchify profiline erişebilirsin. Tek giriş yöntemi, hesaba erişimini kaybetmemen için kaldırılamaz."
          : "Any connected method opens the same Watchify profile. Your only sign-in method cannot be removed to protect account access."}
      </Text>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "800" },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 4 },
  note: { fontSize: 11.5, lineHeight: 17, paddingHorizontal: 5, marginTop: 12 },
});
