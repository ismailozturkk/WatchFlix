import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";

/* Özet akordiyonu: kapalıyken 2 satır, dokununca animasyonla açılır.
   Durumunu kendi içinde tutar; ekranlar sadece overview metnini verir. */
export default function OverviewAccordion({ overview }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const opening = !expanded;
    Animated.timing(anim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 260 : 220,
      useNativeDriver: false,
    }).start();
    setExpanded(opening);
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={toggle}
        style={[
          styles.accordionCard,
          {
            backgroundColor: theme.secondary,
            borderColor: expanded ? theme.accent + "88" : theme.border,
          },
        ]}
      >
        <View style={styles.accordionHeader}>
          <View
            style={[styles.sectionAccent, { backgroundColor: theme.accent }]}
          />
          <Text
            allowFontScaling={false}
            style={[styles.accordionTitle, { color: theme.text.primary }]}
          >
            {t.overview || i18nText("autoI18n.ozet", "Özet")}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={expanded ? theme.accent : theme.text.muted}
          />
        </View>
        <Animated.View
          style={{
            maxHeight: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [52, 400],
            }),
            overflow: "hidden",
          }}
        >
          <Text
            allowFontScaling={false}
            style={[styles.accordionBody, { color: theme.text.secondary }]}
            numberOfLines={expanded ? null : 2}
          >
            {overview || i18nText("autoI18n.ozet_bulunmuyor", "Özet bulunmuyor.")}
          </Text>
        </Animated.View>
        {!expanded && (
          <Text
            allowFontScaling={false}
            style={[styles.accordionMore, { color: theme.accent }]}
          >{i18nText("autoI18n.devami", "devamı...")}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  accordionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionAccent: { width: 3, height: 18, borderRadius: 2 },
  accordionTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  accordionBody: { fontSize: 13, lineHeight: 20 },
  accordionMore: { fontSize: 11, fontWeight: "600", marginTop: 6 },
});
