// components/navigation/TabBarGlass.js
//
// JS sekme çubuğunun (Android cam / bulanıklık / düz zemin) CAM LEVHASI. Çubuğun
// kendisi (TabBar) ve yanındaki yuvarlak yapay zeka düğmesi (TabBarAiButton) AYNI
// levhayı kullanır: aynı bulanıklık, aynı kenar çizgisi, aynı üst parlaması. İki
// yüzey bir arada durduğu için ayrı ayrı çizilen iki "benzer" katman zamanla
// ayrışırdı; tek yerde durması bunu engeller.
//
// iOS'ta (yerel çubuk) bu dosya kullanılmaz: orada sistemin kendi cam çubuğu ve
// ayrık arama düğmesi çizilir (AdaptiveTabShell).
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import { tabBarNativeSupport } from "../../services/tabBarCapabilities";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { surfaceBlurAppearance } from "../../utils/surfaceBlur";

class GlassBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function AndroidGlassSurface({ theme, onFailure, cornerRadius = 32 }) {
  const [ready, setReady] = useState(false);
  const Glass = tabBarNativeSupport.AndroidGlass;
  const blur = surfaceBlurAppearance(theme.tab || theme.secondary);
  if (!Glass) return null;
  return (
    <GlassBoundary onFailure={onFailure}>
      <Glass
        testID="tab-glass-surface"
        providerId="seelogd-tabs"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        cornerRadius={cornerRadius}
        tint={alpha(blur.surface, blur.tint === "light" ? 0.26 : 0.32)}
        blurRadius={12}
        refractionHeight={8}
        refractionAmount={5}
        saturation={1.15}
        chromaticAberration={0.025}
        noiseAlpha={0.008}
        highlightAlpha={blur.tint === "light" ? 0.5 : 0.32}
        highlightWidth={0.75}
        onRenderStatus={({ nativeEvent }) => {
          if (nativeEvent.status === "failed") onFailure();
          else if (nativeEvent.status === "ready") setReady(true);
        }}
      />
      {!ready && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, 0.9) }]}
        />
      )}
    </GlassBoundary>
  );
}

/**
 * Yuvarlatılmış cam levha: yüzey (cam / bulanıklık / düz) + ince kenar çizgisi +
 * üstte hafif parlama. Çocuklar yüzeyin ÜSTÜNDE çizilir.
 *
 * @param {"android-glass"|"legacy-blur"|"legacy-solid"} props.mode
 * @param {number} props.radius       Köşe yarıçapı (daire için boyutun yarısı)
 * @param {object} [props.style]      Boyut (width/height) ve yerleşim
 */
export default function TabBarGlassPlate({
  mode,
  theme,
  blurTarget,
  onGlassFailure,
  radius,
  style,
  children,
}) {
  const isLight = isLightSurface(theme.primary);
  const blur = surfaceBlurAppearance(theme.tab || theme.secondary);
  return (
    <View
      style={[
        styles.plate,
        {
          borderRadius: radius,
          borderColor: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.16)",
        },
        style,
      ]}
    >
      {mode === "android-glass" ? (
        <AndroidGlassSurface theme={theme} onFailure={onGlassFailure} cornerRadius={radius} />
      ) : mode === "legacy-solid" ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, blur.fallbackAlpha) }]}
        />
      ) : (
        <AdaptiveBlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={blur.tint}
          intensity={blur.intensity}
          blurTarget={blurTarget}
          fallbackColor={blur.surface}
          fallbackAlpha={blur.fallbackAlpha}
        >
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: alpha(blur.surface, blur.overlayAlpha) }]}
          />
        </AdaptiveBlurView>
      )}

      {/* Specular top highlight reflection */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha("#ffffff", isLight ? 0.32 : 0.12), alpha("#ffffff", 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
