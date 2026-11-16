// screens/auth/EmailVerificationScreen.js
//
// E-POSTA DOĞRULAMA KAPISI (16 Kas 2026; bkz. utils/emailVerificationGate.js).
// E-postası doğrulanmamış e-posta+şifre hesabı uygulamaya bu ekrandan öteye geçemez.
// App.js bu ekranı gezginin YERİNE çizer — bu yüzden `navigation` yok, kendi başına
// çalışır. Üç eylem: doğrulandı mı denetle, e-postayı tekrar gönder, çıkış yap.
//
// Uygulama öne dönünce (kullanıcı bağlantıya posta uygulamasında tıklayıp geri
// geldiğinde) sessizce yeniden denetlenir; doğrulanmışsa kendiliğinden içeri alınır.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { signOut } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "@components/AppToast";
import ScreenDecor from "../../components/ScreenDecor";
import GlassTouchable from "../../components/common/GlassTouchable";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { refreshVerification } from "../../utils/emailVerificationGate";
import { fillAuthEmailText, getAuthEmailCopy } from "../../utils/authEmailCopy";
import {
  AuthEmailCode,
  authEmailErrorMessage,
  classifyAuthEmailError,
  sendVerificationEmail,
  verificationCooldownLeft,
} from "../../services/authEmail";
import useCooldown from "../../hooks/useCooldown";

const RESEND_COOLDOWN_S = 60;

export default function EmailVerificationScreen() {
  const { pendingVerificationUser: user, markEmailVerified } = useAuth();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const copy = getAuthEmailCopy(language);
  const isLight = isLightSurface(theme.primary);

  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { remaining, start: startCooldown, active: cooling } = useCooldown();
  const busy = useRef(false);

  // Kayıt ekranı az önce gönderdiyse bekleme buradan devam eder (Firebase art arda
  // gönderimde too-many-requests verip geçici kilitliyor).
  useEffect(() => {
    const left = verificationCooldownLeft(user?.uid, RESEND_COOLDOWN_S);
    if (left > 0) startCooldown(left);
  }, [user?.uid, startCooldown]);

  // Oturum geçersiz (hesap silinmiş / devre dışı / jeton bozuk): burada beklemek
  // işe yaramaz, kullanıcıyı giriş ekranına döndür.
  const failSession = useCallback((error) => {
    if (classifyAuthEmailError(error) !== AuthEmailCode.NO_SESSION) return false;
    Toast.show({ type: "error", text1: authEmailErrorMessage(error, language) });
    signOut(auth).catch(() => {});
    return true;
  }, [language]);

  const check = useCallback(
    async ({ silent = false } = {}) => {
      if (!user || busy.current) return;
      busy.current = true;
      if (!silent) setChecking(true);
      try {
        const verified = await refreshVerification(user);
        if (verified) {
          Toast.show({ type: "success", text1: copy.nowVerified });
          markEmailVerified();
        } else if (!silent) {
          Toast.show({ type: "info", text1: copy.gateNotYet, text2: copy.spamHint });
        }
      } catch (error) {
        if (failSession(error)) return;
        if (!silent) Toast.show({ type: "error", text1: authEmailErrorMessage(error, language) });
      } finally {
        busy.current = false;
        if (!silent) setChecking(false);
      }
    },
    [user, copy, language, markEmailVerified, failSession],
  );

  // Firebase kullanıcıyı diskten ESKİ emailVerified=false ile geri yükler: bağlantıya
  // uygulama kapalıyken (ya da başka cihazda) tıklayan kullanıcı "Doğruladım"a basmadan
  // kapıda kalıyordu. Ekran açılır açılmaz sessizce sunucudan denetle.
  useEffect(() => {
    check({ silent: true });
    // yalnız ilk açılışta; sonrası AppState ile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Posta uygulamasından geri dönünce sessiz denetim.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check({ silent: true });
    });
    return () => sub.remove();
  }, [check]);

  const resend = useCallback(async () => {
    if (!user || sending || cooling) return;
    setSending(true);
    try {
      const result = await sendVerificationEmail(user, { language });
      if (result.alreadyVerified) {
        await check({ silent: true });
        return;
      }
      startCooldown(RESEND_COOLDOWN_S);
      Toast.show({
        type: "success",
        text1: fillAuthEmailText(copy.verificationSent, { email: user.email || "" }),
        text2: copy.spamHint,
      });
    } catch (error) {
      if (failSession(error)) return;
      if (error?.code === AuthEmailCode.TOO_MANY) startCooldown(RESEND_COOLDOWN_S);
      Toast.show({ type: "error", text1: authEmailErrorMessage(error, language) });
    } finally {
      setSending(false);
    }
  }, [user, sending, cooling, language, copy, startCooldown, check, failSession]);

  const leave = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch {
      setSigningOut(false);
    }
  }, [signingOut]);

  const resendLabel = cooling
    ? fillAuthEmailText(copy.resendWait, { n: remaining })
    : copy.resendVerification;

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="auth" iconOpacity={isLight ? 0.05 : 0.08} />
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name="mail-unread-outline" size={30} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text.primary }]}>{copy.gateTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>
          {fillAuthEmailText(copy.gateBody, { email: user?.email || "" })}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={styles.emailRow}>
            <Ionicons name="at-outline" size={18} color={theme.text.muted} />
            <Text
              style={[styles.email, { color: theme.text.primary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {user?.email || ""}
            </Text>
          </View>

          <GlassTouchable
            accessibilityRole="button"
            onPress={() => check()}
            disabled={checking}
            style={[styles.primary, { backgroundColor: theme.accent }, checking && styles.disabled]}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />
                <Text style={styles.primaryText}>{copy.gateCheck}</Text>
              </>
            )}
          </GlassTouchable>
        </View>

        <View
          style={[
            styles.card,
            styles.resendCard,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.resendHead}>
            <Ionicons name="help-circle-outline" size={18} color={theme.accent} />
            <Text style={[styles.resendTitle, { color: theme.text.primary }]}>{copy.gateNoEmailTitle}</Text>
          </View>
          <Text style={[styles.resendHint, { color: theme.text.muted }]}>{copy.gateNoEmailHint}</Text>

          <GlassTouchable
            accessibilityRole="button"
            accessibilityLabel={copy.resendVerification}
            onPress={resend}
            disabled={sending || cooling}
            style={[
              styles.secondary,
              { borderColor: theme.border },
              (sending || cooling) && styles.disabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color={theme.text.primary} />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={16} color={theme.text.primary} />
                <Text style={[styles.secondaryText, { color: theme.text.primary }]}>{resendLabel}</Text>
              </>
            )}
          </GlassTouchable>

          <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.gateWrongEmail}</Text>
        </View>

        <Text style={[styles.why, { color: theme.text.muted }]}>{copy.gateWhy}</Text>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={leave}
          disabled={signingOut}
          style={styles.cancel}
        >
          <Text style={[styles.cancelText, { color: theme.text.muted }]}>{copy.gateSignOut}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    alignItems: "center",
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  email: { flex: 1, fontSize: 14, fontWeight: "800" },
  primary: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondary: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  resendCard: { marginTop: 12 },
  resendHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendTitle: { fontSize: 14, fontWeight: "900" },
  resendHint: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  secondaryText: { fontSize: 13.5, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.5 },
  hint: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 2 },
  why: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 18,
  },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  cancelText: { fontSize: 13, fontWeight: "700" },
});
