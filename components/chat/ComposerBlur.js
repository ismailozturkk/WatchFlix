import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import GlassSurface from "../common/GlassSurface";
import { useLiquidGlass } from "../../services/liquidGlass";
import { androidSupportsNativeBlur } from "../../utils/blurSupport";
import { surfaceBlurAppearance } from "../../utils/surfaceBlur";
import { alpha } from "../../theme/colors";

// Bu platformda hedef GERÇEKTEN bir BlurTargetView mi (Android 12+)? Öyleyse
// hedefin içeriği kaydedilip bulandırılır ve arka plan hedefin İÇİNDE opak olmak
// zorundadır; değilse (iOS, eski Android) hedef sıradan bir View'dır ve arka plan
// onun arkasında (kökte) çizilebilir.
export const COMPOSER_TARGET_IS_NATIVE =
  Platform.OS === "android" && androidSupportsNativeBlur(Platform.Version);

// Keep each chat's target local: stacked chats and AI modals can coexist.
export function useComposerBlurTarget() {
  const [node, attach] = useState(null);
  const target = useMemo(() => (node ? { current: node } : null), [node]);
  return { attach, target };
}

export function ComposerBlurTarget({ attach, backgroundColor, children, ...props }) {
  // The background must be INSIDE the native target: the target host's own
  // background is not part of the recorded message content on Android.
  const content = <View style={{ flexGrow: 1, flexShrink: 1, backgroundColor }}>{children}</View>;
  return COMPOSER_TARGET_IS_NATIVE
    ? <BlurTargetView ref={attach} {...props}>{content}</BlurTargetView>
    : <View {...props}>{content}</View>;
}

// Cam yolunda hapın SARMALAYICISINA eklenecek stil. Cam kendi kenar ışığını ve
// derinlik gölgesini çizer (GlassSurface kuralı 4); üstüne bir de çerçeve halkası
// ve RN gölgesi kalınca camın çevresinde/arkasında ikinci bir hap duruyormuş gibi
// görünür: halka camdan 1,5 px dışarıda (mutlak katman kenarlığın İÇİNDE kalır) ve
// farklı yarıçapta, gölge ise iOS'ta saydam kapsayıcının içeriğinden (halka + düğme
// daireleri) türediği için şekilsiz bir leke bırakır.
// `borderWidth` BİLEREK korunur, yalnız rengi saydamlaşır: kalınlık değişirse hap
// 3 px küçülür ve altındaki liste / klavye hesapları kayar.
// Odak / spoiler vurgusunun cam karşılığı `ComposerBlur`un `tint` prop'udur.
export const COMPOSER_GLASS_PILL_STYLE = Object.freeze({
  borderColor: "transparent",
  shadowColor: "transparent",
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
});

export default function ComposerBlur({ target, theme, radius = 28, tint }) {
  const glass = useLiquidGlass();
  const appearance = surfaceBlurAppearance(theme.secondary);

  // iOS 26+: blur + renk katmanı yerine gerçek Liquid Glass. Mesajlar hapın
  // altından kayarken cam onları kendisi kırıp bulandırır; blurTarget gerekmez.
  // Kapsayıcı `overflow: hidden` TAŞIMAZ — cam kendi köşesini keser, kenar ışığı
  // kırpılmasın. Çerçeve ve gölge tüketicide COMPOSER_GLASS_PILL_STYLE ile kalkar;
  // vurgu (spoiler, # arama kipi) `tint` ile camın kendisine verilir.
  if (glass) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GlassSurface radius={radius} tint={tint} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <AdaptiveBlurView
        blurTarget={target}
        intensity={appearance.intensity}
        tint={appearance.tint}
        fallbackColor={appearance.surface}
        fallbackAlpha={appearance.fallbackAlpha}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(appearance.surface, appearance.overlayAlpha) }]} />
    </View>
  );
}
