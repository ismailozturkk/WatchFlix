// components/detail/CertificationBadge.js
//
// Film / dizi detay ekranının tür çiplerinin başındaki yaş sınırı rozeti (PG-13, TV-MA, 13+, 18+ …).
// Veri TMDB'den zaten geliyordu (film: release_dates, dizi: content_ratings); seçim ve ton mantığı
// utils/certification.js'te (saf, testli).
//
// Derece bulunamazsa HİÇBİR ŞEY çizmez (boş kutu / "?" yok). Kullanıcının bölgesinde kayıt yoksa ABD
// derecesi bölge etiketiyle gösterilir ("PG-13 · US") — başka bir ülkenin derecesi yerel sanılmasın.
//
// Tür çipleriyle aynı satırda durur (satır sarıyor, taşma yok); çiplerden ayırt edilsin diye köşeleri
// daha keskin ve çerçevesi tona göre renkli: yeşil = her yaş, amber = genç, kırmızı = yetişkin.
import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { pickByLanguage } from "../../utils/appLanguages";
import { certificationOf, certificationTone } from "../../utils/certification";

const TONE_COLORS = Object.freeze({
  all: "#22C55E",
  teen: "#F59E0B",
  mature: "#EF4444",
});

const LABELS = Object.freeze({
  tr: { rating: "Yaş sınırı", outside: "{region} derecesi" },
  en: { rating: "Age rating", outside: "{region} rating" },
  es: { rating: "Clasificación por edades", outside: "Clasificación de {region}" },
  pt: { rating: "Classificação indicativa", outside: "Classificação de {region}" },
});

/**
 * @param {"movie"|"tv"} props.mediaType
 * @param {object} props.details  TMDB detay cevabı
 * @param {string} props.region   Kullanıcının TMDB bölgesi
 */
function CertificationBadge({ mediaType, details, region }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const certification = useMemo(() => certificationOf(mediaType, details, region), [mediaType, details, region]);
  if (!certification) return null;

  const tone = certificationTone(certification.label);
  const color = TONE_COLORS[tone] ?? theme.text.muted;
  const copy = pickByLanguage(language, LABELS);
  const outside = certification.fallback ? ` · ${certification.region}` : "";
  const spoken = certification.fallback
    ? `${copy.rating}: ${certification.label} (${copy.outside.replace("{region}", certification.region)})`
    : `${copy.rating}: ${certification.label}`;

  return (
    <View
      testID="certification-badge"
      accessible
      accessibilityLabel={spoken}
      style={[styles.badge, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.7) }]}
    >
      <Ionicons name="shield-checkmark-outline" size={11} color={color} />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.text, { color }]}>
        {`${certification.label}${outside}`}
      </Text>
    </View>
  );
}

export default memo(CertificationBadge);

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.25,
  },
  text: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
});
