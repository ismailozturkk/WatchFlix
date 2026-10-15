// components/game/GameLoadingState.js
//
// Soru hazırlanırken gösterilen tam ekran yükleme durumu (Part 19). Dönen
// gösterge yerine nefes alan bir film ikonu; mesaj oyuna göre değişir (günlük
// sahneler / afiş / normal soru).

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

export default function GameLoadingState({ theme, icon = "film", message }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <View style={styles.wrap}>
        <View style={styles.iconStage}>
          <Animated.View
            style={[
              styles.halo,
              {
                backgroundColor: alpha(theme.accent, 0.18),
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
              },
            ]}
          />
          <View style={[styles.iconCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name={icon} size={30} color={theme.accent} />
          </View>
        </View>
        <Text style={[styles.text, { color: theme.text.secondary }]}>
          {message || i18nText("autoI18n.soru_hazirlaniyor", "Soru hazırlanıyor...")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 22 },
  iconStage: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 110, height: 110, borderRadius: 55 },
  iconCircle: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 14, fontWeight: "700" },
});
