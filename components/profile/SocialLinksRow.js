// components/profile/SocialLinksRow.js
//
// Profildeki sosyal hesap şeridi: her dolu hesap için marka ikonlu yuvarlak düğme.
// Hem kendi profilde (ProfileScreen) hem arkadaş profilinde (FriendProfileSections →
// FriendProfileScreen) kullanılır; veri `readProfileSocialLinks` ile temizlenmiş gelir.
//
// Dokununca platformun adresi açılır (utils/socialLinks.socialUrl — adres hep
// sabit alan adından kurulur). Önce sistem (kurulu uygulama/evrensel bağlantı),
// olmazsa uygulama içi tarayıcı.
//
// TEK SATIR: sekiz platform 40 pt'lik düğmeyle dar ekrana sığmaz; şeridin ölçülen genişliğine göre
// boşluk daralır, gerekirse düğmeler küçülür (utils/socialLinks.socialChipLayout). Sarılma yok.

import React, { memo, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import GlassPressable from "../common/GlassPressable";
import { alpha } from "../../theme/colors";
import {
  SOCIAL_PLATFORMS,
  brandColor,
  socialDisplayHandle,
  socialChipLayout,
  socialUrl,
} from "../../utils/socialLinks";
import { SOCIAL_NAMES, getSocialCopy } from "../../utils/socialLinksCopy";

async function openSocial(url) {
  try {
    await Linking.openURL(url);
  } catch {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // Açılamadı: sessizce vazgeç (cihazda tarayıcı yok / bağlantı engelli).
    }
  }
}

function SocialLinksRow({ links, theme, language, style }) {
  const copy = getSocialCopy(language);
  const onOpen = useCallback((url) => openSocial(url), []);
  // Çizilebilir (adresi kurulabilen) hesaplar: boyut hesabı çizilecek düğme sayısına göre.
  const items = SOCIAL_PLATFORMS.filter((p) => links?.[p.key] && socialUrl(p.key, links[p.key]));
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  }, []);
  if (!items.length) return null;
  // onLayout dış genişliği verir (iç boşluk dahil); düğmelerin kullanabileceği alan içeriktir.
  const flat = StyleSheet.flatten(style) || {};
  const padLeft = flat.paddingLeft ?? flat.paddingHorizontal ?? flat.padding ?? 0;
  const padRight = flat.paddingRight ?? flat.paddingHorizontal ?? flat.padding ?? 0;
  const { size, gap, icon } = socialChipLayout(width - padLeft - padRight, items.length);

  return (
    <View style={[styles.row, { gap }, style]} onLayout={onLayout}>
      {items.map((platform) => {
        const handle = links[platform.key];
        const url = socialUrl(platform.key, handle);
        if (!url) return null;
        const color = brandColor(platform, theme.text.primary);
        const name = SOCIAL_NAMES[platform.key];
        return (
          <GlassPressable
            key={platform.key}
            onPress={() => onOpen(url)}
            hitSlop={4}
            accessibilityRole="link"
            accessibilityLabel={`${copy.openLabel(name)} (${socialDisplayHandle(handle)})`}
            style={({ pressed }) => [
              styles.chip,
              {
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.33),
                backgroundColor: alpha(color, pressed ? 0.26 : 0.14),
                borderColor: alpha(color, 0.38),
              },
            ]}
          >
            <FontAwesome6 name={platform.icon} brand size={icon} color={color} />
          </GlassPressable>
        );
      })}
    </View>
  );
}

export default memo(SocialLinksRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
  },
  chip: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
