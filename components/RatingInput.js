import React, { useMemo, useRef, useState } from "react";
import { View, StyleSheet, PanResponder, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";
import { RATING_MAX, normalizeUserRating, ratingScaleSpec } from "@utils/ratingScale";

/**
 * RatingInput — interaktif yıldız puanlama. Değer HER ZAMAN 0-10 saklama ölçeğinde.
 *
 * scale="ten" (varsayılan): 10 yıldız; yıldızın sol yarısı = x,5, sağ yarısı = tam puan
 *   → 0,5 · 1 · 1,5 … 8,5 … 10.
 * scale="five": 5 yıldız; yarım yıldız = 1 puan → 1 … 10 (Ayarlar > Kişiselleştirme). Dokunmak o noktayı seçer;
 * parmağı kaldırmadan kaydırmak puanı oradan artırır/azaltır.
 *
 * Genişliğe sığar: 10 yıldız `size` ile taşacaksa yıldızlar kapsayıcıya göre
 * küçülür (dar telefonda da tek satır). Bkz. docs/planlama/YARIM_PUAN_10_YILDIZ_PLANI.md
 *
 * @param {number} value      Mevcut puan (0-10, 0.5 adımlı)
 * @param {Function} onChange (newValue: 0.5-10) => void
 * @param {number} [size=30]  En büyük yıldız boyu (yer yetmezse küçülür)
 * @param {string} [color="#FFB300"]
 * @param {string} [emptyColor="rgba(255,255,255,0.25)"]
 * @param {"ten"|"five"} [scale="ten"]
 */
const MIN_STAR = 18;

export default function RatingInput({
  value = 0,
  onChange,
  size = 30,
  color = "#FFB300",
  emptyColor = "rgba(255,255,255,0.25)",
  scale = "ten",
}) {
  const { stars: count, step } = ratingScaleSpec(scale);
  // Bir yıldızın puan karşılığı (ten: 1, five: 2) ve yarım yıldızın (ten: 0.5, five: 1).
  const perStar = RATING_MAX / count;
  // 10'lu modda verilmiş 8.5, 5'li modda en yakın yarım yıldıza oturur (4½ ★).
  const shown = normalizeUserRating(value, scale);
  const { width: windowWidth } = useWindowDimensions();
  // Ölçüm gelene kadar ekran genişliğinden tahmin (sayfa dolgusu payıyla) → ilk karede zıplama olmaz.
  const [available, setAvailable] = useState(Math.max(0, windowWidth - 72));

  const gap = size >= 28 ? 4 : 3;
  const starSize = Math.max(
    MIN_STAR,
    Math.min(size, Math.floor((available - gap * (count - 1)) / count)),
  );
  const rowWidth = count * starSize + (count - 1) * gap;

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const rowWidthRef = useRef(rowWidth);
  const scaleRef = useRef({ count, step, scale });
  valueRef.current = value;
  onChangeRef.current = onChange;
  rowWidthRef.current = rowWidth;
  scaleRef.current = { count, step, scale };

  const set = (raw) => {
    const { step: s, scale: sc } = scaleRef.current;
    const v = normalizeUserRating(raw, sc);
    if (v <= 0 || v === valueRef.current) return;
    valueRef.current = v;
    // Yarım yıldız başına bir tik; uçlarda (en düşük ve 10) daha belirgin bir "duvar".
    Haptics.haptic(v <= s || v >= RATING_MAX ? "sliderEdge" : "sliderTick");
    onChangeRef.current?.(v);
  };

  // Yıldızların arasındaki boşluklar da komşu yarım puana dahil edilir.
  const ratingFromX = (x) => {
    const width = rowWidthRef.current;
    const { count: c, step: s } = scaleRef.current;
    const safeX = Math.max(0, Math.min(width, Number(x) || 0));
    const halves = c * 2;
    return Math.max(1, Math.min(halves, Math.ceil((safeX / width) * halves))) * s;
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
    // Ölçü/değer/onChange ref'ten okunur; responder bir kez kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View
      style={styles.fit}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== available) setAvailable(w);
      }}
    >
      <View
        {...panResponder.panHandlers}
        style={[styles.row, { width: rowWidth }]}
        hitSlop={{ top: 8, bottom: 8 }}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: RATING_MAX, now: shown }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const s = scaleRef.current.step;
          const current = normalizeUserRating(valueRef.current, scaleRef.current.scale);
          if (nativeEvent.actionName === "increment") set(Math.min(RATING_MAX, current + s));
          if (nativeEvent.actionName === "decrement") set(Math.max(s, current - s));
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const starPoints = (i + 1) * perStar;
          const full = shown >= starPoints;
          const half = !full && shown >= starPoints - step;
          const name = full ? "star" : half ? "star-half" : "star-outline";
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.starWrap,
                { width: starSize, height: starSize, marginRight: i === count - 1 ? 0 : gap },
              ]}
            >
              <Ionicons name={name} size={starSize} color={full || half ? color : emptyColor} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Kapsayıcı genişliğini ölçmek için tam genişlik; yıldız satırı ortalanır.
  fit: { width: "100%", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  starWrap: { position: "relative", justifyContent: "center", alignItems: "center" },
});
