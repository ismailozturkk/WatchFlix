// components/lists/ListPosterCard.js
//
// Liste ızgaralarının (ListsScreen, SharedListScreen) TEK poster kartı. Eski kart her ekranda ayrı ayrı,
// satır içi (inline) yazılıydı: sabit 9 pt rozetler 4'lü ızgarada posterden taşıyordu, her poster bir
// SwipeCard (GestureDetector) ile sarılıydı, basma animasyonu için öğe başına Animated.Value tutuluyordu,
// TMDB görseli posterin boyutundan bağımsız sabit "200" ile isteniyordu.
//
// Şimdi:
//   • Her ölçü poster genişliğinden türer (utils/listPosterLayout): rozet puntosu / dolgusu / köşesi,
//     başlık puntosu, süre ve ilerleme yazıları. Dar posterde tür rozeti yalnız simge olur, ilerleme yazısı gizlenir.
//   • Rozetler cam-koyu hap (PosterInfoBadges ile aynı dil); eski renkli düz kutular gitti.
//   • Dizi ilerlemesi: posterin dibinde yuvarlak uçlu ince çubuk (+ "12/24" yazısı geniş posterde), eski
//     react-native-progress çubuğu ve tam genişlik karartma yok.
//   • Basma geri bildirimi Pressable'ın kendi `pressed` durumu; kart `memo` — yalnız kendi propları değişince çizilir.
//   • Görsel gerçek poster genişliğiyle istenir (3'lü ızgarada ~5x daha az bayt), `recyclingKey` ile geri dönüşümlü
//     hücrelerde eski afiş yanıp sönmez.
//
// Davranış sözleşmesi: dokunma → onPress(item), uzun basma → onLongPress(item) (çağıran haptik / eylem sayfasını yönetir).
// `bottomSlot` (Ortak liste: "ekleyen" çipi) posterin dibine yaslanır; `bottomSlotHeight` kişisel puan rozetini
// onun üstüne kaldırır.

import React, { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import PosterImage from "@components/PosterImage";
import { MyPosterActivityBadge } from "@components/PosterActivityBadge";
import {
  PRESS_SCALE,
  badgePlanOf,
  badgeScaleFor,
  imageWidthFor,
  posterHeightFor,
  posterKeyOf,
  titleMetricsFor,
  watchProgressOf,
} from "@utils/listPosterLayout";

const PILL_BG = "rgba(10,12,18,0.74)";
const PILL_BORDER = "rgba(255,255,255,0.16)";
const TYPE_COLOR = { movie: "#6EA8FF", tv: "#5FD69A" };
const PROGRESS_DONE = "#34D17A";
const PROGRESS_ACTIVE = "#FF9F43";

const roundHalf = (n) => Math.round(n * 2) / 2;

function Pill({ icon, iconColor, text, metrics, style, testID }) {
  return (
    <View testID={testID} style={[styles.pill, metrics.box, style]}>
      {icon ? <Ionicons name={icon} size={metrics.icon} color={iconColor || "#fff"} /> : null}
      {text ? (
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.pillText, { fontSize: metrics.font }]}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

function ListPosterCard({
  item,
  posterWidth,
  radius = 12,
  info,
  listName,
  theme,
  durationMinutes,
  watchedCount,
  totalCount,
  typeLabels,
  onPress,
  onLongPress,
  bottomSlot = null,
  bottomSlotHeight = 0,
}) {
  const height = posterHeightFor(posterWidth);
  const s = badgeScaleFor(posterWidth);

  // Ölçüler: yalnız poster genişliği değişince yeniden hesaplanır.
  const metrics = useMemo(() => {
    const font = Math.max(8, roundHalf(9.5 * s));
    return {
      inset: Math.max(4, Math.round(6 * s)),
      font,
      icon: Math.round(font * 1.2),
      barHeight: Math.max(3, Math.round(4 * s)),
      box: {
        gap: Math.max(2, Math.round(3 * s)),
        paddingHorizontal: Math.max(4, Math.round(6 * s)),
        paddingVertical: Math.max(2, Math.round(2.5 * s)),
        borderRadius: Math.max(6, Math.round(9 * s)),
      },
    };
  }, [s]);
  const title = useMemo(() => titleMetricsFor(posterWidth), [posterWidth]);

  const progress = listName === "watchedTv" ? watchProgressOf(watchedCount, totalCount) : null;
  const plan = badgePlanOf({ info, posterWidth, type: item.type, durationMinutes, progress });

  const typeText = item.type === "movie" ? typeLabels?.movie : typeLabels?.tv;
  const hasBottomOverlay = plan.showProgress || bottomSlotHeight > 0;
  // Kişisel puan rozeti: ilerleme çubuğunun ve "ekleyen" çipinin ÜSTÜNE oturur.
  const barBlock = plan.showProgress ? metrics.barHeight + 4 : 0;
  const activityLift = metrics.inset + barBlock + bottomSlotHeight;

  const a11yLabel = [item.name, typeText, plan.durationText, progress?.label].filter(Boolean).join(", ");

  return (
    <Pressable
      testID={`list-poster-${posterKeyOf(item)}`}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      delayLongPress={380}
      style={({ pressed }) => [
        { width: posterWidth },
        pressed && { transform: [{ scale: PRESS_SCALE }], opacity: 0.94 },
      ]}
    >
      {/* Gölge ayrı kapta: çerçeve overflow:hidden olduğu için gölgesini kendisi çizemez. */}
      <View style={[styles.shadow, { borderRadius: radius }]}>
        <View
          style={[
            styles.frame,
            {
              width: posterWidth,
              height,
              borderRadius: radius,
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <PosterImage
            path={item.imagePath}
            type={item.type}
            size={imageWidthFor(posterWidth)}
            style={styles.image}
            contentFit="cover"
            transition={140}
            recyclingKey={posterKeyOf(item)}
          />

          {hasBottomOverlay ? (
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", "rgba(0,0,0,0.62)"]}
              style={[styles.scrim, { height: Math.round(height * 0.34) }]}
            />
          ) : null}

          {plan.showType ? (
            <Pill
              testID="list-poster-type"
              icon={item.type === "movie" ? "film-outline" : "tv-outline"}
              iconColor={TYPE_COLOR[item.type] || "#fff"}
              text={plan.typeLabel ? typeText : null}
              metrics={metrics}
              style={{ position: "absolute", top: metrics.inset, left: metrics.inset, maxWidth: "58%" }}
            />
          ) : null}

          {plan.durationText ? (
            <Pill
              testID="list-poster-duration"
              // En dar basamakta (xs) saat simgesi bırakılır: yazı tek başına yeter, rozet posterden taşmaz.
              icon={plan.tier === "xs" ? null : "time-outline"}
              iconColor="rgba(255,255,255,0.85)"
              text={plan.durationText}
              metrics={metrics}
              style={{ position: "absolute", top: metrics.inset, right: metrics.inset, maxWidth: "58%" }}
            />
          ) : null}

          <MyPosterActivityBadge
            mediaId={item.id}
            mediaType={item.type}
            posterWidth={posterWidth}
            showRating={info.rating}
            showComment={info.comment}
            layout="overlay"
            corner="bottomLeft"
            style={activityLift > metrics.inset ? { bottom: activityLift } : null}
          />

          {plan.showProgress ? (
            <>
              {plan.progressText ? (
                <Pill
                  testID="list-poster-progress-text"
                  icon={progress.complete ? "checkmark-circle" : null}
                  iconColor={PROGRESS_DONE}
                  text={progress.label}
                  metrics={metrics}
                  style={{
                    position: "absolute",
                    right: metrics.inset,
                    bottom: metrics.inset + barBlock + bottomSlotHeight,
                  }}
                />
              ) : null}
              <View
                testID="list-poster-progress"
                style={[
                  styles.track,
                  {
                    left: metrics.inset,
                    right: metrics.inset,
                    bottom: metrics.inset + bottomSlotHeight,
                    height: metrics.barHeight,
                    borderRadius: metrics.barHeight / 2,
                  },
                ]}
              >
                <View
                  style={{
                    width: `${Math.round(progress.ratio * 100)}%`,
                    height: "100%",
                    borderRadius: metrics.barHeight / 2,
                    backgroundColor: progress.complete ? PROGRESS_DONE : PROGRESS_ACTIVE,
                  }}
                />
              </View>
            </>
          ) : null}

          {bottomSlot}
        </View>
      </View>

      {info.title ? (
        <Text
          testID="list-poster-title"
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.title,
            {
              fontSize: title.fontSize,
              lineHeight: title.lineHeight,
              marginTop: title.marginTop,
              color: theme.text.primary,
            },
          ]}
        >
          {item.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 3,
  },
  frame: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: PILL_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PILL_BORDER,
  },
  pillText: { color: "#fff", fontWeight: "800", letterSpacing: 0.1, flexShrink: 1 },
  track: { position: "absolute", backgroundColor: "rgba(255,255,255,0.24)", overflow: "hidden" },
  title: { fontWeight: "700", letterSpacing: -0.1 },
});

export default memo(ListPosterCard);
