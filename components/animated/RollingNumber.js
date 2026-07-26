import React, { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const RollingDigit = memo(function RollingDigit({
  value,
  height,
  width,
  textStyle,
  duration = 220,
}) {
  const [pair, setPair] = useState({ previous: value, current: value });
  const progress = useSharedValue(1);

  useEffect(() => {
    if (value === pair.current) return;
    setPair({ previous: pair.current, current: value });
    progress.value = 0;
    progress.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [duration, pair.current, progress, value]);

  const previousStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * height }],
    opacity: 1 - progress.value * 0.35,
  }));
  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (progress.value - 1) * height }],
    opacity: 0.65 + progress.value * 0.35,
  }));

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Animated.Text style={[styles.absoluteGlyph, textStyle, previousStyle]}>
        {pair.previous}
      </Animated.Text>
      <Animated.Text style={[styles.absoluteGlyph, textStyle, currentStyle]}>
        {pair.current}
      </Animated.Text>
    </View>
  );
});

// Kararlı yukarı-sayaç. Değeri rAF ile 0'dan hedefe eased sayar ve TEK bir
// <Text> olarak basar. Eski sürüm her rakamı ayrı "slot makinesi" (RollingDigit)
// olarak diziyordu; sayı büyüyüp basamak kazandıkça ve binlik ayıracı araya
// girdikçe elemanlar pozisyona göre remount olup birbirine karışıyordu
// (kararsız/titrek görüntü). tabular-nums → her rakam eşit genişlikte, kare kare
// genişlik titremesi olmaz. RollingDigit hâlâ CountdownTimer için dışa aktarılır.
const RollingNumber = memo(function RollingNumber({
  value = 0,
  duration = 1100,
  digitDuration = 190, // API uyumu için korunur (artık kullanılmıyor)
  format = (number) => String(number),
  style,
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const target = Math.max(0, Number(value) || 0);
    // Hedef 0 ise sayaç döngüsü açma; anında 0 göster.
    if (target === 0) {
      setDisplayValue(0);
      return undefined;
    }
    const startedAt = Date.now();
    const span = Math.max(1, duration);
    let lastRendered = -1;
    const update = () => {
      const elapsed = Math.min(1, (Date.now() - startedAt) / span);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const next = Math.round(target * eased);
      if (next !== lastRendered) {
        lastRendered = next;
        setDisplayValue(next);
      }
      frameRef.current = elapsed < 1 ? requestAnimationFrame(update) : null;
    };
    setDisplayValue(0);
    frameRef.current = requestAnimationFrame(update);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [duration, value]);

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[style, styles.tabularNums]}
    >
      {format(displayValue)}
    </Text>
  );
});

export default RollingNumber;

const styles = StyleSheet.create({
  absoluteGlyph: { position: "absolute", left: 0, top: 0 },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
