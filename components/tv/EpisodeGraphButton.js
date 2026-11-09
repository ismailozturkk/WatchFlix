// components/tv/EpisodeGraphButton.js
//
// Dizi detayında "Bölüm puanları grafiği" ekranına (TvGraphDetailScreen) götüren kart.
// 9 Kas kullanıcı isteği: eski kart (arka plan + sayılar + "Detaylı İstatistikler") ne
// açacağını anlatmıyordu; ilk denemedeki afişsiz düz kart da beğenilmedi. Şimdi:
//
//   ┌──────┬──────────────────────────────────┐
//   │      │ 5 SEZON · 62 BÖLÜM               │
//   │ afiş │ Bölüm puanları grafiği         › │
//   │      │ ▮▮▮▮▮ ▮▮▮▮▮ … (mini ızgara)      │
//   │S5★9.1│ Düşük ━━━━━ Yüksek   [Grafiği aç]│
//   └──────┴──────────────────────────────────┘
//
// Arkada dizinin arka plan görseli bulanık ve koyu bir örtüyle durur (eski kartın havası).
// Önizleme ızgarası grafik ekranının küçük hâli: sütun = sezon, hücre sayısı bölüm
// sayısıyla orantılı, renk = SEZON ortalaması (utils/ratingColors ölçeği).
//
// API İSTEĞİ YOK: veri yalnız dizi detayının zaten gelen `seasons[]` alanı. Bölüm bölüm
// puanlar yalnız grafik ekranı açılınca çekilir. Model utils/episodeGraphPreview.js'te.

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import GlassPressable from "../common/GlassPressable";
import PosterImage from "../PosterImage";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { intlLocaleOf } from "../../utils/appLanguages";
import { RATING_TIERS, getRatingColors } from "../../utils/ratingColors";
import { buildEpisodeGraphPreview } from "../../utils/episodeGraphPreview";
import { getEpisodeGraphButtonCopy } from "../../utils/episodeGraphButtonCopy";

const ROWS = 4;
const CELL_H = 6;
const CELL_GAP = 2;
const CELLS_H = ROWS * CELL_H + (ROWS - 1) * CELL_GAP;
const COLUMNS = 12;
const COLUMN_MAX_W = 26;
const POSTER_W = 76;
const POSTER_H = 114;
// Düşükten yükseğe renk ölçeği (RATING_TIERS yüksekten düşüğe sıralı).
const SCALE = [...RATING_TIERS].reverse().map((tier) => tier.bg);

// Kart koyu görsel zemin üstünde: metin rengi temadan bağımsız açık.
const INK = "#FFFFFF";
const INK_SOFT = "rgba(255,255,255,0.68)";
const INK_FAINT = "rgba(255,255,255,0.45)";

function EpisodeGraphButton({ seasons, onPress, posterPath, mediaId, backdropUri, style }) {
  const { language } = useLanguage();
  const copy = getEpisodeGraphButtonCopy(language);
  const preview = useMemo(
    () => buildEpisodeGraphPreview(seasons, { maxColumns: COLUMNS, maxRows: ROWS }),
    [seasons],
  );

  if (preview.seasonCount === 0) return null;

  const { columns, hiddenCount, seasonCount, episodeCount } = preview;
  // Tek sezonda "en iyi" anlamsız: rozet yalnız birden fazla sezonda.
  const best = seasonCount > 1 ? preview.best : null;
  const bestColors = best ? getRatingColors(best.rating) : null;
  const accent = best ? bestColors.bg : SCALE[SCALE.length - 2];
  const locale = intlLocaleOf(language);
  const fmt = (n) => Number(n).toLocaleString(locale);

  return (
    <GlassPressable
      // Arka plan görseli + renk ızgarası kartın kendisi: cam tonu bunları bozar.
      glass={false}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${copy.subtitle}. ${copy.summary(seasonCount, episodeCount)}`}
      accessibilityHint={copy.open}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: alpha(accent, 0.35) },
        pressed && styles.pressed,
        style,
      ]}
    >
      {backdropUri ? (
        <Image
          source={{ uri: backdropUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={14}
          transition={200}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(8,10,16,0.62)", "rgba(8,10,16,0.88)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* En iyi sezonun renginde hafif ışık: kartın tonu dizinin puanından gelir. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(accent, 0.28), alpha(accent, 0)]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.row}>
        {/* Afiş + en iyi sezon rozeti */}
        <View style={styles.posterWrap}>
          <PosterImage path={posterPath} type="tv" mediaId={mediaId} size={200} style={styles.poster} />
          {best ? (
            <View style={[styles.bestBadge, { backgroundColor: bestColors.bg }]}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.bestText, { color: bestColors.text }]}
              >
                {`${copy.seasonShort}${best.season} ★ ${best.rating.toFixed(1)}`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.eyebrow, { color: INK_SOFT }]}>
            {copy.summary(seasonCount, episodeCount, fmt)}
          </Text>
          <View style={styles.titleRow}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: INK }]}>
              {copy.title}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={INK_SOFT} />
          </View>

          {/* Mini ızgara: grafik ekranının küçük hâli */}
          <View pointerEvents="none" style={styles.grid}>
            {columns.map((column) => {
              const fill =
                column.rating != null ? getRatingColors(column.rating).bg : "rgba(255,255,255,0.14)";
              return (
                <View key={column.season} style={styles.column}>
                  <View style={styles.cells}>
                    {Array.from({ length: column.rows }).map((_, index) => (
                      <View
                        key={index}
                        style={[styles.cell, { backgroundColor: fill, opacity: 1 - index * 0.12 }]}
                      />
                    ))}
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.seasonLabel, { color: INK_FAINT }]}
                  >
                    {column.season}
                  </Text>
                </View>
              );
            })}
            {hiddenCount > 0 ? (
              <View style={styles.more}>
                <Text allowFontScaling={false} style={[styles.moreText, { color: INK_SOFT }]}>
                  {`+${hiddenCount}`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Ölçek + eylem */}
          <View style={styles.footer}>
            <View style={styles.legend}>
              <Text allowFontScaling={false} style={[styles.legendText, { color: INK_FAINT }]}>
                {copy.low}
              </Text>
              <LinearGradient colors={SCALE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scaleBar} />
              <Text allowFontScaling={false} style={[styles.legendText, { color: INK_FAINT }]}>
                {copy.high}
              </Text>
            </View>
            <View style={styles.cta}>
              <Ionicons name="grid" size={10} color={INK} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.ctaText, { color: INK }]}>
                {copy.open}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0F17",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  row: { flexDirection: "row", gap: 12 },

  posterWrap: { width: POSTER_W, height: POSTER_H },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 12 },
  bestBadge: {
    position: "absolute",
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: "center",
  },
  bestText: { fontSize: 10, lineHeight: 12, fontWeight: "900" },

  body: { flex: 1, minWidth: 0, justifyContent: "space-between", paddingVertical: 2 },
  eyebrow: { fontSize: 9.5, lineHeight: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  title: { flex: 1, fontSize: 15.5, lineHeight: 19, fontWeight: "800", letterSpacing: -0.3 },

  grid: { flexDirection: "row", alignItems: "flex-start", gap: 3, marginTop: 8 },
  column: { flex: 1, maxWidth: COLUMN_MAX_W, gap: 3 },
  cells: { gap: CELL_GAP, height: CELLS_H },
  cell: { height: CELL_H, borderRadius: 2 },
  seasonLabel: { fontSize: 8, lineHeight: 9, fontWeight: "800", textAlign: "center" },
  more: { height: CELLS_H, justifyContent: "center", paddingLeft: 2 },
  moreText: { fontSize: 10, fontWeight: "900" },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  legendText: { fontSize: 9, fontWeight: "800" },
  scaleBar: { width: 46, height: 5, borderRadius: 3 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  ctaText: { fontSize: 10.5, fontWeight: "800" },
});

export default memo(EpisodeGraphButton);
