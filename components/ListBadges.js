import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useListStatus } from "@hooks/useListStatus";

/**
 * Poster üzerinde içeriğin hangi listelerde olduğunu gösteren rozetler.
 *
 * Tüm ekranlarda kopyalanan rozet bloğunun tek kaynağıdır. Durum bilgisini
 * (`useListStatus`) kendi içinde okur; çağıran ekranın yalnızca id/tip vermesi
 * yeterli — ayrıca hook çağırıp 4 ayrı prop geçmesine gerek yoktur.
 *
 * Props:
 *  - mediaId, mediaType : useListStatus için ("movie" | "tv")
 *  - theme              : opsiyonel; verilmezse ThemeContext'ten alınır
 *  - variant            : "pill" (varsayılan, poster üstü dikey rozet) | "chip" (arama ekranları, tint'li yuvarlak çip)
 *  - vertical           : chip varyantında dikey (true) / yatay (false) dizilim
 *  - iconSize           : ikon boyutu (pill varsayılan 12, chip varsayılan vertical?10:9)
 *  - watchedIcon        : "izlendi" ikonu (bazı ekranlar "eye-off" kullanır, varsayılan "eye")
 *  - style              : konumlandırma / görünüm override'ı (pill'de bg, padding, radius vs. ezilebilir)
 */

// theme.colors yoksa kullanılacak güvenli varsayılan renkler
const FALLBACK = { blue: "#64b4ff", green: "#29b864", red: "#e33", orange: "#ff6400" };

const ListBadges = memo(function ListBadges({
  mediaId,
  mediaType,
  theme: themeProp,
  variant = "pill",
  vertical = true,
  iconSize,
  watchedIcon = "eye",
  style,
}) {
  const ctx = useTheme();
  const theme = themeProp ?? ctx?.theme;

  const { inWatchList, isWatched, inFavorites, isInOtherLists } = useListStatus(
    mediaId,
    mediaType,
  );

  if (!inWatchList && !isWatched && !inFavorites && !isInOtherLists) return null;

  const c = theme?.colors ?? {};
  const items = [
    inWatchList && { key: "watchlist", icon: "bookmark", color: c.blue ?? FALLBACK.blue },
    isWatched && { key: "watched", icon: watchedIcon, color: c.green ?? FALLBACK.green },
    inFavorites && { key: "favorite", icon: "heart", color: c.red ?? FALLBACK.red },
    isInOtherLists && { key: "other", icon: "grid", color: c.orange ?? FALLBACK.orange },
  ].filter(Boolean);

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
  const size = iconSize ?? 12;
  return (
    <View style={[styles.pill, { backgroundColor: theme?.secondaryt }, style]}>
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
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 1,
    borderRadius: 7,
    alignItems: "center",
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
