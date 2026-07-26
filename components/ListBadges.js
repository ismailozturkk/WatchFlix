import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useListLayoutSettings } from "../context/AppSettingsContext";
import { useSharedLists } from "../context/SharedListsContext";
import { useListStatus } from "@hooks/useListStatus";
import { useMediaActivity } from "@hooks/useMediaActivity";

/**
 * Poster üzerinde içeriğin hangi listelerde olduğunu VE kullanıcının o içerikle
 * ne yaptığını (puanladı / yorum yaptı) gösteren rozetler.
 *
 * Tüm ekranlarda kopyalanan rozet bloğunun tek kaynağıdır. Durum bilgisini
 * (`useListStatus` + `useMediaActivity`) kendi içinde okur; çağıran ekranın
 * yalnızca id/tip vermesi yeterli — ayrıca hook çağırıp prop geçmesine gerek yoktur.
 *
 * Props:
 *  - mediaId, mediaType : useListStatus için ("movie" | "tv")
 *  - theme              : opsiyonel; verilmezse ThemeContext'ten alınır
 *  - variant            : "pill" (varsayılan, poster üstü dikey rozet) | "chip" (arama ekranları, tint'li yuvarlak çip)
 *  - vertical           : chip varyantında dikey (true) / yatay (false) dizilim
 *  - iconSize           : ikon boyutu (pill varsayılan 11, chip varsayılan vertical?10:9)
 *  - watchedIcon        : "izlendi" ikonu (bazı ekranlar "eye-off" kullanır, varsayılan "eye")
 *  - style              : konumlandırma / görünüm override'ı
 *  - scale              : ölçek katsayısı (varsayılan: poster ayarından türetilir)
 *  - posterWidth        : poster genişliği (verilirse rozetler poster boyutuna tam orantılanır)
 */

// theme.colors yoksa kullanılacak güvenli varsayılan renkler
const FALLBACK = {
  blue: "#64b4ff",
  green: "#29b864",
  red: "#e33",
  orange: "#ff6400",
  cyan: "#38bdf8",
  yellow: "#FFEB3B",
  purple: "#c060e0",
};

const ListBadges = memo(function ListBadges({
  mediaId,
  mediaType,
  theme: themeProp,
  variant = "pill",
  vertical = true,
  iconSize,
  watchedIcon = "eye",
  style,
  scale: scaleProp,
  posterWidth,
}) {
  const ctx = useTheme();
  const theme = themeProp ?? ctx?.theme;

  // Ayarlar > Poster görünümü: rozet görünürlüğü + poster boyutu / sütun sayısı.
  const { posterBadges, railPosterSize, listsGridColumns } = useListLayoutSettings();

  // Poster boyutuna göre taban ölçek hesabı (110px standart 3'lü poster kabul edilir)
  let baseScale = scaleProp != null ? scaleProp : 1;
  if (scaleProp == null) {
    if (posterWidth != null) {
      baseScale = Math.min(1.1, Math.max(0.6, posterWidth / 110));
    } else {
      if (railPosterSize === "small") baseScale *= 0.82;
      if (listsGridColumns === 4) baseScale *= 0.82;
    }
  }

  const { inWatchList, isWatched, inFavorites, isInOtherLists } = useListStatus(
    mediaId,
    mediaType,
  );
  const { sharedListIndex } = useSharedLists() ?? {};
  const { hasRating, hasComment } = useMediaActivity(mediaId, mediaType);
  const sharedBucket = mediaType === "tv" ? sharedListIndex?.tv : sharedListIndex?.movie;
  const isInSharedLists = mediaId != null && !!sharedBucket?.[String(mediaId)];

  const c = theme?.colors ?? {};
  const isBadgeEnabled = (key) => posterBadges?.[key] !== false;
  const items = [
    inWatchList && isBadgeEnabled("watchlist") && { key: "watchlist", icon: "bookmark", color: c.blue ?? FALLBACK.blue },
    isWatched && isBadgeEnabled("watched") && { key: "watched", icon: watchedIcon, color: c.green ?? FALLBACK.green },
    inFavorites && isBadgeEnabled("favorite") && { key: "favorite", icon: "heart", color: c.red ?? FALLBACK.red },
    isInOtherLists && isBadgeEnabled("other") && { key: "other", icon: "grid", color: c.orange ?? FALLBACK.orange },
    isInSharedLists && isBadgeEnabled("shared") && { key: "shared", icon: "people", color: c.cyan ?? FALLBACK.cyan },
    hasRating && isBadgeEnabled("rated") && { key: "rated", icon: "star", color: c.yellow ?? FALLBACK.yellow },
    hasComment && isBadgeEnabled("commented") && { key: "commented", icon: "chatbubble", color: c.purple ?? FALLBACK.purple },
  ].filter(Boolean);

  if (items.length === 0) return null;

  // ── Arama ekranları: tint'li yuvarlak çipler ──
  if (variant === "chip") {
    const size = iconSize ?? (vertical ? 10 : 9);
    return (
      <View style={[vertical ? styles.chipColumn : styles.chipRow, style]}>
        {items.map(({ key, icon, color }) => (
          <View key={key} style={[styles.chip, { backgroundColor: color + "33" }]}>
            <Ionicons name={icon} size={size} color={color} />
          </View>
        ))}
      </View>
    );
  }

  // ── Varsayılan: poster üstü dikey pill ──
  // İkon ve pill dolgusu poster boyutu + aktif rozet sayısıyla birlikte oranlanır.
  // Çok sayıda rozet (4+) olduğunda rozetlerin posterden taşmasını önlemek için yoğunluk ölçeği uygulanır.
  const densityScale = items.length >= 6 ? 0.72 : items.length >= 5 ? 0.78 : items.length >= 4 ? 0.85 : 1.0;
  const effectiveScale = baseScale * densityScale;
  const size = Math.max(7, Math.round((iconSize ?? 11) * effectiveScale));
  const gap = Math.max(1, Math.round(2 * effectiveScale));
  const paddingVertical = Math.max(1.5, Math.round(2.5 * effectiveScale));
  const paddingHorizontal = Math.max(1, Math.round(1.5 * effectiveScale));
  const radius = Math.max(4, Math.round(6 * effectiveScale));

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme?.secondaryt ?? "rgba(0,0,0,0.62)" },
        { gap, paddingVertical, paddingHorizontal, borderRadius: radius, maxHeight: "90%" },
        style,
      ]}
    >
      {items.map(({ key, icon, color }) => (
        <Ionicons key={key} name={icon} size={size} color={color} />
      ))}
    </View>
  );
});

export default ListBadges;

const styles = StyleSheet.create({
  // pill (section / detay / profil arama kartları)
  pill: {
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // chip — dikey kolon (arama satır kartı)
  chipColumn: {
    position: "absolute",
    right: 7,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    gap: 3,
  },
  // chip — yatay satır (arama grid kartı)
  chipRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 5,
  },
  chip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
});
