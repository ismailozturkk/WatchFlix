import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "../../../context/ThemeContext";

const LINKS = [
  {
    key: "imdb_id",
    url: (v) => `https://www.imdb.com/title/${v}`,
    icon: "imdb",
    label: "IMDb",
  },
  {
    key: "facebook_id",
    url: (v) => `https://www.facebook.com/${v}`,
    icon: "facebook",
    label: "Facebook",
  },
  {
    key: "instagram_id",
    url: (v) => `https://www.instagram.com/${v}`,
    icon: "instagram",
    label: "Instagram",
  },
  {
    key: "twitter_id",
    url: (v) => `https://twitter.com/${v}`,
    icon: "twitter",
    label: "Twitter",
  },
];

/* Dış bağlantı çipleri: IMDb / Facebook / Instagram / Twitter. */
export default function MovieExternalLinks({ externalIds }) {
  const { theme } = useTheme();

  if (!externalIds) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 24 }}
    >
      <View style={styles.externalLinks}>
        {LINKS.map(({ key, url, icon, label }) =>
          externalIds[key] ? (
            <TouchableOpacity
              key={key}
              style={[
                styles.extLink,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
              onPress={() => Linking.openURL(url(externalIds[key]))}
              activeOpacity={0.8}
            >
              <FontAwesome5 name={icon} size={15} color={theme.accent} />
              <Text
                allowFontScaling={false}
                style={[styles.extLinkText, { color: theme.text.primary }]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ) : null,
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  externalLinks: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  extLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  extLinkText: { fontSize: 13, fontWeight: "600" },
});
