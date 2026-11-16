// screens/ForceUpdateScreen.js
//
// ZORUNLU GÜNCELLEME EKRANI (16 Kas 2026; bkz. utils/forceUpdate.js). App.js bunu gezginin ve
// e-posta doğrulama kapısının YERİNE çizer — `navigation` yok. Tek eylem: mağazayı aç.
// Ekran çıkışsızdır: sürüm yükseltilene (ya da AppConfig/minVersion düşürülene) kadar kalır;
// uygulama öne dönünce useForceUpdate yeniden denetler.

import React, { useCallback, useState } from "react";
import { Linking, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "@components/AppToast";
import ScreenDecor from "../components/ScreenDecor";
import GlassTouchable from "../components/common/GlassTouchable";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { alpha } from "../theme/colors";
import { isLightSurface } from "../utils/colorUtils";
import { fillAuthEmailText } from "../utils/authEmailCopy";
import { getForceUpdateCopy } from "../utils/forceUpdate";

export default function ForceUpdateScreen({ current, minimum, links }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const copy = getForceUpdateCopy(language);
  const isLight = isLightSurface(theme.primary);
  const [opening, setOpening] = useState(false);

  const openStore = useCallback(async () => {
    if (opening || !links) return;
    setOpening(true);
    try {
      try {
        await Linking.openURL(links.primary);
      } catch {
        await Linking.openURL(links.fallback);
      }
    } catch {
      Toast.show({ type: "error", text1: copy.openFailed });
    } finally {
      setOpening(false);
    }
  }, [opening, links, copy]);

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="auth" iconOpacity={isLight ? 0.05 : 0.08} />
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name="cloud-download-outline" size={30} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.text.primary }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>{copy.body}</Text>

        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {current && minimum ? (
            <Text style={[styles.versions, { color: theme.text.muted }]}>
              {fillAuthEmailText(copy.versions, { current, required: minimum })}
            </Text>
          ) : null}
          <GlassTouchable
            accessibilityRole="button"
            accessibilityLabel={copy.update}
            onPress={openStore}
            disabled={opening}
            style={[styles.primary, { backgroundColor: theme.accent }, opening && styles.disabled]}
          >
            <Ionicons name="arrow-up-circle-outline" size={19} color="#fff" />
            <Text style={styles.primaryText}>{copy.update}</Text>
          </GlassTouchable>
        </View>

        <Text style={[styles.why, { color: theme.text.muted }]}>{copy.why}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    alignItems: "center",
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  versions: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  primary: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  why: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 18,
  },
});
