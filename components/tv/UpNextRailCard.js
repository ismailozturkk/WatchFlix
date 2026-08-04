// components/tv/UpNextRailCard.js
//
// TV ana ekranındaki "Devam Eden Dizilerim" rayının kartı. Poster ölçüsü ve
// rozet düzeni diğer raylarla aynıdır; farkı SIRADAKİ BÖLÜM katmanıdır:
// bölüm adı ve "İzledim" düğmesi POSTERİN ÜZERİNDE, alt kısmındaki gradient
// karartmanın içinde durur. Böylece kart rayın standart yüksekliğini korur —
// poster altına şerit eklenseydi bu bölüm diğer raylardan uzun görünürdü.
//
// Düğmeler posterin dokunma alanının İÇİNDE olduğundan basış olayı ayrıca
// durduruluyor (bkz. stopPropagation): düğmeye dokunmak diziyi açmasın.
//
// Üç uç durum bilinçlidir:
//   • item === undefined → henüz çözülmedi (iskelet)
//   • item === null      → çözüldü, sıradaki bölüm yok (yeni sezon bekleniyor)
//   • item.isAired false → bölüm var ama yayınlanmadı (işaretlenemez)

import React, { memo } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Progress from "react-native-progress";

import PosterImage from "../PosterImage";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { getWatchedShowProgress } from "../../utils/watchState";

const formatAirDate = (value, language) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
};

function UpNextRailCard({
  show,
  item,
  resolved,
  poster,
  theme,
  language,
  scaleValue,
  onPressIn,
  onPressOut,
  onOpen,
  onWatched,
  onChooseDate,
}) {
  const { watched, total, progress } = getWatchedShowProgress(show);
  const progressColor = progress > 0 ? "#FF9500" : theme.accent;
  const upcomingColor = theme.colors?.orange || "#FF9500";

  // Basış işleyicisi olmayan Text dokunmayı yakalamaz; bölüm adına dokunmak
  // posterin kendisine (dizi detayına) gider.
  const caption = (text, muted) => (
    <Text numberOfLines={1} style={[styles.caption, muted && styles.captionMuted]}>
      {text}
    </Text>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPressIn={() => onPressIn(show.id)}
      onPressOut={() => onPressOut(show.id)}
      onPress={() => onOpen(show)}
      style={[
        styles.cell,
        { width: poster.posterWidth, height: poster.posterHeight },
      ]}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleValue }],
          // Alta yapışık ilerleme çubuğu ve bölüm katmanı poster köşesinden
          // taşmasın diye köşe yarıçapıyla kırpılır.
          overflow: "hidden",
          borderRadius: poster.radius,
        }}
      >
        <PosterImage
          path={item?.showPosterPath || show.imagePath}
          type="tv"
          size={200}
          style={[
            styles.poster,
            {
              width: poster.posterWidth,
              height: poster.posterHeight,
              borderRadius: poster.radius,
              shadowColor: theme.shadow,
            },
          ]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`tvongoing-${show.id}`}
          transition={120}
        />

        {/* Karartma, altındaki bölüm katmanını okunur tutacak kadar yüksek. */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
          locations={[0, 0.45, 1]}
          style={[
            styles.gradient,
            {
              height: poster.posterHeight * 0.62,
              borderBottomLeftRadius: poster.radius,
              borderBottomRightRadius: poster.radius,
            },
          ]}
        />

        {/* İlerleme çubuğu — poster altına yapışık, tam genişlik */}
        <View style={styles.progressBar}>
          <Progress.Bar
            progress={progress}
            width={poster.posterWidth}
            height={3}
            borderWidth={0}
            borderRadius={2}
            color={progressColor}
            unfilledColor="rgba(255,255,255,0.2)"
          />
        </View>

        {/* İzlenen/toplam bölüm — sağ üst */}
        <View
          style={[styles.countBadge, { backgroundColor: theme.secondaryt }]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.badgeText, { color: progressColor }]}
          >
            {total > 0 ? `${watched}/${total}` : watched}
          </Text>
        </View>

        {/* Sıradaki bölüm numarası — sol üst */}
        {item ? (
          <View
            style={[
              styles.episodePill,
              {
                backgroundColor: item.isAired
                  ? alpha(theme.accent, 0.92)
                  : alpha(upcomingColor, 0.92),
              },
            ]}
          >
            <Text allowFontScaling={false} style={styles.episodePillText}>
              S{item.seasonNumber}·B{item.episodeNumber}
            </Text>
          </View>
        ) : null}

        {/* ── Sıradaki bölüm katmanı: posterin alt kısmında ── */}
        <View style={styles.overlay}>
          {!resolved ? (
            <>
              <View style={[styles.skeletonLine, { width: "72%" }]} />
              <View style={styles.skeletonAction} />
            </>
          ) : !item ? (
            <>
              {caption(
                i18nText("autoI18n.up_next_ray_bekleniyor", "Yeni bölüm yok"),
                true
              )}
              <View style={styles.waitingChip}>
                <Ionicons name="hourglass-outline" size={11} color="#fff" />
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={styles.waitingText}
                >
                  {i18nText(
                    "autoI18n.up_next_ray_yeni_sezon",
                    "Sezon bekleniyor"
                  )}
                </Text>
              </View>
            </>
          ) : !item.isAired ? (
            <>
              {caption(
                item.episodeName ||
                  i18nText("autoI18n.up_next_ray_bolum", "Sıradaki bölüm")
              )}
              <View
                style={[
                  styles.waitingChip,
                  { backgroundColor: alpha(upcomingColor, 0.85) },
                ]}
              >
                <Ionicons name="time-outline" size={11} color="#fff" />
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={styles.waitingText}
                >
                  {formatAirDate(item.airDate, language) ||
                    i18nText("autoI18n.up_next_ray_yakinda", "Yakında")}
                </Text>
              </View>
            </>
          ) : (
            <>
              {caption(
                item.episodeName ||
                  i18nText("autoI18n.up_next_ray_bolum", "Sıradaki bölüm")
              )}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i18nText(
                    "autoI18n.up_next_ray_izledim",
                    "İzledim"
                  )}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onWatched(item);
                  }}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    {
                      backgroundColor: pressed
                        ? alpha(theme.accent, 0.72)
                        : theme.accent,
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={styles.primaryActionText}
                  >
                    {i18nText("autoI18n.up_next_ray_izledim", "İzledim")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i18nText(
                    "autoI18n.up_next_ray_tarih_sec",
                    "Tarih seç"
                  )}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onChooseDate(item);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    {
                      backgroundColor: pressed
                        ? "rgba(255,255,255,0.34)"
                        : "rgba(255,255,255,0.18)",
                    },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={13} color="#fff" />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: { marginRight: 10, marginBottom: 5 },
  poster: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  countBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  episodePill: {
    position: "absolute",
    top: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  episodePillText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // ── Poster üzerindeki sıradaki bölüm katmanı ──
  // İlerleme çubuğu 3px olduğu için taban 8'den başlar.
  overlay: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 8,
    gap: 5,
  },
  caption: {
    color: "#fff",
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionMuted: { color: "rgba(255,255,255,0.72)", fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  primaryAction: {
    flex: 1,
    minHeight: 28,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 5,
  },
  primaryActionText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  secondaryAction: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingChip: {
    minHeight: 28,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  waitingText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  skeletonLine: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  skeletonAction: {
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
});

export default memo(UpNextRailCard);
