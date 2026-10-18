import { isLightSurface } from "../../utils/colorUtils";
// Şifremi unuttum ekranı — ortak auth görsel dili (components/auth/AuthKit.js):
// accent'ten türeyen arka plan ışıması, halkalı rozet, vurgu çizgili tek kart,
// odakta renk geçişi yapan alan ve degrade ana düğme. Gönderim sonrası kart,
// onay rozeti + e-posta çipi + "Giriş yap" ana eylemine döner.
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import * as Haptics from "@services/hapticsService";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import Toast from "@components/AppToast";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenDecor from "../../components/ScreenDecor";
import EmailSuffixRow from "../../components/auth/EmailSuffixRow";
import {
  AUTH_SUCCESS,
  AuthBackButton,
  AuthBackdrop,
  AuthBadge,
  AuthCard,
  AuthField,
  AuthFooterLink,
  AuthHero,
  AuthPrimaryButton,
  AuthSecondaryButton,
  Reveal,
  authColumn,
} from "../../components/auth/AuthKit";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();

  const accent = theme.accent;
  const isLightTheme = isLightSurface(theme.primary);
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
          {!sent ? (
            <>
              <Reveal>
                <AuthHero
                  theme={theme}
                  badge={
                    <AuthBadge accent={accent} surface={theme.secondary} size={68}>
                      <Ionicons name="key-outline" size={30} color={accent} />
                    </AuthBadge>
                  }
                  title={i18nText("autoI18n.hesap_erisimini_kurtar", "Hesap erişimini kurtar")}
                  subtitle={i18nText(
                    "autoI18n.sifre_sifirlama_baglantisi_epostana_gonderilecek",
                    "Şifre sıfırlama bağlantısı e-postana gönderilecek.",
                  )}
                />
              </Reveal>

              <Reveal delay={90} style={authColumn}>
                <AuthCard theme={theme} accent={accent}>
                  {/* E-posta */}
                  <AuthField
                    theme={theme}
                    accent={accent}
                    fieldSurface={fieldSurface}
                    icon="mail-outline"
                    placeholder={t.ForgotPasswordScreen.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={resetPassword}
                    onChangeText={setEmail}
                    value={email}
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

                  <AuthPrimaryButton
                    label={t.ForgotPasswordScreen.send}
                    icon="send"
                    accent={accent}
                    enabled={emailValid}
                    loading={isloading}
                    onPress={() => {
                      buzz();
                      resetPassword();
                    }}
                  />
                </AuthCard>
              </Reveal>

              <Reveal delay={170}>
                <AuthFooterLink
                  theme={theme}
                  accent={accent}
                  text={i18nText("autoI18n.sifreni_hatirladin_mi", "Şifreni hatırladın mı?")}
                  link={t.ForgotPasswordScreen.loginButton}
                  onPress={goLogin}
                />
              </Reveal>
            </>
          ) : (
            /* Başarı durumu */
            <Reveal style={authColumn}>
              <AuthCard theme={theme} accent={AUTH_SUCCESS} style={styles.successCard}>
                <AuthBadge accent={accent} tone={AUTH_SUCCESS} surface={theme.secondary}>
                  <Ionicons name="checkmark" size={38} color={AUTH_SUCCESS} />
                </AuthBadge>

                <Text
                  allowFontScaling={false}
                  style={[styles.successTitle, { color: theme.text.primary }]}
                >
                  {i18nText("autoI18n.e_posta_gonderildi", "E-posta Gönderildi!")}
                </Text>

                <View
                  style={[
                    styles.emailPill,
                    {
                      backgroundColor: alpha(accent, 0.1),
                      borderColor: alpha(accent, 0.32),
                    },
                  ]}
                >
                  <Ionicons name="mail-outline" size={16} color={accent} />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.emailPillText, { color: accent }]}
                  >
                    {email}
                  </Text>
                </View>

                <Text style={[styles.successSubtitle, { color: theme.text.secondary }]}>
                  {i18nText(
                    "autoI18n.adresine_sifre_sifirlama_baglantisi_gonderildi_gel",
                    "adresine şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.",
                  )}
                </Text>

                <View
                  style={[
                    styles.spamHint,
                    { backgroundColor: fieldSurface, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.text.muted}
                  />
                  <Text style={[styles.spamHintText, { color: theme.text.muted }]}>
                    {i18nText(
                      "autoI18n.eposta_gelmezse_spam_klasorunu_kontrol_et",
                      "E-posta gelmezse spam/gereksiz klasörünü de kontrol et.",
                    )}
                  </Text>
                </View>

                <View style={styles.successActions}>
                  <AuthPrimaryButton
                    label={t.ForgotPasswordScreen.loginButton}
                    accent={accent}
                    onPress={() => {
                      buzz();
                      goLogin();
                    }}
                  />
                  <AuthSecondaryButton
                    label={i18nText("autoI18n.tekrar_gonder", "Tekrar gönder")}
                    icon="refresh-outline"
                    theme={theme}
                    fieldSurface={fieldSurface}
                    onPress={() => {
                      buzz();
                      setSent(false);
                    }}
                  />
                </View>
              </AuthCard>
            </Reveal>
          )}
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

  // ── Başarı durumu ──
  successCard: {
    alignItems: "center",
    paddingTop: 30,
    gap: 12,
  },
  successTitle: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 6,
    textAlign: "center",
  },
  emailPill: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  emailPillText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  successSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  spamHint: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  spamHintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  successActions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 4,
  },
});
