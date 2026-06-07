import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
} from "react-native";
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const GREEN = "#1a6b3c";
const GREEN_LIGHT = "#1e8449";

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const [email, setEmail] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();

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
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={0.3} />

      {/* Ambient blob */}
      <View style={styles.gradientBlob} pointerEvents="none">
        <LinearGradient
          colors={["rgba(26,107,60,0.28)", "transparent"]}
          style={{ width: 260, height: 260, borderRadius: 130 }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: theme.secondary,
              borderColor: "rgba(255,255,255,0.08)",
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
            source={require("../../LottieJson/snow.json")}
            autoPlay
            loop
          />
        )}

        {/* Animation */}
        <View style={styles.logoContainer}>
          <LottieView
            source={require("../../LottieJson/forgot_password.json")}
            style={{ width: 200, height: 200 }}
            autoPlay
            loop
          />
        </View>

        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.secondary,
              borderColor: "rgba(255,255,255,0.07)",
            },
          ]}
        >
          {!sent ? (
            <>
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
                    backgroundColor: theme.primary,
                    borderColor: emailFocused
                      ? GREEN
                      : "rgba(255,255,255,0.07)",
                  },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? GREEN : theme.text.muted}
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
                style={styles.sendButton}
                onPress={resetPassword}
                activeOpacity={0.85}
                disabled={!email || isloading}
              >
                <LinearGradient
                  colors={[GREEN_LIGHT, GREEN]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.sendGradient, !email && { opacity: 0.5 }]}
                >
                  {isloading ? (
                    <LottieView
                      source={require("../../LottieJson/loading15.json")}
                      style={{ width: 36, height: 36 }}
                      autoPlay
                      loop
                    />
                  ) : (
                    <>
                      <Text
                        allowFontScaling={false}
                        style={styles.sendButtonText}
                      >
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
                  { backgroundColor: "rgba(37,211,102,0.12)" },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={48}
                  color="rgb(37,211,102)"
                />
              </View>
              <Text
                style={[styles.successTitle, { color: theme.text.primary }]}
              >
                E-posta Gönderildi!
              </Text>
              <Text
                style={[styles.successSubtitle, { color: theme.text.muted }]}
              >
                <Text style={{ color: GREEN, fontWeight: "700" }}>{email}</Text>{" "}
                adresine şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu
                kontrol edin.
              </Text>
              <TouchableOpacity
                style={[
                  styles.resendButton,
                  { borderColor: "rgba(255,255,255,0.1)" },
                ]}
                onPress={() => setSent(false)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={theme.text.muted}
                />
                <Text style={[styles.resendText, { color: theme.text.muted }]}>
                  Tekrar gönder
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View
            style={[
              styles.dividerLine,
              { backgroundColor: "rgba(255,255,255,0.06)" },
            ]}
          />

          {/* Back to login */}
          <TouchableOpacity
            style={[
              styles.loginLink,
              { borderColor: "rgba(255,255,255,0.09)" },
            ]}
            onPress={() => navigation.navigate("LoginScreen")}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back-outline" size={16} color={GREEN} />
            <Text
              style={[styles.loginLinkText, { color: theme.text.secondary }]}
            >
              {t.ForgotPasswordScreen.loginButton}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    paddingTop: 160,
  },
  gradientBlob: {
    position: "absolute",
    bottom: 80,
    right: -50,
    zIndex: 0,
  },
  backButton: {
    position: "absolute",
    top: 52,
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
  logoContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  card: {
    width: width - 32,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: "hidden",
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
  },
  sendButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 4,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  sendGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: -0.3,
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
    marginVertical: 20,
  },
  loginLink: {
    height: 48,
    borderRadius: 14,
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
