// components/challenges/ChallengeParts.js
//
// Meydan Okumalar'ın küçük yapı taşları (Eğlence kartı, ekran, ayrıntı sayfası ve profil satırı ortak kullanır):
//   • ChallengeMedal — görevin iki renkli gradyan madalyası; yönetmen görevinde kişinin fotoğrafı. `dim`: henüz
//                      kazanılmamış (soluk).
//   • ChallengeBar   — ince ilerleme çubuğu (oran 0–1).
//   • ChallengePoster — 2:3 afiş kutusu (özel afiş çözücüsünden, hooks/usePosterUri); `watched=false` soluk,
//                       `check` köşede onay işareti.

import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import usePosterUri from "@hooks/usePosterUri";
import usePosterCorner from "@hooks/usePosterCorner";

export function ChallengeMedal({ challenge, size = 44, dim = false, style }) {
  const { getTmdbUrl } = useImageQualitySettings();
  const photo = challenge?.person?.profilePath;
  const ring = Math.max(2, Math.round(size / 18));
  return (
    <View style={[{ width: size, height: size, opacity: dim ? 0.45 : 1 }, style]}>
      <LinearGradient
        colors={challenge?.colors || ["#6366F1", "#312E81"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.medal, { width: size, height: size, borderRadius: size / 2, padding: ring }]}
      >
        {photo ? (
          <Image
            source={{ uri: getTmdbUrl(photo, "profile", 185) }}
            style={{ width: size - ring * 2, height: size - ring * 2, borderRadius: size / 2 }}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <AppIcon family="Ionicons" name={challenge?.icon || "flag-outline"} size={Math.round(size * 0.46)} color="#FFFFFF" />
        )}
      </LinearGradient>
    </View>
  );
}

export function ChallengeBar({ ratio = 0, color = "#6366F1", track = "rgba(127,127,127,0.18)", height = 6, style }) {
  const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }, style]}>
      <View style={[styles.fill, { width, borderRadius: height / 2, backgroundColor: color }]} />
    </View>
  );
}

export function ChallengePoster({
  type = "movie",
  id,
  path,
  width,
  watched = true,
  check = watched,
  color = "#22C55E",
  placeholder = "rgba(127,127,127,0.2)",
}) {
  // Özel afiş seçimi (PosterChoices) burada da geçerli.
  const uri = usePosterUri()(type, id, path, 200);
  const corner = usePosterCorner("fun");
  return (
    <View style={[styles.poster, { width, height: width * 1.5, borderRadius: corner(8), backgroundColor: placeholder }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, !watched && styles.unwatched]}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <AppIcon family="Ionicons" name="film-outline" size={18} color="rgba(127,127,127,0.7)" />
      )}
      {check ? (
        <View style={[styles.check, { backgroundColor: color }]}>
          <AppIcon family="Ionicons" name="checkmark" size={11} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { alignItems: "center", justifyContent: "center" },
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%" },
  poster: { borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  unwatched: { opacity: 0.28 },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
