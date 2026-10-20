// components/tournament/CountdownTimer.js
//
// Gün : Saat : Dakika : Saniye geri sayımı. Değişen RAKAMLAR üstten alta doğru
// kayarak yenilenir (flip/odometer hissi): yeni rakam yukarıdan girer, eski
// rakam aşağı çıkar. Her hücre 0..9 değil, "eski + yeni" iki katman tutar; bu
// sayede her değişim yönü TUTARLI (her zaman üst→alt) olur, 9→0 sıçraması olmaz.
//
// Her saniye kendi içinde yeniden render olur (parent'i tetiklemez). "now()"
// motordan gelir → setDebugNow ile dondurulduğunda sayaç da durur (önizleme).

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { now } from "@services/tournamentEngine";
import { pickByLanguage } from "@utils/appLanguages";
import { RollingDigit } from "../animated/RollingNumber";

const DUR = 420;

// ─── Bir birim (2 haneli kutu + etiket) ───────────────────────────────────────
function Unit({ value, label, dims, textColor, boxColor, labelColor, fill }) {
  const s = String(value).padStart(2, "0");
  const digitStyle = {
    width: dims.w,
    fontSize: dims.font,
    lineHeight: dims.h,
    color: textColor,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  };
  return (
    <View style={fill ? styles.unitFill : styles.unit}>
      <View
        style={[
          styles.box,
          fill && styles.boxFill,
          { backgroundColor: boxColor, gap: dims.gap, paddingHorizontal: dims.pad, borderRadius: dims.radius || 8 },
        ]}
      >
        <RollingDigit
          value={s[0]}
          height={dims.h}
          width={dims.w}
          textStyle={digitStyle}
          duration={DUR}
        />
        <RollingDigit
          value={s[1]}
          height={dims.h}
          width={dims.w}
          textStyle={digitStyle}
          duration={DUR}
        />
      </View>
      <Text
        style={{
          color: labelColor,
          fontSize: dims.label,
          fontWeight: "800",
          marginTop: 3,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function CountdownTimer({
  deadlineMs,
  lang = "tr",
  size = "lg",
  textColor = "#fff",
  boxColor = "rgba(255,255,255,0.16)",
  labelColor = "rgba(255,255,255,0.72)",
  // fill: dört kutu satırın tamamına eşit yayılır (hero paneli); aksi halde
  // içeriği kadar yer kaplar (Hub kartı).
  fill = false,
}) {
  const { width: screenW } = useWindowDimensions();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => (x + 1) % 1e6), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, (deadlineMs || 0) - now());
  const tot = Math.floor(remaining / 1000);
  const d = Math.floor(tot / 86400);
  const h = Math.floor((tot % 86400) / 3600);
  const m = Math.floor((tot % 3600) / 60);
  const s = tot % 60;

  // lg: dar ekranda (≤ 350dp) hero panelinin içine sığsın diye bir kademe küçülür.
  const dims =
    size === "lg"
      ? screenW <= 350
        ? { h: 28, w: 17, font: 22, label: 9, gap: 3, pad: 5, radius: 10 }
        : { h: 32, w: 20, font: 27, label: 10, gap: 3, pad: 6, radius: 10 }
      : { h: 19, w: 14, font: 15, label: 7, gap: 2, pad: 5, radius: 8 };
  const labels = pickByLanguage(lang, {
    tr: ["GÜN", "SAAT", "DK", "SN"],
    en: ["DAY", "HR", "MIN", "SEC"],
    es: ["DÍAS", "H", "MIN", "S"],
    pt: ["DIAS", "H", "MIN", "S"],
    de: ["TAG", "STD", "MIN", "SEK"],
  });
  const values = [d, h, m, s];

  return (
    <View style={[styles.row, fill && styles.rowFill]}>
      {values.map((v, i) => (
        <React.Fragment key={i}>
          <Unit
            value={v}
            label={labels[i]}
            dims={dims}
            textColor={textColor}
            boxColor={boxColor}
            labelColor={labelColor}
            fill={fill}
          />
          {i < 3 && (
            <Text
              style={[
                styles.sep,
                {
                  color: textColor,
                  fontSize: dims.font * 0.62,
                  marginBottom: dims.label + 6,
                },
              ]}
            >
              :
            </Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  rowFill: { alignSelf: "stretch" },
  unit: { alignItems: "center" },
  unitFill: { flex: 1, alignItems: "center" },
  box: {
    flexDirection: "row",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  // Kutu, birimin tüm genişliğini doldurur; rakamlar ortada kalır.
  boxFill: { alignSelf: "stretch", justifyContent: "center", paddingVertical: 5 },
  sep: { fontWeight: "900", marginHorizontal: 3, alignSelf: "center" },
});
