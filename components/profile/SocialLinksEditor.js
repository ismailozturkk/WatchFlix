// components/profile/SocialLinksEditor.js
//
// Profili Düzenle → "Sosyal hesapların": platform başına marka ikonlu bir satır.
// Taslak burada tutulmaz — `draft` { platformAnahtarı: "yazılan" } ekrandan gelir,
// Kaydet'te `resolveSocialDraft` ile kullanıcı adına çevrilip doğrulanır.
// Adres yapıştırmak serbest ("instagram.com/ad" → "ad").

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { AuthField } from "../auth/AuthKit";
import { alpha } from "../../theme/colors";
import {
  SOCIAL_HANDLE_MAX,
  SOCIAL_PLATFORMS,
  brandColor,
  formatSocialInput,
} from "../../utils/socialLinks";
import { SOCIAL_NAMES, getSocialCopy } from "../../utils/socialLinksCopy";

function SocialLinksEditor({ draft, onChange, invalid, theme, accent, fieldSurface, language }) {
  const copy = getSocialCopy(language);
  return (
    <View style={styles.list}>
      {SOCIAL_PLATFORMS.map((platform) => {
        const color = brandColor(platform, theme.text.primary);
        return (
          <View key={platform.key} style={styles.row}>
            <View style={[styles.tile, { backgroundColor: alpha(color, 0.14) }]}>
              <FontAwesome6 name={platform.icon} brand size={18} color={color} />
            </View>
            <AuthField
              theme={theme}
              accent={accent}
              fieldSurface={fieldSurface}
              state={invalid?.includes(platform.key) ? false : null}
              value={draft?.[platform.key] || ""}
              onChangeText={(v) => onChange(platform.key, formatSocialInput(v))}
              placeholder={`${SOCIAL_NAMES[platform.key]} · ${copy.placeholder}`}
              accessibilityLabel={SOCIAL_NAMES[platform.key]}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="url"
              returnKeyType="done"
              maxLength={Math.max(SOCIAL_HANDLE_MAX, 120)}
              containerStyle={styles.field}
            />
          </View>
        );
      })}
    </View>
  );
}

export default memo(SocialLinksEditor);

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { flex: 1, minWidth: 0 },
});
