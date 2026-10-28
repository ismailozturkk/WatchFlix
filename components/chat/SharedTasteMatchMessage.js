// components/chat/SharedTasteMatchMessage.js
//
// Sohbette paylaşılan ZEVK UYUMU balonunun gövdesi (mesaj kind: "tasteMatchShare", bkz.
// utils/chatShare.js): büyük yüzde, kademe, iki tarafın adı, ortak izlenen / tür / puan
// satırları, birlikte sevilenler ve ortak izlenen afişleri.
//
// Metinler arkadaş profilindeki kartla AYNI tablodan (utils/tasteMatchCopy) ve ALICININ
// diliyle çizilir; gönderenin dili yalnız gelen kutusu önizlemesinde (`text`) kalır.
// Dokunulabilir bir eylem yok: bu bir sonuç kartı (davet ya da hedef ekran değil).

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { getTasteMatchCopy } from "../../utils/tasteMatchCopy";
import { TASTE_HEAT_THRESHOLDS, tasteMatchHeat } from "../../utils/tasteMatchVisuals";
import { sharePalette } from "./shareKit";
import { PosterFace } from "./PosterStrip";

// Düşük uyumda kalp/uyum rengi; 60+ puanlarda tasteMatchHeat giderek ısınır.
const ROSE = "#E11D48";
const POSTER_W = 50;
const POSTER_H = 75;

function Line({ icon, text, palette }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={13} color={palette.tileInk} />
      <Text style={[styles.lineText, { color: palette.secondary }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function SharedTasteMatchMessage({ share, isOutgoing = false, getTmdbUrl }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getTasteMatchCopy(language);
  const heat = tasteMatchHeat(share.score, ROSE);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: heat.accent }), [theme, isOutgoing, heat.accent]);

  const names = share.host && share.friend ? `${share.host} & ${share.friend}` : share.host || share.friend || "";
  const trackColor = isOutgoing ? "rgba(255,255,255,0.22)" : alpha(heat.accent, 0.18);
  const items = share.items || [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <LinearGradient colors={heat.colors} style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="heart" size={17} color={palette.tileInk} />
        </LinearGradient>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={[styles.kicker, { color: palette.tileInk }]} numberOfLines={1}>
            {copy.title.toUpperCase()}
          </Text>
          {names ? (
            <Text style={[styles.names, { color: palette.secondary }]} numberOfLines={1}>
              {names}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        style={[styles.scoreHero, heat.level > 0 && { backgroundColor: alpha(heat.accent, isOutgoing ? 0.2 : 0.1), borderColor: alpha(heat.accent, 0.3) }]}
        accessible
        accessibilityLabel={`${copy.title}: ${copy.percent(share.score)}`}
      >
        <View style={styles.scoreRow}>
          <Text allowFontScaling={false} style={[styles.score, { color: heat.level > 0 ? heat.accent : palette.primary }]}>
            {copy.percent(share.score)}
          </Text>
          <Text style={[styles.tier, { color: palette.primary }]} numberOfLines={2}>
            {copy.tiers[share.tier]}
          </Text>
          {heat.level > 0 ? (
            <View accessibilityLabel={`heat-${heat.level}`} style={styles.flames}>
              {Array.from({ length: heat.level }, (_, index) => (
                <Ionicons key={index} name={index === heat.level - 1 ? "flame" : "flame-outline"} size={12} color={heat.accent} />
              ))}
            </View>
          ) : null}
        </View>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <LinearGradient
            colors={heat.colors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { width: `${Math.max(3, heat.score)}%` }]}
          />
          {TASTE_HEAT_THRESHOLDS.map((threshold) => (
            <View
              key={threshold}
              pointerEvents="none"
              style={[styles.heatMark, { left: `${threshold}%`, backgroundColor: alpha("#FFFFFF", share.score >= threshold ? 0.9 : 0.35) }]}
            />
          ))}
        </View>
      </View>

      {typeof share.movie === "number" || typeof share.tv === "number" ? (
        <View style={styles.types}>
          {typeof share.movie === "number" ? (
            <View style={[styles.typeChip, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
              <Ionicons name="film-outline" size={13} color={palette.tileInk} />
              <Text allowFontScaling={false} style={[styles.typeText, { color: palette.primary }]}>
                {`${copy.types.movie} ${copy.percent(share.movie)}`}
              </Text>
            </View>
          ) : null}
          {typeof share.tv === "number" ? (
            <View style={[styles.typeChip, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
              <Ionicons name="tv-outline" size={13} color={palette.tileInk} />
              <Text allowFontScaling={false} style={[styles.typeText, { color: palette.primary }]}>
                {`${copy.types.tv} ${copy.percent(share.tv)}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
        {typeof share.overlap === "number" ? (
          <Line icon="checkmark-done-outline" palette={palette} text={copy.rows.overlap(share.overlap)} />
        ) : null}
        {share.favorites > 0 ? <Line icon="heart-outline" palette={palette} text={copy.rows.favorites(share.favorites)} /> : null}
        {share.genres?.length ? (
          <Line icon="pricetags-outline" palette={palette} text={copy.rows.genres(share.genres.join(", "))} />
        ) : null}
        {typeof share.agreement === "number" ? (
          <Line icon="star-half-outline" palette={palette} text={copy.rows.ratings(share.agreement, share.pairs)} />
        ) : null}
        {share.loved?.length ? (
          <Line icon="sparkles-outline" palette={palette} text={copy.insights.loved(share.loved.join(", "))} />
        ) : null}
      </View>

      {items.length > 0 ? (
        <View style={styles.posters}>
          {items.map((item) => (
            <PosterFace
              key={`${item.media_type}_${item.id}`}
              item={item}
              width={POSTER_W}
              height={POSTER_H}
              getTmdbUrl={getTmdbUrl}
              palette={palette}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default memo(SharedTasteMatchMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 240, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  names: { fontSize: 13, fontWeight: "800", marginTop: 1 },

  scoreHero: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 9, paddingVertical: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  score: { fontSize: 34, fontWeight: "900", lineHeight: 40 },
  tier: { flex: 1, fontSize: 13.5, fontWeight: "800", lineHeight: 18 },
  flames: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 1 },
  track: { height: 7, borderRadius: 999, overflow: "hidden", marginTop: 5, position: "relative" },
  fill: { height: "100%", borderRadius: 3 },
  heatMark: { position: "absolute", top: 1, bottom: 1, width: 1, marginLeft: -0.5 },

  types: { flexDirection: "row", gap: 6, marginTop: 10 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  typeText: { fontSize: 12, fontWeight: "800" },

  box: { gap: 7, padding: 10, marginTop: 12, borderRadius: 14, borderWidth: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 7 },
  lineText: { flexShrink: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },

  posters: { flexDirection: "row", gap: 6, marginTop: 10 },
});
