// hooks/usePosterCorner.js
//
// Eğlence ve Kütüphane yüzeylerindeki afiş köşesi: Ayarlar > Poster görünümü'ndeki
// göreli kademeye göre yüzeyin KENDİ taban köşesini ölçekler (utils/posterCorners
// scalePosterCorner). "Normal" seçiliyken her yüzey bugünkü görünümünde kalır.
//
//   const corner = usePosterCorner("fun");
//   <View style={[styles.poster, { borderRadius: corner(10) }]} />
//
// Dönen işlev memo'lu: memo'lu kartlara prop olarak geçilebilir.

import { useCallback } from "react";
import { useListLayoutSettings } from "../context/AppSettingsContext";
import { scalePosterCorner } from "../utils/posterCorners";

export default function usePosterCorner(area) {
  const { funPosterRadius, libraryPosterRadius } = useListLayoutSettings() || {};
  const value = area === "library" ? libraryPosterRadius : funPosterRadius;
  return useCallback((base) => scalePosterCorner(base, value), [value]);
}
