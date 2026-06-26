import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";


const TABS = [
  { id: "background", icon: "image-outline", label: "Arka Plan" },
  { id: "poster", icon: "film-outline", label: "Poster" },
  { id: "content", icon: "layers-outline", label: i18nText("autoI18n.icerik", "İçerik") },
  { id: "style", icon: "color-palette-outline", label: "Stil" },
];

function StoryTabsComponent({ activeTab, onChangeTab }) {
  const { theme } = useTheme();
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
            <Text allowFontScaling={false} style={[styles.label, { color }]}>
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
    alignItems: "center",
    flexDirection:"row",
    paddingBottom:10,
    gap: 4,
  },
  label: { fontSize: 11, fontWeight: "700" },
  
});
