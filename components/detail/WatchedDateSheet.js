import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import DatePickerModal from "../modals/DatePickerModal";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";

const formatDateSave = (timestamp) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/* İzleme tarihi bottom-sheet'i: "Tarih Seç" (drum picker) / "Şimdi" /
   "Yayın Tarihi" seçenekleri. Seçilen tarihi ISO string ("YYYY-MM-DD")
   olarak onConfirm ile üst ekrana verir; kapatma/temizleme kendi içinde. */
export default function WatchedDateSheet({
  visible,
  onClose,
  subtitle,
  pickerSubtitle,
  releaseDate,
  minDate,
  onConfirm,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  useEffect(() => {
    if (!visible) setSelectedDate(null);
  }, [visible]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const handlePickerConfirm = (date) => {
    // DatePickerModal ISO string ("YYYY-MM-DD") döndürür
    const isoDate = typeof date === "string" ? date : formatDateSave(date);
    setSelectedDate(isoDate);
    setDatePickerVisibility(false);
    onConfirm(isoDate);
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent
    >
      <View style={styles.dateModalWrap}>
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.dateSheet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View
            style={[styles.sheetHandle, { backgroundColor: theme.border }]}
          />
          <Text
            allowFontScaling={false}
            style={[styles.sheetTitle, { color: theme.text.primary }]}
          >{i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}</Text>
          <Text
            allowFontScaling={false}
            style={[styles.sheetSubtitle, { color: theme.text.muted }]}
          >
            {subtitle}
          </Text>
          <View style={styles.dateOptions}>
            <TouchableOpacity
              style={[
                styles.dateOption,
                {
                  backgroundColor: theme.primary,
                  borderColor: selectedDate ? theme.accent : theme.border,
                },
              ]}
              onPress={() => setDatePickerVisibility(true)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.dateOptionIcon,
                  { backgroundColor: theme.accent + "20" },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={24}
                  color={theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.dateOptionLabel,
                  { color: selectedDate ? theme.accent : theme.text.primary },
                ]}
              >
                {selectedDate || i18nText("autoI18n.tarih_sec", "Tarih Seç")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateOption,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
              onPress={() => onConfirm(formatDateSave(new Date()))}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.dateOptionIcon,
                  {
                    backgroundColor:
                      (theme.colors?.blue || theme.accent) + "20",
                  },
                ]}
              >
                <Entypo
                  name="stopwatch"
                  size={24}
                  color={theme.colors?.blue || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.dateOptionLabel, { color: theme.text.primary }]}
              >{i18nText("autoI18n.simdi", "Şimdi")}</Text>
              <Text
                allowFontScaling={false}
                style={[styles.dateOptionSub, { color: theme.text.muted }]}
              >
                {formatDate(new Date())}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateOption,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
              onPress={() => onConfirm(formatDateSave(new Date(releaseDate)))}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.dateOptionIcon,
                  {
                    backgroundColor:
                      (theme.colors?.orange || theme.accent) + "20",
                  },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={24}
                  color={theme.colors?.orange || theme.accent}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.dateOptionLabel, { color: theme.text.primary }]}
              >{i18nText("autoI18n.yayin_tarihi", "Yayın Tarihi")}</Text>
              <Text
                allowFontScaling={false}
                style={[styles.dateOptionSub, { color: theme.text.muted }]}
              >
                {formatDate(releaseDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Drum Picker – Tarih Seç butonuna basıldığında açılır */}
          <DatePickerModal
            visible={isDatePickerVisible}
            value={selectedDate || formatDateSave(new Date())}
            onConfirm={handlePickerConfirm}
            onClose={() => setDatePickerVisibility(false)}
            title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
            subtitle={pickerSubtitle}
            confirmLabel="Tarihi Onayla"
            minDate={minDate}
            maxDate={new Date()}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dateModalWrap: { flex: 1, justifyContent: "flex-end" },
  dateSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  dateOptions: { flexDirection: "row", gap: 10 },
  dateOption: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  dateOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dateOptionLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  dateOptionSub: { fontSize: 10.5, textAlign: "center" },
});
