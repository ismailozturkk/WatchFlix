// components/detail/RatingLogos.js
//
// Harici puan çipleri için küçük, kendi çizdiğimiz simgeler (resmî logo dosyası KULLANILMAZ — marka dosyası
// lisansı ve boyut derdi yok; renk ve biçim, her serviste bilinen kuralları izler):
//   • IMDb          → sarı yuvarlak dikdörtgen üzerinde siyah "IMDb"
//   • Rotten Tom.   → ≥%60 kırmızı domates (yeşil sap), altı yeşil "çürük" leke
//   • Metascore     → Metacritic'in renk eşiğiyle (yeşil / sarı / kırmızı) kare, içinde puan
// Hepsi sabit boyutlu ve temadan bağımsızdır (marka renkleri açık / koyu temada aynı kalır).
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { metascoreTone, tomatoState } from "../../utils/externalRatings";

export const IMDB_YELLOW = "#F5C518";
export const TONE_COLORS = { green: "#66CC33", yellow: "#FFCC33", red: "#FF3B30" };
export const TOMATO_COLORS = { fresh: "#FA320A", rotten: "#6AA84F" };
const TONES = TONE_COLORS;
const TOMATO = TOMATO_COLORS;

export const ImdbLogo = memo(function ImdbLogo() {
  return (
    <View style={styles.imdb} accessible={false}>
      <Text allowFontScaling={false} style={styles.imdbText}>
        IMDb
      </Text>
    </View>
  );
});

export const TomatoLogo = memo(function TomatoLogo({ percent, size = 18 }) {
  const state = tomatoState(percent) || "fresh";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {state === "fresh" ? (
        <>
          <Circle cx="12" cy="13.5" r="9" fill={TOMATO.fresh} />
          {/* sap / yaprak */}
          <Path d="M12 5.2c-1.2-1.6-3.1-2-4.6-1.3 1.2.3 1.9 1 2.2 1.9-1.3-.3-2.7.2-3.5 1.2 1.6-.2 2.7.2 3.4 1 .5-.7 1.2-1.1 2.5-.6V5.2zm0 0c1.2-1.6 3.1-2 4.6-1.3-1.2.3-1.9 1-2.2 1.9 1.3-.3 2.7.2 3.5 1.2-1.6-.2-2.7.2-3.4 1-.5-.7-1.2-1.1-2.5-.6V5.2z" fill="#3E8E1C" />
        </>
      ) : (
        <>
          {/* çürük domates: düzensiz yeşil leke */}
          <Path
            d="M12 3.5c2.2 0 3.3 1.7 5.1 2.2 2.3.7 4.4 2.4 4.4 5.3 0 2.4-1.4 3.3-1.6 5.1-.3 2.5-2.6 5.4-6.4 5.4-4.1 0-7-2.4-7.4-5.9-.2-1.8-1.9-2.6-1.9-4.9 0-3.1 2.4-4.6 4.6-5.2C10.1 5.2 10 3.5 12 3.5z"
            fill={TOMATO.rotten}
          />
          <Circle cx="9" cy="11" r="1.1" fill="#3B6B27" />
          <Circle cx="14.5" cy="14" r="1.4" fill="#3B6B27" />
        </>
      )}
    </Svg>
  );
});

export const MetascoreLogo = memo(function MetascoreLogo({ score }) {
  const tone = metascoreTone(score) || "yellow";
  return (
    <View style={[styles.meta, { backgroundColor: TONES[tone] }]} accessible={false}>
      <Text allowFontScaling={false} style={[styles.metaText, { color: tone === "yellow" ? "#1A1A1A" : "#FFFFFF" }]}>
        {String(score)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  imdb: {
    backgroundColor: IMDB_YELLOW,
    borderRadius: 4,
    paddingHorizontal: 5,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  imdbText: { color: "#000000", fontSize: 11, fontWeight: "900", letterSpacing: -0.3 },
  meta: { minWidth: 24, height: 22, borderRadius: 5, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  metaText: { fontSize: 13, fontWeight: "800" },
});
