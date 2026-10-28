// components/common/UserAvatar.js
//
// Uygulama genelindeki TEK kullanıcı-avatarı render bileşeni. Yorumlar,
// paylaşımlar, arkadaşlar, arama, mesajlaşma, gruplar, istekler, ortak
// listeler, arkadaş profili ve kendi profilim — hepsi buradan geçer.
//
// Görselin NEREDEN geleceği zaten tek bir yerde çözülüyor (utils/avatars.js
// → getAvatarSource) ve profil değiştiğinde denormalize kopyalar zaten tek
// bir zincirden güncelleniyor (services/profilePropagation.js +
// functions/index.js:onUserProfileUpdated). Burada eksik olan NASIL
// çizileceğiydi: boyut/oran/border/cover-contain/overlay mantığı 23 dosyada
// ayrı ayrı tekrarlanıyordu. Artık hepsi burada yaşıyor.

import React, { memo, useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { getAvatarSource, CUSTOM_AVATAR_INDEX, DEFAULT_AVATAR_INDEX, AVATARS } from "@utils/avatars";
import useFreshPhotoSource from "../../hooks/useFreshPhotoSource";
import Skeleton from "../Skeleton";

const BADGE_POSITIONS = {
  "bottom-right": { bottom: 0, right: 0 },
  "bottom-left": { bottom: 0, left: 0 },
  "top-right": { top: 0, right: 0 },
  "top-left": { top: 0, left: 0 },
};

const UserAvatar = memo(function UserAvatar({
  // Veri kaynağı — ikisinden biri verilir.
  avatarIndex,
  photoURL = null,
  source = null,
  isCustomPhoto = null,

  size = 40,
  shape = "circle",
  iconRatio = 0.7,

  borderWidth = 0,
  borderColor = "transparent",
  fallbackSource = AVATARS[DEFAULT_AVATAR_INDEX],

  online = false,
  onlineColor = "#22c55e",
  onlineBorderColor = "#fff",
  badge = null,
  badgePosition = "bottom-right",

  onPress = null,
  onLongPress = null,
  delayLongPress,

  loading = false,
  style,
  imageStyle,
  testID,
  priority = "high",
  cachePolicy = "memory-disk",
}) {
  // Uzak fotoğraf yüklenemezse (sağlayıcı adresi süresi dolmuş/silinmiş —
  // anlık kopyalardaki eski Google adresleri gibi) boş daire yerine yedek
  // avatar. Hangi adresin düştüğü tutulur: kaynak değişince yeniden denenir.
  const [failedUri, setFailedUri] = useState(null);
  // Google fotoğrafı adresi değişmeden yenilenir; önbellekteki eski kopya
  // arka planda denetlenir (bkz. utils/photoRevalidation.js).
  const candidate = useFreshPhotoSource(
    source ?? getAvatarSource(avatarIndex, photoURL) ?? fallbackSource,
  );
  const candidateUri = typeof candidate === "object" ? candidate?.uri || null : null;
  const handleError = useCallback(() => {
    if (candidateUri) setFailedUri(candidateUri);
  }, [candidateUri]);

  if (loading) {
    const radius = shape === "circle" ? size / 2 : Math.round(size * 0.33);
    return <Skeleton width={size} height={size} style={[{ borderRadius: radius }, style]} />;
  }

  const resolvedSource =
    candidateUri && candidateUri === failedUri ? fallbackSource : candidate;
  const cover =
    isCustomPhoto !== null ? isCustomPhoto : source ? true : avatarIndex === CUSTOM_AVATAR_INDEX;

  const radius = shape === "circle" ? size / 2 : Math.round(size * 0.33);
  const iconSize = Math.round(size * iconRatio);

  const content = (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth,
          borderColor,
        },
        style,
      ]}
    >
      <Image
        source={resolvedSource}
        style={[
          cover ? { width: "100%", height: "100%" } : { width: iconSize, height: iconSize },
          imageStyle,
        ]}
        contentFit={cover ? "cover" : "contain"}
        priority={priority}
        cachePolicy={cachePolicy}
        onError={candidateUri ? handleError : undefined}
      />
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: Math.max(8, Math.round(size * 0.24)),
              height: Math.max(8, Math.round(size * 0.24)),
              borderRadius: Math.max(4, Math.round(size * 0.12)),
              backgroundColor: onlineColor,
              borderColor: onlineBorderColor,
            },
          ]}
        />
      ) : null}
      {badge ? <View style={[styles.badge, BADGE_POSITIONS[badgePosition]]}>{badge}</View> : null}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        activeOpacity={0.75}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
});

export default UserAvatar;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badge: {
    position: "absolute",
  },
});
