import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import DatePickerModal, { normalizeDate } from "../modals/DatePickerModal";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

const todayIso = () => normalizeDate(new Date());

const parseLocalDate = (value) => {
  const iso = normalizeDate(value);
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function WatchedDateSheet({
  visible,
  onClose,
  subtitle,
  pickerSubtitle,
  releaseDate,
  minDate,
  onConfirm,
  busy = false,
  mediaType = "movie",
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const today = todayIso();
  const releaseIso = normalizeDate(releaseDate);
  const minIso = normalizeDate(minDate);
  const hasValidRange = !minIso || minIso <= today;
  const canUseReleaseDate = !!releaseIso && releaseIso <= today;
  const isBusy = busy || submitting;

  useEffect(() => {
    if (visible) return;
    setSelectedDate(null);
    setDatePickerVisibility(false);
    setSubmitting(false);
    submitLock.current = false;
  }, [visible]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [language],
  );

  const formatDate = (value) => {
    const date = parseLocalDate(value);
    return date ? formatter.format(date) : "";
  };

  const selectDate = (date) => {
    if (isBusy || !date) return;
    setSelectedDate(normalizeDate(date));
  };

  const handlePickerConfirm = (date) => {
    setDatePickerVisibility(false);
    selectDate(date);
  };

  const handleSubmit = async () => {
    if (!selectedDate || isBusy || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await onConfirm?.(selectedDate);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const closeSheet = () => {
    if (isBusy) return;
    if (isDatePickerVisible) {
      setDatePickerVisibility(false);
      return;
    }
    onClose?.();
  };

  return (
    <>
      <Modal
        visible={visible}
        onRequestClose={closeSheet}
        animationType="slide"
        transparent
        statusBarTranslucent
      >
        <View style={styles.modalWrap}>
          <LinearGradient
            colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            disabled={isBusy}
            onPress={closeSheet}
          />

          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.header}>
              <View
                style={[
                  styles.headerIcon,
                  { backgroundColor: alpha(theme.accent, 0.14) },
                ]}
              >
                <Ionicons name="checkmark-done" size={21} color={theme.accent} />
              </View>
              <View style={styles.headerText}>
                <Text
                  allowFontScaling={false}
                  style={[styles.title, { color: theme.text.primary }]}
                >
                  {i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.subtitle, { color: theme.text.muted }]}
                >
                  {subtitle}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.between }]}
                disabled={isBusy}
                onPress={closeSheet}
              >
                <Ionicons name="close" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!hasValidRange || isBusy}
              onPress={() => setDatePickerVisibility(true)}
              style={[
                styles.customDate,
                {
                  backgroundColor: selectedDate
                    ? alpha(theme.accent, 0.12)
                    : theme.between,
                  borderColor: selectedDate ? theme.accent : theme.border,
                  opacity: hasValidRange ? 1 : 0.55,
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                <Ionicons name="calendar-outline" size={21} color={theme.accent} />
              </View>
              <View style={styles.optionText}>
                <Text
                  allowFontScaling={false}
                  style={[styles.optionTitle, { color: theme.text.primary }]}
                >
                  {selectedDate
                    ? formatDate(selectedDate)
                    : i18nText("autoI18n.tarih_sec", "Tarih Seç")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.optionSubtitle, { color: theme.text.muted }]}
                >
                  {hasValidRange
                    ? i18nText(
                        "autoI18n.takvimden_izleme_tarihi_sec",
                        "Takvimden izleme tarihini belirle",
                      )
                    : i18nText(
                        "autoI18n.henuz_yayinlanmadi",
                        "Bu içerik henüz yayınlanmadı",
                      )}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={theme.text.muted} />
            </TouchableOpacity>

            <View style={styles.quickRow}>
              <QuickDateOption
                icon="time-outline"
                title={i18nText("autoI18n.bugun", "Bugün")}
                subtitle={formatDate(today)}
                selected={selectedDate === today}
                disabled={!hasValidRange || isBusy}
                onPress={() => selectDate(today)}
              />
              <QuickDateOption
                icon={mediaType === "tv" ? "tv-outline" : "film-outline"}
                title={i18nText("autoI18n.yayin_tarihi", "Yayın Tarihi")}
                subtitle={
                  canUseReleaseDate
                    ? formatDate(releaseIso)
                    : i18nText("autoI18n.kullanilamaz", "Kullanılamaz")
                }
                selected={selectedDate === releaseIso}
                disabled={!canUseReleaseDate || isBusy}
                onPress={() => selectDate(releaseIso)}
              />
            </View>

            <View
              style={[
                styles.selectionSummary,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={selectedDate ? "checkmark-circle" : "information-circle-outline"}
                size={19}
                color={selectedDate ? theme.accent : theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[
                  styles.selectionText,
                  { color: selectedDate ? theme.text.primary : theme.text.muted },
                ]}
              >
                {selectedDate
                  ? i18nText(
                      "autoI18n.secilen_izleme_tarihi",
                      "Seçilen tarih: {{date}}",
                      { date: formatDate(selectedDate) },
                    )
                  : i18nText(
                      "autoI18n.kaydetmeden_once_tarih_sec",
                      "Kaydetmeden önce bir izleme tarihi seçin",
                    )}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={!selectedDate || isBusy}
              onPress={handleSubmit}
              style={[
                styles.confirmButton,
                {
                  backgroundColor:
                    selectedDate && !isBusy ? theme.accent : theme.border,
                },
              ]}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              )}
              <Text allowFontScaling={false} style={styles.confirmText}>
                {isBusy
                  ? i18nText("autoI18n.kaydediliyor", "Kaydediliyor...")
                  : i18nText(
                      "autoI18n.izlendi_olarak_isaretle",
                      "İzlendi olarak işaretle",
                    )}
              </Text>
            </TouchableOpacity>

            <DatePickerModal
              visible={isDatePickerVisible}
              value={selectedDate || today}
              onConfirm={handlePickerConfirm}
              onClose={() => setDatePickerVisibility(false)}
              title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
              subtitle={pickerSubtitle}
              confirmLabel={i18nText("autoI18n.tarihi_onayla", "Tarihi Onayla")}
              minDate={minIso || undefined}
              maxDate={today}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function QuickDateOption({
  icon,
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.quickOption,
        {
          backgroundColor: selected ? alpha(theme.accent, 0.12) : theme.between,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.48 : 1,
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
        <Ionicons name={icon} size={19} color={theme.accent} />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.quickTitle, { color: theme.text.primary }]}
      >
        {title}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[styles.quickSubtitle, { color: theme.text.muted }]}
      >
        {subtitle}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={theme.accent}
          style={styles.selectedMark}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 34,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 18 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  customDate: { minHeight: 68, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 13.5, fontWeight: "700" },
  optionSubtitle: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  quickOption: { flex: 1, minHeight: 104, borderRadius: 16, borderWidth: 1, padding: 11, justifyContent: "center" },
  quickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickTitle: { fontSize: 12, fontWeight: "700" },
  quickSubtitle: { fontSize: 9.5, lineHeight: 12.5, marginTop: 3 },
  selectedMark: { position: "absolute", top: 8, right: 8 },
  selectionSummary: { minHeight: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  selectionText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  confirmButton: { height: 50, borderRadius: 16, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
