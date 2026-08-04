// components/comments/CommentScopeBadge.js
//
// Yorumun hangi kapsama (dizi / sezon / bölüm) referans verdiğini gösteren
// küçük rozet. Dokunulduğunda o kapsamın filtresine geçilir — "S2·B5" rozetine
// basmak akışı doğrudan o bölümün yorumlarına daraltır.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { COMMENT_SCOPE, normalizeScope } from "../../utils/commentScope";
import { scopeShort } from "./scopeTexts";

/** Kapsam → renk + ikon. Üç seviye ilk bakışta ayırt edilebilsin. */
export const scopeVisual = (raw, theme) => {
  const { scope } = normalizeScope(raw);
  if (scope === COMMENT_SCOPE.EPISODE) {
    return { color: theme.colors?.green || theme.accent, icon: "play-circle" };
  }
  if (scope === COMMENT_SCOPE.SEASON) {
    return { color: theme.colors?.orange || theme.accent, icon: "albums" };
  }
  return { color: theme.accent, icon: "tv" };
};

function CommentScopeBadge({ scope, theme, onPress, size = "sm", style }) {
  const { color, icon } = scopeVisual(scope, theme);
  const compact = size === "sm";
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.75, hitSlop: 6 } : {})}
      style={[
        styles.badge,
        compact ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.4) },
        style,
      ]}
    >
      <Ionicons name={icon} size={compact ? 9 : 12} color={color} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.text, compact ? styles.textSm : styles.textMd, { color }]}
      >
        {scopeShort(scope)}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  badgeSm: {
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
  },
  badgeMd: {
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  text: { fontWeight: "800" },
  textSm: { fontSize: 8.5, letterSpacing: 0.2 },
  textMd: { fontSize: 11 },
});

export default React.memo(CommentScopeBadge);
