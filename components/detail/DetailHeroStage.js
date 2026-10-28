// components/detail/DetailHeroStage.js
//
// Film ve dizi detay ekranlarının üst arka plan posteri (backdrop) yuvası:
//   • Üst şerit (bildirim / durum çubuğu alanı) → posterin üst kenarının dikey
//     yansıtılmış ve bulanıklaştırılmış ambiyans devamı.
//   • Orta yuva → 16:9 arka plan posterinin tamamı; ne bildirim çubuğunun ne de
//     alt bilgi başlığının altında kaybolur.
//   • Alt şerit → posterin hemen altında devam eden bulanık ambiyans katmanı ve
//     tema zeminine yumuşak geçiş; poster + başlık bloğu (infoHeader) yalnız bu
//     alt ambiyans bölgesinin üstüne biner.
//   • Orta poster ile üst/alt bulanık şeritler arasındaki sınırda keskin çizgi
//     oluşmaması için kenarlarda kademeli (progressive) bulanıklık geçişi
//     uygulanır.

import React, { memo } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "@theme/colors";
import { isLightSurface } from "@utils/colorUtils";

const DEFAULT_WIDTH = Dimensions.get("window").width;

// Platforma göre bulanıklık yarıçapları: kademeli geçiş (0 → yumuşak → orta → ambiyans).
const AMBIENT_BLUR_BASE = Platform.OS === "ios" ? 28 : 20;
const AMBIENT_BLUR_MIRROR = Platform.OS === "ios" ? 22 : 16;
const EDGE_BLUR_OUTER = Platform.OS === "ios" ? 13 : 10;
const EDGE_BLUR_INNER = Platform.OS === "ios" ? 6 : 5;

const TOP_FEATHER_OUTER_H = 5;
const TOP_FEATHER_INNER_H = 11;
const BOTTOM_FEATHER_OUTER_H = 6;
const BOTTOM_FEATHER_INNER_H = 13;

/**
 * Detay ekranı üst poster yuvasının ölçülerini hesaplar.
 *
 * @param {object} [params]
 * @param {number} [params.width]       Ekran genişliği
 * @param {number} [params.topInset]    Güvenli alan üst boşluğu (bildirim çubuğu)
 * @param {number} [params.imageHeight] Orta görsel yüksekliği (varsayılan 16:9)
 */
export function computeDetailHeroMetrics({
  width = DEFAULT_WIDTH,
  topInset = 0,
  imageHeight,
} = {}) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_WIDTH;
  const safeTopInset =
    Number.isFinite(topInset) && topInset >= 0 ? Math.round(topInset) : 0;

  const defaultBackdropHeight = Math.round(safeWidth * (9 / 16));
  const backdropHeight =
    Number.isFinite(imageHeight) && imageHeight > 0
      ? Math.round(imageHeight)
      : defaultBackdropHeight;

  // Bildirim çubuğu bölgesinde kompakt üst ambiyans şeridi.
  const topAmbientHeight = Math.max(Math.round(safeTopInset * 0.72), 20);
  // Posterin hemen altında kısa ambiyans devamı.
  const bottomAmbientHeight = Math.round(defaultBackdropHeight * 0.14);
  const stageHeight = topAmbientHeight + backdropHeight + bottomAmbientHeight;
  // Bilgi başlığı (küçük poster + başlık/tür/puan) alt ambiyans şeridini kapatıp
  // posterin alt kısmına hafifçe biner.
  const infoHeaderOverlap = Math.round(defaultBackdropHeight * 0.27);
  // Sezon ve bölüm detaylarındaki düz içerik bloğu için örtüşme miktarı.
  const contentOverlap = Math.round(defaultBackdropHeight * 0.18);

  return {
    backdropHeight,
    topAmbientHeight,
    bottomAmbientHeight,
    stageHeight,
    infoHeaderOverlap,
    contentOverlap,
  };
}

const DetailHeroStage = memo(function DetailHeroStage({
  uri,
  theme,
  topInset = 0,
  width = DEFAULT_WIDTH,
  imageHeight,
  placeholderIcon = "film-outline",
  placeholderSize = 64,
  onPress,
  children,
}) {
  const {
    backdropHeight,
    topAmbientHeight,
    bottomAmbientHeight,
    stageHeight,
  } = computeDetailHeroMetrics({ width, topInset, imageHeight });

  const lightSurface = isLightSurface(theme.primary);
  const bottomFadeHeight = bottomAmbientHeight + BOTTOM_FEATHER_INNER_H;

  return (
    <View
      testID="detail-hero-stage"
      style={[
        styles.stage,
        {
          height: stageHeight,
          backgroundColor: theme.secondary,
        },
      ]}
    >
      {uri ? (
        <>
          {/* 1) Tüm yuvayı dolduran derin bulanık zemin */}
          <Image
            testID="detail-hero-ambient-base"
            source={{ uri }}
            blurRadius={AMBIENT_BLUR_BASE}
            style={styles.ambientBase}
            resizeMode="cover"
          />

          {/* 2) Üst ambiyans yuvası (bildirim ekranı bölgesi):
                 Poster üst kenarının dikey yansıması + bulanıklık */}
          <View
            testID="detail-hero-ambient-top"
            pointerEvents="none"
            style={[styles.topAmbientSlot, { height: topAmbientHeight }]}
          >
            <Image
              source={{ uri }}
              blurRadius={AMBIENT_BLUR_MIRROR}
              style={[
                styles.mirroredBackdrop,
                {
                  height: backdropHeight,
                  bottom: 0,
                },
              ]}
              resizeMode="cover"
            />
          </View>

          {/* 3) Alt ambiyans yuvası (posterin hemen altı):
                 Poster alt kenarının dikey yansıması + bulanıklık */}
          <View
            testID="detail-hero-ambient-bottom"
            pointerEvents="none"
            style={[
              styles.bottomAmbientSlot,
              {
                top: topAmbientHeight + backdropHeight,
                height: bottomAmbientHeight,
              },
            ]}
          >
            <Image
              source={{ uri }}
              blurRadius={AMBIENT_BLUR_MIRROR}
              style={[
                styles.mirroredBackdrop,
                {
                  height: backdropHeight,
                  top: 0,
                },
              ]}
              resizeMode="cover"
            />
          </View>

          {/* 4) Ortada net arka plan görseli + kenar geçiş yumuşatması */}
          <View
            testID="detail-hero-center-slot"
            style={[
              styles.centerPosterSlot,
              {
                top: topAmbientHeight,
                height: backdropHeight,
              },
            ]}
          >
            {onPress ? (
              <TouchableOpacity
                testID="detail-hero-backdrop-touch"
                activeOpacity={0.95}
                onPress={onPress}
                style={styles.backdropTouch}
              >
                <Image
                  testID="detail-hero-backdrop-image"
                  source={{ uri }}
                  style={styles.backdrop}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View
                testID="detail-hero-backdrop-touch"
                style={styles.backdropTouch}
              >
                <Image
                  testID="detail-hero-backdrop-image"
                  source={{ uri }}
                  style={styles.backdrop}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Üst sınır kademeli bulanıklık geçişi (net poster → üst ambiyans) */}
            <View
              pointerEvents="none"
              style={[styles.topFeatherStrip, { height: TOP_FEATHER_INNER_H }]}
            >
              <Image
                source={{ uri }}
                blurRadius={EDGE_BLUR_INNER}
                style={[styles.featherImageTop, { height: backdropHeight }]}
                resizeMode="cover"
              />
            </View>
            <View
              pointerEvents="none"
              style={[styles.topFeatherStrip, { height: TOP_FEATHER_OUTER_H }]}
            >
              <Image
                source={{ uri }}
                blurRadius={EDGE_BLUR_OUTER}
                style={[styles.featherImageTop, { height: backdropHeight }]}
                resizeMode="cover"
              />
            </View>

            {/* Alt sınır kademeli bulanıklık geçişi (net poster → alt ambiyans) */}
            <View
              pointerEvents="none"
              style={[
                styles.bottomFeatherStrip,
                { height: BOTTOM_FEATHER_INNER_H },
              ]}
            >
              <Image
                source={{ uri }}
                blurRadius={EDGE_BLUR_INNER}
                style={[styles.featherImageBottom, { height: backdropHeight }]}
                resizeMode="cover"
              />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.bottomFeatherStrip,
                { height: BOTTOM_FEATHER_OUTER_H },
              ]}
            >
              <Image
                source={{ uri }}
                blurRadius={EDGE_BLUR_OUTER}
                style={[styles.featherImageBottom, { height: backdropHeight }]}
                resizeMode="cover"
              />
            </View>
          </View>
        </>
      ) : (
        <View
          testID="detail-hero-placeholder"
          style={[
            styles.noBackdrop,
            {
              marginTop: topAmbientHeight,
              height: backdropHeight,
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Ionicons
            name={placeholderIcon}
            size={placeholderSize}
            color={theme.text?.muted ?? "#555"}
          />
        </View>
      )}

      {/* Üst bildirim çubuğu okunabilirlik tülü (ambiayans renklerini korur) */}
      <LinearGradient
        colors={["rgba(0,0,0,0.32)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0)"]}
        locations={[0, 0.65, 1]}
        style={[styles.topScrim, { height: topAmbientHeight + 6 }]}
        pointerEvents="none"
      />

      {/* Alt ambiyans şeridinden sayfa zeminine (theme.primary) yumuşak geçiş */}
      <LinearGradient
        colors={[
          alpha(theme.primary, 0),
          alpha(theme.primary, lightSurface ? 0.68 : 0.44),
          theme.primary,
        ]}
        locations={[0, 0.55, 1]}
        style={[styles.bottomGradient, { height: bottomFadeHeight + 10 }]}
        pointerEvents="none"
      />

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  ambientBase: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.08 }],
  },
  topAmbientSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  bottomAmbientSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  mirroredBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    transform: [{ scaleY: -1 }, { scaleX: 1.05 }],
  },
  centerPosterSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    overflow: "hidden",
  },
  backdropTouch: {
    width: "100%",
    height: "100%",
  },
  backdrop: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  topFeatherStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  bottomFeatherStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  featherImageTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
  featherImageBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
  },
  noBackdrop: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default DetailHeroStage;
