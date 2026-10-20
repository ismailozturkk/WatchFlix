import { alpha } from "@theme/colors";
// components/game/AnswerOptionCard.js
//
// Tek bir cevap şıkkı (Part 12.3 / Part 19). Doğru/yanlış renk ve ikon mantığı
// burada hesaplanır; girdi olarak sadece şık nesnesi + oyun durum bayrakları
// alınır. Firestore/TMDB isteği yapmaz.
//
// DURUMLAR: bekliyor • (cevap sonrası) seçilen-doğru • seçilen-yanlış • doğru
// olan (kaçırılan) • diğerleri soluk • %50 jokeriyle elenen (üstü çizili).
// Sonuç RENKLE birlikte harf rozetindeki ikon + metinle de verilir (renk körlüğü).

import React, { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

// Part 21.1: "A şıkkı, Film adı" gibi okunabilir harf ön eki.
const OPTION_LETTERS = ["A", "B", "C", "D"];

// Part 25.2: bu bileşen 4 kopya olarak her soru render'ında oluşur; React.memo
// ile kendi prop'ları değişmedikçe yeniden render edilmesi önlenir (cevap
// dokunması geri bildiriminin <100ms hedefine yaklaşması için önemli).
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
  compact = false,
  anim,
  onPress,
}) {
  const press = useRef(new Animated.Value(1)).current;
  const isWrongSelected = isAnswered && isSelected && !isCorrectOption;
  const isCorrectSelected = isAnswered && isSelected && isCorrectOption;
  const isMissedCorrect = isAnswered && !isSelected && isCorrectOption;
  const dimmed = isAnswered && !isSelected && !isCorrectOption;

  let borderColor = theme.border;
  let bgColor = theme.secondary;
  let badgeBg = theme.primary;
  let badgeColor = theme.text.secondary;
  if (isCorrectSelected || isMissedCorrect) {
    borderColor = gameTokens.correct;
    bgColor = alpha(gameTokens.correct, isCorrectSelected ? 0.18 : 0.1);
    badgeBg = gameTokens.correct;
    badgeColor = "#FFFFFF";
  } else if (isWrongSelected) {
    borderColor = gameTokens.incorrect;
    bgColor = alpha(gameTokens.incorrect, 0.16);
    badgeBg = gameTokens.incorrect;
    badgeColor = "#FFFFFF";
  }

  // Part 21.1: seçilen şıkkın sonucu (doğru/yanlış) screen reader'a duyurulur;
  // görme engelli kullanıcı sadece renge/ikona bağımlı kalmaz.
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
  // değişmedikçe aynı fonksiyon referansı korunur (Part 25.2).
  const handlePress = useCallback(() => {
    onPress(index);
  }, [onPress, index]);

  const pressTo = useCallback(
    (value) => {
      Animated.spring(press, { toValue: value, speed: 40, bounciness: 6, useNativeDriver: true }).start();
    },
    [press],
  );

  const disabled = isAnswered || isEliminated;
  const baseOpacity = isEliminated ? 0.35 : dimmed ? 0.55 : 1;

  return (
    <Animated.View
      style={{
        // Elenen şık tamamen kaybolmak yerine okunabilir kalır (Part 12.3)
        opacity: Animated.multiply(anim, baseOpacity),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          { scale: press },
        ],
      }}
    >
      <Pressable
        disabled={disabled}
        onPress={handlePress}
        onPressIn={() => pressTo(0.975)}
        onPressOut={() => pressTo(1)}
        style={[styles.card, compact && styles.cardCompact, { backgroundColor: bgColor, borderColor }]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={
          i18nText("autoI18n.oyun_secenek_etiketi", "{{letter}} seçeneği, {{title}}", {
            letter,
            title: item.title,
          }) +
          (showTypeBadge
            ? `, ${item.type === "movie" ? i18nText("autoI18n.film_2", "Film") : i18nText("autoI18n.dizi_2", "Dizi")}`
            : "")
        }
      >
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          {isCorrectSelected || isMissedCorrect ? (
            <AppIcon family="Ionicons" name="checkmark" size={17} color={badgeColor} />
          ) : isWrongSelected ? (
            <AppIcon family="Ionicons" name="close" size={17} color={badgeColor} />
          ) : (
            <Text style={[styles.badgeText, { color: badgeColor }]} allowFontScaling={false}>
              {letter}
            </Text>
          )}
        </View>

        <View style={styles.textWrap}>
          <Text
            style={[
              styles.title,
              { color: theme.text.primary },
              isEliminated && styles.titleEliminated,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {showTypeBadge ? (
            <Text style={[styles.type, { color: theme.text.muted }]} allowFontScaling={false}>
              {item.type === "movie" ? i18nText("autoI18n.film_2", "Film") : i18nText("autoI18n.dizi_2", "Dizi")}
            </Text>
          ) : null}
        </View>

        {/* Sonuç sadece renkle değil, ikon + metinle de gösterilir (Part 12.3) */}
        {isAnswered && (isCorrectSelected || isMissedCorrect || isWrongSelected) ? (
          <Text
            style={[styles.resultText, { color: isWrongSelected ? gameTokens.incorrect : gameTokens.correct }]}
            allowFontScaling={false}
          >
            {isWrongSelected ? i18nText("autoI18n.yanlis", "Yanlış") : i18nText("autoI18n.dogru", "Doğru")}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 12,
  },
  cardCompact: { minHeight: 50, paddingVertical: 7 },
  badge: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 14, fontWeight: "900" },
  textWrap: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  titleEliminated: { textDecorationLine: "line-through" },
  type: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  resultText: { fontSize: 12, fontWeight: "900" },
});

export default React.memo(AnswerOptionCard);
