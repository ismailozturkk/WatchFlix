// screens/tabs/settings/ReferralScreen.js
//
// Ayarlar > Seelogd Premium > "Arkadaşını davet et".
//
// Akış: kullanıcı kodunu paylaşır → arkadaşı kayıt olup Premium sayfasındaki "Kodun var mı?"
// alanına girer (ilk aboneliğine indirim) → arkadaşı İLK ücretli aboneliğini başlatınca
// kullanıcı 1 ay ücretsiz Premium kazanır. Burada kod, davet edilenlerin durumu
// (Kayıt oldu → Abone oldu → ödül), kazanılan aylar ve kod girişi görünür.
//
// Tüm veri sunucudan tek callable ile gelir (hooks/useReferralOverview); kurallar
// functions/referral.js'te. Bu ekran hiçbir kararı kendi vermez.

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import Toast from "@components/AppToast";
import UserAvatar from "@components/common/UserAvatar";
import RedeemCodeSheet, {
  formatRedeemDate,
  redeemErrorMessage,
} from "@components/premium/RedeemCodeSheet";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useReferralOverview from "@hooks/useReferralOverview";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { claimReferralReward } from "@services/referralService";
import { copyLanguage } from "@utils/appLanguages";
import {
  buildReferralShareMessage,
  inviteeStatusLook,
  rewardState,
} from "@utils/referral";
import { REFERRAL_COPY } from "@utils/referralCopy";
import { alpha } from "@theme/colors";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";
import GlassPressable from "../../../components/common/GlassPressable";

const COPY_LANGUAGES = Object.keys(REFERRAL_COPY);

function Card({ C, children, style }) {
  return (
    <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }, style]}>
      {children}
    </View>
  );
}

function SectionTitle({ C, children }) {
  return (
    <Text allowFontScaling={false} style={[st.sectionTitle, { color: C.muted }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function StatusChip({ status, label, C }) {
  const look = inviteeStatusLook(status);
  const color = look.tone === "success" ? C.green : C.muted;
  return (
    <View style={[st.chip, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.34) }]}>
      <AppIcon family="Ionicons" name={look.icon} size={12} color={color} />
      <Text allowFontScaling={false} numberOfLines={1} style={[st.chipText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export default function ReferralScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const C = buildUiColors(theme);
  const copy = REFERRAL_COPY[copyLanguage(language, COPY_LANGUAGES)];
  const { data, loading, error, reload } = useReferralOverview();

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const reward = useMemo(
    () =>
      data
        ? rewardState({
            creditMonths: data.creditMonths,
            promoUntilMs: data.promoUntilMs,
            storeSubscribed: data.storeSubscribed,
          })
        : null,
    [data],
  );
  const percent = data?.limits?.discountPercent ?? 30;

  const copyCode = useCallback(async () => {
    if (!data?.code) return;
    await Clipboard.setStringAsync(data.displayCode);
    trackEvent(ANALYTICS_EVENTS.REFERRAL_ACTION, { action: "copy" });
    Toast.success(copy.copied);
  }, [copy.copied, data]);

  const shareCode = useCallback(async () => {
    if (!data?.code) return;
    trackEvent(ANALYTICS_EVENTS.REFERRAL_ACTION, { action: "share" });
    try {
      await Share.share({
        message: buildReferralShareMessage(copy, { displayCode: data.displayCode, percent }),
      });
    } catch {
      // Paylaşım penceresi kapatıldı ya da açılamadı: sessiz.
    }
  }, [copy, data, percent]);

  const startReward = useCallback(async () => {
    if (claiming || !reward?.canStart) return;
    setClaiming(true);
    try {
      const { untilMs } = await claimReferralReward();
      trackEvent(ANALYTICS_EVENTS.REFERRAL_ACTION, { action: "claim" });
      Toast.success(copy.reward.started(formatRedeemDate(untilMs, language)));
      await reload();
    } catch (err) {
      Toast.error(redeemErrorMessage(copy, err));
    } finally {
      setClaiming(false);
    }
  }, [claiming, copy, language, reload, reward?.canStart]);

  const onRedeemed = useCallback(
    (result) => {
      if (result?.kind === "promo") {
        Toast.success(copy.redeem.promoSuccess(result.days, formatRedeemDate(result.untilMs, language)));
      } else {
        Toast.success(copy.redeem.referralSuccess(result?.discount?.percent ?? percent, result?.inviterName));
      }
      reload();
    },
    [copy, language, percent, reload],
  );

  return (
    <SettingsSubScreen title={copy.screenTitle}>
      {/* Üst kart: vaat */}
      <LinearGradient
        colors={[alpha(C.purple, 0.32), alpha(C.accent, 0.2)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[st.hero, { borderColor: alpha(C.purple, 0.4) }]}
      >
        <View style={[st.heroIcon, { backgroundColor: alpha(C.white, 0.16) }]}>
          <AppIcon family="Ionicons" name="gift" size={24} color={C.text} />
        </View>
        <Text allowFontScaling={false} style={[st.heroTitle, { color: C.text }]}>
          {copy.hero.title}
        </Text>
        <Text style={[st.heroBody, { color: C.muted }]}>{copy.hero.body(percent)}</Text>
      </LinearGradient>

      {loading && !data ? (
        <ActivityIndicator style={st.loader} color={C.accent} />
      ) : null}

      {error && !data ? (
        <Card C={C} style={st.errorCard}>
          <Text style={[st.errorText, { color: C.muted }]}>{copy.loadFailed}</Text>
          <GlassPressable onPress={reload} accessibilityRole="button" style={[st.retry, { borderColor: C.border }]}>
            <Text allowFontScaling={false} style={[st.retryText, { color: C.accent }]}>
              {copy.retry}
            </Text>
          </GlassPressable>
        </Card>
      ) : null}

      {data ? (
        <>
          {/* Ben davetle geldiysem: kimin davetiyle, indirimim ne durumda */}
          {data.invitedBy ? (
            <Card C={C} style={st.banner}>
              <AppIcon family="Ionicons" name="heart" size={18} color={C.accent} />
              <View style={st.flex}>
                <Text allowFontScaling={false} style={[st.bannerTitle, { color: C.text }]}>
                  {copy.invitedBy.title(data.invitedBy.name)}
                </Text>
                <Text style={[st.bannerBody, { color: C.muted }]}>
                  {data.invitedBy.discount
                    ? copy.invitedBy.discount(data.invitedBy.discount.percent)
                    : copy.invitedBy.used}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Kod */}
          <SectionTitle C={C}>{copy.yourCode}</SectionTitle>
          <Card C={C}>
            <Text
              allowFontScaling={false}
              selectable
              accessibilityLabel={`${copy.yourCode}: ${data.displayCode}`}
              style={[st.code, { color: C.text }]}
            >
              {data.displayCode}
            </Text>
            <View style={st.codeActions}>
              <GlassPressable
                onPress={copyCode}
                accessibilityRole="button"
                style={[st.secondaryButton, { borderColor: C.border, backgroundColor: alpha(C.text, 0.05) }]}
              >
                <AppIcon family="Ionicons" name="copy-outline" size={16} color={C.text} />
                <Text allowFontScaling={false} style={[st.secondaryText, { color: C.text }]}>
                  {copy.copy}
                </Text>
              </GlassPressable>
              <GlassPressable
                onPress={shareCode}
                accessibilityRole="button"
                style={[st.primaryButton, { backgroundColor: C.accent }]}
              >
                <AppIcon family="Ionicons" name="share-outline" size={16} color="#FFFFFF" />
                <Text allowFontScaling={false} style={st.primaryText}>
                  {copy.share}
                </Text>
              </GlassPressable>
            </View>
          </Card>

          {/* Kazanılan ücretsiz aylar */}
          <SectionTitle C={C}>{copy.reward.title}</SectionTitle>
          <Card C={C}>
            {data.promoUntilMs && reward?.active ? (
              <Text style={[st.rewardLine, { color: C.green }]}>
                {copy.reward.active(formatRedeemDate(data.promoUntilMs, language))}
              </Text>
            ) : null}
            <Text style={[st.rewardLine, { color: C.text }]}>
              {data.creditMonths > 0 ? copy.reward.available(data.creditMonths) : copy.reward.none}
            </Text>
            {reward?.status === "blocked" ? (
              <Text style={[st.rewardHint, { color: C.muted }]}>{copy.reward.storeActive}</Text>
            ) : null}
            {reward?.canStart ? (
              <GlassPressable
                onPress={startReward}
                disabled={claiming}
                accessibilityRole="button"
                accessibilityState={{ busy: claiming, disabled: claiming }}
                style={[st.primaryButton, st.fullButton, { backgroundColor: C.accent, opacity: claiming ? 0.6 : 1 }]}
              >
                <Text allowFontScaling={false} style={st.primaryText}>
                  {claiming ? copy.reward.starting : copy.reward.start}
                </Text>
              </GlassPressable>
            ) : null}
            <Text style={[st.rewardHint, { color: C.muted }]}>
              {data.earnedMonths >= data.maxMonths
                ? copy.reward.capped(data.maxMonths)
                : copy.reward.earned(data.earnedMonths, data.maxMonths)}
            </Text>
          </Card>

          {/* Davet ettiklerim */}
          <SectionTitle C={C}>{copy.list.title}</SectionTitle>
          <Card C={C} style={data.invitees.length ? st.listCard : null}>
            {data.invitees.length === 0 ? (
              <Text style={[st.empty, { color: C.muted }]}>{copy.list.empty}</Text>
            ) : (
              <>
                <Text style={[st.counts, { color: C.muted, borderBottomColor: C.borderMuted }]}>
                  {copy.list.counts(data.counts.registered, data.counts.subscribed)}
                </Text>
                {data.invitees.map((item, index) => (
                  <View
                    key={item.uid}
                    style={[
                      st.inviteeRow,
                      { borderBottomColor: C.borderMuted },
                      index === data.invitees.length - 1 && st.inviteeRowLast,
                    ]}
                  >
                    <UserAvatar avatarIndex={item.avatarIndex} photoURL={item.photoURL} size={38} />
                    <View style={st.flex}>
                      <Text allowFontScaling={false} numberOfLines={1} style={[st.inviteeName, { color: C.text }]}>
                        {item.name || item.username}
                      </Text>
                      {item.username ? (
                        <Text allowFontScaling={false} numberOfLines={1} style={[st.inviteeUser, { color: C.muted }]}>
                          @{item.username}
                        </Text>
                      ) : null}
                    </View>
                    <StatusChip status={item.status} label={copy.list.status[item.status]} C={C} />
                  </View>
                ))}
              </>
            )}
          </Card>
          <Text style={[st.footnote, { color: C.muted }]}>{copy.list.statusHint}</Text>

          {/* Nasıl çalışır */}
          <SectionTitle C={C}>{copy.steps.title}</SectionTitle>
          <Card C={C}>
            {[copy.steps.one, copy.steps.two(data.limits.windowDays), copy.steps.three].map(
              (line, index) => (
                <View key={line} style={st.step}>
                  <View style={[st.stepNum, { backgroundColor: alpha(C.accent, 0.16) }]}>
                    <Text allowFontScaling={false} style={[st.stepNumText, { color: C.accent }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[st.stepText, { color: C.text }]}>{line}</Text>
                </View>
              ),
            )}
          </Card>
        </>
      ) : null}

      {/* Kod gir: davet ya da promosyon kodu (Premium sayfasında da var) */}
      <GlassPressable
        onPress={() => setRedeemOpen(true)}
        accessibilityRole="button"
        style={[st.redeemRow, { backgroundColor: C.card, borderColor: C.border }]}
      >
        <View style={[st.redeemIcon, { backgroundColor: C.iconPurple }]}>
          <AppIcon family="Ionicons" name="ticket-outline" size={17} color={C.purple} />
        </View>
        <View style={st.flex}>
          <Text allowFontScaling={false} style={[st.bannerTitle, { color: C.text }]}>
            {copy.redeem.entryTitle}
          </Text>
          <Text style={[st.bannerBody, { color: C.muted }]}>{copy.redeem.entryHint}</Text>
        </View>
        <AppIcon family="Ionicons" name="chevron-forward" size={14} color={C.muted} />
      </GlassPressable>

      <RedeemCodeSheet
        visible={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={onRedeemed}
      />
    </SettingsSubScreen>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 28 },
  hero: {
    marginTop: 8,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  heroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  heroBody: { fontSize: 14, lineHeight: 20 },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  listCard: { padding: 0, overflow: "hidden" },
  errorCard: { marginTop: 16, alignItems: "center", gap: 12 },
  errorText: { fontSize: 14, textAlign: "center" },
  retry: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  retryText: { fontSize: 14, fontWeight: "700" },
  banner: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  bannerTitle: { fontSize: 15, fontWeight: "700" },
  bannerBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  code: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 5,
    textAlign: "center",
    paddingVertical: 6,
  },
  codeActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  fullButton: { flex: 0, alignSelf: "stretch", marginTop: 12 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  rewardLine: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  rewardHint: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  empty: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingVertical: 6 },
  counts: {
    fontSize: 12.5,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inviteeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inviteeRowLast: { borderBottomWidth: 0 },
  inviteeName: { fontSize: 15, fontWeight: "600" },
  inviteeUser: { fontSize: 12.5, marginTop: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 170,
  },
  chipText: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontWeight: "800" },
  stepText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  redeemRow: {
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  redeemIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
