// components/profile/SocialLinksEditRow.js
//
// Profil düzenleme modundaki sosyal hesap şeridi. Görünüş profildeki şeridin
// (SocialLinksRow) AYNISI — tek satır, marka renkli yuvarlak düğmeler — tek fark:
//   • sekiz platformun HEPSİ çizilir; bağlı olmayanlar renksiz ve soluk,
//   • bir düğmeye dokununca altında o platformun alanı açılır (kayıtlı değerle
//     dolu); yeniden dokununca kapanır.
// Taslak burada tutulmaz: `draft` { platform: "yazılan" } çağırandan gelir,
// Kaydet'te resolveSocialDraft ile kullanıcı adına çevrilip doğrulanır.

import React, { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import {
  SOCIAL_HANDLE_MAX,
  SOCIAL_PLATFORMS,
  brandColor,
  formatSocialInput,
  socialChipLayout,
} from "../../utils/socialLinks";
import { SOCIAL_NAMES, getSocialCopy } from "../../utils/socialLinksCopy";
import { i18nText } from "../../utils/i18nText";

const ERROR = "#e5484d";

function SocialLinksEditRow({ draft, invalid, onChange, theme, language, style }) {
  const copy = getSocialCopy(language);
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  }, []);

  const flat = StyleSheet.flatten(style) || {};
  const padLeft = flat.paddingLeft ?? flat.paddingHorizontal ?? flat.padding ?? 0;
  const padRight = flat.paddingRight ?? flat.paddingHorizontal ?? flat.padding ?? 0;
  const { size, gap, icon } = socialChipLayout(width - padLeft - padRight, SOCIAL_PLATFORMS.length);

  const activePlatform = SOCIAL_PLATFORMS.find((p) => p.key === active) || null;
  const activeValue = activePlatform ? draft?.[activePlatform.key] || "" : "";
  const activeInvalid = !!activePlatform && invalid?.includes(activePlatform.key);
  const activeColor = activePlatform ? brandColor(activePlatform, theme.text.primary) : theme.accent;

  return (
    <View style={styles.root}>
      <View style={[styles.row, { gap }, style]} onLayout={onLayout}>
        {SOCIAL_PLATFORMS.map((platform) => {
          const connected = !!String(draft?.[platform.key] || "").trim();
          const isActive = active === platform.key;
          const bad = invalid?.includes(platform.key);
          const brand = brandColor(platform, theme.text.primary);
          // Bağlı olmayan platform renksiz + soluk; seçiliyken marka rengine döner.
          const color = connected || isActive ? brand : theme.text.muted;
          const name = SOCIAL_NAMES[platform.key];
          return (
            <Pressable
              key={platform.key}
              testID={`social-edit-${platform.key}`}
              onPress={() => setActive((prev) => (prev === platform.key ? null : platform.key))}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={name}
              style={({ pressed }) => [
                styles.chip,
                {
                  width: size,
                  height: size,
                  borderRadius: Math.round(size * 0.33),
                  opacity: connected || isActive ? 1 : pressed ? 0.6 : 0.42,
                  backgroundColor: alpha(color, pressed ? 0.26 : connected || isActive ? 0.14 : 0.08),
                  borderColor: bad ? ERROR : isActive ? brand : alpha(color, connected ? 0.38 : 0.28),
                  borderWidth: isActive || bad ? 2 : 1,
                },
              ]}
            >
              <FontAwesome6 name={platform.icon} brand size={icon} color={color} />
            </Pressable>
          );
        })}
      </View>

      {activePlatform ? (
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.secondary,
              borderColor: activeInvalid ? ERROR : alpha(activeColor, 0.45),
            },
          ]}
        >
          <FontAwesome6 name={activePlatform.icon} brand size={15} color={activeColor} />
          <TextInput
            testID="social-edit-input"
            key={activePlatform.key}
            autoFocus
            value={activeValue}
            onChangeText={(v) => onChange(activePlatform.key, formatSocialInput(v))}
            placeholder={`${SOCIAL_NAMES[activePlatform.key]} · ${copy.placeholder}`}
            placeholderTextColor={alpha(theme.text.muted, 0.8)}
            accessibilityLabel={SOCIAL_NAMES[activePlatform.key]}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => setActive(null)}
            maxLength={Math.max(SOCIAL_HANDLE_MAX, 120)}
            allowFontScaling={false}
            style={[styles.input, { color: theme.text.primary }]}
          />
          {activeValue ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.temizle", "Temizle")}
              onPress={() => onChange(activePlatform.key, "")}
            >
              <Ionicons name="close-circle" size={18} color={theme.text.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default memo(SocialLinksEditRow);

const styles = StyleSheet.create({
  root: { alignSelf: "stretch", alignItems: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  chip: {
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginTop: 10,
    alignSelf: "stretch",
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: { flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: "600", paddingVertical: 10 },
});
