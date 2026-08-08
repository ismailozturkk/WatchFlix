// components/auth/BirthDateField.js
//
// Doğum tarihi alanı — dokununca uygulamanın ortak tarih seçicisini
// (components/modals/DatePickerModal.js) açar.
//
// ÜÇ YERDE AYNI BİLEŞEN: kayıt ekranı, Google profil tamamlama ve profil
// düzenleme. Doğrulama/sınır kuralları tek yerde kalsın diye — üç ekran ayrı
// ayrı yazsaydı biri 18 kontrolünü ya da gelecek tarih sınırını kaçırırdı.
//
// Neden elle yazma değil: GG/AA/YYYY kutuları "31 Şubat" gibi olmayan tarihleri
// yazdırabiliyor ve doğrulama hatası göstermek zorunda kalıyordu. Çark seçici
// yalnız var olan tarihleri üretiyor, sınır dışı gün/ay/yıl zaten kapalı geliyor
// — geçersiz durum hiç doğmuyor.
//
// Sözleşme dışarıya sade: `value` ISO ("YYYY-MM-DD") ya da null, `onChange(iso)`.
// 18 altı olmak kaydı ENGELLEMEZ, yalnız yetişkin içerik kapalı kalır
// (bkz. utils/ageGate.js).

import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import DatePickerModal, {
  MONTHS_EN,
  MONTHS_TR,
} from "../modals/DatePickerModal";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { calculateAge, MAX_AGE, MIN_ADULT_AGE, parseBirthDate } from "../../utils/ageGate";

// Çark boş değerle bugüne açılıyor; doğum tarihi için bu, çoğu kullanıcıya
// yirmi-otuz yıl kaydırmak demek. Kullanıcı listesinin ortasına yakın bir
// yerden başlasın.
const VARSAYILAN_ACILIS_YAS = 20;

/** "1998-03-05" → "5 Mart 1998" / "March 5, 1998" */
function tarihEtiketi(iso, isEn) {
  const parts = parseBirthDate(iso);
  if (!parts) return null;
  const ay = (isEn ? MONTHS_EN : MONTHS_TR)[parts.month - 1];
  return isEn
    ? `${ay} ${parts.day}, ${parts.year}`
    : `${parts.day} ${ay} ${parts.year}`;
}

export default function BirthDateField({
  value,
  onChange,
  theme,
  accent,
  fieldSurface,
  /** Alanın kendi başlığı ekranda ayrıca yazılıyorsa ipucu satırı gizlenebilir. */
  showHint = true,
}) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [acik, setAcik] = useState(false);

  const age = useMemo(() => calculateAge(value), [value]);
  const etiket = useMemo(() => tarihEtiketi(value, isEn), [value, isEn]);

  // Sınırlar: gelecekte doğum yok, 120 yaştan eskisi de gerçekçi değil.
  // Çark bu aralığın dışını zaten kapalı gösteriyor.
  const { minDate, maxDate } = useMemo(() => {
    const bugun = new Date();
    return {
      minDate: new Date(bugun.getFullYear() - MAX_AGE, 0, 1),
      maxDate: bugun,
    };
  }, []);

  const acilisDegeri = useMemo(() => {
    if (value) return value;
    const y = new Date().getFullYear() - VARSAYILAN_ACILIS_YAS;
    return `${y}-01-01`;
  }, [value]);

  const secili = !!etiket;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          secili
            ? `${i18nText("autoI18n.dogum_tarihi", "Doğum tarihi")}: ${etiket}`
            : i18nText("autoI18n.dogum_tarihini_sec", "Doğum tarihini seç")
        }
        onPress={() => setAcik(true)}
        style={({ pressed }) => [
          styles.shell,
          {
            backgroundColor: pressed ? alpha(accent, 0.08) : fieldSurface,
            borderColor: secili ? alpha(accent, 0.55) : theme.border,
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={secili ? accent : theme.text.muted}
        />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.valueText,
            { color: secili ? theme.text.primary : theme.text.muted },
          ]}
        >
          {etiket || i18nText("autoI18n.dogum_tarihi", "Doğum tarihi")}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.text.muted} />
      </Pressable>

      {showHint && (
        <Text style={[styles.hint, { color: theme.text.muted }]}>
          {age === null
            ? i18nText(
                "autoI18n.dogum_tarihi_neden",
                "Doğum tarihin yetişkin içerik ayarı için gerekli; profilinde gösterilmez.",
              )
            : age < MIN_ADULT_AGE
              ? i18nText(
                  "autoI18n.yas_alti_yetiskin_kapali",
                  "{{age}} yaşındasın — yetişkin içerik kapalı kalacak.",
                  { age },
                )
              : i18nText("autoI18n.yas_bilgisi", "{{age}} yaşındasın.", { age })}
        </Text>
      )}

      <DatePickerModal
        visible={acik}
        value={acilisDegeri}
        minDate={minDate}
        maxDate={maxDate}
        // "Dün / Bugün / Yarın" çipleri doğum tarihi için anlamsız.
        quickActions={false}
        title={i18nText("autoI18n.dogum_tarihi", "Doğum tarihi")}
        subtitle={i18nText(
          "autoI18n.dogum_tarihi_alt_baslik",
          "Yetişkin içerik ayarı bu tarihe göre belirlenir.",
        )}
        confirmLabel={i18nText("autoI18n.tarihi_sec", "Tarihi Seç")}
        // maxDateErrorMsg varsayılanı ("Gelecek bir tarih seçilemez") burada da
        // doğru; min tarafındaki varsayılan ise "yayın tarihi"nden bahsediyor —
        // bu ekranda anlamsız, o yüzden yalnız onu değiştiriyoruz.
        minDateErrorMsg={i18nText(
          "autoI18n.gecerli_bir_dogum_yili_sec",
          "Daha eski bir tarih seçilemez",
        )}
        onConfirm={(iso) => {
          setAcik(false);
          onChange?.(iso);
        }}
        onClose={() => setAcik(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  shell: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
});
