import React, { memo, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";


// Etiketler çizim anında çözülür: modül yüklenirken dondurulursa dil değişince eski dilde kalır.
const buildTabs = () => [
  { id: "background", icon: "image-outline", label: i18nText("autoI18n.arka_plan", "Arka Plan") },
  { id: "poster", icon: "film-outline", label: "Poster" },
  { id: "content", icon: "layers-outline", label: i18nText("autoI18n.icerik", "İçerik") },
  { id: "style", icon: "color-palette-outline", label: i18nText("autoI18n.stil", "Stil") },
];

// Sekmeler eşit genişlikte (flex:1) ve simge üstte, etiket altta: dar telefonda
// ("Arka Plan" / "Background" gibi uzun etiketler) komşu sekmenin üstüne binmez;
// etiket sığmazsa tek satırda küçülür.
function StoryTabsComponent({ activeTab, onChangeTab }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const TABS = useMemo(buildTabs, [language]);
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;
        const color = selected ? theme.accent : theme.text.muted;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.7}
            onPress={() => onChangeTab(tab.id)}
            style={styles.tab}
          >
            <Ionicons name={tab.icon} size={19} color={color} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, { color }]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const StoryTabs = memo(StoryTabsComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  label: { alignSelf: "stretch", textAlign: "center", fontSize: 11, fontWeight: "700" },
});
