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
//
// Oyuncu / yönetmen sayfası (screens/actor/ActorViewScreen.js) aynı yuvayı dikey
// profil fotoğrafıyla kullanır: `bottomBandHeight` alt bulanık şeridi ad + rozet +
// eylem haplarını taşıyacak kadar uzatır, `bottomBandTint` beyaz yazı okunsun diye
// YALNIZ o şeridi koyulaştırır, `bottomFadeHeight` tema zeminine geçişi hapların
// altına sıkıştırır (açık temada beyaz yazı açık zemine düşmesin). Üçü de verilmezse
// film/dizi düzeni birebir aynı kalır.
//
// `scrollY` (native sürücülü Animated.Value) verilirse yuva, profil kapağıyla
// ORTAK hareketi yapar (components/common/heroScrollMotion.js): aşağı kaydırınca
// içerikten yavaş yükselip kararır ve söner, üstten çekince esner. Yuva içerikte
// kaldığı için hareket içeriğe karşı ötelenerek üretilir (inContentHeroMotion).
// Hareket yalnız GÖRSEL katmana uygulanır; `children` (oyuncu sayfasında ad +
// eylem hapları) içerikle birlikte normal kayar, kararmaz/sönmez.

import React, { memo } from "react";
import {
  Animated,
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
import { measureWindowRect } from "@utils/measureWindowRect";
import { HeroDarkenOverlay, heroMotionTuning, inContentHeroMotion } from "../common/heroScrollMotion";

const DEFAULT_WIDTH = Dimensions.get("window").width;

// Platforma göre bulanıklık yarıçapları: kademeli geçiş (0 → yumuşak → orta → ambiyans).
const AMBIENT_BLUR_BASE = Platform.OS === "ios" ? 28 : 20;
const AMBIENT_BLUR_MIRROR = Platform.OS === "ios" ? 22 : 16;
const EDGE_BLUR_OUTER = Platform.OS === "ios" ? 13 : 10;
const EDGE_BLUR_INNER = Platform.OS === "ios" ? 6 : 5;
// `ambientUri` (küçük görsel, ~w300) verildiğinde ambiyans katmanlarının yarıçapı:
// görsel ~4 kat küçük olduğu için aynı yumuşaklık ~4 kat küçük yarıçapla gelir.
// Isınma denetimi (11 Kas): bulanıklık CPU'da, görselin KENDİ pikselleri üzerinde
// yapılıyor (Android'de her yarıçap ayrı bir çözme + bulanıklaştırma); tam boy
// görseli üç kez bulanıklaştırmak yerine küçüğünü bulanıklaştırmak çok ucuz.
const AMBIENT_SMALL_BLUR_BASE = Platform.OS === "ios" ? 8 : 6;
const AMBIENT_SMALL_BLUR_MIRROR = Platform.OS === "ios" ? 6 : 5;
// Kenar geçiş şeritleri (4 adet) de küçük görselden: tam boy görseli 4 kez
// ayrı ayrı çözüp bulanıklaştırmak detay açılışının en pahalı işiydi (yol
// haritası Y3). Şeritler 5–13 px yüksekliğinde; küçük kaynak + ~4 kat küçük
// yarıçap gözle aynı yumuşaklığı verir.
const EDGE_SMALL_BLUR_OUTER = Platform.OS === "ios" ? 4 : 3;
const EDGE_SMALL_BLUR_INNER = Platform.OS === "ios" ? 2 : 2;

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
  bottomBandHeight,
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
  // Posterin hemen altında kısa ambiyans devamı (oyuncu sayfası uzatır).
  const bottomAmbientHeight =
    Number.isFinite(bottomBandHeight) && bottomBandHeight > 0
      ? Math.round(bottomBandHeight)
      : Math.round(defaultBackdropHeight * 0.14);
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
  // İsteğe bağlı: ambiyans (derin bulanık) katmanları için KÜÇÜK görsel adresi.
  // Verilmezse `uri` kullanılır (eski davranış).
  ambientUri,
  theme,
  topInset = 0,
  width = DEFAULT_WIDTH,
  imageHeight,
  // Oyuncu sayfası ayarları (bkz. dosya başı); verilmezse film/dizi düzeni.
  bottomBandHeight,
  bottomBandTint,
  bottomFadeHeight: bottomFadeOverride,
  // "contain": görsel yuvaya kırpılmadan sığar (kenarlarda bulanık zemin görünür).
  imageFit = "cover",
  placeholderIcon = "film-outline",
  placeholderSize = 64,
  // Dokunulunca net görselin PENCERE dikdörtgeniyle çağrılır (`onPress(rect)`):
  // galeri görseli tam bu yuvadan kalkıp ortaya uçar (ImageGalleryModal `origin`).
  onPress,
  // İsteğe bağlı Animated.Value: galeri açıkken net görsel yuvadan "kalkmış"
  // görünsün diye 0'a çekilir (altta bulanık ambiyans kalır).
  centerOpacity,
  // İsteğe bağlı: kaydırma konumu (bkz. dosya başı).
  scrollY,
  children,
}) {
  // Kanca yok (bileşen testlerde doğrudan fonksiyon olarak çağrılıyor): düğüm
  // her render'da yeni bir kutuya geri çağırımlı ref ile yazılır.
  const center = { node: null, pressRect: null };
  const setCenterNode = (node) => {
    center.node = node;
    if (!node) center.pressRect = null;
  };
  const handlePressIn = onPress
    ? () => measureWindowRect(center.node, (rect) => { center.pressRect = rect; })
    : undefined;
  const handlePress = onPress
    ? () => measureWindowRect(center.node, (rect) => {
        if (rect || center.pressRect || !center.node) {
          onPress(rect || center.pressRect);
          return;
        }
        // Native ölçüm, kaydırma bittiği ilk karede geçici olarak sıfır dönebilir.
        const retry = () => measureWindowRect(center.node, (next) =>
          onPress(next || null),
        );
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(retry);
        else setTimeout(retry, 16);
      })
    : undefined;
  const {
    backdropHeight,
    topAmbientHeight,
    bottomAmbientHeight,
    stageHeight,
  } = computeDetailHeroMetrics({ width, topInset, imageHeight, bottomBandHeight });

  // Kaydırma hareketi yuva boyuna orantılı: uzun oyuncu portresi daha uzun
  // mesafede ve daha çok yükselerek kararır (film/dizi yuvası temel değerlerde).
  const motionTuning = heroMotionTuning(stageHeight);

  const lightSurface = isLightSurface(theme.primary);
  const ambientSource = ambientUri || uri;
  const ambientBlurBase = ambientUri ? AMBIENT_SMALL_BLUR_BASE : AMBIENT_BLUR_BASE;
  const ambientBlurMirror = ambientUri ? AMBIENT_SMALL_BLUR_MIRROR : AMBIENT_BLUR_MIRROR;
  const edgeBlurInner = ambientUri ? EDGE_SMALL_BLUR_INNER : EDGE_BLUR_INNER;
  const edgeBlurOuter = ambientUri ? EDGE_SMALL_BLUR_OUTER : EDGE_BLUR_OUTER;
  const bottomGradientHeight =
    Number.isFinite(bottomFadeOverride) && bottomFadeOverride > 0
      ? Math.round(bottomFadeOverride)
      : bottomAmbientHeight + BOTTOM_FEATHER_INNER_H + 10;

  return (
    <View
      testID="detail-hero-stage"
      style={[
        styles.stage,
        {
          height: stageHeight,
          backgroundColor: scrollY ? "transparent" : theme.secondary,
        },
        // Görsel katman aşağı ötelenirken kırpılmasın (kırpma görsel katmanın kendisinde).
        scrollY ? styles.stageMoving : null,
      ]}
    >
      <Animated.View
        testID="detail-hero-visual"
        pointerEvents="box-none"
        style={[
          styles.visual,
          { backgroundColor: theme.secondary },
          scrollY ? inContentHeroMotion(scrollY, stageHeight, motionTuning) : null,
        ]}
      >
      {uri ? (
        <>
          {/* 1) Tüm yuvayı dolduran derin bulanık zemin */}
          <Image
            testID="detail-hero-ambient-base"
            source={{ uri: ambientSource }}
            blurRadius={ambientBlurBase}
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
              source={{ uri: ambientSource }}
              blurRadius={ambientBlurMirror}
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
              source={{ uri: ambientSource }}
              blurRadius={ambientBlurMirror}
              style={[
                styles.mirroredBackdrop,
                {
                  height: backdropHeight,
                  top: 0,
                },
              ]}
              resizeMode="cover"
            />
            {bottomBandTint ? (
              <View
                testID="detail-hero-bottom-tint"
                style={[styles.bandTint, { backgroundColor: bottomBandTint }]}
              />
            ) : null}
          </View>

          {/* 4) Ortada net arka plan görseli + kenar geçiş yumuşatması */}
          <Animated.View
            testID="detail-hero-center-slot"
            ref={setCenterNode}
            collapsable={false}
            style={[
              styles.centerPosterSlot,
              {
                top: topAmbientHeight,
                height: backdropHeight,
              },
              centerOpacity ? { opacity: centerOpacity } : null,
            ]}
          >
            {onPress ? (
              <TouchableOpacity
                testID="detail-hero-backdrop-touch"
                activeOpacity={0.95}
                onPressIn={handlePressIn}
                onPress={handlePress}
                style={styles.backdropTouch}
              >
                <Image
                  testID="detail-hero-backdrop-image"
                  source={{ uri }}
                  style={styles.backdrop}
                  resizeMode={imageFit}
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
                  resizeMode={imageFit}
                />
              </View>
            )}

            {/* Üst sınır kademeli bulanıklık geçişi (net poster → üst ambiyans) */}
            <View
              pointerEvents="none"
              style={[styles.topFeatherStrip, { height: TOP_FEATHER_INNER_H }]}
            >
              <Image
                source={{ uri: ambientSource }}
                blurRadius={edgeBlurInner}
                style={[styles.featherImageTop, { height: backdropHeight }]}
                resizeMode={imageFit}
              />
            </View>
            <View
              pointerEvents="none"
              style={[styles.topFeatherStrip, { height: TOP_FEATHER_OUTER_H }]}
            >
              <Image
                source={{ uri: ambientSource }}
                blurRadius={edgeBlurOuter}
                style={[styles.featherImageTop, { height: backdropHeight }]}
                resizeMode={imageFit}
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
                source={{ uri: ambientSource }}
                blurRadius={edgeBlurInner}
                style={[styles.featherImageBottom, { height: backdropHeight }]}
                resizeMode={imageFit}
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
                source={{ uri: ambientSource }}
                blurRadius={edgeBlurOuter}
                style={[styles.featherImageBottom, { height: backdropHeight }]}
                resizeMode={imageFit}
              />
            </View>
          </Animated.View>
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

      {/* Kaydırınca kararma örtüsü (scrollY verilmişse) */}
      <HeroDarkenOverlay scrollY={scrollY} fadeAt={motionTuning.fadeAt} />

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
        style={[styles.bottomGradient, { height: bottomGradientHeight }]}
        pointerEvents="none"
      />
      </Animated.View>

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
  stageMoving: { overflow: "visible" },
  visual: {
    ...StyleSheet.absoluteFillObject,
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
  bandTint: {
    ...StyleSheet.absoluteFillObject,
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
