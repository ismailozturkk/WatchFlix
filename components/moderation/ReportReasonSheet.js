// components/moderation/ReportReasonSheet.js
//
// Şikâyet sebebi seçimi — yorum, mesaj ve profil akışlarının ORTAK sayfası.
//
// NEDEN TEK BİLEŞEN: üç yüzey de aynı sebep listesini göstermek zorunda
// (liste utils/reportValidation.js'te ve kural onu doğruluyor). Üç ayrı kopya
// olsaydı yeni bir sebep eklendiğinde ikisi güncellenip biri unutulurdu.
//
// ETKİLEŞİM: sebebe dokunmak ŞİKÂYETİ GÖNDERİR — ayrıca "Gönder" düğmesi yok.
// Sebep seçimi zaten onayın kendisi; ikinci bir adım, kullanıcıyı taciz
// gördüğü içerikle daha uzun süre baş başa bırakmaktan başka işe yaramıyor.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { REPORT_REASONS } from "../../utils/reportValidation";

// Sebep kodu → (etiket, ikon). Sıra reportValidation'daki listeden geliyor;
// buradaki tablo yalnız görünümü tarif ediyor.
const REASON_UI = {
  spam: { icon: "megaphone-outline", key: "sebep_spam", tr: "Spam veya yanıltıcı" },
  harassment: { icon: "sad-outline", key: "sebep_taciz", tr: "Taciz veya zorbalık" },
  hate_speech: { icon: "flame-outline", key: "sebep_nefret", tr: "Nefret söylemi" },
  sexual_content: { icon: "eye-off-outline", key: "sebep_cinsel", tr: "Cinsel içerik" },
  violence: { icon: "warning-outline", key: "sebep_siddet", tr: "Şiddet" },
  self_harm: { icon: "heart-dislike-outline", key: "sebep_kendine_zarar", tr: "Kendine zarar" },
  misinformation: { icon: "help-circle-outline", key: "sebep_yanlis_bilgi", tr: "Yanlış bilgi" },
  other: { icon: "ellipsis-horizontal", key: "sebep_diger", tr: "Diğer" },
};

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {(reason: string) => void} props.onSelect  Seçilen sebep kodu.
 * @param {string} [props.subtitle] Neyin şikâyet edildiğini anlatan kısa metin.
 */
export default function ReportReasonSheet({ visible, onClose, onSelect, subtitle }) {
  const { theme } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary }]}
    >
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />

      <Text style={[styles.title, { color: theme.text.primary }]}>
        {i18nText("autoI18n.sikayet_sebebi", "Şikâyet sebebi")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.text.muted }]}>
        {subtitle ||
          i18nText(
            "autoI18n.sikayet_sebebi_alt",
            "Bu içeriği neden bildiriyorsun? Şikâyetin incelenecek.",
          )}
      </Text>

      {REPORT_REASONS.map((reason) => {
        const ui = REASON_UI[reason] || REASON_UI.other;
        return (
          <Pressable
            key={reason}
            accessibilityRole="button"
            onPress={() => onSelect?.(reason)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border },
              pressed && { backgroundColor: theme.secondary },
            ]}
          >
            <Ionicons name={ui.icon} size={19} color={theme.text.muted} />
            <Text style={[styles.rowText, { color: theme.text.primary }]}>
              {i18nText(`autoI18n.${ui.key}`, ui.tr)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
          </Pressable>
        );
      })}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  rowText: { flex: 1, fontSize: 14.5, fontWeight: "600" },
});
