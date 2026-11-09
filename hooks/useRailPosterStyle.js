// TV & Film ana ekranlarındaki standart yatay rail posterleri için ortak boyut
// ve köşe hesaplaması. Ayarlardaki railPosterSize ("normal" | "small" | "xsmall")
// ve railPosterRadius değerlerine göre poster/hücre ölçülerini döner.
//
// Taban ölçüler tüm rail bölümlerinde ortaktır (similarItem/similarPoster):
//   poster ve hücre: width*0.4 × width*0.6
// Boyut çarpanı utils/posterSizes'tan gelir (Küçük ×0.85, Daha küçük ×0.72).

import { useMemo } from "react";
import { Dimensions } from "react-native";
import { useListLayoutSettings } from "../context/AppSettingsContext";
import { posterSizeScale } from "../utils/posterSizes";

const { width } = Dimensions.get("window");

export default function useRailPosterStyle() {
  const { railPosterSize, railPosterRadius } = useListLayoutSettings();
  // Sonuç nesnesi memo'lu: memo'lu rail kartlarına prop olarak geçtiğinde her
  // render'da yeni referans üretip kartları boşuna yeniden çizmesin.
  return useMemo(() => {
    const scale = posterSizeScale(railPosterSize);
    const posterWidth = width * 0.4 * scale;
    const posterHeight = width * 0.6 * scale;
    return {
      posterWidth,
      posterHeight,
      itemWidth: posterWidth,
      // Ana ekran raylarında poster altında artık başlık/yıl çizilmiyor.
      // Hücreyi postere göre yüksek tutmak her bölümün sonunda görünmez bir
      // boşluk oluşturuyordu; gerekli nefes kartların marginBottom değerinde.
      itemHeight: posterHeight,
      radius: railPosterRadius,
      sizeScale: scale,
    };
  }, [railPosterRadius, railPosterSize]);
}
