// components/game/AnswerOptionCard.js
//
// Tek bir cevap sikki karti (Part 12.3 / Part 19). Dogru/yanlis renk ve ikon
// mantigi burada hesaplanir; girdi olarak sadece sik nesnesi + oyun durum
// bayraklari alinir. Firestore/TMDB istegi yapmaz.

import React, { useCallback, useEffect } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

// Part 21.1: "A şıkkı, Film adı" gibi okunabilir harf ön eki.
const OPTION_LETTERS = ["A", "B", "C", "D"];

// Part 25.2: bu bilesen 4 kopya olarak her soru render'inda (ve animasyon
// kareleri sirasinda ebeveyn yeniden render olunca) olusur; React.memo ile
// kendi prop'lari degismedikce yeniden render edilmesi onlenir (cevap
// dokunmasi geri bildiriminin <100ms hedefine yaklasmasi icin onemli).
function AnswerOptionCard({
  theme,
  gameTokens,
  item,
  index,
  isCorrectOption,
  isSelected,
  isAnswered,
  isEliminated,
  showTypeBadge,
  anim,
  onPress,
}) {
  const isWrongSelected = isAnswered && isSelected && !isCorrectOption;
  const showCorrect = isAnswered && isCorrectOption;

  let borderColor = "rgba(255,255,255,0.15)";
  let bgColor = "rgba(255,255,255,0.06)";
  if (showCorrect) {
    borderColor = gameTokens.correct;
    bgColor = "rgba(0,230,118,0.15)";
  }
  if (isWrongSelected) {
    borderColor = gameTokens.incorrect;
    bgColor = "rgba(255,23,68,0.15)";
  }

  // Part 21.1: secilen sikkin sonucu (dogru/yanlis) screen reader'a
  // duyurulur; gorme engelli kullanici sadece renge/ikona bagimli kalmaz.
  useEffect(() => {
    if (!isAnswered || !isSelected) return;
    const message = isCorrectOption
      ? i18nText("autoI18n.oyun_cevap_dogru_duyuru", "Doğru cevap")
      : i18nText("autoI18n.oyun_cevap_yanlis_duyuru", "Yanlış cevap. Doğrusu: {{title}}", {
          title: item?.title || "",
        });
    AccessibilityInfo.announceForAccessibility?.(message);
  }, [isAnswered, isSelected, isCorrectOption, item?.title]);

  const letter = OPTION_LETTERS[index] || String(index + 1);

  // Inline "() => onPress(index)" yerine useCallback: index/onPress
  // degismedikce ayni fonksiyon referansi korunur (Part 25.2).
  const handlePress = useCallback(() => {
    onPress(index);
  }, [onPress, index]);

  return (
    <Animated.View
      style={{
        // Elenen şık tamamen kaybolmak yerine okunabilir kalır (Part 12.3)
        opacity: isEliminated ? 0.45 : anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={isAnswered || isEliminated}
        onPress={handlePress}
        style={[styles.optionCard, { backgroundColor: bgColor, borderColor }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isAnswered || isEliminated }}
        accessibilityLabel={i18nText(
          "autoI18n.oyun_secenek_etiketi",
          "{{letter}} seçeneği, {{title}}",
          { letter, title: item.title },
        ) + (
          showTypeBadge
            ? `, ${item.type === "movie" ? i18nText("autoI18n.film_2", "Film") : i18nText("autoI18n.dizi_2", "Dizi")}`
            : ""
        )}
      >
        <View style={styles.optionTextWrap}>
          <Text style={[styles.optionTitle, { color: theme.text.primary }]} numberOfLines={2}>
            {item.title}
          </Text>
          {showTypeBadge && (
            <View style={styles.optionTypeBadge}>
              <Text style={[styles.optionType, { color: theme.text.muted }]}>
                {item.type === "movie" ? i18nText("autoI18n.film_2", "Film") : i18nText("autoI18n.dizi_2", "Dizi")}
              </Text>
            </View>
          )}
        </View>
        {/* Sonuç sadece renkle değil, ikon + metinle de gösterilir (Part 12.3) */}
        {isAnswered && (showCorrect || isWrongSelected) && (
          <View style={styles.resultTag}>
            <AppIcon
              family="Ionicons"
              name={showCorrect ? "checkmark-circle" : "close-circle"}
              size={20}
              color={showCorrect ? gameTokens.correct : gameTokens.incorrect}
            />
            <Text style={[styles.resultTagText, { color: showCorrect ? gameTokens.correct : gameTokens.incorrect }]}>
              {showCorrect ? i18nText("autoI18n.dogru", "Doğru") : i18nText("autoI18n.yanlis", "Yanlış")}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  optionCard: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, gap: 14 },
  optionTextWrap: { flex: 1, gap: 6 },
  optionTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20, letterSpacing: 0.2 },
  optionTypeBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  optionType: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultTagText: { fontSize: 12, fontWeight: "900" },
});

export default React.memo(AnswerOptionCard);
