// components/home/SectionsHiddenNotice.js
//
// Bir ekranın TÜM bölümleri Ayarlar > Kişiselleştirme > Ekran bölümleri'nde gizlenince
// (ya da kalan bölümler veri/ayar yüzünden çizilmeyince) ekranın boş kalmaması için
// gösterilen kart: ne olduğunu söyler ve ayarlara götüren düğme verir. Aksi halde
// kullanıcı boş bir ekranla baş başa kalır ve nedenini bulamazdı.
//
// `screen` ayar sayfasının hangi ekran sekmesinde açılacağını belirler.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { getSectionVisibilityCopy } from "../../screens/tabs/settings/sectionVisibilityCopy";
import GlassTouchable from "../common/GlassTouchable";

function SectionsHiddenNotice({ navigation, screen }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const copy = getSectionVisibilityCopy(language).ui;
  const accent = theme.accent ?? "#3B82F6";

  return (
    <View testID="sections-hidden-notice" style={styles.wrap}>
      <View style={[styles.iconTile, { backgroundColor: alpha(accent, 0.14) }]}>
        <AppIcon name="eye-off-outline" size={26} color={accent} />
      </View>
      <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
        {copy.emptyTitle}
      </Text>
      <Text allowFontScaling={false} style={[styles.text, { color: theme.text.muted }]}>
        {copy.emptyText}
      </Text>
      <GlassTouchable
        testID="sections-hidden-action"
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={() => navigation?.navigate?.("SectionVisibilityScreen", { initialScreen: screen })}
        style={[styles.action, { backgroundColor: accent }]}
      >
        <AppIcon name="options-outline" size={16} color="#FFFFFF" />
        <Text allowFontScaling={false} style={styles.actionText}>
          {copy.emptyAction}
        </Text>
      </GlassTouchable>
    </View>
  );
}

export default React.memo(SectionsHiddenNotice);

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 24,
  },
  iconTile: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "800", textAlign: "center", letterSpacing: -0.2 },
  text: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    marginTop: 20,
  },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
