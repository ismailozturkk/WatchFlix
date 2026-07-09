// Şifremi unuttum ekranı — IslamicGuide auth tasarım diline göre sadeleştirildi:
// dikeyde ortalanmış düzen, rozetli başlık bloğu, solid yüzeyli tek kart,
// dolgulu input kabuğu ve solid accent ana buton. Blur/gradyan yok.
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
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import * as Haptics from "expo-haptics";
import { useSnow } from "../../context/SnowContext";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconBacground from "../../components/IconBacground";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

const SUCCESS = "rgb(37, 211, 102)";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export default function ForgotPasswordScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { showSnow } = useSnow();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();

  const accent = theme.accent;
  const hairline = theme.border;
  const isLightTheme = selectedTheme === "light" || selectedTheme === "green";
  const fieldSurface = theme.between;

  // Basit e-posta biçim kontrolü — geçersizken gönderim kapalı
  const emailValid = /^\S+@\S+\.\S+$/.test(email);

  const resetPassword = async () => {
    if (isloading || !emailValid) return;
    setIsloading(true);
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      Toast.show({
        type: "success",
        text1: email + t.ForgotPasswordScreen.forgotPasswordToast,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t.ForgotPasswordScreen.forgotPasswordToast1,
      });
    } finally {
      setIsloading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={isLightTheme ? 0.05 : 0.08} />

      {showSnow && (
        <LottieView
          style={styles.lottie}
          source={require("@lottie/snow.json")}
          autoPlay
          loop
          pointerEvents="none"
        />
      )}

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
              <Ionicons name="key-outline" size={28} color={accent} />
            </View>
            <Text allowFontScaling={false} style={[styles.brandTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.hesap_erisimini_kurtar", "Hesap erişimini kurtar")}
            </Text>
            <Text allowFontScaling={false} style={[styles.brandSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.sifre_sifirlama_baglantisi_epostana_gonderilecek", "Şifre sıfırlama bağlantısı e-postana gönderilecek.")}
            </Text>
          </View>

          {/* Kart */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.secondary, borderColor: hairline },
            ]}
          >
            {!sent ? (
              <>
                <Text allowFontScaling={false} style={[styles.cardTitle, { color: theme.text.primary }]}>
                  {t.ForgotPasswordScreen.forgotPassword}
                </Text>
                <Text allowFontScaling={false} style={[styles.cardSub, { color: theme.text.muted }]}>
                  {t.ForgotPasswordScreen.forgotPasswordText}
                </Text>

                {/* E-posta */}
                <View
                  style={[
                    styles.inputShell,
                    {
                      backgroundColor: emailFocused ? alpha(accent, 0.08) : fieldSurface,
                      borderColor: emailFocused ? accent : hairline,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={emailFocused ? accent : theme.text.muted}
                  />
                  <TextInput
                    allowFontScaling={false}
                    style={[styles.textInput, { color: theme.text.primary }]}
                    placeholder={t.ForgotPasswordScreen.email}
                    placeholderTextColor={theme.text.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={resetPassword}
                    onChangeText={setEmail}
                    value={email}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
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

                {/* Gönder butonu — solid accent */}
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: accent, shadowColor: accent },
                    !emailValid && { opacity: 0.55 },
                  ]}
                  onPress={() => {
                    buzz();
                    resetPassword();
                  }}
                  disabled={!emailValid || isloading}
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
                        {t.ForgotPasswordScreen.send}
                      </Text>
                      <Ionicons name="send" size={15} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* Başarı durumu */
              <View style={styles.successContainer}>
                <View
                  style={[
                    styles.successIcon,
                    {
                      backgroundColor: "rgba(37,211,102,0.12)",
                      borderColor: "rgba(37,211,102,0.28)",
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={44} color={SUCCESS} />
                </View>
                <Text allowFontScaling={false} style={[styles.successTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.e_posta_gonderildi", "E-posta Gönderildi!")}
                </Text>
                <Text style={[styles.successSubtitle, { color: theme.text.muted }]}>
                  <Text style={{ color: accent, fontWeight: "700" }}>{email}</Text>{" "}
                  {i18nText("autoI18n.adresine_sifre_sifirlama_baglantisi_gonderildi_gel", "adresine şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.")}
                </Text>

                <View style={styles.spamHintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={theme.text.muted}
                  />
                  <Text style={[styles.spamHintText, { color: theme.text.muted }]}>
                    {i18nText(
                      "autoI18n.eposta_gelmezse_spam_klasorunu_kontrol_et",
                      "E-posta gelmezse spam/gereksiz klasörünü de kontrol et.",
                    )}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.resendButton,
                    { borderColor: hairline, backgroundColor: fieldSurface },
                  ]}
                  onPress={() => {
                    buzz();
                    setSent(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.text.muted} />
                  <Text style={[styles.resendText, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.tekrar_gonder", "Tekrar gönder")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Girişe dön */}
            <View style={styles.footerRow}>
              <Text allowFontScaling={false} style={[styles.footerText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.sifreni_hatirladin_mi", "Şifreni hatırladın mı?")}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate("LoginScreen")}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text allowFontScaling={false} style={[styles.footerLink, { color: accent }]}>
                  {t.ForgotPasswordScreen.loginButton}
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
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
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
    maxWidth: 420,
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

  // ── Başarı durumu ──
  successContainer: {
    alignItems: "center",
    paddingVertical: 6,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  spamHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  spamHintText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 15,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  resendText: {
    fontSize: 13,
    fontWeight: "600",
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
