// components/navigation/TabBarAiButton.js
//
// Alt çubuğun yanındaki AYRIK, YUVARLAK yapay zeka (CineMatch) düğmesi — JS çubuğu
// modları için (Android cam / bulanıklık / düz zemin; yerel iOS çubuğunda bunun
// karşılığı sistemin kendi ayrık arama düğmesidir, bkz. AdaptiveTabShell).
//
// Çubukla AYNI cam levhayı (TabBarGlassPlate) kullanır ve AYNI yükseklikte bir
// daire olduğu için çubukla aynı yatay hizada durur. Bir SEKME değildir: seçili
// duruma geçmez, dokununca yalnız sohbeti açar (`accessibilityRole="button"`).
//
// Dokunma geri bildirimi çubuğun sekmeleriyle aynı yay + küçülme; gölge de çubukla
// aynı değerler. Kaydırınca küçülme (collapse) dönüşümü bu bileşende DEĞİL, çubuk
// ile düğmeyi birlikte saran grupta uygulanır (TabBar) — ikisi tek parça küçülür.
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import AppIcon from "../AppIcon";
import TabBarGlassPlate from "./TabBarGlass";
import { AI_ACTION } from "../../utils/tabBarModel";
import { isLightSurface } from "../../utils/colorUtils";

const SPRING = { mass: 0.6, damping: 18, stiffness: 220 };
const PRESSED_SCALE = 0.9;

function TabBarAiButton({ label, onPress, mode, layout, theme, blurTarget, reduceMotion, onGlassFailure }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isLight = isLightSurface(theme.primary);
  const size = layout.aiSize;

  return (
    <View
      testID="tab-bar-ai-shadow"
      style={[
        styles.shadow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: theme.shadow || "#000000",
          shadowOpacity: isLight ? 0.12 : 0.35,
        },
      ]}
    >
      <TabBarGlassPlate
        mode={mode}
        theme={theme}
        blurTarget={blurTarget}
        onGlassFailure={onGlassFailure}
        radius={size / 2}
        style={{ width: size, height: size }}
      >
        <TouchableOpacity
          testID={`tab-${AI_ACTION.key}`}
          accessibilityRole="button"
          accessibilityLabel={label}
          activeOpacity={1}
          style={styles.touch}
          onPress={onPress}
          onPressIn={() => { scale.value = reduceMotion ? 1 : withSpring(PRESSED_SCALE, SPRING); }}
          onPressOut={() => { scale.value = reduceMotion ? 1 : withSpring(1, SPRING); }}
        >
          <Animated.View
            style={[styles.content, pressStyle]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <AppIcon
              family={AI_ACTION.family}
              name={AI_ACTION.icon}
              size={26}
              color={theme.accent || (isLight ? "#007AFF" : "#0A84FF")}
            />
          </Animated.View>
        </TouchableOpacity>
      </TabBarGlassPlate>
    </View>
  );
}

export default memo(TabBarAiButton);

const styles = StyleSheet.create({
  // Çubuğun gölgesiyle aynı değerler (TabBar styles.shadow).
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 10,
  },
  touch: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", justifyContent: "center" },
});
