// screens/tabs/settings/FeedbackScreen.js
//
// Ayarlar > Destek ve geri bildirim: tek ekran, iki tür.
//   kind="bug"     → Hata bildir        (Premium ve üstü)
//   kind="feature" → Özellik iste       (yalnız Premium Max)
//
// Form: kategori, (hata için) şiddet, kısa başlık, açıklama, (hata için) cihaz
// bilgisi anahtarı. Gönderince form yerine teşekkür kartı çıkar; altta kullanıcının
// bu türdeki "Gönderdiklerim" listesi durum hapıyla durur (durum ve yanıt konsoldan
// değişir). Şekil/sınırlar utils/feedbackValidation.js, yazma services/feedbackService.js,
// plan kapısı firestore.rules → Feedback + utils/premiumFeatures.js (bug_report /
// feature_request). Ekrana kapısız ulaşılırsa usePremiumScreenGuard yükseltme sayfasını
// açıp geri sarar.
//
// Taslak (yazılan metin) modül kapsamında tutulur: ekrandan çıkıp dönünce kaybolmaz;
// uygulama kapanınca silinir. Gönderimden sonra temizlenir.

import { intlLocaleOf } from "../../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { getPremiumPlanDisplayName, PREMIUM_PLAN } from "@utils/premium";
import { FeedbackError, loadMyFeedback, submitFeedback } from "@services/feedbackService";
import {
  BUG_SEVERITIES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_FEATURE_ID,
  FEEDBACK_LIMITS,
  checkFeedbackDraft,
  formatDeviceLine,
} from "@utils/feedbackValidation";
import {
  CATEGORY_ICON,
  ChipGroup,
  DeviceCard,
  FadeIn,
  FeedbackHero,
  FieldLabel,
  HistoryItem,
  HistoryNotice,
  SentCard,
  SeverityRail,
  SubmitButton,
  TextField,
} from "@components/feedback/FeedbackKit";
import { SectionLabel, SettingsSubScreen, buildUiColors } from "./settingsUi";
import { fill, getFeedbackCopy } from "./feedbackCopy";

// Türe göre görünüm: vurgu rengi (palet anahtarı), kahraman ikonu ve hangi planın açtığı.
const KIND_LOOK = Object.freeze({
  bug: { tint: "amber", icon: "bug", benefitIcon: "hardware-chip-outline", plan: PREMIUM_PLAN.PREMIUM },
  feature: { tint: "purple", icon: "bulb", benefitIcon: "analytics-outline", plan: PREMIUM_PLAN.UNLIMITED },
});

const emptyDraft = () => ({
  category: null,
  severity: "annoying",
  title: "",
  message: "",
  includeDevice: true,
});

// Ekrandan çık-dön arasında metin kaybolmasın (bellek içi; uygulama kapanınca gider).
const drafts = { bug: emptyDraft(), feature: emptyDraft() };

const tick = () => {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

const buzz = (type) => {
  try {
    Haptics.notificationAsync(type).catch(() => {});
  } catch {
    /* titreşim yoksa sessizce geç */
  }
};

/** Cihaz bilgisi ekran ömründe bir kez okunur; hepsi isteğe bağlı alan. */
function readDevice() {
  const version = Constants.expoConfig?.version;
  const build = Constants.nativeBuildVersion;
  return {
    appVersion: version ? `v${version}${build ? ` (${build})` : ""}` : "",
    platform: Platform.OS,
    osVersion: Device.osVersion || String(Platform.Version ?? ""),
    deviceModel: Device.modelName || "",
  };
}

function dateLabel(item, copy, locale) {
  // createdAt henüz sunucu onayı almadıysa (0) ya da bir dakikadan yeniyse "Az önce".
  if (!item.createdAtMs || Date.now() - item.createdAtMs < 60 * 1000) return copy.common.justNow;
  try {
    return new Date(item.createdAtMs).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return new Date(item.createdAtMs).toISOString().slice(0, 10);
  }
}

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const C = buildUiColors(theme);
  const locale = intlLocaleOf(language);

  const kind = route.params?.kind === "feature" ? "feature" : "bug";
  const look = KIND_LOOK[kind];
  const tint = C[look.tint];
  const copy = useMemo(() => getFeedbackCopy(language), [language]);
  const kindCopy = copy[kind];
  const planName = getPremiumPlanDisplayName(look.plan);
  // HistoryItem yalnız durum adlarını ve "yanıt" etiketini okur.
  const historyCopy = useMemo(
    () => ({ statuses: kindCopy.statuses, common: copy.common }),
    [kindCopy, copy],
  );

  // Plan yetmiyorsa yükseltme sayfasını açar ve ekranı geri sarar (ikinci kapı).
  const locked = usePremiumScreenGuard(FEEDBACK_FEATURE_ID[kind], navigation);

  const [draft, setDraft] = useState(() => drafts[kind]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState({ status: "loading", items: [] });
  const sendingRef = useRef(false);
  const device = useMemo(readDevice, []);

  const patch = useCallback(
    (changes) => setDraft((current) => ({ ...current, ...changes })),
    [],
  );

  // Taslağı bellekte tut (ekrandan çıkıp dönünce kalsın).
  useEffect(() => {
    drafts[kind] = draft;
  }, [draft, kind]);

  const uid = user?.uid;

  const reload = useCallback(async () => {
    if (!uid) {
      setHistory({ status: "ready", items: [] });
      return;
    }
    setHistory((current) => ({ status: "loading", items: current.items }));
    try {
      const items = await loadMyFeedback(uid, kind);
      setHistory({ status: "ready", items });
    } catch (error) {
      if (__DEV__) console.warn("Feedback history:", error?.message || error);
      setHistory((current) => ({ status: "error", items: current.items }));
    }
  }, [uid, kind]);

  useEffect(() => {
    if (!locked) reload();
  }, [locked, reload]);

  const check = checkFeedbackDraft(draft);

  const categoryOptions = FEEDBACK_CATEGORIES[kind].map((id) => ({
    id,
    label: kindCopy.categories[id],
    icon: CATEGORY_ICON[id],
  }));
  // Şiddet yalnız hata bildiriminde var; özellik isteği metinlerinde bu alanlar yok.
  const severityOptions =
    kind === "bug"
      ? BUG_SEVERITIES.map((id) => ({
          id,
          label: kindCopy.severities[id],
          hint: kindCopy.severityHints[id],
        }))
      : [];

  // Hazırken düğmenin altında veri kullanımı notu durur (gönderim anındaki
  // bilgilendirme); eksik alan varken önce ne eksik olduğu söylenir.
  const submitHint = check.ready
    ? copy.common.privacyNote
    : check.titleOk
      ? fill(copy.common.messageNeed, { n: FEEDBACK_LIMITS.messageMin })
      : copy.common.submitNeed;

  const onSubmit = async () => {
    if (!check.ready || sendingRef.current || !uid) return;
    sendingRef.current = true;
    setSending(true);
    Keyboard.dismiss();
    tick();
    let result = "sent";
    try {
      await submitFeedback({
        kind,
        uid,
        category: draft.category,
        severity: kind === "bug" ? draft.severity : undefined,
        title: draft.title,
        message: draft.message,
        language,
        device: kind === "bug" && draft.includeDevice ? device : null,
      });
    } catch (error) {
      const code = error instanceof FeedbackError ? error.code : "failed";
      if (code === "timeout") {
        // Yazma kuyrukta; sunucu yavaş. Kullanıcıya "gönderildi" gibi davranılır
        // ama bağlantının yavaş olduğu söylenir (tekrar göndermesin).
        toast.info(copy.common.infoSlow);
        result = "slow";
      } else {
        result = "failed";
        buzz(Haptics.NotificationFeedbackType?.Error);
        toast.error(
          code === "offline"
            ? copy.common.errOffline
            : code === "denied"
              ? copy.common.errDenied
              : copy.common.errFailed,
        );
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
    if (result === "failed") return;

    buzz(Haptics.NotificationFeedbackType?.Success);
    // Listeye hemen düşsün: sunucu sıralaması gelene kadar iyimser kayıt.
    const optimistic = {
      id: `local-${Date.now()}`,
      kind,
      category: draft.category || "other",
      severity: kind === "bug" ? draft.severity : null,
      title: draft.title.replace(/\s+/g, " ").trim(),
      message: draft.message.trim(),
      status: "open",
      reply: "",
      createdAtMs: Date.now(),
    };
    setHistory((current) => ({ status: current.status, items: [optimistic, ...current.items] }));
    setDraft(emptyDraft());
    setSent(true);
    if (result === "sent") reload();
  };

  const startAnother = () => {
    tick();
    setSent(false);
  };

  if (locked) {
    // Yükseltme sayfası açık/açılıyor; arkada boş iskelet.
    return <SettingsSubScreen title={kindCopy.title} scrollable={false}>{null}</SettingsSubScreen>;
  }

  const messageCounter = fill(copy.common.counter, {
    n: check.messageLength,
    max: FEEDBACK_LIMITS.messageMax,
  });
  const titleCounter = fill(copy.common.counter, {
    n: check.titleLength,
    max: FEEDBACK_LIMITS.titleMax,
  });

  return (
    <SettingsSubScreen title={kindCopy.title} scrollable={false}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          <FeedbackHero
            C={C}
            tint={tint}
            icon={look.icon}
            title={kindCopy.heroTitle}
            text={kindCopy.heroText}
            planLabel={fill(copy.common.planChip, { plan: planName })}
            benefit={kindCopy.heroBenefit}
            benefitIcon={look.benefitIcon}
          />

          {sent ? (
            <SentCard
              C={C}
              title={kindCopy.sentTitle}
              text={kindCopy.sentText}
              actionLabel={copy.common.sentAgain}
              onAction={startAnother}
            />
          ) : (
            <FadeIn>
              <FieldLabel C={C}>{kindCopy.categoryLabel}</FieldLabel>
              <ChipGroup
                C={C}
                tint={tint}
                options={categoryOptions}
                value={draft.category}
                onChange={(category) => {
                  tick();
                  patch({ category });
                }}
              />

              {kind === "bug" ? (
                <>
                  <FieldLabel C={C}>{kindCopy.severityLabel}</FieldLabel>
                  <SeverityRail
                    C={C}
                    options={severityOptions}
                    value={draft.severity}
                    onChange={(severity) => {
                      tick();
                      patch({ severity });
                    }}
                  />
                </>
              ) : null}

              <FieldLabel
                C={C}
                right={titleCounter}
                rightColor={check.titleLength >= FEEDBACK_LIMITS.titleMax ? C.danger : undefined}
              >
                {copy.common.titleLabel}
              </FieldLabel>
              <TextField
                C={C}
                tint={tint}
                value={draft.title}
                onChangeText={(title) => patch({ title })}
                placeholder={kindCopy.titlePlaceholder}
                maxLength={FEEDBACK_LIMITS.titleMax}
              />

              <FieldLabel
                C={C}
                right={messageCounter}
                rightColor={check.messageLeft < 50 ? C.danger : undefined}
              >
                {kindCopy.messageLabel}
              </FieldLabel>
              <TextField
                C={C}
                tint={tint}
                value={draft.message}
                onChangeText={(message) => patch({ message })}
                placeholder={kindCopy.messagePlaceholder}
                maxLength={FEEDBACK_LIMITS.messageMax}
                multiline
                minHeight={150}
              />

              {kind === "bug" ? (
                <DeviceCard
                  C={C}
                  tint={tint}
                  enabled={draft.includeDevice}
                  onToggle={(includeDevice) => patch({ includeDevice })}
                  title={copy.common.deviceTitle}
                  line={formatDeviceLine(device)}
                  hint={copy.common.deviceHint}
                />
              ) : null}

              <SubmitButton
                C={C}
                tint={tint}
                label={sending ? copy.common.submitting : copy.common.submit}
                busy={sending}
                disabled={!check.ready}
                hint={submitHint}
                onPress={onSubmit}
              />
            </FadeIn>
          )}

          {/* ── Gönderdiklerim ── */}
          <SectionLabel color={C.muted}>
            {`${copy.common.historyTitle}${
              history.items.length ? `  ·  ${history.items.length}` : ""
            }`.toLocaleUpperCase(locale)}
          </SectionLabel>
          {history.items.length ? (
            history.items.map((item) => (
              <HistoryItem
                key={item.id}
                C={C}
                tint={tint}
                copy={historyCopy}
                item={item}
                dateLabel={dateLabel(item, copy, locale)}
                categoryLabel={kindCopy.categories[item.category]}
              />
            ))
          ) : history.status === "loading" ? (
            <View style={s.loading}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : history.status === "error" ? (
            <HistoryNotice
              C={C}
              icon="cloud-offline-outline"
              title={copy.common.historyLoadFailed}
              actionLabel={copy.common.retry}
              onAction={reload}
            />
          ) : (
            <HistoryNotice
              C={C}
              icon={kind === "bug" ? "shield-checkmark-outline" : "bulb-outline"}
              title={copy.common.historyEmptyTitle}
              text={kindCopy.historyEmptyText}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  loading: { paddingVertical: 28, alignItems: "center" },
});
