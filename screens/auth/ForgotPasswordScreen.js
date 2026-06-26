import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconBacground from "../../components/IconBacground";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";


const { width, height } = Dimensions.get("window");
const SUCCESS = "rgb(37, 211, 102)";

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
  const surface = isLightTheme ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.055)";
  const elevatedSurface = isLightTheme ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.075)";
  const fieldSurface = isLightTheme ? "rgba(255,255,255,0.66)" : "rgba(0,0,0,0.18)";

  const resetPassword = async () => {
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
      <View style={styles.backdropWash} pointerEvents="none">
        <LinearGradient
          colors={[
            alpha(accent, isLightTheme ? 0.2 : 0.3),
            alpha(theme.bold, isLightTheme ? 0.08 : 0.14),
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.shapeLayer} pointerEvents="none">
        <View
          style={[
            styles.colorShape,
            styles.shapeOne,
            { backgroundColor: alpha(accent, isLightTheme ? 0.2 : 0.26) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeTwo,
            { backgroundColor: alpha(theme.colors.green, isLightTheme ? 0.14 : 0.2) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeThree,
            { backgroundColor: alpha(theme.colors.orange, isLightTheme ? 0.16 : 0.22) },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        >
          {/* Back button */}
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

          {showSnow && (
            <LottieView
              style={styles.lottie}
              source={require("@lottie/snow.json")}
              autoPlay
              loop
            />
          )}

          <View style={styles.heroHeader}>
            <View
              style={[
                styles.brandPill,
                {
                  backgroundColor: elevatedSurface,
                  borderColor: alpha(accent, 0.28),
                },
              ]}
            >
              <Ionicons name="key-outline" size={15} color={accent} />
              <Text style={[styles.brandPillText, { color: theme.text.primary }]}>
                WATCHFLIX
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.hesap_erisimini_kurtar", "Hesap erişimini kurtar")}
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.sifre_sifirlama_baglantisi_epostana_gonderilecek", "Şifre sıfırlama bağlantısı e-postana gönderilecek.")}
            </Text>
          </View>

          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: surface,
                borderColor: alpha(accent, 0.2),
              },
            ]}
          >
            <View style={styles.heroAccent} pointerEvents="none">
              <LinearGradient
                colors={[alpha(accent, 0.18), "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <LottieView
              source={require("@lottie/forgot_password.json")}
              style={styles.heroAnimation}
              autoPlay
              loop
            />
          </View>

          {/* Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isLightTheme
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(18,18,18,0.28)",
                borderColor: alpha(accent, isLightTheme ? 0.18 : 0.28),
                shadowColor: accent,
              },
            ]}
          >
            <BlurView
              tint="dark"
              intensity={50}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            {!sent ? (
              <>
                <View style={styles.cardEyebrowRow}>
                  <View style={[styles.statusChip, { backgroundColor: alpha(accent, 0.12) }]}>
                    <Ionicons name="mail-unread-outline" size={14} color={accent} />
                    <Text style={[styles.statusChipText, { color: accent }]}>
                      {i18nText("autoI18n.eposta_dogrulamasi", "E-posta doğrulaması")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.title, { color: theme.text.primary }]}>
                  {t.ForgotPasswordScreen.forgotPassword}
                </Text>
                <Text style={[styles.subtitle, { color: theme.text.muted }]}>
                  {t.ForgotPasswordScreen.forgotPasswordText}
                </Text>

                {/* Email input */}
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: emailFocused ? alpha(accent, 0.1) : fieldSurface,
                      borderColor: emailFocused ? alpha(accent, 0.85) : hairline,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={emailFocused ? accent : theme.text.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { color: theme.text.primary }]}
                    placeholder={t.ForgotPasswordScreen.email}
                    placeholderTextColor={theme.text.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={setEmail}
                    value={email}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                {/* Send button */}
                <TouchableOpacity
                  style={[styles.sendButton, { shadowColor: accent }]}
                  onPress={resetPassword}
                  activeOpacity={0.85}
                  disabled={!email || isloading}
                >
                  <LinearGradient
                    colors={[accent, theme.bold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.sendGradient, !email && { opacity: 0.5 }]}
                  >
                    {isloading ? (
                      <LottieView
                        source={require("@lottie/loading15.json")}
                        style={{ width: 36, height: 36 }}
                        autoPlay
                        loop
                      />
                    ) : (
                      <>
                        <Text allowFontScaling={false} style={styles.sendButtonText}>
                          {t.ForgotPasswordScreen.send}
                        </Text>
                        <Ionicons name="send" size={16} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              /* Success state */
              <View style={styles.successContainer}>
                <View
                  style={[
                    styles.successIcon,
                    { backgroundColor: "rgba(37,211,102,0.12)", borderColor: "rgba(37,211,102,0.28)" },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={48} color={SUCCESS} />
                </View>
                <Text style={[styles.successTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.e_posta_gonderildi", "E-posta Gönderildi!")}
                </Text>
                <Text style={[styles.successSubtitle, { color: theme.text.muted }]}>
                  <Text style={{ color: accent, fontWeight: "700" }}>{email}</Text>{" "}
                  {i18nText("autoI18n.adresine_sifre_sifirlama_baglantisi_gonderildi_gel", "adresine şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.")}
                </Text>
                <TouchableOpacity
                  style={[styles.resendButton, { borderColor: hairline, backgroundColor: fieldSurface }]}
                  onPress={() => setSent(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.text.muted} />
                  <Text style={[styles.resendText, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.tekrar_gonder", "Tekrar gönder")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            <View style={[styles.dividerLine, { backgroundColor: hairline }]} />

            {/* Back to login */}
            <TouchableOpacity
              style={[styles.loginLink, { borderColor: hairline, backgroundColor: fieldSurface }]}
              onPress={() => navigation.navigate("LoginScreen")}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back-outline" size={16} color={accent} />
              <Text style={[styles.loginLinkText, { color: theme.text.secondary }]}>
                {t.ForgotPasswordScreen.loginButton}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  backdropWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.46,
    zIndex: 0,
  },
  shapeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  colorShape: {
    position: "absolute",
    borderRadius: 18,
  },
  shapeOne: {
    width: 172,
    height: 74,
    top: height * 0.2,
    left: -46,
    transform: [{ rotate: "-17deg" }],
  },
  shapeTwo: {
    width: 126,
    height: 90,
    top: height * 0.33,
    right: -30,
    transform: [{ rotate: "20deg" }],
  },
  shapeThree: {
    width: 214,
    height: 52,
    top: height * 0.5,
    left: width * 0.35,
    transform: [{ rotate: "-8deg" }],
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
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  heroHeader: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 8,
    marginBottom: 8,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  brandPillText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    paddingHorizontal: 10,
  },
  logoContainer: {
    width: Math.min(width - 104, 240),
    height: 74,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAnimation: {
    width: 112,
    height: 112,
  },
  card: {
    width: width - 32,
    maxWidth: 440,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    marginBottom: 24,
    overflow: "hidden",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardEyebrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontWeight: "600",
  },
  sendButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  sendGradient: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 7,
    marginBottom: 4,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: 0,
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
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
  },
  dividerLine: {
    height: 1,
    width: "100%",
    marginVertical: 16,
  },
  loginLink: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginLinkText: {
    fontSize: 15,
  },
});
