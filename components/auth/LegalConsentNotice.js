// components/auth/LegalConsentNotice.js
//
// Kayıt butonunun üstündeki "kayıt olarak ... kabul etmiş olursun" satırı.
//
// İKİ KAYIT YOLU, TEK BİLEŞEN: e-posta kaydı ve Google profil tamamlama.
// Metin ve bağlantılar ayrışmasın diye tek yerde.
//
// ONAY KUTUSU YOK, bilerek: Apple/Play için bilgilendirme + çalışan bağlantı
// yeterli. KVKK'nın AÇIK RIZA istediği şey isteğe bağlı işlemler (ör.
// pazarlama iletisi); öyle bir şey eklenirse AYRI bir kutu gerekir, bu satır
// onun yerine geçmez.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { openLegalPage } from "../../utils/legalLinks";
import { i18nText } from "../../utils/i18nText";

export default function LegalConsentNotice({ theme, accent }) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";
  const muted = theme?.text?.muted ?? "#999";

  // BOŞLUKLAR VE EKLER ÇEVİRİ METNİNİN İÇİNDE — bilerek. Türkçede bağlantı
  // adına ek geliyor ("Koşulları'nı"), yani araya boşluk KONMAMALI;
  // İngilizcede ise gerekiyor (" and "). JSX'e sabit boşluk koyulsaydı biri
  // ya da diğeri bozulurdu. Çeviri düzenlerken baştaki/sondaki boşlukları
  // silme.
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: muted }]}>
        {i18nText("autoI18n.kayit_onay_bas", "Kayıt olarak ")}
      </Text>
      <Pressable onPress={() => openLegalPage("terms", lang)} hitSlop={6}>
        <Text style={[styles.link, { color: accent }]}>
          {i18nText("autoI18n.kullanim_kosullari", "Kullanım Koşulları")}
        </Text>
      </Pressable>
      <Text style={[styles.text, { color: muted }]}>
        {i18nText("autoI18n.kayit_onay_orta", "'nı ve ")}
      </Text>
      <Pressable onPress={() => openLegalPage("privacy", lang)} hitSlop={6}>
        <Text style={[styles.link, { color: accent }]}>
          {i18nText("autoI18n.gizlilik_politikasi", "Gizlilik Politikası")}
        </Text>
      </Pressable>
      <Text style={[styles.text, { color: muted }]}>
        {i18nText("autoI18n.kayit_onay_son", "'nı kabul etmiş olursun.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Satır sarması gerekiyor: "Kullanım Koşulları" dokunulabilir olmak zorunda,
  // yani ayrı bir bileşen — tek Text içinde nested link dar ekranda taşardı.
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  text: { fontSize: 11.5, lineHeight: 17 },
  link: { fontSize: 11.5, lineHeight: 17, fontWeight: "700", textDecorationLine: "underline" },
});
