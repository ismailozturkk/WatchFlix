// components/wrapped/YearHeat.js
//
// Yıl ısı haritası (GitHub katkı ızgarası tarzı): sütun = hafta, satır = gün,
// koyuluk = o gün izlenen öğe sayısı. Hem Wrapped slaytında hem paylaşım
// kartında kullanılır. Tek bir <Svg> — yüzlerce <View> yerine tek yerel katman,
// ve captureRef ile sorunsuz yakalanır.
//
// Saf/statik (animasyon yok). Hesap utils/wrappedCard.js `buildYearHeat`.

import React, { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { buildYearHeat } from "../../utils/wrappedCard";

// Düzey 0 = boş gün (iz rengi), 1–4 = vurgu renginin giderek dolan tonları.
const LEVEL_OPACITY = [0, 0.3, 0.52, 0.76, 1];

const YearHeat = memo(function YearHeat({
  year,
  dayHeat,
  width,
  color,
  trackColor,
}) {
  const grid = useMemo(() => buildYearHeat(year, dayHeat), [year, dayHeat]);
  const pitch = width / grid.cols;
  const size = pitch * 0.8;
  const radius = size * 0.24;
  const height = Math.round(pitch * grid.rows);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {grid.cells.map((cell, i) => (
          <Rect
            key={i}
            x={cell.col * pitch}
            y={cell.row * pitch}
            width={size}
            height={size}
            rx={radius}
            fill={cell.level === 0 ? trackColor : color}
            fillOpacity={cell.level === 0 ? 1 : LEVEL_OPACITY[cell.level]}
          />
        ))}
      </Svg>
    </View>
  );
});

export default YearHeat;
