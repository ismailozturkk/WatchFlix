// components/game/AnswerFeedbackBar.js
//
// Cevap verildikten sonra seçeneklerin altında beliren geri bildirim çubuğu.
// ESKİ DAVRANIŞ: sonuç 1,4 sn sabit bekleyip kendiliğinden geçiyordu; oyuncu ne
// kadar puan aldığını ya da doğrusunu okuyamadan soru değişiyordu ve ATLAMANIN
// yolu yoktu. ŞİMDİ: sonuç + puan + doğru ad burada okunur, "Sonraki" ile hemen
// geçilir; otomatik geçiş çubuğun dolmasıyla görünür kalır.

import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

export default function AnswerFeedbackBar({
  theme,
  gameTokens,
  outcome, // "correct" | "wrong" | "timeout"
  points,
  penalty,
  title,
  year,
  autoAdvanceMs,
  isLast,
  reduceMotion,
  onNext,
}) {
  const fill = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    fill.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // Doluluk çubuğu, otomatik geçişin ne zaman olacağını gösterir.
    const timer = Animated.timing(fill, { toValue: 1, duration: autoAdvanceMs, easing: Easing.linear, useNativeDriver: true });
    timer.start();
    return () => timer.stop();
  }, [autoAdvanceMs, enter, fill, reduceMotion]);

  const correct = outcome === "correct";
  const color = correct ? gameTokens.correct : gameTokens.incorrect;
  const heading = correct
    ? i18nText("autoI18n.oyun_dogru_bildin", "Doğru bildin!")
    : outcome === "timeout"
      ? i18nText("autoI18n.oyun_sure_doldu", "Süre doldu")
      : i18nText("autoI18n.oyun_yanlis_cevap", "Yanlış cevap");

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: alpha(color, 0.12),
          borderColor: alpha(color, 0.45),
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: color }]}>
        <AppIcon family="Ionicons" name={correct ? "checkmark" : outcome === "timeout" ? "time" : "close"} size={18} color="#FFFFFF" />
      </View>

      <View style={styles.copy}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { color }]} allowFontScaling={false} numberOfLines={1}>
            {heading}
          </Text>
          {correct && points > 0 ? (
            <Text style={[styles.points, { color: gameTokens.gold }]} allowFontScaling={false}>
              +{points}
            </Text>
          ) : null}
          {!correct && penalty ? (
            <Text style={[styles.points, { color: gameTokens.incorrect }]} allowFontScaling={false}>
              {penalty}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.answer, { color: theme.text.secondary }]} allowFontScaling={false} numberOfLines={1}>
          {title}
          {year ? ` (${year})` : ""}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLast ? i18nText("autoI18n.oyun_bitir", "Bitir") : i18nText("autoI18n.oyun_sonraki", "Sonraki")}
        onPress={onNext}
        style={[styles.next, { backgroundColor: color }]}
      >
        <Text style={styles.nextText} allowFontScaling={false}>
          {isLast ? i18nText("autoI18n.oyun_bitir", "Bitir") : i18nText("autoI18n.oyun_sonraki", "Sonraki")}
        </Text>
        <AppIcon family="Ionicons" name="arrow-forward" size={14} color="#FFFFFF" />
        <View style={styles.nextTrack} pointerEvents="none">
          <Animated.View
            style={[styles.nextFill, { transform: [{ scaleX: fill }], transformOrigin: "left center" }]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 58, borderRadius: 18, borderWidth: 1.5, paddingLeft: 10, paddingRight: 8, paddingVertical: 8 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontSize: 14, fontWeight: "900", flexShrink: 1 },
  points: { fontSize: 14, fontWeight: "900" },
  answer: { fontSize: 11.5, fontWeight: "700", marginTop: 2 },
  next: { flexDirection: "row", alignItems: "center", gap: 5, height: 40, paddingHorizontal: 13, borderRadius: 14, overflow: "hidden" },
  nextText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },
  nextTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  nextFill: { height: "100%", width: "100%", backgroundColor: "rgba(255,255,255,0.9)" },
});
