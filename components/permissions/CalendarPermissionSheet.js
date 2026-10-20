// components/permissions/CalendarPermissionSheet.js
//
// Ayarlar > İzinlerim > Takvim satırına basınca açılan bilgi + yönetim sayfası.
//
// NEDEN AYRI SAYFA: takvim izni diğerlerinden farklı — uygulama telefonun takvimine
// KALICI veri yazıyor (hatırlatma etkinlikleri). Bu yüzden "izni kapat" tek başına
// yetmez: izin kapanınca Seelogd'un eklediği etkinlikleri artık silemez ve takvimde
// sahipsiz kalırlar. Sayfa üç şeyi bir arada verir:
//   1) neyin, ne zaman, ne için eklendiğini ve takvimin okunmadığını anlatır,
//   2) Seelogd'un eklediği tüm etkinlikleri tek dokunuşla kaldırtır,
//   3) izni geri çekme yolunu gösterir.
//
// "GERİ ÇEK" = SİSTEM AYARLARI: iOS ve Android uygulamanın kendi iznini program ile
// geri almasına izin vermez (PermissionsSection'daki genel kural). Düğme bunu gizlemez:
// altındaki metin söyler, ve sistem ayarlarını açar.
//
// İÇ İÇE MODAL YOK: iOS, açık bir Modal'ın üstüne `appAlert` sunamaz (bkz. BottomSheetModal
// "İKİ MODAL ARDARDA"). Onay ve sonuç bu yüzden sayfanın İÇİNDE, satır içi gösterilir.
//
// KARAR BURADA DEĞİL: hangi bloğun görüneceği utils/calendarPermissionPlan.js'te.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "@utils/i18nText";
import { planCalendarPermissionSheet } from "@utils/calendarPermissionPlan";
import {
  countSavedPhoneEvents,
  removeAllEventsFromPhoneCalendar,
} from "@utils/phoneCalendar";
import StatusPill from "./StatusPill";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";

function InfoRow({ C, icon, tone, bg, title, body, last }) {
  return (
    <View
      style={[
        styles.infoRow,
        { borderBottomColor: C.borderMuted },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: bg }]}>
        <AppIcon name={icon} size={17} color={tone} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: C.text }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: C.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

/** tone: "primary" (vurgu, BEYAZ yazı) | "danger" | "neutral" */
function SheetButton({ C, label, icon, tone = "neutral", onPress, disabled, loading, style }) {
  const palette =
    tone === "primary"
      ? { bg: C.accent, fg: C.white, border: "transparent" }
      : tone === "danger"
        ? { bg: C.dangerDim, fg: C.danger, border: "transparent" }
        : { bg: C.cardAlt, fg: C.text, border: C.border };
  return (
    <GlassTouchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      activeOpacity={0.75}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && !loading && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <AppIcon name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]} numberOfLines={2}>
            {label}
          </Text>
        </>
      )}
    </GlassTouchable>
  );
}

function Note({ C, icon, tone, bg, children }) {
  return (
    <View style={[styles.note, { backgroundColor: bg }]}>
      <AppIcon name={icon} size={16} color={tone} style={styles.noteIcon} />
      <Text style={[styles.noteText, { color: C.text }]}>{children}</Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {object} props.colors       buildUiColors() paleti (PermissionsSection ile aynı).
 * @param {{status: string, canAskAgain: boolean}} props.state  Bölümün tuttuğu izin durumu.
 * @param {() => Promise<void>} props.onRequest  İzni ister VE bölümün durumunu tazeler.
 */
export default function CalendarPermissionSheet({
  visible,
  onClose,
  colors: C,
  state,
  onRequest,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [savedCount, setSavedCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState(null);

  const plan = planCalendarPermissionSheet({
    status: state?.status,
    canAskAgain: state?.canAskAgain,
    savedCount,
  });

  const loadCount = useCallback(async () => {
    try {
      setSavedCount(await countSavedPhoneEvents());
    } catch {
      setSavedCount(0);
    }
  }, []);

  // Her açılışta onay/sonuç sıfırlanır. KAPANIŞTA sıfırlanmaz: çıkış animasyonu
  // sürerken içerik değişirse ekranda zıplar (bkz. BottomSheetModal).
  useEffect(() => {
    if (!visible) return;
    setConfirming(false);
    setResult(null);
  }, [visible]);

  // Açılışta ve izin durumu değişince (kullanıcı sistem ayarından dönmüş olabilir)
  // sayaç yeniden okunur.
  useEffect(() => {
    if (visible) loadCount();
  }, [visible, state?.status, loadCount]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const handlePrimary = useCallback(async () => {
    if (plan.primaryAction === "openSettings") {
      openSystemSettings();
      return;
    }
    if (requesting) return;
    setRequesting(true);
    try {
      await onRequest?.();
    } finally {
      setRequesting(false);
    }
  }, [plan.primaryAction, requesting, onRequest, openSystemSettings]);

  const handleRemove = useCallback(async () => {
    if (removing) return;
    setConfirming(false);
    setRemoving(true);
    setResult(null);
    try {
      setResult(await removeAllEventsFromPhoneCalendar());
    } catch {
      setResult({ error: true });
    } finally {
      setRemoving(false);
      loadCount();
    }
  }, [removing, loadCount]);

  const resultView = (() => {
    if (!result) return null;
    if (result.error) {
      return {
        tone: C.danger,
        bg: C.dangerDim,
        icon: "alert-circle",
        lines: [
          i18nText(
            "autoI18n.izin_takvim_kaldirilamadi",
            "Etkinlikler kaldırılamadı. Biraz sonra tekrar dene.",
          ),
        ],
      };
    }
    if (result.blocked) {
      return {
        tone: C.danger,
        bg: C.dangerDim,
        icon: "alert-circle",
        lines: [
          i18nText(
            "autoI18n.izin_takvim_kaldirilamadi_izin",
            "Etkinlikler kaldırılamadı: takvim izni kapalı.",
          ),
        ],
      };
    }
    const lines = [
      i18nText("autoI18n.izin_takvim_kaldirildi_sayi", "Kaldırılan etkinlik: {{count}}", {
        count: result.removed,
      }),
    ];
    if (result.missing > 0) {
      lines.push(
        i18nText(
          "autoI18n.izin_takvim_kaldirildi_eksik",
          "Telefonda zaten bulunmayan: {{count}}",
          { count: result.missing },
        ),
      );
    }
    return { tone: C.green, bg: C.iconGreen, icon: "checkmark-circle", lines };
  })();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: C.bg, borderColor: C.border }]}
    >
      <View style={[styles.grabber, { backgroundColor: C.handle }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 12) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: C.iconPurple }]}>
            <AppIcon name="calendar" size={24} color={C.purple} />
          </View>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, { color: C.text }]}>
              {t.permCalendar || "Takvim"}
            </Text>
            <View style={styles.pillRow}>
              <StatusPill status={state?.status} colors={C} t={t} />
            </View>
          </View>
        </View>

        <Text style={[styles.intro, { color: C.muted }]}>
          {i18nText(
            "autoI18n.izin_takvim_giris",
            "Film vizyon tarihi, yeni bölüm ve not hatırlatıcılarını telefonunun takvimine etkinlik olarak ekleyebilmen için gerekir.",
          )}
        </Text>

        <GlassBox role="card" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <InfoRow
            C={C}
            icon="hand-left-outline"
            tone={C.blue}
            bg={C.iconBlue}
            title={i18nText("autoI18n.izin_takvim_istege_bagli_baslik", "Yalnızca sen istediğinde")}
            body={i18nText(
              "autoI18n.izin_takvim_istege_bagli",
              "Etkinlik, sen takvime ekle dediğinde oluşturulur. Arka planda kendiliğinden hiçbir şey eklenmez.",
            )}
          />
          <InfoRow
            C={C}
            icon="eye-off-outline"
            tone={C.green}
            bg={C.iconGreen}
            title={i18nText("autoI18n.izin_takvim_okunmaz_baslik", "Takvimin okunmaz")}
            body={i18nText(
              "autoI18n.izin_takvim_okunmaz",
              "Mevcut etkinliklerin okunmaz ve Seelogd sunucularına gönderilmez; yalnızca Seelogd'un eklediği etkinlikler yönetilir.",
            )}
          />
          <InfoRow
            C={C}
            icon="arrow-undo-outline"
            tone={C.purple}
            bg={C.iconPurple}
            title={i18nText("autoI18n.izin_takvim_kaldir_baslik", "Geri almak da sende")}
            body={i18nText(
              "autoI18n.izin_takvim_kaldir",
              "Eklenen etkinlikleri istediğin zaman buradan tek dokunuşla kaldırabilirsin.",
            )}
            last
          />
        </GlassBox>

        {/* ── İzin YOK ── */}
        {!plan.granted ? (
          <View style={styles.actions}>
            {plan.showOrphanWarning ? (
              <Note C={C} icon="warning-outline" tone={C.amber} bg={C.iconAmber}>
                {i18nText(
                  "autoI18n.izin_takvim_artik_etkinlik",
                  "Daha önce eklediğin etkinlikler (toplam {{count}}) takvimde duruyor. İzin kapalıyken Seelogd onları kaldıramaz; kaldırmak istersen izni yeniden aç.",
                  { count: plan.count },
                )}
              </Note>
            ) : null}
            <SheetButton
              C={C}
              tone="primary"
              icon={plan.primaryAction === "request" ? "calendar-outline" : "settings-outline"}
              label={
                plan.primaryAction === "request"
                  ? i18nText("autoI18n.izin_takvim_izin_ver", "Takvim erişimine izin ver")
                  : i18nText("autoI18n.izin_takvim_ayarlari_ac", "Sistem ayarlarını aç")
              }
              onPress={handlePrimary}
              loading={requesting}
            />
            {plan.showDeniedHint ? (
              <Text style={[styles.hint, { color: C.muted }]}>
                {i18nText(
                  "autoI18n.izin_takvim_reddedildi_ipucu",
                  "İzin daha önce reddedildi; artık yalnızca sistem ayarlarından açılabilir.",
                )}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── İzin VAR ── */}
        {plan.granted ? (
          <View style={styles.actions}>
            <GlassBox role="card" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.countRow}>
                <View style={[styles.countIcon, { backgroundColor: C.iconPurple }]}>
                  <AppIcon name="calendar-number-outline" size={16} color={C.purple} />
                </View>
                <Text style={[styles.countLabel, { color: C.text }]}>
                  {plan.showEmpty
                    ? i18nText("autoI18n.izin_takvim_bos", "Seelogd henüz takvimine etkinlik eklemedi.")
                    : i18nText("autoI18n.izin_takvim_eklenen", "Seelogd'un eklediği etkinlik")}
                </Text>
                {plan.showCount ? (
                  <Text style={[styles.countValue, { color: C.text }]}>{plan.count}</Text>
                ) : null}
              </View>
            </GlassBox>

            {resultView ? (
              <Note C={C} icon={resultView.icon} tone={resultView.tone} bg={resultView.bg}>
                {resultView.lines.join("\n")}
              </Note>
            ) : null}

            {plan.canRemove && !confirming ? (
              <SheetButton
                C={C}
                tone="danger"
                icon="trash-outline"
                label={i18nText("autoI18n.izin_takvim_hepsini_kaldir", "Eklenen etkinlikleri kaldır")}
                onPress={() => setConfirming(true)}
                loading={removing}
              />
            ) : null}
            {plan.canRemove && confirming ? (
              <View style={[styles.confirm, { borderColor: C.danger, backgroundColor: C.dangerDim }]}>
                <Text style={[styles.confirmText, { color: C.text }]}>
                  {i18nText(
                    "autoI18n.izin_takvim_kaldir_onay",
                    "Seelogd'un eklediği etkinlikler telefonunun takviminden silinecek. Takvimindeki diğer etkinliklere dokunulmaz.",
                  )}
                </Text>
                <View style={styles.confirmButtons}>
                  <SheetButton
                    C={C}
                    label={i18nText("autoI18n.izin_takvim_vazgec", "Vazgeç")}
                    onPress={() => setConfirming(false)}
                    style={styles.half}
                  />
                  <SheetButton
                    C={C}
                    tone="danger"
                    icon="trash-outline"
                    label={i18nText("autoI18n.izin_takvim_sil", "Evet, kaldır")}
                    onPress={handleRemove}
                    style={styles.half}
                  />
                </View>
              </View>
            ) : null}

            {/* Geri çek: sistem ayarlarına götürür — OS programatik geri almaya izin vermez. */}
            <View style={[styles.divider, { backgroundColor: C.borderMuted }]} />
            <SheetButton
              C={C}
              icon="settings-outline"
              label={i18nText("autoI18n.izin_takvim_geri_cek", "İzni geri çek")}
              onPress={openSystemSettings}
            />
            <Text style={[styles.hint, { color: C.muted }]}>
              {i18nText(
                "autoI18n.izin_takvim_geri_cek_ipucu",
                "İzin yalnızca sistem ayarlarından kapatılabilir; uygulama bunu kendisi yapamaz. Düğme seni oraya götürür.",
              )}
            </Text>
            {plan.showRevokeAdvice ? (
              <Text style={[styles.hint, { color: C.amber }]}>
                {i18nText(
                  "autoI18n.izin_takvim_geri_cek_oneri",
                  "Kapatmadan önce eklenen etkinlikleri kaldırmanı öneririz: izin kapalıyken Seelogd onları silemez.",
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // `maxHeight` yüzdesi çözülür çünkü sayfa kaplayıcının DOĞRUDAN çocuğu
  // (bkz. BottomSheetModal).
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    paddingTop: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, gap: 5 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  pillRow: { flexDirection: "row" },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: 14 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "700" },
  infoBody: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  actions: { marginTop: 4, gap: 10 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  countIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  countValue: { fontSize: 18, fontWeight: "800" },
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { flexShrink: 1, fontSize: 14.5, fontWeight: "700", textAlign: "center" },
  half: { flex: 1 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  confirm: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  confirmText: { fontSize: 13, lineHeight: 19 },
  confirmButtons: { flexDirection: "row", gap: 10 },
  divider: { height: 1, marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
