// components/profile/AccountEmailCard.js
//
// Ayarlar > Hesap bilgileri ekranının en üstündeki "Hesap" kartı: e-posta adresi +
// doğrulama durumu ve katılma tarihi. (11 Kas) Bu iki bilgi eskiden profil başlığında,
// avatarın yanındaki dar sütunda duruyordu; orada yer kaplıyor ve yalnız sahibine
// anlamlıydı — buraya taşındı.
//
// DOĞRULANMAMIŞ E-POSTA: sağdaki durum çipi kırmızı "Doğrulanmadı" olur ve altında
// açıklamalı bir uyarı kutusu çıkar: ne yapılması gerektiği + "tekrar gönder" düğmesi
// (60 sn bekleme sayacıyla; hooks/useEmailVerification.js). Doğrulama durumu ekran
// odağa geldiğinde ve uygulama öne döndüğünde tazelenir, kutu kendiliğinden kalkar.

import React, { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { intlLocaleOf } from "../../utils/appLanguages";
import { i18nText } from "../../utils/i18nText";
import { FormSection } from "./EditProfileKit";

// Doğrulama renkleri temadan bağımsız: her zeminde okunur (profildeki eski rozetle aynı).
const VERIFIED_COLOR = "rgb(29, 161, 242)";
const UNVERIFIED_COLOR = "rgb(229, 57, 53)";

// Firebase `metadata.createdAt` ms cinsinden DİZGE, `creationTime` ise tarih dizgesi.
export function formatAccountJoinDate(value, language) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  const date = new Date(Number.isFinite(numeric) ? numeric : value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(intlLocaleOf(language), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function InfoRow({ theme, icon, label, value, valueProps, trailing, last }) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: alpha(theme.border, 0.9) },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: alpha(theme.accent, 0.1) }]}>
        <Ionicons name={icon} size={15} color={theme.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text allowFontScaling={false} style={[styles.rowLabel, { color: theme.text.muted }]}>
          {label}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.rowValue, { color: theme.text.primary }]}
          {...valueProps}
        >
          {value}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

function StatusChip({ verified }) {
  const color = verified ? VERIFIED_COLOR : UNVERIFIED_COLOR;
  return (
    <View
      testID={verified ? "account-email-verified" : "account-email-unverified"}
      style={[styles.chip, { backgroundColor: alpha(color, 0.12), borderColor: alpha(color, 0.4) }]}
    >
      <Ionicons name={verified ? "checkmark-circle" : "alert-circle"} size={12} color={color} />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color }]}>
        {verified
          ? i18nText("autoI18n.eposta_dogrulandi_cip", "Doğrulandı")
          : i18nText("autoI18n.eposta_dogrulanmadi_cip", "Doğrulanmadı")}
      </Text>
    </View>
  );
}

function AccountEmailCard({ theme, language, email, verified, joinedAt, verifyHint, resend }) {
  const joinDate = formatAccountJoinDate(joinedAt, language);
  if (!email && !joinDate) return null;
  const showWarning = !!email && !verified;
  const resendBlocked = !!resend?.busy || !!resend?.disabled;

  return (
    <FormSection
      theme={theme}
      icon="person-outline"
      title={i18nText("autoI18n.hesap_kart_baslik", "Hesap")}
    >
      <View>
        {!!email && (
          <InfoRow
            theme={theme}
            icon="mail-outline"
            label={i18nText("autoI18n.eposta_etiket", "E-posta")}
            value={email}
            valueProps={{ ellipsizeMode: "middle" }}
            trailing={<StatusChip verified={verified} />}
            last={!joinDate}
          />
        )}
        {!!joinDate && (
          <InfoRow
            theme={theme}
            icon="calendar-outline"
            label={i18nText("autoI18n.katilma_tarihi_etiket", "Katılma tarihi")}
            value={joinDate}
            last
          />
        )}
      </View>

      {showWarning ? (
        <View
          testID="account-email-warning"
          style={[
            styles.warning,
            { backgroundColor: alpha(UNVERIFIED_COLOR, 0.09), borderColor: alpha(UNVERIFIED_COLOR, 0.32) },
          ]}
        >
          <View style={styles.warningHead}>
            <Ionicons name="mail-unread-outline" size={18} color={UNVERIFIED_COLOR} />
            <Text allowFontScaling={false} style={[styles.warningTitle, { color: UNVERIFIED_COLOR }]}>
              {i18nText("autoI18n.eposta_dogrulanmadi_baslik", "E-postan henüz doğrulanmadı")}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.warningText, { color: theme.text.secondary }]}>
            {verifyHint ||
              i18nText(
                "autoI18n.eposta_dogrulanmadi_aciklama",
                "Gelen kutundaki bağlantıya dokun. Bulamazsan gereksiz (spam) klasörüne bak ya da yeniden gönder.",
              )}
          </Text>
          {resend ? (
            <Pressable
              testID="account-verify-resend"
              accessibilityRole="button"
              accessibilityLabel={resend.label}
              accessibilityState={{ disabled: !!resend.disabled, busy: !!resend.busy }}
              disabled={resendBlocked}
              onPress={resend.onPress}
              style={({ pressed }) => [
                styles.resend,
                {
                  backgroundColor: alpha(UNVERIFIED_COLOR, resendBlocked ? 0.1 : 0.16),
                  borderColor: alpha(UNVERIFIED_COLOR, 0.45),
                  opacity: pressed ? 0.75 : resendBlocked ? 0.6 : 1,
                },
              ]}
            >
              {resend.busy ? (
                <ActivityIndicator size="small" color={UNVERIFIED_COLOR} />
              ) : (
                <Ionicons
                  name={resend.disabled ? "time-outline" : "paper-plane-outline"}
                  size={14}
                  color={UNVERIFIED_COLOR}
                />
              )}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.resendText, { color: UNVERIFIED_COLOR }]}
              >
                {resend.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </FormSection>
  );
}

export default memo(AccountEmailCard);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    minWidth: 0,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 11.5, fontWeight: "600" },
  rowValue: { fontSize: 14.5, fontWeight: "700" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "800" },
  warning: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  warningHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  warningTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  warningText: { fontSize: 12.5, fontWeight: "500", lineHeight: 18 },
  resend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resendText: { flexShrink: 1, fontSize: 13, fontWeight: "800" },
});
