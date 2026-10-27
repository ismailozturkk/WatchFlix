import React, { useMemo, useRef } from "react";
import { View, StyleSheet, PanResponder } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";

/**
 * RatingInput — interaktif yıldız puanlama (0-10 ölçeği, yarım yıldız destekli).
 *
 * 5 yıldız; her yıldızın sol yarısı = yarım puan (i*2-1), sağ yarısı = tam (i*2).
 * Böylece 1,2,3,...,10 (0.5 yıldız = 1 puan) adımlarıyla puanlanır. Dokunmak
 * o noktayı seçer; parmağı kaldırmadan kaydırmak puanı oradan artırır/azaltır.
 *
 * @param {number} value     Mevcut puan (0-10)
 * @param {Function} onChange (newValue:0-10) => void
 * @param {number} [size=36]
 * @param {string} [color="#FFB300"]
 * @param {string} [emptyColor="rgba(255,255,255,0.25)"]
 * @param {number} [count=5]
 */
export default function RatingInput({
  value = 0,
  onChange,
  size = 36,
  color = "#FFB300",
  emptyColor = "rgba(255,255,255,0.25)",
  count = 5,
}) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const set = (v) => {
    if (v === valueRef.current) return;
    valueRef.current = v;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    onChangeRef.current?.(v);
  };

  // Yıldızların arasındaki 4 px boşluklar da komşu yarım puana dahil edilir.
  const ratingFromX = (x) => {
    const width = count * size + Math.max(0, count - 1) * 4;
    const safeX = Math.max(0, Math.min(width, Number(x) || 0));
    return Math.max(1, Math.min(count * 2, Math.ceil((safeX / width) * count * 2)));
  };

  // Dokunuş ve kaydırma tek responder'da: parmağın indiği nokta satır
  // koordinatında bir kez okunur (yıldızlar pointerEvents="none", hedef hep
  // satırın kendisi), sonrası yalnız gesture.dx ile ilerler. locationX'i her
  // harekette yeniden okumak, parmağın altındaki çocuk görünüme göre değer
  // döndürdüğü için puanı zıplatıyordu.
  const startXRef = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          startXRef.current = Number(event.nativeEvent.locationX) || 0;
          set(ratingFromX(startXRef.current));
        },
        onPanResponderMove: (_, gesture) => set(ratingFromX(startXRef.current + gesture.dx)),
        // Belirgin dikey kaydırmada (sayfa kaydırma / sayfayı kapatma) bırak;
        // yatay puanlama başladıysa parmak kalkana kadar tut.
        onPanResponderTerminationRequest: (_, gesture) =>
          Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onShouldBlockNativeResponder: () => true,
      }),
    // Ölçüler değiştiğinde responder yeniden kurulmalı; değer/onChange ref'ten okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, size],
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={styles.row}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: count * 2, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "increment") set(Math.min(count * 2, valueRef.current + 1));
        if (nativeEvent.actionName === "decrement") set(Math.max(0, valueRef.current - 1));
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const starValue = i + 1;
        const full = value >= starValue * 2;
        const half = !full && value >= starValue * 2 - 1;
        const name = full ? "star" : half ? "star-half" : "star-outline";
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.starWrap,
              { width: size, height: size, marginRight: i === count - 1 ? 0 : 4 },
            ]}
          >
            <Ionicons
              name={name}
              size={size}
              color={full || half ? color : emptyColor}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  starWrap: { position: "relative", justifyContent: "center", alignItems: "center" },
});
