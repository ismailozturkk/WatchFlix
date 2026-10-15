// components/friends/FriendsSearchField.js
//
// Arkadaş ekranlarının ortak arama / süzme kutusu. Odaklanınca çerçeve vurgu
// rengine döner; yazı varken sağda temizleme düğmesi, arama sürerken (loading)
// onun yerinde küçük bir dönen gösterge çıkar.

import React, { memo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import GlassField from "@components/common/GlassField";
import { useGlassScheme } from "@components/common/GlassSurface";
import { i18nText } from "@utils/i18nText";

function FriendsSearchField({
  value,
  onChangeText,
  placeholder,
  loading = false,
  autoFocus = false,
  returnKeyType = "search",
  style,
}) {
  const { theme } = useTheme();
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const scheme = useGlassScheme();

  const clear = () => {
    onChangeText("");
    inputRef.current?.focus();
  };

  return (
    <GlassField
      height={48}
      focused={focused}
      accent={theme.accent}
      // iOS 26+: hap biçimli Liquid Glass. Diğer yerlerde eski kutu (zemin +
      // odakta vurgu çerçevesi).
      fallbackStyle={[
        styles.fieldBox,
        {
          backgroundColor: theme.secondary,
          borderColor: focused ? alpha(theme.accent, 0.7) : alpha(theme.border, 0.7),
        },
      ]}
      style={[styles.field, style]}
    >
      <Ionicons
        name="search"
        size={18}
        color={focused ? theme.accent : theme.text?.muted ?? "#888"}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text?.muted ?? "#888"}
        maxLength={80}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={theme.accent}
        keyboardAppearance={scheme}
        style={[styles.input, { color: theme.text?.primary ?? "#fff" }]}
      />
      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : value.length > 0 ? (
        <Pressable
          onPress={clear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.friends_ui_clear_search", "Aramayı temizle")}
        >
          <Ionicons name="close-circle" size={19} color={theme.text?.muted ?? "#888"} />
        </Pressable>
      ) : null}
    </GlassField>
  );
}

export default memo(FriendsSearchField);

const styles = StyleSheet.create({
  // Yerleşim: iki yolda da geçerli. Köşe/çerçeve cam yolunda UYGULANMAZ (cam
  // kendi şeklini çizer); eski kutu için fieldBox'ta.
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  fieldBox: { borderRadius: 16, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10 },
});
