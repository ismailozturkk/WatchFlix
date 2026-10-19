// components/premium/RedeemCodeSheet.js
//
// "Kodun var mı?" alt sayfası: tek alanda iki tür kod.
//   • Promosyon kodu  → 1 ay ücretsiz Premium (yönetici üretir, kişi sayısı sınırlı)
//   • Davet kodu      → bir arkadaşın kodu; ilk aboneliğe indirim
// Hangisi olduğuna sunucu karar verir (functions/index.js → redeemCode); burası yalnız
// kodu gönderir, cevaba göre mesaj gösterir. Kabuk BottomSheetModal'dır.
//
// Başarıda `onRedeemed(sonuç)` çağrılır ve sayfa kapanır; plan değişimi (ücretsiz ay) profil
// belgesinden kendiliğinden gelir (PremiumContext sunucu planını okur).

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { redeemCode, referralErrorReason } from "@services/referralService";
import { copyLanguage, intlLocaleOf } from "@utils/appLanguages";
import { REFERRAL_COPY } from "@utils/referralCopy";
import { alpha } from "@theme/colors";

const COPY_LANGUAGES = Object.keys(REFERRAL_COPY);

/** Sunucu red gerekçesini kullanıcı metnine çevirir; tanınmayan hata genel mesaj. */
export function redeemErrorMessage(copy, error, windowDays = 14) {
  const reason = referralErrorReason(error);
  const entry = reason ? copy.errors[reason] : null;
  if (typeof entry === "function") return entry(windowDays);
  return entry || copy.errors.generic;
}

export function formatRedeemDate(ms, language) {
  try {
    return new Intl.DateTimeFormat(intlLocaleOf(language), {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export default function RedeemCodeSheet({ visible, onClose, onRedeemed }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const copy = REFERRAL_COPY[copyLanguage(language, COPY_LANGUAGES)];

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // Her açılışta temiz başla (kapanış animasyonu sürerken alan boşalmasın: yalnız açılırken).
  useEffect(() => {
    if (visible) {
      setCode("");
      setMessage(null);
      setBusy(false);
    }
  }, [visible]);

  const canSubmit = code.replace(/[\s-]/g, "").length >= 4 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemCode(code);
      trackEvent(ANALYTICS_EVENTS.CODE_REDEEM, { outcome: result?.kind || "unknown" });
      onRedeemed?.(result);
      onClose?.();
    } catch (error) {
      trackEvent(ANALYTICS_EVENTS.CODE_REDEEM, {
        outcome: referralErrorReason(error) || "error",
      });
      setMessage(redeemErrorMessage(copy, error));
    } finally {
      setBusy(false);
    }
  };

  const fieldBg = alpha(theme.text.primary, 0.06);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={busy ? undefined : onClose}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 12) + 12,
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: alpha(theme.text.muted, 0.45) }]} />
      <View style={styles.titleRow}>
        <View style={[styles.icon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
          <AppIcon family="Ionicons" name="gift-outline" size={20} color={theme.accent} />
        </View>
        <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
          {copy.redeem.sheetTitle}
        </Text>
      </View>
      <Text style={[styles.body, { color: theme.text.muted }]}>{copy.redeem.sheetBody}</Text>

      <TextInput
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          if (message) setMessage(null);
        }}
        placeholder={copy.redeem.placeholder}
        placeholderTextColor={alpha(theme.text.muted, 0.7)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={24}
        returnKeyType="done"
        onSubmitEditing={submit}
        editable={!busy}
        accessibilityLabel={copy.redeem.sheetTitle}
        style={[
          styles.input,
          {
            color: theme.text.primary,
            backgroundColor: fieldBg,
            borderColor: message ? theme.colors.red : theme.border,
          },
        ]}
      />
      {message ? (
        <Text style={[styles.error, { color: theme.colors.red }]} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accent, opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text allowFontScaling={false} style={styles.buttonText}>
            {copy.redeem.apply}
          </Text>
        )}
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3, flex: 1 },
  body: { fontSize: 13.5, lineHeight: 19, marginBottom: 16 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  error: { fontSize: 13, marginTop: 10, textAlign: "center", lineHeight: 18 },
  button: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
