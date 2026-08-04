// TV & Film ana ekranlarındaki standart yatay rail posterleri için ortak boyut
// ve köşe hesaplaması. Ayarlardaki railPosterSize ("normal" | "small") ve
// railPosterRadius (4 | 15 | 24) değerlerine göre poster/hücre ölçülerini döner.
//
// Taban ölçüler tüm rail bölümlerinde ortaktır (similarItem/similarPoster):
//   poster: width*0.4 × width*0.6, hücre yüksekliği: width*0.62
// "small" seçiminde bu ölçüler 0.85 ile çarpılır (biraz küçültür).

import { useMemo } from "react";
import { Dimensions } from "react-native";
import { useListLayoutSettings } from "../context/AppSettingsContext";

const { width } = Dimensions.get("window");

export default function useRailPosterStyle() {
  const { railPosterSize, railPosterRadius } = useListLayoutSettings();
  // Sonuç nesnesi memo'lu: memo'lu rail kartlarına prop olarak geçtiğinde her
  // render'da yeni referans üretip kartları boşuna yeniden çizmesin.
  return useMemo(() => {
    const scale = railPosterSize === "small" ? 0.85 : 1;
    const posterWidth = width * 0.4 * scale;
    return {
      posterWidth,
      posterHeight: width * 0.6 * scale,
      itemWidth: posterWidth,
      itemHeight: width * 0.62 * scale,
      radius: railPosterRadius,
    };
  }, [railPosterRadius, railPosterSize]);
}
