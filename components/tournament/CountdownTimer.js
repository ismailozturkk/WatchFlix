// components/tournament/CountdownTimer.js
//
// Gün : Saat : Dakika : Saniye geri sayımı. Değişen RAKAMLAR üstten alta doğru
// kayarak yenilenir (flip/odometer hissi): yeni rakam yukarıdan girer, eski
// rakam aşağı çıkar. Her hücre 0..9 değil, "eski + yeni" iki katman tutar; bu
// sayede her değişim yönü TUTARLI (her zaman üst→alt) olur, 9→0 sıçraması olmaz.
//
// Her saniye kendi içinde yeniden render olur (parent'i tetiklemez). "now()"
// motordan gelir → setDebugNow ile dondurulduğunda sayaç da durur (önizleme).
//
// Ölçüler yazı boyutundan türer (countdownLayout.js); `fill` kipinde satır
// ölçülür ve yazı, dört kutu her yazı tipinde sığacak kadar küçülür. Rakam,
// ayraç ve etiketler sistem yazı büyütmesini almaz (kutular sabit ölçülü).

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { now } from "@services/tournamentEngine";
import { pickByLanguage } from "@utils/appLanguages";
import { RollingDigit } from "../animated/RollingNumber";
import { countdownDims, SEP_FONT_RATIO } from "@components/tournament/countdownLayout";
import useLoopActive from "../../hooks/useLoopActive";

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
        allowFontScaling={false}
        numberOfLines={1}
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
  const [rowW, setRowW] = useState(0); // yalnız fill kipinde ölçülür
  const [, force] = useState(0);
  // Saniye saati yalnız ekran görünür + uygulama öndeyken (gizli sekmede /
  // arka planda boşuna render yok). Geri dönünce kalan süre now()'dan
  // hesaplandığı için doğru değer anında çizilir.
  const active = useLoopActive();
  useEffect(() => {
    if (!active) return undefined;
    force((x) => (x + 1) % 1e6);
    const id = setInterval(() => force((x) => (x + 1) % 1e6), 1000);
    return () => clearInterval(id);
  }, [active]);

  const remaining = Math.max(0, (deadlineMs || 0) - now());
  const tot = Math.floor(remaining / 1000);
  const d = Math.floor(tot / 86400);
  const h = Math.floor((tot % 86400) / 3600);
  const m = Math.floor((tot % 3600) / 60);
  const s = tot % 60;

  // lg dar ekranda (≤ 350dp) bir kademe küçülür; fill'de satıra sığdırılır.
  const dims = countdownDims(size, screenW, fill ? rowW : 0);
  const labels = pickByLanguage(lang, {
    tr: ["GÜN", "SAAT", "DK", "SN"],
    en: ["DAY", "HR", "MIN", "SEC"],
    es: ["DÍAS", "H", "MIN", "S"],
    pt: ["DIAS", "H", "MIN", "S"],
    de: ["TAG", "STD", "MIN", "SEK"],
    it: ["GG", "ORE", "MIN", "SEC"],
    fr: ["J", "H", "MIN", "S"],
    ja: ["日", "時間", "分", "秒"],
  });
  const values = [d, h, m, s];

  return (
    <View
      style={[styles.row, fill && styles.rowFill]}
      onLayout={fill ? (e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== rowW) setRowW(w);
      } : undefined}
    >
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
              allowFontScaling={false}
              style={[
                styles.sep,
                {
                  color: textColor,
                  fontSize: dims.font * SEP_FONT_RATIO,
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
