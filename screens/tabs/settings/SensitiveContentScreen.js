// screens/tabs/settings/SensitiveContentScreen.js
//
// Ayarlar > Hassas İçerikler. Eski tek "Yetişkin içeriği" anahtarının yerini
// aldı: dört kategori (yetişkin, uyuşturucu, kan/vahşet, savaş), hepsi
// varsayılan KAPALI = gizli. Süzme mantığı utils/sensitiveContent.js'te,
// uygulanması utils/tmdbAdultGuard.js'te.
//
// 18 altı hesapta Ayarlar'daki satır hiç çizilmiyor; yine de bu ekrana bir
// yolla gelinirse anahtarlar kilitli görünür (bağlam da açmayı reddeder).

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SwitchToggle from "@components/SwitchToggle";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useContentSettings } from "@context/AppSettingsContext";
import { SENSITIVE_CATEGORIES } from "../../../utils/sensitiveContent";
import { SettingsSubScreen, SettingRow, buildUiColors } from "./settingsUi";
import { getSensitiveContentCopy } from "./sensitiveContentCopy";

const CATEGORY_UI = {
  adult: { icon: "eye-off-outline", color: "purple", bg: "iconPurple" },
  drugs: { icon: "medkit-outline", color: "amber", bg: "iconAmber" },
  gore: { icon: "water-outline", color: "danger", bg: "dangerDim" },
  war: { icon: "shield-outline", color: "blue", bg: "iconBlue" },
};

export default function SensitiveContentScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = getSensitiveContentCopy(language);
  const { sensitiveContent, changeSensitiveContent, ageRestricted } = useContentSettings();

  return (
    <SettingsSubScreen title={copy.title}>
      <Text allowFontScaling={false} style={[st.intro, { color: C.muted }]}>
        {copy.intro}
      </Text>
      <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {SENSITIVE_CATEGORIES.map((category, index) => {
          const ui = CATEGORY_UI[category];
          const [title, subtitle] = copy.categories[category];
          const value = sensitiveContent?.[category] === true;
          return (
            <SettingRow
              key={category}
              colors={C}
              iconBg={C[ui.bg]}
              iconColor={C[ui.color]}
              iconName={ui.icon}
              title={title}
              subtitle={subtitle}
              last={index === SENSITIVE_CATEGORIES.length - 1}
              onPress={ageRestricted ? undefined : () => changeSensitiveContent(category, !value)}
              right={
                <SwitchToggle
                  value={value}
                  onValueChange={(next) => changeSensitiveContent(category, next)}
                  disabled={ageRestricted}
                  size={36}
                />
              }
            />
          );
        })}
      </View>
      <Text allowFontScaling={false} style={[st.note, { color: C.muted }]}>
        {copy.note}
      </Text>
    </SettingsSubScreen>
  );
}

const st = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 12, paddingHorizontal: 4 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  note: { fontSize: 12, lineHeight: 17, marginTop: 12, paddingHorizontal: 4 },
});
