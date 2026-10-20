// components/auth/EmailSuffixRow.js
//
// E-posta alanının altında hızlı alan-adı önerileri (@gmail.com vb.).
// Chip'e basılınca "@" öncesindeki yerel kısım korunur, sonek eklenir/değişir:
//   "abc"            → "abc@gmail.com"
//   "abc@hotm"       → "abc@gmail.com" (seçilen sonekle değişir)
// Auth ekranlarının üçünde de (giriş / kayıt / şifremi unuttum) kullanılır.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { alpha } from "../../theme/colors";

// En çok kullanılan 3 e-posta soneki
export const EMAIL_SUFFIXES = ["@gmail.com", "@hotmail.com", "@outlook.com"];

export default function EmailSuffixRow({
  email = "",
  onApply,
  theme,
  accent,
  fieldSurface,
}) {
  return (
    <View style={styles.row}>
      {EMAIL_SUFFIXES.map((sfx) => {
        const active = email.toLowerCase().endsWith(sfx);
        return (
          <TouchableOpacity
            key={sfx}
            accessibilityRole="button"
            accessibilityLabel={sfx}
            style={[
              styles.chip,
              {
                backgroundColor: active ? alpha(accent, 0.14) : fieldSurface,
                borderColor: active ? alpha(accent, 0.6) : theme.border,
              },
            ]}
            onPress={() => onApply((email.split("@")[0] || "") + sfx)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? accent : theme.text.secondary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {sfx}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 7,
    // Alanın hemen altına yapışık dursun: üstteki alana 8, alttakine 14 boşluk
    // (kart içi satır aralığı 14).
    marginTop: -6,
  },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
});
